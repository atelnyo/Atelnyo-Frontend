/**
 * src/pwa/storage/draftStore.js
 *
 * DRAFT STORE — the DRAFTS storage PRIMITIVE of the PWA Storage
 * subsystem: draft protection on the private app storage.
 *
 *   User typing      →  autosave  →  draftStore.save  (private:drafts:<id>)
 *   Browser refresh              →  draftStore.get   → restore the draft
 *
 * RESPONSIBILITY BOUNDARY (draft protection is a 3-layer contract):
 *   • THIS primitive (the STORAGE MANAGER side) owns PERSISTENCE:
 *     per-form keys under the 'drafts' domain (`private:drafts:<id>`),
 *     metadata (updatedAt), list/remove/clear, and honest results —
 *     a quota failure surfaces as 'quota-exceeded', NEVER a silent
 *     drop (the draft would be lost on reload without a word).
 *   • The CONTINUITY MANAGER owns RESTORE ORCHESTRATION: launch
 *     context (first/return) + the restore point, delegated to
 *     appStateStore, which delegates drafts to this primitive.
 *   • The FEATURE layer owns AUTOSAVE POLICY: when to save (debounce,
 *     pause), when to remove (submit / discard), and expiry/pruning —
 *     this primitive stores a draft until it is removed or cleared; it
 *     knows NOTHING about form lifecycles.
 *
 * The primitive does NOT auto-expire drafts (no TTL): expiry is the
 * feature layer's policy — it knows the form lifecycle, and it reads
 * `updatedAt` (from get/list) to prune stale drafts if it wants to.
 *
 * All results are tagged ({ ok: true, … } | { ok: false, error }) and
 * every error is a canonical STORAGE_ERRORS category (via
 * normalizeStorageError) — the UI never reads a raw DOMException.
 */
import privateStorage from './privateStorage.js';
import {
  PRIVATE_DOMAINS,
  STORAGE_ERRORS,
  normalizeStorageError,
} from './storageTypes.js';
import { isQuotaError } from './storageHealth.js';

const DRAFTS = PRIVATE_DOMAINS.DRAFTS; // 'drafts'

/** Draft key = the form id (a stable per-form identity). */
function _key(formId) {
  return String(formId);
}

/**
 * PUBLIC — autosave a draft. Stores { data, updatedAt } under
 * private:drafts:<formId> (IndexedDB → localStorage fallback — the
 * KV chain of the private storage).
 *
 * Returns { ok: true, savedAt } or { ok: false, error }:
 *   • 'quota-exceeded' — the write hit the quota wall. The UI must
 *     WARN (the draft is not silently lost — but it is not persisted).
 *   • 'invalid-operation' — no formId given.
 *   • any other canonical category (normalizeStorageError).
 *
 * `data` may be any structured value (the feature layer's form payload).
 */
export async function save(formId, data) {
  if (formId === null || formId === undefined || String(formId) === '') {
    return { ok: false, error: STORAGE_ERRORS.INVALID_OPERATION };
  }
  // Saving a draft with NO payload is a caller bug — persisting
  // { data: undefined } would only mask it behind a "draft saved" lie.
  if (data === undefined) {
    return { ok: false, error: STORAGE_ERRORS.INVALID_OPERATION };
  }
  const savedAt = Date.now();
  try {
    await privateStorage.set(DRAFTS, _key(formId), { data, updatedAt: savedAt });
    return { ok: true, savedAt };
  } catch (err) {
    // Quota failure is a REAL state, never silent — surface it so the
    // UI can warn instead of pretending the draft was saved.
    if (isQuotaError(err)) {
      return {
        ok: false,
        error: STORAGE_ERRORS.QUOTA_EXCEEDED,
        message: err?.message || '',
      };
    }
    return { ok: false, error: normalizeStorageError(err), message: err?.message || '' };
  }
}

/**
 * PUBLIC — restore a draft. Returns { ok: true, draft } where draft is
 * { data, updatedAt } or null when no draft exists for the form.
 */
export async function get(formId) {
  try {
    const draft = await privateStorage.get(DRAFTS, _key(formId));
    // Shape-validate (the same rule as list()): only a well-formed
    // { data, updatedAt } counts as a draft — a corrupt value returns
    // null instead of crashing the restore path on res.draft.data.
    const wellFormed = draft !== null
      && typeof draft === 'object'
      && 'updatedAt' in draft;
    return { ok: true, draft: wellFormed ? draft : null };
  } catch (err) {
    return { ok: false, error: normalizeStorageError(err), message: err?.message || '' };
  }
}

/**
 * PUBLIC — list every saved draft ({ formId, updatedAt }, newest
 * first) — for a restore picker or feature-layer pruning. Returns
 * { ok: true, drafts } or { ok: false, error }.
 */
export async function list() {
  try {
    const keys = await privateStorage.keys(DRAFTS);
    const drafts = [];
    for (const formId of keys) {
      const draft = await privateStorage.get(DRAFTS, formId);
      // Only well-formed drafts count (a corrupt value is skipped —
      // it must not break the whole picker).
      if (draft && typeof draft === 'object' && 'updatedAt' in draft) {
        drafts.push({ formId, updatedAt: draft.updatedAt });
      }
    }
    drafts.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return { ok: true, drafts };
  } catch (err) {
    return { ok: false, error: normalizeStorageError(err), message: err?.message || '' };
  }
}

/**
 * PUBLIC — drop ONE draft (submit / discard). Returns { ok: true }.
 */
export async function remove(formId) {
  try {
    await privateStorage.delete(DRAFTS, _key(formId));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: normalizeStorageError(err), message: err?.message || '' };
  }
}

/**
 * PUBLIC — wipe ALL drafts (domain-scoped clear — never touches other
 * private domains or user storage). Returns { ok: true }.
 */
export async function clear() {
  try {
    await privateStorage.clear(DRAFTS);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: normalizeStorageError(err), message: err?.message || '' };
  }
}

export default { save, get, list, remove, clear };
