/**
 * learningSessionStore.js — §1, §3, §20, §34 Learning Session State
 *
 * Centralizes the student's learning session context using the existing
 * draftStore primitive (NOT raw localStorage). Provides:
 *
 *   - §3  Active learning session state (course/module/lesson/block)
 *   - §20 Last meaningful learning position
 *   - §34 Lesson state snapshot (lightweight recovery information)
 *   - §16 Recovery after refresh
 *
 * Storage: private:drafts:ls_session_<courseId> (via draftStore)
 * Identity: student + course (account-scoped by privateStorage)
 */
import draftStore from '../pwa/storage/draftStore';

const PREFIX = 'ls_session_';

function keyFor(courseId) {
  return `${PREFIX}${courseId}`;
}

/**
 * Save learning session state.
 * @param {number|string} courseId
 * @param {Object} state — { moduleIndex, lessonIndex, blockId, blockType, scrollContext, lastInteraction }
 */
export async function saveSessionState(courseId, state) {
  if (!courseId) return { ok: false, error: 'invalid-operation' };
  return draftStore.save(keyFor(courseId), {
    ...state,
    savedAt: Date.now(),
  });
}

/**
 * Restore learning session state.
 * Returns { ok, state } where state includes savedAt.
 * Expires after 7 days (longer than the old 24h — spec §16 says
 * "Student returning days later" should work).
 */
export async function loadSessionState(courseId) {
  if (!courseId) return { ok: false, draft: null };
  const result = await draftStore.get(keyFor(courseId));
  if (!result.ok || !result.draft) return { ok: true, state: null };
  const state = result.draft.data;
  // §16 — Expire after 7 days
  if (Date.now() - (state.savedAt || 0) > 7 * 86400000) {
    await draftStore.remove(keyFor(courseId));
    return { ok: true, state: null };
  }
  return { ok: true, state };
}

/**
 * Clear session state for a course (on logout or explicit exit).
 */
export async function clearSessionState(courseId) {
  if (!courseId) return;
  await draftStore.remove(keyFor(courseId));
}

/**
 * Clear ALL learning session states (account-wide cleanup).
 */
export async function clearAllSessionStates() {
  const result = await draftStore.list();
  if (!result.ok) return;
  const sessionDrafts = result.drafts.filter(d => d.formId.startsWith(PREFIX));
  for (const d of sessionDrafts) {
    await draftStore.remove(d.formId);
  }
}

export default { saveSessionState, loadSessionState, clearSessionState, clearAllSessionStates };
