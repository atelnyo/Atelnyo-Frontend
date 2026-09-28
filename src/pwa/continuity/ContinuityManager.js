/**
 * src/pwa/continuity/ContinuityManager.js
 *
 * PWA CONTINUITY MANAGER — single source of truth for “Ki jan app la
 * kontinye kote li te sispann?” (how does the app continue where the
 * user left off?). It is the STATE MACHINE of the Continuity
 * subsystem; pure types and policy live in continuityTypes.js, and the
 * restore point itself is owned by the existing appStateStore
 * (src/services/appStateStore.js) — this manager COMPOSES, never
 * re-implements:
 *
 *   src/pwa/continuity/
 *   ├── continuityTypes.js      → launch types + session status +
 *   │                             policy knobs + storage keys (pure)
 *   └── ContinuityManager.js    → THIS MODULE — the state machine
 *                                 + public abstraction + singleton
 *
 *   Launch Context      →  FIRST visit (fresh install / cleared data)
 *                          vs RETURN (the app has run on this device
 *                          before — a restore point may exist).
 *   Last-Active Clock   →  noteActive() stamps every meaningful user
 *                          interaction (throttled); a session away
 *                          longer than CONTINUITY_POLICY.staleAfterMs
 *                          is STALE (re-validate before continuing).
 *   Return-to-App       →  visibilitychange / focus / pageshow detect
 *                          the hidden→visible gap; the manager reports
 *                          ``returned`` so the UI can re-check the
 *                          session (auth may have expired while the
 *                          app was backgrounded).
 *   Restore Point       →  delegated to appStateStore (activeTab,
 *                          lang, scroll, drafts…). Never duplicated.
 *   Integration         →  App Controller (src/pwa/app/AppController.js)
 *                          composes this manager's facts into the
 *                          runtime snapshot for the UI.
 *
 * Consumers subscribe via ``subscribe(cb)`` and always read the
 * snapshot from ``getState()`` — the same reactive contract the
 * Installation Manager uses. No component owns continuity state of
 * its own.
 *
 * ── PUBLIC API — the whole app talks to the manager through these ──
 *   initialize()       — re-evaluate the continuity pipeline (idempotent)
 *   getState()         — immutable-ish snapshot for the UI
 *   noteActive()       — record a user interaction (last-active clock)
 *   isRelaunch()       — RETURN launch (a restore point may exist)
 *   isStale()          — session status is STALE (away too long)
 *   getRestorePoint()  — async → appStateStore.restoreAppState()
 *   saveRestorePoint() — async → appStateStore.saveAppState(patch)
 *   saveScrollPosition()/restoreScrollPosition() — per-route scroll
 *                            (async → appStateStore; the app never
 *                            imports appStateStore directly)
 *   subscribe()        — reactive updates (returns unsubscribe)
 *   destroy()          — full teardown (tests / HMR); init() re-wires
 *
 * ⚠️ ContinuityManager ≠ appStateStore. If a feature needs to persist
 *    or restore WHERE the user was (route, scroll, drafts), it belongs
 *    in appStateStore (reachable here via getRestorePoint() /
 *    saveRestorePoint()). If a feature needs launch context, the
 *    last-active clock, or return-to-app signals, it belongs HERE —
 *    not in appStateStore.
 *
 * Persisted keys (all in localStorage, cheap + synchronous):
 *   atelnyo_continuity_last_active_at → epoch ms of last interaction
 *   atelnyo_continuity_launch_count   → launch counter (per device)
 *   atelnyo_continuity_first_seen_at  → epoch ms of first launch
 */
import {
  STORAGE,
  LAUNCH_TYPES,
  SESSION_STATUS,
  CONTINUITY_POLICY,
  RESTORE_REASONS,
} from './continuityTypes.js';
// Shared persisted-facts helpers — the same readStored/writeStored the
// Installation Manager uses (installationDetector.js), so the PWA
// subsystem speaks ONE storage vocabulary instead of re-implementing
// localStorage access per subsystem.
import { readStored, writeStored } from '../installation/installationDetector.js';
import installationManager from '../installation/InstallationManager.js';

