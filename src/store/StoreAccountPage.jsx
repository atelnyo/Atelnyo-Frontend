import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from './useAuthStore';

export default function StoreAccountPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  if (!user) {
    return <Navigate to="/store/login?next=%2Faccount" replace />;
  }

  const onSignOut = async () => {
    await logout();
    navigate('/store', { replace: true });
  };

  return (
    <section className="store-account">
      <Helmet>
        <title>Account · Atelnyo Store</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <h1 className="store-title">Account</h1>
      <dl>
        <dt>Name</dt>
        <dd>{user.display_name || user.username || '—'}</dd>
        <dt>Email</dt>
        <dd>{user.email || '—'}</dd>
      </dl>
      <button type="button" className="store-btn" onClick={onSignOut}>
        Sign out
      </button>
    </section>
  );
}
