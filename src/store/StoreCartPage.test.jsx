// @vitest-environment jsdom
/**
 * StoreCartPage — checkout preparation states.
 *
 * The PayPal buttons are rendered by the SDK *after* the order exists
 * (POST /api/store-ish checkout → /api/checkout/order/ → the config endpoint
 * → the SDK download), and all of that used to happen against an empty area
 * under the Checkout button: shoppers saw a blank panel and assumed the
 * checkout had failed. These tests pin the placeholder that covers it and
 * the button label that goes with it.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

const getProduct = vi.fn();
const checkoutOrder = vi.fn();
const config = vi.fn();
const loadPayPalScript = vi.fn();
let renderButtons; // what paypal.Buttons().render() returns for this test

vi.mock('./storeService', () => ({
  storeService: {
    getProduct: (...args) => getProduct(...args),
    createOrder: vi.fn(),
    checkoutOrder: (...args) => checkoutOrder(...args),
    claimOrder: vi.fn(),
  },
}));

vi.mock('./useAuthStore', () => ({
  useAuthStore: (selector) => selector({ user: { id: 1, username: 'buyer' } }),
}));

vi.mock('../services/api', () => ({
  paymentConfigService: { config: (...args) => config(...args) },
  checkoutService: { capturePaypal: vi.fn() },
}));

// The SDK loader lives in CheckoutModal; stub the module so the modal itself
// never loads here.
vi.mock('../components/CheckoutModal', () => ({
  loadPayPalScript: (...args) => loadPayPalScript(...args),
}));

import StoreCartPage from './StoreCartPage';
import { saveCart } from './cart';

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};

const renderCart = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/store/cart']}>
        <StoreCartPage />
      </MemoryRouter>
    </HelmetProvider>,
  );

const startCheckout = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Checkout' }));
  await waitFor(() => expect(checkoutOrder).toHaveBeenCalled());
};

describe('StoreCartPage checkout preparation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    saveCart([{ productId: 5, variantId: null, quantity: 1 }]);
    getProduct.mockResolvedValue({ data: { title: 'Poster', price: '20.00', currency: 'USD' } });
    checkoutOrder.mockResolvedValue({
      data: { paypal_order_id: 'PP-1', transaction_id: 9, amount: '20.00' },
    });
    config.mockResolvedValue({ data: { configured: true, client_id: 'cid', sandbox: true } });
  });

  it('shows a loading placeholder and a busy label while the PayPal buttons are being prepared', async () => {
    const pending = deferred();
    renderButtons = () => pending.promise;
    loadPayPalScript.mockResolvedValue({
      Buttons: () => ({ render: renderButtons }),
    });

    const { container } = renderCart();
    await startCheckout();

    // The shopper gets an explanation instead of a blank panel...
    await waitFor(() => {
      expect(screen.getByText('Loading secure payment options…')).toBeTruthy();
    });
    // ...and the button keeps saying what is happening.
    expect(screen.getByText('Preparing payment')).toBeTruthy();
    expect(screen.queryByText('Checkout')).toBeNull();

    // The mount point for the SDK exists even while the placeholder is up —
    // rendering the skeleton INSTEAD of the container would break the render.
    expect(container.querySelector('.store-paypal')).not.toBeNull();
  });

  it('drops the placeholder and re-enables Checkout once the buttons are on screen', async () => {
    renderButtons = () => Promise.resolve();
    loadPayPalScript.mockResolvedValue({
      Buttons: () => ({ render: renderButtons }),
    });

    renderCart();
    await startCheckout();

    await waitFor(() => {
      expect(screen.queryByText('Loading secure payment options…')).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'Checkout' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Checkout' }).disabled).toBe(false);
  });

  it('replaces the placeholder with the error message when the SDK fails to load', async () => {
    loadPayPalScript.mockRejectedValue(new Error('PayPal SDK failed to load'));

    renderCart();
    await startCheckout();

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/PayPal is unavailable/);
    });
    expect(screen.queryByText('Loading secure payment options…')).toBeNull();
    expect(screen.getByRole('button', { name: 'Checkout' }).disabled).toBe(false);
  });
});
