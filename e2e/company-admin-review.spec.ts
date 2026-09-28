/**
 * e2e/company-admin-review.spec.ts
 *
 * End-to-end contract for the Admin Company Review flow — pins the
 * exact user-reported scenario:
 *
 *   "Creator submits a company profile (status=pending) but the
 *    admin panel doesn't show it."
 *
 * This test reproduces that flow against REAL servers:
 *
 *   1. A brand-new user signs up via /api/signup/ (unique email per
 *      run, so the suite stays idempotent — CompanyProfile is OneToOne
 *      per user, a re-used user would 400 on the second create) and
 *      POSTs a company profile → must return 201 with status=pending.
 *   2. The staff user (e2e_staff) logs in, seeds the JWT pair into
 *      localStorage, and SPA-navigates to /sheet/admin/companies.
 *   3. The pending company MUST be visible in the review list.
 *
 * Auth + seeding mirror wallet-kyc-withdraw.spec.ts (real login) and
 * responsive-admin.spec.ts (SPA navigation post-boot).
 *
 * Prereqs (mirror CI): Daphne on :8000 + Vite on :3000 up, and
 * `python manage.py seed_e2e_data` run (creates e2e_staff).
 *
 * ⚠ Daphne MUST be started WITHOUT Supabase auth env (SUPABASE_URL
 * unset/blank) so /api/login/ + /api/signup/ take the Django-only
 * fallback — the seeded e2e users authenticate against the local DB
 * (see wallet-kyc-withdraw.spec.ts for the same prerequisite).
 *
 * ⚠ Vite MUST be started with VITE_API_BASE_URL=/api/ (shell env
 * OVERRIDES .env / .env.development, which point at the deployed
 * backend). Without the override the browser app talks to the
 * deployed API while this spec's page.request hits the local backend
 * through the Vite proxy — a split-brain that makes the admin panel
 * look like it never receives a locally-created company.
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';
const E2E_PASSWORD = 'E2ePass!2024';
const STAFF = { username: 'e2e_staff', email: 'e2e_staff@atelnyo.local' };

// Guard against the split-brain failure mode documented above: the
// browser app must be pointed at the LOCAL backend (via the Vite
// proxy) so the admin panel reads the same DB this spec writes to.
test.beforeAll(async ({ request }) => {
  const resp = await request.get(`${BASE}/src/services/api.js`);
  const src = await resp.text();
  const m = src.match(/API_URL = import\.meta\.env\.VITE_API_BASE_URL/);
  // We can't see the *resolved* env in the raw module — instead probe
  // a harmless local endpoint that ONLY exists on the local backend
  // (healthz). If the app were pointed at the deployed API, this spec
  // would be testing two different backends.
  const health = await request.get(`${BASE}/api/healthz/`).catch(() => null);
  expect(health?.status(), 'local backend must be reachable via the Vite proxy').toBe(200);
  expect(m, 'api.js must still read VITE_API_BASE_URL (bundle changed?)').toBeTruthy();
});

/** Sign up a brand-new user (unique email per run) and return JWT + user. */
async function signupFreshCreator(page) {
  const email = `e2e_company_${Date.now()}@atelnyo.local`;
  const resp = await page.request.post(`${BASE}/api/signup/`, {
    data: { email, password: E2E_PASSWORD },
  });
  expect([200, 201], `signup as ${email} should succeed`).toContain(resp.status());
  const body = await resp.json();
  expect(body.access, 'signup must return an access token').toBeTruthy();
  return { email, access: body.access, refresh: body.refresh, user: body.user };
}

/** Log in through the real API and return the JWT pair + user blob. */
async function login(page, { email, username }) {
  const resp = await page.request.post(`${BASE}/api/login/`, {
    data: { email, password: E2E_PASSWORD },
  });
  expect(resp.status(), `login as ${email}`).toBe(200);
  const body = await resp.json();
  expect(body.access, 'login must return an access token').toBeTruthy();
  // The login payload may carry a slim user shape; hit /api/me/ to get
  // the canonical UserSerializer blob (RequireRole reads is_staff off it).
  const meResp = await page.request.get(`${BASE}/api/me/`, {
    headers: { Authorization: `Bearer ${body.access}` },
  });
  let user = body.user;
  if (meResp.status() === 200) {
    const me = await meResp.json();
    if (me && me.username === username) { user = me; }
  }
  return { access: body.access, refresh: body.refresh, user };
}

/** Seed the app's localStorage auth keys, then boot the app fresh. */
async function seedSession(page, { access, refresh, user }) {
  await page.addInitScript(
    ({ access, refresh, user }) => {
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      localStorage.setItem('user', JSON.stringify(user || {}));
      // Force English UI copy for stable selectors.
      localStorage.setItem('atelnyo_lang', 'en');
      try { sessionStorage.clear(); } catch (_) { /* ignore */ }
    },
    { access, refresh, user },
  );
}

/** Client-side navigation the way real users reach admin pages (post-boot). */
async function spaNavigate(page, url) {
  await page.evaluate((u) => {
    history.pushState({}, '', u);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, url);
}

test.describe('Admin Company Review — creator submits → admin approves', () => {
  test('pending company submitted by a creator appears in the admin panel', async ({ page }) => {
    // ── 1. Fresh creator signs up + creates a company profile ────────
    const companyName = `E2E Company ${Date.now()}`;
    const creatorSession = await signupFreshCreator(page);
    const createResp = await page.request.post(`${BASE}/api/companies/`, {
      headers: { Authorization: `Bearer ${creatorSession.access}` },
      data: {
        company_name: companyName,
        tagline: 'E2E admin review test',
        description: 'A company created by the e2e suite to pin the admin review flow.',
        country: 'HT',
        city: 'Port-au-Prince',
      },
    });
    expect(createResp.status(), `create company as fresh creator should be 201`)
      .toBe(201);
    const created = await createResp.json();
    expect(created.status, 'new company must start pending').toBe('pending');

    // ── 2. Staff logs in + seeds the session ─────────────────────────
    const staffSession = await login(page, STAFF);
    expect(staffSession.user?.is_staff || staffSession.user?.is_superuser,
      'e2e_staff must be staff').toBeTruthy();
    await seedSession(page, staffSession);

    // Boot on the public root so the session hydrates before the
    // AuthGate sees the admin route (cold-deep-link race — see
    // responsive-admin.spec.ts for the full rationale).
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await spaNavigate(page, '/sheet/admin/companies');

    // Hardening: if the session had not hydrated and AuthGate bounced
    // us, give it a beat and retry the SPA nav once.
    const bounced = await page.evaluate(() => location.pathname.startsWith('/sheet/auth'));
    if (bounced) {
      await page.waitForTimeout(600);
      await spaNavigate(page, '/sheet/admin/companies');
    }

    // ── 3. The pending company MUST be visible ────────────────────────
    await expect(
      page.locator('[data-testid="admin-company-review"]').first(),
      'admin company review panel should render',
    ).toBeVisible({ timeout: 30_000 });

    await expect(
      page.getByText(companyName, { exact: true }).first(),
      `pending company "${companyName}" must appear in the admin review list`,
    ).toBeVisible({ timeout: 20_000 });

    // Status pill says Pending (the admin queue's default view).
    const row = page.getByText(companyName, { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"acr") or contains(@style,"border")][1]');
    await expect(row.getByText('Pending').first(), 'row shows Pending status').toBeVisible({ timeout: 10_000 });
  });
});
