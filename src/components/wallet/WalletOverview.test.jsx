// @vitest-environment jsdom
/**
 * WalletOverview — "where your money comes from".
 *
 * The breakdown is the ledger's own totals per source; the card must show
 * them without inventing numbers, and it must say so when nothing has come
 * in yet.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WalletOverview from './WalletOverview';

const WALLET = {
  balance: '120.00',
  pending_balance: '0.00',
  total_earned: '42.00',
  lifetime_received: '42.00',
  transaction_count: 6,
  payout_accounts_count: 1,
  withdrawals_count: 1,
  tips_received_count: 3,
  tips_received_amount: '12.00',
  tips_sent_count: 0,
  tips_sent_amount: '0.00',
  earnings_breakdown: {
    tips: '12.00',
    sales: '25.00',
    subscriptions: '5.00',
    contracts: '0.00',
    tickets: '0.00',
    deposits: '78.00',
    withdrawn: '30.00',
    total_earned: '42.00',
  },
};

describe('WalletOverview — money sources', () => {
  it('shows every ledger source with its total', () => {
    render(<WalletOverview wallet={WALLET} lang="en" />);

    expect(screen.getByText(/where your money comes from/i)).toBeTruthy();
    // The tips total also feeds the stat card, so it legitimately appears twice.
    expect(screen.getAllByText('Tips').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$12.00').length).toBeGreaterThan(0);
    expect(screen.getByText('Store sales')).toBeTruthy();
    expect(screen.getByText('$25.00')).toBeTruthy();
    expect(screen.getByText(/already withdrawn/i)).toBeTruthy();
    expect(screen.getAllByText(/\$30\.00/).length).toBeGreaterThan(0);
  });

  it('says nothing has come in yet when every source is zero', () => {
    render(
      <WalletOverview
        wallet={{
          ...WALLET,
          earnings_breakdown: {
            tips: '0.00',
            sales: '0.00',
            subscriptions: '0.00',
            contracts: '0.00',
            tickets: '0.00',
            deposits: '0.00',
            withdrawn: '0.00',
            total_earned: '0.00',
          },
        }}
        lang="en"
      />,
    );

    expect(screen.getByText(/nothing has come in yet/i)).toBeTruthy();
  });
});
