/**
 * src/components/common/AuthGate.jsx
 *
 * Reusable authentication gate for route protection.
 * Wraps any component that requires the user to be logged in.
 *
 * Usage:
 *   <AuthGate user={user}>
 *     <SensitiveComponent />
 *   </AuthGate>
 *
 * Props:
 *   user      — current user object (null = anonymous)
 *   children  — content to render when authenticated
 *   fallback  — optional custom redirect component (default: redirect to /sheet/auth)
 *   loading   — optional loading component to show while user is being determined
 *
 * Behavior:
 *   - user === null && !loading → redirect to /sheet/auth (with replace)
 *   - user !== null              → render children
 *   - loading === true           → show spinner (prevents flash)
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { SHEETS } from '../../routes/sheets';

export default function AuthGate({ user, children, fallback, loading }) {
  const location = useLocation();
  // While auth is still loading, show a spinner so we never flash
  // the login redirect on a legitimate session that hasn't resolved yet.
  if (loading) {
    return fallback || (
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

  if (!user) {
    // Carry the page the user was trying to reach in ``state`` so the
    // auth route can send them back once the session hydrates. Without
    // this, a logged-in user who RELOADS a gated page (e.g.
    // /sheet/studio) gets redirected here on first render (user is
    // still null while the session boots) and is left on the login
    // modal — even though their session is valid — because the auth
    // route has no idea where they came from.
    return (
      <Navigate
        to={SHEETS.AUTH}
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return children;
}