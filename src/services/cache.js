/**
 * src/services/cache.js
 *
 * Multi-level caching service for Atelnyo.
 *
 * Architecture:
 *   L1 (In-Memory Map)  — fastest, per-session, lost on page reload
 *   L2 (localStorage)   — persists across reloads, ~5MB limit
 *   L3 (IndexedDB)      — persists across reloads, unlimited size
 *
 * Usage:
 *   import { cache } from './cache';
 *
 *   // Set with TTL (milliseconds)
 *   await cache.set('user:123', userData, { ttl: 300_000 }); // 5 min
 *
 *   // Get (tries L1 → L2 → L3)
 *   const data = await cache.get('user:123');
 *
 *   // Invalidate by prefix
 *   await cache.invalidate('user:');
 *
 *   // Clear all levels
 *   await cache.clear();
 *
 * Design:
 *   - Writes go to ALL levels (write-through)
 *   - Reads try L1 first, then L2, then L3 (read-through)
 *   - L1 is populated on L2/L3 hits (speeds up subsequent reads)
 *   - TTL is checked at read time (lazy expiration)
 *   - L1 is cleared on logout; L2/L3 are cleared separately
 *   - Cache keys are namespaced to avoid collisions
 */

// ─── Configuration ──────────────────────────────────────────────────

const CACHE_PREFIX = 'atelnyo_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const L1_MAX_ENTRIES = 500; // In-memory limit
const L2_MAX_SIZE = 4 * 1024 * 1024; // 4MB (localStorage safety)
const L3_DB_NAME = 'atelnyo_cache';
const L3_STORE_NAME = 'kv_store';
const L3_DB_VERSION = 1;

// ─── L1: In-Memory Map ─────────────────────────────────────────────

const _l1 = new Map(); // key → { data, expiresAt }
let _l1AccessOrder = []; // LRU tracking

function _l1Get(key) {
  const entry = _l1.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _l1Delete(key);
    return null;
  }
  // Move to end of access order (most recently used)
  _l1AccessOrder = _l1AccessOrder.filter(k => k !== key);
  _l1AccessOrder.push(key);
  return entry.data;
}

function _l1Set(key, data, ttl) {
  // Evict LRU entries if at capacity
  while (_l1.size >= L1_MAX_ENTRIES && _l1AccessOrder.length > 0) {
    const lruKey = _l1AccessOrder.shift();
    _l1.delete(lruKey);
  }
  _l1.set(key, { data, expiresAt: Date.now() + ttl });
  _l1AccessOrder.push(key);
}

function _l1Delete(key) {
  _l1.delete(key);
  _l1AccessOrder = _l1AccessOrder.filter(k => k !== key);
}

function _l1Clear() {
  _l1.clear();
  _l1AccessOrder = [];
}

// ─── L2: localStorage ──────────────────────────────────────────────

function _l2Get(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function _l2Set(key, data, ttl) {
  try {
    const entry = JSON.stringify({ data, expiresAt: Date.now() + ttl });
    // Check size before writing
    if (entry.length > L2_MAX_SIZE) {
      console.warn(`Cache L2: entry too large (${entry.length} bytes), skipping`);
      return;
    }
    localStorage.setItem(CACHE_PREFIX + key, entry);
  } catch (e) {
    // localStorage full or unavailable — try to free space
    if (e.name === 'QuotaExceededError') {
      _l2EvictOldest();
      try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, expiresAt: Date.now() + ttl }));
      } catch {
        // Still full — skip silently
      }
    }
  }
}

function _l2Delete(key) {
  try {
    localStorage.removeItem(CACHE_PREFIX + key);
  } catch {
    // ignore
  }
}

function _l2Clear() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

function _l2EvictOldest() {
  // Remove 20% of entries to make space
  const entries = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(CACHE_PREFIX)) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          entries.push({ key: k, expiresAt: parsed.expiresAt || 0 });
        }
      } catch {
        entries.push({ key: k, expiresAt: 0 });
      }
    }
  }
  // Sort by expiry (oldest first)
  entries.sort((a, b) => a.expiresAt - b.expiresAt);
  // Remove oldest 20%
  const toRemove = Math.ceil(entries.length * 0.2);
  for (let i = 0; i < toRemove; i++) {
    localStorage.removeItem(entries[i].key);
  }
}

// ─── L3: IndexedDB ─────────────────────────────────────────────────

let _l3Db = null;
let _l3Initializing = null;

function _l3Init() {
  if (_l3Db) return Promise.resolve(_l3Db);
  if (_l3Initializing) return _l3Initializing;

  _l3Initializing = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const request = indexedDB.open(L3_DB_NAME, L3_DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(L3_STORE_NAME)) {
        db.createObjectStore(L3_STORE_NAME);
      }
    };
    request.onsuccess = (event) => {
      _l3Db = event.target.result;
      resolve(_l3Db);
    };
    request.onerror = () => {
      resolve(null); // degrade gracefully
    };
  });
  return _l3Initializing;
}

