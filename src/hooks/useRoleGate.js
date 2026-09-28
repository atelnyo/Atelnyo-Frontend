/**
 * src/hooks/useRoleGate.js
 *
 * React consumer of the PWA Permission Manager (src/pwa/permissions/
 * PermissionManager.js) — ported from src/utils/permissions.js (§6
 * step 6). The manager OWNS the matrix cache + fetch; this hook only
 * subscribes to it (no component owns permission state of its own).
 *
 *   const { allowed, loading, role } = useRoleGate('apply_spotlight');
 *
 * Returns:
 *   * allowed: `true`/`false` once the matrix resolves; `null` while
 *     it is still loading. The shape is `null`-then-bool so a caller
 *     NEVER sees a transient `undefined` that lets a user with a
 *     temporary matrix failure briefly gain access by truthy-coercing
 *     `if (allow && render)` patterns.
 *   * loading: `true` while the matrix fetch is pending. Callers that
 *     want to WAIT (no flicker) should render a spinner on it.
 *   * role: current request's role string ('anonymous', 'authenticated',
 *     'creator', 'staff', 'admin') — synchronous from the cached
 *     matrix, never nullish once loaded.
 *   * hasRole(r): role equality helper.
 *   * refresh(): force a re-fetch (delegates to the manager).
 */
import { useState, useEffect, useCallback } from 'react';
import permissionManager from '../pwa/permissions/PermissionManager.js';

export function useRoleGate(action) {
  const [snap, setSnap] = useState(() => permissionManager.getState());
  const [loading, setLoading] = useState(() => !permissionManager.getState().hydrated);

  useEffect(() => {
    let cancelled = false;

    const apply = (s) => {
      if (cancelled) return;
      setSnap(s);
      setLoading(!s.hydrated);
    };

    // Hydrate on first mount (lazy background fetch — same contract
    // as before: no eager fetch at module import).
    if (!permissionManager.getState().hydrated) {
      permissionManager.ensurePermissionsMatrix().then(() => {
        if (cancelled) return;
        apply(permissionManager.getState());
      });
    }

    // Re-read whenever the manager refreshes elsewhere (e.g. App.jsx
    // calls refreshPermissionsMatrix() after login) — the subscribe
    // contract replaces the old atelnyo:permissions:refreshed event.
    const unsubscribe = permissionManager.subscribe(apply);

    return () => { cancelled = true; unsubscribe(); };
  }, []);

  const matrix = snap.matrix;
  const role = snap.role;

  // PRIORITY 1: Use current_permissions (server-computed per-permission
  // boolean dict). This is the source of truth — it accounts for Django
  // flags + AdminRole table + per-role overrides. Falls back to the
  // static matrix for backward compatibility (anonymous users, old
  // responses without current_permissions).
  const allowed = loading
    ? null
    : (matrix &&
       matrix.current_permissions &&
       action in matrix.current_permissions
         ? matrix.current_permissions[action] === true
         : (matrix && matrix.permissions &&
            matrix.permissions[action] &&
            matrix.permissions[action][role] === true));

  const hasRole = useCallback(
    (r) => role === r,
    [role],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    const m = await permissionManager.refreshPermissionsMatrix();
    setSnap(permissionManager.getState());
    setLoading(false);
    return m;
  }, []);

  return { allowed, loading, role, hasRole, refresh };
}

export default useRoleGate;
