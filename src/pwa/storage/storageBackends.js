/**
 * src/pwa/storage/storageBackends.js
 *
 * STORAGE BACKENDS — the raw persistence layer of the PWA Storage
 * subsystem. This is the code that used to live in
 * src/services/storageEngine.js, moved into the subsystem so the
 * Storage Manager can compose it (no duplicated logic). It is
 * deliberately kept BYTE-COMPATIBLE with the old implementation —
 * same database name, same object store, same encryption salt and
 * derivation, same localStorage prefix — so all previously persisted
 * data remains readable after the migration.
 *
 * Priority order (auto-detected, see BACKEND_PRIORITY in
 * storageTypes.js):
 *   1. IndexedDB (unlimited structured storage)
 *   2. OPFS — Origin Private File System (blob/file storage)
 *   3. localStorage (preferences only, ~5 MB limit)
 *   (File System Access is Phase B — wired by the Root Folder Manager.)
 *
 * Exports (identical shapes to the former storageEngine — retired
 * with the §6.3 consumer migration):
 *   • store.get(key)        — read, returns null on miss
 *   • store.set(key, value) — write any JSON-serializable value
 *   • store.delete(key)     — remove
 *   • store.keys()          — list all keys
 *   • store.clear()         — wipe all data
 *   • store.quota()         — { usage, quota } in bytes
 *   • files.put(name, blob) — store a file (OPFS or IDB fallback)
 *   • files.get(name)       — retrieve a file
 *   • files.delete(name)    — remove a file
 *   • files.list()          — list stored files
 *
 * NEVER stores passwords, tokens, or secrets. Those stay in
 * localStorage with httpOnly cookie fallback (see api.js).
 *
 * Encryption: values prefixed with ``enc:`` are auto-encrypted via
 * SubtleCrypto AES-GCM when available; plaintext otherwise. Key
 * derivation uses stable device properties (NOT screen dimensions,
 * which change on window resize / external monitor).
 */

// ─── Capability detection ──────────────────────────────────────────
const HAS_IDB = typeof indexedDB !== 'undefined';
const HAS_OPFS = typeof navigator?.storage?.getDirectory === 'function';
const HAS_CRYPTO = typeof crypto?.subtle?.encrypt === 'function';
const _CRYPTO_UNAVAILABLE = !HAS_CRYPTO;

const DB_NAME = 'devrose-storage';
const DB_VERSION = 1;
const STORE_NAME = 'kv-store';

// ─── Encryption key (lazy-generated, cached in memory) ─────────────
let _encKey = null;
let _encKeyFailed = _CRYPTO_UNAVAILABLE; // short-circuit if crypto unavailable

async function _getEncKey() {
  if (_encKey) return _encKey;
  if (_encKeyFailed) return null;
  try {
    // Derive a stable key from device properties that do NOT change
    // across sessions. Screen dimensions are intentionally EXCLUDED
    // because they change on window resize / external monitor connect,
    // which would make all previously encrypted data undecryptable.
    const enc = new TextEncoder();
    const fp = [
      navigator.hardwareConcurrency || 4,
      navigator.deviceMemory || 4,
      navigator.language || 'ht',
    ].join('|');
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(fp), 'PBKDF2', false, ['deriveKey']
    );
    _encKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: enc.encode('devrose-salt-v1'), iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    return _encKey;
  } catch (_) {
    _encKey = null;
    _encKeyFailed = true;
    return null;
  }
}

async function _encrypt(plaintext) {
  const key = await _getEncKey();
  if (!key) return plaintext; // no crypto, store plain
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  const combined = new Uint8Array(iv.length + ct.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ct), iv.length);
  return 'enc:' + btoa(String.fromCharCode(...combined));
}

async function _decrypt(stored) {
  if (!stored || !stored.startsWith('enc:')) return stored;
  const key = await _getEncKey();
  if (!key) return stored.slice(4); // can't decrypt, return raw
  try {
    const raw = Uint8Array.from(atob(stored.slice(4)), c => c.charCodeAt(0));
    const iv = raw.slice(0, 12);
    const ct = raw.slice(12);
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ct
    );
    return new TextDecoder().decode(pt);
  } catch (_) {
    return stored; // decryption failed, return as-is
  }
}

// ─── IndexedDB backend ─────────────────────────────────────────────
function _openDB() {
  return new Promise((resolve, reject) => {
    if (!HAS_IDB) return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function _idbGet(key) {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function _idbSet(key, value) {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function _idbDelete(key) {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function _idbKeys() {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function _idbClear() {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── localStorage fallback ─────────────────────────────────────────
const LS_PREFIX = 'atelnyo_kv_';

function _lsGet(key) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function _lsSet(key, value) {
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)); } catch (_) {}
}

function _lsDelete(key) {
  try { localStorage.removeItem(LS_PREFIX + key); } catch (_) {}
}

function _lsKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(LS_PREFIX)) keys.push(k.slice(LS_PREFIX.length));
  }
  return keys;
}

function _lsClear() {
  for (const k of _lsKeys()) {
    try { localStorage.removeItem(LS_PREFIX + k); } catch (_) {}
  }
}

// ─── Storage quota (navigator.storage.estimate) ────────────────────
async function _quota() {
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
    }
  } catch (_) {}
  return { usage: 0, quota: 0 };
}

