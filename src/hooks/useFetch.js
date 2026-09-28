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
 * Features:
 *   - Real AbortController cancellation on unmount / dependency change
 *   - Returns { data, loading, error, refetch } — standard contract
 *   - ``refetch()`` re-runs the fetch without changing deps
 *   - ``transform`` callback for normalising the response
 *   - ``defaultValue`` is used while loading AND on error
 *
 * Backward compatible: if fetchFn doesn't use the signal, it still works
 * (the signal is just ignored). The only change callers need to make to
 * get real cancellation is accepting the signal parameter.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * @param {(signal: AbortSignal) => Promise<{data: any}>} fetchFn
 * @param {object}                      [opts]
 * @param {any}                         [opts.defaultValue=null]
 * @param {Array}                       [opts.deps=[]]
 * @param {(responseData) => any}       [opts.transform]
 * @returns {{ data: any, loading: boolean, error: Error|null, refetch: () => void }}
 */
export default function useFetch(fetchFn, { defaultValue = null, deps, transform } = {}) {
  const [data, setData] = useState(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Counter-based key so refetch() always triggers a new effect run
  const [tick, setTick] = useState(0);

  // Keep all captured values in refs so doFetch has stable identity
  const fnRef = useRef(fetchFn);
  fnRef.current = fetchFn;
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const dvRef = useRef(defaultValue);
  dvRef.current = defaultValue;

  const doFetch = useCallback(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    setError(null);

    const t = transformRef.current;
    const dv = dvRef.current;

    // Pass signal to fetchFn — callers that accept (signal) get real
    // cancellation; callers that ignore it still work (no error).
    Promise.resolve(fnRef.current(signal))
      .then((res) => {
        if (signal.aborted) return;
        const raw = res?.data;
        const normalised = t ? t(raw) : raw ?? dv;
        setData(normalised);
        setError(null);
      })
      .catch((err) => {
        if (signal.aborted) return;
        // AbortError is expected on unmount — don't treat as an error
        if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return;
        setError(err);
        setData(dv);
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false);
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

  const refetch = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  return { data, loading, error, refetch };
}
