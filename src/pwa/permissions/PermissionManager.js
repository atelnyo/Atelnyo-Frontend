/**
 * src/pwa/permissions/PermissionManager.js
 *
 * PWA PERMISSION MANAGER — single source of truth for role-derived UI
 * gates (formerly src/utils/permissions.js, §6 step 6 of PWA_STATE).
 *
 * The matrix lives at GET /api/permissions/ (AllowAny) and is cached
 * in the manager so navigation across pages doesn't re-trigger the
 * fetch. The cache is invalidated only on:
 *   1. an explicit `refreshPermissionsMatrix()` call (used after
 *      login / logout so current_role flips), or
 *   2. fetch failure (silent fallback to an empty matrix so the FE
 *      degrades to "all gates = DENY", failing safe).
 *
 * This module is the PWA-subsystem home of that logic. It follows the
 * SAME reactive contract as the other PWA managers (Installation /
 * Continuity / Storage):
 *
 *   consumers subscribe via ``subscribe(cb)`` and always read the
 *   snapshot from ``getState()`` — no component owns permission state
 *   of its own. The old ``atelnyo:permissions:refreshed`` CustomEvent
 *   fan-out is REPLACED by the manager's subscriber list (the hooks in
 *   src/hooks/ use subscribe, they no longer listen for the event).
 *
 * ── PUBLIC API ─────────────────────────────────────────────────────
 *   init()                    — idempotent; exposes window.__permissionManager
 *   getState()                — { matrix, hydrated, loading, role }
 *   subscribe(cb)             — reactive updates (returns unsubscribe)
 *   ensurePermissionsMatrix() — one-shot fetcher (cached, deduped)
 *   refreshPermissionsMatrix()— force re-fetch + notify subscribers
 *   getCurrentRole()          — sync role ('anonymous' before hydrate)
 *   matrixPermits(action)     — sync permit lookup (true/false/null)
 *   destroy()                 — full teardown (tests / HMR); init() re-wires
 *
 * ⚠️ PermissionManager ≠ a hook. If a component needs a role-gate,
 *    use the hooks (src/hooks/useRoleGate.js / usePermissionsMatrix.js)
 *    which consume THIS manager via subscribe/getState. If a feature
 *    needs a synchronous deny-check without React state, use
 *    matrixPermits(action). The manager itself is React-free.
 *
 * Naming convention for matrix action keys (unchanged from the old
 * module — the BE contract is the source of truth):
 *   * Admin/moderation uses BE permission strings AS-IS (can_ban_user,
 *     can_suspend_user, …).
 *   * Self-service uses purely FE keys (apply_spotlight, apply_creator,
 *     …) — the BE enforces the underlying permission via ViewSet
 *     permission_classes; the matrix just tells the FE whether to
 *     render the button.
 */
import api from '../../services/api.js';

class PermissionManager {
  constructor() {
    this._inited = false;
    // The cached matrix payload (null = not fetched yet).
    this._matrix = null;
    // In-flight fetch promise — dedupes concurrent ensure() calls so
    // a burst of hook mounts fires ONE network round-trip.
    this._promise = null;
    // True once the matrix has resolved (success OR fail-safe {}).
    this._hydrated = false;
    this._listeners = new Set();
  }

  /** Idempotent. Exposes the debug handle. Returns `this`. */
  init() {
    if (this._inited || typeof window === 'undefined') return this;
    this._inited = true;
    // Dev/debug affordance: inspect the permission snapshot from the
    // console, e.g. ``window.__permissionManager.getState()``.
    try {
      window.__permissionManager = this;
    } catch (_) { /* ignore */ }
    return this;
  }

  /**
   * PUBLIC — one-shot fetcher. Subsequent calls return the cached
   * matrix without re-hitting the wire. Failures degrade to `{}` so
   * the FE defaults to deny — a network blip must never silently
   * grant access to admin-only surfaces.
   */
  async ensurePermissionsMatrix() {
    if (!this._matrix) {
      if (!this._promise) {
        this._promise = api
          .get('permissions/')
          .then((r) => {
            this._matrix = r?.data || {};
            this._hydrated = true;
            return this._matrix;
          })
          .catch(() => {
            // Fail-safe: empty matrix means ALL gates deny. The FE
            // then renders the "not yet verified" UX (spinner or
            // error toast) instead of unsupported affordances.
            this._matrix = {};
            this._hydrated = true;
            return this._matrix;
          });
      }
      await this._promise;
    }
    return this._matrix;
  }

  /**
   * PUBLIC — force a re-fetch. Called from App.jsx after login /
   * logout (via the axios interceptor clearing tokens) so a fresh
   * login re-hydrates with the new user's `current_role`. Notifies
   * every mounted subscriber once the new matrix lands (the old
   * CustomEvent fan-out, now the manager contract).
   */
  async refreshPermissionsMatrix() {
    this._matrix = null;
    this._promise = null;
    this._hydrated = false;
    const m = await this.ensurePermissionsMatrix();
    this._notify();
    return m;
  }

  /**
   * PUBLIC — synchronous role lookup from the cached matrix.
   * Returns 'anonymous' BEFORE the matrix has loaded so a render
   * gate never crashes with `undefined`. Callers that need to wait
   * should branch on `useRoleGate(...).loading === true`.
   */
  getCurrentRole() {
    const role = this._matrix?.current_role;
    if (role === null || role === undefined || role === '') {
      return 'anonymous';
    }
    return String(role);
  }

  /**
   * PUBLIC — permit lookup. Synchronous, returns `null` while the
   * matrix is still loading OR while the cached matrix is empty.
   * Use this to short-circuit a fetch loop without React state; for
   * most usage prefer `useRoleGate(action)`.
   */
  matrixPermits(action) {
    const role = this.getCurrentRole();
    const perms = this._matrix?.permissions;
    if (!perms) return null;
    const row = perms[action];
    if (!row) return false;
    return row[role] === true;
  }

  /** Current immutable-ish snapshot for consumers. */
  getState() {
    return {
      // The full role × action matrix payload (null before hydrate).
      matrix: this._matrix,
      // True once the matrix resolved (success OR fail-safe {}).
      hydrated: this._hydrated === true,
      // True while a fetch is pending (or before the first fetch).
      loading: this._hydrated !== true,
      // Current request role ('anonymous' | 'authenticated' |
      // 'creator' | 'staff' | 'admin'). Never nullish once loaded.
      role: this.getCurrentRole(),
    };
  }

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * PUBLIC — FULL TEARDOWN (tests / HMR): reset the cache and
   * release all subscribers. After destroy(), ``init()`` re-wires
   * for a fresh lifecycle. Idempotent and safe at any time.
   */
  destroy() {
    this._matrix = null;
    this._promise = null;
    this._hydrated = false;
    this._inited = false;
    this._listeners.clear();
    return this;
  }

  _notify() {
    this._listeners.forEach((fn) => {
      try {
        fn(this.getState());
      } catch (_) { /* a bad listener must not break the manager */ }
    });
  }
}

/** Process-wide singleton. init() runs at import on the client. */
export const permissionManager = new PermissionManager();
if (typeof window !== 'undefined') {
  permissionManager.init();
}

export default permissionManager;