const PERSIST_THROTTLE = Math.max(Number(CONTINUITY_POLICY.persistThrottleMs) || 0, 0);
const STALE_AFTER_MS = Math.max(Number(CONTINUITY_POLICY.staleAfterMs) || 0, 0);
const RETURN_THRESHOLD_MS = Math.max(Number(CONTINUITY_POLICY.returnThresholdMs) || 0, 0);


class ContinuityManager {
  constructor() {
    this._inited = false;
    // ── Launch context ────────────────────────────────────────────
    // 'first' | 'return' — is this device seeing Atelnyo for the
    // first time, or has it run before (a restore point may exist)?
    this.launchType = LAUNCH_TYPES.FIRST;
    // How many times this device has launched atelnyo.
    this.launchCount = 0;
    // Epoch ms of the very first launch on this device.
    this.firstSeenAt = null;
    // ── Last-active clock ─────────────────────────────────────────
    // Epoch ms of the last recorded user interaction (null = none yet).
    this.lastActiveAt = null;
    // 'active' | 'stale' | 'unknown' — derived from lastActiveAt vs
    // CONTINUITY_POLICY.staleAfterMs (see _refreshSessionStatus).
    this.sessionStatus = SESSION_STATUS.UNKNOWN;
    // True right after a hidden→visible return whose gap exceeded
    // RETURN_THRESHOLD_MS — the UI may re-validate the session then.
    this.returned = false;
    // Epoch ms when the page became hidden (null = currently visible).
    this._hiddenAt = null;
    // Throttle bookkeeping for noteActive() persistence.
    this._lastPersist = 0;
    this._listeners = new Set();
  }

  /** Bind window listeners once. Idempotent. Returns `this`. */
  init() {
    if (this._inited || typeof window === 'undefined') return this;
    this._inited = true;

    // Dev/debug affordance: inspect the continuity snapshot from the
    // console, e.g. ``window.__continuityManager.getState()``.
    try {
      window.__continuityManager = this;
    } catch (_) { /* ignore */ }

    // ── Launch context: count this page load as ONE launch ────────
    // Once per page session — re-runs of initialize() must not bump
    // the counter again (HMR, repeated initialize() calls).
    this._countLaunch();
    // ── Pipeline: derive launchType + session status from facts ───
    this.initialize();

    // ── Return-to-app wiring (visibilitychange / focus / pageshow) ─
    this._onVisibility = () => {
      if (document.hidden) {
        this._hiddenAt = Date.now();
      } else {
        this._onReturn();
      }
    };
    // A hidden→visible gap only counts as a RETURN when it exceeded
    // RETURN_THRESHOLD_MS — a quick tab-switch (or the initial
    // pageshow/focus burst at boot) must not flip ``returned``.
    this._onReturn = () => {
      const gap = this._hiddenAt ? (Date.now() - this._hiddenAt) : 0;
      this._hiddenAt = null;
      if (gap < RETURN_THRESHOLD_MS) return;
      this.returned = true;
      this._refreshSessionStatus();
      this._notify();
    };
    document.addEventListener('visibilitychange', this._onVisibility);
    window.addEventListener('focus', this._onReturn);
    window.addEventListener('pageshow', this._onReturn);
    // Force-persist the last-active stamp on unload so a short visit
    // still records activity (the throttled noteActive() may not have
    // flushed yet).
    this._onPageHide = () => {
      if (this.lastActiveAt) writeStored(STORAGE.lastActiveAt, String(this.lastActiveAt));
    };
    window.addEventListener('pagehide', this._onPageHide);

    // ── Cross-tab last-active sync ────────────────────────────────
    // A storage event from another tab (its noteActive() flush)
    // updates THIS tab's clock so the session status never goes stale.
    this._onStorage = (e) => {
      if (e.key !== STORAGE.lastActiveAt) return;
      const ts = parseInt(readStored(STORAGE.lastActiveAt), 10);
      if (!ts) return;
      this.lastActiveAt = ts;
      this._refreshSessionStatus();
      this._notify();
    };
    window.addEventListener('storage', this._onStorage);
    return this;
  }

