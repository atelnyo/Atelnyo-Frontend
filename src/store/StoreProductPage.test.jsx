// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

const getProduct = vi.fn();
const listFavorites = vi.fn();
const addFavorite = vi.fn();
const removeFavorite = vi.fn();
let mockUser = null;

vi.mock('./storeService', () => ({
  storeService: {
    getProduct: (...args) => getProduct(...args),
    listFavorites: (...args) => listFavorites(...args),
    addFavorite: (...args) => addFavorite(...args),
    removeFavorite: (...args) => removeFavorite(...args),
  },
}));

vi.mock('./useAuthStore', () => ({
  useAuthStore: (selector) => selector({ user: mockUser }),
}));

import StoreProductPage from './StoreProductPage';
import { loadCart, CART_STORAGE_KEY } from './cart';

const product = {
  id: 5,
  slug: 'poster',
  title: 'Poster',
  price: '20.00',
  currency: 'USD',
  stock: 10,
  image_url: 'https://example.test/a.png',
  gallery: [],
  description: `<p>${'Lorem ipsum dolor sit amet. '.repeat(20)}</p>`,
  variants: [
    { id: 50, name: 'Small', price: '18.00', stock: 3 },
    { id: 51, name: 'Large', price: '25.00', stock: 0 },
  ],
  review_count: 0,
  avg_rating: 0,
};

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/store/products/poster']}>
        <Routes>
          <Route path="/store/products/:slug" element={<StoreProductPage />} />
          <Route path="/store/cart" element={<p>CART PAGE</p>} />
          <Route path="/login" element={<p>LOGIN PAGE</p>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

describe('StoreProductPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUser = null;
    getProduct.mockReset().mockResolvedValue({ data: product });
    listFavorites.mockReset().mockResolvedValue({ data: [] });
    addFavorite.mockReset();
    removeFavorite.mockReset();
  });

  it('adds the selected variant and quantity to the cart', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Increase quantity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));

    expect(loadCart()).toEqual([{ productId: 5, variantId: 50, quantity: 2 }]);
    expect(await screen.findByText('Added to cart.')).toBeTruthy();
  });

  it('Buy now adds the item and opens the cart', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Buy now' }));

    expect(loadCart()).toEqual([{ productId: 5, variantId: 50, quantity: 1 }]);
    expect(await screen.findByText('CART PAGE')).toBeTruthy();
  });

  it('disables buying when the selected variant is out of stock', async () => {
    renderPage();
    const select = await screen.findByLabelText('Variant');
    fireEvent.change(select, { target: { value: '51' } });

    expect(screen.getByRole('button', { name: 'Add to cart' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Buy now' }).disabled).toBe(true);
    expect(screen.getByText('Out of stock')).toBeTruthy();
  });

  it('caps the quantity at the variant stock', async () => {
    renderPage();
    const inc = await screen.findByRole('button', { name: 'Increase quantity' });
    for (let i = 0; i < 5; i += 1) fireEvent.click(inc);

    expect(screen.getByText('3')).toBeTruthy();
    expect(inc.disabled).toBe(true);
  });

  it('asks signed-out users to log in before saving a favorite', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Save to favorites' }));

    expect(await screen.findByText('LOGIN PAGE')).toBeTruthy();
    expect(addFavorite).not.toHaveBeenCalled();
  });

  it('saves and removes a favorite for signed-in users', async () => {
    mockUser = { id: 1 };
    addFavorite.mockResolvedValue({ data: { id: 900, product: 5 } });
    removeFavorite.mockResolvedValue({ data: {} });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Save to favorites' }));
    expect(await screen.findByRole('button', { name: 'Saved' })).toBeTruthy();
    expect(addFavorite).toHaveBeenCalledWith(5);

    fireEvent.click(screen.getByRole('button', { name: 'Saved' }));
    await waitFor(() => expect(removeFavorite).toHaveBeenCalledWith(900));
    expect(await screen.findByRole('button', { name: 'Save to favorites' })).toBeTruthy();
  });

  it('shortens a long description and expands it with Show more', async () => {
    renderPage();
    const toggle = await screen.findByRole('button', { name: 'Show more' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Show less' })).toBeTruthy();
  });
});
