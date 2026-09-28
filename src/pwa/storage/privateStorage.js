/**
 * src/pwa/storage/privateStorage.js
 *
 * PRIVATE APP STORAGE — the domain layer of the PWA Storage subsystem.
 *
 * FIRST PRINCIPLE: Atelnyo has TWO storages and never mixes them —
 *   A. PRIVATE APP STORAGE (this module) — storage Atelnyo CONTROLS
 *      for internal app functions. NEVER requires the user to choose
 *      a folder. Lives under the ``private:`` namespace (KV) or in
 *      the origin's own localStorage / OPFS space.
 *   B. USER STORAGE (Phase B/C) — storage the user CHOOSES (File
 *      System Access folder handles). Lives OUTSIDE this module, with
 *      different handles and permissions. Never interleaved.
 *
 * Each PRIVATE_DOMAINS domain maps to one category of internal data:
 *   session   → user session data — maps to the REAL auth localStorage
 *               keys (access_token / refresh_token / user) via
 *               SESSION_ALIASES. One source of truth.
 *   drafts    → unsaved form drafts
 *   offline   → offline request queue + sync state
 *   pending   → pending operations (retry ledger)
 *   metadata  → app metadata (tab, scroll, continuity, SW version)
 *   cache     → cached structured data (consent, offline settings)
 *   prefs     → user preferences — an EXPLICIT allowlist of atelnyo_*
 *               keys ONLY (see PREF_KEYS). Never touches install
 *               markers, continuity counters, SW version, media
 *               projects, or the device fingerprint.
 *   files     → internal files (OPFS / IndexedDB blob fallback)
 *
 * Namespacing + allowlists give three guarantees the old flat
 * kv-store lacked:
 *   1. DOMAIN BOUNDARIES — a bug in one category can never touch
 *      another; clear() is domain-scoped (prefs clear only wipes the
 *      allowlisted preference keys — never atelnyo_pwa_*,
 *      atelnyo_continuity_*, atelnyo_sw_version, atelnyo_media_*…).
 *   2. SELECTIVE CLEAR — ``clear('cache')`` wipes cached data only;
 *      drafts, offline queue and preferences survive.
 *   3. USER-STORAGE ISOLATION — everything here is under the private
 *      namespace / allowlists; user-chosen folder data (Phase B) is
 *      not.
 *
 * LEGACY ALIASES: data written before this layer existed used flat
 * keys ('offline_queue', 'app_state', 'user_consent',
 * 'offline_settings'). Reads fall back to those keys when the
 * namespaced key is empty, so pre-migration data is never orphaned.
 * Writes always go to the namespaced key. Legacy keys are NOT deleted
 * by the read fallback (a get() never writes); they are retired by
 * the explicit consumer-migration steps.
 *
 * All KV operations delegate to the storageBackends ``store`` object
 * (IndexedDB → localStorage fallback + AES-GCM encryption) — no
 * storage logic is duplicated here.
 */
import {
  PRIVATE_DOMAINS,
  PRIVATE_NAMESPACE,
  privateKey,
} from './storageTypes.js';
import {
  store,
  files,
} from './storageBackends.js';

/** Read-compat map: domain key → flat legacy key (pre-migration data). */
export const LEGACY_ALIASES = {
  offline: { queue: 'offline_queue' },
  metadata: { 'app-state': 'app_state' },
  cache: { consent: 'user_consent', settings: 'offline_settings' },
};

/**
 * Session domain → REAL auth localStorage keys. The auth layer
 * (api.js interceptor + useAuthStore) reads these exact keys, so the
 * session domain writes through the SAME keys — one source of truth,
 * never a shadow copy. Keys not in this map are not session data.
 */
const SESSION_ALIASES = {
  access: 'access_token',
  refresh: 'refresh_token',
  user: 'user',
};

/**
 * Prefs domain ALLOWLIST — the ONLY localStorage keys the prefs domain
 * may touch (without the atelnyo_ prefix). Deliberately excludes
 * non-preference state that happens to share the prefix:
 *   • install markers (atelnyo_pwa_installed / atelnyo_pwa_dismissed_at)
 *   • continuity counters (atelnyo_continuity_*)
 *   • SW version (atelnyo_sw_version)
 *   • media-project mappings (atelnyo_media_projects_v1)
 *   • device fingerprint (atelnyo_device_fp)
 *   • dismiss flags / feature toggles (atelnyo_cloudshell_hint_*,
 *     atelnyo_diaspora_toast_*, atelnyo_deie_feed,
 *     atelnyo_spotlight_unlocked, atelnyo_creator_apply_unlocked)
 * A preference is a user-editable setting, NOT system state — this
 * allowlist is what enforces that boundary.
 */
