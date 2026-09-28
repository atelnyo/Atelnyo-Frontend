/**
 * src/pwa/storage/storageDetector.js
 *
 * STORAGE DETECTOR — the pure detection layer of the PWA Storage
 * subsystem. Every function here answers ONE factual question about
 * the environment (which backends exist, how much space is left, is
 * the origin's storage persisted). There is NO state, NO persistence,
 * NO prompts — the Storage Manager (StorageManager.js) composes these
 * answers into the storage state machine.
 *
 * All functions are environment-safe (guard on typeof window /
 * navigator / indexedDB) so they can run during SSR / pre-hydration.
 */
import { BACKEND_PRIORITY, FILE_BACKEND_PRIORITY, STORAGE_BACKENDS } from './storageTypes.js';

/**
 * FEATURE DETECTION — the STORAGE CAPABILITY MAP. Storage Manager
 * starts with “What does this environment support?” — and the answer
 * is NEVER one boolean. Every environment fact is detected
 * independently and grouped by concern, so the app can branch per
 * capability (e.g. a directory picker exists but handle.move does
 * not → the UI shows rename/move as unavailable, honestly).
 *
 * PURE + SYNCHRONOUS: every check is a typeof/prototype probe — no
 * prompts, no async, no I/O. It answers "what COULD work here";
 * whether it DOES work right now (permission, quota) is the job of
 * the health / permission modules, not this map.
 *
 * Shape:
 *   platform          — environment primitives every capability builds on.
 *   fileSystemAccess  — the File System Access family (Phase B user
 *                       storage): each picker detected SEPARATELY.
 *   storage           — private-storage backends + quota/persistence
 *                       APIs.
 */
export function detectCapabilities() {
  const hasWindow = typeof window !== 'undefined';
  const fsaFile = typeof FileSystemFileHandle !== 'undefined';
  const fsaDir = typeof FileSystemDirectoryHandle !== 'undefined';
  // Platform form-factor probes (UA-based — the pragmatic standard;
  // mirrors the established pattern in capabilityEngine.isMobile).
  // These are STATIC per session: a PWA does not change platform.
  const ua = hasWindow ? (navigator.userAgent || '') : '';
  const android = /Android/i.test(ua)
    || (hasWindow && navigator.userAgentData?.platform === 'Android');
  const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua)
    || (hasWindow && !!navigator.userAgentData?.mobile);
  const map = {
    // ── Platform primitives ───────────────────────────────────────
    platform: {
      // FSA + OPFS + persistent storage all REQUIRE a secure context.
      secureContext: hasWindow && window.isSecureContext === true,
      // createWritable() on OPFS/FSA handles builds on WritableStream.
      writableStreams: typeof WritableStream !== 'undefined',
      // MOBILE / ANDROID — a PWA NEVER has native file-system access.
      // The browser controls the sandbox + permissions (on Android,
      // the SAF system picker grants SCOPED, consent-gated access).
      // These flags let the storage layer branch honestly per platform
      // (e.g. directory picker may be absent on Android → root-folder
      // UX degrades; permissions are not always persisted between
      // sessions → boot revalidation is MANDATORY). Atelnyo never
      // asks for root filesystem or total access — it works with the
      // capabilities the browser gives. ⚠️ UA-only (iPadOS 13+ reports
      // a Macintosh UA, so `mobile` can be false on iPads) — storage
      // treats these as informational; capabilities (directoryPicker
      // …) are the branch points, never the platform flag alone.
      mobile,
      android,
    },
    // ── File System Access family (user storage — Phase B/C) ──────
    fileSystemAccess: {
      // Root-folder picker — the ANCHOR (chooseRoot/changeRoot).
      directoryPicker: hasWindow
        && typeof window.showDirectoryPicker === 'function',
      // Single-file pickers — openFile/pickFile (browserFileAdapter).
      openFilePicker: hasWindow
        && typeof window.showOpenFilePicker === 'function',
      saveFilePicker: hasWindow
        && typeof window.showSaveFilePicker === 'function',
      // handle.move() — rename/move file ops (Chrome 110+). NOT every
      // FSA browser allows every op; this is why capabilities() gates
      // rename/move per environment.
      handleMove: fsaFile && typeof FileSystemFileHandle.prototype.move === 'function',
      // Static proxy for handle persistence: handles are
      // structured-cloneable into IndexedDB only where the handle
      // globals exist (the IDB global implies the IDBRequest
      // infrastructure — no extra probe needed). Runtime store
      // failures are handled honestly by handleManager (saveHandle
      // never throws).
      handlePersistence: fsaDir && typeof indexedDB !== 'undefined',
    },
    // ── Private storage backends + quota/persistence APIs ─────────
    storage: {
      // IndexedDB — the primary KV backend (store.* chain).
      indexedDB: typeof indexedDB !== 'undefined',
      // OPFS — the primary FILE backend (files.* chain).
      opfs: typeof navigator?.storage?.getDirectory === 'function',
      // CacheStorage — HTTP cache for network resources (not a KV).
      cacheStorage: typeof caches !== 'undefined',
      // localStorage — tiny synchronous fallback (preferences only).
      localStorage: hasWindow && typeof window.localStorage !== 'undefined',
      // Quota APIs — each point detected SEPARATELY (granularity
      // principle): requestPersistence() needs `persist`; isPersisted()
      // needs `persisted`.
      storageEstimate: typeof navigator?.storage?.estimate === 'function',
      storagePersist: typeof navigator?.storage?.persist === 'function',
      storagePersisted: typeof navigator?.storage?.persisted === 'function',
    },
  };
  // The capability map is inherently STATIC for the session — deep-
  // freeze it so consumers can never mutate manager state through
  // getState().capabilities (the map is recreated on every call, so
  // freezing is allocation-free across sessions).
  Object.freeze(map.platform);
  Object.freeze(map.fileSystemAccess);
  Object.freeze(map.storage);
  return Object.freeze(map);
}

