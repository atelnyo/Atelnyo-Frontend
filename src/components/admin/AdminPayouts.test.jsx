// @vitest-environment jsdom
/**
 * AdminPayouts — the staff withdrawal queue.
 *
 * Finance needs to see where the money must go, then close the request with
 * a provider reference (paid) or refund the creator's wallet (failed).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const payoutQueue = vi.fn();
const processPayout = vi.fn();

vi.mock('../../services/api', () => ({
  walletService: {
    payoutQueue: (...args) => payoutQueue(...args),
    processPayout: (...args) => processPayout(...args),
  },
}));

import AdminPayouts from './AdminPayouts';

const QUEUE = {
  data: {
    status: 'pending',
    has_more: false,
    results: [
      {
        id: 12,
        wallet_user: 'kania',
        wallet_email: 'kania@test.local',
        amount: '25.00',
        currency: 'USD',
        status: 'pending',
        paypal_email: 'kania@paypal.dev',
        account_label: 'PayPal',
        payout_details: '',
        requested_at: new Date().toISOString(),
      },
    ],
    stats: {
      pending_count: 1,
      pending_amount: '25.00',
      completed_30d_count: 3,
      completed_30d_amount: '120.00',
      failed_count: 1,
      failed_amount: '10.00',
      oldest_pending_at: new Date().toISOString(),
    },
  },
};

describe('AdminPayouts — withdrawal queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    payoutQueue.mockResolvedValue(QUEUE);
    processPayout.mockResolvedValue({ data: {} });
  });

  it('lists the pending withdrawal with its destination and the finance totals', async () => {
    render(<AdminPayouts lang="en" />);

    await waitFor(() => expect(screen.getByText('kania')).toBeTruthy());
    expect(screen.getByText('kania@paypal.dev')).toBeTruthy();
    expect(screen.getAllByText('$25.00').length).toBeGreaterThan(0);
    expect(screen.getByText('$120.00')).toBeTruthy();
    expect(payoutQueue).toHaveBeenCalledWith({ status: 'pending', limit: 50 });
  });

  it('marks a withdrawal paid with the provider reference', async () => {
    render(<AdminPayouts lang="en" />);

    await waitFor(() => expect(screen.getByText('kania')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /mark paid/i }));
    fireEvent.change(screen.getByPlaceholderText('PAY-...'), {
      target: { value: 'PAY-77' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm paid/i }));

    await waitFor(() => {
      expect(processPayout).toHaveBeenCalledWith(12, {
        action: 'complete',
        external_ref: 'PAY-77',
      });
    });
  });

  it('fails a withdrawal and says the money returns to the creator', async () => {
    render(<AdminPayouts lang="en" />);

    await waitFor(() => expect(screen.getByText('kania')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /mark failed/i }));
    expect(screen.getByText(/straight back to the creator/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /confirm failed/i }));

    await waitFor(() => {
      expect(processPayout).toHaveBeenCalledWith(12, { action: 'fail' });
    });
  });

  it('switches tab and asks the backend for that status', async () => {
    render(<AdminPayouts lang="en" />);

    await waitFor(() => expect(screen.getByText('kania')).toBeTruthy());
    fireEvent.click(screen.getByRole('tab', { name: /completed/i }));

    await waitFor(() => {
      expect(payoutQueue).toHaveBeenLastCalledWith({ status: 'completed', limit: 50 });
    });
  });
});
