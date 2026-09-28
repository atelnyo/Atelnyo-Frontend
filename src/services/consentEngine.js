/**
 * consentEngine.js — Intelligent User Consent System.
 *
 * A persistent consent registry that tracks acceptance of the Terms of
 * Service and Privacy Policy. Version-aware — when the platform updates
 * either document, users must re-consent.
 *
 * Design principles (from the spec):
 *   1. Never force — "Continue without advanced features" always available.
 *   2. Transparent — explains what, why, what data, what happens if refused.
 *   3. Persistent — consent is stored in the Storage Manager's
 *      private CACHE domain (private:cache:consent; legacy flat key
 *      'user_consent' stays read-compat via LEGACY_ALIASES).
 *   4. Versioned — bump CONSENT_VERSION when ToS/Privacy text changes.
 *
 * API:
 *   consentEngine.hasConsented()          → boolean
 *   consentEngine.grantAll()              → persist consent
 *   consentEngine.revoke()                → clear consent
 *   consentEngine.status()                → { consented, version, grantedAt }
 *   consentEngine.requiresReconsent()     → true if version bumped
 *
 * Usage:
 *   import consentEngine from '../services/consentEngine';
 *   if (!consentEngine.hasConsented()) {
 *     // show ConsentGate
 *   }
 */
import privateStorage from '../pwa/storage/privateStorage';
import { PRIVATE_DOMAINS } from '../pwa/storage/storageTypes';

// The CACHE domain key (private:cache:consent; legacy flat key
// 'user_consent' read-compat via LEGACY_ALIASES).
const CONSENT_KEY = 'consent';
const CONSENT_DOMAIN = PRIVATE_DOMAINS.CACHE;
const CONSENT_VERSION = 1;  // Bump when ToS or Privacy Policy changes

/** @type {{ consented: boolean, version: number, grantedAt: string|null }} */
let _state = null;
let _loaded = false;

async function _load() {
  if (_loaded) return;
  try {
    const raw = await privateStorage.get(CONSENT_DOMAIN, CONSENT_KEY);
    _state = raw && typeof raw === 'object' ? {
      consented: !!raw.consented,
      version: raw.version || 0,
      grantedAt: raw.grantedAt || null,
    } : { consented: false, version: 0, grantedAt: null };
  } catch (_) {
    _state = { consented: false, version: 0, grantedAt: null };
  }
  _loaded = true;
}

async function _save() {
  try { await privateStorage.set(CONSENT_DOMAIN, CONSENT_KEY, _state); } catch (_) {}
}

// ─── Public API ────────────────────────────────────────────────────

const consentEngine = {
  /** True when user has consented to the CURRENT version of ToS + Privacy. */
  async hasConsented() {
    await _load();
    return _state.consented && _state.version >= CONSENT_VERSION;
  },

  /** True when user consented to an OLDER version and must re-accept. */
  async requiresReconsent() {
    await _load();
    return _state.consented && _state.version < CONSENT_VERSION;
  },

  /** Record full consent (all policy docs + features). */
  async grantAll() {
    await _load();
    _state = {
      consented: true,
      version: CONSENT_VERSION,
      grantedAt: new Date().toISOString(),
    };
    await _save();
  },

  /** Revoke consent entirely. User returns to ConsentGate. */
  async revoke() {
    await _load();
    _state = { consented: false, version: 0, grantedAt: null };
    await _save();
  },

  /** Return the current consent status for display. */
  async status() {
    await _load();
    return {
      consented: _state.consented && _state.version >= CONSENT_VERSION,
      version: _state.version,
      currentVersion: CONSENT_VERSION,
      grantedAt: _state.grantedAt,
      requiresReconsent: _state.consented && _state.version < CONSENT_VERSION,
    };
  },
};

export default consentEngine;
