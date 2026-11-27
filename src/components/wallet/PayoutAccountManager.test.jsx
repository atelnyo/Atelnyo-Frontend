// @vitest-environment jsdom
/**
 * PayoutAccountManager — PayPal OAuth window behavior.
 *
 * The window must open at the real PayPal URL, never at about:blank: a slow
 * or rejected /paypal/connect/ used to leave a blank tab with no message.
 * If the browser blocks the popup (common after an await), the URL stays on
 * screen as a link so the next click still reaches PayPal.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PayoutAccountManager from './PayoutAccountManager';
import { walletService } from '../../services/api';

vi.mock('../../services/api', () => ({
  walletService: { paypalConnect: vi.fn(), paypalStatus: vi.fn() },
}));

const AUTH_URL = 'https://www.paypal.com/connect?flowEntry=static&client_id=abc';

function isBefore(node, other) {
  return Boolean(
    node.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

describe('PayoutAccountManager — PayPal OAuth window', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    walletService.paypalStatus.mockResolvedValue({
      data: { configured: true, oauth_ready: true },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the window at the PayPal URL, never at about:blank', async () => {
    walletService.paypalConnect.mockResolvedValue({
      data: { auth_url: AUTH_URL },
    });
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({ closed: false, close: vi.fn() });

    render(<PayoutAccountManager accounts={[]} lang="en" />);
    fireEvent.click(screen.getByRole('button', { name: /connect with paypal/i }));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        AUTH_URL,
        'paypal_connect',
        expect.stringContaining('width=600'),
      );
    });
    expect(openSpy).not.toHaveBeenCalledWith(
      'about:blank',
      expect.anything(),
      expect.anything(),
    );
  });

  it('shows the API error instead of leaving a blank window', async () => {
    walletService.paypalConnect.mockRejectedValue({
      response: {
        data: {
          error: 'PayPal rejected the configured credentials for sandbox mode.',
        },
      },
    });
    const openSpy = vi.spyOn(window, 'open');

    render(<PayoutAccountManager accounts={[]} lang="en" />);
    fireEvent.click(screen.getByRole('button', { name: /connect with paypal/i }));

    await waitFor(() => {
      expect(screen.getByText(/rejected the configured credentials/i)).toBeTruthy();
    });
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('offers the PayPal URL as a link when the popup is blocked', async () => {
    walletService.paypalConnect.mockResolvedValue({
      data: { auth_url: AUTH_URL },
    });
    vi.spyOn(window, 'open').mockReturnValue(null);

    render(<PayoutAccountManager accounts={[]} lang="en" />);
    fireEvent.click(screen.getByRole('button', { name: /connect with paypal/i }));

    const link = await screen.findByRole('link', { name: /open paypal/i });
    expect(link.getAttribute('href')).toBe(AUTH_URL);
    expect(screen.getByText(/window was blocked/i)).toBeTruthy();
  });

  it('adds a payout account from a typed PayPal email', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<PayoutAccountManager accounts={[]} onAdd={onAdd} lang="en" />);

    fireEvent.change(screen.getByLabelText(/paypal email/i), {
      target: { value: 'creator@paypal.dev' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add paypal account/i }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
        method: 'paypal',
        paypal_email: 'creator@paypal.dev',
        is_default: true,
      }));
    });
  });

  it('leads with the PayPal email form when OAuth is not ready', async () => {
    walletService.paypalStatus.mockResolvedValue({
      data: { configured: true, oauth_ready: false },
    });
    const { container } = render(<PayoutAccountManager accounts={[]} lang="en" />);

    await waitFor(() => {
      expect(screen.getByText(/direct paypal sign-in/i)).toBeTruthy();
    });
    const form = container.querySelector('.wlt-payout-form');
    const connect = container.querySelector('.wlt-payout-connect');
    expect(isBefore(form, connect)).toBe(true);
    expect(screen.getByRole('heading', { name: /enter your paypal email/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /add paypal account/i }).className)
      .toBe('btn-primary');
  });

  it('hides Connect with PayPal when no credentials are configured', async () => {
    walletService.paypalStatus.mockResolvedValue({
      data: { configured: false, oauth_ready: false },
    });
    render(<PayoutAccountManager accounts={[]} lang="en" />);

    await waitFor(() => {
      expect(screen.getByText(/direct paypal sign-in/i)).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: /connect with paypal/i })).toBeNull();
  });

  it('moves the email form to the top once PayPal refuses the app', async () => {
    walletService.paypalConnect.mockRejectedValue({
      response: {
        data: {
          error: 'PayPal refused to open its login page for this app.',
          redirect_uri: 'https://api.atelnyo.site/cb',
        },
      },
    });
    const { container } = render(<PayoutAccountManager accounts={[]} lang="en" />);

    fireEvent.click(screen.getByRole('button', { name: /connect with paypal/i }));

    await waitFor(() => {
      expect(screen.getByText(/refused to open its login page/i)).toBeTruthy();
    });
    expect(isBefore(
      container.querySelector('.wlt-payout-form'),
      container.querySelector('.wlt-payout-connect'),
    )).toBe(true);
  });

  it('rejects an invalid PayPal email without calling the API', async () => {
    const onAdd = vi.fn();
    render(<PayoutAccountManager accounts={[]} onAdd={onAdd} lang="en" />);

    fireEvent.change(screen.getByLabelText(/paypal email/i), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add paypal account/i }));

    await waitFor(() => {
      expect(screen.getByText(/valid paypal email/i)).toBeTruthy();
    });
    expect(onAdd).not.toHaveBeenCalled();
  });
});
