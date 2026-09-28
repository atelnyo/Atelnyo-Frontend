/**
 * src/utils/history.test.jsx
 *
 * Pins the "login must return you to where you were" contract:
 *   • requireLogin() carries the current path+search as ``state.from``
 *     so the auth route can send the user back after sign-in.
 *   • The AuthGate → AuthRoute round trip: an anonymous visitor bounced
 *     from a gated page to /login returns to THAT page after logging in
 *     (never dumped on the Explore home).
 */
import React, { useState } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { requireLogin } from './history';

describe('requireLogin', () => {
  it('carries the current path + search as state.from', () => {
    const navigate = vi.fn();
    requireLogin(navigate, { pathname: '/python-avanse@rose/course', search: '?tab=courses' }, '/login');
    expect(navigate).toHaveBeenCalledWith('/login', {
      state: { from: '/python-avanse@rose/course?tab=courses' },
    });
  });

  it('omits state when there is no location', () => {
    const navigate = vi.fn();
    requireLogin(navigate, null, '/login');
    expect(navigate).toHaveBeenCalledWith('/login', undefined);
  });
});

// ─── Mirrors App.jsx AuthGate + AuthRoute ─────────────────────────────
function AuthGate({ user }) {
  const location = useLocation();
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }
  return <div data-testid="gated">GATED_PAGE</div>;
}

function AuthRoute({ user, onLogin }) {
  const navigate = useNavigate();
  const location = useLocation();
  if (user) {
    const from = location.state?.from;
    const isAuthPath = from && from.startsWith('/login');
    if (from && !isAuthPath) {
      navigate(from, { replace: true });
      return null;
    }
    return <Navigate to="/" replace />;
  }
  return (
    <div data-testid="auth-form">
      AUTH_FORM
      <button type="button" onClick={onLogin}>login</button>
    </div>
  );
}

function Harness() {
  const [user, setUser] = useState(null);
  return (
    <Routes>
      <Route path="/studio" element={<AuthGate user={user}><div>GATED</div></AuthGate>} />
      <Route path="/login" element={<AuthRoute user={user} onLogin={() => setUser({ id: 1 })} />} />
      <Route path="*" element={<div data-testid="home">HOME</div>} />
    </Routes>
  );
}

describe('auth round-trip restore', () => {
  it('anonymous visitor on a gated page returns there after login', () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <MemoryRouter initialEntries={['/studio']}>
        <Harness />
      </MemoryRouter>,
    );

    // AuthGate bounces to the auth form, carrying ``from``.
    expect(getByTestId('auth-form')).toBeTruthy();

    // Log in — must return to /studio, not the home page.
    fireEvent.click(getByText('login'));
    expect(getByTestId('gated')).toBeTruthy();
    expect(queryByTestId('home')).toBeNull();
    expect(queryByTestId('auth-form')).toBeNull();
  });

  it('a fresh /login visit (no from) sends the user home after login', () => {
    const { getByTestId, getByText } = render(
      <MemoryRouter initialEntries={['/login']}>
        <Harness />
      </MemoryRouter>,
    );

    expect(getByTestId('auth-form')).toBeTruthy();
    fireEvent.click(getByText('login'));
    expect(getByTestId('home')).toBeTruthy();
  });
});
