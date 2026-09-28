/**
 * src/pwa/storage/StorageManager.js
 *
 * PWA STORAGE MANAGER — single source of truth for “Ki kote Atelnyo
 * ka mete fichye li yo?” (where can Atelnyo put its files?). It is
 * the STATE MACHINE of the Storage subsystem; pure detection, health,
 * and the raw backends are owned by sibling modules and COMPOSED here
 * (no duplicated logic):
 *
 *   src/pwa/storage/
 *   ├── storageTypes.js       → backend buckets + health levels +
 *   │                            policy knobs (pure)
 *   ├── storageBackends.js    → IndexedDB KV + OPFS files +
 *   │                            localStorage fallback + encryption
 *   │                            + quota (byte-compatible port of the
 *   │                            legacy src/services/storageEngine.js)
 *   ├── storageDetector.js    → which backends exist / primary backend
 *   │                            / storage estimate / persistence
 *   │                            (pure, environment-safe)
 *   ├── storageHealth.js      → health level derivation + error log
 *   └── StorageManager.js     → THIS MODULE — the state machine
 *                                + public abstraction + singleton
 *
 *   Storage Detection  →  Atelnyo starts → initialize() re-runs the
 *                         WHOLE pipeline (backend availability, primary
 *                         backend, quota, persistence, health) so the
 *                         machine is always up to date — idempotent.
 *   Primary Backend    →  the first available rung of the fallback
 *                         chain (IndexedDB → OPFS → localStorage;
 *                         File System Access joins in Phase B).
 *   Storage Health     →  ok / warning / low / blocked — derived from
 *                         availability + quota pressure (storageHealth).
 *   Persistence        →  navigator.storage.persist() — protects the
 *                         origin's data from eviction; requested
 *                         INTENTIONALLY (Settings UI), never at boot.
 *   Data API           →  store.* (KV) + files.* (blobs) — the exact
 *                         backend objects, re-exported so the legacy
 *                         src/services/storageEngine.js stays a
 *                         zero-change compat shim for its 5 consumers
 *                         (offlineQueue, appStateStore, consentEngine,
 *                         capabilityEngine, offlineSettings).
 *   Integration        →  App Controller (src/pwa/app/AppController.js)
 *                         composes this manager's facts into the
 *                         runtime snapshot for the UI.
 *
 * Consumers subscribe via subscribe(cb) and always read the snapshot
 * from getState() — the same reactive contract the Installation and
 * Continuity Managers use.
 *
 * ── PUBLIC API — the whole app talks to the manager through these ──
 *   initialize()     — re-evaluate the full pipeline (idempotent)
 *   getState()       — immutable-ish snapshot for the UI
 *   requestPersistence()— ask the browser for persistent storage
 *   getWriteStatus() — the QUOTA GATE: pre-write check — storage
 *                      warns, NEVER fails silently
 *   handleQuotaFailure(err)— map a QuotaExceededError → record +
 *                      degrade LOW + refresh estimate + notify
 *   subscribe()      — reactive updates (returns unsubscribe)
 *   destroy()        — full teardown (tests / HMR); init() re-wires
 *   store.* / files.*— the KV + blob data API (backend objects)
 *
 * ⚠️ StorageManager ≠ storageEngine. If a feature needs the raw KV or
 *    blob backends, it can use store.* or files.* (the migrated
 *    backend layer). If it needs availability / health / quota /
 *    persistence facts, it reads THIS manager. Never re-derive the
 *    primary backend or health in a component.
 */
