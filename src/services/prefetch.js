/**
 * src/services/prefetch.js
 *
 * Smart prefetching — loads data BEFORE the user navigates, so the
 * next page renders instantly.
 *
 * Strategy:
 *   1. On hover (desktop) → prefetch after 150ms delay (debounced)
 *   2. On idle (requestIdleCallback) → prefetch high-probability routes
 *   3. Visibility-based → only prefetch when the tab is visible
 *
 * Usage:
 *   import { prefetchOnHover, prefetchOnIdle } from '../services/prefetch';
 *
 *   <Link
 *     onMouseEnter={() => prefetchOnHover(() => courseService.getById(id))}
 *     to={`/course/${id}`}
 *   />
 *
 * Rules (from the audit):
 *   - Only prefetch when probability of navigation is HIGH
 *   - Never prefetch unlimited pages
 *   - Respect connection type (skip on slow/2G)
 *   - Skip if already cached
 *   - Cancel on mouse leave
 */
import { cachedGet } from './api';

// Don't prefetch on slow connections
function _isSlowConnection() {
  const conn = navigator.connection;
  if (!conn) return false;
  return conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g';
}

// Don't prefetch if the tab is hidden
function _isTabHidden() {
  return document.hidden;
}

const _prefetched = new Set();

/**
 * Prefetch a single resource — with dedup (never fetch the same URL twice).
 *
 * @param {() => Promise} fetchFn — the service call to make
 * @param {string} [key] — dedup key (defaults to fetchFn.toString())
 */
export function prefetch(fetchFn, key) {
  if (_isSlowConnection() || _isTabHidden()) return;
  const k = key || String(fetchFn);
  if (_prefetched.has(k)) return;
  _prefetched.add(k);

  // Use idle callback if available, otherwise setTimeout
  const schedule = typeof requestIdleCallback === 'function'
    ? requestIdleCallback
    : (fn) => setTimeout(fn, 0);

  schedule(() => {
    if (_isTabHidden()) return;
    Promise.resolve()
      .then(() => fetchFn())
      .catch(() => {}); // Silent — prefetch failures are non-critical
  }, { timeout: 5000 });
}

/**
 * Prefetch on hover — call in onMouseEnter, returns cleanup for onMouseLeave.
 * Debounced: waits 150ms before firing (user must hold hover).
 *
 * @param {() => Promise} fetchFn
 * @returns {{ onMouseLeave: () => void }}
 */
export function prefetchOnHover(fetchFn) {
  let timer = null;
  let cancelled = false;

  timer = setTimeout(() => {
    if (!cancelled) prefetch(fetchFn);
  }, 150);

  return {
    onMouseLeave() {
      cancelled = true;
      if (timer) clearTimeout(timer);
    },
  };
}

/**
 * Prefetch on idle — fires during browser idle time.
 * Use for high-probability next pages (e.g. from the home feed).
 *
 * @param {() => Promise} fetchFn
 * @param {string} [key]
 */
export function prefetchOnIdle(fetchFn, key) {
  if (_isSlowConnection()) return;
  prefetch(fetchFn, key);
}

/**
 * Prefetch a list of resources during idle time.
 * Useful for the Explore page to preload the next visible items.
 *
 * @param {Array<{ fetchFn: () => Promise, key: string }>} items
 */
export function prefetchBatch(items) {
  if (_isSlowConnection() || _isTabHidden()) return;

  const schedule = typeof requestIdleCallback === 'function'
    ? requestIdleCallback
    : (fn) => setTimeout(fn, 0);

  schedule(() => {
    items.forEach(({ fetchFn, key }) => {
      prefetch(fetchFn, key);
    });
  }, { timeout: 5000 });
}

/**
 * Clear the prefetch dedup set (e.g. on logout).
 */
export function clearPrefetchDedup() {
  _prefetched.clear();
}
