/**
 * e2e/wallet-kyc-withdraw.spec.ts
 *
 * End-to-end contract for the Creator Studio Wallet payment UX:
 *
 *   1. KYC gate — an unverified creator clicking "Withdraw" sees the
 *      KYC gate (not the withdrawal form) with a "Verify Identity"
 *      CTA instead of a raw 403 after submit.
 *   2. VerificationModal — the CTA opens the KYC submission form
 *      (full name, DOB, document type, document number), and submitting
 *      flips the modal to the "under review" pending banner.
 *   3. DepositModal — the top-up modal surfaces the admin-configurable
 *      min/max from /api/checkout/paypal/config/ (dynamic, not hardcoded).
 *
 * Auth: logs in via /api/login/ (Django-only fallback when Supabase env
 * is unset — the local e2e Daphne must be started WITHOUT SUPABASE_URL
 * so the seeded e2e_alice user authenticates against the local DB), then
 * seeds localStorage with the JWT pair before visiting the app.
 *
 * Prereqs (mirror CI): Daphne on :8000 + Vite on :3000 up,
 * `python manage.py seed_e2e_data` run, e2e_alice granted an active
 * CreatorProfile (is_creator=true) + a Wallet row funded > $0 so the
 * Withdraw button is enabled.
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';
const E2E_PASSWORD = 'E2ePass!2024';

// Each test uses its OWN seeded creator user (e2e_wlt1/2/3) so the DRF
// UserRateThrottle (30/min) is never exhausted mid-suite — a single user
// firing ~45 requests across 3 tests would 429 on the last test.
async function loginAndSeed(page, username) {
  const email = `${username}@atelnyo.local`;
  // Log in through the real API to obtain the JWT pair.
  const resp = await page.request.post(`${BASE}/api/login/`, {
    data: { email, password: E2E_PASSWORD },
  });
  expect(resp.status(), `login as ${email}`).toBe(200);
  const body = await resp.json();
  expect(body.access, 'login must return an access token').toBeTruthy();

  // Seed the app's localStorage auth keys, then load the app fresh.
  await page.addInitScript(
    ({ access, refresh, user }) => {
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      localStorage.setItem('user', JSON.stringify(user || {}));
      // Force English UI copy for stable selectors.
      localStorage.setItem('atelnyo_lang', 'en');
    },
    { access: body.access, refresh: body.refresh, user: body.user },
  );
  await page.goto(`${BASE}/sheet/studio`);
}

async function openWalletTab(page) {
  const walletTab = page.locator('[data-creator-studio]').getByRole('tab', { name: /Wallet/i });
  await walletTab.first().click({ timeout: 20_000 });
  // Wallet panel loads balance data.
  await expect(
    page.getByText(/Available Balance/i).first(),
  ).toBeVisible({ timeout: 20_000 });
}

test.describe('Creator Studio Wallet — KYC → withdrawal + top-up', () => {
  test('unverified creator sees the KYC gate instead of the withdrawal form', async ({
    page,
  }) => {
    await loginAndSeed(page, 'e2e_wlt1');
    await openWalletTab(page);

    // Click "Withdraw" — the KYC gate must appear (NOT the form).
    await page.getByRole('button', { name: /^Withdraw$/ }).first().click();

    // KYC gate: explanatory message + a "Verify Identity" CTA.
    await expect(
      page.getByText(/KYC required to withdraw/i).first(),
    ).toBeVisible({ timeout: 15_000 });
    const verifyCta = page.getByRole('button', { name: /Verify Identity/i }).first();
    await expect(verifyCta).toBeVisible();

    // No withdrawal amount form should be present behind the gate.
    await expect(
      page.getByPlaceholder(/amount|montan/i),
    ).toHaveCount(0);
  });

  test('top-up modal surfaces the dynamic admin-configured min/max', async ({ page }) => {
    // Fetch the live config to know the expected min/max.
    const cfgResp = await page.request.get(`${BASE}/api/checkout/paypal/config/`);
    const cfg = await cfgResp.json();
    expect(cfg.topup_min).toBeGreaterThan(0);

    await loginAndSeed(page, 'e2e_wlt2');
    await openWalletTab(page);

    // Open the deposit (top-up) modal.
    await page.getByRole('button', { name: /^Fund$/ }).first().click();
    await expect(
      page.getByRole('heading', { name: /Fund Wallet/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // The hint text must carry the configured min/max values.
    await expect(
      page.getByText(new RegExp(`Minimum \\$${cfg.topup_min}\\s*·\\s*Maximum`)).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('KYC CTA opens the verification modal with a working submission form', async ({
    page,
  }) => {
    await loginAndSeed(page, 'e2e_wlt3');
    await openWalletTab(page);

    await page.getByRole('button', { name: /^Withdraw$/ }).first().click();
    await expect(
      page.getByText(/KYC required to withdraw/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Open the KYC submission modal.
    await page
      .getByRole('button', { name: /Verify Identity/i })
      .first()
      .click();
    await expect(
      page.getByText(/Creator Verification/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Fill the identity form.
    await page
      .getByPlaceholder(/Legal name as on your ID/i)
      .first()
      .fill('Alice Test');
    await page.getByLabel(/Date of Birth/i).first().fill('1990-01-15');
    await page.getByLabel(/Nationality/i).first().fill('Haitian');
    await page
      .getByLabel(/ID Document Type/i)
      .first()
      .selectOption({ label: 'Passport' });
    await page.getByLabel(/ID Document Number/i).first().fill('P12345678');

    // Submit → pending banner ("under review").
    await page.getByRole('button', { name: /Submit Verification/i }).first().click();
    await expect(
      page.getByText(/Under Review/i).first(),
    ).toBeVisible({ timeout: 20_000 });
  });
});