import {
  STORAGE_BACKENDS,
  HEALTH_LEVELS,
  SPACE_LEVELS,
  spaceLevelFor,
  STORAGE_ERRORS,
  normalizeStorageError,
  STORAGE_PERMISSIONS,
  ACCESS_MODES,
  USER_STORAGE_STATUSES,
  userStorageStatusFor,
} from './storageTypes.js';
import {
  store,
  files,
} from './storageBackends.js';
import {
  detectBackends,
  detectCapabilities,
  detectPrimaryBackend,
  detectFileBackend,
  getStorageEstimate,
  isPersisted,
  requestPersistence as requestBrowserPersistence,
} from './storageDetector.js';
import {
  computeHealth,
  computeHealthSnapshot,
  isQuotaError,
  recordError,
  clearErrors,
  errorLog,
} from './storageHealth.js';
import privateStorage from './privateStorage.js';
// The ROOT FOLDER MANAGER stays INTERNAL to the Storage subsystem:
// only this module imports it (boundary owner). The FileSystemDirectoryHandle
// never leaves — consumers get metadata via getState() and operate on
// the folder via the sanctioned methods below (getSubfolder/chooseRoot/
// disconnect/revokeAccess/reapproveAccess).
import rootFolderManager from './rootFolderManager.js';
import handleManager from './handleManager.js';
// FILE OPERATIONS — the PUBLIC sanctioned layer (Faz B.2 modil
// piblik): storageManager.fs.* is THIS module, the one surface a UI
// component uses to browse/list/edit user files. It delegates every
// operation to the adapter (below) — the adapter stays the ONLY
// module that touches browser File System Access APIs; components
// never hold a handle and never import the adapter directly.
import fileOperations from './fileOperations.js';
import browserFileAdapter from './browserFileAdapter.js';
import downloadManager from './downloadManager.js';
import backupManager from './backupManager.js';
import exportManager from './exportManager.js';
import draftStore from './draftStore.js';
// FILE CATALOG — the persistent index (Exports/atelnyo-catalog.json)
// that keeps the file manager alive: search + stars + status. Lives
// AS A FILE in the user's folder (travels with it, survives sandbox
// wipes); the folder stays the truth, the catalog is cache + user
// metadata. Exposed as ``storageManager.catalog`` (sync/search/
// setStar/subscribe/getState).
import fileCatalog from './fileCatalog.js';

class StorageManager {
  constructor() {
    this._inited = false;
    // True once the STARTUP SEQUENCE completed: the sync detection
    // (capabilities → backends → primary) AND the first async pass
    // (estimate → persistence → health) settled — success OR failure
    // (a blocked/unknown estimate still completes initialization; the
    // state is honest either way). 'ready' = "the sequence ran", NOT
    // "everything works". Re-runs of initialize() (foreground return,
    // Settings refresh) keep it true — it is a FIRST-INIT flag.
    this.ready = false;
    // ── Detection facts ───────────────────────────────────────────
    // The STORAGE CAPABILITY MAP — “What does this environment
    // support?” — a granular per-capability answer (platform primitives
    // · File System Access family · private backends + quota APIs).
    // NEVER one boolean: see detectCapabilities(). Re-evaluated on
    // every initialize().
    this.capabilities = null;
    // Which backends exist in THIS browser (all rungs of the chain).
    this.backends = {};
    // The primary KV backend actually in use (or STORAGE_BACKENDS.NONE).
    // Matches the ACTUAL write chain of store.* (IDB → localStorage).
    this.backend = STORAGE_BACKENDS.NONE;
    // The primary FILE backend actually in use (or STORAGE_BACKENDS.NONE).
    // Matches the ACTUAL write chain of files.* (OPFS → IDB blobs).
    this.fileBackend = STORAGE_BACKENDS.NONE;
    // True when at least one usable backend exists.
    this.available = false;
    // Epoch guard: destroy() bumps this so an in-flight async refresh
    // from a previous lifecycle can never mutate post-destroy state.
    this._epoch = 0;
    // ── Quota / persistence ───────────────────────────────────────
    this.quota = 0;
    this.usage = 0;
    this.usageRatio = 0;
    // Is the origin's storage persisted (protected from eviction)?
    this.persisted = false;
    // ── Health ────────────────────────────────────────────────────
    this.health = HEALTH_LEVELS.UNKNOWN;
    // Last storage error message (null when everything is clean).
    this.lastError = null;
    this._listeners = new Set();
    // Private App Storage domain layer — see privateStorage.js.
    // Exposed here so every private-domain consumer goes through ONE
    // entry (storageManager.privateStorage) instead of importing the
    // module directly.
    this.privateStorage = privateStorage;
    // User storage (principle B) — the user-selected root folder and
    // the persistent handle lifecycle. The HANDLE lives in private
    // storage (a key); the user's FILES live in the user's folder.
    // ⚠️ rootFolderManager itself is NOT re-exported (no public
    //    ``storageManager.rootFolder``): the raw FileSystemDirectoryHandle
    //    must never be reachable from a component. Operation methods
    //    (chooseRoot/getSubfolder/disconnect/revokeAccess/reapproveAccess)
    //    are the sanctioned surface; ``handles`` stays for the handle
    //    lifecycle (save/restore/revalidate — keys, not the live handle).
    this.handles = handleManager;
    // File operations — React goes through THIS (storageManager.fs.*),
    // the PUBLIC File Operations layer (browse/read/write/remove +
    // the full adapter surface + capabilities + in-gesture write
    // escalation). It delegates to the File System Adapter — the ONLY
    // layer that touches the browser File System Access API.
    // Components never hold a handle:
    //   React → Storage Manager (fs.* = fileOperations) →
    //          File System Adapter → Browser API
    this.fs = fileOperations;
    // Downloads — the UI calls saveDownload() and NEVER knows the
    // mechanism (user folder → picker → browser download):
    //   React → Storage Manager → Download Manager → best mechanism
    this.saveDownload = downloadManager.saveDownload;
    // Single-file open (browse workflows) — pickFile()/openFile() go
    // through the Browser File Adapter, which picks the best mechanism
    // per browser (FSA picker → <input type=file>). The UI never
    // touches the raw APIs:
    //   React → Storage Manager → Browser File Adapter → best mechanism
    this.openFile = browserFileAdapter.openFile;
    this.pickFile = browserFileAdapter.pickFile;
    // Backups — the UI calls createBackup() with an explicit data
    // collector; the manager owns package → destination → write →
    // verify. NEVER a raw browser-database dump (manifest-driven).
    this.createBackup = backupManager.createBackup;
    // Exports — the Storage Manager provides the STORAGE CAPABILITY
    // (destination + permission + write); the FEATURE-SPECIFIC module
    // decides what to export and calls createExport({ type, … }).
    this.createExport = exportManager.createExport;
    // Drafts — the DRAFTS storage PRIMITIVE (draft protection):
    //   React → Storage Manager (drafts.save/get/list/remove/clear) →
    //   private:drafts:<formId> domain. Autosave POLICY (when to save /
    //   remove) lives in the feature layer; restore ORCHESTRATION
    //   lives in the Continuity Manager (→ appStateStore → this).
    this.drafts = draftStore;
    // File catalog — the persistent index that powers search + stars
    // + catalog status in the file manager. Read-only consumers
    // (search/isStarred/stats/getState) work offline-first from the
    // in-memory index; sync() reconciles against the REAL folder
    // (the truth) and persists the index file when the write grant
    // allows:
    //   React → Storage Manager (catalog.* = fileCatalog) → fs.* →
    //          folder (Exports/atelnyo-catalog.json)
    this.catalog = fileCatalog;
    // ── Error normalization ───────────────────────────────────────
    // The CANONICAL error vocabulary (STORAGE_ERRORS) + the single
    // mapper (normalizeStorageError) — the UI classifies ANY storage
    // failure through these (never a raw DOMException name):
    //   storageManager.errors.PERMISSION_DENIED …   (vocabulary)
    //   storageManager.normalizeError(errOrCode)    (category)
    //   storageManager.errorCategory(resultOrError) (category of a
    //     tagged result or a raw error — one call)
    this.errors = STORAGE_ERRORS;
    this.normalizeError = normalizeStorageError;
    // The USER-STORAGE STATUS vocabulary (the 9-state machine) — the
    // UI compares against these constants, never string literals:
    //   storageManager.userStorageStatuses.READ_WRITE …
    this.userStorageStatuses = USER_STORAGE_STATUSES;
  }

