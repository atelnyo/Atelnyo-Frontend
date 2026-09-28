/**
 * src/pwa/storage/fileSystemAdapter.js
 *
 * FILE SYSTEM ADAPTER — the ONLY module that touches the browser File
 * System Access API (FileSystemDirectoryHandle / getFileHandle /
 * getDirectoryHandle / createWritable) on the USER-STORAGE side.
 *
 *   React components
 *        ↓  (never see a handle — only metadata + plain results)
 *   Storage Manager (storageManager.fs.*)
 *        ↓  (owns the boundary; imports the root handle internally)
 *   FILE SYSTEM ADAPTER  ← THIS MODULE
 *        ↓  (the only layer that calls browser file APIs)
 *   Browser File System Access API
 *
 * Why this layer exists — the architecture rule:
 *   • NO component may ever call handle.getFileHandle(...) itself.
 *     If React components started touching directory handles all over
 *     the app, the architecture would collapse instantly (handles leak,
 *     permissions get managed in 10 places, the fallback layer for
 *     Firefox/Safari becomes impossible).
 *   • Every file operation goes through Storage Manager → this adapter.
 *     The caller expresses WHAT it wants (a path in a fixed subfolder);
 *     this adapter resolves the handle, checks permission, performs the
 *     operation, and returns PLAIN DATA (string / Blob / entry list).
 *     Handles never cross this module's boundary.
 *
 * THE FIXED LAYOUT: operations are scoped to the USER_FOLDERS
 * subfolders under the user's ANCHOR (Root → Atelnyo/ → Media|Docs|…).
 * Names are validated against USER_FOLDERS — the app can only
 * read/write inside the layout it owns, never arbitrary paths.
 *
 * Honest degradation: every operation returns a structured result;
 * when there is no connected root or FSA is unsupported, operations
 * resolve to { ok: false, error: 'no-root' | 'unsupported' } instead
 * of throwing — the core app path never depends on FSA (principle 3).
 *
 * BROWSER = SOURCE OF TRUTH: Atelnyo never assumes it may create or
 * modify anything. Every operation (1) re-checks the browser grant at
 * the needed mode (_checkMode), (2) resolves the anchor read-first
 * (create only when write is genuinely available), and (3) maps
 * permission failures honestly — never masks them as I/O errors.
 */
import { getRootHandle, resolveUserSubfolder, resolveCategoryFolder } from './rootFolderManager.js';
import {
  USER_FOLDERS,
  ACCESS_MODES,
  FILE_OPS,
  categoriesFor,
  STORAGE_ERRORS,
  normalizeStorageError,
} from './storageTypes.js';
import { revalidateHandle } from './handleManager.js';

/** A single plain-data directory entry (no handles). */
function _entry(name, isDirectory) {
  return { name, isDirectory: isDirectory === true };
}

/** Validate a subfolder name against the fixed layout. */
function _isSubfolder(name) {
  return Object.values(USER_FOLDERS).includes(name);
}

/**
 * Resolve a subfolder under the user's ANCHOR, mapping the tagged
 * resolveUserSubfolder result to an operation error result.
 */
async function _resolveFolderResult(folder) {
  const res = await resolveUserSubfolder(folder);
  if (res.ok) return { ok: true, dir: res.dir };
  return { ok: false, error: res.error };
}

/** The honest "not available" result shared by every operation. */
function _unavailable(reason) {
  return { ok: false, error: reason || 'no-root' };
}

/**
 * MINIMUM-ACCESS gate: check the root's CURRENT permission at the
 * requested mode BEFORE operating (no silent browser errors, no
 * assumed grants). Read operations pass ACCESS_MODES.READ; write
 * operations pass ACCESS_MODES.READWRITE.
 *
 *   • granted   → proceed (browser grant is active at that mode).
 *   • prompt    → access needs a user gesture — return a clear result
 *                 the UI can turn into a "Re-apwouve" action.
 *   • otherwise → deny (revoked / unsupported / no root).
 */
async function _checkMode(root, mode) {
  const status = await revalidateHandle(root, mode);
  if (status === 'granted') return null; // OK — proceed
  if (status === 'prompt') {
    return { ok: false, error: 'permission-prompt' };
  }
  return { ok: false, error: 'permission-denied' };
}