/**
 * Which storage backends exist in THIS browser? DERIVED from the
 * capability map — every rung of the fallback chain, from File
 * System Access (Phase B wiring) down to localStorage. One detection
 * source of truth: detectCapabilities() is the ONLY function that
 * probes the environment.
 */
export function detectBackends() {
  const c = detectCapabilities();
  return {
    // Any FSA picker (directory / open / save) counts as "FSA exists"
    // for the backend map — the granular breakdown lives in
    // capabilities.fileSystemAccess.
    fileSystemAccess: c.fileSystemAccess.directoryPicker
      || c.fileSystemAccess.openFilePicker
      || c.fileSystemAccess.saveFilePicker,
    opfs: c.storage.opfs,
    indexedDB: c.storage.indexedDB,
    cache: c.storage.cacheStorage,
    localStorage: c.storage.localStorage,
  };
}

/**
 * The PRIMARY KV backend for this browser — the first available entry
 * in BACKEND_PRIORITY (IndexedDB → localStorage). Matches the ACTUAL
 * write chain of store.* — OPFS is a FILE backend, never a KV writer.
 * Returns STORAGE_BACKENDS.NONE when nothing usable exists (the health
 * module reports BLOCKED then). CacheStorage is intentionally NOT a
 * KV candidate — it is an HTTP cache, not a key-value store.
 */
export function detectPrimaryBackend(backends) {
  for (const name of BACKEND_PRIORITY) {
    if (backends[name]) return name;
  }
  return STORAGE_BACKENDS.NONE;
}

/**
 * The PRIMARY FILE backend for this browser — the first available
 * entry in FILE_BACKEND_PRIORITY (OPFS → IndexedDB blob fallback).
 * Matches the ACTUAL write chain of files.*. Reported separately from
 * the KV backend — the two layers are never conflated.
 */
export function detectFileBackend(backends) {
  for (const name of FILE_BACKEND_PRIORITY) {
    if (backends[name]) return name;
  }
  return STORAGE_BACKENDS.NONE;
}

/** { usage, quota } in bytes via navigator.storage.estimate(). */
export async function getStorageEstimate() {
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
    }
  } catch (_) {}
  return { usage: 0, quota: 0 };
}

/** Is the origin's storage persisted (protected from eviction)? */
export async function isPersisted() {
  try {
    if (navigator.storage?.persisted) {
      return (await navigator.storage.persisted()) === true;
    }
  } catch (_) {}
  return false;
}

/**
 * Request persistent storage for the origin (may prompt the user).
 * Returns the new persisted state; false when unsupported or denied.
 * Delegated to the browser — the manager decides WHEN to call this
 * (e.g. from Settings, never automatically at boot).
 */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist) {
      return (await navigator.storage.persist()) === true;
    }
  } catch (_) {}
  return false;
}