  /** Bind once. Idempotent. Returns `this`. */
  init() {
    if (this._inited || typeof window === 'undefined') return this;
    this._inited = true;

    // Dev/debug affordance: inspect the storage snapshot from the
    // console, e.g. ``window.__storageManager.getState()``.
    try {
      window.__storageManager = this;
    } catch (_) { /* ignore */ }

    // ── Pipeline: detect → estimate → health (async, fire-and-forget)
    this.initialize();

    // ── QUOTA FRESHNESS on foreground return: the user may have freed
    //    space (or filled it) while the app was away — re-run the
    //    pipeline (detect + estimate + persistence + health) so a
    //    stale LOW/WARNING clears (or appears) with the REAL numbers.
    //    Idempotent + cheap (the estimate is one storage call). This
    //    completes the "storage warns, never silently fails" rule: the
    //    low-space surface must not outlive the condition it reports.
    this._onVisibility = () => {
      if (document.visibilityState === 'visible') this.initialize();
    };
    document.addEventListener('visibilitychange', this._onVisibility);

    // ── User storage reactivity: root-folder changes re-emit the
    //    storage snapshot (userStorage facts) to every subscriber.
    //    The FILE CATALOG rides the same signal: a (re)connected root
    //    re-syncs the index (walk the truth + recover stars from the
    //    catalog file); a disconnect clears the index (honest — the
    //    entries belong to that folder). Idempotent + fire-and-forget
    //    (sync never rejects).
    rootFolderManager.subscribe((uf) => {
      // (Re)connected root → re-sync the index (walk the truth +
      // recover stars from the catalog file). Deliberately NOT gated on
      // uf.accessible === true: a FRESH connect leaves accessible null
      // (unprobed) until the first revalidation — gating here would
      // make the manager hook dead for fresh connects. sync() handles
      // a failed/partial browse gracefully (no root → honest empty).
      if (uf && uf.rootFolderConnected === true) {
        fileCatalog.sync().catch(() => { /* handled inside */ });
      } else if (uf && uf.rootFolderConnected === false) {
        fileCatalog.resetForDisconnect();
      }
      this._notify();
    });
    return this;
  }

