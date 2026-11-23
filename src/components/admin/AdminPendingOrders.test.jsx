// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';

const get = vi.fn();
const post = vi.fn();

vi.mock('../../services/api', () => ({
  default: {
    get: (...args) => get(...args),
    post: (...args) => post(...args),
  },
}));

import AdminPendingOrders from './AdminPendingOrders';

const ROW = {
  id: 12,
  status: 'pending',
  language: 'fr',
  created_at: '2026-11-22T10:00:00Z',
  total: '20.00',
  subtotal: '20.00',
  currency: 'USD',
  buyer_email: 'buyer@test.local',
  buyer_name: 'Awa',
  items: ['Tee ×2'],
  item_count: 2,
  age_minutes: 130,
  auto_cancel_at: '2026-11-23T10:00:00Z',
  last_payment_status: 'pending',
  last_payment_at: '2026-11-22T10:05:00Z',
};

describe('AdminPendingOrders', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    window.confirm = vi.fn(() => true);
  });

  it('lists unpaid orders and cancels one after confirmation', async () => {
    get.mockResolvedValue({
      data: { results: [ROW], count: 1, next: null },
    });
    post.mockResolvedValue({
      data: { id: 12, status: 'cancelled', restored_units: 2, email_sent: true },
    });
    const showToast = vi.fn();

    const { getByText, queryByText } = render(
      <AdminPendingOrders lang="en" showToast={showToast} />,
    );

    await waitFor(() => expect(getByText('buyer@test.local')).toBeTruthy());
    expect(getByText('Tee ×2')).toBeTruthy();
    expect(getByText('2h')).toBeTruthy();
    expect(get('admin/pending-orders/', { params: { page: 1 } })).toBeTruthy();

    fireEvent.click(getByText('Cancel'));

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith('admin/pending-orders/12/cancel/', {
        notify: true,
      });
    });
    expect(showToast).toHaveBeenCalled();
    await waitFor(() => expect(queryByText('buyer@test.local')).toBeNull());
    expect(getByText('No unpaid pending orders.')).toBeTruthy();
  });

  it('shows the conflict message when the order is no longer pending', async () => {
    get.mockResolvedValue({ data: { results: [ROW], count: 1, next: null } });
    post.mockRejectedValue({
      response: { data: { detail: 'This order is no longer pending.' } },
    });
    const showToast = vi.fn();

    const { getByText } = render(
      <AdminPendingOrders lang="en" showToast={showToast} />,
    );
    await waitFor(() => expect(getByText('buyer@test.local')).toBeTruthy());

    fireEvent.click(getByText('Cancel'));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        'This order is no longer pending.',
        'exclamation-triangle',
      );
    });
    // The row stays visible for a refresh instead of disappearing silently.
    expect(getByText('buyer@test.local')).toBeTruthy();
  });
});
