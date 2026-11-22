// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import StoreAccountPage from './StoreAccountPage';
import { useAuthStore } from './useAuthStore';

const listOrders = vi.fn();

vi.mock('./storeService', () => ({
  storeService: {
    listOrders: (...args) => listOrders(...args),
  },
}));

const renderAt = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/account']}>
        <Routes>
          <Route path="/account" element={<StoreAccountPage />} />
          <Route path="/store/login" element={<p>LOGIN PAGE</p>} />
          <Route path="/business/orders/mine" element={<p>MY ORDERS PAGE</p>} />
          <Route path="/business/orders/mine/:orderId" element={<p>ORDER DETAIL PAGE</p>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

describe('StoreAccountPage', () => {
  beforeEach(() => {
    listOrders.mockReset();
    listOrders.mockResolvedValue({ data: { results: [] } });
    useAuthStore.setState({ user: null, loading: false });
  });

  it('sends an anonymous visitor to sign in', () => {
    renderAt();
    expect(screen.getByText('LOGIN PAGE')).toBeTruthy();
    expect(listOrders).not.toHaveBeenCalled();
  });

  it('shows the signed-in user name and email', async () => {
    useAuthStore.setState({
      user: { id: 1, username: 'amy', display_name: 'Amy', email: 'amy@example.com' },
    });
    renderAt();
    expect(screen.getByText('Amy')).toBeTruthy();
    expect(screen.getByText('amy@example.com')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    // The old link-only surface is now backed by the real list.
    expect(screen.getByRole('link', { name: 'View all orders' }).getAttribute('href'))
      .toBe('/business/orders/mine');
    expect(await screen.findByText(/No orders yet/)).toBeTruthy();
  });

  it('lists the shopper orders with status, items and a detail link', async () => {
    listOrders.mockResolvedValue({
      data: {
        results: [{
          id: 42,
          status: 'paid',
          total: '25.00',
          created_at: '2026-11-01T10:00:00Z',
          items: [{ id: 1, product_title: 'Book', quantity: 2 }],
        }],
      },
    });
    useAuthStore.setState({ user: { id: 1, username: 'amy', email: 'amy@example.com' } });

    renderAt();

    const orderLink = await screen.findByRole('link', { name: 'Order #42' });
    expect(orderLink.getAttribute('href')).toBe('/business/orders/mine/42');
    expect(screen.getByText('Paid')).toBeTruthy();
    expect(screen.getByText(/Book ×2/)).toBeTruthy();
    expect(screen.getByText(/\$25\.00/)).toBeTruthy();
  });
});