  /**
   * PUBLIC — re-evaluate the full storage pipeline from scratch.
   *
   *   detect backends → pick primary → storage estimate →
   *   persistence state → derive health
   *
   * Idempotent and safe to call any time (boot, Settings refresh,
   * after bulk writes). The estimate + persistence calls are async —
   * the snapshot is published once they land.
   */
  initialize() {
    if (typeof window === 'undefined') return this;
    // Synchronous part: the capability map + backend availability +
    // primary backends. detectCapabilities() is the ONLY environment
    // probe — detectBackends() is derived from it (no double sniffing).
    this.capabilities = detectCapabilities();
    this.backends = detectBackends();
    this.backend = detectPrimaryBackend(this.backends);
    this.fileBackend = detectFileBackend(this.backends);
    this.available = this.backend !== STORAGE_BACKENDS.NONE
      || this.fileBackend !== STORAGE_BACKENDS.NONE;
    // Async part: quota estimate + persistence state → health.
    this._refreshAsync().catch(() => { /* failure handled in _refreshAsync */ });
    return this;
  }

  /**
   * Async refresh of quota + persistence + health. Errors never
   * reject — a storage problem degrades to a fact (health/error), not
   * an unhandled promise.
   */
  async _refreshAsync() {
    // Epoch guard: capture the lifecycle this refresh belongs to. If
    // destroy() ran while the estimate was in flight, the epoch moved
    // — this stale callback must NOT mutate post-destroy state.
    const epoch = this._epoch;
    try {
      const { usage, quota } = await getStorageEstimate();
      if (epoch !== this._epoch) return; // stale lifecycle — drop
      this.usage = usage;
      this.quota = quota;
      this.usageRatio = quota > 0 ? usage / quota : 0;
      this.persisted = await isPersisted();
      if (epoch !== this._epoch) return; // re-check after the 2nd await
      // A successful refresh clears the previous error — health and
      // lastError must never disagree (stale 'failed' with 'ok').
      this.lastError = null;
      this.health = computeHealth({ backend: this.backend, quota, usage });
      this.ready = true;
      this._notify();
    } catch (err) {
      if (epoch !== this._epoch) return;
      // Estimate failed (private mode / blocked) — record + degrade.
      this.lastError = err?.message || 'storage estimate failed';
      recordError(this.lastError);
      this.health = this.available ? HEALTH_LEVELS.UNKNOWN : HEALTH_LEVELS.BLOCKED;
      // The pass FAILED but the sequence completed — the state is
      // honest (blocked/unknown + error recorded); 'ready' means the
      // startup ran, not that it succeeded.
      this.ready = true;
      this._notify();
    }
  }

  /**
   * PUBLIC — ask the browser for persistent storage (may prompt the
   * user). Returns the new persisted state. Call ONLY on an explicit
   * user action (e.g. the Settings “Fè pèsistan” button) — never at
   * boot, where an unprompted permission ask is hostile UX.
   */
  async requestPersistence() {
    try {
      this.persisted = await requestBrowserPersistence();
      this._notify();
      return this.persisted;
    } catch (err) {
      this.lastError = err?.message || 'persistence request failed';
      recordError(this.lastError);
      this._notify();
      return false;
    }
  }

  /**
   * PUBLIC — the STORAGE CAPABILITY MAP: “What does this environment
   * support?” — platform primitives · File System Access family
   * (directory/open/save pickers · handle.move · handle persistence) ·
   * private backends + quota/persistence APIs. Granular per
   * capability — NEVER one boolean. Static for the session (refresh
   * via initialize()); the snapshot in getState() carries the same
   * map.
   */
  getCapabilities() {
    return this.capabilities;
  }

  /**
   * PUBLIC — the primary KV backend bucket actually in use
   * ('indexeddb' | 'localstorage' | 'none'). Components branch on this
   * stable value instead of sniffing storage APIs.
   */
  getBackend() {
    return this.backend;
  }

  /**
   * PUBLIC — the primary FILE backend bucket actually in use
   * ('opfs' | 'indexeddb' | 'none'). Separated from the KV backend —
   * the two layers write through DIFFERENT chains and are never
   * conflated.
   */
  getFileBackend() {
    return this.fileBackend;
  }

  /**
   * PUBLIC — is storage usable right now? False ⇒ BLOCKED (no backend).
   */
  isAvailable() {
    return this.available === true;
  }

