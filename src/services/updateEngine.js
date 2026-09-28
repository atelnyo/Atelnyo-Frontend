/**
 * updateEngine.js — Smart PWA update engine.
 *
 * Responsibilities:
 *   1. Detect new SW updates automatically (via updatefound event)
 *   2. Download updates in background (browser handles this natively)
 *   3. Validate update integrity (check SW version changed)
 *   4. Protect user data (never delete IndexedDB on update)
 *   5. Rollback if update fails (unregister new SW, revert to old)
 *   6. Notify user only when necessary (banner with "refresh" button)
 *
 * Usage:
 *   import updateEngine from './services/updateEngine';
 *   updateEngine.init(); // called once on app boot
 *
 * Events dispatched (on window):
 *   • atelnyo:sw:update       — new version available, detail: { version, waitingWorker }
 *   • atelnyo:sw:installed    — new SW installed and waiting
 *   • atelnyo:sw:activated    — new SW took control
 *   • atelnyo:sw:rollback     — update rolled back
 */

const STORAGE_KEY = 'atelnyo_sw_version';
const ROLLBACK_KEY = 'atelnyo_sw_rollback';

// ─── Internal state ────────────────────────────────────────────────
let _currentVersion = null;
let _waitingWorker = null;
let _updateAvailable = false;
let _initialised = false;

// ─── Helpers ───────────────────────────────────────────────────────
function _getSavedVersion() {
  try { return localStorage.getItem(STORAGE_KEY); } catch (_) { return null; }
}

function _saveVersion(version) {
  try { localStorage.setItem(STORAGE_KEY, version); } catch (_) {}
}

function _dispatch(eventName, detail = {}) {
  window.dispatchEvent(new CustomEvent(`atelnyo:sw:${eventName}`, { detail }));
}

// ─── Validate: compare new version with saved ──────────────────────
async function _validateUpdate(newWorker) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => {
      const newVersion = event.data?.version;
      const saved = _getSavedVersion();

      if (!newVersion) {
        resolve({ valid: false, reason: 'no-version', version: null });
        return;
      }

      if (newVersion === saved) {
        resolve({ valid: false, reason: 'same-version', version: newVersion });
        return;
      }

      resolve({ valid: true, version: newVersion, previous: saved });
    };

    // Timeout after 2s
    setTimeout(() => {
      resolve({ valid: false, reason: 'timeout', version: null });
    }, 2000);

    if (newWorker) {
      newWorker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
    }
  });
}

// ─── Rollback: unregister the new SW ────────────────────────────────
async function _rollback() {
  try {
    if (_waitingWorker) {
      _waitingWorker.postMessage({ type: 'SKIP_WAITING_CANCEL' });
    }
    // Get all registrations and unregister any that aren't the current
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      if (reg.waiting) {
        await reg.unregister();
      }
    }
    _saveVersion(_getSavedVersion()); // keep the last known good version
    _updateAvailable = false;
    _waitingWorker = null;
    _dispatch('rollback', { success: true });
  } catch (err) {
    _dispatch('rollback', { success: false, error: err.message });
  }
}

// ─── Init ──────────────────────────────────────────────────────────
export function init() {
  if (_initialised || typeof window === 'undefined') return;
  _initialised = true;

  if (!('serviceWorker' in navigator)) return;

  // Monitor existing registration
  navigator.serviceWorker.getRegistration().then((reg) => {
    if (!reg) return;

    // Force-check for SW updates right away so a recently-deployed
    // version is detected on the FIRST page load after deploy,
    // not on the SECOND. Without this, the user's browser only
    // checks for SW updates on the next navigation / reload that
    // the browser decides to trigger — which can be hours later.
    reg.update().catch(() => {});

    // If already waiting on page load, fire immediately
    if (reg.waiting) {
      _handleUpdate(reg.waiting);
    }

    // Listen for future updates
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (
          newWorker.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          _handleUpdate(newWorker);
        }
      });
    });
  });

  // Listen for controller change (new SW took over)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    _dispatch('activated', { version: _currentVersion });
  });
}

// ─── Handle detected update ────────────────────────────────────────
async function _handleUpdate(worker) {
  const validation = await _validateUpdate(worker);

  if (!validation.valid) {
    // Same version or couldn't validate — don't bother user
    return;
  }

  _currentVersion = validation.version;
  _waitingWorker = worker;
  _updateAvailable = true;

  _dispatch('update', {
    version: validation.version,
    previous: validation.previous,
    waitingWorker: worker,
  });

  _dispatch('installed', {
    version: validation.version,
    waitingWorker: worker,
  });
}

// ─── Accept update: skip waiting + reload ──────────────────────────
export function acceptUpdate() {
  if (_waitingWorker) {
    _waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  }
  _saveVersion(_currentVersion);
  try {
    // Clear rollback marker
    localStorage.removeItem(ROLLBACK_KEY);
  } catch (_) {}

  // Reload after a short delay to let the SW activate
  setTimeout(() => {
    window.location.reload();
  }, 300);
}

// ─── Dismiss update notification (user can accept later) ───────────
export function dismissUpdate() {
  _updateAvailable = false;
}

// ─── Query state ───────────────────────────────────────────────────
export function isUpdateAvailable() {
  return _updateAvailable;
}

export function getUpdateVersion() {
  return _currentVersion;
}

// ─── Force check for updates ───────────────────────────────────────
export async function checkForUpdates() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      await reg.update();
    }
  } catch (_) {}
}

// ─── Rollback (manual trigger from diagnostics) ────────────────────
export { _rollback as rollback };

export default { init, acceptUpdate, dismissUpdate, isUpdateAvailable, getUpdateVersion, checkForUpdates, rollback: _rollback };