export const PREF_KEYS = new Set([
  'lang',
  'theme',
  'fontsize',
  'font_family',
  'theme_color',
  'ambient_fx',
  'card_style',
  'sonic_ui',
  'cyber_cursor',
  // Atelier creative settings (user-adjustable).
  'pulse_sleep',
  'pulse_caffeine',
  'friction',
  'typedna_phrase',
  'aura_signature',
]);

const KV_DOMAINS = new Set([
  PRIVATE_DOMAINS.SESSION,
  PRIVATE_DOMAINS.DRAFTS,
  PRIVATE_DOMAINS.OFFLINE,
  PRIVATE_DOMAINS.PENDING,
  PRIVATE_DOMAINS.METADATA,
  PRIVATE_DOMAINS.CACHE,
]);

const LS_PREFIX = 'atelnyo_';

function _assertDomain(domain) {
  if (!Object.values(PRIVATE_DOMAINS).includes(domain)) {
    throw new Error(`[privateStorage] unknown private domain: ${domain}`);
  }
}

// ─── KV domains (IndexedDB → localStorage fallback) ────────────────

async function _kvGet(domain, key) {
  const ns = privateKey(domain, key);
  const value = await store.get(ns);
  if (value !== null) return value;
  // Legacy alias read-compat: pre-migration data under flat keys.
  // Read-only — never writes, never deletes the legacy key here.
  const legacy = LEGACY_ALIASES[domain]?.[key];
  if (legacy) return store.get(legacy);
  return null;
}

async function _kvSet(domain, key, value) {
  await store.set(privateKey(domain, key), value);
}

async function _kvDelete(domain, key) {
  await store.delete(privateKey(domain, key));
}

async function _kvKeys(domain) {
  const prefix = `${PRIVATE_NAMESPACE}:${domain}:`;
  const all = await store.keys();
  return all.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
}

/** Wipe ONE KV domain's namespaced keys (never legacy, never user storage). */
async function _kvClear(domain) {
  const prefix = `${PRIVATE_NAMESPACE}:${domain}:`;
  const all = await store.keys();
  for (const k of all) {
    if (k.startsWith(prefix)) await store.delete(k);
  }
}

// ─── Session domain (real auth localStorage keys via SESSION_ALIASES) ─

function _sessionGet(key) {
  const real = SESSION_ALIASES[key];
  if (!real) return null;
  try { return window.localStorage.getItem(real); } catch (_) { return null; }
}

function _sessionSet(key, value) {
  const real = SESSION_ALIASES[key];
  if (!real) return;
  try { window.localStorage.setItem(real, value); } catch (_) {}
}

function _sessionDelete(key) {
  const real = SESSION_ALIASES[key];
  if (!real) return;
  try { window.localStorage.removeItem(real); } catch (_) {}
}

function _sessionKeys() {
  return Object.keys(SESSION_ALIASES);
}

function _sessionClear() {
  for (const real of Object.values(SESSION_ALIASES)) {
    try { window.localStorage.removeItem(real); } catch (_) {}
  }
}

// ─── Prefs domain (ALLOWLISTED atelnyo_* keys — one source of truth) ─

function _prefsGet(key) {
  if (!PREF_KEYS.has(key)) return null;
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + key);
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch (_) { return raw; }
  } catch (_) {
    return null;
  }
}

function _prefsSet(key, value) {
  if (!PREF_KEYS.has(key)) return;
  try {
    const toStore = typeof value === 'string' ? value : JSON.stringify(value);
    window.localStorage.setItem(LS_PREFIX + key, toStore);
  } catch (_) { /* storage disabled — preference not persisted */ }
}

function _prefsDelete(key) {
  if (!PREF_KEYS.has(key)) return;
  try { window.localStorage.removeItem(LS_PREFIX + key); } catch (_) {}
}

/** Keys of the prefs allowlist that are actually set. */
function _prefsKeys() {
  const out = [];
  for (const k of PREF_KEYS) {
    try {
      if (window.localStorage.getItem(LS_PREFIX + k) !== null) out.push(k);
    } catch (_) {}
  }
  return out;
}