  /**
   * PUBLIC — resolve one of the fixed USER_FOLDERS subfolders under
   * the user-selected root (creating it when missing). THE sanctioned
   * way to operate on the user's folder: the FileSystemDirectoryHandle
   * stays INSIDE the storage subsystem — consumers never receive the
   * raw handle, only a resolved subfolder for a single operation
   * (handed to Faz B.2 fileOperations). Returns a directory handle or
   * null (no root / unknown folder / FSA unsupported / I/O failure).
   */
  async getSubfolder(name) {
    return rootFolderManager.getSubfolder(name);
  }

  /**
   * PUBLIC — disconnect the user-selected root: drop the persisted
   * handle and clear the live state. The app can no longer open the
   * folder.
   *
   * ⚠️ DISCONNECT ≠ DELETE — this NEVER touches the user's physical
   * folder. Atelnyo FORGETS THE ACTIVE CONNECTION (drops the handle
   * key); the folder physically stays where it is.
   *
   * Returns { handleDropped, folderKept, note } — the caller can
   * confirm the folder was NOT deleted.
   */
  async disconnectRootFolder() {
    return rootFolderManager.disconnect();
  }

  /**
   * PUBLIC — revoke access to the user-selected root (disconnect + an
   * honest summary; there is no scriptable revokePermission).
   */
  async revokeRootFolderAccess() {
    return rootFolderManager.revokeAccess();
  }

  /**
   * PUBLIC — ask the browser to RE-APPROVE access to the root folder.
   * REQUIRES a user gesture (a "Re-apwouve" button — never at boot).
   * Returns the new permission state.
   */
  async reapproveRootFolder() {
    return rootFolderManager.reapproveAccess();
  }

  /**
   * PUBLIC — RE-VALIDATE the root connection on demand (foreground
   * return, storage panel open, explicit refresh). QUERY-ONLY (never
   * a prompt — a re-approval needs a user gesture). Detects the
   * "connected handle but inaccessible" edge case: the permission
   * grant may read 'granted' while the folder was deleted/moved on
   * disk — the accessibility probe catches it and the state STOPS
   * showing "Connected ✓" (rootStatus becomes 'inaccessible').
   *
   * Returns { permissionState, accessible, rootStatus, lastValidated }.
   */
  async revalidateRootFolder() {
    return rootFolderManager.revalidate();
  }

  /**
   * PUBLIC — UPGRADE the root folder to write access (read →
   * readwrite). REQUIRES a user gesture (the action that actually
   * needs to write, e.g. "Export project" — never at boot). This is
   * the ONLY way write access is obtained: MINIMUM-ACCESS principle
   * — browse connects read-only, write is granted lazily on demand.
   * Returns the new permission state.
   */
  async requestRootWriteAccess() {
    return rootFolderManager.requestWriteAccess();
  }

  /**
   * PUBLIC — CONNECT the root folder (the final "Connect Storage"
   * flow — Settings/Feature → Storage Manager → feature detection →
   * directory picker → user chooses folder → store handle → validate
   * permission (in-gesture) → register root → persist handle →
   * "Storage connected"). Defaults to READ (minimum access); pass
   * ACCESS_MODES.READWRITE only when the connecting feature genuinely
   * needs to write.
   *
   * Returns an HONEST result — the UI can tell CONNECTED from
   * CANCELLED from FAILED:
   *   { ok: true,  action: 'connected', cancelled: false, error: null,
   *     rootName, permission, mode }        — Storage connected
   *   { ok: false, action: 'connected', cancelled: true, … } — user
   *     closed the picker — NO error message (an outcome, not a fail)
   *   { ok: false, action: 'connected', cancelled: false, error, … }
   *     — unsupported / I/O failure — show the canonical category
   */
  async chooseRootFolder(mode) {
    return rootFolderManager.chooseRoot(mode);
  }

  /**
   * PUBLIC — CHANGE ROOT FOLDER: replace the current root with a NEW
   * one the user picks (same gesture-driven picker flow as
   * chooseRootFolder). Keeps the CURRENT access mode by default (a
   * readwrite root stays readwrite — never silently downgrades).
   *
   * ⚠️ CHANGE ≠ DELETE — the OLD physical folder is NEVER touched;
   * the app only replaces the handle (the key). If the user CANCELS
   * the picker, the current root stays untouched (no-op).
   *
   * Returns an honest result:
   *   { ok: true,  action: 'changed', previousRootName, rootName,
   *     permission, mode, oldFolderKept: true }
   *   { ok: false, action: 'changed', cancelled, error,
   *     previousRootName, rootName: <unchanged>, oldFolderKept: true }
   */
  async changeRootFolder(mode) {
    return rootFolderManager.changeRoot(mode);
  }

