/**
 * ProductsSection — management table behaviour.
 *
 * Covers the three controls that make a large product list usable:
 * instant search, status filters (including the no-match recovery), and
 * the optimistic publish/unpublish toggle.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ProductsSection from './ProductsSection';

vi.mock('../../../services/api', () => ({
  marketplaceService: {
    list: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { marketplaceService } from '../../../services/api';

const products = [
  {
    id: 1, title: 'Alpha Kit', slug: 'alpha-kit', kind: 'digital', price: '12.00',
    sales_count: 4, is_active: true,
  },
  {
    id: 2, title: 'Beta Pack', slug: 'beta-pack', kind: 'physical', price: '25.00',
    sales_count: 1, is_active: false,
  },
];

const renderSection = (showToast = vi.fn()) => render(
  <ProductsSection
    lang="en"
    t={{}}
    showToast={showToast}
    setShowProductModal={() => {}}
    onEdit={() => {}}
  />,
);

beforeEach(() => {
  vi.clearAllMocks();
  marketplaceService.list.mockResolvedValue({ data: { results: products } });
  marketplaceService.update.mockResolvedValue({ data: { id: 1, is_active: false } });
});

describe('ProductsSection management controls', () => {
  it('shows an error state and recovers with Try again', async () => {
    marketplaceService.list
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ data: { results: products } });

    renderSection();
    expect(await screen.findByText('Products could not be loaded.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Alpha Kit')).toBeInTheDocument();
    expect(marketplaceService.list).toHaveBeenCalledTimes(2);
  });

  it('links published products to their public store page, never drafts', async () => {
    renderSection();
    await screen.findByText('Alpha Kit');

    const link = screen.getByRole('link', { name: 'Alpha Kit' });
    expect(link.getAttribute('href')).toBe('/store/products/alpha-kit');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(screen.queryByRole('link', { name: 'Beta Pack' })).toBeNull();
  });

  it('filters instantly by search and status, then recovers with Clear filters', async () => {
    renderSection();
    await screen.findByText('Alpha Kit');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search products' }), {
      target: { value: 'beta' },
    });
    expect(screen.getByText('Beta Pack')).toBeInTheDocument();
    expect(screen.queryByText('Alpha Kit')).not.toBeInTheDocument();
    expect(screen.getByText('1 of 2 products')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Published' }));
    expect(screen.getByText('No products match your filters.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Alpha Kit')).toBeInTheDocument();
    expect(screen.getByText('Beta Pack')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search products' })).toHaveValue('');
  });

  it('shows only drafts through the status filter', async () => {
    renderSection();
    await screen.findByText('Alpha Kit');

    fireEvent.click(screen.getByRole('button', { name: 'Drafts' }));
    expect(screen.getByText('Beta Pack')).toBeInTheDocument();
    expect(screen.queryByText('Alpha Kit')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('Alpha Kit')).toBeInTheDocument();
    expect(screen.getByText('Beta Pack')).toBeInTheDocument();
  });

  it('sorts by price and status and exposes aria-sort', async () => {
    renderSection();
    await screen.findByText('Alpha Kit');

    const priceHeader = screen.getByRole('columnheader', { name: 'Price' });
    expect(priceHeader).toHaveAttribute('aria-sort', 'none');

    fireEvent.click(within(priceHeader).getByRole('button'));
    expect(priceHeader).toHaveAttribute('aria-sort', 'ascending');
    let rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Alpha Kit');

    fireEvent.click(within(priceHeader).getByRole('button'));
    expect(priceHeader).toHaveAttribute('aria-sort', 'descending');
    rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Beta Pack');

    const statusHeader = screen.getByRole('columnheader', { name: 'Status' });
    fireEvent.click(within(statusHeader).getByRole('button'));
    expect(statusHeader).toHaveAttribute('aria-sort', 'ascending');
    rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Beta Pack'); // draft before published

    // A new key starts ascending; two more clicks clear sorting and
    // restore the server's original order.
    fireEvent.click(within(priceHeader).getByRole('button'));
    expect(priceHeader).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(within(priceHeader).getByRole('button'));
    expect(priceHeader).toHaveAttribute('aria-sort', 'descending');
    fireEvent.click(within(priceHeader).getByRole('button'));
    expect(priceHeader).toHaveAttribute('aria-sort', 'none');
    rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Alpha Kit');
  });

  it('selects all visible rows and bulk-publishes only the drafts', async () => {
    const showToast = vi.fn();
    marketplaceService.list
      .mockResolvedValueOnce({ data: { results: products } })
      .mockResolvedValueOnce({
        data: { results: products.map((p) => ({ ...p, is_active: true })) },
      });

    renderSection(showToast);
    await screen.findByText('Alpha Kit');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all shown' }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Publish selected' }));
    expect(marketplaceService.update).toHaveBeenCalledTimes(1);
    expect(marketplaceService.update).toHaveBeenCalledWith(2, { is_active: true });

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('✅ 1 product published.', 'check-circle');
    });
  });

  it('shows an indeterminate header for a partial selection', async () => {
    renderSection();
    await screen.findByText('Alpha Kit');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Beta Pack' }));
    const header = screen.getByRole('checkbox', { name: 'Select all shown' });
    expect(header.indeterminate).toBe(true);
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    fireEvent.click(header);
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    const allHeader = screen.getByRole('checkbox', { name: 'Deselect all shown' });
    expect(allHeader).toBeChecked();
    expect(allHeader.indeterminate).toBe(false);
  });

  it('loads the next server page and dedupes appended rows', async () => {
    const extra = {
      id: 3, title: 'Gamma Mug', kind: 'physical', price: '9.00',
      sales_count: 0, is_active: true,
    };
    marketplaceService.list
      .mockResolvedValueOnce({
        data: { results: products, next: 'http://api/products/?page=2', count: 3 },
      })
      .mockResolvedValueOnce({
        data: { results: [extra, products[0]], next: null, count: 3 },
      });

    renderSection();
    await screen.findByText('Alpha Kit');

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Gamma Mug')).toBeInTheDocument();
    expect(screen.getByText('Alpha Kit')).toBeInTheDocument();
    expect(screen.getByText('3 of 3 products')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    expect(marketplaceService.list.mock.calls[1][0]).toEqual({
      page: 2, page_size: 100, mine: true,
    });
  });

  it('bulk-deletes the selection only after confirmation', async () => {
    const showToast = vi.fn();
    marketplaceService.list
      .mockResolvedValueOnce({ data: { results: products } })
      .mockResolvedValueOnce({ data: { results: [] } });
    marketplaceService.delete.mockResolvedValue({ data: {} });

    renderSection(showToast);
    await screen.findByText('Alpha Kit');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all shown' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Delete 2 products');
    expect(dialog).toHaveTextContent('"Alpha Kit", "Beta Pack"');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete 2' }));
    expect(marketplaceService.delete).toHaveBeenCalledTimes(2);
    expect(marketplaceService.delete).toHaveBeenCalledWith(1);
    expect(marketplaceService.delete).toHaveBeenCalledWith(2);

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('✅ 2 products deleted.', 'check-circle');
    });
    await waitFor(() => {
      expect(screen.queryByText('Alpha Kit')).not.toBeInTheDocument();
    });
  });

  it('restores and reselects a product when a bulk delete fails', async () => {
    const showToast = vi.fn();
    marketplaceService.list.mockResolvedValue({ data: { results: [products[0]] } });
    marketplaceService.delete.mockRejectedValueOnce({ response: { data: { detail: 'Nope.' } } });

    renderSection(showToast);
    await screen.findByText('Alpha Kit');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Alpha Kit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete 1' }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Could not delete 1 product.', 'circle-exclamation');
    });
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'Deselect Alpha Kit' })).toBeChecked();
    });
  });

  it('publishes a draft optimistically and reconciles with the server', async () => {
    const showToast = vi.fn();
    marketplaceService.list
      .mockResolvedValueOnce({ data: { results: products } })
      .mockResolvedValueOnce({
        data: {
          results: [
            { ...products[0], is_active: false },
            { ...products[1], is_active: true },
          ],
        },
      });

    renderSection(showToast);
    await screen.findByText('Beta Pack');

    fireEvent.click(screen.getByRole('button', { name: 'Publish Beta Pack' }));

    expect(marketplaceService.update).toHaveBeenCalledWith(2, { is_active: true });

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('✅ Product is now published!', 'eye');
      expect(screen.getByRole('button', { name: 'Unpublish Beta Pack' })).toBeInTheDocument();
    });
    expect(screen.getByText('2 of 2 products')).toBeInTheDocument();
  });

  it('rolls the toggle back when the server rejects it', async () => {
    const showToast = vi.fn();
    marketplaceService.update.mockRejectedValueOnce({
      response: { data: { detail: 'Not allowed.' } },
    });

    renderSection(showToast);
    await screen.findByText('Alpha Kit');

    fireEvent.click(screen.getByRole('button', { name: 'Unpublish Alpha Kit' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Unpublish Alpha Kit' })).toBeInTheDocument();
    });
    expect(showToast).toHaveBeenCalledWith('Not allowed.', 'circle-exclamation');
  });
});
