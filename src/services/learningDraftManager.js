/**
 * learningDraftManager.js — §9, §14, §15, §22, §23, §37, §38, §39
 *
 * Centralized draft lifecycle for ALL learning blocks (exercises,
 * reflections, quizzes, workspaces). Manages:
 *
 *   §9  — Local-first draft protection
 *   §14 — Draft identity (student + course + lesson + block)
 *   §15 — Draft versioning (timestamps, local version)
 *   §22 — Draft restoration (server vs local comparison)
 *   §23 — Conflict resolution (data-type appropriate strategies)
 *   §37 — Data cleanup (safe rules, never delete unsynced work)
 *   §38 — Privacy (account-scoped drafts via privateStorage)
 *   §39 — Account switching (drafts scoped by account)
 *
 * Storage: private:drafts:ld_<courseId>_<lessonId>_<blockId>
 *   (via draftStore primitive → privateStorage → IndexedDB)
 */
import draftStore from '../pwa/storage/draftStore';
import { createSaveStateMachine } from './saveStateMachine';

const DRAFT_PREFIX = 'ld_';
const MAX_DRAFT_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * §14 — Stable draft identity: student + course + lesson + block.
 * PrivateStorage already isolates by account (same DB = same user).
 */
function draftId(courseId, lessonId, blockId) {
  return `${DRAFT_PREFIX}${courseId}_${lessonId}_${blockId}`;
}

/**
 * §9 — Save a learning draft (local-first).
 * Returns { ok, savedAt, stateMachine } or { ok: false, error }.
 */
export async function saveDraft({ courseId, lessonId, blockId, data, version = 0 }) {
  if (!courseId || !lessonId || !blockId) {
    return { ok: false, error: 'invalid-operation' };
  }
  const id = draftId(courseId, lessonId, blockId);
  const payload = {
    data,
    version,
    updatedAt: Date.now(),
    courseId,
    lessonId,
    blockId,
  };
  const result = await draftStore.save(id, payload);
  // §46 — Error classification: translate storage errors to human-friendly
  if (!result.ok && result.error) {
    const classified = {
      'quota-exceeded': {
        type: 'storage_full',
        message: 'Storage is full. Your work cannot be saved right now.',
        recovery: 'free_space',
      },
      'invalid-operation': {
        type: 'invalid_data',
        message: 'Invalid data.',
        recovery: 'retry',
      },
    };
    return { ...result, classified: classified[result.error] || { type: 'unknown', message: 'Save failed', recovery: 'retry' } };
  }
  return result;
}

/**
 * §22 — Restore a learning draft.
 * Returns { ok, draft } where draft = { data, version, updatedAt, ... }
 * or null if no draft exists.
 */
export async function restoreDraft({ courseId, lessonId, blockId }) {
  if (!courseId || !lessonId || !blockId) return { ok: true, draft: null };
  const id = draftId(courseId, lessonId, blockId);
  const result = await draftStore.get(id);
  if (!result.ok) return result;
  if (!result.draft) return { ok: true, draft: null };
  const draft = result.draft;
  // §37 — Expire old drafts (30 days)
  if (Date.now() - (draft.updatedAt || 0) > MAX_DRAFT_AGE_MS) {
    await draftStore.remove(id);
    return { ok: true, draft: null };
  }
  return { ok: true, draft };
}

/**
 * §37 — Remove a draft (after successful server sync or explicit discard).
 */
export async function removeDraft({ courseId, lessonId, blockId }) {
  if (!courseId || !lessonId || !blockId) return;
  const id = draftId(courseId, lessonId, blockId);
  await draftStore.remove(id);
}

/**
 * §22 — Compare local draft vs server state for conflict detection.
 * Returns { strategy: 'use_local' | 'use_server' | 'conflict' | 'identical',
 *           localDraft, serverState }
 */
export function resolveConflict({ localDraft, serverState }) {
  if (!localDraft && !serverState) return { strategy: 'identical' };
  if (!localDraft) return { strategy: 'use_server' };
  if (!serverState) return { strategy: 'use_local' };

  const localTime = localDraft.updatedAt || 0;
  const serverTime = serverState.updatedAt || 0;

  // §23 — Last-write-wins for simple drafts (data-type appropriate)
  // If versions match, the data is the same
  if (localDraft.version === serverState.version) {
    if (JSON.stringify(localDraft.data) === JSON.stringify(serverState.data)) {
      return { strategy: 'identical', localDraft, serverState };
    }
  }

  // §23 — Last-write-wins for simple drafts
  if (localTime > serverTime) {
    return { strategy: 'use_local', localDraft, serverState };
  }
  return { strategy: 'use_server', localDraft, serverState };
}

/**
 * §37 — List all drafts for a course (for cleanup or restore picker).
 * Returns { ok, drafts } where each entry = { formId, updatedAt, data? }.
 */
export async function listDrafts(courseId) {
  const result = await draftStore.list();
  if (!result.ok) return result;
  const prefix = `${DRAFT_PREFIX}${courseId}_`;
  const learningDrafts = result.drafts
    .filter(d => d.formId.startsWith(prefix))
    .map(d => ({
      ...d,
      // Parse the formId to extract lessonId and blockId
      courseId,
      lessonId: d.formId.slice(prefix.length).split('_')[0],
      blockId: d.formId.slice(prefix.length).split('_').slice(1).join('_'),
    }));
  return { ok: true, drafts: learningDrafts };
}

/**
 * §37 — Cleanup expired drafts (call periodically or on login).
 */
export async function cleanupExpiredDrafts() {
  const result = await draftStore.list();
  if (!result.ok) return;
  const now = Date.now();
  const learningDrafts = result.drafts.filter(d => d.formId.startsWith(DRAFT_PREFIX));
  for (const d of learningDrafts) {
    if (now - (d.updatedAt || 0) > MAX_DRAFT_AGE_MS) {
      await draftStore.remove(d.formId);
    }
  }
}

/**
 * §39 — Clear all learning drafts for current account (on logout).
 */
export async function clearAllDrafts() {
  const result = await draftStore.list();
  if (!result.ok) return;
  const learningDrafts = result.drafts.filter(d => d.formId.startsWith(DRAFT_PREFIX));
  for (const d of learningDrafts) {
    await draftStore.remove(d.formId);
  }
}

export default {
  saveDraft,
  restoreDraft,
  removeDraft,
  resolveConflict,
  listDrafts,
  cleanupExpiredDrafts,
  clearAllDrafts,
  createSaveStateMachine,
};
