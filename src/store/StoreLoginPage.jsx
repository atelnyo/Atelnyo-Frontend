import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from './useAuthStore';
import { safeNextPath } from '../utils/safeNextPath';

export default function StoreLoginPage() {
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = safeNextPath(searchParams.get('next')) || '/store';
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) {
    return <Navigate to={next} replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!identifier.trim() || !password) {
      setError('Enter your email or username and your password.');
      return;
    }
    setBusy(true);
    try {
      const signedIn = await login({ username: identifier.trim(), email: identifier.trim(), password });
      if (signedIn) {
        navigate(next, { replace: true });
        return;
      }
      setError('Sign-in failed. Check your details and try again.');
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.error;
      setError(typeof detail === 'string' ? detail : 'Sign-in failed. Check your details and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="store-root store-auth">
      <Helmet>
        <title>Sign in · Atelnyo Store</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <header className="store-header">
        <Link to="/store" className="store-header__brand">Atelnyo Store</Link>
      </header>
      <main className="store-main">
        <section className="store-auth__card">
          <h1 className="store-title">Sign in</h1>
          <form className="store-auth__form" onSubmit={onSubmit} noValidate>
            <label>
              <span>Email or username</span>
              <input
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && <p className="store-auth__error" role="alert">{error}</p>}
            <button type="submit" className="store-btn" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
