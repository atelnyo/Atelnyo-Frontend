/**
 * src/pwa/app/AppController.js
 *
 * APP CONTROLLER — answers “Ki jan app la ap kouri kounye a?” (how is
 * the app running RIGHT NOW?). It is the INTEGRATION layer of the PWA
 * System — it COMPOSES the other subsystems without re-implementing
 * any of their logic:
 *
 *   PWA System
 *   ├── Manifest              → app identity (public/manifest.json)
 *   ├── Service Worker        → offline / caching / app shell (sw.js)
 *   ├── Installation Manager  → “Kijan app la enstale?” — install
 *   │                            state machine, capability, prompt,
 *   │                            browser fallback (pwa/installation/)
 *   ├── Continuity Manager    → “Kijan app la kontinye kote li te
 *   │                            sispann?” — launch context, last-
 *   │                            active clock, return-to-app signals
 *   │                            (pwa/continuity/)
 *   ├── Storage Manager       → “Ki kote app la ka mete fichye li
 *   │                            yo?” — backend availability, health,
 *   │                            quota, persistence (pwa/storage/)
 *   └── App Controller        → THIS MODULE — “Ki jan app la ap kouri
 *                                kounye a?” — composes the subsystems
 *                                for the UI.
 *
 * ⚠️ SEPARATION OF CONCERNS — no duplicated logic:
 *   • Installation Manager OWNS how the app is installed. The App
 *     Controller READS it (getState()/subscribe) and never re-derives
 *     installability, never sniffs display-mode, never re-detects.
 *   • Continuity Manager OWNS how the session continues (launch
 *     context, last-active clock, return-to-app). The App Controller
 *     READS it and never re-implements launch counting or staleness.
 *   • Storage Manager OWNS storage availability / health / quota /
 *     persistence. The App Controller READS it and never re-derives
 *     the primary backend or health in a component.
 *   • The Service Worker (via updateEngine) OWNS update detection. The
 *     App Controller listens to its dispatched events once and exposes
 *     the derived runtime facts.
 *   • If a feature needs install-state or prompts → Installation
 *     Manager. If it needs session continuity → Continuity Manager.
 *     If it needs storage facts → Storage Manager. If it needs SW
 *     control or caching → sw.js / updateEngine. If it needs “how is
 *     the app running right now?” → THIS module.
 *
 * Runtime facts exposed (getRuntime()):
 *   runningInStandalone — this session is an installed-app window
 *   installed           — the app is on this device (IM abstraction)
 *   version             — the running SW/build version (updateEngine)
 *   updateAvailable     — a new version is waiting to be activated
 *   manifestId          — the stable manifest identity (IM)
 *   launchType          — 'first' | 'return' (Continuity Manager)
 *   isRelaunch          — RETURN launch (restore point may exist)
 *   sessionStatus       — 'active' | 'stale' | 'unknown'
 *   staleSession        — the user was away too long (re-validate)
 *   lastActiveAt        — epoch ms of the last user interaction
 *   returned            — the app just came back to the foreground
 *   storage             — { backend, available, health, quota, usage,
 *                          persisted } (Storage Manager)
 *   storageReady        — true once the STARTUP SEQUENCE completed
 *                         (sync detection + the first async pass
 *                         settled — success or failure). Before it
 *                         flips, health/usage are pre-init placeholders
 *   userStorageReady    — true once the STARTUP RESTORE of the saved
 *                         root handle completed (found / nothing to
 *                         restore / failed) — userStorage facts are
 *                         then final for the session
 *   storageCapabilities — the granular capability map (“what does
 *                          this environment support?”) — platform
 *                          primitives · File System Access family
 *                          (directory/open/save pickers · handle.move ·
 *                          handle persistence) · private backends +
 *                          quota/persistence APIs. NEVER one boolean.
 *   userStorageAvailable — FSA directory picker support
 *   userStorageConnected — a user-selected root folder is connected
 *   userStoragePermission— 'granted' | 'prompt' | 'denied' |
 *                           'revoked' | 'disconnected' | 'unsupported' |
 *                           'none' (the full permission model — never
 *                           a boolean; revalidated on every boot)
 *   userStorageAccessMode— 'read' | 'readwrite' | null (MINIMUM-
 *                           ACCESS: browse connects read-only; write
 *                           granted lazily via requestRootWriteAccess)
 *   userStorageLastValidated — epoch ms of the last permission check
 *                              (null = never validated)
 *   userStorageStatus   — the UI-facing combined fact: 'healthy' |
 *                         'inaccessible' | 'needs-approval' |
 *                         'revoked' | 'disconnected' | 'none' |
 *                         'unsupported'. The UI shows "Connected ✓"
 *                         ONLY on 'healthy' — a granted permission
 *                         with a gone folder must not render as
 *                         connected (folder-disappears edge case).
 *   userStorageAccessStatus — the 9-state UI STATE MACHINE
 *                         (USER_STORAGE_STATUSES): what the UI should
 *                         SHOW — 'not-connected' | 'connected' |
 *                         'permission-required' | 'read-only' |
 *                         'read-write' | 'revoked' | 'disconnected' |
 *                         'unavailable' | 'error'. Complementary to
 *                         userStorageStatus (permission ×
 *                         accessibility): this one carries the ACCESS
 *                         LEVEL + the ACTION needed.
 *   userStorageReadable  — can the user READ from the connected root
 *                          right now? (granted + confirmed accessible)
 *   userStorageWritable  — can the user WRITE to the connected root
 *                          right now? (readable + readwrite grant —
 *                          minimum access: browse connects read-only)
 *   userStorageAccessible — is the connected root actually reachable
 *                           right now (true | false | null)
 *   storageHealthSnapshot — the AGGREGATE the Settings/Storage UI
 *                           renders directly: { level, privateStorage,
 *                           userStorage, quota, lastError } — level is
 *                           core-first ('ok' | 'degraded' | 'warning' |
 *                           'low' | 'blocked' | 'unknown')
 *
 * Consumers subscribe via subscribe(cb) — the same reactive contract
 * the Installation Manager uses.
 */