/**
 * Map a browser file-API error to an honest result error code — via
 * normalizeStorageError (the canonical vocabulary in storageTypes).
 * The UI NEVER receives a raw DOMException name: permission failures
 * (NotAllowedError / SecurityError — grant revoked / never given) map
 * to 'permission-denied' and are NEVER masked as generic I/O errors;
 * NotFoundError maps to 'file-not-found' (the file was deleted or
 * moved); quota failures map to 'quota-exceeded'. Anything else keeps
 * the op-specific DETAIL code passed as `fallback` (e.g. 'read-failed')
 * — which normalizes to STORAGE_ERRORS.UNKNOWN, with the browser's
 * message preserved in the result's `message` field.
 */
function _mapError(err, fallback) {
  const category = normalizeStorageError(err, STORAGE_ERRORS.UNKNOWN);
  // A known category at the source beats the generic op fallback; the
  // op-specific detail code stays only for UNKNOWN-class failures.
  return category === STORAGE_ERRORS.UNKNOWN ? fallback : category;
}

/**
 * INTERNAL — current root handle (null when disconnected). The root
 * comes from rootFolderManager's internal export: this adapter is part
 * of the storage subsystem, so it may hold the key — but it never
 * returns it, never logs it, never persists it.
 */
function _currentRoot() {
  return getRootHandle();
}

/**
 * PUBLIC — read a file's text content from a fixed subfolder.
 * Returns { ok: true, text } or { ok: false, error }.
 */
export async function readText(folder, fileName) {
  const root = _currentRoot();
  if (!root) return _unavailable('no-root');
  const gate = await _checkMode(root, ACCESS_MODES.READ);
  if (gate) return gate;
  const dirRes = await _resolveFolderResult(folder);
  if (!dirRes.ok) return dirRes;
  const dir = dirRes.dir;
  try {
    const handle = await dir.getFileHandle(fileName);
    const file = await handle.getFile();
    return { ok: true, text: await file.text() };
  } catch (err) {
    return { ok: false, error: _mapError(err, 'read-failed'), message: err?.message || '' };
  }
}

/**
 * PUBLIC — read a file as a Blob from a fixed subfolder (binary media:
 * images, audio, exports). Returns { ok: true, blob } or { ok: false }.
 */
export async function readBlob(folder, fileName) {
  const root = _currentRoot();
  if (!root) return _unavailable('no-root');
  const gate = await _checkMode(root, ACCESS_MODES.READ);
  if (gate) return gate;
  const dirRes = await _resolveFolderResult(folder);
  if (!dirRes.ok) return dirRes;
  const dir = dirRes.dir;
  try {
    const handle = await dir.getFileHandle(fileName);
    return { ok: true, blob: await handle.getFile() };
  } catch (err) {
    return { ok: false, error: _mapError(err, 'read-failed'), message: err?.message || '' };
  }
}

/**
 * PUBLIC — write a file into a fixed subfolder (creates or replaces).
 * ``data`` is a string or Blob. Returns { ok: true } or { ok: false }.
 * Requires READWRITE access (write operations always do — granted
 * lazily via rootFolder.requestWriteAccess() on the exporting action).
 */
export async function writeFile(folder, fileName, data) {
  const root = _currentRoot();
  if (!root) return _unavailable('no-root');
  const gate = await _checkMode(root, ACCESS_MODES.READWRITE);
  if (gate) return gate;
  const dirRes = await _resolveFolderResult(folder);
  if (!dirRes.ok) return dirRes;
  const dir = dirRes.dir;
  try {
    const handle = await dir.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: _mapError(err, 'write-failed'), message: err?.message || '' };
  }
}

/**
 * PUBLIC — list a fixed subfolder's contents (one level deep).
 * Returns { ok: true, entries: [{ name, isDirectory }] }.
 */
export async function list(folder) {
  const root = _currentRoot();
  if (!root) return _unavailable('no-root');
  const gate = await _checkMode(root, ACCESS_MODES.READ);
  if (gate) return gate;
  const dirRes = await _resolveFolderResult(folder);
  if (!dirRes.ok) return dirRes;
  const dir = dirRes.dir;
  try {
    const entries = [];
    // for-await over the directory entries — handles stay inside.
    for await (const [name, handle] of dir.entries()) {
      entries.push(_entry(name, handle.kind === 'directory'));
    }
    return { ok: true, entries };
  } catch (err) {
    return { ok: false, error: _mapError(err, 'list-failed'), message: err?.message || '' };
  }
}

