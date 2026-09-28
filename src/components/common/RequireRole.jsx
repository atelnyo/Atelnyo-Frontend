/**
 * src/components/common/RequireRole.jsx
 *
 * Reusable role-based gate for route protection.
 * Wraps any component that requires the user to hold a specific role.
 *
 * Usage:
 *   <RequireRole user={user} role="creator" redirect="/">
 *     <CreatorStudio />
 *   </RequireRole>
 *
 *   <RequireRole user={user} role="staff" redirect="/">
 *     <AdminDashboard />
 *   </RequireRole>
 *
 * Props:
 *   user      — current user object (null = anonymous)
 *   role      — required role string: 'creator', 'staff', 'admin'
 *   redirect  — fallback URL when gate is not met (default: '/')
 *   children  — content to render when authorized
 *   loading   — optional loading state
 *
 * Role detection:
 *   creator → user?.is_creator === true
 *   staff   → user?.is_staff === true || user?.is_superuser === true
 *   admin   → user?.is_superuser === true
 */
import React from 'react';
import { Navigate } from 'react-router-dom';

export default function RequireRole({ user, role, redirect = '/', children, loading }) {
  if (loading) {
    return (
      <div className="auth-gate-loading" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '80px 0', minHeight: '40vh',
      }}>
        <i className="fas fa-spinner fa-pulse fa-2x"
           style={{ color: 'var(--pink-primary, #d81b60)' }}
           aria-hidden="true" />
      </div>
    );
  }

  // No user → redirect
  if (!user) {
    return <Navigate to={redirect} replace />;
  }

  let authorized = false;
  switch (role) {
    case 'creator':
      authorized = user.is_creator === true;
      break;
    case 'staff':
      authorized = user.is_staff === true || user.is_superuser === true;
      break;
    case 'admin':
      authorized = user.is_superuser === true;
      break;
    default:
      authorized = false;
  }

  if (!authorized) {
    return <Navigate to={redirect} replace />;
  }

  return children;
}