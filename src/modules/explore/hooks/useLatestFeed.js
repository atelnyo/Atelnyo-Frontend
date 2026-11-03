/**
 * src/modules/explore/hooks/useLatestFeed.js
 *
 * Phase 3 — progressive loading for the flat Latest stream
 * (`GET /api/feed/latest/`, cursor pagination).
 *
 * The section-based home feed intentionally keeps per-rail counts, so
 * cursor pagination does NOT apply there. This hook is the only
 * infinite-scroll path: initial batch → append on scroll → stop at end.
 *
 * Request states (the UI must distinguish all of them):
 *   idle | loading (first batch) | loading-more | refreshing |
 *   ready (more available) | empty (zero results) | end (no more) | error
 *
 * Phase 4 — hybrid refresh. The hook separates the browsing moments:
 *   initial  → first batch (eligibility + chronological rank, server-side)
 *   more     → append next cursor page, never replace visible items
 *   refresh  → MANUAL refresh: replace with a fresh first page (the user
 *              asked for it); on failure keep visible items + retry
 *   arrivals → `checkForNew()` counts unseen first-page items WITHOUT
 *              touching the list; `applyNew()` prepends them (pill flow),
 *              `dismissNew()` suppresses the pill for this session
 *   return   → hook state (items, seen ids, cursor) survives while the
 *              component stays mounted; remount refetches page one
 *   switch   → `contentType`/`userId` change resets everything, including
 *              the pending pill — feeds never share repetition state
 *
 * Per-feed rule (Latest only): refresh is strictly chronological — no
 * recommendation re-rank, no fabricated items. When the fresh page holds
 * nothing unseen, it is the same eligible page again (reuse, not noise).
 * For-You/Explore/Home keep their own refresh rules and are untouched.
 *
 * Guarantees:
 *   - One in-flight page request at a time (scroll bursts collapse).
 *   - Outdated responses (filter/account change, unmount) are dropped by
 *     sequence guard — they never overwrite newer results.
 *   - Items dedupe by stable `content_type:object_id` across pages.
 *   - A failed page is NEVER retried automatically (no infinite loop);
 *     the caller renders retry from `retry()`.
 *   - Changing `contentType` / `userId` resets pagination from page one.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { feedService } from '../../../services/api';

export const LATEST_INITIAL_LIMIT = 12;

/**
 * Phase 5 — stable content identity for list keys.
 *
 * Returns `type:id` (never the render index): two records with the same
 * display title still key differently, so insertion/reordering reuses the
 * correct component. Returns null when the item carries no usable
 * identity — the caller must still not fall back to the array index for
 * keyed rows that can move (render keyless rows without moving them, or
 * omit them from the windowed list).
 */
export function latestKey(item) {
  const type = item?.content_type || item?.item_type;
  const id = item?.object_id ?? item?.id;
  if (!type || id === null || id === undefined) return null;
  return `${type}:${id}`;
}

const itemKey = latestKey;

function describeError(err) {
  if (!err?.response && (err?.message === 'Network Error' || err?.code === 'ERR_NETWORK')) {
    return 'Network Error';
  }
  if (err?.code === 'ECONNABORTED' || err?.message?.includes?.('timeout')) {
    return 'Request timed out.';
  }
  return err?.response?.data?.detail || err?.message || 'Could not load feed.';
}

