import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import api from '../../services/api';
import AdminSpotlightReview from './AdminSpotlightReview';

vi.mock('../../hooks/useHasAdminAccess', () => ({
  useHasAdminAccess: () => ({ isAdmin: true, loading: false }),
}));

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const APP = {
  id: 1,
  status: 'approved',
  is_archived: false,
  invention_title: 'Archive Me',
  invention_description: 'A public invention used to test the archive action.',
  category: 'talent',
  link_url: '',
  created_at: new Date().toISOString(),
  rejection_count: 0,
  message_count: 0,
  user: { username: 'creator' },
};

describe('AdminSpotlightReview', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
  });

  it('switches the detail panel to the archived state after archiving', async () => {
    let archived = false;
    api.get.mockImplementation(() => Promise.resolve({
      data: { results: [{ ...APP, is_archived: archived }] },
    }));
    api.post.mockImplementation(() => {
      archived = true;
      return Promise.resolve({ data: { ...APP, is_archived: true } });
    });

    render(
      <AdminSpotlightReview
        user={{ is_staff: true }}
        showToast={() => {}}
        onNavigate={() => {}}
      />,
    );

    await userEvent.click(await screen.findByRole('button', { name: /archive me/i }));
    await userEvent.click(await screen.findByRole('button', { name: /archive from public/i }));

    expect(api.post).toHaveBeenCalledWith('spotlight/1/archive/');
    expect(await screen.findByRole('button', { name: /restore to public/i })).toBeTruthy();
    expect(screen.getAllByText('Archived').length).toBeGreaterThan(0);
  });

  it('keeps the archive action visible when the request fails', async () => {
    api.get.mockResolvedValue({ data: { results: [APP] } });
    api.post.mockRejectedValue(new Error('network'));

    render(
      <AdminSpotlightReview
        user={{ is_staff: true }}
        showToast={() => {}}
        onNavigate={() => {}}
      />,
    );

    await userEvent.click(await screen.findByRole('button', { name: /archive me/i }));
    await userEvent.click(await screen.findByRole('button', { name: /archive from public/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /archive from public/i })).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: /restore to public/i })).toBeNull();
  });
});
