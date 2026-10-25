import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from './useAuthStore';
import { safeNextPath } from '../utils/safeNextPath';
import { applyTokenPair } from '../services/api';
import useGoogleAuth from '../components/auth/useGoogleAuth';

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

  // Google sign-in reuses the platform hook. On success the session is stored
  // the same way as the password login, then the store lets the user through.
  const onGoogleSuccess = (signedInUser, payload) => {
    applyTokenPair({ access: payload?.access, refresh: payload?.refresh, user: signedInUser });
    useAuthStore.getState().setUser(signedInUser);
    navigate(next, { replace: true });
  };
  const { googleRef, googleLoading } = useGoogleAuth({
    lang: 'en',
    onLoginSuccess: onGoogleSuccess,
    isLoading: busy,
  });

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
      <section className="store-auth__card">
      <h1 className="store-title">Sign in</h1>
      <div ref={googleRef} className="store-auth__google" aria-busy={googleLoading} />
      <p className="store-auth__or">or</p>
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
    </div>
  );
}