/**
 * PUBLIC — does a file exist in a fixed subfolder?
 * Returns { ok: true, exists } or { ok: false, error }.
 */
export async function exists(folder, fileName) {
  const root = _currentRoot();
  if (!root) return _unavailable('no-root');
  const gate = await _checkMode(root, ACCESS_MODES.READ);
  if (gate) return gate;
  const dirRes = await _resolveFolderResult(folder);
  if (!dirRes.ok) return dirRes;
  const dir = dirRes.dir;
  try {
    await dir.getFileHandle(fileName);
    return { ok: true, exists: true };
  } catch (err) {
    // getFileHandle throws NotFoundError when the file is absent — the
    // ONLY case that means "does not exist". Anything else (a
    // permission hiccup between the gate and the call, an I/O failure)
    // is surfaced honestly instead of being masked as a missing file.
    if (err?.name === 'NotFoundError') {
      return { ok: true, exists: false };
    }
    return { ok: false, error: _mapError(err, 'read-failed'), message: err?.message || '' };
  }
}

/**
 * PUBLIC — delete a file from a fixed subfolder.
 * Returns { ok: true, deleted } or { ok: false, error }. Requires
 * READWRITE access (deletion is a write operation).
 */
export async function remove(folder, fileName) {
  const root = _currentRoot();
  if (!root) return _unavailable('no-root');
  const gate = await _checkMode(root, ACCESS_MODES.READWRITE);
  if (gate) return gate;
  const dirRes = await _resolveFolderResult(folder);
  if (!dirRes.ok) return dirRes;
  const dir = dirRes.dir;
  try {
    await dir.removeEntry(fileName);
    return { ok: true, deleted: true };
  } catch (err) {
    return { ok: false, error: _mapError(err, 'delete-failed'), message: err?.message || '' };
  }
}

/**
 * PUBLIC — the FILE-OPERATIONS capability matrix for THIS browser +
 * connection. NOT every operation is available everywhere — the
 * adapter/fallback architecture decides and reports honestly:
 *
 *   'available'          — the op can run right now.
 *   'permission-required'— the op needs write access (grant via
 *                          requestRootWriteAccess) to run.
 *   'unavailable'        — the op is impossible in this environment
 *                          (no FSA root, or the API is missing — e.g.
 *                          handle.move for rename/move).
 *
 * The UI uses this to enable/disable buttons instead of trying an op
 * and catching a generic failure.
 */
export async function capabilities() {
  const root = _currentRoot();
  const unavailable = Object.fromEntries(
    Object.values(FILE_OPS).map((op) => [op, 'unavailable']),
  );
  if (!root) return unavailable;
  // Honest three-level matrix: granted → 'available' · prompt →
  // 'permission-required' (a re-approve can fix it) · denied / missing
  // API → 'unavailable' (a re-approve is futile).
  const read = await revalidateHandle(root, ACCESS_MODES.READ);
  const readLevel = read === 'granted'
    ? 'available'
    : (read === 'prompt' ? 'permission-required' : 'unavailable');
  if (read === 'denied') return unavailable; // fully refused — nothing runs
  const write = await revalidateHandle(root, ACCESS_MODES.READWRITE);
  const writeLevel = write === 'granted'
    ? 'available'
    : (write === 'prompt' ? 'permission-required' : 'unavailable');
  const hasMove = typeof root.move === 'function';
  // rename/move need write AND the handle.move API (Chrome 110+).
  const renameLevel = writeLevel === 'available'
    ? (hasMove ? 'available' : 'unavailable')
    : writeLevel;
  return {
    [FILE_OPS.CREATE]: writeLevel,
    [FILE_OPS.READ]: readLevel,
    [FILE_OPS.WRITE]: writeLevel,
    [FILE_OPS.RENAME]: renameLevel,
    [FILE_OPS.MOVE]: renameLevel,
    [FILE_OPS.DELETE]: writeLevel,
    [FILE_OPS.LIST]: readLevel,
    [FILE_OPS.SEARCH]: readLevel,
  };
}

/**
 * PUBLIC — create a directory inside a fixed subfolder.
 * READWRITE mode. Returns { ok: true } or { ok: false, error }.
 */
