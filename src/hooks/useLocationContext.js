/**
 * src/hooks/useLocationContext.js
 *
 * React binding for LocationContextManager (Signal 18).
 *
 * Exposes:
 *   * context  — { country, confidence, sources, conflict, isDefault,
 *                 fromCache, timestamp, detected_region, loading }
 *   * refresh  — force a fresh resolve (used by the settings "Detect"
 *                button; does NOT itself prompt for GPS — the caller
 *                passes an already-granted geolocation signal).
 *
 * Cache-aware: on mount it resolves once (reusing the fresh cache when
 * available); a stale cache triggers a background refresh. Consumers
 * never trigger network/GPS work just by re-rendering.
 *
 * Privacy: only the derived country code is exposed; no coordinates.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveLocationContext } from '../services/location/locationContextManager';
import { locationCache } from '../services/location/locationCache';

const EMPTY = {
  country: null,
  confidence: 0,
  sources: [],
  conflict: { detected: false, description: null },
  isDefault: true,
  fromCache: false,
  timestamp: null,
  detected_region: null,
  loading: true,
};

/**
 * @param {object} [options]
 * @param {string|null} [options.userCountry] Account's chosen country.
 * @param {string|null} [options.userRegion] Account's chosen region.
 * @param {object|null} [options.geolocation] Granted GPS signal (only
 *   when the user already granted permission — never prompt here).
 * @param {boolean} [options.autoResolve=true]
 * @returns {{ context: object, refresh: (opts?: object) => Promise<object> }}
 */
export default function useLocationContext(options = {}) {
  const {
    userCountry = '',
    userRegion = '',
    geolocation = null,
    autoResolve = true,
  } = options;

  const [context, setContext] = useState(EMPTY);
  const resolveRef = useRef(0);

  const refresh = useCallback(async (opts = {}) => {
    const runId = ++resolveRef.current;
    setContext((prev) => ({ ...prev, loading: true }));
    try {
      const result = await resolveLocationContext({
        userCountry: opts.userCountry ?? userCountry,
        userRegion: opts.userRegion ?? userRegion,
        geolocation: opts.geolocation ?? geolocation,
        force: opts.force ?? true,
      });
      if (runId === resolveRef.current) {
        setContext({ ...result, loading: false });
      }
      return result;
    } catch (err) {
      if (runId === resolveRef.current) {
        setContext((prev) => ({ ...prev, loading: false }));
      }
      return EMPTY;
    }
  }, [userCountry, userRegion, geolocation]);

  useEffect(() => {
    if (!autoResolve) return undefined;
    let cancelled = false;
    // Deferral (react-hooks/set-state-in-effect): push into a microtask.
    Promise.resolve().then(async () => {
      if (cancelled) return;
      // Fresh cache → reuse without any signal work.
      if (locationCache.isFresh()) {
        const cached = locationCache.get();
        setContext({
          ...cached,
          fromCache: true,
          detected_region: userRegion || null,
          loading: false,
        });
        return;
      }
      const result = await resolveLocationContext({
        userCountry, userRegion, geolocation, force: false,
      });
      if (!cancelled) setContext({ ...result, loading: false });
    });
    return () => { cancelled = true; };
  }, [userCountry, userRegion, geolocation, autoResolve]);

  return { context, refresh };
}
