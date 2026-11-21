/**
 * src/hooks/useFetch.js
 *
 * Reusable data-fetching hook with real AbortController cancellation.
 *
 * Usage:
 *   const { data, loading, error, refetch } = useFetch(
 *     (signal) => courseService.getAll(),  // signal is passed automatically
 *     { defaultValue: [], deps: [] },
 *   );
 *
 * OR with abortableGet:
 *   const { data, loading, error, refetch } = useFetch(
 *     (signal) => abortableGet('courses/', {}, signal),
 *     { defaultValue: [], deps: [] },
 *   );
 *
 * Pagination (optional):
 *   const { data, hasMore, loadingMore, loadMore, loadMoreError } = useFetch(
 *     (signal, page) => marketplaceService.list({ page, page_size: 100 }, signal),
 *     { defaultValue: [] },
 *   );
 *   // A page-number response with `next` enables loadMore(); pages are
 *   // appended and deduped by id. Refetch() always restarts at page 1.
 *
 * Features:
 *   - Real AbortController cancellation on unmount / dependency change
 *   - Returns { data, loading, error, refetch } — standard contract * - ``refetch()`` re-runs the fetch without changing deps
 * - ``removeLocal(predicate)`` drops rows from the current data instantly
 *   (optimistic delete — no loading flash). The next refetch reconciles
 *   with the server (and restores rows when the mutation failed — callers
 *   refetch in their catch path). Safe no-op when data isn't an array.
 * - ``updateLocal(predicate, patch)`` patches matching rows in place for
 *   optimistic toggles; pass an object to shallow-merge or a function to
 *   transform the row. Also a safe no-op when data isn't an array.
 *   - ``transform`` callback for normalising the response
 *   - ``defaultValue`` is used while loading AND on error
 *
 * Backward compatible: if fetchFn doesn't use the signal, it still works
 * (the signal is just ignored). The only change callers need to make to
 * get real cancellation is accepting the signal parameter.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * @param {(signal: AbortSignal, page: number) => Promise<{data: any}>} fetchFn
 * @param {object}                      [opts]
 * @param {any}                         [opts.defaultValue=null]
 * @param {Array}                       [opts.deps=[]]
 * @param {(responseData) => any}       [opts.transform]
 * @returns {{
 *   data: any, loading: boolean, error: Error|null,
 *   refetch: () => void,
 *   removeLocal: (predicate: (row: any) => boolean) => void,
 *   updateLocal: (predicate: (row: any) => boolean, patch: object|((row: any) => any)) => void,
 *   loadMore: () => void, loadingMore: boolean, hasMore: boolean, loadMoreError: Error|null,
 * }}
 */
export default function useFetch(fetchFn, { defaultValue = null, deps, transform } = {}) {
  const [data, setData] = useState(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(null);

  // Counter-based key so refetch() always triggers a new effect run
  const [tick, setTick] = useState(0);

  // Keep all captured values in refs so doFetch has stable identity
  const fnRef = useRef(fetchFn);
  fnRef.current = fetchFn;
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const dvRef = useRef(defaultValue);
  dvRef.current = defaultValue;

  const pageRef = useRef(0);
  const loadingRef = useRef(true);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const moreControllerRef = useRef(null);

  const doFetch = useCallback(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    loadingRef.current = true;
    setError(null);

    const t = transformRef.current;
    const dv = dvRef.current;

    // Pass signal to fetchFn — callers that accept (signal) get real
    // cancellation; callers that ignore it still work (no error).
    Promise.resolve(fnRef.current(signal, 1))
      .then((res) => {
        if (signal.aborted) return;
        const raw = res?.data;
        const normalised = t ? t(raw) : raw ?? dv;
        setData(normalised);
        setError(null);
        pageRef.current = 1;
        const more = Boolean(raw?.next);
        hasMoreRef.current = more;
        setHasMore(more);
      })
      .catch((err) => {
        if (signal.aborted) return;
        // AbortError is expected on unmount — don't treat it as an error
        if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return;
        setError(err);
        setData(dv);
        pageRef.current = 0;
        hasMoreRef.current = false;
        setHasMore(false);
      })
      .finally(() => {
        if (!signal.aborted) {
          loadingRef.current = false;
          setLoading(false);
        }
      });

    // Cleanup: abort the real HTTP request
    return () => controller.abort();
  }, []);

  // Re-fetch when deps OR tick change.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const cancel = doFetch();
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...(deps || []), tick, doFetch]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Abort an in-flight "load more" when the component unmounts.
  useEffect(() => () => moreControllerRef.current?.abort(), []);

  const refetch = useCallback(() => {
    moreControllerRef.current?.abort();
    loadingMoreRef.current = false;
    setLoadingMore(false);
    setLoadMoreError(null);
    setTick((t) => t + 1);
  }, []);

  // Optimistic local removal — filters the current data WITHOUT flipping
  // ``loading`` (so no skeleton flash). See the contract note above.
  const removeLocal = useCallback((predicate) => {
    setData((prev) => (Array.isArray(prev) ? prev.filter((row) => !predicate(row)) : prev));
  }, []);

  // Optimistic in-place patch — keeps the row mounted (so focus and
  // scroll survive) while a toggle is in flight.
  const updateLocal = useCallback((predicate, patch) => {
    setData((prev) => {
      if (!Array.isArray(prev)) return prev;
      return prev.map((row) => {
        if (!predicate(row)) return row;
        return typeof patch === 'function' ? patch(row) : { ...row, ...patch };
      });
    });
  }, []);

  const loadMore = useCallback(() => {
    if (loadingRef.current || loadingMoreRef.current || !hasMoreRef.current) return;

    moreControllerRef.current?.abort();
    const controller = new AbortController();
    moreControllerRef.current = controller;
    const page = pageRef.current + 1;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(null);

    const t = transformRef.current;
    const dv = dvRef.current;

    Promise.resolve(fnRef.current(controller.signal, page))
      .then((res) => {
        if (controller.signal.aborted) return;
        const raw = res?.data;
        const normalised = t ? t(raw) : raw ?? dv;
        const rows = Array.isArray(normalised)
          ? normalised
          : (Array.isArray(normalised?.results) ? normalised.results : []);
        setData((prev) => {
          const base = Array.isArray(prev) ? prev : [];
          const seen = new Set(base.map((row) => row?.id));
          return [...base, ...rows.filter((row) => !seen.has(row?.id))];
        });
        pageRef.current = page;
        const more = Boolean(raw?.next);
        hasMoreRef.current = more;
        setHasMore(more);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return;
        setLoadMoreError(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      });
  }, []);

  return {
    data,
    loading,
    error,
    hasMore,
    loadingMore,
    loadMore,
    loadMoreError,
    refetch,
    removeLocal,
    updateLocal,
  };
}
