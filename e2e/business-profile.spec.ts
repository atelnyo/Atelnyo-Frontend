/**
 * e2e/business-profile.spec.ts
 *
 * Phase Business — Playwright coverage for the Business Profile
 * branch (separate account identity from the Creator branch).
 *
 * Three tests pin the contract:
 *
 *   1. anonymous is bounced from /business (AuthGate redirect).
 *
 *   2. the UI create flow: fresh user signs up → opens the hub →
 *      creates a Business Profile through the modal → lands in the
 *      Business Workspace with the "Business Profile: [Name]"
 *      context header + a "Return to Creator Studio" affordance.
 *
 *   3. workspace ownership isolation: user A's business profile is
 *      invisible to user B (the owner-scoped backend 404s → the
 *      workspace renders its not-found state, no existence leak).
 *
 * Auth + seeding mirror company-admin-review.spec.ts (real signup /
 * login, JWT seeded into localStorage, SPA navigation post-boot).
 *
 * Prereqs (mirror CI): Daphne on :8000 + Vite on :3000 up, and
 * `python manage.py seed_e2e_data` run. Daphne MUST be started
 * WITHOUT Supabase auth env (SUPABASE_URL unset/blank) so
 * /api/signup/ + /api/login/ use the Django-only fallback.
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';
// Django host — the server-rendered OG endpoint lives on the BACKEND
// (Vite only proxies /api and /ws), mirroring the Spotlight OG surface.
const BE = 'http://127.0.0.1:8000';
const E2E_PASSWORD = 'E2ePass!2024';

/**
 * Sign up a brand-new user (unique email per run) and return JWT + user.
 * With ``opts.creator`` the user is ALSO made an approved creator via the
 * real creator-apply + staff-review flow, and the returned user blob
 * carries ``is_creator: true`` so the FE renders the create CTA.
 */
async function signupFreshUser(page, prefix, opts = {}) {
  const email = `e2e_${prefix}_${Date.now()}@atelnyo.local`;
  const resp = await page.request.post(`${BASE}/api/signup/`, {
    data: { email, password: E2E_PASSWORD },
  });
  expect([200, 201], `signup as ${email} should succeed`).toContain(resp.status());
  const body = await resp.json();
  expect(body.access, 'signup must return an access token').toBeTruthy();
  let session = { email, access: body.access, refresh: body.refresh, user: body.user };
  if (opts.creator) {
    session = await makeCreator(page, session);
  }
  return session;
}

/**
 * Make a fresh user an APPROVED creator through the real flows: submit
 * a CreatorApplication, then have e2e_staff approve it via the staff
 * review endpoint (seed_e2e_data creates e2e_staff + grants e2e_alice
 * creator status; fresh users go through the full wizard path).
 */
