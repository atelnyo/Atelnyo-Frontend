/**
 * src/hooks/useHasAdminAccess.js
 *
 * Checks if the current user has access to ANY admin surface.
 * Uses the server-computed `current_permissions` dict from
 * /api/permissions/ — this accounts for Django flags + AdminRole
 * table + per-role overrides.
 *
 * Replaces the fragile `user?.is_staff || user?.is_superuser`
 * pattern that ignores AdminRole-based permissions.
 *
 *   const { isAdmin, loading } = useHasAdminAccess();
 *
 * Returns:
 *   * isAdmin: true once resolved if user has any admin permission;
 *     false if anonymous/non-admin; null while loading.
 *   * loading: true while the permission matrix is being fetched.
 */
import { useState, useEffect } from 'react';
import permissionManager from '../pwa/permissions/PermissionManager.js';

// Any of these permissions means the user is "admin" for page-access purposes.
const ADMIN_ACTIONS = [
  'can_view_audit',
  'can_suspend_user',
  'can_ban_user',
  'can_resolve_reports',
  'can_manage_billing',
  'can_grant_admin_role',
  'can_manage_users',
  'view_admin_dashboard',
  'view_admin_review_queue',
  'manage_security_alerts',
  'manage_violations',
  'review_appeals',
  'can_broadcast',
  'can_ban_ip',
];

export function useHasAdminAccess() {
  const [snap, setSnap] = useState(() => permissionManager.getState());
  const [loading, setLoading] = useState(() => !permissionManager.getState().hydrated);

  useEffect(() => {
    let cancelled = false;
    const apply = (s) => {
      if (cancelled) return;
      setSnap(s);
      setLoading(!s.hydrated);
    };
    if (!permissionManager.getState().hydrated) {
      permissionManager.ensurePermissionsMatrix().then(() => {
        if (cancelled) return;
        apply(permissionManager.getState());
      });
    }
    const unsubscribe = permissionManager.subscribe(apply);
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  const matrix = snap.matrix;
  const isAdmin = loading
    ? null
    : !!(matrix && matrix.current_permissions &&
          ADMIN_ACTIONS.some((a) => matrix.current_permissions[a] === true));

  return { isAdmin, loading };
}

export default useHasAdminAccess;
