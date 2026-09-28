/**
 * src/pwa/storage/browserFileAdapter.js
 *
 * BROWSER FILE ADAPTER — the fallback layer of the PWA Storage
 * subsystem (browser-fs-access-STYLE abstraction — DOMESTIC, no third
 * party dependency):
 *
 *   Atelnyo Storage API          (storageManager.*)
 *        ↓
 *   BROWSER FILE ADAPTER  ← THIS MODULE
 *        ↓
 *   ┌─────────────────────────────────────┐
 *   │ File System Access pickers          │  (showOpenFilePicker /
 *   │ fallback mechanisms                 │   showSaveFilePicker)
 *   │   • <input type=file>  — open       │  (universal)
 *   │   • <a download>       — save       │  (universal)
 *   └─────────────────────────────────────┘
 *
 * WHY THIS LAYER: the application's business logic must NEVER bind
 * directly to a single browser API. Every single-file open/save goes
 * through THIS adapter, which picks the best mechanism per browser:
 *   • File System Access pickers when available (nicer UX);
 *   • the universal DOM fallbacks otherwise (Firefox / Safari / iOS).
 *
 * This is the SINGLE- FILE fallback — the counterpart of the persistent
 * FSA root (rootFolderManager + fileSystemAdapter). The Download
 * Manager builds its strategy chain on top of saveFile(); the Storage
 * Manager exposes pickFile()/openFile() for browse workflows.
 *
 * Honest results: { ok, files|file, method, error } — never throws.
 * 'cancelled' is the ONLY terminal failure (the user chose to stop);
 * any mechanism failure falls through to the next mechanism so the
 * user's action still completes.
 */
function _acceptToAttr(accept) {
  if (!accept) return undefined;
  return Object.entries(accept)
    .flatMap(([mime, exts]) => [mime, ...(exts || [])])
    .join(',');
}

/** Fallback open — <input type="file"> (works in EVERY browser). */
function _inputOpen({ accept, multiple }) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (multiple) input.multiple = true;
    const attr = _acceptToAttr(accept);
    if (attr) input.accept = attr;
    input.style.display = 'none';
    document.body.appendChild(input);
    // Settled-once guard: the picker may close through any of these
    // paths (change · cancel · window refocus) — first one wins, the
    // others no-op. Guarantees the promise ALWAYS resolves (no hang).
    let settled = false;
    const cleanup = () => {
      input.remove();
      window.removeEventListener('focus', onFocus);
    };
    const finish = (files) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(files);
    };
    const onFocus = () => finish([]);
    input.addEventListener('change', () => {
      // Capture the FileList BEFORE cleanup — removing the input from
      // the DOM must not lose the selection.
      finish(Array.from(input.files || []));
    }, { once: true });
    // `cancel` is a RECENT event (Chrome 113+). The window-refocus
    // fallback covers legacy Firefox/Safari — exactly the browsers
    // this fallback layer exists for — where dismissing the picker
    // only fires window focus; without it the promise would hang.
    input.addEventListener('cancel', () => finish([]), { once: true });
    window.addEventListener('focus', onFocus);
    input.click();
  });
}

/**
 * PUBLIC — open one or more files. Returns:
 *   { ok: true, files: File[], method: 'picker'|'input' }
 *   { ok: false, error: 'cancelled' }  (the user closed the dialog)
 *   { ok: false, error: 'open-failed' }
 */
export async function openFile({ accept, multiple = false, description } = {}) {
  // Strategy 1 — File System Access picker (when available).
  if (typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function') {
    try {
      const handles = await window.showOpenFilePicker({
        multiple,
        ...(accept ? {
          types: [{ description: description || 'Fichye', accept }],
        } : {}),
      });
      const files = await Promise.all(handles.map((h) => h.getFile()));
      return { ok: true, files, method: 'picker' };
    } catch (err) {
      if (err?.name === 'AbortError') return { ok: false, error: 'cancelled' };
      // Any other picker failure → fall through to the input fallback.
    }
  }
  // Strategy 2 — <input type="file"> (universal).
  try {
    const files = await _inputOpen({ accept, multiple });
    if (!files || files.length === 0) return { ok: false, error: 'cancelled' };
    return { ok: true, files, method: 'input' };
  } catch (err) {
    return { ok: false, error: 'open-failed', message: err?.message || '' };
  }
}

/** PUBLIC — open a SINGLE file. Returns { ok, file, method, error }. */
export async function pickFile(options) {
  const res = await openFile({ ...options, multiple: false });
  if (!res.ok) return res;
  return { ok: true, file: res.files[0], method: res.method };
}

/** Fallback save — <a download> + object URL (works in EVERY browser). */
function _anchorSave(fileName, blob) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return { ok: true, method: 'browser' };
  } catch (err) {
    return { ok: false, error: 'save-failed', message: err?.message || '' };
  }
}

/**
 * PUBLIC — save a Blob with the best available mechanism. Returns:
 *   { ok: true, method: 'picker'|'browser' }
 *   { ok: false, error: 'cancelled' }  — the ONLY terminal failure.
 *   { ok: false, error: 'save-failed' }
 * REQUIRES a user gesture for the picker path (always called from a
 * click); any picker failure falls through to the anchor download so
 * the file is still delivered.
 */
export async function saveFile(blob, { suggestedName, mime } = {}) {
  const fileName = suggestedName || 'fichye';
  if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
    try {
      const options = { suggestedName: fileName };
      if (mime) {
        // Only derive a filter extension when the name actually has
        // one (a dotless name must not produce a bogus `.name` filter).
        const match = /\.[a-z0-9]+$/i.exec(fileName);
        const ext = match ? match[0] : '.bin';
        options.types = [{
          description: 'Fichye',
          accept: { [mime]: [ext] },
        }];
      }
      const handle = await window.showSaveFilePicker(options);
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { ok: true, method: 'picker' };
    } catch (err) {
      if (err?.name === 'AbortError') return { ok: false, error: 'cancelled' };
      // Any other picker failure → fall through to the anchor download
      // (the delivery guarantee: the user always receives the file).
    }
  }
  return _anchorSave(fileName, blob);
}

export default {
  openFile,
  pickFile,
  saveFile,
};
