/**
 * src/utils/mediaCache.js
 *
 * sessionStorage-backed cache for MediaEntityPage payloads.
 *
 * WHY THIS EXISTS: /sheet/media/:id has no backend fetch yet
 * (GET /api/media/:id/ is a future Phase 2 sprint item). The page
 * resolves its payload from navigation state, then falls back to this
 * cache. It previously lived on ``window``, which meant a plain F5
 * refresh wiped every payload — the visitor hit the "No media loaded"
 * empty state on the SAME tab that just had the page open. sessionStorage
 * survives refreshes within the tab (and dies with it, which is exactly
 * the right lifetime for payloads this ephemeral).
 *
 * Cross-tab deep links (pasting the URL into a new tab) still show the
 * empty state — that is unchanged until the Phase 2 fetch lands.
 *
 * All storage access is defensive: private-mode quota errors, serialized
 * payload corruption, and unexpected shapes degrade to a cache miss,
 * never a crash.
 */

const STORAGE_KEY = 'atelnyo_media_cache';

function readStore() {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Arrays pass ``typeof === 'object'`` — an array payload would make
    // id lookups return array indices (cache["1"] → element 2). Reject
    // anything that is not a plain object.
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    // Corrupted JSON, disabled storage, SSR, etc. — treat as empty.
    return {};
  }
}

function writeStore(cache) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    return true;
  } catch {
    // Quota exceeded / storage disabled. Drop the OLDEST entries (plain
    // insertion order) and retry once at half size; if that still fails,
    // give up silently — the navigation-state handoff still carries the
    // payload, so this cache is an optimization, never a requirement.
    try {
      const keys = Object.keys(cache);
      const trimmed = {};
      for (const key of keys.slice(Math.floor(keys.length / 2))) {
        trimmed[key] = cache[key];
      }
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      return true;
    } catch {
      try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
      return false;
    }
  }
}

/**
 * Store a media payload for later retrieval by id (same tab).
 * Safe no-op when the payload has no usable id.
 */
export function cacheMedia(media) {
  if (typeof window === 'undefined' || !media || media.id == null) return;
  const cache = readStore();
  cache[String(media.id)] = media;
  writeStore(cache);
}

/**
 * Fetch a previously cached media payload by id. Accepts number or
 * string ids (route params are always strings; payloads often numeric).
 * Returns null on miss.
 */
export function getCachedMedia(id) {
  if (typeof window === 'undefined' || id == null) return null;
  const hit = readStore()[String(id)];
  return hit || null;
}

/**
 * Remove one payload from the cache (used by the delete flow so a
 * deleted media can no longer be re-opened from cache).
 */
export function deleteCachedMedia(id) {
  if (typeof window === 'undefined' || id == null) return;
  const cache = readStore();
  if (!(String(id) in cache)) return;
  delete cache[String(id)];
  writeStore(cache);
}

/**
 * Test/reset helper — clears the entire cache.
 */
export function clearMediaCache() {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}
