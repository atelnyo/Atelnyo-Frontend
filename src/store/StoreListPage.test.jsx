// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import { clearRecentlyViewed, loadRecentlyViewed, recordRecentlyViewed } from './recentlyViewed';

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
    clearRecentlyViewed();
  });

  it('shows recently viewed products on the store home and clears them', async () => {
    listCategories.mockResolvedValue({ data: [] });
    listProducts.mockResolvedValue({ data: [] });
    recordRecentlyViewed({
      id: 9, slug: 'recent-kit', title: 'Recent Kit', price: '5.00', currency: 'USD',
    });

    renderAt('/store');

    expect(await screen.findByText('Recently viewed')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'View Recent Kit' });
    expect(link.getAttribute('href')).toBe('/store/products/recent-kit');

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByText('Recently viewed')).toBeNull();
    expect(loadRecentlyViewed()).toEqual([]);
  });

  it('retries a failed product load', async () => {
    listCategories.mockResolvedValue({ data: [] });
    listProducts
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ data: [{ id: 1, slug: 'poster', title: 'Poster', price: '10.00' }] });

    renderAt('/store');
    expect(await screen.findByText('Products could not be loaded. Please try again later.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Poster')).toBeTruthy();
    expect(listProducts).toHaveBeenCalledTimes(2);
  });

  it('offers to clear active filters when nothing matches', async () => {
    listCategories.mockResolvedValue({ data: [] });
    listProducts.mockResolvedValue({ data: [] });

    renderAt('/store?q=zzz&kind=digital');
    expect(await screen.findByText('No products found.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    await waitFor(() => expect(listProducts).toHaveBeenLastCalledWith({ kind: 'digital' }));
    expect(screen.getByRole('button', { name: 'Clear type filter' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Clear type filter' }));
    await waitFor(() => expect(listProducts).toHaveBeenLastCalledWith(undefined));
  });

  it('filters by product type and sends it to the backend', async () => {
    listCategories.mockResolvedValue({ data: [] });
    listProducts.mockResolvedValue({
      data: [{ id: 1, slug: 'poster', title: 'Poster', price: '10.00', kind: 'digital' }],
    });

    renderAt('/store?kind=digital');

    expect(await screen.findByText('Poster')).toBeTruthy();
    expect(listProducts).toHaveBeenCalledWith({ kind: 'digital' });
    const type = screen.getByRole('combobox', { name: 'Type' });
    expect(type.value).toBe('digital');

    fireEvent.change(type, { target: { value: 'physical' } });
    await waitFor(() => expect(listProducts).toHaveBeenLastCalledWith({ kind: 'physical' }));
  });

  it('searches from the toolbar and clears the query', async () => {
    listCategories.mockResolvedValue({ data: [] });
    listProducts.mockResolvedValue({
      data: [{ id: 1, slug: 'poster', title: 'Poster', price: '10.00' }],
    });

    renderAt('/store');

    const input = await screen.findByRole('searchbox', { name: 'Search products' });
    fireEvent.change(input, { target: { value: 'poster' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(listProducts).toHaveBeenLastCalledWith({ q: 'poster' }));
    expect(await screen.findByRole('searchbox', { name: 'Search products' })).toHaveValue('poster');
    expect(screen.getByText('Results for "poster"')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(listProducts).toHaveBeenLastCalledWith(undefined));
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('shows a not-found state for an unknown category slug', async () => {
    listCategories.mockResolvedValue({ data: [{ id: 1, slug: 'design' }] });

    renderAt('/store/categories/no-such-category');

    expect(await screen.findByText('Category not found')).toBeTruthy();
    expect(listProducts).not.toHaveBeenCalled();
  });

  it('lists only the products of a known category, filtered by category_id', async () => {
    listCategories.mockResolvedValue({ data: [{ id: 7, slug: 'design', name: 'Design' }] });
    listProducts.mockResolvedValue({
      data: [{ id: 3, slug: 'logo-kit', title: 'Logo Kit', price: '12.00', currency: 'USD' }],
    });

    renderAt('/store/categories/design');

    expect(await screen.findByText('Logo Kit')).toBeTruthy();
    expect(listProducts).toHaveBeenCalledWith({ category_id: 7 });
    expect(listCategories).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Design');
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

  it('sends the chosen sort order to the backend', async () => {
    listCategories.mockResolvedValue({ data: [] });
    listProducts.mockResolvedValue({ data: { count: 1, next: null, results: [{ id: 1, title: 'A', price: '1.00' }] } });

    renderAt('/store?ordering=price');

    expect(await screen.findByText('A')).toBeTruthy();
    expect(listProducts).toHaveBeenCalledWith({ ordering: 'price' });
    expect(screen.getByRole('combobox', { name: /sort by/i }).value).toBe('price');
    expect(screen.getByText('1 products')).toBeTruthy();
  });

  it('ignores an unknown sort value', async () => {
    listCategories.mockResolvedValue({ data: [] });
    listProducts.mockResolvedValue({ data: [{ id: 1, title: 'A', price: '1.00' }] });

    renderAt('/store?ordering=drop_table');

    expect(await screen.findByText('A')).toBeTruthy();
    expect(listProducts).toHaveBeenCalledWith(undefined);
  });

  it('shows next-page control when the backend reports a next page', async () => {
    listCategories.mockResolvedValue({ data: [] });
    listProducts.mockResolvedValue({
      data: { count: 25, next: 'https://api/x/?page=2', results: [{ id: 1, title: 'A', price: '1.00' }] },
    });

    renderAt('/store');

    expect(await screen.findByText('A')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' }).disabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Previous' }).disabled).toBe(true);
  });

  it('requests the page from the URL and disables Next on the last page', async () => {
    listCategories.mockResolvedValue({ data: [] });
    listProducts.mockResolvedValue({
      data: { count: 25, next: null, previous: 'x', results: [{ id: 2, title: 'B', price: '1.00' }] },
    });

    renderAt('/store?page=2');

    expect(await screen.findByText('B')).toBeTruthy();
    expect(listProducts).toHaveBeenCalledWith({ page: 2 });
    expect(screen.getByRole('button', { name: 'Next' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Previous' }).disabled).toBe(false);
  });
});
