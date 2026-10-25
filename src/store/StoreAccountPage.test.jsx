// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import StoreAccountPage from './StoreAccountPage';
import { useAuthStore } from './useAuthStore';

const renderAt = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/account']}>
        <Routes>
          <Route path="/account" element={<StoreAccountPage />} />
          <Route path="/store/login" element={<p>LOGIN PAGE</p>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

describe('StoreAccountPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, loading: false });
  });

  it('sends an anonymous visitor to sign in', () => {
    renderAt();
    expect(screen.getByText('LOGIN PAGE')).toBeTruthy();
  });

  it('shows the signed-in user name and email', () => {
    useAuthStore.setState({
      user: { id: 1, username: 'amy', display_name: 'Amy', email: 'amy@example.com' },
    });
    renderAt();
    expect(screen.getByText('Amy')).toBeTruthy();
    expect(screen.getByText('amy@example.com')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
  });
});
