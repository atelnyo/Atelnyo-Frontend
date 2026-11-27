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
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

vi.mock('../../../services/api', () => ({
  paymentConfigService: {
    config: vi.fn(() => Promise.resolve({
      data: { configured: true, client_id: 'cid', sandbox: true, topup_min: 5, topup_max: 10000 },
    })),
  },
  walletTopupService: { deposit: vi.fn(), capture: vi.fn() },
}));

vi.mock('../../CheckoutModal', () => ({
  // The canonical loader — stubbed so the test controls the failure mode.
  loadPayPalScript: vi.fn(),
}));

import DepositModal from './DepositModal';
import { loadPayPalScript } from '../../CheckoutModal';
import { paymentConfigService, walletTopupService } from '../../../services/api';

// A PayPal SDK stub that hands the test the options Modal passed to
// Buttons() — that is how the real approval path is driven end-to-end.
function stubPayPalButtons() {
  const holder = { opts: null };
  loadPayPalScript.mockResolvedValue({
    Buttons: (opts) => {
      holder.opts = opts;
      return { render: () => Promise.resolve() };
    },
  });
  return holder;
}

describe('DepositModal — PayPal SDK boot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks keeps implementations (and any unconsumed once-queue),
    // so reset the two wallet mocks this file drives per test.
    walletTopupService.deposit.mockReset();
    walletTopupService.capture.mockReset();
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

  it('shows a boot skeleton, then the real form with quick amounts', async () => {
    loadPayPalScript.mockResolvedValue({});

    render(<DepositModal onClose={() => {}} onSuccess={() => {}} lang="en" showToast={() => {}} />);

    // Before config + SDK settle the modal is a layout-matched skeleton,
    // not a form that silently produces an empty PayPal slot.
    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true');

    const amountInput = await screen.findByLabelText(/^amount/i);
    expect(amountInput).toBeTruthy();
    expect(screen.getByRole('group', { name: /quick amounts/i })).toBeTruthy();
  });

  it('fills the amount from a quick-amount chip', async () => {
    loadPayPalScript.mockResolvedValue({});

    render(<DepositModal onClose={() => {}} onSuccess={() => {}} lang="en" showToast={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: '$25' }));

    expect(screen.getByLabelText(/^amount/i).value).toBe('25');
    expect(screen.getByRole('button', { name: '$25' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('captures the approved order and shows the balance the server reports', async () => {
    const paypal = stubPayPalButtons();
    walletTopupService.deposit.mockResolvedValue({
      data: { paypal_order_id: 'ORD-1', amount: '25', status: 'pending' },
    });
    walletTopupService.capture.mockResolvedValue({
      data: { credited: true, amount: '25.00', balance: '75.00' },
    });

    render(
      <DepositModal
        onClose={() => {}}
        onSuccess={() => {}}
        lang="en"
        showToast={() => {}}
        currentBalance="50.00"
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: '$25' }));
    expect(screen.getByText(/current balance/i).textContent).toMatch(/\$50\.00/);
    fireEvent.click(screen.getByRole('button', { name: /continue with paypal/i }));

    await waitFor(() => expect(paypal.opts).toBeTruthy());
    await act(async () => { await paypal.opts.onApprove(); });

    await waitFor(() => expect(screen.getByText(/wallet has been funded/i)).toBeTruthy());
    expect(walletTopupService.capture).toHaveBeenCalledWith('ORD-1');
    expect(screen.getByText(/\$75\.00/)).toBeTruthy();
  });

  it('re-checks an approved payment instead of making the creator pay twice', async () => {
    const paypal = stubPayPalButtons();
    walletTopupService.deposit.mockResolvedValue({
      data: { paypal_order_id: 'ORD-2', amount: '25', status: 'pending' },
    });
    walletTopupService.capture
      .mockRejectedValueOnce(new Error('network drop'))
      .mockResolvedValueOnce({ data: { credited: true, balance: '25.00' } });

    render(<DepositModal onClose={() => {}} onSuccess={() => {}} lang="en" showToast={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: '$25' }));
    fireEvent.click(screen.getByRole('button', { name: /continue with paypal/i }));
    await waitFor(() => expect(paypal.opts).toBeTruthy());
    await act(async () => { await paypal.opts.onApprove(); });

    fireEvent.click(await screen.findByRole('button', { name: /already paid/i }));

    await waitFor(() => expect(screen.getByText(/wallet has been funded/i)).toBeTruthy());
    expect(walletTopupService.capture).toHaveBeenCalledTimes(2);
    expect(walletTopupService.deposit).toHaveBeenCalledTimes(1);
  });

  it('says PayPal is unavailable instead of offering a dead Continue button', async () => {
    paymentConfigService.config.mockResolvedValueOnce({ data: { configured: false } });

    render(<DepositModal onClose={() => {}} onSuccess={() => {}} lang="en" showToast={() => {}} />);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/not available right now/i);
    });
    expect(screen.queryByRole('button', { name: /continue with paypal/i })).toBeNull();
    // The form is still readable — the creator just cannot pay from here.
    expect(screen.getByLabelText(/^amount/i)).toBeTruthy();
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
