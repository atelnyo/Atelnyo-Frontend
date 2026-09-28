/**
 * src/pwa/storage/handleManager.js
 *
 * PERSISTENT HANDLE MANAGER — owns the File System Access HANDLE
 * lifecycle of the PWA Storage subsystem (user storage side):
 *
 *   • saveHandle(name, handle)     → persist a FileSystemHandle to the
 *                                    raw devrose-handles store (IndexedDB
 *                                    structured clone — handles are not
 *                                    JSON-serializable).
 *   • restoreHandle(name)          → read a persisted handle back.
 *   • removeHandle(name)           → drop a persisted handle.
 *   • revalidateHandle(handle)     → queryPermission({mode}): 'granted'
 *                                    | 'prompt' | 'denied' | 'unsupported'.
 *   • requestHandlePermission(h)   → requestPermission({mode}) — REQUIRES
 *                                    a user gesture; call only from a
 *                                    click handler ("re-approve").
 *   • listHandles()                → all persisted handle keys.
 *
 * THE KEY / THE FILES: the HANDLE is a key that unlocks the user's
 * chosen folder — it lives in the origin-scoped devrose-handles DB
 * (private side). The user's FILES live in the user-chosen folder
 * (user side). The two are never interleaved: this module persists
 * keys only, never file contents.
 *
 * Permission honesty: there is no scriptable ``revokePermission()`` in
 * the File System Access API. Dropping the handle (removeHandle) is
 * the strongest revocation the app can perform — the browser-side
 * grant persists until the user clears the site's storage permissions
 * (browser site settings). Consumers surface that honestly.
 */
import { handlesStore } from './storageBackends.js';
import { USER_ROOT_HANDLE_KEY, STORAGE_PERMISSIONS } from './storageTypes.js';

/** Access modes for File System Access handles. */
export const HANDLE_MODES = {
  READ: 'read',
  READWRITE: 'readwrite',
};

/** True when the value looks like a usable FileSystemHandle. */
export function isHandle(value) {
  return !!value
    && typeof value.queryPermission === 'function'
    && typeof value.kind === 'string';
}

/**
 * Persist a handle to the devrose-handles DB (raw structured clone).
 * Returns true on success; false when the value is not a handle or the
 * store is unavailable.
 */
export async function saveHandle(handle, name = USER_ROOT_HANDLE_KEY) {
  if (!isHandle(handle)) return false;
  try {
    await handlesStore.set(name, handle);
    return true;
  } catch (_) {
    return false;
  }
}

/** Read a persisted handle back (null on miss / failure). */
export async function restoreHandle(name = USER_ROOT_HANDLE_KEY) {
  try {
    const handle = await handlesStore.get(name);
    return isHandle(handle) ? handle : null;
  } catch (_) {
    return null;
  }
}

/** Drop a persisted handle (the app can no longer open the folder). */
export async function removeHandle(name = USER_ROOT_HANDLE_KEY) {
  try { await handlesStore.delete(name); } catch (_) {}
}

/**
 * Revalidate a handle's permission WITHOUT requesting:
 *   • 'granted'     — the app may access the folder.
 *   • 'prompt'      — a user gesture is needed to (re-)approve.
 *   • 'denied'      — the user revoked access; the handle is dead.
 *   • 'unsupported' — no permission API on this handle / browser.
 *
 * DEFAULT MODE IS READ — the MINIMUM access: we never ask for (or
 * verify) write access when the current function only needs to read.
 * Write (readwrite) is requested explicitly, on a user action that
 * actually needs it (e.g. Export project → requestWriteAccess).
 */
export async function revalidateHandle(handle, mode = HANDLE_MODES.READ) {
  if (!isHandle(handle) || typeof handle.queryPermission !== 'function') {
    return STORAGE_PERMISSIONS.UNSUPPORTED;
  }
  try {
    return await handle.queryPermission({ mode });
  } catch (_) {
    return STORAGE_PERMISSIONS.UNSUPPORTED;
  }
}

/**
 * Request a handle's permission — REQUIRES a user gesture (a click).
 * Call only from an explicit "re-approve" action, never at boot: an
 * unprompted permission ask is hostile UX and the browser may reject
 * it without activation anyway.
 *
 * DEFAULT MODE IS READ — the MINIMUM access. Read-only connection for
 * browse features ("User wants to browse documents → read permission");
 * write access is requested ONLY when the action needs it (Export
 * project → requestHandlePermission(handle, READWRITE) inside the
 * export click gesture).
 */
export async function requestHandlePermission(handle, mode = HANDLE_MODES.READ) {
  if (!isHandle(handle) || typeof handle.requestPermission !== 'function') {
    return STORAGE_PERMISSIONS.UNSUPPORTED;
  }
  try {
    return await handle.requestPermission({ mode });
  } catch (_) {
    return STORAGE_PERMISSIONS.UNSUPPORTED;
  }
}

/** All persisted handle keys (diagnostics / management). */
export async function listHandles() {
  try {
    return await handlesStore.keys();
  } catch (_) {
    return [];
  }
}

export default {
  isHandle,
  saveHandle,
  restoreHandle,
  removeHandle,
  revalidateHandle,
  requestHandlePermission,
  listHandles,
  HANDLE_MODES,
};