  /**
   * PUBLIC — classify any storage failure into its canonical category
   * (STORAGE_ERRORS value). One call for the UI:
   *
   *   storageManager.errorCategory(result)   → category of a tagged
   *     operation result ({ ok: false, error: … })
   *   storageManager.errorCategory(errOrCode) → category of a raw
   *     Error / DOMException or an error code string
   *
   * The UI switches on STORAGE_ERRORS for its message; it NEVER reads
   * a browser exception name directly (see normalizeStorageError).
   */
  errorCategory(value) {
    if (value && typeof value === 'object') {
      // A result that reports a user CANCEL ({ ok: false, cancelled:
      // true, error: null } — e.g. changeRoot's failure contract) is
      // an OUTCOME, not a failure: classify it as 'cancelled', never
      // as 'unknown' (a null error string must not hide the cancel).
      if (value.cancelled === true) return STORAGE_ERRORS.CANCELLED;
      if (typeof value.error === 'string') return normalizeStorageError(value.error);
    }
    return normalizeStorageError(value);
  }

  /**
   * PUBLIC — is quota pressure past the LOW threshold (large writes
   * discouraged)? The UI shows a low-space surface when true.
   */
  isLowSpace() {
    return this.health === HEALTH_LEVELS.LOW;
  }

  /**
   * PUBLIC — the QUOTA GATE (pre-write check). Storage must NEVER
   * fail silently: writers check BEFORE a large write and get an
   * honest verdict instead of hitting a QuotaExceededError in the
   * dark. Where the browser gives the numbers (navigator.storage
   * .estimate → usage/quota), this returns the derived state:
   *
   *   { ok: true,  level, usageRatio, lowSpace, warning }   — a write
   *     is acceptable; `warning` may be 'low-space-approaching'
   *     (past the WARN threshold — the UI should tell the user).
   *   { ok: false, level, usageRatio, lowSpace, warning }   — BLOCKED
   *     (no backend) or LOW (past the LOW threshold — large writes
   *     discouraged; surface a low-space warning instead of
   *     attempting and failing silently).
   *
   * Small writes may proceed at 'warning' (ok: true); the caller
   * decides the size policy. `level` mirrors getState().health.
   */
  getWriteStatus() {
    if (!this.available) {
      return {
        ok: false, level: HEALTH_LEVELS.BLOCKED, spaceLevel: null,
        usageRatio: this.usageRatio, lowSpace: false, warning: 'storage-blocked',
      };
    }
    if (this.health === HEALTH_LEVELS.LOW) {
      return {
        ok: false, level: HEALTH_LEVELS.LOW, spaceLevel: SPACE_LEVELS.CRITICAL,
        usageRatio: this.usageRatio, lowSpace: true, warning: 'low-space',
      };
    }
    if (this.health === HEALTH_LEVELS.WARNING) {
      return {
        ok: true, level: HEALTH_LEVELS.WARNING, spaceLevel: SPACE_LEVELS.WARNING,
        usageRatio: this.usageRatio, lowSpace: false, warning: 'low-space-approaching',
      };
    }
    if (this.health === HEALTH_LEVELS.UNKNOWN) {
      return {
        ok: true, level: HEALTH_LEVELS.UNKNOWN, spaceLevel: SPACE_LEVELS.UNKNOWN,
        usageRatio: this.usageRatio, lowSpace: false, warning: null,
      };
    }
    return {
      ok: true, level: HEALTH_LEVELS.OK, spaceLevel: SPACE_LEVELS.HEALTHY,
      usageRatio: this.usageRatio, lowSpace: false, warning: null,
    };
  }

