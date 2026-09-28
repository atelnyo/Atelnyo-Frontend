/**
 * src/services/requestDiagnostics.js
 *
 * Development-only request observability. Tracks:
 *   - Dedup hits (shared in-flight requests)
 *   - Cache hits / misses / stale revalidations
 *   - Retry attempts
 *   - Slow requests (>2s)
 *   - Request counts per endpoint
 *
 * Activated via ?debug=network in the URL, or always in dev mode.
 * NEVER exposes data to normal users.
 *
 * Usage:
 *   import { diag } from './requestDiagnostics';
 *   diag.dedupHit('GET /api/me/:{}');
 *   diag.cacheHit('cachedGet /api/categories/');
 *   diag.requestComplete('GET /api/courses/', 340);
 *
 * Read diagnostics:
 *   window.__networkDiag   → summary object
 *   window.__networkDiagLog → full log array
 */

const IS_DEV = import.meta.env.DEV;
const IS_DEBUG = IS_DEV || (typeof window !== 'undefined' && window.location?.search?.includes('debug=network'));

// Only activate in dev / debug mode
const ACTIVE = IS_DEBUG;

const _log = [];
const _counts = {};
const _stats = {
  dedupHits: 0,
  dedupMisses: 0,
  cacheHits: 0,
  cacheMisses: 0,
  cacheStale: 0,
  retries: 0,
  slowRequests: 0,
  totalRequests: 0,
  errors: 0,
};

function _record(entry) {
  if (!ACTIVE) return;
  _log.push({ ...entry, timestamp: Date.now() });
  // Keep log bounded (last 500 entries)
  if (_log.length > 500) _log.shift();
}

export const diag = {
  /** In-flight request was shared (dedup hit) */
  dedupHit(key) {
    if (!ACTIVE) return;
    _stats.dedupHits++;
    _record({ type: 'dedup_hit', key });
    if (IS_DEV) console.log(`%c[dedup] HIT ${key}`, 'color: #22c55e; font-weight: bold;');
  },

  /** New in-flight request started (dedup miss) */
  dedupMiss(key) {
    if (!ACTIVE) return;
    _stats.dedupMisses++;
    _record({ type: 'dedup_miss', key });
  },

  /** Cache served a fresh response */
  cacheHit(key) {
    if (!ACTIVE) return;
    _stats.cacheHits++;
    _record({ type: 'cache_hit', key });
    if (IS_DEV) console.log(`%c[cache] HIT ${key}`, 'color: #3b82f6;');
  },

  /** Cache miss — fresh fetch required */
  cacheMiss(key) {
    if (!ACTIVE) return;
    _stats.cacheMisses++;
    _record({ type: 'cache_miss', key });
  },

  /** Cache served stale data while revalidating in background */
  cacheStale(key) {
    if (!ACTIVE) return;
    _stats.cacheStale++;
    _record({ type: 'cache_stale', key });
    if (IS_DEV) console.log(`%c[cache] STALE → revalidating ${key}`, 'color: #f59e0b;');
  },

  /** Request was retried */
  retryAttempt(key, attempt, delay) {
    if (!ACTIVE) return;
    _stats.retries++;
    _record({ type: 'retry', key, attempt, delay });
    if (IS_DEV) console.log(`%c[retry] ${key} attempt=${attempt} delay=${delay}ms`, 'color: #f97316;');
  },

  /** Request completed — tracks duration and flags slow ones */
  requestComplete(url, durationMs, status) {
    if (!ACTIVE) return;
    _stats.totalRequests++;
    const key = `req:${url}`;
    _counts[key] = (_counts[key] || 0) + 1;
    _record({ type: 'complete', url, duration: durationMs, status, count: _counts[key] });
    if (durationMs > 2000) {
      _stats.slowRequests++;
      console.log(`%c[slow] ${url} took ${durationMs}ms (${status})`, 'color: #ef4444; font-weight: bold;');
    }
  },

  /** Request failed */
  requestError(url, error) {
    if (!ACTIVE) return;
    _stats.errors++;
    _record({ type: 'error', url, message: error?.message || String(error) });
  },

  /** Get summary statistics */
  summary() {
    return {
      ..._stats,
      dedupRate: _stats.dedupHits + _stats.dedupMisses > 0
        ? Math.round((_stats.dedupHits / (_stats.dedupHits + _stats.dedupMisses)) * 100) + '%'
        : 'N/A',
      cacheRate: _stats.cacheHits + _stats.cacheMisses > 0
        ? Math.round((_stats.cacheHits / (_stats.cacheHits + _stats.cacheMisses)) * 100) + '%'
        : 'N/A',
      topEndpoints: Object.entries(_counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([k, v]) => ({ endpoint: k.replace('req:', ''), count: v })),
    };
  },

  /** Get full log */
  log() { return [..._log]; },

  /** Clear all diagnostics */
  reset() {
    _log.length = 0;
    Object.keys(_counts).forEach(k => delete _counts[k]);
    Object.keys(_stats).forEach(k => { _stats[k] = 0; });
  },
};

// Expose on window for console access
if (ACTIVE && typeof window !== 'undefined') {
  window.__networkDiag = diag.summary();
  window.__networkDiagLog = diag.log;
  // Auto-update summary every 10s
  setInterval(() => {
    try { window.__networkDiag = diag.summary(); } catch (_) {}
  }, 10_000);
  console.log(
    '%c[Atelnyo Network Diagnostics] Active — window.__networkDiag + window.__networkDiagLog',
    'color: #8b5cf6; font-weight: bold; font-size: 12px;',
  );
}
