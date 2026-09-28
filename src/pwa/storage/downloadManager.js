/**
 * src/pwa/storage/downloadManager.js
 *
 * DOWNLOAD MANAGER — the single download abstraction of the PWA
 * Storage subsystem:
 *
 *   User wants to download  (project / media / generated file / report)
 *        ↓
 *   storageManager.saveDownload(fileName, blob)
 *        ↓
 *   DOWNLOAD MANAGER  ← THIS MODULE — picks the BEST mechanism:
 *        ├── 1. User folder (FSA)   → Atelnyo/Downloads/ (write-granted root)
 *        ├── 2. Save-file picker    → showSaveFilePicker (user picks location)
 *        └── 3. Browser download    → <a download> + object URL (universal)
 *
 * THE RULE: the UI NEVER needs to know which mechanism ran. It calls
 * saveDownload() and receives WHERE the file went ({ method }), not a
 * choice of mechanism. The manager routes by environment:
 *   • a connected READWRITE root → silent write into Atelnyo/Downloads/;
 *   • otherwise showSaveFilePicker when available (a user gesture —
 *     saveDownload is always called from a click);
 *   • otherwise the browser's native download (works everywhere).
 *
 * Every strategy honors the established principles: the folder write
 * goes through the File System Adapter (the ONLY FSA touchpoint for
 * handle operations), permission failures fall back honestly, and the
 * result is plain data ({ ok, method, fileName, error }).
 */
import { writeFile, categoryWrite } from './fileSystemAdapter.js';
import { saveFile } from './browserFileAdapter.js';
import { USER_FOLDERS } from './storageTypes.js';

/**
 * PUBLIC — save/download a file with the best available mechanism.
 *
 *   saveDownload(fileName, data, { mime, preferPicker, folder, category })
 *
 *   • data           — string or Blob.
 *   • mime           — optional MIME type (used by the picker + blob).
 *   • preferPicker   — true to skip the silent user-folder write and
 *                      always show the picker when available.
 *   • folder         — the USER_FOLDERS subfolder for strategy 1
 *                      (default Downloads/ — backups pass Backups/).
 *   • category       — optional category under the folder for strategy
 *                      1 (Atelnyo/<folder>/<Cat>/) — media exports
 *                      pass Media/ + 'Images' etc.
 *
 * Returns { ok, method, fileName, error } — method is
 * 'user-folder' | 'picker' | 'browser'. The UI reads the OUTCOME
 * (where the file went), never chooses the mechanism.
 */
export async function saveDownload(fileName, data, options = {}) {
  const blob = data instanceof Blob
    ? data
    : new Blob([data], options.mime ? { type: options.mime } : undefined);
  const targetFolder = options.folder || USER_FOLDERS.DOWNLOADS;

  // Strategy 1 — write into the connected user folder (optionally a
  // category folder under it).
  let fallbackReason = null;
  if (!options.preferPicker) {
    const res = options.category
      ? await categoryWrite(targetFolder, options.category, fileName, blob)
      : await writeFile(targetFolder, fileName, blob);
    if (res.ok) {
      return {
        ok: true,
        method: 'user-folder',
        fileName,
        folder: targetFolder,
        ...(options.category ? { category: options.category } : {}),
      };
    }
    // Honest routing: on ANY folder-write failure (no root, permission
    // denied/prompt, missing folder, I/O) fall through to the picker /
    // browser — the user asked for the file and must still get it. The
    // returned method keeps the outcome honest.
    fallbackReason = `user-folder:${res.error}`;
  }

  // Strategies 2/3 — picker then browser download, owned by the
  // Browser File Adapter (the fallback layer). ONLY 'cancelled' is
  // terminal; any picker failure falls through so the file is still
  // delivered.
  const saved = await saveFile(blob, { suggestedName: fileName, mime: options.mime });
  if (saved?.ok) {
    saved.fileName = fileName;
    // Honest outcome: when the file went out via the BROWSER download
    // (not the picker), the caller can see WHY the user-folder write
    // was skipped (if it failed) — never a silent mechanism switch.
    if (saved.method === 'browser' && fallbackReason) {
      saved.note = `fell back to browser download (${fallbackReason})`;
    }
  }
  return saved;
}

export default {
  saveDownload,
};
