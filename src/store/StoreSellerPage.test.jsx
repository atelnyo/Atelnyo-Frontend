// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

const getSellerProfile = vi.fn();
const listSellerProducts = vi.fn();

vi.mock('./storeService', () => ({
  storeService: {
    getSellerProfile: (...args) => getSellerProfile(...args),
    listSellerProducts: (...args) => listSellerProducts(...args),
  },
}));

import StoreSellerPage from './StoreSellerPage';

const product = {
  id: 7,
  slug: 'linen-tee',
  title: 'Linen Tee',
  price: '24.00',
  currency: 'USD',
  stock: 5,
  seller_username: 'marie',
};

const renderAt = (path) =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/store/sellers/:username" element={<StoreSellerPage />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

describe('StoreSellerPage', () => {
  beforeEach(() => {
    getSellerProfile.mockReset();
    listSellerProducts.mockReset();
  });

  it('shows the seller identity and their live products', async () => {
    getSellerProfile.mockResolvedValue({
      data: { username: 'marie', display_name: 'Marie Atelier', bio: 'Hand-dyed linen.' },
    });
    listSellerProducts.mockResolvedValue({ data: { count: 1, next: null, results: [product] } });

    renderAt('/store/sellers/marie');

    expect(await screen.findByRole('heading', { name: 'Marie Atelier' })).toBeTruthy();
    expect(screen.getByText('@marie', { selector: '.store-seller__handle' })).toBeTruthy();
    expect(screen.getByText('Hand-dyed linen.')).toBeTruthy();
    expect(screen.getByText('1 product')).toBeTruthy();
    expect(listSellerProducts).toHaveBeenCalledWith('marie', undefined);
    const link = await screen.findByRole('link', { name: /Linen Tee/ });
    expect(link.getAttribute('href')).toBe('/store/products/linen-tee');
  });

  it('falls back to the username when the seller has no public profile', async () => {
    getSellerProfile.mockRejectedValue(new Error('404'));
    listSellerProducts.mockResolvedValue({ data: [product] });

    renderAt('/store/sellers/marie');

    expect(await screen.findByRole('heading', { name: '@marie' })).toBeTruthy();
    expect(await screen.findByRole('link', { name: /Linen Tee/ })).toBeTruthy();
  });

  it('retries a failed product load', async () => {
    getSellerProfile.mockResolvedValue({ data: { username: 'marie' } });
    listSellerProducts
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({ data: [product] });

    renderAt('/store/sellers/marie');

    expect(await screen.findByText("Could not load this seller's products.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: /Linen Tee/ })).toBeTruthy();
    expect(listSellerProducts).toHaveBeenCalledTimes(2);
  });
});