/** Wipe ONLY the allowlisted preference keys — never system state. */
function _prefsClear() {
  for (const k of PREF_KEYS) {
    try { window.localStorage.removeItem(LS_PREFIX + k); } catch (_) {}
  }
}

// ─── Files domain (internal files — OPFS / IndexedDB blob fallback) ─
// Internal files are inherently private (OPFS is origin-scoped); user
// files (Phase B) live in user-chosen FSA folders, never here.
const filesDomain = {
  get: (name) => files.get(name),
  put: (name, blob) => files.put(name, blob),
  delete: (name) => files.delete(name),
  list: () => files.list(),
};

// ─── Public API ────────────────────────────────────────────────────

/**
 * Private App Storage domain API. All KV domains share one shape;
 * session / prefs / files have their own (different backends, different
 * semantics) and are dispatched inside get/set/delete/keys/clear.
 */
const privateStorage = {
  /**
   * Read one entry from a domain. KV domains fall back to the flat
   * legacy key when the namespaced key is empty (pre-migration data).
   * Session/prefs return null for keys outside their maps/allowlists.
   * Returns null on miss.
   */
  async get(domain, key) {
    _assertDomain(domain);
    if (domain === PRIVATE_DOMAINS.SESSION) return _sessionGet(key);
    if (domain === PRIVATE_DOMAINS.PREFS) return _prefsGet(key);
    if (domain === PRIVATE_DOMAINS.FILES) return filesDomain.get(key);
    return _kvGet(domain, key);
  },

  /** Write one entry into a domain. */
  async set(domain, key, value) {
    _assertDomain(domain);
    if (domain === PRIVATE_DOMAINS.SESSION) { _sessionSet(key, value); return; }
    if (domain === PRIVATE_DOMAINS.PREFS) { _prefsSet(key, value); return; }
    if (domain === PRIVATE_DOMAINS.FILES) {
      throw new Error('[privateStorage] files domain: use privateStorage.files.put(name, blob)');
    }
    return _kvSet(domain, key, value);
  },

  /** Remove one entry from a domain. */
  async delete(domain, key) {
    _assertDomain(domain);
    if (domain === PRIVATE_DOMAINS.SESSION) { _sessionDelete(key); return; }
    if (domain === PRIVATE_DOMAINS.PREFS) { _prefsDelete(key); return; }
    if (domain === PRIVATE_DOMAINS.FILES) return filesDomain.delete(key);
    return _kvDelete(domain, key);
  },

  /** List the keys of a domain. */
  async keys(domain) {
    _assertDomain(domain);
    if (domain === PRIVATE_DOMAINS.SESSION) return _sessionKeys();
    if (domain === PRIVATE_DOMAINS.PREFS) return _prefsKeys();
    if (domain === PRIVATE_DOMAINS.FILES) return filesDomain.list();
    return _kvKeys(domain);
  },

  /**
   * Wipe ONE domain. KV domains clear only their namespaced keys;
   * session clears the 4 real auth keys; prefs clears ONLY the
   * allowlisted preference keys (never PWA markers, continuity state,
   * SW version, media projects, device fingerprint); files clears
   * internal files. Never touches other domains or user storage.
   */
  async clear(domain) {
    _assertDomain(domain);
    if (domain === PRIVATE_DOMAINS.SESSION) { _sessionClear(); return; }
    if (domain === PRIVATE_DOMAINS.PREFS) { _prefsClear(); return; }
    if (domain === PRIVATE_DOMAINS.FILES) {
      const names = await filesDomain.list();
      for (const n of names) await filesDomain.delete(n);
      return;
    }
    return _kvClear(domain);
  },

  /** Wipe EVERY private-app-storage domain (never user storage). */
  async clearAll() {
    for (const domain of Object.values(PRIVATE_DOMAINS)) {
      await privateStorage.clear(domain);
    }
  },

  /** Session domain object (real auth keys). */
  session: {
    get: _sessionGet,
    set: _sessionSet,
    delete: _sessionDelete,
    keys: _sessionKeys,
    clear: _sessionClear,
  },

  /** Prefs domain object (allowlisted atelnyo_* keys). */
  prefs: {
    get: _prefsGet,
    set: _prefsSet,
    delete: _prefsDelete,
    keys: _prefsKeys,
    clear: _prefsClear,
  },

  /** Files domain object (internal files). */
  files: filesDomain,
};

export { privateStorage };
export default privateStorage;
