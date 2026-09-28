/**
 * src/services/location/locationCache.js
 *
 * LocationCache — Signal 18 of the Atelyona Location Intelligence spec.
 *
 * Location detection must NOT run on every React render:
 *   * GPS prompts are expensive and annoying — never re-ask.
 *   * GeoIP network calls cost latency + backend time.
 *
 * This module stores the LAST fused result + timestamp and answers:
 *   * isFresh()  — result is young enough to reuse without any work
 *   * isStale()  — old enough that a background refresh is warranted
 *   * get()/set() — thin typed accessors
 *
 * Persistence: in-memory for the page session, mirrored to
 * localStorage (privacy-safe — only the derived COUNTRY CODE + a
 * timestamp are stored, NEVER coordinates, NEVER the raw IP).
 */

const STORAGE_KEY = 'atelnyo_location_context';

export const DEFAULT_FRESH_MS = 6 * 60 * 60 * 1000;  // 6h — reuse freely
export const DEFAULT_STALE_MS = 24 * 60 * 60 * 1000; // 24h — refresh in bg

let _memory = null;

/**
 * @param {{ freshMs?: number, staleMs?: number }} [options]
 */
export function createLocationCache(options = {}) {
  const freshMs = options.freshMs ?? DEFAULT_FRESH_MS;
  const staleMs = options.staleMs ?? DEFAULT_STALE_MS;
  let memory = null;

  const readLocal = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.timestamp !== 'number') return null;
      return parsed;
    } catch (_) {
      return null;
    }
  };

  return {
    /** @returns {object|null} the cached {country, confidence, sources, timestamp} */
    get() {
      return memory || readLocal();
    },
    /**
     * @param {{ country: string|null, confidence: number, sources: Array,
     *           conflict: object, isDefault: boolean, timestamp: number }} value
     */
    set(value) {
      memory = value;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch (_) { /* private mode / quota — in-memory still works */ }
    },
    clear() {
      memory = null;
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* noop */ }
    },
    /** True when a cached result exists and is younger than freshMs. */
    isFresh() {
      const entry = this.get();
      return !!entry && (Date.now() - entry.timestamp) < freshMs;
    },
    /** True when a cached result exists and is older than staleMs. */
    isStale() {
      const entry = this.get();
      return !!entry && (Date.now() - entry.timestamp) >= staleMs;
    },
  };
}

/** Default singleton cache (shared across the app). */
export const locationCache = createLocationCache();