async function makeCreator(page, session) {
  const applyResp = await page.request.post(`${BASE}/api/identity/creator-apply/`, {
    headers: { Authorization: `Bearer ${session.access}` },
    data: {
      status: 'submitted',
      biography: 'E2E creator eligibility fixture.',
      country: 'HT',
      skills: ['Testing'],
      categories: ['engineering'],
    },
  });
  expect(applyResp.status(), 'creator application submit should succeed').toBe(201);
  const app = await applyResp.json();

  // e2e_staff (superuser) approves through the real review endpoint.
  const staffLogin = await page.request.post(`${BASE}/api/login/`, {
    data: { email: 'e2e_staff@atelnyo.local', password: E2E_PASSWORD },
  });
  expect(staffLogin.status(), 'staff login should succeed').toBe(200);
  const staffBody = await staffLogin.json();
  const staffAccess = staffBody.access ?? staffBody.data?.access;
  expect(staffAccess, 'staff login must return an access token').toBeTruthy();

  const reviewResp = await page.request.patch(
    `${BASE}/api/identity/creator-apply/${app.id}/review/`,
    {
      headers: { Authorization: `Bearer ${staffAccess}` },
      data: { status: 'approved' },
    },
  );
  expect(reviewResp.status(), 'staff approval should succeed').toBe(200);
  return { ...session, user: { ...session.user, is_creator: true } };
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

/** Client-side navigation the way real users reach routes (post-boot). */
async function spaNavigate(page, url) {
  await page.evaluate((u) => {
    history.pushState({}, '', u);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, url);
}

test.describe('Business Profile — UI entry points', () => {
  test('the My Businesses card is visible on the Mwen page for any account', async ({ page }) => {
    // ── 1. Fresh user signs up + seeds the session ───────────────────
    const session = await signupFreshUser(page, 'entry');
    await seedSession(page, session);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    // ── 2. Switch to the Mwen TAB (tab-driven, not a /mwen URL) ────
    // The Mwen page is an activeTab surface (not a URL route), so we
    // reach it through the bottom-nav tab exactly like a real user.
    await page.locator('[data-testid="mwen-nav-item"]').click();
    const card = page.locator('[data-testid="mwen-business-card"]');
    await expect(card, 'the My Businesses card must render on Mwen').toBeVisible({ timeout: 30_000 });
    await card.click();
    await expect(page, 'clicking the card must land on the business hub').toHaveURL(/\/business$/);
    await expect(
      page.locator('[data-testid="business-hub"]'),
      'the hub should render',
    ).toBeVisible({ timeout: 30_000 });
  });

  test('the profile dropdown exposes the My Businesses link', async ({ page }) => {
    const session = await signupFreshUser(page, 'drop');
    await seedSession(page, session);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    // Open the avatar profile dropdown in the header.
    await page.locator('.header-profile-btn').first().click();
    const link = page.locator('[data-testid="header-business-link"]');
    await expect(link, 'the header dropdown must expose My Businesses').toBeVisible({ timeout: 20_000 });
    await link.click();
    await expect(page, 'clicking it must land on the business hub').toHaveURL(/\/business$/);
  });
});

test.describe('Business Profile — hub + workspace', () => {
  test('a non-creator sees the locked state — and the backend refuses creation', async ({ page }) => {
    // ── 1. Fresh user (NOT a creator) seeds the session ─────────────
    const session = await signupFreshUser(page, 'locked');
    await seedSession(page, session);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await spaNavigate(page, '/business');

    // ── 2. Hub renders the LOCKED state, never the create CTA ──────
    const hub = page.locator('[data-testid="business-hub"]');
    await expect(hub, 'hub should render').toBeVisible({ timeout: 30_000 });
    await expect(
      page.locator('[data-testid="business-hub-locked"]'),
      'a non-creator must see the locked state',
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('[data-testid="business-hub-create"]'),
      'the create CTA must be hidden for non-creators',
    ).toHaveCount(0);
    await expect(
      page.locator('[data-testid="business-hub-apply-creator"]'),
      'the apply-to-become-a-creator CTA must render',
    ).toBeVisible();

    // ── 3. Backend is authoritative: a direct POST is refused ──────
    const resp = await page.request.post(`${BASE}/api/business/profiles/`, {
      headers: { Authorization: `Bearer ${session.access}` },
      data: { name: `Blocked ${Date.now()}` },
    });
    expect(resp.status(), 'backend must refuse a non-creator create').toBe(403);
  });

  test('anonymous is bounced away from /business', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto(`${BASE}/business`);
    // AuthGate redirects to the auth sheet for signed-out visitors.
    await expect(page, 'anonymous /business must redirect to the auth sheet')
      .toHaveURL(/\/sheet\/auth/);
  });

  test('UI create flow lands in the Business Workspace with context header', async ({ page }) => {
    // ── 1. Fresh user signs up + seeds the session ───────────────────
    const session = await signupFreshUser(page, 'biz', { creator: true });
    await seedSession(page, session);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await spaNavigate(page, '/business');

    // ── 2. Hub renders with the create CTA ───────────────────────────
    const hub = page.locator('[data-testid="business-hub"]');
    await expect(hub, 'business hub should render').toBeVisible({ timeout: 30_000 });

    // ── 3. Create through the modal ──────────────────────────────────
    await page.locator('[data-testid="business-hub-create"]').click();
    const modal = page.locator('[data-testid="business-create-form"]');
    await expect(modal, 'create modal should open').toBeVisible({ timeout: 10_000 });

    const bizName = `E2E Biz ${Date.now()}`;
    await page.locator('[data-testid="business-create-name"]').fill(bizName);
    await page.locator('[data-testid="business-create-submit"]').click();

    // ── 4. Lands in the workspace with the context header ────────────
    const workspace = page.locator('[data-testid="business-workspace"]');
    await expect(workspace, 'workspace should render after create').toBeVisible({ timeout: 30_000 });
    await expect(
      workspace.getByText('Business Profile:', { exact: true }),
      'context header must say "Business Profile:" (not creator)',
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole('heading', { name: bizName }).first(),
      'business name heading should render in the workspace hero',
    ).toBeVisible({ timeout: 20_000 });

    // The return-to-creator affordance must exist (creator context).
    await expect(
      page.locator('[data-testid="business-return-creator"]'),
      'return-to-creator link must render',
    ).toBeVisible();

    // Status pill: brand-new business is ACTIVE (no approval gate).
    await expect(
      workspace.locator('[data-testid="business-status-pill"]').getByText('Active', { exact: true }),
      'new business profile must be Active',
    ).toBeVisible({ timeout: 10_000 });

    // Phase 3 bridge: the workspace exposes the public deep-link
    // (``/business/{slug}``) so the owner can share their page.
    await expect(
      page.locator('[data-testid="business-view-public"]'),
      'the "View public page" link must render in the workspace',
    ).toBeVisible();
    await expect(page.locator('[data-testid="business-view-public"]'))
      .toHaveAttribute('href', /\/business\/e2e-biz-\d+/);
  });

  test('workspace is owner-isolated — another user cannot see it', async ({ page }) => {
    // ── 1. User A signs up + creates a business via the API ──────────
    const ownerSession = await signupFreshUser(page, 'own', { creator: true });
    const bizName = `E2E Private ${Date.now()}`;
    const createResp = await page.request.post(`${BASE}/api/business/profiles/`, {
      headers: { Authorization: `Bearer ${ownerSession.access}` },
      data: { name: bizName, tagline: 'private workspace' },
    });
    expect(createResp.status(), 'create business as owner should be 201').toBe(201);
    const created = await createResp.json();
    expect(created.status, 'new business must start active').toBe('active');

    // ── 2. User B (a different account) boots the session ────────────
    const strangerSession = await signupFreshUser(page, 'str');
    await seedSession(page, strangerSession);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await spaNavigate(page, `/business/${created.slug}/workspace`);

    // ── 3. The workspace renders its not-found state — never the data ─
    const workspace = page.locator('[data-testid="business-workspace"]');
    await expect(workspace, 'workspace shell should render').toBeVisible({ timeout: 30_000 });
    await expect(
      workspace.getByText(/not exist|don't own/i),
      'non-owner must see the not-found state (no existence leak)',
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      workspace.getByText(bizName, { exact: true }),
      'stranger must NEVER see the business name',
    ).toHaveCount(0);
  });
});

test.describe('Business Profile — public page', () => {
  /** Create an ACTIVE business profile via the API as ``session``. */
  async function createActiveBusiness(page, session, name) {
    const resp = await page.request.post(`${BASE}/api/business/profiles/`, {
      headers: { Authorization: `Bearer ${session.access}` },
      data: { name, tagline: 'public test tagline' },
    });
    expect(resp.status(), 'create business should be 201').toBe(201);
    return resp.json();
  }

  test('anonymous visitor can open an active business public page by slug', async ({ page }) => {
    // ── 1. Owner creates an active business via the API ──────────────
    const ownerSession = await signupFreshUser(page, 'pub', { creator: true });
    const bizName = `E2E Public ${Date.now()}`;
    const created = await createActiveBusiness(page, ownerSession, bizName);
    expect(created.status, 'new business must be active').toBe('active');

    // ── 2. ANONYMOUS visitor (no seeded session) hits the deep-link ─
    await page.context().clearCookies();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await spaNavigate(page, `/business/${created.slug}`);

    // ── 3. The public sheet renders the brand + owner credit ────────
    const sheet = page.locator('[data-testid="business-public-sheet"]');
    await expect(sheet, 'public business sheet should render').toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole('heading', { name: bizName }),
      'business name must render on the public page',
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      sheet.locator('[data-testid="business-public-owner"]'),
      'the owner credit line must render',
    ).toBeVisible({ timeout: 20_000 });

    // The page is NOT an auth surface — the back affordance works
    // without any session (never bounced to /sheet/auth).
    await expect(
      sheet.locator('[data-testid="business-public-back-btn"]'),
      'public page must render for anonymous visitors',
    ).toBeVisible();
  });

  test('owner sets public contact fields in Settings — they render for visitors', async ({ page }) => {
    // ── 1. Owner (creator) creates a business ───────────────────────
    const ownerSession = await signupFreshUser(page, 'pfc', { creator: true });
    const bizName = `E2E Contact Shop ${Date.now()}`;
    const createResp = await page.request.post(`${BASE}/api/business/profiles/`, {
      headers: { Authorization: `Bearer ${ownerSession.access}` },
      data: { name: bizName },
    });
    expect(createResp.status(), 'create business should be 201').toBe(201);
    const biz = await createResp.json();

    // ── 2. Owner fills the Settings contact section in the UI ───────
    await seedSession(page, ownerSession);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await spaNavigate(page, `/business/${biz.slug}/workspace`);
    const workspace = page.locator('[data-testid="business-workspace"]');
    await expect(workspace, 'workspace should render').toBeVisible({ timeout: 30_000 });
    await page.locator('[data-testid="business-tab-settings"]').click();
    await expect(
      page.locator('[data-testid="business-settings-contact"]'),
      'the public contact section must render in Settings',
    ).toBeVisible({ timeout: 20_000 });

    await page.locator('[data-testid="business-settings-location"]').fill('Pòtoprens, HT');
    await page.locator('[data-testid="business-settings-email"]').fill('shop@e2e.test');
    await page.locator('[data-testid="business-settings-phone"]').fill('+509 5555 5555');
    await page.locator('[data-testid="business-settings-website"]').fill('https://e2e-shop.test');
    await page.locator('[data-testid="business-settings-hours-mon"]').fill('09:00–17:00');
    await page.locator('[data-testid="business-settings-hours-sun"]').fill('Closed');
    await page.locator('[data-testid="business-settings-submit"]').click();
    // Wait for the PATCH to actually resolve before navigating away —
    // the success toast only fires after the save completes.
    await expect(
      page.getByText(/Business Profile updated/i),
      'the save toast must confirm the PATCH completed',
    ).toBeVisible({ timeout: 15_000 });

    // ── 3. ANONYMOUS visitor opens the public page → sees it all ────
    await page.context().clearCookies();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await spaNavigate(page, `/business/${biz.slug}`);

    const sheet = page.locator('[data-testid="business-public-sheet"]');
    await expect(sheet, 'public sheet should render').toBeVisible({ timeout: 30_000 });
    const info = page.locator('[data-testid="business-public-info-section"]');
    await expect(info, 'the info section must render').toBeVisible({ timeout: 20_000 });
    await expect(info.getByText('Pòtoprens, HT'), 'location must render').toBeVisible();
    await expect(info.getByText('shop@e2e.test'), 'contact email must render').toBeVisible();
    await expect(info.getByText('+509 5555 5555'), 'phone must render').toBeVisible();
    await expect(
      page.locator('[data-testid="business-public-website"]'),
      'the website link must render',
    ).toBeVisible();
    const hours = page.locator('[data-testid="business-public-hours"]');
    await expect(hours, 'the operating-hours block must render').toBeVisible({ timeout: 20_000 });
    await expect(hours.getByText('09:00–17:00'), 'Monday hours must render').toBeVisible();
    await expect(hours.getByText('Closed'), 'a closed day must render').toBeVisible();
  });

  test('a deactivated business public page shows the not-found state', async ({ page }) => {
    // ── 1. Owner creates + deactivates via the API ──────────────────
    const ownerSession = await signupFreshUser(page, 'dorm', { creator: true });
    const created = await createActiveBusiness(page, ownerSession, `E2E Dormant ${Date.now()}`);
    const deactResp = await page.request.post(
      `${BASE}/api/business/profiles/${created.id}/deactivate/`,
      { headers: { Authorization: `Bearer ${ownerSession.access}` } },
    );
    expect(deactResp.status(), 'deactivate should succeed').toBe(200);

    // ── 2. Anonymous visitor hits the deep-link ─────────────────────
    await page.context().clearCookies();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await spaNavigate(page, `/business/${created.slug}`);

    // ── 3. The not-found state renders — never the dormant brand ────
    const sheet = page.locator('[data-testid="business-public-sheet"]');
    await expect(sheet, 'public sheet shell should render').toBeVisible({ timeout: 30_000 });
    await expect(
      sheet.getByText(/does not exist|not active/i),
      'dormant business must show the not-found state',
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      sheet.getByText(created.name, { exact: true }),
      'a deactivated business must NEVER be publicly visible',
    ).toHaveCount(0);
  });
});

test.describe('Business Profile — seller capability (Phase 5)', () => {
  test('seller tab renders and shows the KYC gate for an unverified owner', async ({ page }) => {
    // ── 1. Owner signs up + creates a business via the API ──────────
    const ownerSession = await signupFreshUser(page, 'sell', { creator: true });
    const bizName = `E2E Seller ${Date.now()}`;
    const createResp = await page.request.post(`${BASE}/api/business/profiles/`, {
      headers: { Authorization: `Bearer ${ownerSession.access}` },
      data: { name: bizName, tagline: 'seller test' },
    });
    expect(createResp.status(), 'create business should be 201').toBe(201);
    const created = await createResp.json();

    await seedSession(page, ownerSession);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await spaNavigate(page, `/business/${created.slug}/workspace`);

    const workspace = page.locator('[data-testid="business-workspace"]');
    await expect(workspace, 'workspace should render').toBeVisible({ timeout: 30_000 });

    // ── 2. Open the Seller tab ──────────────────────────────────────
    await page.locator('[data-testid="business-tab-seller"]').click();
    await expect(
      page.locator('[data-testid="business-seller"]'),
      'seller section should render',
    ).toBeVisible({ timeout: 20_000 });

    // Fresh user has NO KYC → the capability is inactive and the
    // activate button is disabled (backend gate would refuse anyway).
    await expect(
      page.locator('[data-testid="business-seller-status"]'),
      'seller status pill should render',
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('[data-testid="business-seller-status"]')
        .getByText(/Inactive/i),
      'a fresh business must start with Seller inactive',
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="business-seller-activate"]'),
      'the activate button must render',
    ).toBeVisible();
  });
});