export default function useLatestFeed({
  limit = LATEST_INITIAL_LIMIT,
  contentType = null,
  userId = null,
  autoLoad = true,
} = {}) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [newCount, setNewCount] = useState(0);
  const [checkingNew, setCheckingNew] = useState(false);

  const seqRef = useRef(0);
  const inFlightRef = useRef(false);
  const seenRef = useRef(new Set());
  const nextCursorRef = useRef(null);
  const hasMoreRef = useRef(false);
  const statusRef = useRef('idle');
  const failedRef = useRef(null); // { mode, cursor } of the last failure
  const observerRef = useRef(null);
  const checkingRef = useRef(false);
  const pendingRef = useRef([]); // unseen first-page items awaiting apply/dismiss

  const setStatusBoth = (value) => {
    statusRef.current = value;
    setStatus(value);
  };

  const resetState = useCallback(() => {
    seqRef.current += 1;
    inFlightRef.current = false;
    checkingRef.current = false;
    seenRef.current = new Set();
    nextCursorRef.current = null;
    hasMoreRef.current = false;
    failedRef.current = null;
    pendingRef.current = [];
    setItems([]);
    setError(null);
    setNewCount(0);
    setCheckingNew(false);
  }, []);

  const applyPage = useCallback((seq, mode, results, nextCursor, hasMore) => {
    if (seq !== seqRef.current) return; // outdated — drop, never overwrite
    const fresh = [];
    for (const item of Array.isArray(results) ? results : []) {
      const key = itemKey(item);
      if (!key) {
        fresh.push(item);
        continue;
      }
      if (seenRef.current.has(key)) continue;
      seenRef.current.add(key);
      fresh.push(item);
    }
    nextCursorRef.current = nextCursor || null;
    hasMoreRef.current = Boolean(hasMore) && Boolean(nextCursor);
    failedRef.current = null;
    // A fresh first page absorbs any pending pill — its items are either
    // in this page (now visible) or older than it (still reachable via
    // the cursor, deduped by the seen set).
    if (mode !== 'more') {
      pendingRef.current = [];
      setNewCount(0);
    }
    if (mode === 'more') {
      setItems((prev) => (fresh.length ? [...prev, ...fresh] : prev));
      setStatusBoth(hasMoreRef.current ? 'ready' : 'end');
    } else {
      setItems(fresh);
      if (fresh.length === 0) {
        setStatusBoth('empty');
      } else {
        setStatusBoth(hasMoreRef.current ? 'ready' : 'end');
      }
    }
    setError(null);
  }, []);

  const fetchPage = useCallback(async ({ mode, cursor }) => {
    if (inFlightRef.current) return; // collapse scroll bursts
    if (mode === 'more' && !hasMoreRef.current) return; // already at end
    const seq = ++seqRef.current;
    inFlightRef.current = true;
    failedRef.current = null;
    setError(null);
    setStatusBoth(mode === 'more' ? 'loading-more' : mode === 'refresh' ? 'refreshing' : 'loading');
    try {
      const res = await feedService.latest(limit, cursor, contentType);
      const data = res?.data?.data || res?.data || {};
      inFlightRef.current = false;
      applyPage(seq, mode, data.results, data.next_cursor, data.has_more);
    } catch (err) {
      if (seq !== seqRef.current) return; // unmounted / superseded
      inFlightRef.current = false;
      failedRef.current = { mode, cursor };
      setError(describeError(err));
      // Keep already-visible items on more/refresh failures; only the
      // very first batch has nothing to fall back to.
      setStatusBoth('error');
    }
  }, [limit, contentType, applyPage]);

  // All three return the underlying request promise (or undefined when
  // the call is a guarded no-op) so the component can chain scroll work:
  // manual refresh → scroll the list to top on success (predictable,
  // user-initiated navigation); pill apply stays position-safe via the
  // feedScroll anchor helpers instead.
  const loadMore = useCallback(() => {
    if (statusRef.current !== 'ready') return undefined;
    return fetchPage({ mode: 'more', cursor: nextCursorRef.current });
  }, [fetchPage]);

  const refresh = useCallback(() => {
    return fetchPage({ mode: 'refresh', cursor: null });
  }, [fetchPage]);

  const retry = useCallback(() => {
    const failed = failedRef.current;
    if (!failed) {
      return fetchPage({ mode: 'initial', cursor: null });
    }
    return fetchPage(failed);
  }, [fetchPage]);

  // New arrivals while browsing (pill flow). Fetches ONLY the first page
  // and counts items never displayed this session — the visible list is
  // untouched, so reading position never jumps. A failure is silent: the
  // previous pill (if any) stays, the list stays, no error state.
  const checkForNew = useCallback(async () => {
    if (checkingRef.current) return;
    const s = statusRef.current;
    // Only a settled list can have "new since displayed" (never during
    // a load, and never before the first batch exists).
    if (s !== 'ready' && s !== 'end' && s !== 'empty') return;
    checkingRef.current = true;
    setCheckingNew(true);
    try {
      const res = await feedService.latest(limit, null, contentType);
      const data = res?.data?.data || res?.data || {};
      const unseen = [];
      for (const item of Array.isArray(data.results) ? data.results : []) {
        const key = itemKey(item);
        if (!key || seenRef.current.has(key)) continue;
        unseen.push(item);
      }
      pendingRef.current = unseen;
      setNewCount(unseen.length);
    } catch {
      // Silent by design — arrival checks must never break browsing.
    } finally {
      checkingRef.current = false;
      setCheckingNew(false);
    }
  }, [limit, contentType]);

  // User tapped the pill: prepend the already-fetched items (no second
  // download). The older-window cursor is kept — it still bounds items
  // older than the previously displayed page, and the seen set backstops
  // any overlap.
  //
  // Returns the number of items prepended. The component preserves
  // reading position itself: capture the anchor (first visible key via
  // `firstKey` + feedScroll.captureAnchor) BEFORE calling, then
  // feedScroll.restoreAnchor AFTER the prepend renders. When the user
  // is already at the top (`feedScroll.isAtTop`), apply directly with
  // no compensation needed.
  const applyNew = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending.length) return 0;
    for (const item of pending) {
      const key = itemKey(item);
      if (key) seenRef.current.add(key);
    }
    pendingRef.current = [];
    setNewCount(0);
    setItems((prev) => [...pending, ...prev]);
    return pending.length;
  }, []);

  // User dismissed the pill: suppress these ids for this session so the
  // next check does not re-surface them. A manual refresh still shows
  // whatever is chronologically first — dismiss never hides content.
  const dismissNew = useCallback(() => {
    for (const item of pendingRef.current) {
      const key = itemKey(item);
      if (key) seenRef.current.add(key);
    }
    pendingRef.current = [];
    setNewCount(0);
  }, []);

  // Initial load + reset on filter/account/limit change. The sequence
  // bump drops any late response from the previous filter/account.
  useEffect(() => {
    resetState();
    if (!autoLoad) {
      setStatusBoth('idle');
      return undefined;
    }
    fetchPage({ mode: 'initial', cursor: null });
    return () => {
      seqRef.current += 1; // unmount: ignore late responses
      inFlightRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType, userId, limit, autoLoad]);

  // Sentinel: when the observed element scrolls into view, pull the next
  // page. Guarded by statusRef so repeated intersections while a request
  // is in flight (or after the end) fire nothing.
  const sentinelRef = useCallback((node) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!node || typeof IntersectionObserver === 'undefined') return;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore();
        }
      },
      { rootMargin: '400px' },
    );
    observerRef.current.observe(node);
  }, [loadMore]);

  useEffect(() => () => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
  }, []);

  const firstKey = items.length ? itemKey(items[0]) : null;

  return {
    items,
    status,
    error,
    hasMore: hasMoreRef.current,
    isEmpty: status === 'empty',
    isEnd: status === 'end',
    newCount,
    checkingNew,
    firstKey,
    loadMore,
    refresh,
    retry,
    checkForNew,
    applyNew,
    dismissNew,
    sentinelRef,
  };
}