import installationManager from '../installation/InstallationManager.js';
import continuityManager from '../continuity/ContinuityManager.js';
import storageManager from '../storage/StorageManager.js';

const VERSION_STORAGE_KEY = 'atelnyo_sw_version';

// ─── Internal state ────────────────────────────────────────────────
let _version = null;
let _waitingWorker = null;
let _updateAvailable = false;
let _listeners = new Set();
let _wired = false;

function _readSavedVersion() {
  try {
    return window.localStorage.getItem(VERSION_STORAGE_KEY);
  } catch (_) {
    return null;
  }
}

/**
 * Snapshot of the current runtime facts — derived ONLY from the
 * subsystems (Installation Manager + SW update events), never from
 * duplicated detection logic.
 */
export function getRuntime() {
  const im = installationManager.getState();
  const ct = continuityManager.getState();
  const st = storageManager.getState();
  return {
    // This session is running in an installed-app WINDOW — ANY app
    // display-mode (standalone is the primary, but minimal-ui /
    // fullscreen / window-controls-overlay are also installed-app
    // windows) — from the Installation Manager, NOT re-detected.
    // (Named ``runningInStandalone`` per the App Controller contract;
    // the value is the broader isAppWindow answer so a minimal-ui or
    // window-controls-overlay session is also reported as "running as
    // an app". Use getState().standalone for the STRICT standalone
    // display-mode when that precision is needed.)
    runningInStandalone: im.standalone === true || im.isAppWindow === true,
    // The app is installed on this device — the IM public abstraction
    // (standalone launch OR persisted startup marker).
    installed: installationManager.isInstalled(),
    // The running SW/build version — from the SW update engine.
    version: _version,
    // A new version is downloaded and waiting to be activated.
    updateAvailable: _updateAvailable === true,
    // The stable Web App Manifest identity — from the Installation
    // Manager (manifest.id, resolved per spec).
    manifestId: im.manifestId || null,
    // ── Session continuity — from the Continuity Manager ──────────
    // 'first' (never ran on this device) vs 'return' (has run before —
    // a restore point may exist in appStateStore).
    launchType: ct.launchType,
    // True on a RETURN launch (the app has run on this device before).
    isRelaunch: ct.launchType === 'return',
    // 'active' | 'stale' | 'unknown' — derived from the last-active
    // clock vs CONTINUITY_POLICY.staleAfterMs.
    sessionStatus: ct.sessionStatus,
    // True when the session is STALE (user away too long) — the UI
    // should re-validate the auth session before continuing.
    staleSession: ct.sessionStatus === 'stale',
    // Epoch ms of the last recorded user interaction (null = none).
    lastActiveAt: ct.lastActiveAt,
    // True right after a hidden→visible return (gap ≥ threshold) —
    // the UI may re-validate the session on this signal.
    returned: ct.returned === true,
    // ── Storage — from the Storage Manager ────────────────────────
    // The primary KV backend actually in use ('indexeddb' | 'opfs' |
    // 'localstorage' | 'none').
    storageBackend: st.backend,
    // True once the STARTUP SEQUENCE completed — the UI distinguishes
    // "storage still initializing" (health/usage are pre-init
    // placeholders) from "storage ready" (the facts are honest for
    // this session). Never implies everything works.
    storageReady: st.ready === true,
    // True when at least one usable backend exists.
    storageAvailable: st.available === true,
    // 'ok' | 'warning' | 'low' | 'blocked' | 'unknown' — derived from
    // availability + quota pressure (storageHealth).
    storageHealth: st.health,
    // Bytes used / available (navigator.storage.estimate()).
    storageUsage: st.usage,
    storageQuota: st.quota,
    // Is the origin's storage persisted (protected from eviction)?
    storagePersisted: st.persisted === true,
    // The granular storage capability map — what this environment
    // supports per capability (platform · fileSystemAccess · storage).
    // Branch on the specific key (e.g. capabilities.fileSystemAccess
    // .directoryPicker), never on one aggregated boolean.
    storageCapabilities: st.capabilities,
    // ── User storage (principle B) — from the Storage Manager's
    //    composed userStorage facts (canonical vocabulary:
    //    rootFolderConnected · permissionState · lastValidated).
    userStorageAvailable: st.userStorage.available === true,
    // True once the STARTUP RESTORE of the saved root handle completed
    // (found / nothing to restore / failed) — the userStorage facts
    // below are then FINAL for this session (a foreground revalidate()
    // may still update them later).
    userStorageReady: st.userStorage.ready === true,
    userStorageConnected: st.userStorage.rootFolderConnected === true,
    userStoragePermission: st.userStorage.permissionState,
    // The granted access mode ('read' | 'readwrite' | null) — lets
    // the UI offer the "grant write access" upgrade only when the
    // current mode is read-only and the user triggers a write action
    // (Export project), instead of requesting write upfront.
    userStorageAccessMode: st.userStorage.accessMode || null,
    // Epoch ms of the last time the root folder's permission was
    // validated (null = never — e.g. not connected). Lets the UI
    // decide when a re-validation is due (e.g. a "Re-apwouve" prompt
    // when the state is stale or the permission reads 'prompt').
    userStorageLastValidated: st.userStorage.lastValidated || null,
    // The UI-facing combined fact (permission × accessibility): the
    // UI shows "Connected ✓" ONLY on 'healthy' — a granted permission
    // with a deleted/moved folder reads 'inaccessible', never
    // 'connected'. Re-validated at boot, on every foreground return,
    // and on demand via storageManager.revalidateRootFolder().
    userStorageStatus: st.userStorage.rootStatus,
    // The 9-state UI STATE MACHINE (USER_STORAGE_STATUSES): what the
    // UI should SHOW / OFFER — complementary to userStorageStatus
    // (which is permission × accessibility). This one carries the
    // ACCESS LEVEL ('read-only' / 'read-write'), the ACTION needed
    // ('permission-required' → "Re-apwouve"), or the broken state
    // ('error' — granted but the folder is gone).
    userStorageAccessStatus: st.userStorage.status,
    // Can the user READ from the connected root right now? (granted +
    // confirmed accessible — a read-only root reads, a readwrite root
    // reads.) Lets the UI disable read actions when unreadable.
    userStorageReadable: st.userStorage.readable === true,
    // Can the user WRITE to the connected root right now? (readable +
    // a readwrite grant — MINIMUM-ACCESS: browse connects read-only,
    // write is granted lazily via requestRootWriteAccess.) Lets the
    // UI offer the "grant write" upgrade exactly when writable is
    // false and a write action is triggered.
    userStorageWritable: st.userStorage.writable === true,
    // Is the connected root actually reachable right now (the
    // accessibility probe)? Honest tri-state: true (accessible) ·
    // false (gone — deleted/moved) · null (not connected/unknown).
    userStorageAccessible: st.userStorage.accessible,
    // The AGGREGATE storage health snapshot — the Settings/Storage UI
    // renders this one object directly (private core + user root +
    // quota + last error). Core-first level: a missing user folder
    // never blocks the app; a connected-but-broken folder degrades.
    storageHealthSnapshot: st.storageHealth,
  };
}

