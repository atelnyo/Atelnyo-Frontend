/**
 * src/pwa/storage/fileOperations.js
 *
 * FILE OPERATIONS — the PUBLIC, sanctioned layer (Faz B.2 modil
 * piblik) that the UI uses to BROWSE / LIST / EDIT user files. It is
 * exposed as ``storageManager.fs.*`` — the ONE surface a React
 * component talks to. It NEVER touches a FileSystemDirectoryHandle:
 * every operation delegates to the File System Adapter (the only
 * module that calls browser File System Access APIs) and returns
 * PLAIN DATA (strings / Blobs / entry lists) with honest tagged
 * results.
 *
 *   React components
 *        ↓  (storageManager.fs.* — THIS MODULE)
 *   FILE OPERATIONS (browse / read / write / edit)
 *        ↓  (delegates; owns the UI-facing contracts)
 *   File System Adapter (fileSystemAdapter.js — the ONLY FSA toucher)
 *        ↓
 *   Browser File System Access API
 *
 * Why this layer exists — the architecture rule:
 *   • The adapter is a LOW-LEVEL module (path-in → plain-data-out).
 *     A UI component calling ``readText('Media', name)`` directly
 *     would couple React to the raw layer and scatter the file-ops
 *     vocabulary across every screen.
 *   • THIS module adds the UI-grade contracts on top, with NO new
 *     browser API calls:
 *       - ``browse()``       — the whole fixed layout (Atelnyo/
 *                              folders + categories + entries) in one
 *                              call — the "browse the user's folder"
 *                              surface.
 *       - ``read/write/remove/exists(ref)`` — a plain FILE REF
 *                              ({ folder, category?, name }) instead of
 *                              positional args; category-aware (a ref
 *                              to Media/Images/photo.jpg resolves the
 *                              category folder for you).
 *       - ``capabilities()`` — the per-op matrix (enable/disable
 *                              buttons), passthrough of the adapter.
 *       - ``requestWriteAccess()`` — in-gesture write escalation, the
 *                              same operation as
 *                              storageManager.requestRootWriteAccess()
 *                              (MINIMUM-ACCESS: browse connects
 *                              read-only; write is granted lazily).
 *       - ``revalidate()``   — query-only permission refresh (never a
 *                              prompt) so an edit flow can recover
 *                              after a failure.
 *   • Honest degradation is inherited from the adapter: no root →
 *     { ok: false, error: 'no-root' }; FSA unsupported →
 *     'unsupported'; a write needing a gesture → 'permission-prompt'
 *     (the UI offers "Bay aksè ekri", it is NOT a failure).
 *
 * BROWSER = SOURCE OF TRUTH: this module never assumes permission. It
 * reports exactly what the browser grants (via the adapter's gate) and
 * never prompts on its own — requestWriteAccess() is exposed for the
 * UI to call INSIDE a user gesture only.
 */
import fileSystemAdapter from './fileSystemAdapter.js';
import rootFolderManager from './rootFolderManager.js';
import {
  USER_FOLDERS,
  FILE_OPS,
  STORAGE_ERRORS,
  categoriesFor,
} from './storageTypes.js';

/**
 * A FILE REF is plain data — never a handle:
 *   { folder: 'Media', category?: 'Images', name: 'photo.jpg' }
 * `category` is optional and only valid for folders that carry
 * categories (Media/ Documents/ — see categoriesFor).
 *
 * Validates a ref and returns { ok: true, folder, category, name } or
 * { error: 'invalid-operation' } — the caller passed something the
 * fixed layout cannot address (unknown folder / category / empty name).
 */
function _refOf(ref) {
  if (!ref || typeof ref !== 'object') {return { error: STORAGE_ERRORS.INVALID_OPERATION };}
  const { folder, name } = ref;
  const category = ref.category || null;
  if (!Object.values(USER_FOLDERS).includes(folder)) {
    return { error: STORAGE_ERRORS.INVALID_OPERATION };
  }
  if (typeof name !== 'string' || !name.trim()) {
    return { error: STORAGE_ERRORS.INVALID_OPERATION };
  }
  if (category !== null) {
    const cats = categoriesFor(folder);
    if (!cats || !Object.values(cats).includes(category)) {
      return { error: STORAGE_ERRORS.INVALID_OPERATION };
    }
  }
  return { ok: true, folder, category, name: name.trim() };
}