  /** Count this page load as one device launch (once per session). */
  _countLaunch() {
    const savedCount = parseInt(readStored(STORAGE.launchCount), 10) || 0;
    this.launchCount = savedCount + 1;
    writeStored(STORAGE.launchCount, String(this.launchCount));
    const firstSeen = parseInt(readStored(STORAGE.firstSeenAt), 10);
    if (firstSeen) {
      this.firstSeenAt = firstSeen;
    } else {
      this.firstSeenAt = Date.now();
      writeStored(STORAGE.firstSeenAt, String(this.firstSeenAt));
    }
  }

  /**
   * PUBLIC — re-evaluate the continuity pipeline from the persisted
   * facts. Idempotent and safe to call any time (HMR, refresh). Does
   * NOT bump the launch counter — a launch is counted once per page
   * session by init().
   *
   * ⚠️ ``returned`` is a ONE-SHOT signal: initialize() resets it to
   * false. A consumer that re-initializes right after a return event
   * erases the flag — read it reactively (subscribe) or immediately
   * after the event, never across initialize() calls.
   */
  initialize() {
    if (typeof window === 'undefined') return this;
    this.launchCount = parseInt(readStored(STORAGE.launchCount), 10) || 1;
    this.firstSeenAt = parseInt(readStored(STORAGE.firstSeenAt), 10) || null;
    this.launchType = this.launchCount > 1 ? LAUNCH_TYPES.RETURN : LAUNCH_TYPES.FIRST;
    this.returned = false;
    this.lastActiveAt = parseInt(readStored(STORAGE.lastActiveAt), 10) || null;
    this._refreshSessionStatus();
    this._notify();
    return this;
  }

  /**
   * Derive the session status from the last-active clock. No stamp yet
   * (first load, before any interaction) = UNKNOWN — the UI must not
   * guess between active and stale before there is a fact to judge on.
   */
  _refreshSessionStatus() {
    if (!this.lastActiveAt) {
      this.sessionStatus = SESSION_STATUS.UNKNOWN;
      return;
    }
    const idle = Date.now() - this.lastActiveAt;
    this.sessionStatus = (STALE_AFTER_MS > 0 && idle > STALE_AFTER_MS)
      ? SESSION_STATUS.STALE
      : SESSION_STATUS.ACTIVE;
  }

  /**
   * PUBLIC — record a meaningful user interaction. Advances the
   * last-active clock, flips the session back to ACTIVE, and persists
   * (throttled — each write fans out a storage event to other tabs).
   * Call from the UI on scroll / pointer / key (or from the app's own
   * activity tracking); callers may throttle as they see fit — the
   * manager never double-writes within PERSIST_THROTTLE.
   *
   * Subscribers are NOT notified on every call — only on a meaningful
   * change: a status transition (STALE/UNKNOWN → ACTIVE) or when the
   * stamp actually persisted. A scroll-interval caller therefore never
   * floods the App Controller's re-emit to the UI.
   */
  noteActive() {
    const now = Date.now();
    const wasStaleOrUnknown = this.sessionStatus !== SESSION_STATUS.ACTIVE;
    this.lastActiveAt = now;
    this.sessionStatus = SESSION_STATUS.ACTIVE;
    let persisted = false;
    if (now - this._lastPersist >= PERSIST_THROTTLE) {
      this._lastPersist = now;
      writeStored(STORAGE.lastActiveAt, String(now));
      persisted = true;
    }
    if (wasStaleOrUnknown || persisted) {
      this._notify();
    }
  }

  /**
   * PUBLIC ABSTRACTION — is this a RETURN launch? The app has run on
   * this device before, so a restore point MAY exist (getRestorePoint()
   * answers that; the manager never assumes). A FIRST launch has no
   * restore point by definition.
   */
  isRelaunch() {
    return this.launchType === LAUNCH_TYPES.RETURN;
  }

