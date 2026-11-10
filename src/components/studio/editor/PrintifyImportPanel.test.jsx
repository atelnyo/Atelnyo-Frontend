import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../services/api', () => ({
  marketplaceService: {
    printifyConnection: vi.fn(),
    printifyProducts: vi.fn(),
    printifyImport: vi.fn(),
    printifySetupWebhooks: vi.fn(),
  },
}));

import { marketplaceService } from '../../../services/api';
import PrintifyImportPanel from './PrintifyImportPanel';

describe('PrintifyImportPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports selected products and updates the list without fetching the shop twice', async () => {
    marketplaceService.printifyConnection.mockResolvedValue({
      data: { connected: true, shop_id: '42', shop_title: 'My Shop' },
    });
    marketplaceService.printifyProducts.mockResolvedValue({
      data: {
        results: [{
          printify_product_id: 'pf_1',
          title: 'Logo Tee',
          price: '19.99',
          image_url: '',
          stock: 5,
          imported: false,
        }],
      },
    });
    marketplaceService.printifyImport.mockResolvedValue({
      data: { imported: [{ id: 900, title: 'Logo Tee', created: true }] },
    });
    const onImported = vi.fn();

    render(<PrintifyImportPanel isHt={false} onImported={onImported} />);
    expect(await screen.findByText('My Shop')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Load products' }));
    fireEvent.click(await screen.findByLabelText('Logo Tee'));
    fireEvent.click(screen.getByRole('button', { name: 'Import selected (1)' }));

    expect(await screen.findByText(/Import complete:/)).toBeTruthy();
    expect(marketplaceService.printifyImport).toHaveBeenCalledWith(
      ['pf_1'],
      ['description', 'images', 'variants', 'stock', 'tags', 'shipping'],
    );
    expect(onImported).toHaveBeenCalledWith([{ id: 900, title: 'Logo Tee', created: true }]);
    expect(await screen.findByText('Imported')).toBeTruthy();
    await waitFor(() => expect(marketplaceService.printifyProducts).toHaveBeenCalledTimes(1));
  });

  it('keeps order tracking optional until the seller explicitly opens and configures it', async () => {
    marketplaceService.printifyConnection.mockResolvedValue({
      data: { connected: true, shop_id: '42', shop_title: 'My Shop' },
    });

    render(<PrintifyImportPanel isHt={false} />);
    expect(await screen.findByText('My Shop')).toBeTruthy();
    expect(marketplaceService.printifySetupWebhooks).not.toHaveBeenCalled();
    const trackingDetails = screen.getByText('Order tracking setup (optional)').closest('details');
    expect(trackingDetails.open).toBe(false);

    fireEvent.click(screen.getByText('Order tracking setup (optional)'));
    expect(screen.getByText(/configure PRINTIFY_WEBHOOK_SECRET/i)).toBeTruthy();
  });

  it('asks for a refresh when the server imports fewer products than selected', async () => {
    marketplaceService.printifyConnection.mockResolvedValue({
      data: { connected: true, shop_id: '42', shop_title: 'My Shop' },
    });
    marketplaceService.printifyProducts.mockResolvedValue({
      data: {
        results: [
          { printify_product_id: 'pf_1', title: 'Logo Tee', price: '19.99', stock: 5, imported: false },
          { printify_product_id: 'pf_2', title: 'Logo Hoodie', price: '29.99', stock: 3, imported: false },
        ],
      },
    });
    marketplaceService.printifyImport.mockResolvedValue({
      data: { imported: [{ id: 900, title: 'Logo Tee', created: true }] },
    });

    render(<PrintifyImportPanel isHt={false} />);
    expect(await screen.findByText('My Shop')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Load products' }));
    fireEvent.click(await screen.findByLabelText('Logo Tee'));
    fireEvent.click(screen.getByLabelText('Logo Hoodie'));
    fireEvent.click(screen.getByRole('button', { name: 'Import selected (2)' }));

    expect(await screen.findByText('Refresh the list to verify imported product statuses.')).toBeTruthy();
    expect(screen.queryByText('Imported')).toBeNull();
  });
});
