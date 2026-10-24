// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

const listCategories = vi.fn();
const listProducts = vi.fn();

vi.mock('./storeService', () => ({
  storeService: {
    listCategories: (...args) => listCategories(...args),
    listProducts: (...args) => listProducts(...args),
  },
}));

import StoreListPage from './StoreListPage';

const renderAt = (path) =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/store" element={<StoreListPage />} />
          <Route path="/store/categories/:categorySlug" element={<StoreListPage />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

describe('StoreListPage', () => {
  beforeEach(() => {
    listCategories.mockReset();
    listProducts.mockReset();
  });

  it('shows a not-found state for an unknown category slug', async () => {
    listCategories.mockResolvedValue({ data: [{ id: 1, slug: 'design' }] });

    renderAt('/store/categories/no-such-category');

    expect(await screen.findByText('Category not found')).toBeTruthy();
    expect(listProducts).not.toHaveBeenCalled();
  });

  it('lists only the products of a known category, filtered by category_id', async () => {
    listCategories.mockResolvedValue({ data: [{ id: 7, slug: 'design' }] });
    listProducts.mockResolvedValue({
      data: [{ id: 3, slug: 'logo-kit', title: 'Logo Kit', price: '12.00', currency: 'USD' }],
    });

    renderAt('/store/categories/design');

    expect(await screen.findByText('Logo Kit')).toBeTruthy();
    expect(listProducts).toHaveBeenCalledWith({ category_id: 7 });
  });

  it('shows a category bar that links to each category', async () => {
    listCategories.mockResolvedValue({
      data: [{ id: 7, slug: 'design', name: 'Design' }, { id: 8, slug: 'music', name: 'Music' }],
    });
    listProducts.mockResolvedValue({ data: [] });

    renderAt('/store');

    const nav = await screen.findByRole('navigation', { name: 'Categories' });
    expect(nav.querySelector('a[href="/store/categories/design"]').textContent).toBe('Design');
    expect(nav.querySelector('a[href="/store/categories/music"]')).toBeTruthy();
  });
});