export async function createDir(folder, dirName) {
  const root = _currentRoot();
  if (!root) return _unavailable('no-root');
  const gate = await _checkMode(root, ACCESS_MODES.READWRITE);
  if (gate) return gate;
  const dirRes = await _resolveFolderResult(folder);
  if (!dirRes.ok) return dirRes;
  try {
    await dirRes.dir.getDirectoryHandle(dirName, { create: true });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: _mapError(err, 'create-failed'), message: err?.message || '' };
  }
}

/**
 * PUBLIC — rename a file inside a fixed subfolder (FileSystemHandle.move).
 * READWRITE mode. Returns { ok: true } or { ok: false, error } —
 * 'unsupported' when the browser lacks handle.move (rename/move are
 * NOT available in every browser — the capability matrix says so).
 */
export async function rename(folder, oldName, newName) {
  const root = _currentRoot();
  if (!root) return _unavailable('no-root');
  const gate = await _checkMode(root, ACCESS_MODES.READWRITE);
  if (gate) return gate;
  const dirRes = await _resolveFolderResult(folder);
  if (!dirRes.ok) return dirRes;
  try {
    const handle = await dirRes.dir.getFileHandle(oldName);
    if (typeof handle.move !== 'function') {
      return { ok: false, error: 'unsupported' };
    }
    await handle.move(dirRes.dir, newName);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: _mapError(err, 'rename-failed'), message: err?.message || '' };
  }
}

/**
 * PUBLIC — move a file between fixed subfolders (FileSystemHandle.move).
 * READWRITE mode. Returns { ok: true } or { ok: false, error } —
 * 'unsupported' when the browser lacks handle.move.
 */
export async function move(folder, fileName, targetFolder) {
  const root = _currentRoot();
  if (!root) return _unavailable('no-root');
  const gate = await _checkMode(root, ACCESS_MODES.READWRITE);
  if (gate) return gate;
  const fromRes = await _resolveFolderResult(folder);
  if (!fromRes.ok) return fromRes;
  const toRes = await _resolveFolderResult(targetFolder);
  if (!toRes.ok) return toRes;
  try {
    const handle = await fromRes.dir.getFileHandle(fileName);
    if (typeof handle.move !== 'function') {
      return { ok: false, error: 'unsupported' };
    }
    await handle.move(toRes.dir);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: _mapError(err, 'move-failed'), message: err?.message || '' };
  }
}

/**
 * PUBLIC — search files by name across the fixed layout (one level
 * deep, case-insensitive substring). READ mode. Returns
 * { ok: true, results: [{ name, folder, isDirectory }] } — PLAIN DATA,
 * no handles.
 */
export async function search(query, options = {}) {
  const q = String(query || '').toLowerCase().trim();
  const root = _currentRoot();
  if (!root) return _unavailable('no-root');
  const gate = await _checkMode(root, ACCESS_MODES.READ);
  if (gate) return gate;
  const folders = options.folder
    ? [options.folder]
    : Object.values(USER_FOLDERS);
  const results = [];
  for (const folder of folders) {
    if (!_isSubfolder(folder)) continue;
    // Level 1 — files directly in the fixed folder.
    const dirRes = await _resolveFolderResult(folder);
    if (dirRes.ok) {
      try {
        for await (const [name, handle] of dirRes.dir.entries()) {
          if (!q || name.toLowerCase().includes(q)) {
            results.push({ name, folder, isDirectory: handle.kind === 'directory' });
          }
        }
      } catch (_) { /* skip an unreadable folder — search degrades */ }
    }
    // Level 2 — category folders (Media/Images/…, Documents/PDFs/…):
    // most real files live here, so a top-level-only scan would miss
    // them. The result's folder field carries the plain path
    // (e.g. 'Media/Images').
    const cats = categoriesFor(folder);
    if (cats) {
      for (const cat of Object.values(cats)) {
        const catRes = await resolveCategoryFolder(folder, cat);
        if (!catRes.ok) continue;
        try {
          for await (const [name, handle] of catRes.dir.entries()) {
            if (!q || name.toLowerCase().includes(q)) {
              results.push({
                name,
                folder: `${folder}/${cat}`,
                isDirectory: handle.kind === 'directory',
              });
            }
          }
        } catch (_) { /* skip an unreadable category */ }
      }
    }
  }
  return { ok: true, results };
}

/** The fixed subfolder layout (plain names — no handles). */
export function layout() {
  return Object.values(USER_FOLDERS);
}

