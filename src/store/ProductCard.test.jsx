// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const listFavorites = vi.fn();

vi.mock('./storeService', () => ({
  storeService: {
    listFavorites: (...args) => listFavorites(...args),
    addFavorite: vi.fn(),
    removeFavorite: vi.fn(),
  },
}));

vi.mock('./useAuthStore', () => ({
  useAuthStore: (selector) => selector({ user: null }),
}));

import ProductCard from './ProductCard';

const PRODUCT = {
  id: 5,
  slug: 'poster',
  title: 'Poster',
  price: '20.00',
  currency: 'USD',
  stock: 10,
  image_url: 'https://example.test/a.png',
  gallery: [],
  variants: [],
  review_count: 0,
  avg_rating: 0,
  created_at: new Date().toISOString(),
};

const renderCard = (product = PRODUCT) => render(
  <MemoryRouter>
    <ul><ProductCard product={product} /></ul>
  </MemoryRouter>,
);

describe('ProductCard', () => {
  beforeEach(() => {
    listFavorites.mockReset().mockResolvedValue({ data: [] });
  });

  it('keeps the favorite control outside the product link', () => {
    renderCard();

    const link = screen.getByRole('link', { name: 'View Poster' });
    const favorite = screen.getByRole('button', { name: 'Save to favorites' });

    expect(link.contains(favorite)).toBe(false);
    expect(link.getAttribute('href')).toBe('/store/products/poster');
  });

  it('falls back to a placeholder when the cover image fails', async () => {
    const { container } = renderCard();

    fireEvent.error(screen.getByAltText('Poster'));

    await waitFor(() => {
      expect(container.querySelector('.store-card__img--empty')).toBeTruthy();
    });
  });

  it('links the seller to their storefront from the card', () => {
    renderCard({ ...PRODUCT, seller_username: 'atelier-rose' });

    const seller = screen.getByRole('link', { name: 'by @atelier-rose' });
    expect(seller.getAttribute('href')).toBe('/store/sellers/atelier-rose');
    expect(screen.getByRole('link', { name: 'View Poster' }).contains(seller)).toBe(false);
  });

  it('omits the seller line when the product has no seller username', () => {
    renderCard();

    expect(screen.queryByText(/^by @/)).toBeNull();
  });

  it('disables add-to-cart for an out-of-stock product', () => {
    renderCard({ ...PRODUCT, stock: 0 });

    const button = screen.getByRole('button', { name: 'Unavailable' });
    expect(button.disabled).toBe(true);
  });
});