async function _l3Get(key) {
  try {
    const db = await _l3Init();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(L3_STORE_NAME, 'readonly');
      const store = tx.objectStore(L3_STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => {
        const entry = request.result;
        if (!entry) return resolve(null);
        if (Date.now() > entry.expiresAt) {
          // Lazy delete
          _l3Delete(key);
          return resolve(null);
        }
        resolve(entry.data);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function _l3Set(key, data, ttl) {
  try {
    const db = await _l3Init();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(L3_STORE_NAME, 'readwrite');
      const store = tx.objectStore(L3_STORE_NAME);
      store.put({ data, expiresAt: Date.now() + ttl }, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

async function _l3Delete(key) {
  try {
    const db = await _l3Init();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(L3_STORE_NAME, 'readwrite');
      const store = tx.objectStore(L3_STORE_NAME);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

async function _l3Clear() {
  try {
    const db = await _l3Init();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(L3_STORE_NAME, 'readwrite');
      const store = tx.objectStore(L3_STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

// ─── Public API ─────────────────────────────────────────────────────

export const cache = {
  /**
   * Get a cached value (tries L1 → L2 → L3).
   * Populates lower levels on hit (read-through).
   *
   * @param {string} key
   * @returns {Promise<any|null>}
   */
  async get(key) {
    // L1
    const l1 = _l1Get(key);
    if (l1 !== null) return l1;

    // L2
    const l2 = _l2Get(key);
    if (l2 !== null) {
      // Populate L1 for next read
      _l1Set(key, l2, DEFAULT_TTL);
      return l2;
    }

    // L3
    const l3 = await _l3Get(key);
    if (l3 !== null) {
      // Populate L1 + L2 for next read
      _l1Set(key, l3, DEFAULT_TTL);
      _l2Set(key, l3, DEFAULT_TTL);
      return l3;
    }

    return null;
  },

  /**
   * Set a value in ALL levels (write-through).
   *
   * @param {string} key
   * @param {any} data
   * @param {object} [opts]
   * @param {number} [opts.ttl=DEFAULT_TTL] — time-to-live in ms
   * @param {boolean} [opts.l3=false] — also write to IndexedDB (for large data)
   */
  async set(key, data, { ttl = DEFAULT_TTL, l3 = false } = {}) {
    _l1Set(key, data, ttl);
    _l2Set(key, data, ttl);
    if (l3) {
      await _l3Set(key, data, ttl);
    }
  },

  /**
   * Invalidate (delete) a key from ALL levels.
   *
   * @param {string} key
   */
  async delete(key) {
    _l1Delete(key);
    _l2Delete(key);
    await _l3Delete(key);
  },

  /**
   * Invalidate all keys matching a prefix.
   *
   * @param {string} prefix
   */
  async invalidate(prefix) {
    // L1
    for (const key of _l1.keys()) {
      if (key.startsWith(prefix)) _l1Delete(key);
    }
    // L2
    const l2Keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX + prefix)) {
        l2Keys.push(k);
      }
    }
    l2Keys.forEach(k => localStorage.removeItem(k));
    // L3 — iterate all keys (IndexedDB doesn't support prefix delete)
    try {
      const db = await _l3Init();
      if (!db) return;
      const tx = db.transaction(L3_STORE_NAME, 'readwrite');
      const store = tx.objectStore(L3_STORE_NAME);
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (cursor.key.startsWith(prefix)) {
            cursor.delete();
          }
          cursor.continue();
        }
      };
    } catch {
      // ignore
    }
  },

  /**
   * Clear ALL cache levels.
   */
  async clear() {
    _l1Clear();
    _l2Clear();
    await _l3Clear();
  },

  /**
   * Clear only L1 (in-memory) — called on logout.
   */
  clearSession() {
    _l1Clear();
  },

  /**
   * Get cache stats for debugging.
   */
  async stats() {
    let l2Count = 0;
    let l2Size = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) {
        l2Count++;
        l2Size += localStorage.getItem(k)?.length || 0;
      }
    }
    let l3Count = 0;
    try {
      const db = await _l3Init();
      if (db) {
        l3Count = await new Promise((resolve) => {
          const tx = db.transaction(L3_STORE_NAME, 'readonly');
          const store = tx.objectStore(L3_STORE_NAME);
          const request = store.count();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(0);
        });
      }
    } catch {
      // ignore
    }
    return {
      l1: { entries: _l1.size, maxEntries: L1_MAX_ENTRIES },
      l2: { entries: l2Count, sizeBytes: l2Size, maxSizeBytes: L2_MAX_SIZE },
      l3: { entries: l3Count },
    };
  },
};

export default cache;
