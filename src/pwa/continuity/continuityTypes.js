/**
 * src/pwa/continuity/continuityTypes.js
 *
 * PURE TYPES & CONSTANTS of the PWA Continuity subsystem — the launch
 * context, session status, and policy knobs. No logic lives here; the
 * Continuity Manager (ContinuityManager.js) imports from this module
 * so the whole subsystem speaks ONE vocabulary.
 *
 * Continuity answers “Ki jan app la kontinye kote li te sispann?”
 * (how does the app continue where the user left off?) across PWA
 * launches:
 *   • LAUNCH CONTEXT — first visit on this device vs a RETURN visit
 *     (the app has run here before — a restore point may exist).
 *   • LAST-ACTIVE CLOCK — when did the user last interact? Used to
 *     judge whether a session is STALE (away too long → re-validate
 *     the auth session before continuing).
 *   • RETURN-TO-APP — the hidden→visible transition, where a stale
 *     session should be re-checked before the user continues.
 *
 * The restore point itself (route, scroll, drafts, activeTab…) is
 * owned by the existing appStateStore (src/services/appStateStore.js)
 * — the manager delegates get/save, it never re-implements storage.
 */
export const STORAGE = {
  /** Epoch ms of the last recorded user interaction. */
  lastActiveAt: 'atelnyo_continuity_last_active_at',
  /** How many times this device has launched atelnyo. */
  launchCount: 'atelnyo_continuity_launch_count',
  /** Epoch ms of the very first launch on this device. */
  firstSeenAt: 'atelnyo_continuity_first_seen_at',
};

/**
 * Launch context buckets — first visit vs returning visit. RETURN does
 * NOT promise a restore point exists (the user may have cleared the
 * app state); it only means the app has run on this device before.
 */
export const LAUNCH_TYPES = {
  FIRST: 'first',
  RETURN: 'return',
};

/**
 * Session status derived from the last-active clock:
 *   • active  — the user interacted recently (≤ staleAfterMs ago).
 *   • stale   — the user was away longer than staleAfterMs; the UI
 *               should re-validate the auth session before continuing.
 *   • unknown — no last-active stamp recorded yet (first load).
 */
export const SESSION_STATUS = {
  ACTIVE: 'active',
  STALE: 'stale',
  UNKNOWN: 'unknown',
};

/**
 * Continuity policy knobs — WHEN is a session stale, WHEN does a
 * hidden→visible gap count as a “return” worth notifying about, and
 * how often noteActive() persists the last-active stamp:
 *   • staleAfterMs     — away longer than this ⇒ session is STALE
 *                        (default 30 min, matching the JWT refresh
 *                        token lifetime order of magnitude).
 *   • returnThresholdMs— a hidden→visible gap must exceed this before
 *                        ``returned`` flips (a quick tab-switch should
 *                        not spam subscribers).
 *   • persistThrottleMs— throttle for noteActive() localStorage writes
 *                        (each write fans out a storage event to other
 *                        tabs — don't spam them).
 */
export const CONTINUITY_POLICY = {
  staleAfterMs: 30 * 60 * 1000,
  returnThresholdMs: 2000,
  persistThrottleMs: 30 * 1000,
};

/* ──────────────────────────────────────────────────────────────────
 * CONTINUITY STATE — the MEANINGFUL slice the Continuity Manager
 * persists so the user can pick up exactly where they left off.
 *
 * THE PRINCIPLE (never break it): we do NOT serialize React state.
 * A restore point holds a handful of MEANINGFUL keys — the identity
 * of the workflow (route, workspace, selected entity, draft), never
 * its transient internals (modal open flags, fetched lists, scroll
 * jitter). Continuity DECIDES what to save; the Storage Manager
 * (appStateStore) provides the persistence mechanism.
 *
 *   Continuity State (meaningful)          NOT saved (React internals)
 *   ─────────────────────────────          ──────────────────────────
 *   route.last            (full path)      modal open flags
 *   route.scrollY         (per route)      fetched lists / query caches
 *   workspace.section     (studio tab)     transient input values
 *   workspace.mediaTab    (media sub-tab)  circular refs / class ids
 *   selectedEntity.{type,id}               anything recomputable
 *   drafts.lastDraftId / drafts.count      draft CONTENT (lives in the
 *   recovery.{at,reason}                    draftStore — only the
 *                                          INDEX rides the restore
 *                                          point, never the payload)
 *
 * The schema version gates migrations: a future shape change bumps
 * the version and restoreAppState() decides how to upgrade.
 */
export const CONTINUITY_STATE_VERSION = 2;

/**
 * WHY the restore point is being read — the interruption kind that
 * ended the previous session. The banner wording differs per reason
 * ("app closed", "you were offline", "a new version installed"...).
 */
export const RESTORE_REASONS = {
  /** OS/browser killed the page without a graceful unload. */
  MEMORY_KILL: 'memory-kill',
  /** User (or an error) reloaded the page. */
  RELOAD: 'reload',
  /** App went through the hidden→visible return (tab switch / home). */
  RETURN: 'return',
  /** A new service-worker version installed and took over. */
  SW_UPDATE: 'sw-update',
  /** The session was stale (away too long) — re-validated, resumed. */
  STALE_RESUME: 'stale-resume',
  /** No restore happened (fresh launch with nothing to restore). */
  NONE: 'none',
};

/**
 * PURE — summarize a restore point into the few facts the UI needs to
 * say “we put you back”. Works on the appStateStore shape (or a
 * partial one). Returns null when there is nothing meaningful to
 * announce — the banner simply does not show.
 */
export function summarizeRecovery(point) {
  if (!point || typeof point !== 'object') { return null; }
  const route = typeof point.lastRoute === 'string' ? point.lastRoute : null;
  const workspace = point.workspace && typeof point.workspace === 'object'
    ? point.workspace
    : null;
  const entity = point.selectedEntity && typeof point.selectedEntity === 'object'
    ? point.selectedEntity
    : null;
  const draftId = typeof point.lastDraftId === 'string' ? point.lastDraftId : null;
  const hasRoute = !!route;
  const hasWorkspace = !!(workspace && typeof workspace.section === 'string');
  const hasEntity = !!(entity && typeof entity.id === 'string');
  const hasDraft = !!draftId;
  // Nothing meaningful to restore → nothing to announce.
  if (!hasRoute && !hasWorkspace && !hasEntity && !hasDraft) { return null; }
  return {
    route,
    workspace: hasWorkspace ? workspace : null,
    entity: hasEntity ? entity : null,
    draftId,
    // The most specific thing we can point the user at.
    focus: hasWorkspace
      ? `workspace:${workspace.section}`
      : hasEntity
        ? `entity:${entity.type || 'item'}:${entity.id}`
        : hasRoute
          ? `route:${route}`
          : hasDraft ? `draft:${draftId}` : null,
  };
}
