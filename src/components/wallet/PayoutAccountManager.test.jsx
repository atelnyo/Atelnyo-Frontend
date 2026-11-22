// @vitest-environment jsdom
/**
 * PayoutAccountManager — PayPal OAuth popup behavior.
 *
 * The OAuth popup must be opened inside the click gesture, before the
 * network request. Opening it after `await` lets browsers block it, which
 * leaves the creator with no PayPal window and no callback.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PayoutAccountManager from './PayoutAccountManager';
import { walletService } from '../../services/api';

vi.mock('../../services/api', () => ({
  walletService: { paypalConnect: vi.fn() },
}));

function deferred() {
  let resolve;
  const promise = new Promise((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

describe('PayoutAccountManager — PayPal OAuth popup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the popup before awaiting the auth URL', async () => {
    const pending = deferred();
    walletService.paypalConnect.mockReturnValue(pending.promise);
    const popup = {
      location: { href: 'about:blank' },
      close: vi.fn(),
      closed: false,
    };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(popup);

    render(<PayoutAccountManager accounts={[]} lang="en" />);
    fireEvent.click(screen.getByRole('button', { name: /connect with paypal/i }));

    expect(openSpy).toHaveBeenCalledWith(
      'about:blank',
      'paypal_connect',
      expect.stringContaining('width=600'),
    );
    expect(walletService.paypalConnect).toHaveBeenCalledTimes(1);

    pending.resolve({
      data: { auth_url: 'https://www.paypal.com/connect?flowEntry=static' },
    });

    await waitFor(() => {
      expect(popup.location.href).toBe(
        'https://www.paypal.com/connect?flowEntry=static',
      );
    });
  });

  it('reports a closed window instead of a bogus connection failure', async () => {
    const pending = deferred();
    walletService.paypalConnect.mockReturnValue(pending.promise);
    const popup = {
      location: { href: 'about:blank' },
      close: vi.fn(),
      closed: false,
    };
    vi.spyOn(window, 'open').mockReturnValue(popup);

    render(<PayoutAccountManager accounts={[]} lang="en" />);
    fireEvent.click(screen.getByRole('button', { name: /connect with paypal/i }));

    // The user closes the popup while the auth URL request is still running.
    popup.closed = true;
    pending.resolve({
      data: { auth_url: 'https://www.paypal.com/connect?flowEntry=static' },
    });

    await waitFor(() => {
      expect(screen.getByText(/closed the PayPal window/i)).toBeTruthy();
    });
    expect(popup.location.href).toBe('about:blank');
  });

  it('shows an error and skips the API when the popup is blocked', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);

    render(<PayoutAccountManager accounts={[]} lang="en" />);
    fireEvent.click(screen.getByRole('button', { name: /connect with paypal/i }));

    expect(screen.getByText(/popup blocked/i)).toBeTruthy();
    expect(walletService.paypalConnect).not.toHaveBeenCalled();
  });
});
