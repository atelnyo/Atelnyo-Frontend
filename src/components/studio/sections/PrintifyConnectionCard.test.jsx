import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/api', () => ({
  marketplaceService: {
    printifyConnection: vi.fn(),
    printifyConnect: vi.fn(),
    printifyDisconnect: vi.fn(),
  },
}));

import { marketplaceService } from '../../../services/api';
import PrintifyConnectionCard from './PrintifyConnectionCard';

describe('PrintifyConnectionCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the shop when a connection is saved', async () => {
    marketplaceService.printifyConnection.mockResolvedValue({
      data: { connected: true, shop_id: '42', shop_title: 'My Shop' },
    });
    render(<PrintifyConnectionCard isHt={false} showToast={() => {}} />);
    expect(await screen.findByText('My Shop')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Printify API token')).toBeNull();
  });

  it('shows the token form only when nothing is connected', async () => {
    marketplaceService.printifyConnection.mockResolvedValue({ data: { connected: false } });
    render(<PrintifyConnectionCard isHt={false} showToast={() => {}} />);
    expect(await screen.findByPlaceholderText('Printify API token')).toBeTruthy();
  });

  it('shows a real error with retry instead of the token form when loading fails', async () => {
    marketplaceService.printifyConnection
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ data: { connected: true, shop_id: '42', shop_title: 'My Shop' } });
    render(<PrintifyConnectionCard isHt={false} showToast={() => {}} />);

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Printify API token')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('My Shop')).toBeTruthy();
    await waitFor(() => expect(marketplaceService.printifyConnection).toHaveBeenCalledTimes(2));
  });
});
