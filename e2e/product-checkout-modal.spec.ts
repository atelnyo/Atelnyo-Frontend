/**
 * Product page → Buy → CheckoutModal.
 *
 * The product, user and payment-provider APIs are mocked so the test does
 * not depend on the database or on real PayPal / Stripe accounts. The
 * provider SDKs are stubbed; this verifies the checkout surface renders,
 * not that a payment settles.
 */
import { test, expect, type Page } from '@playwright/test';

const PRODUCT = {
  id: 201,
  title: 'Checkout Test Product',
  description: 'A product used to exercise the checkout modal.',
  price: 19.99,
  currency: 'USD',
  kind: 'physical',
  image_url: 'https://placehold.co/600x600.png',
  gallery: [{ url: 'https://placehold.co/600x600.png' }],
  stock: 5,
  is_active: true,
  category: 'Apparel',
  sales_count: 0,
  avg_rating: 0,
  review_count: 0,
  seller_username: 'seller_one',
  creator_name: 'Seller',
  tags: [],
  variants: [],
};

const USER = { id: 1, username: 'tester', email: 'tester@example.com', display_name: 'Tester' };

async function mockApi(page: Page) {
  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [], count: 0 }),
    }),
  );
  await page.route('**/api/me/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }),
  );
  await page.route('**/api/marketplace/products/201/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PRODUCT) }),
  );
  await page.route('**/api/checkout/paypal/config/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ configured: true, client_id: 'test-client', sandbox: true }),
    }),
  );
  await page.route('**/api/marketplace/orders/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 9001 }) }),
  );
  await page.route('**/api/checkout/order/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        transaction_id: 'tx1',
        paypal_order_id: 'PPORDER1',
        client_secret: 'pi_test_secret',
        provider: 'paypal',
      }),
    }),
  );
  await page.route('**://www.paypal.com/sdk/js**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'window.paypal = { Buttons: function () { return { render: function () { return Promise.resolve(); } }; } };',
    }),
  );
  await page.route('**://js.stripe.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.Stripe = function () { return {}; };' }),
  );
}

test('logged-out buy shows login prompt and does not open checkout', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockApi(page);
  await page.goto('/marketplace/201', { waitUntil: 'domcontentloaded' });
  await page.locator('.pd-cta-btn').first().click();
  await expect(page.locator('body')).toContainText(/Konekte pou w peye|Please log in to pay/i, { timeout: 10_000 });
  await expect(page.locator('.checkout-overlay')).toHaveCount(0);
});

test('logged-in buy opens checkout with PayPal and card options', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, username: 'tester', email: 'tester@example.com' }));
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockApi(page);
  await page.goto('/marketplace/201', { waitUntil: 'domcontentloaded' });
  await page.locator('.pd-cta-btn').first().click();
  await expect(page.locator('.checkout-overlay')).toBeVisible({ timeout: 15_000 });
  const providers = page.locator('.checkout-provider');
  await expect(providers).toHaveCount(2);
  await expect(providers.nth(0)).toContainText(/PayPal/i);
  await expect(providers.nth(1)).toContainText(/Card|Kat/i);
  await expect(page.locator('.checkout-paypal-buttons, .checkout-stripe').first()).toBeVisible({ timeout: 15_000 });
});