test.describe('Business Profile — catalog (Phase 4)', () => {
  test('owner adds an item through the workspace catalog tab', async ({ page }) => {
    // ── 1. Owner signs up + creates a business via the API ──────────
    const ownerSession = await signupFreshUser(page, 'cat', { creator: true });
    const bizName = `E2E Cat Shop ${Date.now()}`;
    const createResp = await page.request.post(`${BASE}/api/business/profiles/`, {
      headers: { Authorization: `Bearer ${ownerSession.access}` },
      data: { name: bizName, tagline: 'catalog test' },
    });
    expect(createResp.status(), 'create business should be 201').toBe(201);
    const created = await createResp.json();

    await seedSession(page, ownerSession);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await spaNavigate(page, `/business/${created.slug}/workspace`);

    const workspace = page.locator('[data-testid="business-workspace"]');
    await expect(workspace, 'workspace should render').toBeVisible({ timeout: 30_000 });

    // ── 2. Open the Catalog tab ─────────────────────────────────────
    await page.locator('[data-testid="business-tab-catalog"]').click();
    await expect(
      page.locator('[data-testid="business-catalog"]'),
      'catalog section should render',
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('[data-testid="business-catalog-empty"]'),
      'a brand-new catalog must be empty',
    ).toBeVisible({ timeout: 20_000 });

    // ── 3. Add an item through the modal ────────────────────────────
    await page.locator('[data-testid="business-catalog-add"]').click();
    const form = page.locator('[data-testid="business-catalog-form"]');
    await expect(form, 'add-item modal should open').toBeVisible({ timeout: 10_000 });

    const itemName = `Logo Pack ${Date.now()}`;
    await page.locator('[data-testid="business-catalog-name"]').fill(itemName);
    await page.locator('[data-testid="business-catalog-price"]').fill('150');
    await page.locator('[data-testid="business-catalog-submit"]').click();

    // ── 4. The item card appears in the catalog list ────────────────
    await expect(
      page.locator('[data-testid="business-catalog-item"]'),
      'the new item card should render',
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('[data-testid="business-catalog-item"]').getByText(itemName),
      'the item name should render on the card',
    ).toBeVisible();
  });

  test('public page shows only ACTIVE items — drafts stay private', async ({ page }) => {
    // ── 1. Owner creates a business + one active + one draft item ───
    const ownerSession = await signupFreshUser(page, 'catpub', { creator: true });
    const bizName = `E2E Public Cat ${Date.now()}`;
    const createResp = await page.request.post(`${BASE}/api/business/profiles/`, {
      headers: { Authorization: `Bearer ${ownerSession.access}` },
      data: { name: bizName },
    });
    expect(createResp.status(), 'create business should be 201').toBe(201);
    const biz = await createResp.json();

    const itemBase = `Item ${Date.now()}`;
    const activeItem = `${itemBase} (Active)`;
    const draftItem = `${itemBase} (Draft)`;
    const itemResp = await page.request.post(`${BASE}/api/business/catalog/`, {
      headers: { Authorization: `Bearer ${ownerSession.access}` },
      data: { business_profile: biz.id, name: activeItem, price: '25.00', status: 'active' },
    });
    expect(itemResp.status(), 'create active item should be 201').toBe(201);
    const draftResp = await page.request.post(`${BASE}/api/business/catalog/`, {
      headers: { Authorization: `Bearer ${ownerSession.access}` },
      data: { business_profile: biz.id, name: draftItem, price: '10.00', status: 'draft' },
    });
    expect(draftResp.status(), 'create draft item should be 201').toBe(201);

    // ── 2. Anonymous visitor opens the public page ──────────────────
    await page.context().clearCookies();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await spaNavigate(page, `/business/${biz.slug}`);

    const sheet = page.locator('[data-testid="business-public-sheet"]');
    await expect(sheet, 'public sheet should render').toBeVisible({ timeout: 30_000 });
    await expect(
      sheet.getByText(activeItem),
      'the ACTIVE item must render on the public page',
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      sheet.getByText(draftItem),
      'a DRAFT item must NEVER be publicly visible',
    ).toHaveCount(0);
  });
});

