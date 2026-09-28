/**
 * appStateStore.js — Full app state preservation across PWA launches.
 *
 * Stores and restores critical app state so the PWA resumes exactly
 * where the user left off after being closed and reopened:
 *   • Active tab / sheet route
 *   • Scroll position per route
 *   • Selected course / product / community
 *   • Search query + filters
 *   • Form drafts (unsaved)
 *
 * Uses IndexedDB via the Storage Manager's private METADATA domain
 * (privateStorage). TTL is checked on every load (not just first) to
 * handle external storage clearing.
 */

// APP STATE lives in the PRIVATE METADATA domain
// (private:metadata:app-state) — the Storage Manager's private domain
// layer (legacy flat key 'app_state' stays read-compat via
// LEGACY_ALIASES until the migration is flushed).
import privateStorage from '../pwa/storage/privateStorage';
import { PRIVATE_DOMAINS } from '../pwa/storage/storageTypes';
// Drafts live in the Storage Manager's DRAFTS domain
// (private:drafts:<formId>) via the draftStore primitive — see
// src/pwa/storage/draftStore.js. appStateStore stays the sanctioned
// façade for app state; its draft functions DELEGATE to the primitive
// (the Storage Manager provides the storage; the autosave POLICY
// belongs to the form layer; the Continuity Manager orchestrates
// restore points through this store).
import draftStore from '../pwa/storage/draftStore';

// The METADATA domain key (private:metadata:app-state; legacy flat
// key 'app_state' read-compat via LEGACY_ALIASES).
const STATE_KEY = 'app-state';
const STATE_DOMAIN = PRIVATE_DOMAINS.METADATA;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Internal ──────────────────────────────────────────────────────
let _state = null;

async function _load() {
  // Always re-read from IndexedDB if cached state is missing or expired
  if (_state && _state._savedAt && (Date.now() - _state._savedAt < MAX_AGE_MS)) {
    return _state;
  }
  try {
    const saved = await privateStorage.get(STATE_DOMAIN, STATE_KEY);
    if (saved && saved._savedAt && (Date.now() - saved._savedAt < MAX_AGE_MS)) {
      _state = saved;
    } else {
      _state = { _savedAt: Date.now() };
    }
  } catch (_) {
    _state = { _savedAt: Date.now() };
  }
  // Retire the legacy pre-draftStore blob: pre-migration drafts used
  // to nest under _state._formDrafts. The DRAFTS domain is the single
  // source of truth now — strip the blob so it stops being
  // re-persisted (restoreFormDraft reads the DRAFTS domain only).
  if (_state && '_formDrafts' in _state) {
    delete _state._formDrafts;
  }
  return _state;
}

async function _save() {
  if (!_state) return;
  _state._savedAt = Date.now();
  try { await privateStorage.set(STATE_DOMAIN, STATE_KEY, _state); } catch (_) {}
}

// ─── Public API ─────────────────────────────────────────────────────
export async function saveAppState(patch) {
  await _load();
  Object.assign(_state, patch);
  await _save();
}

export async function restoreAppState() {
  await _load();
  // Drafts NEVER surface here — they live in the DRAFTS domain.
  // Consumers that read drafts use restoreFormDraft().
  return { ..._state };
}

export async function saveScrollPosition(route, scrollY) {
  await _load();
  if (!_state._scrollPositions) _state._scrollPositions = {};
  _state._scrollPositions[route] = scrollY;
  await _save();
}

export async function restoreScrollPosition(route) {
  await _load();
  return _state._scrollPositions?.[route] ?? 0;
}

export async function saveFormDraft(formId, data) {
  // Drafts live in the DRAFTS domain (private:drafts:<formId>) — the
  // Storage Manager's draft primitive — NOT nested in the app_state
  // blob anymore (per-form keys + updatedAt metadata, quota-aware).
  // The app_state blob keeps only NON-draft state (tab, scroll, route).
  return draftStore.save(formId, data);
}

export async function restoreFormDraft(formId) {
  // Drafts live in the DRAFTS domain (private:drafts:<formId>) only —
  // the legacy app_state._formDrafts blob was retired with the
  // wholesale appStateStore migration.
  const res = await draftStore.get(formId);
  if (res.ok && res.draft) return res.draft.data;
  return null;
}

export async function removeFormDraft(formId) {
  // The form layer calls this when a draft is CONSUMED (submitted /
  // discarded) — the draft primitive keeps no phantom copies.
  return draftStore.remove(formId);
}

export async function clearAppState() {
  _state = { _savedAt: Date.now() };
  await _save();
  // Drafts live in the DRAFTS domain — "clear my data" must clear
  // them too (the contract includes drafts, not just tab/scroll).
  await draftStore.clear();
}
