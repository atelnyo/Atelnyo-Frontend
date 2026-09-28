/**
 * src/pwa/storage/exportManager.js
 *
 * EXPORT MANAGER — the export workflow of the PWA Storage subsystem.
 *
 *   Export
 *   ├── Project   (project bundle)
 *   ├── Document  (PDF / text document)
 *   ├── Media     (media file export)
 *   ├── Data      (CSV / structured data export)
 *   └── Report    (generated report)
 *
 * SEPARATION OF CONCERNS — the architecture rule:
 *   • The Storage Manager provides the STORAGE CAPABILITY: destination
 *     (Atelnyo/Exports/ → picker → browser download), permission (gate
 *     at the needed mode), and the write operation (saveDownload).
 *   • The FEATURE-SPECIFIC module decides WHAT to export — the actual
 *     file content — and declares the type (EXPORT_TYPES).
 *   • The manager NEVER decides or inspects export content; it routes
 *     the file the feature produced and reports where it went.
 *
 * Destination routing reuses the Download Manager's strategy chain
 * (user folder → picker → browser download) pointed at the Exports/
 * subfolder — one mechanism, honest results ({ method }).
 */
import { saveDownload } from './downloadManager.js';
import { USER_FOLDERS, EXPORT_TYPES } from './storageTypes.js';

/**
 * PUBLIC — export a file the feature module produced.
 *
 *   createExport({ type, fileName, data, mime, preferPicker, folder,
 *                 category })
 *
 *   • type          — EXPORT_TYPES value (project/document/media/data/
 *                     report). Validated; 'unknown-export-type' when
 *                     outside the vocabulary (pass nothing for a custom
 *                     export the vocabulary doesn't cover yet).
 *   • fileName      — the export file name.
 *   • data          — string or Blob — the FILE the feature module
 *                     produced (the manager never decides content).
 *   • mime          — optional MIME type.
 *   • preferPicker  — force the save-file picker (skip the silent
 *                     user-folder write) when the caller prefers an
 *                     explicit destination choice.
 *   • folder        — optional USER_FOLDERS target (default Exports/).
 *   • category      — optional category under the folder
 *                     (Atelnyo/<folder>/<Cat>/) — media exports pass
 *                     folder=Media/ + category='Images' etc.
 *
 * Returns { ok, method, fileName, type, error } — method =
 * 'user-folder' | 'picker' | 'browser'. The feature module reads the
 * OUTCOME; it never chose the mechanism.
 */
export async function createExport({
  type,
  fileName,
  data,
  mime,
  preferPicker,
  folder,
  category,
} = {}) {
  if (type && !Object.values(EXPORT_TYPES).includes(type)) {
    return { ok: false, error: 'unknown-export-type' };
  }
  const res = await saveDownload(fileName, data, {
    mime,
    folder: folder || USER_FOLDERS.EXPORTS,
    preferPicker: preferPicker === true,
    category,
  });
  if (!res.ok) return res;
  return { ...res, type: type || null };
}

export default { createExport };