test.describe('Business Profile — analytics tab (Phase 7)', () => {
  test('the workspace analytics tab renders KPIs and an empty revenue chart', async ({ page }) => {
    // ── 1. Owner signs up + creates a business via the API ──────────
    const ownerSession = await signupFreshUser(page, 'ana', { creator: true });
    const bizName = `E2E Analytics ${Date.now()}`;
    const createResp = await page.request.post(`${BASE}/api/business/profiles/`, {
      headers: { Authorization: `Bearer ${ownerSession.access}` },
      data: { name: bizName, tagline: 'analytics test' },
    });
    expect(createResp.status(), 'create business should be 201').toBe(201);
    const created = await createResp.json();

    await seedSession(page, ownerSession);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await spaNavigate(page, `/business/${created.slug}/workspace`);

    const workspace = page.locator('[data-testid="business-workspace"]');
    await expect(workspace, 'workspace should render').toBeVisible({ timeout: 30_000 });

    // ── 2. Open the Analytics tab ───────────────────────────────────
    await page.locator('[data-testid="business-tab-analytics"]').click();
    await expect(
      page.locator('[data-testid="business-analytics"]'),
      'analytics section should render',
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('[data-testid="business-analytics-kpis"]'),
      'the KPI cards must render (revenue, paid orders, units, customers)',
    ).toBeVisible({ timeout: 20_000 });

    // A fresh business has zero paid orders → the empty state shows.
    await expect(
      page.locator('[data-testid="business-analytics"]').getByText(/No paid revenue|Pokò gen revni/i),
      'empty revenue state must render for a shop with no paid orders',
    ).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('Business Profile — reviews (Phase 6b)', () => {
  test('a fulfilled order can be reviewed and the review appears on the public page', async ({ page }) => {
    // ── 1. Owner creates a business + an active catalog item ─────────
    const ownerSession = await signupFreshUser(page, 'rev_own', { creator: true });
    const bizResp = await page.request.post(`${BASE}/api/business/profiles/`, {
      headers: { Authorization: `Bearer ${ownerSession.access}` },
      data: { name: `E2E Reviewed Shop ${Date.now()}` },
    });
    expect(bizResp.status(), 'create business should be 201').toBe(201);
    const biz = await bizResp.json();
    const itemResp = await page.request.post(`${BASE}/api/business/catalog/`, {
      headers: { Authorization: `Bearer ${ownerSession.access}` },
      data: { business_profile: biz.id, name: `Reviewed Widget ${Date.now()}`, price: '30.00', status: 'active' },
    });
    expect(itemResp.status(), 'create item should be 201').toBe(201);
    const item = await itemResp.json();

    // ── 2. Customer orders, then the owner fulfills it ──────────────
    const customerSession = await signupFreshUser(page, 'rev_cust');
    const orderResp = await page.request.post(`${BASE}/api/business/orders/`, {
      headers: { Authorization: `Bearer ${customerSession.access}` },
      data: { item: item.id, quantity: 1 },
    });
    expect(orderResp.status(), 'customer order should be 201').toBe(201);
    const order = await orderResp.json();
    const fulfilResp = await page.request.patch(
      `${BASE}/api/business/orders/${order.id}/status/`,
      {
        headers: { Authorization: `Bearer ${ownerSession.access}` },
        data: { status: 'fulfilled' },
      },
    );
    expect(fulfilResp.status(), 'owner must be able to fulfill the order').toBe(200);

    // ── 3. Customer reviews via the API (rating + comment) ──────────
    const reviewComment = `Excellent service ${Date.now()}`;
    const reviewResp = await page.request.post(`${BASE}/api/business/orders/${order.id}/review/`, {
      headers: { Authorization: `Bearer ${customerSession.access}` },
      data: { rating: 5, comment: reviewComment },
    });
    expect(reviewResp.status(), 'customer review should be 201').toBe(201);

    // ── 4. ANONYMOUS visitor opens the public page → sees the review ─
    await page.context().clearCookies();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await spaNavigate(page, `/business/${biz.slug}`);

    const sheet = page.locator('[data-testid="business-public-sheet"]');
    await expect(sheet, 'public sheet should render').toBeVisible({ timeout: 30_000 });
    const wall = page.locator('[data-testid="business-public-reviews-section"]');
    await expect(wall, 'the reviews section must render on the public page').toBeVisible({ timeout: 30_000 });
    await expect(
      wall.getByText(reviewComment),
      'the review comment must be publicly visible',
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      wall.getByText(new RegExp(`@${customerSession.user.username}`)),
      'the reviewer public username must be credited',
    ).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('Business Profile — FAQs (Phase 7a)', () => {
  test('business + product FAQs render on the public page, drafts stay private', async ({ page }) => {
    // ── 1. Owner creates a business + an active catalog item ─────────
    const ownerSession = await signupFreshUser(page, 'faq_own', { creator: true });
    const bizResp = await page.request.post(`${BASE}/api/business/profiles/`, {
      headers: { Authorization: `Bearer ${ownerSession.access}` },
      data: { name: `E2E FAQ Shop ${Date.now()}` },
    });
    expect(bizResp.status(), 'create business should be 201').toBe(201);
    const biz = await bizResp.json();
    const itemResp = await page.request.post(`${BASE}/api/business/catalog/`, {
      headers: { Authorization: `Bearer ${ownerSession.access}` },
      data: { business_profile: biz.id, name: `FAQ Widget ${Date.now()}`, price: '15.00', status: 'active' },
    });
    expect(itemResp.status(), 'create item should be 201').toBe(201);
    const item = await itemResp.json();

    // ── 2. Owner adds a business FAQ, a product FAQ, and a DRAFT FAQ ─
    const bizQ = `Where are you located? ${Date.now()}`;
    const prodQ = `Do you offer a warranty? ${Date.now()}`;
    const draftQ = `Secret draft question ${Date.now()}`;
    const bizFaqResp = await page.request.post(`${BASE}/api/business/faqs/`, {
      headers: { Authorization: `Bearer ${ownerSession.access}` },
      data: { business_profile: biz.id, question: bizQ, answer: 'Downtown, Pòtoprens.' },
    });
    expect(bizFaqResp.status(), 'create business FAQ should be 201').toBe(201);
    const prodFaqResp = await page.request.post(`${BASE}/api/business/product-faqs/`, {
      headers: { Authorization: `Bearer ${ownerSession.access}` },
      data: { catalog_item: item.id, question: prodQ, answer: 'Yes, 30 days.' },
    });
    expect(prodFaqResp.status(), 'create product FAQ should be 201').toBe(201);
    await page.request.post(`${BASE}/api/business/faqs/`, {
      headers: { Authorization: `Bearer ${ownerSession.access}` },
      data: { business_profile: biz.id, question: draftQ, answer: 'Never shown.', status: 'draft' },
    });

    // ── 3. ANONYMOUS visitor opens the public page → sees the FAQs ──
    await page.context().clearCookies();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await spaNavigate(page, `/business/${biz.slug}`);

    const sheet = page.locator('[data-testid="business-public-sheet"]');
    await expect(sheet, 'public sheet should render').toBeVisible({ timeout: 30_000 });
    const faqSection = page.locator('[data-testid="business-public-faqs-section"]');
    await expect(faqSection, 'the FAQ section must render on the public page').toBeVisible({ timeout: 30_000 });

    // Business FAQ is grouped under its own heading.
    await expect(
      faqSection.locator('[data-testid="business-public-business-faqs"]').getByText(bizQ),
      'the business FAQ must be publicly visible',
    ).toBeVisible({ timeout: 20_000 });
    // Product FAQ is grouped under its product.
    await expect(
      faqSection.locator('[data-testid="business-public-product-faqs"]').getByText(prodQ),
      'the product FAQ must be publicly visible under its product',
    ).toBeVisible({ timeout: 20_000 });
    // Draft FAQ NEVER leaks.
    await expect(
      faqSection.getByText(draftQ),
      'a DRAFT FAQ must NEVER be publicly visible',
    ).toHaveCount(0);

    // The accordion opens on click (accessible <details>/<summary>).
    const details = faqSection.locator('[data-testid="business-public-faq-item"]').filter({ hasText: bizQ });
    await details.getByRole('summary').click();
    await expect(
      details.getByText('Downtown, Pòtoprens.'),
      'the FAQ answer must reveal when the accordion opens',
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Business Profile — customer inquiries (Phase 8)', () => {
  test('a customer asks a question, the owner replies in the Messages tab', async ({ page }) => {
    // ── 1. Owner (creator) creates a business ───────────────────────
    const ownerSession = await signupFreshUser(page, 'inq_own', { creator: true });
    const bizResp = await page.request.post(`${BASE}/api/business/profiles/`, {
      headers: { Authorization: `Bearer ${ownerSession.access}` },
      data: { name: `E2E Inquiry Shop ${Date.now()}` },
    });
    expect(bizResp.status(), 'create business should be 201').toBe(201);
    const biz = await bizResp.json();

    // ── 2. Customer asks a question via the API ─────────────────────
    const customerSession = await signupFreshUser(page, 'inq_cust');
    const question = `Do you offer delivery? ${Date.now()}`;
    const askResp = await page.request.post(`${BASE}/api/business/inquiries/`, {
      headers: { Authorization: `Bearer ${customerSession.access}` },
      data: {
        business_profile: biz.id,
        topic: 'general',
        subject: question,
        body: 'I would like to know if you deliver to my area.',
      },
    });
    expect(askResp.status(), 'customer inquiry should be 201').toBe(201);
    const inquiry = await askResp.json();

    // ── 3. Owner replies via the API ────────────────────────────────
    const replyText = `Yes, we deliver. ${Date.now()}`;
    const replyResp = await page.request.post(
      `${BASE}/api/business/inquiries/${inquiry.id}/reply/`,
      {
        headers: { Authorization: `Bearer ${ownerSession.access}` },
        data: { reply: replyText },
      },
    );
    expect(replyResp.status(), 'owner reply should succeed').toBe(200);

    // ── 4. Owner opens the workspace → Messages tab shows it ────────
    await seedSession(page, ownerSession);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await spaNavigate(page, `/business/${biz.slug}/workspace`);
    const workspace = page.locator('[data-testid="business-workspace"]');
    await expect(workspace, 'workspace should render').toBeVisible({ timeout: 30_000 });
    await page.locator('[data-testid="business-tab-inquiries"]').click();
    await expect(
      page.locator('[data-testid="business-inquiries"]'),
      'Messages tab should render',
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('[data-testid="business-inquiry-card"]').getByText(question),
      'the inquiry subject must render in the Messages tab',
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('[data-testid="business-inquiry-card"]').getByText(replyText),
      'the owner reply must render on the card',
    ).toBeVisible();

    // ── 5. The customer sees the reply in the contact modal ─────────
    await seedSession(page, customerSession);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await spaNavigate(page, `/business/${biz.slug}`);
    const sheet = page.locator('[data-testid="business-public-sheet"]');
    await expect(sheet, 'public sheet should render').toBeVisible({ timeout: 30_000 });
    await page.locator('[data-testid="business-public-contact-btn"]').click();
    await expect(
      page.locator('[data-testid="business-contact-modal"]'),
      'contact modal should open',
    ).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-testid="business-inquiry-mine-toggle"]').click();
    await expect(
      page.locator('[data-testid="business-inquiry-mine-list"]'),
      'My inquiries list should open',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('[data-testid="business-inquiry-mine-list"]').getByText(question),
      'the customer must see their own inquiry',
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('[data-testid="business-inquiry-mine-list"]').getByText(replyText),
      'the customer must see the owner reply',
    ).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('Business Profile — creator suspension lock (Phase 10)', () => {
  test('suspending the creator locks the workspace; restoring re-opens it', async ({ page }) => {
    // ── 1. Owner (approved creator) creates a business ───────────────
    const ownerSession = await signupFreshUser(page, 'susp_own', { creator: true });
    const bizResp = await page.request.post(`${BASE}/api/business/profiles/`, {
      headers: { Authorization: `Bearer ${ownerSession.access}` },
      data: { name: `E2E Locked Shop ${Date.now()}` },
    });
    expect(bizResp.status(), 'create business should be 201').toBe(201);
    const biz = await bizResp.json();

    // ── 2. Staff suspends the owner's creator application (real flow) ─
    const appsResp = await page.request.get(`${BASE}/api/identity/creator-apply/`, {
      headers: { Authorization: `Bearer ${ownerSession.access}` },
    });
    expect(appsResp.status(), 'owner must read their own application').toBe(200);
    const apps = await appsResp.json();
    const app = Array.isArray(apps) ? apps[0] : (apps.results?.[0] ?? apps.data?.[0]);
    expect(app?.id, 'owner must have a CreatorApplication row').toBeTruthy();

    const staffLogin = await page.request.post(`${BASE}/api/login/`, {
      data: { email: 'e2e_staff@atelnyo.local', password: E2E_PASSWORD },
    });
    expect(staffLogin.status(), 'staff login should succeed').toBe(200);
    const staffBody = await staffLogin.json();
    const staffAccess = staffBody.access ?? staffBody.data?.access;
    expect(staffAccess, 'staff login must return an access token').toBeTruthy();

    const suspendResp = await page.request.post(
      `${BASE}/api/identity/creator-apply/${app.id}/suspend/`,
      {
        headers: { Authorization: `Bearer ${staffAccess}` },
        data: { reason: 'E2E moderation hold' },
      },
    );
    expect(suspendResp.status(), 'staff suspension should succeed').toBe(200);

    // ── 3. Owner loads the workspace → LOCKED state, no management UI ─
    await seedSession(page, ownerSession);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await spaNavigate(page, `/business/${biz.slug}/workspace`);

    const workspace = page.locator('[data-testid="business-workspace"]');
    await expect(workspace, 'workspace shell should render').toBeVisible({ timeout: 30_000 });
    await expect(
      page.locator('[data-testid="business-workspace-locked"]'),
      'the lock panel must render while the creator is suspended',
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('[data-testid="business-tab-catalog"]'),
      'management tabs must be hidden while locked',
    ).toHaveCount(0);

    // ── 4. Backend is authoritative: owner mutations are refused ────
    const patchResp = await page.request.patch(
      `${BASE}/api/business/profiles/${biz.id}/`,
      {
        headers: { Authorization: `Bearer ${ownerSession.access}` },
        data: { tagline: 'Nope' },
      },
    );
    expect(patchResp.status(), 'owner PATCH must be 403 while suspended').toBe(403);
    const patchBody = await patchResp.json();
    expect(patchBody.code, 'the 403 must carry the lock code')
      .toBe('business_workspace_locked');

    // The hub card also surfaces the lock.
    await spaNavigate(page, '/business');
    await expect(
      page.locator('[data-testid="business-card-locked"]'),
      'the hub card must show the locked badge while suspended',
    ).toBeVisible({ timeout: 20_000 });
    // Phase 10 display fix — the hub renders from the backend
    // /eligibility/ endpoint, so a suspended creator (whose local
    // is_creator flag is stale) must NOT see the create CTA.
    await expect(
      page.locator('[data-testid="business-hub-create"]'),
      'the create CTA must be hidden for a suspended creator',
    ).toHaveCount(0);

    // ── 5. Staff restores → the workspace unlocks immediately ────────
    const restoreResp = await page.request.post(
      `${BASE}/api/identity/creator-apply/${app.id}/restore/`,
      {
        headers: { Authorization: `Bearer ${staffAccess}` },
        data: { reason: 'E2E restored' },
      },
    );
    expect(restoreResp.status(), 'staff restore should succeed').toBe(200);

    await spaNavigate(page, `/business/${biz.slug}/workspace`);
    await expect(
      page.locator('[data-testid="business-workspace-locked"]'),
      'the lock panel must disappear after restore',
    ).toHaveCount(0, { timeout: 20_000 });
    await expect(
      page.locator('[data-testid="business-tab-catalog"]'),
      'management tabs must return after restore',
    ).toBeVisible({ timeout: 20_000 });

    const rePatch = await page.request.patch(
      `${BASE}/api/business/profiles/${biz.id}/`,
      {
        headers: { Authorization: `Bearer ${ownerSession.access}` },
        data: { tagline: 'Back in business' },
      },
    );
    expect(rePatch.status(), 'owner PATCH must work again after restore').toBe(200);
  });
});

test.describe('Business Profile — OG metadata (crawler endpoint)', () => {
  test('the server-rendered OG endpoint serves per-business meta; dormant 404s', async ({ page }) => {
    // ── 1. Owner creates an ACTIVE business via the API ──────────────
    const ownerSession = await signupFreshUser(page, 'og_own', { creator: true });
    const bizName = `E2E OG Shop ${Date.now()}`;
    const bizResp = await page.request.post(`${BASE}/api/business/profiles/`, {
      headers: { Authorization: `Bearer ${ownerSession.access}` },
      data: { name: bizName, tagline: 'OG meta test' },
    });
    expect(bizResp.status(), 'create business should be 201').toBe(201);
    const biz = await bizResp.json();

    // ── 2. Crawler hits the Django-hosted OG endpoint directly ──────
    const ogResp = await page.request.get(`${BE}/business/${biz.slug}/og/`);
    expect(ogResp.status(), 'the OG endpoint must serve 200 for an active business').toBe(200);
    const html = await ogResp.text();
    expect(html, 'the prerendered HTML must carry OG tags').toContain('og:title');
    expect(html, 'og:title must echo the business name').toContain(bizName);
    expect(html, 'og:image must render (logo or shared fallback)').toContain('og:image');
    expect(html, 'the SPA deep-link must be the meta-refresh target')
      .toContain(`/business/${biz.slug}`);
    expect(
      ogResp.headers()['x-crawler-tag'],
      'the crawler-tag header must be present (log correlation)',
    ).toBeTruthy();

    // ── 3. Dormant business must 404 — no leak to crawlers ──────────
    const deactResp = await page.request.post(
      `${BASE}/api/business/profiles/${biz.id}/deactivate/`,
      { headers: { Authorization: `Bearer ${ownerSession.access}` } },
    );
    expect(deactResp.status(), 'deactivate should succeed').toBe(200);
    const og404 = await page.request.get(`${BE}/business/${biz.slug}/og/`);
    expect(og404.status(), 'a deactivated business must 404 on the OG endpoint').toBe(404);
  });
});

test.describe('Business Profile — customer My Orders (Phase 6)', () => {
  test('the My Orders card is on Mwen and the tracker shows a placed order', async ({ page }) => {
    // ── 1. Owner creates a business + an active catalog item ─────────
    const ownerSession = await signupFreshUser(page, 'mo_own', { creator: true });
    const bizResp = await page.request.post(`${BASE}/api/business/profiles/`, {
      headers: { Authorization: `Bearer ${ownerSession.access}` },
      data: { name: `E2E Shop ${Date.now()}` },
    });
    expect(bizResp.status(), 'create business should be 201').toBe(201);
    const biz = await bizResp.json();
    const itemResp = await page.request.post(`${BASE}/api/business/catalog/`, {
      headers: { Authorization: `Bearer ${ownerSession.access}` },
      data: { business_profile: biz.id, name: `Widget ${Date.now()}`, price: '20.00', status: 'active' },
    });
    expect(itemResp.status(), 'create item should be 201').toBe(201);
    const item = await itemResp.json();

    // ── 2. Customer signs up + places an order via the API ──────────
    const customerSession = await signupFreshUser(page, 'mo_cust');
    const orderResp = await page.request.post(`${BASE}/api/business/orders/`, {
      headers: { Authorization: `Bearer ${customerSession.access}` },
      data: { item: item.id, quantity: 2 },
    });
    expect(orderResp.status(), 'customer order should be 201').toBe(201);
    const order = await orderResp.json();

    // ── 3. Customer boots the app → the Mwen card renders ───────────
    await seedSession(page, customerSession);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await page.locator('[data-testid="mwen-nav-item"]').click();
    const card = page.locator('[data-testid="mwen-my-orders-card"]');
    await expect(card, 'the My Orders quick-nav card must render on Mwen').toBeVisible({ timeout: 30_000 });

    // ── 4. Open the tracker → the placed order renders with actions ─
    await card.click();
    await expect(page, 'the card must land on /business/orders/mine')
      .toHaveURL(/\/business\/orders\/mine$/);
    const tracker = page.locator('[data-testid="business-my-orders"]');
    await expect(tracker, 'the My Orders page should render').toBeVisible({ timeout: 30_000 });
    await expect(
      tracker.getByText(order.item_name),
      'the placed order item must render in the tracker',
    ).toBeVisible({ timeout: 20_000 });
    // A new + unpaid order is cancellable by the customer themselves.
    await expect(
      tracker.locator('[data-testid="business-my-order-cancel"]'),
      'a new unpaid order must show the customer cancel action',
    ).toBeVisible({ timeout: 20_000 });
  });
});
