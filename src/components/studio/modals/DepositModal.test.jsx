// @vitest-environment jsdom
/**
 * DepositModal (Creator Studio → Wallet → Fund Wallet) — PayPal boot states.
 *
 * The modal boots the PayPal SDK once. A request that is accepted but never
 * answered used to leave the modal with no buttons and no message at all:
 * the creator tapped "Continue with PayPal" and nothing happened. The loader
 * now reports a deadline miss, and this test pins the message the creator
 * actually sees.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../../../services/api', () => ({
  paymentConfigService: {
    config: vi.fn(() => Promise.resolve({
      data: { configured: true, client_id: 'cid', sandbox: true, topup_min: 5, topup_max: 10000 },
    })),
  },
  walletTopupService: { deposit: vi.fn() },
}));

vi.mock('../../CheckoutModal', () => ({
  // The canonical loader — stubbed so the test controls the failure mode.
  loadPayPalScript: vi.fn(),
}));

import DepositModal from './DepositModal';
import { loadPayPalScript } from '../../CheckoutModal';

describe('DepositModal — PayPal SDK boot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tells the creator the SDK load timed out', async () => {
    const timeout = new Error('PayPal SDK timed out');
    timeout.code = 'timeout';
    loadPayPalScript.mockRejectedValue(timeout);

    render(<DepositModal onClose={() => {}} onSuccess={() => {}} lang="ht" showToast={() => {}} />);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/pran twòp tan/i);
    });
  });

  it('still reports a plain SDK load failure as unavailable', async () => {
    const failure = new Error('PayPal SDK failed to load');
    failure.code = 'load';
    loadPayPalScript.mockRejectedValue(failure);

    render(<DepositModal onClose={() => {}} onSuccess={() => {}} lang="en" showToast={() => {}} />);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/not available right now/i);
    });
  });
});
