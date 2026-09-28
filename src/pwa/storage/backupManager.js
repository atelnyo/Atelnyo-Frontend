/**
 * src/pwa/storage/backupManager.js
 *
 * BACKUP MANAGER — the backup workflow of the PWA Storage subsystem:
 *
 *   Create Backup
 *       ↓
 *   Package application/project data    (manifest envelope + collect)
 *       ↓
 *   Choose destination                  (user folder / picker / download)
 *       ↓
 *   Write backup
 *       ↓
 *   Verify result                       (read-back comparison)
 *
 * ⚠️ BACKUP ≠ "copy the whole browser database into the folder."
 * A backup is a MANIFEST-DRIVEN envelope built from an EXPLICIT set of
 * data that the PRODUCT decides is exportable/backupable — WHICH data
 * that is is DEFINED LATER (the ``collect`` callback). This manager
 * owns the pipeline, the format envelope, the destination routing, and
 * the verification; it NEVER performs an implicit full-database dump.
 *
 * The envelope is self-describing: it records ``domains`` (the list of
 * data groups collected) so a future restore can validate what a
 * backup contains before applying it.
 *
 * Destination routing reuses the Download Manager's strategy chain
 * (user folder → picker → browser download) pointed at the Backups/
 * subfolder — one mechanism, honest results ({ method }).
 */
import { saveDownload } from './downloadManager.js';
import { writeFile, readText } from './fileSystemAdapter.js';
import {
  USER_FOLDERS,
  BACKUP_FORMAT,
  BACKUP_DESTINATIONS,
} from './storageTypes.js';

/** A timestamped, human-friendly default backup file name. */
function _defaultFileName(now) {
  const d = new Date(now || Date.now());
  const p = (n) => String(n).padStart(2, '0');
  return `atelnyo-backup_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.json`;
}

/**
 * Package the backup envelope: format marker + version + the domains
 * the collector produced + the collected data itself. The DATA is the
 * app's explicit choice (defined later); the FORMAT is this manager's
 * contract.
 */
async function _package({ collect, appVersion, now }) {
  // The collector answers "which data is exportable/backupable?" —
  // an explicit product decision, never an implicit DB dump.
  const collected = await (typeof collect === 'function'
    ? collect()
    : collect || {});
  const domains = Object.keys(collected || {});
  return {
    domains,
    payload: JSON.stringify({
      format: BACKUP_FORMAT.FORMAT_MARKER,
      version: BACKUP_FORMAT.VERSION,
      createdAt: now || Date.now(),
      appVersion: appVersion || null,
      domains,
      data: collected || {},
    }, null, 2),
  };
}

/**
 * PUBLIC — run the backup workflow end to end.
 *
 *   createBackup({ collect, appVersion, destination, fileName })
 *
 *   • collect     — REQUIRED data source: a function (or plain object)
 *                   returning { domain: data }. WHICH domains are
 *                   backupable is a PRODUCT decision, defined later —
 *                   this manager never dumps the whole database.
 *   • appVersion  — optional version stamped into the envelope.
 *   • destination — BACKUP_DESTINATIONS: 'auto' (default — user folder
 *                   → picker → download) | 'user-folder' | 'picker'.
 *   • fileName    — optional; defaults to a timestamped name.
 *
 * Returns { ok, method, fileName, verified, bytes, error }:
 *   • method   — 'user-folder' | 'picker' | 'browser' (where it went).
 *   • verified — true when the backup was READ BACK and matched;
 *                null when the destination can't be verified by the app
 *                (picker/browser download — outside app control).
 */
export async function createBackup({
  collect,
  appVersion,
  destination = BACKUP_DESTINATIONS.AUTO,
  fileName,
} = {}) {
  const now = Date.now();
  const name = fileName || _defaultFileName(now);
  const { domains, payload } = await _package({ collect, appVersion, now });
  const bytes = new Blob([payload]).size;

  // An empty collector produces an empty envelope — that is NOT a valid
  // backup. Which data is backupable is an explicit product decision;
  // an empty decision must not present as a successful backup.
  if (domains.length === 0) {
    return { ok: false, error: 'empty-backup' };
  }

  // Destination: USER_FOLDER = Backups/ folder ONLY (honest failure
  // when unavailable — no silent fall-through); AUTO / PICKER reuse the
  // download strategy chain (user folder → picker → browser download).
  if (destination === BACKUP_DESTINATIONS.USER_FOLDER) {
    const res = await writeFile(USER_FOLDERS.BACKUPS, name, payload);
    if (!res.ok) return res;
    const check = await readText(USER_FOLDERS.BACKUPS, name);
    return {
      ok: true,
      method: 'user-folder',
      fileName: name,
      folder: USER_FOLDERS.BACKUPS,
      verified: check.ok && check.text === payload,
      bytes,
    };
  }

  const res = await saveDownload(name, payload, {
    mime: BACKUP_FORMAT.MIME,
    folder: USER_FOLDERS.BACKUPS,
    preferPicker: destination === BACKUP_DESTINATIONS.PICKER,
  });
  if (!res.ok) return res;

  // Verify result: read the user-folder copy back and compare. Picker /
  // browser destinations are outside the app's control → verified: null.
  let verified = null;
  if (res.method === 'user-folder') {
    const check = await readText(USER_FOLDERS.BACKUPS, name);
    verified = check.ok && check.text === payload;
  }

  return { ...res, verified, bytes };
}

export default { createBackup };