/**
 * PUBLIC — BROWSE the user's fixed layout in ONE call (the UI
 * "browse your folder" surface). Returns plain data only — entries are
 * { name, isDirectory }, never handles.
 *
 *   storageManager.fs.browse()
 *     → { ok: true, folders: [ {
 *         folder: 'Media',
 *         entries: [ { name, isDirectory } ],          // direct files
 *         categories: ['Images','Videos','Audio','Other'],
 *         categoryEntries: { Images: [ { name, isDirectory } ] },
 *       }, … ] }
 *
 * Options:
 *   { folder: 'Media' }      — restrict to ONE fixed folder.
 *   { categories: false }    — skip category folders (faster, shallow).
 *
 * Honest degradation: no connected root / FSA unsupported → the WHOLE
 * browse fails ({ ok: false, error: 'no-root' | 'unsupported' }) — an
 * empty tree would look like "browsed, nothing there" when in fact
 * nothing can be browsed. A folder that can't list (permission
 * hiccup) degrades to an empty node with its error surfaced on the
 * node itself.
 */
export async function browse(options = {}) {
  const only = options && options.folder;
  // Validate the requested folder up front: a garbage folder name must
  // not come back as a "successful" browse with one broken node — the
  // fixed layout simply cannot address it (same contract as _refOf).
  if (only !== undefined && only !== null && !Object.values(USER_FOLDERS).includes(only)) {
    return { ok: false, error: STORAGE_ERRORS.INVALID_OPERATION };
  }
  const folders = only
    ? [only]
    : Object.values(USER_FOLDERS);
  const includeCategories = !options || options.categories !== false;
  const out = { ok: true, folders: [] };
  for (const folder of folders) {
    const node = {
      folder,
      entries: [],
      categories: (() => {
        const cats = categoriesFor(folder);
        return cats ? Object.values(cats) : [];
      })(),
      categoryEntries: {},
      // Surfaces a per-folder problem (e.g. 'permission-prompt' — the
      // node rendered, but this folder could not be listed). null when
      // the folder listed fine.
      error: null,
    };
    const listRes = await fileSystemAdapter.list(folder);
    if (listRes.ok) {
      node.entries = listRes.entries;
    } else if (listRes.error === 'no-root' || listRes.error === 'unsupported') {
      // Whole-surface failure — fail the browse honestly instead of
      // returning a tree that pretends to be browsable.
      return { ok: false, error: listRes.error };
    } else {
      // Per-folder degradation: keep browsing the rest, flag the node.
      node.error = listRes.error;
    }
    if (includeCategories) {
      for (const cat of node.categories) {
        const catRes = await fileSystemAdapter.categoryList(folder, cat);
        if (catRes.ok) {node.categoryEntries[cat] = catRes.entries;}
      }
    }
    out.folders.push(node);
  }
  return out;
}

/**
 * PUBLIC — READ a file addressed by a plain FILE REF (category-aware).
 * Options: { as: 'text' } (default) | { as: 'blob' }.
 * Returns { ok: true, text } | { ok: true, blob } | { ok: false, error }.
 */
export async function read(ref, options = {}) {
  const r = _refOf(ref);
  if (!r.ok) {return { ok: false, error: r.error };}
  const asBlob = options && options.as === 'blob';
  if (r.category) {
    const res = await fileSystemAdapter.categoryRead(r.folder, r.category, r.name);
    if (!res.ok) {return res;}
    if (asBlob) {return { ok: true, blob: res.blob };}
    return { ok: true, text: await res.blob.text() };
  }
  return asBlob
    ? fileSystemAdapter.readBlob(r.folder, r.name)
    : fileSystemAdapter.readText(r.folder, r.name);
}

/**
 * PUBLIC — WRITE a file addressed by a plain FILE REF (creates or
 * replaces; category-aware). ``data`` is a string or Blob. Returns
 * { ok: true } or { ok: false, error } — a write on a read-only root
 * returns 'permission-prompt' (offer "Bay aksè ekri", which calls
 * requestWriteAccess() inside the user gesture) or
 * 'permission-denied'.
 */
export async function write(ref, data) {
  const r = _refOf(ref);
  if (!r.ok) {return { ok: false, error: r.error };}
  return r.category
    ? fileSystemAdapter.categoryWrite(r.folder, r.category, r.name, data)
    : fileSystemAdapter.writeFile(r.folder, r.name, data);
}

/**
 * PUBLIC — DELETE a file addressed by a plain FILE REF (category-aware).
 * READWRITE mode (deletion is a write operation). Returns
 * { ok: true, deleted } or { ok: false, error }.
 */
export async function remove(ref) {
  const r = _refOf(ref);
  if (!r.ok) {return { ok: false, error: r.error };}
  return r.category
    ? fileSystemAdapter.categoryRemove(r.folder, r.category, r.name)
    : fileSystemAdapter.remove(r.folder, r.name);
}

/**
 * PUBLIC — does a file addressed by a plain FILE REF exist?
 * Category-aware. Returns { ok: true, exists } or { ok: false, error }.
 */
export async function exists(ref) {
  const r = _refOf(ref);
  if (!r.ok) {return { ok: false, error: r.error };}
  if (r.category) {
    // The adapter has no categoryExists; a category LIST + name filter
    // is plain data and reads exactly what exists() means.
    const res = await fileSystemAdapter.categoryList(r.folder, r.category);
    if (!res.ok) {return res;}
    return { ok: true, exists: res.entries.some((e) => e.name === r.name) };
  }
  return fileSystemAdapter.exists(r.folder, r.name);
}

