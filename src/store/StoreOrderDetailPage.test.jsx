// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import StoreOrderDetailPage from './StoreOrderDetailPage';
import { useAuthStore } from './useAuthStore';

const getOrder = vi.fn();

vi.mock('./storeService', () => ({
  storeService: {
    getOrder: (...args) => getOrder(...args),
  },
}));

const order = {
  id: 42,
  status: 'paid',
  created_at: '2026-11-01T10:00:00Z',
  subtotal: '20.00',
  shipping_total: '5.00',
  total: '25.00',
  shipping_address: {
    first_name: 'Amy',
    last_name: 'Jean',
    address1: '12 Rue Capois',
    city: 'Port-au-Prince',
    region: 'Ouest',
    zip: 'HT6110',
    country: 'HT',
  },
  tracking: {
    carrier: 'DHL',
    number: 'ABC123',
    url: 'https://track.example/ABC123',
    shipped_at: '2026-11-03T12:00:00Z',
  },
  printify_fulfillment: [],
  items: [{
    id: 1,
    product_title: 'Design pack',
    product_kind: 'digital',
    quantity: 1,
    unit_price: '20.00',
    download_url: 'https://cdn.example/signed',
  }],
};

const renderAt = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/account/orders/42']}>
        <Routes>
          <Route path="/account/orders/:orderId" element={<StoreOrderDetailPage />} />
          <Route path="/account" element={<p>ACCOUNT PAGE</p>} />
          <Route path="/store/login" element={<p>LOGIN PAGE</p>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

describe('StoreOrderDetailPage', () => {
  beforeEach(() => {
    getOrder.mockReset();
    getOrder.mockResolvedValue({ data: order });
    useAuthStore.setState({ user: null, loading: false });
  });

  it('sends an anonymous visitor to sign in with a way back', () => {
    renderAt();
    expect(screen.getByText('LOGIN PAGE')).toBeTruthy();
    expect(getOrder).not.toHaveBeenCalled();
  });

  it('shows the order, its tracking and the digital download', async () => {
    useAuthStore.setState({ user: { id: 1, username: 'amy' } });
    renderAt();

    expect(await screen.findByText('Order #42')).toBeTruthy();
    expect(screen.getAllByText('Paid').length).toBeGreaterThan(0);
    expect(screen.getByText('DHL')).toBeTruthy();
    expect(screen.getByText('ABC123')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Track package' }).getAttribute('href'))
      .toBe('https://track.example/ABC123');
    expect(screen.getByRole('link', { name: 'Download' }).getAttribute('href'))
      .toBe('https://cdn.example/signed');
    expect(screen.getByText(/12 Rue Capois/)).toBeTruthy();
    expect(screen.getAllByText('$25.00').length).toBeGreaterThan(0);
    expect(getOrder).toHaveBeenCalledWith('42');
  });

  it('shows a closure notice instead of progress steps for a cancelled order', async () => {
    getOrder.mockResolvedValue({
      data: { ...order, status: 'cancelled', tracking: null, items: [] },
    });
    useAuthStore.setState({ user: { id: 1, username: 'amy' } });
    renderAt();

    expect(await screen.findByText(/This order is cancelled/)).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Order progress' })).toBeNull();
  });
});
