// @vitest-environment jsdom
/**
 * AdminWalletCredit — staff manual wallet funding.
 *
 * The ops path when PayPal cannot be used: find the creator, confirm the
 * balance, credit the wallet, and show the NEW balance from the server.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const adminLookup = vi.fn();
const adminCredit = vi.fn();

vi.mock('../../services/api', () => ({
  walletService: {
    adminLookup: (...args) => adminLookup(...args),
    adminCredit: (...args) => adminCredit(...args),
  },
}));

import AdminWalletCredit from './AdminWalletCredit';

const LOOKUP = {
  data: {
    user: { id: 7, username: 'kania', email: 'kania@test.local', is_staff: false },
    wallet: { id: 3, balance: '12.50', currency: 'USD' },
    transactions: [
      {
        id: 1,
        tx_type: 'deposit',
        amount: '12.50',
        description: 'Seed balance',
        running_balance: '12.50',
        created_at: new Date().toISOString(),
      },
    ],
    pending_payouts: 1,
  },
};

async function findWallet() {
  render(<AdminWalletCredit lang="en" />);
  fireEvent.change(
    screen.getByPlaceholderText(/username, email or user id/i),
    { target: { value: 'kania' } },
  );
  fireEvent.click(screen.getByRole('button', { name: /find wallet/i }));
  await waitFor(() => expect(screen.getByText('kania')).toBeTruthy());
}

describe('AdminWalletCredit — manual funding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminLookup.mockResolvedValue(LOOKUP);
    adminCredit.mockResolvedValue({ data: { balance: '22.50' } });
  });

  it('finds a creator and shows the current balance and ledger', async () => {
    await findWallet();

    expect(adminLookup).toHaveBeenCalledWith('kania');
    expect(screen.getByText('kania@test.local · #7')).toBeTruthy();
    expect(screen.getAllByText('$12.50').length).toBeGreaterThan(0);
    expect(screen.getByText('Seed balance')).toBeTruthy();
    expect(screen.getByText(/1 pending withdrawal/i)).toBeTruthy();
  });

  it('credits the wallet and shows the new server balance', async () => {
    await findWallet();

    fireEvent.change(screen.getByPlaceholderText('25.00'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByPlaceholderText('Support credit'), {
      target: { value: 'Support credit' },
    });
    fireEvent.click(screen.getByRole('button', { name: /credit wallet/i }));

    await waitFor(() => {
      expect(adminCredit).toHaveBeenCalledWith({
        user_id: 7,
        amount: 10,
        description: 'Support credit',
      });
    });
    await waitFor(() => {
      expect(screen.getAllByText('$22.50').length).toBeGreaterThan(0);
    });
  });

  it('refuses an amount of zero without calling the API', async () => {
    await findWallet();

    fireEvent.change(screen.getByPlaceholderText('25.00'), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByRole('button', { name: /credit wallet/i }));

    await waitFor(() => {
      expect(screen.getByText(/greater than zero/i)).toBeTruthy();
    });
    expect(adminCredit).not.toHaveBeenCalled();
  });
});