/** PUBLIC — list a fixed subfolder (one level deep). Passthrough. */
export function list(folder) {
  return fileSystemAdapter.list(folder);
}

/** PUBLIC — create a directory inside a fixed subfolder. Passthrough. */
export function createDir(folder, dirName) {
  return fileSystemAdapter.createDir(folder, dirName);
}

/**
 * PUBLIC — rename a file inside a fixed subfolder (FileSystemHandle.move).
 * Passthrough; 'unsupported' when the browser lacks handle.move.
 */
export function rename(folder, oldName, newName) {
  return fileSystemAdapter.rename(folder, oldName, newName);
}

/** PUBLIC — move a file between fixed subfolders. Passthrough. */
export function move(folder, fileName, targetFolder) {
  return fileSystemAdapter.move(folder, fileName, targetFolder);
}

/** PUBLIC — search files by name across the fixed layout. Passthrough. */
export function search(query, options) {
  return fileSystemAdapter.search(query, options);
}

/**
 * PUBLIC — the per-operation capability matrix for THIS browser +
 * connection ('available' | 'permission-required' | 'unavailable' per
 * FILE_OPS op). The UI enables/disables buttons from this instead of
 * trying an operation and catching a generic failure. Passthrough.
 */
export function capabilities() {
  return fileSystemAdapter.capabilities();
}

/**
 * PUBLIC — UPGRADE the root folder to write access (read → readwrite),
 * to be called INSIDE the user gesture of the action that genuinely
 * needs to write (e.g. "Bay aksè ekri" / "Export project" — never at
 * boot). MINIMUM-ACCESS principle: browse connects read-only; write
 * is granted lazily on demand. Same operation as
 * storageManager.requestRootWriteAccess() — exposed here so the whole
 * file-edit surface lives under storageManager.fs.*.
 *
 * Returns the new permission state ('granted' | 'prompt' | 'denied' |
 * …). After it resolves 'granted', retry the write.
 */
export function requestWriteAccess() {
  return rootFolderManager.requestWriteAccess();
}

/**
 * PUBLIC — RE-VALIDATE the root connection on demand (QUERY-ONLY —
 * never a prompt). An edit flow calls this after a write failed with
 * 'permission-denied'/'permission-revoked' to refresh the honest
 * state before offering recovery actions. Same operation as
 * storageManager.revalidateRootFolder().
 *
 * Returns { permissionState, accessible, rootStatus, lastValidated }.
 */
export function revalidate() {
  return rootFolderManager.revalidate();
}

/** PUBLIC — list a category folder's contents. Passthrough. */
export function categoryList(folder, category) {
  return fileSystemAdapter.categoryList(folder, category);
}

/** PUBLIC — read a Blob from a category folder. Passthrough. */
export function categoryRead(folder, category, fileName) {
  return fileSystemAdapter.categoryRead(folder, category, fileName);
}

/** PUBLIC — write into a category folder. Passthrough. */
export function categoryWrite(folder, category, fileName, data) {
  return fileSystemAdapter.categoryWrite(folder, category, fileName, data);
}

/** PUBLIC — delete from a category folder. Passthrough. */
export function categoryRemove(folder, category, fileName) {
  return fileSystemAdapter.categoryRemove(folder, category, fileName);
}

/** PUBLIC — the category set a folder carries (plain names). Passthrough. */
export function categoriesForFolder(folder) {
  return fileSystemAdapter.categoriesForFolder(folder);
}

/** PUBLIC — the fixed subfolder layout (plain names). Passthrough. */
export function layout() {
  return fileSystemAdapter.layout();
}

/** PUBLIC — is a folder name part of the fixed layout? Passthrough. */
export function isSubfolder(name) {
  return fileSystemAdapter.isSubfolder(name);
}

/**
 * The vocabulary this module speaks — exposed so the UI compares
 * against constants, never string literals:
 *   storageManager.fs.FOLDERS.MEDIA        → 'Media'
 *   storageManager.fs.OPS.WRITE            → 'write' (capability matrix)
 *   storageManager.fs.ERRORS.NO_ROOT       → 'no-root' (canonical error)
 */
export const FOLDERS = USER_FOLDERS;
export const OPS = FILE_OPS;
export const ERRORS = STORAGE_ERRORS;

export default {
  browse,
  read,
  write,
  remove,
  exists,
  list,
  createDir,
  rename,
  move,
  search,
  capabilities,
  requestWriteAccess,
  revalidate,
  categoryList,
  categoryRead,
  categoryWrite,
  categoryRemove,
  categoriesForFolder,
  layout,
  isSubfolder,
  FOLDERS,
  OPS,
  ERRORS,
};
