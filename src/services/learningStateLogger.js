/**
 * learningStateLogger.js — §45 State Observability
 *
 * §45 — "For development and debugging: Provide safe internal visibility
 *         into: Pending drafts, Save states, Sync queue, Recovery events."
 *        "Do not expose private student content unnecessarily in production logs."
 *        "Development tools must not become a privacy leak."
 *
 * A dev-only logging facade for the learning state system.
 * Completely dead code in production (no-op functions).
 */

const isDev = process.env.NODE_ENV === 'development';

const _log = (category, action, data) => {
  if (!isDev) return;
  // §45 — Never log actual student content, only metadata
  const safe = { ...data };
  if (safe.content && typeof safe.content === 'object') {
    safe.content = `[${Object.keys(safe.content).join(', ')}]`;
  }
  if (safe.answer) safe.answer = `[length=${String(safe.answer).length}]`;
  if (safe.data && typeof safe.data === 'object') {
    safe.data = `[${Object.keys(safe.data).join(', ')}]`;
  }
  console.log(
    `%c[LearningState:%c${category}%c] ${action}`,
    'color:#8b5cf6;font-weight:bold',
    'color:#06b6d4',
    'color:#8b5cf6',
    safe,
  );
};

export const logger = {
  // Draft operations
  draftSaved: (blockId, result) => _log('Draft', 'saved', { blockId, ok: result?.ok }),
  draftRestored: (blockId, found) => _log('Draft', 'restored', { blockId, found }),
  draftRemoved: (blockId) => _log('Draft', 'removed', { blockId }),

  // Save state machine transitions
  stateTransition: (blockId, from, to) => _log('SaveState', `${from} → ${to}`, { blockId }),

  // Session recovery
  sessionRestored: (courseId, state) => _log('Session', 'restored', { courseId, hasState: !!state }),
  sessionSaved: (courseId) => _log('Session', 'saved', { courseId }),
  sessionCleared: (courseId) => _log('Session', 'cleared', { courseId }),

  // Sync operations
  syncEnqueued: (url, size) => _log('Sync', 'enqueued', { url: url?.slice(0, 60), queueSize: size }),
  syncCompleted: (ok, fail) => _log('Sync', 'completed', { succeeded: ok, failed: fail }),
  syncFailed: (url, error) => _log('Sync', 'failed', { url: url?.slice(0, 60), error }),

  // Recovery events
  recoveryDetected: (type) => _log('Recovery', 'detected', { type }),
  conflictDetected: (blockId, strategy) => _log('Conflict', 'detected', { blockId, strategy }),

  // Navigation flush
  flushStarted: (count) => _log('Flush', 'started', { pendingBlocks: count }),
  flushCompleted: (count) => _log('Flush', 'completed', { savedBlocks: count }),

  // Visibility / lifecycle
  appHidden: () => _log('Lifecycle', 'app_hidden', {}),
  appVisible: () => _log('Lifecycle', 'app_visible', {}),
};

export default logger;