/** Subscribe to runtime changes. Returns an unsubscribe function. */
export function subscribe(listener) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

function _notify() {
  _listeners.forEach((fn) => {
    try {
      fn(getRuntime());
    } catch (_) { /* a bad listener must not break the controller */ }
  });
}

/**
 * Apply the waiting update: tell the SW to skip waiting, then reload.
 * Owned here (the waiting worker lives in this layer) so UI components
 * never touch SW plumbing directly.
 */
export function refresh() {
  if (_waitingWorker && typeof _waitingWorker.postMessage === 'function') {
    try {
      _waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } catch (_) { /* best-effort */ }
  }
  try {
    window.location.reload();
  } catch (_) { /* best-effort */ }
}

/**
 * Wire the controller to its subsystems ONCE (idempotent):
 *   • re-broadcast the current Installation Manager state into the
 *     runtime snapshot on every IM notification;
 *   • listen to the SW update engine's dispatched events
 *     (atelnyo:sw:update / :activated / :rollback).
 *
 * Called automatically at module load on the client; safe to call
 * again any time.
 */
export function init() {
  if (_wired || typeof window === 'undefined') return;
  _wired = true;

  // Initial version from the SW update engine's persisted slot.
  _version = _readSavedVersion();

  // 1. Installation Manager → re-emit its state as runtime facts.
  installationManager.subscribe(() => _notify());

  // 1b. Continuity Manager → re-emit session continuity facts.
  continuityManager.subscribe(() => _notify());

  // 1c. Storage Manager → re-emit storage availability/health facts.
  storageManager.subscribe(() => _notify());

  // 2. SW update engine events (dispatched by updateEngine.js AND by
  //    the inline registration script in index.html) → version +
  //    updateAvailable. The App Controller listens ONCE; every UI
  //    component consumes this layer instead of adding its own listener.
  const onSwUpdate = (e) => {
    if (e?.detail?.version) _version = e.detail.version;
    if (e?.detail?.waitingWorker) _waitingWorker = e.detail.waitingWorker;
    _updateAvailable = true;
    _notify();
  };
  const onSwActivated = (e) => {
    if (e?.detail?.version) _version = e.detail.version;
    _updateAvailable = false;
    _notify();
  };
  const onSwRollback = () => {
    _updateAvailable = false;
    _notify();
  };
  window.addEventListener('atelnyo:sw:update', onSwUpdate);
  window.addEventListener('atelnyo:sw:activated', onSwActivated);
  window.addEventListener('atelnyo:sw:rollback', onSwRollback);

  // First snapshot so subscribers always have facts immediately.
  _notify();
}

if (typeof window !== 'undefined') {
  init();
}

const appController = {
  getRuntime,
  subscribe,
  refresh,
  init,
};

export default appController;