// ─── OPFS file backend ─────────────────────────────────────────────
let _opfsRoot = null;

async function _getOPFS() {
  if (_opfsRoot) return _opfsRoot;
  if (!HAS_OPFS) throw new Error('OPFS unavailable');
  _opfsRoot = await navigator.storage.getDirectory();
  return _opfsRoot;
}

// ─── Public API (identical shapes to the former storageEngine) ─────

export const store = {
  async get(key) {
    try {
      const raw = await _idbGet(key);
      if (raw !== null) return await _decrypt(raw);
    } catch (_) {}
    // Fallback to localStorage
    return _lsGet(key);
  },

  async set(key, value) {
    const str = JSON.stringify(value);
    const toStore = await _encrypt(str);
    try {
      await _idbSet(key, toStore);
    } catch (_) {
      _lsSet(key, str);
    }
  },

  async delete(key) {
    try { await _idbDelete(key); } catch (_) {}
    _lsDelete(key);
  },

  async keys() {
    try { return await _idbKeys(); } catch (_) {}
    return _lsKeys();
  },

  async clear() {
    try { await _idbClear(); } catch (_) {}
    _lsClear();
  },

  quota: _quota,
};

// ─── Handle store (dedicated DB — raw structured clone) ───────────
// FileSystemHandle objects are NOT JSON-serializable (no toJSON) and
// must be persisted via IndexedDB's structured clone directly. They
// are capabilities, not data — a separate small DB keeps them isolated
// from the JSON/encrypted KV store and gives the USER-STORAGE principle
// its own home: the HANDLE lives here (a key), the user's FILES live
// in the user-chosen folder.
const HANDLES_DB_NAME = 'devrose-handles';
const HANDLES_DB_VERSION = 1;
const HANDLES_STORE_NAME = 'handles';

function _openHandlesDB() {
  return new Promise((resolve, reject) => {
    if (!HAS_IDB) return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(HANDLES_DB_NAME, HANDLES_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HANDLES_STORE_NAME)) {
        db.createObjectStore(HANDLES_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function _handlesGet(name) {
  const db = await _openHandlesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLES_STORE_NAME, 'readonly');
    const req = tx.objectStore(HANDLES_STORE_NAME).get(name);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function _handlesSet(name, handle) {
  const db = await _openHandlesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLES_STORE_NAME, 'readwrite');
    tx.objectStore(HANDLES_STORE_NAME).put(handle, name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function _handlesDelete(name) {
  const db = await _openHandlesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLES_STORE_NAME, 'readwrite');
    tx.objectStore(HANDLES_STORE_NAME).delete(name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function _handlesKeys() {
  const db = await _openHandlesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLES_STORE_NAME, 'readonly');
    const req = tx.objectStore(HANDLES_STORE_NAME).getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Raw handle store (devrose-handles DB). Values are FileSystemHandle
 * objects stored via IndexedDB structured clone — NO JSON, NO
 * encryption (handles cannot be serialized; they are origin-scoped
 * capabilities). IDB-only — there is no localStorage fallback because
 * a handle cannot be represented there.
 */
export const handlesStore = {
  get: _handlesGet,
  set: _handlesSet,
  delete: _handlesDelete,
  keys: _handlesKeys,
};

export const files = {
  async put(name, blob) {
    if (HAS_OPFS) {
      try {
        const root = await _getOPFS();
        const handle = await root.getFileHandle(name, { create: true });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (_) {}
    }
    // Fallback: IndexedDB for small blobs (more reliable than blob URLs)
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      await _idbSet('file_' + name, {
        data: base64,
        type: blob.type,
        size: blob.size,
        createdAt: Date.now(),
      });
    } catch (_) {}
  },

  async get(name) {
    if (HAS_OPFS) {
      try {
        const root = await _getOPFS();
        const handle = await root.getFileHandle(name);
        return await handle.getFile();
      } catch (_) {}
    }
    // Fallback: IndexedDB
    try {
      const meta = await _idbGet('file_' + name);
      if (meta?.data) {
        const res = await fetch(meta.data);
        return await res.blob();
      }
    } catch (_) {}
    return null;
  },

  async delete(name) {
    if (HAS_OPFS) {
      try {
        const root = await _getOPFS();
        await root.removeEntry(name);
      } catch (_) {}
    }
    try { await _idbDelete('file_' + name); } catch (_) {}
  },

  async list() {
    const names = [];
    if (HAS_OPFS) {
      try {
        const root = await _getOPFS();
        for await (const [n] of root.entries()) names.push(n);
      } catch (_) {}
    }
    try {
      const keys = await _idbKeys();
      for (const k of keys) {
        if (k.startsWith('file_')) names.push(k.slice(5));
      }
    } catch (_) {}
    return [...new Set(names)];
  },
};

export default { store, files };
