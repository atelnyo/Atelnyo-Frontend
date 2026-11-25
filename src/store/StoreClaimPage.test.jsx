// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import StoreClaimPage from './StoreClaimPage';
import { useAuthStore } from './useAuthStore';

const claimOrder = vi.fn();
const requestClaimLink = vi.fn();
const login = vi.fn();

vi.mock('./storeService', () => ({
  storeService: {
    claimOrder: (...args) => claimOrder(...args),
    requestClaimLink: (...args) => requestClaimLink(...args),
  },
}));

const renderAt = (path = '/store/claim?order=7&token=abc') =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/store/claim" element={<StoreClaimPage />} />
          <Route path="/business/orders/mine" element={<p>MY ORDERS PAGE</p>} />
          <Route path="/store/login" element={<p>LOGIN PAGE</p>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

describe('StoreClaimPage', () => {
  beforeEach(() => {
    claimOrder.mockReset();
    requestClaimLink.mockReset();
    requestClaimLink.mockResolvedValue({ data: { detail: 'If those details match an unclaimed order, we emailed the link.' } });
    login.mockReset();
    login.mockResolvedValue({ id: 1, email: 'guest@test.local' });
    useAuthStore.setState({ user: null, loading: false, login });
  });

  it('creates the account, signs the shopper in, and links the order', async () => {
    claimOrder.mockResolvedValue({
      data: { created: true, email: 'guest@test.local', order_id: 7 },
    });
    renderAt();

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Sup3r-Secret-pass!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    // The order id comes from the query string, so it stays a string.
    await waitFor(() => expect(claimOrder).toHaveBeenCalledWith('7', 'abc', 'Sup3r-Secret-pass!'));
    // Auto sign-in uses the email the claim returned — no manual login step.
    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({ email: 'guest@test.local', password: 'Sup3r-Secret-pass!' }),
    );
    expect(await screen.findByText('Order linked')).toBeTruthy();
  });

  it('lets a signed-in shopper link the order without a password', async () => {
    useAuthStore.setState({
      user: { id: 1, email: 'owner@test.local' },
      login,
    });
    claimOrder.mockResolvedValue({
      data: { created: false, email: 'owner@test.local', order_id: 7 },
    });
    renderAt();

    expect(screen.queryByLabelText('Password')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Link order to my account' }));

    await waitFor(() => expect(claimOrder).toHaveBeenCalledWith('7', 'abc', ''));
    expect(login).not.toHaveBeenCalled();
    expect(await screen.findByRole('link', { name: 'View my orders' })).toBeTruthy();
  });

  it('offers sign-in when the email already has an account', async () => {
    claimOrder.mockRejectedValue({
      response: {
        data: {
          code: 'account_exists',
          detail: 'An account already exists for this email. Sign in to claim the order.',
        },
      },
    });
    renderAt();

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Sup3r-Secret-pass!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('link', { name: 'Sign in to claim this order' })).toBeTruthy();
  });

  it('lets a guest request a new link when the old one is missing', async () => {
    renderAt('/store/claim?order=7');

    expect(screen.getByText(/Lost the link/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'guest@test.local' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Email me the link' }));

    await waitFor(() =>
      expect(requestClaimLink).toHaveBeenCalledWith('7', 'guest@test.local'),
    );
    expect(await screen.findByText(/we emailed the link/)).toBeTruthy();
  });
});