  /**
   * PUBLIC — REPORT a QuotaExceededError from a write. Turns
   * "storage silently fails" into a REAL state change: the error is
   * recorded, health degrades to LOW, the estimate refreshes (usage
   * may have jumped with the failed write), and subscribers are
   * notified. Writers call this from their catch when
   * isQuotaError(err) is true (or use getWriteStatus() pre-write to
   * avoid the failure entirely). Returns the fresh write status.
   */
  async handleQuotaFailure(err) {
    const message = err?.message || 'quota exceeded';
    this.lastError = message;
    recordError(message);
    this.health = this.available ? HEALTH_LEVELS.LOW : HEALTH_LEVELS.BLOCKED;
    // Intentional two-phase update: NOTIFY NOW with the error + degraded
    // health (immediate signal — subscribers must not wait on the
    // estimate round-trip), THEN refresh the estimate to reconcile the
    // numbers (the refresh re-notifies with the REAL usage/quota). The
    // error also survives in the diagnostics errorLog; on a successful
    // refresh lastError is cleared ("health and lastError must never
    // disagree") — the low-space warning is carried by health itself.
    this._notify();
    await this._refreshAsync();
    return this.getWriteStatus();
  }

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /** Current immutable-ish snapshot for consumers. */
  getState() {
    // One snapshot of the Root Folder Manager — read once, used for
    // every userStorage fact below (no repeated getState() calls).
    const uf = rootFolderManager.getState();
    return {
      // ── Detection ───────────────────────────────────────────────
      // The granular storage capability map (“what does this
      // environment support?”): platform · fileSystemAccess
      // (directory/open/save pickers · handleMove · handlePersistence)
      // · storage (backends + quota/persistence APIs). Re-evaluated on
      // initialize().
      capabilities: this.capabilities,
      // Every backend that exists in this browser (bool map, derived
      // from capabilities — one detection source of truth).
      backends: { ...this.backends },
      // The primary KV backend actually in use (store.* chain).
      backend: this.backend,
      // The primary FILE backend actually in use (files.* chain).
      fileBackend: this.fileBackend,
      // True when at least one usable backend exists.
      available: this.available === true,
      // True once the STARTUP SEQUENCE completed (sync detection + the
      // first async pass settled — success or failure). The UI can
      // distinguish "storage still initializing" from "storage ready":
      // before this flips, health/usage are pre-init placeholders.
      ready: this.ready === true,
      // ── Quota / persistence ─────────────────────────────────────
      // Bytes used / available (navigator.storage.estimate()).
      usage: this.usage,
      quota: this.quota,
      // usage / quota (0 when quota unknown).
      usageRatio: this.usageRatio,
      // Is the origin's storage persisted (protected from eviction)?
      persisted: this.persisted === true,
      // ── Health ──────────────────────────────────────────────────
      // 'ok' | 'warning' | 'low' | 'blocked' | 'unknown'.
      health: this.health,
      // The SPACE vocabulary ('healthy' | 'warning' | 'critical' |
      // 'unknown' | null for blocked/degraded) — ratio-derived from
      // the browser-reported quota, NEVER an absolute GB number.
      spaceLevel: spaceLevelFor(this.health),
      // Last storage error message (null when clean).
      lastError: this.lastError,
      // Recent storage errors (diagnostics, capped at 5).
      errors: [...errorLog],
      // ── PRIVATE STORAGE group (the state model: StorageState.
      //    privateStorage) ────────────────────────────────────────
      // The nested PRIVATE-APP-STORAGE snapshot — one object for the
      // "private side" of the state model. The flat fields above stay
      // (legacy — App Controller + existing consumers read them); new
      // consumers read this group. NEVER includes user storage.
      privateStorage: {
        available: this.available === true,
        backend: this.backend,
        fileBackend: this.fileBackend,
        usage: this.usage,
        quota: this.quota,
        usageRatio: this.usageRatio,
        persisted: this.persisted === true,
        health: this.health,
        spaceLevel: spaceLevelFor(this.health),
        lastError: this.lastError,
      },
      // ── User storage (principle B — user-selected root folder) ──
      // Composed from the Root Folder Manager snapshot above. The
      // snapshot is METADATA ONLY — the FileSystemDirectoryHandle
      // itself NEVER leaves the Storage subsystem (it is a KEY that
      // unlocks the user's folder). Consumers that need to operate on
      // the folder call Storage Manager methods (getSubfolder / Faz
      // B.2 fileOperations), which use the handle internally.
      userStorage: {
        available: uf.available === true,
        // True once the STARTUP RESTORE completed (handle found /
        // nothing to restore / restore failed) — the user-storage
        // facts below are FINAL for this session (a foreground
        // revalidate() may still update them later).
        ready: uf.ready === true,
        // Canonical: is a root folder connected right now?
        rootFolderConnected: uf.rootFolderConnected === true,
        // The root folder's display name (null when disconnected).
        rootName: uf.rootName || null,
        // 'granted' | 'prompt' | 'denied' | 'revoked' | 'disconnected' |
        // 'unsupported' | 'none'.
        permissionState: uf.permissionState,
        // The granted access mode: 'read' | 'readwrite' (MINIMUM-
        // ACCESS — browse connects read-only; write is granted lazily
        // via requestWriteAccess()).
        accessMode: uf.accessMode || null,
        // Epoch ms of the last permission validation (null = never).
        lastValidated: uf.lastValidated || null,
        // Is the connected root ACTUALLY accessible right now? The
        // permission grant can survive a deleted/moved folder — this
        // probe tells the truth. Honest tri-state: true (accessible) ·
        // false (gone — deleted/moved) · null (not connected/unknown).
        accessible: uf.accessible,
        // The UI-facing combined fact (permission × accessibility):
        // 'healthy' | 'inaccessible' | 'needs-approval' | 'revoked' |
        // 'disconnected' | 'none' | 'unsupported'. The UI shows
        // "Connected ✓" ONLY when this is 'healthy'.
        rootStatus: uf.rootStatus,
        // The 9-state UI STATE MACHINE (USER_STORAGE_STATUSES): what
        // the UI should SHOW / OFFER right now — complementary to
        // rootStatus: rootStatus says "is the connection healthy";
        // status says the ACCESS LEVEL ('read-only' / 'read-write'),
        // the ACTION needed ('permission-required'), or the BROKEN
        // state ('error' — granted but the folder is gone).
        status: userStorageStatusFor({
          permission: uf.permissionState,
          mode: uf.accessMode,
          accessible: uf.accessible,
          error: uf.error,
        }),
        // Can the user READ from the connected root right now?
        // (granted + CONFIRMED accessible — a read-only root reads, a
        // readwrite root reads.) true | false.
        readable: uf.permissionState === STORAGE_PERMISSIONS.GRANTED
          && uf.accessible === true,
        // Can the user WRITE to the connected root right now?
        // (readable + a READWRITE grant — MINIMUM-ACCESS: browse
        // connects read-only, write is granted lazily.) true | false.
        writable: uf.permissionState === STORAGE_PERMISSIONS.GRANTED
          && uf.accessible === true
          && uf.accessMode === ACCESS_MODES.READWRITE,
        // Legacy aliases (byte-compat for existing consumers).
        connected: uf.connected === true,
        permission: uf.permission,
      },
      // ── Storage Health AGGREGATE (the Settings/Storage UI renders
      //    THIS directly — one object, a real status) ──────────────
      // Combines the private core (availability + quota + health +
      // last error) with the optional user root (connected + status +
      // user-side error, e.g. 'permission-revoked').
      // Level is CORE-FIRST: a missing user folder never blocks or
      // degrades the app; a CONNECTED-AND-BROKEN folder (inaccessible /
      // needs-approval) surfaces as 'degraded'. See
      // storageHealth.computeHealthSnapshot for the derivation.
      storageHealth: computeHealthSnapshot({
        available: this.available === true,
        backend: this.backend,
        quota: this.quota,
        usage: this.usage,
        usageRatio: this.usageRatio,
        health: this.health,
        lastError: this.lastError,
        userConnected: uf.rootFolderConnected === true,
        userStatus: uf.rootStatus,
        userPermission: uf.permissionState,
        userAccessible: uf.accessible,
        userError: uf.error,
      }),
    };
  }

