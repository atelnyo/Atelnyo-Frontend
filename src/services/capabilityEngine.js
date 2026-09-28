/**
 * capabilityEngine.js — Smart Capability Discovery Engine.
 *
 * Runs at startup (imported by main.jsx) to analyse the browser, OS,
 * PWA installation state, available Web APIs, storage capacity, and
 * network quality. Exports a frozen CapabilityProfile that every
 * component / hook can import to adapt behaviour automatically.
 *
 * Usage:
 *   import { capabilities } from '../services/capabilityEngine';
 *   if (!capabilities.indexedDB) { /* fallback path *\/ }
 *
 * The profile is built ONCE at module-load time (synchronous where
 * possible; async estimates like storage quota are filled later in
 * the bootstrap phase via ``capabilities.refreshStorage()``).
 *
 * Adaptive flags (consumers should branch on these):
 *   • isLowEnd          — < 4 GB RAM OR < 4 CPU cores OR saveData
 *   • isInstalled       — display-mode: standalone or fullscreen
 *   • canOffline        — IndexedDB + SW + BackgroundSync all available
 *   • canBiometrics     — WebAuthn with platform authenticator
 *   • canAdvancedMedia  — OPFS + >= 4 GB device storage quota
 */
// Installation Detection abstraction — isStandalone / isInstalled /
// displayMode come from installationManager (primary display-mode
// query + platform fallbacks), never sniffed here directly.
// (No storage dependency: the capability profile is built in-memory;
// the legacy storageEngine import was removed with §6.3 — it was dead.)
import installationManager from '../pwa/installation/InstallationManager';
import { DISPLAY_MODES } from '../pwa/installation/installationTypes';

// ═══════════════════════════════════════════════════════════════════
// 1. Synchronous detection (available at module load)
// ═══════════════════════════════════════════════════════════════════

/** Frozen capability profile — NEVER assign to individual keys. */
const _cap = {};

// ── Web APIs ────────────────────────────────────────────────────
_cap.indexedDB       = typeof indexedDB !== 'undefined';
_cap.cacheAPI        = typeof caches !== 'undefined';
_cap.webSocket       = typeof WebSocket !== 'undefined';
_cap.webAuthn        = !!window.PublicKeyCredential;
_cap.opfs            = typeof navigator?.storage?.getDirectory === 'function';
_cap.backgroundSync  = 'serviceWorker' in navigator && 'SyncManager' in window;
_cap.geolocation     = 'geolocation' in navigator;
_cap.clipboard       = typeof navigator?.clipboard?.writeText === 'function';
_cap.share           = typeof navigator?.share === 'function';
_cap.vibration       = typeof navigator?.vibrate === 'function';
_cap.fullscreen      = !!document.fullscreenEnabled;
_cap.wakeLock        = 'wakeLock' in navigator;
_cap.badging         = 'setAppBadge' in navigator;
_cap.viewTransition  = !!document.startViewTransition;
_cap.orientationAPI  = typeof screen?.orientation?.lock === 'function';
_cap.fileSystemAccess = typeof window !== 'undefined' && ('showOpenFilePicker' in window || 'showSaveFilePicker' in window);

// ── Device / Hardware ──────────────────────────────────────────
_cap.deviceMemory       = navigator.deviceMemory || 4;
_cap.hardwareConcurrency = navigator.hardwareConcurrency || 4;
_cap.maxTouchPoints     = navigator.maxTouchPoints || 0;
_cap.language           = navigator.language || 'ht';
_cap.userAgent          = navigator.userAgent;

// ── Platform flags ─────────────────────────────────────────────
_cap.saveData      = navigator.connection?.saveData === true;
_cap.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
_cap.darkMode      = window.matchMedia('(prefers-color-scheme: dark)').matches;
// Installation state via the manager's abstraction (covers standalone /
// minimal-ui / fullscreen / window-controls-overlay + platform fallbacks).
_cap.isStandalone  = installationManager.isStandalone();
_cap.isFullscreen  = installationManager.getState().displayMode === DISPLAY_MODES.FULLSCREEN;
_cap.isInstalled   = installationManager.isInstalled();
_cap.isMobile      = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

