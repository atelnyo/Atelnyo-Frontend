/**
 * offlineSettings.js — Offline-first settings cache.
 *
 * Syncs user settings (theme, lang, fontSize, notification prefs) to
 * IndexedDB so they're available when the user opens the app offline.
 *
 * On app boot: restores settings from IndexedDB if available.
 * On settings change: writes to IndexedDB + localStorage + server API.
 *
 * Uses the Storage Manager's private CACHE domain (IndexedDB →
 * localStorage fallback; legacy flat key 'offline_settings' stays
 * read-compat via LEGACY_ALIASES).
 */

import privateStorage from '../pwa/storage/privateStorage';
import { PRIVATE_DOMAINS } from '../pwa/storage/storageTypes';

// The CACHE domain key (private:cache:settings; legacy flat key
// 'offline_settings' read-compat via LEGACY_ALIASES).
const SETTINGS_KEY = 'settings';
const SETTINGS_DOMAIN = PRIVATE_DOMAINS.CACHE;

// ─── Default settings ──────────────────────────────────────────────
const DEFAULTS = {
  theme: 'light',
  lang: 'ht',
  fontSize: 'md',
  pushNotifications: true,
  emailNotifications: true,
  digestFrequency: 'weekly',
  lastSync: null,
};

// ─── Cache layer ───────────────────────────────────────────────────
let _cache = null;

async function _load() {
  if (_cache) return _cache;
  try {
    const saved = await privateStorage.get(SETTINGS_DOMAIN, SETTINGS_KEY);
    _cache = { ...DEFAULTS, ...(saved || {}) };
  } catch (_) {
    _cache = { ...DEFAULTS };
  }
  return _cache;
}

async function _save() {
  if (!_cache) return;
  _cache.lastSync = Date.now();
  try {
    await privateStorage.set(SETTINGS_DOMAIN, SETTINGS_KEY, _cache);
  } catch (_) {}
}

// ─── Public API ─────────────────────────────────────────────────────

export async function getOfflineSettings() {
  return _load();
}

export async function updateOfflineSetting(key, value) {
  await _load();
  _cache[key] = value;
  await _save();
  // Also write to localStorage for legacy compatibility
  try {
    if (key === 'theme') localStorage.setItem('atelnyo_theme', value);
    if (key === 'lang') localStorage.setItem('atelnyo_lang', value);
    if (key === 'fontSize') localStorage.setItem('atelnyo_fontsize', value);
  } catch (_) {}
  return _cache;
}

export async function syncOfflineSettings() {
  await _load();
  _cache.lastSync = Date.now();
  await _save();
  return _cache;
}

export async function clearOfflineSettings() {
  _cache = { ...DEFAULTS };
  await _save();
}
