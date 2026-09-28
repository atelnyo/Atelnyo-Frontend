/**
 * src/services/offlineCourse.js — offline learning (spec §48–§49).
 *
 * Two responsibilities, both reusing EXISTING architecture (no new
 * storage or sync system):
 *
 *   1. CONTENT STAGING — caches the learner's course snapshot (course
 *      payload incl. syllabus, the progress row, quizzes, and the
 *      announcements/resources/notes support data) into the PWA
 *      private-storage ``cache`` domain (IndexedDB → localStorage
 *      fallback). The service worker deliberately passes API responses
 *      through, so the APP owns caching structured course data — this
 *      module is that owner. Snapshots are keyed per (course, user):
 *      one learner's progress/notes never leak into another's.
 *
 *   2. SAFE PROGRESS SYNC — when a progress write fails (offline /
 *      transient), enqueue it into the existing offlineQueue. Replay
 *      is safe because the backend is idempotent:
 *        • record_position  — plain URL; the queue's last-write-wins
 *          dedup keeps only the latest position (exactly right).
 *        • complete_block   — per-block unique URL (?bid=) so the
 *          queue's per-URL dedup never drops a distinct completion;
 *          the server dedupes by block_id anyway.
 *        • first completion — course-scoped /progress/complete/
 *          (find-or-create the row server-side) so a queued completion
 *          works even when the progress row didn't exist yet.
 * The queue already drains on reconnect (useConnectionMonitor) and on
 * SW background-sync — nothing new to wire.
 */
import privateStorage from '../pwa/storage/privateStorage';
import offlineQueue from './offlineQueue';

const DOMAIN = 'cache'; // PRIVATE_DOMAINS.CACHE — cached structured data

function keyFor(courseId, userId) {
  return `course:${courseId}:u${userId || 0}`;
}

/**
 * Merge a snapshot fragment into the cached course. Never throws —
 * storage unavailable simply means offline learning isn't staged
 * (the UI stays honest about it).
 */
export async function stageCourse(courseId, userId, snapshot = {}) {
  if (!courseId) return;
  try {
    const existing = (await getCachedCourse(courseId, userId)) || {};
    await privateStorage.set(DOMAIN, keyFor(courseId, userId), {
      ...existing,
      ...snapshot,
      stagedAt: Date.now(),
    });
  } catch (_) { /* storage unavailable — nothing staged */ }
}

/** Read the staged course snapshot for (course, user), or null. */
export async function getCachedCourse(courseId, userId) {
  if (!courseId) return null;
  try {
    return (await privateStorage.get(DOMAIN, keyFor(courseId, userId))) || null;
  } catch (_) {
    return null;
  }
}

/** Stage the course's quiz list (fetched course-wide by QuizBlock). */
export async function stageQuizzes(courseId, userId, quizzes) {
  if (!courseId || !Array.isArray(quizzes)) return;
  try {
    const snap = (await getCachedCourse(courseId, userId)) || {};
    await privateStorage.set(DOMAIN, keyFor(courseId, userId), {
      ...snap,
      quizzes,
      stagedAt: Date.now(),
    });
  } catch (_) { /* storage unavailable — nothing staged */ }
}

/**
 * Queue a progress write for replay when connectivity returns.
 * ``url`` must be unique per logical operation (see header) so the
 * queue's per-URL dedup never drops a distinct write.
 */
export function enqueueProgress(config) {
  if (!config?.url) return;
  offlineQueue.enqueue({
    method: config.method || 'POST',
    url: config.url,
    data: config.data || {},
  }).catch(() => {});
}
