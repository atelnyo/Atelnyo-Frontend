/**
 * offlineQueue.js — Atelnyo offline request queue with Background Sync.
 *
 * Queues failed API requests when the browser is offline and retries
 * them automatically when connectivity returns. Uses the storage engine
 * (IndexedDB) so queued requests survive page reloads.
 *
 * Background Sync: registers a 'sync' event in the SW. When the browser
 * regains connectivity while the app is CLOSED, the SW fires the sync
 * event which triggers queue processing via postMessage to the client.
 *
 * Conflict resolution: last-write-wins by timestamp. Conflicting updates
 * (same URL + method) are deduped — only the most recent survives.
 *
 * ── SEPARATION OF RESPONSIBILITY (the offline-queue boundary) ─────
 * THIS module is the SYNC LAYER. It owns ALL synchronization policy:
 *   • enqueue order + conflict resolution (last-write-wins),
 *   • retry policy (MAX_RETRIES + RETRY_DELAY_MS),
 *   • network detection (background sync registration + reconnect),
 *   • replay order, dedup, and the event surface.
 * privateStorage (the STORAGE MANAGER) provides PERSISTENCE ONLY: the
 * durable `private:offline:queue` key (IndexedDB → localStorage
 * fallback), legacy read-compat ('offline_queue'), and domain
 * isolation. The Storage Manager knows NOTHING about network state,
 * retries, or axios — and this module never implements its own
 * storage. Persistence failures are NEVER silent (see 'persist-fail').
 *
 * API:
 *   • queue.enqueue(config)     — stash a failed axios request config
 *   • queue.process()           — drain all queued requests
 *   • queue.size                — number of queued items
 *   • queue.clear()             — discard all queued items
 *   • queue.on('persist-fail')  — a persistence WRITE failed (quota /
 *     storage blocked) — queued items may be LOST on reload. Additive
 *     event: "storage warns, never silently fails" (see §4n).
 *     `enqueue`/`drain` payloads carry `persisted` (true/false) so the
 *     UI never shows a "queued ✓" that contradicts the warning.
 *
 * NOTE: The axios instance is lazy-loaded to avoid circular imports.
 */

// Private App Storage domain API — the offline queue lives in the
// 'offline' domain (namespaced key `private:offline:queue`). Reads
// fall back to the legacy flat key ('offline_queue') so pre-migration
// queued items are never orphaned; writes go to the namespaced key.
import privateStorage from '../pwa/storage/privateStorage';

const QUEUE_DOMAIN = 'offline';
const QUEUE_KEY = 'queue';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

// ─── Lazy axios ref ────────────────────────────────────────────────
let _api = null;
async function _getApi() {
  if (!_api) { const mod = await import('./api'); _api = mod.default; }
  return _api;
}

// ─── Internal ──────────────────────────────────────────────────────
let _queue = [], _loaded = false, _processing = false;
// Event → listener map: a listener is invoked ONLY for the event it
// registered for (an event name FILTERS, it is not a label). This is
// what makes an additive event like 'persist-fail' structurally safe
// — it can never reach a listener that didn't ask for it.
const _listeners = new Map();
function _notify(e, d) {
  const set = _listeners.get(e);
  if (!set) return;
  set.forEach(fn => { try { fn(e, d); } catch (_) {} });
}
async function _load() { if (_loaded) return; try { const s = await privateStorage.get(QUEUE_DOMAIN, QUEUE_KEY); _queue = Array.isArray(s) ? s : []; } catch (_) { _queue = []; } _loaded = true; }

/**
 * Persist the in-memory queue through the Storage Manager's private
 * storage — the ONLY persistence the sync layer knows. Returns true
 * when the write succeeded. NEVER fails silently: a queued operation
 * that cannot be persisted is LOST on reload, so a failed write
 * surfaces through the 'persist-fail' event (additive) — the UI can
 * warn the user instead of pretending everything was saved.
 */
async function _save() {
  try {
    await privateStorage.set(QUEUE_DOMAIN, QUEUE_KEY, _queue);
    return true;
  } catch (_) {
    _notify('persist-fail', { size: _queue.length });
    return false;
  }
}

// ─── Background Sync registration ──────────────────────────────────
async function _registerBackgroundSync() {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.sync.register('offline-queue');
  } catch (_) { /* SW sync not available */ }
}

// ─── Public API ─────────────────────────────────────────────────────
const queue = {
  get size() { return _queue.length; },

  /**
   * Subscribe to ONE event name ('enqueue' | 'dequeue' | 'fail' |
   * 'drain' | 'persist-fail'). The listener is invoked ONLY for that
   * event — an event name filters, it is not a label (so an additive
   * event like 'persist-fail' never reaches a listener that didn't
   * ask for it). Returns an unsubscribe function.
   */
  on(event, fn) {
    if (!_listeners.has(event)) _listeners.set(event, new Set());
    _listeners.get(event).add(fn);
    return () => { _listeners.get(event)?.delete(fn); };
  },

  /** Enqueue with conflict resolution: same URL+method overwrites older entry. */
  async enqueue(config) {
    if (!config?.url) return;
    await _load();
    // Conflict resolution: last-write-wins — replace existing dup
    const idx = _queue.findIndex(q => q.url === config.url && q.method === config.method);
    const entry = { ...config, _retries: 0, _queuedAt: Date.now() };
    if (idx >= 0) { _queue[idx] = entry; }
    else { _queue.push(entry); }
    // `persisted` — false means a 'persist-fail' already fired: the
    // item IS in the in-memory queue (it works this session) but may
    // not survive a reload. The UI must never show a "queued ✓" toast
    // that contradicts the "changes may be lost" warning.
    const persisted = await _save();
    await _registerBackgroundSync();
    _notify('enqueue', { size: _queue.length, persisted });
  },

  async peek() { await _load(); return [..._queue]; },

  /** Process queue. Called on reconnect AND by background sync. */
  async process() {
    if (_processing) return;
    _processing = true;
    await _load();
    const batch = [..._queue]; _queue = []; await _save();
    let ok = 0, fail = 0;
    const api = await _getApi();
    for (const item of batch) {
      try {
        await api.request({ method: item.method || 'GET', url: item.url, data: item.data, headers: item.headers });
        ok++; _notify('dequeue', { url: item.url });
      } catch (err) {
        if (item._retries < MAX_RETRIES) { item._retries++; _queue.push(item); await new Promise(r => setTimeout(r, RETRY_DELAY_MS)); }
        else { fail++; _notify('fail', { url: item.url, error: err.message }); }
      }
    }
    // `persisted` (final save) — false means a 'persist-fail' fired:
    // the drain verdict is in-memory truth; the persisted copy may
    // still hold stale items after a reload.
    const persisted = await _save();
    if (_queue.length === 0) _notify('drain', { succeeded: ok, failed: fail, persisted });
    _processing = false;
  },

  async clear() {
    _queue = [];
    const persisted = await _save();
    _notify('drain', { succeeded: 0, failed: 0, persisted });
  },
};

export default queue;
