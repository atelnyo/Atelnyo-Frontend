// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

const loginMock = vi.fn();
const setUserMock = vi.fn();
const applyTokenPairMock = vi.fn();
let googleSuccess = null;

vi.mock('./useAuthStore', () => {
  const state = {
    user: null,
    login: (...args) => loginMock(...args),
    setUser: (...args) => setUserMock(...args),
  };
  const useAuthStore = (selector) => selector(state);
  useAuthStore.setState = () => {};
  return { useAuthStore: Object.assign(useAuthStore, { getState: () => state }) };
});

vi.mock('../services/api', () => ({
  applyTokenPair: (...args) => applyTokenPairMock(...args),
}));

vi.mock('../components/auth/useGoogleAuth', () => ({
  default: (opts) => {
    googleSuccess = opts.onLoginSuccess;
    return { googleRef: { current: null }, googleLoading: false };
  },
}));

import StoreLoginPage from './StoreLoginPage';

const renderAt = (path = '/store/login') =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/store/login" element={<StoreLoginPage />} />
          <Route path="/store" element={<p>STORE HOME</p>} />
          <Route path="/store/cart" element={<p>CART PAGE</p>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

describe('StoreLoginPage', () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  it('shows a store-specific sign-in form', () => {
    renderAt();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByLabelText('Email or username')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
  });

  it('stores the Google session and returns to the store on Google success', async () => {
    renderAt();
    expect(googleSuccess).toBeTypeOf('function');
    googleSuccess({ id: 7, username: 'amy' }, { access: 'a1', refresh: 'r1', user: { id: 7 } });
    expect(applyTokenPairMock).toHaveBeenCalledWith({ access: 'a1', refresh: 'r1', user: { id: 7, username: 'amy' } });
    expect(setUserMock).toHaveBeenCalledWith({ id: 7, username: 'amy' });
    expect(await screen.findByText('STORE HOME')).toBeTruthy();
  });

  it('asks for both fields before submitting', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(loginMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/enter your email/i);
  });

  it('signs in and returns to the store on success', async () => {
    loginMock.mockResolvedValue({ id: 1 });
    renderAt();
    fireEvent.change(screen.getByLabelText('Email or username'), { target: { value: 'amy@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('STORE HOME')).toBeTruthy();
    expect(loginMock).toHaveBeenCalledWith({ username: 'amy@example.com', email: 'amy@example.com', password: 'secret' });
  });

  it('shows an error and stays on the form when sign-in fails', async () => {
    loginMock.mockRejectedValue({ response: { data: { detail: 'Invalid credentials' } } });
    renderAt();
    fireEvent.change(screen.getByLabelText('Email or username'), { target: { value: 'amy' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Invalid credentials'));
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy();
  });
});