/** True when a folder name is part of the fixed layout. */
export function isSubfolder(name) {
  return _isSubfolder(name);
}

/**
 * The category set a folder carries (plain names — no handles):
 *   categoriesFor(USER_FOLDERS.MEDIA)     → ['Images','Videos','Audio','Other']
 *   categoriesFor(USER_FOLDERS.DOCUMENTS) → ['PDFs','Text','Projects','Other']
 *   categoriesFor(USER_FOLDERS.DOWNLOADS) → null
 */
export function categoriesForFolder(folder) {
  const cats = categoriesFor(folder);
  return cats ? Object.values(cats) : null;
}

/**
 * Resolve a category folder (Atelnyo/<folder>/<Category>/) with the
 * same tagged contract as the folder resolution.
 */
async function _resolveCategoryResult(folder, category) {
  const res = await resolveCategoryFolder(folder, category);
  if (res.ok) return { ok: true, dir: res.dir };
  return { ok: false, error: res.error };
}

/**
 * PUBLIC — list a category folder's contents (Atelnyo/<folder>/<Cat>/).
 * Works for Media/ and Documents/ (see categoriesFor).
 * Returns { ok: true, entries } or { ok: false, error }. READ mode.
 */
export async function categoryList(folder, category) {
  const root = _currentRoot();
  if (!root) return _unavailable('no-root');
  const gate = await _checkMode(root, ACCESS_MODES.READ);
  if (gate) return gate;
  const catRes = await _resolveCategoryResult(folder, category);
  if (!catRes.ok) return catRes;
  try {
    const entries = [];
    for await (const [name, handle] of catRes.dir.entries()) {
      entries.push(_entry(name, handle.kind === 'directory'));
    }
    return { ok: true, entries };
  } catch (err) {
    return { ok: false, error: _mapError(err, 'list-failed'), message: err?.message || '' };
  }
}

/**
 * PUBLIC — read a file as a Blob from a category folder
 * (Atelnyo/<folder>/<Cat>/file). READ mode.
 * Returns { ok: true, blob } or { ok: false, error }.
 */
export async function categoryRead(folder, category, fileName) {
  const root = _currentRoot();
  if (!root) return _unavailable('no-root');
  const gate = await _checkMode(root, ACCESS_MODES.READ);
  if (gate) return gate;
  const catRes = await _resolveCategoryResult(folder, category);
  if (!catRes.ok) return catRes;
  try {
    const handle = await catRes.dir.getFileHandle(fileName);
    return { ok: true, blob: await handle.getFile() };
  } catch (err) {
    return { ok: false, error: _mapError(err, 'read-failed'), message: err?.message || '' };
  }
}

/**
 * PUBLIC — write a file into a category folder
 * (Atelnyo/<folder>/<Cat>/file). READWRITE mode.
 * Returns { ok: true } or { ok: false, error }.
 */
export async function categoryWrite(folder, category, fileName, data) {
  const root = _currentRoot();
  if (!root) return _unavailable('no-root');
  const gate = await _checkMode(root, ACCESS_MODES.READWRITE);
  if (gate) return gate;
  const catRes = await _resolveCategoryResult(folder, category);
  if (!catRes.ok) return catRes;
  try {
    const handle = await catRes.dir.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: _mapError(err, 'write-failed'), message: err?.message || '' };
  }
}

/**
 * PUBLIC — delete a file from a category folder. READWRITE mode.
 * Returns { ok: true, deleted } or { ok: false, error }.
 */
export async function categoryRemove(folder, category, fileName) {
  const root = _currentRoot();
  if (!root) return _unavailable('no-root');
  const gate = await _checkMode(root, ACCESS_MODES.READWRITE);
  if (gate) return gate;
  const catRes = await _resolveCategoryResult(folder, category);
  if (!catRes.ok) return catRes;
  try {
    await catRes.dir.removeEntry(fileName);
    return { ok: true, deleted: true };
  } catch (err) {
    return { ok: false, error: _mapError(err, 'delete-failed'), message: err?.message || '' };
  }
}

export default {
  readText,
  readBlob,
  writeFile,
  list,
  exists,
  remove,
  createDir,
  rename,
  move,
  search,
  capabilities,
  categoryList,
  categoryRead,
  categoryWrite,
  categoryRemove,
  categoriesForFolder,
  layout,
  isSubfolder,
};
