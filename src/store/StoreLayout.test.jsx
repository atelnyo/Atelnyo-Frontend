// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import StoreLayout from './StoreLayout';
import { useAuthStore } from './useAuthStore';

const logout = vi.fn();

const renderStore = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/account']}>
        <Routes>
          <Route path="/account" element={<StoreLayout />}>
            <Route index element={<p>ACCOUNT PAGE</p>} />
          </Route>
          <Route path="/store" element={<p>STORE HOME</p>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

describe('StoreLayout sign out', () => {
  beforeEach(() => {
    logout.mockReset().mockResolvedValue(undefined);
    useAuthStore.setState({
      user: { id: 1, username: 'amy', email: 'amy@example.com' },
      logout,
    });
  });

  it('shows a sign-out button in the header and signs the shopper out', async () => {
    renderStore();

    expect(screen.getByText('ACCOUNT PAGE')).toBeTruthy();
    // The header action and the menu item both say Sign out; the header one
    // carries the title we assert on here.
    const button = screen.getByTitle('Sign out');
    expect(button).toBeTruthy();

    fireEvent.click(button);

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('STORE HOME')).toBeTruthy();
  });

  it('does not show sign out to a signed-out visitor', () => {
    useAuthStore.setState({ user: null, logout });
    renderStore();

    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
    expect(screen.getByTitle('Sign in')).toBeTruthy();
  });
});