// ── Adaptive flags (derived) ───────────────────────────────────
_cap.isLowEnd          = _cap.deviceMemory < 4 || _cap.hardwareConcurrency < 4 || _cap.saveData;
_cap.canOffline        = _cap.indexedDB && _cap.backgroundSync;
_cap.canBiometrics     = false; // filled async by checkWebAuthnPlatform()
_cap.canAdvancedMedia  = false; // filled async after storage estimation

// ── Network quality ──────────────────────────────────────────
_cap.effectiveType     = navigator.connection?.effectiveType || 'unknown';
_cap.downlink           = navigator.connection?.downlink || null;   // Mbps
_cap.rtt                = navigator.connection?.rtt || null;         // ms

// ── Storage estimate (filled async) ────────────────────────────
_cap.storageQuota  = null;
_cap.storageUsage  = null;

/**
 * Refresh async storage estimate. Call once during bootstrap.
 * Idempotent — subsequent calls are no-ops.
 */
let _storageLoaded = false;
async function refreshStorage() {
  if (_storageLoaded) return;
  _storageLoaded = true;
  try {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      _cap.storageQuota = e.quota ?? 0;
      _cap.storageUsage = e.usage ?? 0;
      // Re-compute adaptive flag
      _cap.canAdvancedMedia = _cap.opfs && _cap.storageQuota >= 4 * 1024 * 1024 * 1024;
    }
  } catch (_) {}
}

/**
 * Check WebAuthn platform authenticator availability.
 * Async — result cached. Call once at startup.
 */
let _webAuthnPlatformChecked = false;
async function checkWebAuthnPlatform() {
  if (_webAuthnPlatformChecked) return;
  _webAuthnPlatformChecked = true;
  try {
    if (window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) {
      _cap.canBiometrics = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
  } catch (_) {}
}

// ── Export (NOT frozen — async bootstrap functions mutate _cap) ──
// The profile is shared by reference so components see live updates
// after refreshStorage / checkWebAuthnPlatform populate the async
// fields. Consumers should treat it as read-only.
const capabilities = _cap;

export { capabilities, refreshStorage, checkWebAuthnPlatform };

/**
 * Default export for import simplicity:
 *   import capabilityEngine from './capabilityEngine';
 *   capabilityEngine.get('indexedDB')
 */
export default {
  /** Return a single capability value (or null if unknown). */
  get(name) { return name in _cap ? _cap[name] : null; },

  /** Return a frozen copy of the full profile. */
  profile() { return capabilities; },

  /** Refresh async estimates. Safe to call multiple times. */
  refresh: refreshStorage,

  /** Check WebAuthn platform auth. */
  checkBiometrics: checkWebAuthnPlatform,

  /**
   * Log the profile to the console (dev only) in a compact table.
   * Call from main.jsx bootstrap if import.meta.env.DEV.
   */
  logProfile() {
    if (!import.meta.env?.DEV) return;
    const { indexedDB, cacheAPI, webAuthn, opfs, backgroundSync, geolocation,
            clipboard, wakeLock, badging, viewTransition, fileSystemAccess,
            isLowEnd, isInstalled, canOffline, canBiometrics, canAdvancedMedia,
            deviceMemory, hardwareConcurrency, maxTouchPoints, saveData,
            reducedMotion, darkMode, isMobile, storageQuota, storageUsage } = _cap;
    // eslint-disable-next-line no-console
    console.groupCollapsed('[Atelnyo] Capability Profile');
    // eslint-disable-next-line no-console
    console.table({
      indexedDB, cacheAPI, webAuthn, opfs, backgroundSync, geolocation,
      clipboard, wakeLock, badging, viewTransition, fileSystemAccess,
      isLowEnd, isInstalled, canOffline, canBiometrics, canAdvancedMedia,
      deviceMemory: `${deviceMemory} GB`, hardwareConcurrency: `${hardwareConcurrency} cores`,
      maxTouchPoints, saveData, reducedMotion, darkMode, isMobile,
      storageQuota: storageQuota ? `${(storageQuota / 1e9).toFixed(1)} GB` : 'pending',
      storageUsage: storageUsage ? `${(storageUsage / 1e6).toFixed(1)} MB` : 'pending',
    });
    // eslint-disable-next-line no-console
    console.groupEnd();
  },
};