  /**
   * PUBLIC — FULL TEARDOWN (tests / HMR): release all subscribers and
   * reset the machine to the honest pre-init state. After destroy(),
   * ``init()`` re-wires everything for a fresh lifecycle. Idempotent.
   */
  destroy() {
    // Bump the epoch FIRST so any in-flight async refresh from this
    // lifecycle becomes stale and drops itself (see _refreshAsync).
    this._epoch += 1;
    this.capabilities = null;
    this.backends = {};
    this.backend = STORAGE_BACKENDS.NONE;
    this.fileBackend = STORAGE_BACKENDS.NONE;
    this.available = false;
    this.quota = 0;
    this.usage = 0;
    this.usageRatio = 0;
    this.persisted = false;
    this.health = HEALTH_LEVELS.UNKNOWN;
    this.ready = false;
    this.lastError = null;
    if (this._onVisibility) {
      document.removeEventListener('visibilitychange', this._onVisibility);
      this._onVisibility = null;
    }
    this._inited = false;
    this._listeners.clear();
    // The module-level error log belongs to the storage subsystem —
    // teardown resets it so getState().errors is honest post-destroy.
    clearErrors();
    return this;
  }

  _notify() {
    this._listeners.forEach((fn) => {
      try {
        fn(this.getState());
      } catch (_) { /* a bad listener must not break the machine */ }
    });
  }
}

/**
 * Process-wide singleton. init() runs at import on the client and
 * kicks off the async pipeline (quota + persistence + health).
 */
export const storageManager = new StorageManager();
if (typeof window !== 'undefined') {
  storageManager.init();
}

// The KV + blob data API — the migrated backend objects (identical
// shapes to the former storageEngine, which was retired with the §6.3
// consumer migration). Consumers import them from HERE (or from the
// Storage Manager default export), never from a shim.
export { store, files };

// Re-exported helper for consumers that need to clear the error log.
export { clearErrors as clearStorageErrors };

export default storageManager;