  /**
   * PUBLIC ABSTRACTION — is the session STALE? The user was away
   * longer than CONTINUITY_POLICY.staleAfterMs. The UI should
   * re-validate the auth session (and its own caches) before the user
   * continues — a stale session is exactly where a dead token hides.
   */
  isStale() {
    return this.sessionStatus === SESSION_STATUS.STALE;
  }

  /**
   * PUBLIC — the persisted restore point (activeTab, lang, scroll,
   * drafts…) — DELEGATED to appStateStore, never re-implemented here.
   * Async (IndexedDB). Returns the appStateStore shape or a fresh
   * empty state when none exists / it expired (24h TTL).
   */
  async getRestorePoint() {
    const { restoreAppState } = await import('../../services/appStateStore.js');
    return restoreAppState();
  }

  /**
   * PUBLIC — persist a patch to the restore point — DELEGATED to
   * appStateStore (same async contract). The UI saves where the user
   * is via this method so no component touches appStateStore directly.
   *
   * ⚠️ CONTINUITY STATE discipline: only save MEANINGFUL keys (route,
   * workspace, selected entity, draft INDEX — see continuityTypes.js
   * CONTINUITY_STATE_VERSION). Never serialize React state into the
   * restore point.
   */
  async saveRestorePoint(patch) {
    const { saveAppState } = await import('../../services/appStateStore.js');
    return saveAppState(patch);
  }

  /**
   * PUBLIC — save the WORKSPACE slice of the continuity state
   * (studio section + media sub-tab). The Studio calls this when the
   * user navigates between sections so a relaunch can put them back
   * on the same workspace tab. Kept as its own façade so the Studio
   * never imports appStateStore and never thinks about the shape.
   *
   * READ-MERGE-WRITE: saveAppState replaces the whole top-level key,
   * so a { mediaTab } save must NOT wipe a previously saved
   * { section } (and vice versa) — the two CreatorStudio callers each
   * write one key of the same workspace slice.
   */
  async saveWorkspaceState(workspace) {
    if (!workspace || typeof workspace !== 'object') { return null; }
    const point = await this.getRestorePoint().catch(() => null);
    const cur = point && point.workspace && typeof point.workspace === 'object'
      ? point.workspace
      : {};
    const next = {
      ...(typeof workspace.section === 'string' ? { section: workspace.section } : (cur.section !== undefined ? { section: cur.section } : {})),
      ...(typeof workspace.mediaTab === 'string' ? { mediaTab: workspace.mediaTab } : (cur.mediaTab !== undefined ? { mediaTab: cur.mediaTab } : {})),
    };
    // Never write an empty workspace slice (no section, no mediaTab).
    if (!next.section && !next.mediaTab) { return null; }
    return this.saveRestorePoint({ workspace: next });
  }

  /**
   * PUBLIC — record the most recent DRAFT id in the continuity state
   * (the draft INDEX only — the content lives in the draftStore). The
   * banner reads this to announce "an unsaved draft is saved"; the
   * form layer calls it on autosave. Fire-and-forget friendly.
   */
  async noteDraft(formId) {
    if (typeof formId !== 'string' || !formId) { return null; }
    return this.saveRestorePoint({ lastDraftId: formId });
  }

  /**
   * PUBLIC — save the SELECTED-ENTITY slice (what the user was
   * editing/opening: e.g. a media item or a project). The entity is
   * identified by { type, id } — identity only, never its payload
   * (the payload is re-fetched on restore; stale copies are a
   * continuity anti-pattern).
   */
  async saveSelectedEntity(entity) {
    if (!entity || !entity.id) { return null; }
    return this.saveRestorePoint({
      selectedEntity: {
        type: typeof entity.type === 'string' ? entity.type : 'item',
        id: entity.id,
      },
    });
  }

  /**
   * PUBLIC — persist the LAST ROUTE (full path incl. query) as the
   * route slice of the continuity state. The Studio/App calls this on
   * navigation so a relaunch can deep-link back. Meaningful identity
   * only — never the route's component state.
   */
  async saveLastRoute(path) {
    if (typeof path !== 'string' || !path) { return null; }
    return this.saveRestorePoint({ lastRoute: path });
  }

