/**
 * e2e/admin-paypal-key-test.spec.ts
 *
 * Drives the API-keys panel's PayPal row in a REAL browser (Chromium) and
 * pins the two things that decide whether a store owner can recover from a
 * broken PayPal credential pair:
 *
 *   1. Test probes the values ON SCREEN — the client id / secret drafts are
 *      sent as `related` alongside the row under test, so a freshly pasted
 *      pair is validated instead of the stale stored one.
 *   2. The toast shows the backend's actual reason (`invalid_client` + the
 *      active mode), not a generic "OAuth failed" the admin cannot act on.
 *
 * Self-contained: seeded staff session + stubbed API via `page.route`, so it
 * needs the Vite server (:3000) but NOT Daphne, a database, or real PayPal
 * credentials (no live secret ever reaches the browser).
 */
import { test, expect } from '@playwright/test';

const USER = {
  id: 1, username: 'admin', email: 'admin@test.dev',
  is_staff: true, is_superuser: true, first_name: 'Admin', last_name: 'User',
};  // Masked echoes, exactly what the backend returns for secret rows.
const ROWS = [
  {
    id: 11, key: 'paypal_client_id', value: '••••••••TBEq8', value_type: 'str',
    description: 'PayPal REST app client id.', is_public: false, is_secret: true, is_masked: true,
  },
  {
    id: 12, key: 'paypal_client_secret', value: '••••••••wxyz', value_type: 'str',
    description: 'PayPal REST app client secret.', is_public: false, is_secret: true, is_masked: true,
  },
  {
    id: 13, key: 'paypal_mode', value: 'live', value_type: 'str',
    description: 'PayPal environment.', is_public: false, is_secret: false, is_masked: false,
  },
];

// Verbatim copy of api.services.paypal_gateway._get_access_token's message for
// a 401 invalid_client — the contract this spec protects.
const REASON =
  'PayPal rejected the store credentials (invalid_client, live mode). '
  + 'The store owner must re-check that the PayPal Client ID and Secret '
  + 'come from the same REST app and match this environment.';

test('admin PayPal Test sends the pair on screen and shows why it failed', async ({ page }) => {
  await page.setDefaultTimeout(30000);
  // Surface the real crash when a stubbed payload shape is wrong — an error
  // boundary otherwise hides which component threw.
  page.on('pageerror', (err) => console.log('PAGEERROR:', err.message));
  await page.addInitScript((user) => {
    localStorage.setItem('access_token', 'e2e.fake.token');
    localStorage.setItem('refresh_token', 'e2e.fake.refresh');
    localStorage.setItem('user', JSON.stringify(user));
  }, USER);

  let testBody: Record<string, unknown> | null = null;
  let patchBody: Record<string, unknown> | null = null;
  await page.route(/\api\//, async (route) => {
    const url = decodeURIComponent(route.request().url());
    const method = route.request().method();
    if (method === 'GET' && url.endsWith('/api/me/')) {
      return route.fulfill({ status: 200, json: USER });
    }
    if (method === 'GET' && url.endsWith('/api/admin/platform-config/')) {
      return route.fulfill({ status: 200, json: ROWS });
    }
    // The panel's "why did PayPal fail" record — the reason reached the owner
    // without the server log.
    if (method === 'GET' && url.endsWith('/api/admin/platform-config/paypal-health/')) {
      return route.fulfill({
        status: 200,
        json: {
          mode: 'live', base_url: 'https://api-m.paypal.com', configured: true,
          last_success: null,
          last_failure: {
            at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            mode: 'live', base_url: 'https://api-m.paypal.com',
            http_status: 401, error_code: 'invalid_client',
            error_description: 'Client Authentication failed',
            client_id_tail: 'TBEq8',
          },
        },
      });
    }
    if (method === 'POST' && url.includes('/api/admin/platform-config/') && url.endsWith('/test/')) {
      testBody = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({ status: 200, json: { ok: false, message: REASON } });
    }
    if (method === 'PATCH' && /\/api\/admin\/platform-config\/\d+\/$/.test(url)) {
      patchBody = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({ status: 200, json: { ...ROWS[2], ...(patchBody as object) } });
    }
    // Generic admin payload: the dashboard slices several collections
    // (certificates, content intelligence) without guarding, so an empty
    // object here would trip its error boundary and hide the panel.
    return route.fulfill({
      status: 200,
      json: {
        results: [], count: 0, total: 0,
        per_course: [], recent: [], by_status: {}, recent_jobs: [],
      },
    });
  });

  // Boot on the public root, let the session hydrate, then SPA-navigate —
  // a cold deep-link races AuthGate before localStorage is read.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const spaNavigate = () => page.evaluate(() => {
    history.pushState({}, '', '/sheet/admin/dashboard');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await spaNavigate();
  if (await page.evaluate(() => location.pathname.startsWith('/sheet/auth'))) {
    await page.waitForTimeout(600);
    await spaNavigate();
  }
  await expect(page.locator('.ad-dash-shell').first()).toBeVisible({ timeout: 30000 });

  // A brand-new client id + secret typed but NOT saved: Test must probe them.
  const idInput = page.locator('.ad-cfg-input[aria-label="PayPal Client ID"]');
  const secretInput = page.locator('.ad-cfg-input[aria-label="PayPal Client Secret"]');
  await expect(idInput).toBeVisible();
  await idInput.fill('AW4q4-NEWLY-PASTED-ID');
  await secretInput.fill('NEWLY-PASTED-SECRET');

  const paypalRow = page.locator('.ad-cfg-row').filter({ has: idInput });
  await paypalRow.locator('.ad-cfg-btn-test').click();

  // 1. The drafts on screen were sent as the group under test.
  await expect.poll(() => testBody).not.toBeNull();
  expect(testBody).toMatchObject({
    value: 'AW4q4-NEWLY-PASTED-ID',
    related: {
      paypal_client_id: 'AW4q4-NEWLY-PASTED-ID',
      paypal_client_secret: 'NEWLY-PASTED-SECRET',
    },
  });

  // 2. The admin sees the actionable reason, not a dead end.
  await expect(page.getByText(/invalid_client/).first()).toBeVisible();
  await expect(page.getByText(/same REST app/).first()).toBeVisible();

  // 3. The last rejection is visible in the panel: PayPal's code, the mode it
  //    was used in, and PayPal's own description — no server log needed.
  const health = page.locator('.ad-cfg-paypal-health');
  await expect(health).toBeVisible();
  await expect(health).toContainText('invalid_client');
  await expect(health).toContainText('live mode');
  await expect(health).toContainText('Client Authentication failed');

  // 4. paypal_mode is a switch: one click saves the exact token the gateway
  //    understands, so a typo can no longer leave the store silently in the
  //    wrong environment.
  const modeRow = page.locator('.ad-cfg-row').filter({ has: page.locator('.ad-cfg-mode-switch') });
  await expect(modeRow).toBeVisible();
  const sandboxBtn = modeRow.locator('.ad-cfg-mode-sandbox');
  await expect(sandboxBtn).toBeEnabled();
  await sandboxBtn.click();
  await expect.poll(() => patchBody).toMatchObject({ value: 'sandbox' });
});