  /**
   * PUBLIC — record that a restore just happened (and why). The
   * restore point carries recovery metadata (recovery.at/reason) so
   * the next relaunch can word the banner honestly ("a new version
   * installed" vs "you were offline").
   */
  async noteRestore(reason) {
    const r = RESTORE_REASONS[reason] ? reason : RESTORE_REASONS.RELOAD;
    return this.saveRestorePoint({
      recovery: { at: Date.now(), reason: r },
    });
  }

  /**
   * PUBLIC — persist a route's scroll position — DELEGATED to
   * appStateStore (same async contract). Call from a throttled scroll
   * listener; the app never touches appStateStore directly.
   */
  async saveScrollPosition(route, scrollY) {
    const { saveScrollPosition } = await import('../../services/appStateStore.js');
    return saveScrollPosition(route, scrollY);
  }

  /**
   * PUBLIC — restore a route's saved scroll position (0 when none
   * exists). Pair with saveScrollPosition(); the restore point owns
   * the per-route scroll map (_scrollPositions).
   */
  async restoreScrollPosition(route) {
    const { restoreScrollPosition } = await import('../../services/appStateStore.js');
    return restoreScrollPosition(route);
  }

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /** Current immutable-ish snapshot for consumers. */
  getState() {
    return {
      // 'first' — the app has never run on this device (fresh install
      // / cleared data). 'return' — it has run before; a restore
      // point may exist (getRestorePoint()).
      launchType: this.launchType,
      // How many times this device has launched atelnyo.
      launchCount: this.launchCount,
      // Epoch ms of the very first launch on this device.
      firstSeenAt: this.firstSeenAt,
      // Epoch ms of the last recorded user interaction (null = none).
      lastActiveAt: this.lastActiveAt,
      // 'active' | 'stale' | 'unknown' — derived from the last-active
      // clock vs CONTINUITY_POLICY.staleAfterMs.
      sessionStatus: this.sessionStatus,
      // True right after a hidden→visible return (gap ≥ threshold) —
      // the UI may re-validate the session on this signal.
      returned: this.returned === true,
      // This session is running in an installed-app WINDOW — read from
      // the Installation Manager, never re-detected here.
      isAppWindow: installationManager.getState().isAppWindow === true,
      // The app is installed on this device (IM public abstraction).
      installed: installationManager.isInstalled(),
    };
  }

  /**
   * PUBLIC — FULL TEARDOWN (tests / HMR): detach every listener, reset
   * the machine to the honest pre-init state, and release all
   * subscribers. After destroy(), ``init()`` re-wires everything for a
   * fresh lifecycle. Idempotent and safe to call at any time.
   */
  destroy() {
    if (typeof window === 'undefined') return this;
    if (this._onVisibility) {
      document.removeEventListener('visibilitychange', this._onVisibility);
    }
    if (this._onReturn) {
      window.removeEventListener('focus', this._onReturn);
      window.removeEventListener('pageshow', this._onReturn);
    }
    if (this._onPageHide) {
      window.removeEventListener('pagehide', this._onPageHide);
    }
    if (this._onStorage) {
      window.removeEventListener('storage', this._onStorage);
    }
    this._onVisibility = null;
    this._onReturn = null;
    this._onPageHide = null;
    this._onStorage = null;
    this._hiddenAt = null;
    this.launchType = LAUNCH_TYPES.FIRST;
    this.launchCount = 0;
    this.firstSeenAt = null;
    this.lastActiveAt = null;
    this.sessionStatus = SESSION_STATUS.UNKNOWN;
    this.returned = false;
    this._lastPersist = 0;
    this._inited = false;
    this._listeners.clear();
    return this;
  }

  _notify() {
    this._listeners.forEach((fn) => {
      try {
        fn(this.getState());
      } catch (_) { /* a bad listener must not break the machine */ }
    });
  }
}

/** Process-wide singleton. init() runs at import on the client. */
export const continuityManager = new ContinuityManager();
if (typeof window !== 'undefined') {
  continuityManager.init();
}

export default continuityManager;
