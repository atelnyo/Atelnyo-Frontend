/**
 * e2e/creator-profile.spec.ts
 *
 * Playwright coverage for the PUBLIC creator profile (/c/:username):
 *
 *   1. the page renders the creator's real identity, and EVERY tab in
 *      the tab bar is clickable and drives the tab panel,
 *   2. Share opens the share modal with the canonical /c/<username> URL,
 *   3. Follow toggles against the real backend (viewer session),
 *   4. an anonymous Follow opens the auth modal in place,
 *   5. the legacy /@username link redirects to /c/username,
 *   6. an unknown creator renders the not-found state.
 *
 * Auth uses the SEEDED accounts (``python manage.py seed_e2e_data``):
 *   • e2e_alice — approved creator, owns the public profile under test
 *   • e2e_bob   — the visitor who follows
 * Signing up fresh users per test exhausted the /api/signup/ IP throttle
 * (429) as soon as the suite grew, so the fixtures are created ONCE in
 * beforeAll and the profile is (re)created through the real
 * ``PATCH /api/creator-profiles/me/`` endpoint (self-heals the
 * CreatorPublicProfile + URL slug).
 *
 * Prereqs (mirror CI): Daphne on :8000 + Vite on :3000 up, and
 * ``python manage.py seed_e2e_data`` run. Daphne MUST be started WITHOUT
 * Supabase auth env (SUPABASE_URL unset/blank) so /api/login/ uses the
 * Django-only fallback.
 */
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';
const E2E_PASSWORD = 'E2ePass!2024';

type Session = { email: string; access: string; refresh: string; user: any };
type Profile = { slug: string; displayName: string; bio: string };

/** The tab bar's labels (English UI) → panel id, in default section order. */
const PROFILE_TABS = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'picks', label: 'Picks' },
  { id: 'courses', label: 'Courses' },
  { id: 'products', label: 'Products' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'about', label: 'About' },
];

let creator: Session;
let viewer: Session;
let creatorProfile: Profile;

/** Log in an existing seeded account and return its JWT + full user blob. */
async function loginSeeded(api: APIRequestContext, email: string): Promise<Session> {
  const resp = await api.post(`${BASE}/api/login/`, {
    data: { email, password: E2E_PASSWORD },
  });
  expect(resp.status(), `login as ${email} should succeed`).toBe(200);
  const body = await resp.json();
  const access = body.access ?? body.data?.access;
  expect(access, 'login must return an access token').toBeTruthy();

  let user = body.user ?? body.data?.user;
  if (!user?.id) {
    const me = await api.get(`${BASE}/api/me/`, {
      headers: { Authorization: `Bearer ${access}` },
    });
    expect(me.status(), '/api/me/ should succeed').toBe(200);
    user = await me.json();
  }
  return { email, access, refresh: body.refresh ?? body.data?.refresh, user };
}

/**
 * Create (or self-heal) the account's public profile through the real
 * endpoint and return its slug + display name.
 */
async function createPublicProfile(api: APIRequestContext, session: Session): Promise<Profile> {
  const displayName = `E2E Creator ${Date.now()}`;
  const bio = `Public profile bio ${Date.now()}`;
  const resp = await api.patch(`${BASE}/api/creator-profiles/me/`, {
    headers: { Authorization: `Bearer ${session.access}` },
    data: {
      display_name: displayName,
      artist_name: displayName,
      bio,
      is_visible: true,
    },
  });
  expect(resp.status(), 'PATCH /creator-profiles/me/ should create the profile').toBe(200);
  const profile = await resp.json();
  const slug = profile.slug || session.user?.username;
  expect(slug, 'the public profile must expose a URL slug').toBeTruthy();

  // The public URL must resolve for anonymous visitors right away.
  const publicResp = await api.get(`${BASE}/api/creator-profiles/${slug}/`);
  expect(publicResp.status(), 'the public profile must be readable').toBe(200);
  return { slug, displayName, bio };
}

test.beforeAll(async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: BASE });
  try {
    creator = await loginSeeded(api, 'e2e_alice@atelnyo.local');
    viewer = await loginSeeded(api, 'e2e_bob@atelnyo.local');
    creatorProfile = await createPublicProfile(api, creator);

    // The viewer must START out not following the creator — an aborted
    // earlier run could have left the follow row behind.
    const state = await api.get(`${BASE}/api/creator-profiles/${creatorProfile.slug}/`, {
      headers: { Authorization: `Bearer ${viewer.access}` },
    });
    if ((await state.json()).is_following) {
      await api.post(`${BASE}/api/creator-profiles/${creatorProfile.slug}/follow/`, {
        headers: { Authorization: `Bearer ${viewer.access}` },
      });
    }
  } finally {
    await api.dispose();
  }
});

/** Seed the app's localStorage auth keys, then boot the app fresh. */
async function seedSession(page: Page, { access, refresh, user }: Session) {
  await page.addInitScript(
    ({ access, refresh, user }) => {
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      localStorage.setItem('user', JSON.stringify(user || {}));
      localStorage.setItem('atelnyo_lang', 'en');
      try { sessionStorage.clear(); } catch (_) { /* ignore */ }
    },
    { access, refresh, user },
  );
}

/** Force the English UI for anonymous scenarios (stable selectors). */
async function seedLang(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('atelnyo_lang', 'en');
    try { sessionStorage.clear(); } catch (_) { /* ignore */ }
  });
}

/** Client-side navigation the way real users reach routes (post-boot). */
async function spaNavigate(page: Page, url: string) {
  await page.evaluate((u) => {
    history.pushState({}, '', u);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, url);
}

/** Boot the app as the seeded session, then open a creator profile. */
async function openProfileAsUser(page: Page, slug: string) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // Wait for the session to hydrate before mounting the profile: the
  // Follow button only calls the API once `user` is known — an early
  // click would be treated as anonymous and open the auth modal.
  await expect(page.locator('.header-profile-btn').first()).toBeVisible({ timeout: 30_000 });
  await spaNavigate(page, `/c/${slug}`);
  await expect(page.locator('.csp-identity-name')).toBeVisible({ timeout: 30_000 });
}

test.describe('Creator public profile — tabs', () => {
  test('renders the real identity and every tab drives its panel', async ({ page }) => {
    await seedSession(page, creator);
    await openProfileAsUser(page, creatorProfile.slug);

    await expect(page.locator('.csp-identity-name')).toHaveText(creatorProfile.displayName);
    await expect(page.getByText(`@${creatorProfile.slug}`, { exact: true }).first()).toBeVisible();

    const panel = page.locator('#csp-content-scroll');
    for (const tab of PROFILE_TABS) {
      const tabButton = page.getByRole('tab', { name: tab.label, exact: true });
      await expect(tabButton, `the ${tab.label} tab must render`).toBeVisible();
      await tabButton.click();
      await expect(tabButton, `${tab.label} must become the active tab`)
        .toHaveAttribute('aria-selected', 'true');
      await expect(panel, `the panel must follow the ${tab.label} tab`)
        .toHaveAttribute('aria-labelledby', `csp-tab-${tab.id}`);
    }

    // The About tab renders the creator's REAL bio (set through the API).
    await page.getByRole('tab', { name: 'About', exact: true }).click();
    await expect(panel.getByText(creatorProfile.bio)).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('Creator public profile — share', () => {
  test('Share opens the modal with the canonical /c/<username> URL', async ({ page }) => {
    await seedLang(page);
    await page.goto(`/c/${creatorProfile.slug}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.csp-identity-name')).toBeVisible({ timeout: 30_000 });

    await page.locator('.csp-header-share').click();
    const dialog = page.getByRole('dialog', { name: 'Share profile' });
    await expect(dialog, 'the share modal must open').toBeVisible({ timeout: 10_000 });

    await expect(dialog.getByLabel('Profile URL'))
      .toHaveValue(new RegExp(`/c/${creatorProfile.slug}$`));
    // The QR code canvas is generated for that same URL.
    await expect(dialog.locator('canvas')).toBeVisible();
  });
});

test.describe('Creator public profile — follow', () => {
  test('Follow toggles against the backend and survives the cache', async ({ page }) => {
    await seedSession(page, viewer);
    await openProfileAsUser(page, creatorProfile.slug);

    // Baseline count — the unfollow must restore it EXACTLY (a stale 1
    // left behind when the last follower leaves is the bug this pins).
    const before = await page.request.get(
      `${BASE}/api/creator-profiles/${creatorProfile.slug}/`,
      { headers: { Authorization: `Bearer ${viewer.access}` } },
    );
    const baseline = Number((await before.json()).followers_count) || 0;

    const followBtn = page.getByRole('button', { name: 'Follow', exact: true });
    await expect(followBtn).toBeVisible({ timeout: 20_000 });
    // The button flips to "Following" OPTIMISTICALLY — wait for the real
    // POST before asserting the backend, or the check races the request.
    const followRequest = page.waitForResponse(
      (r) => r.url().includes(`/creator-profiles/${creatorProfile.slug}/follow/`)
        && r.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await followBtn.click();
    const followResponse = await followRequest;
    expect(followResponse.status(), 'the follow POST must succeed').toBe(200);
    expect((await followResponse.json()).is_following, 'follow response must confirm it')
      .toBe(true);

    await expect(page.getByRole('button', { name: 'Following', exact: true }))
      .toBeVisible({ timeout: 15_000 });

    // Backend is authoritative — the follow really persisted.
    const after = await page.request.get(
      `${BASE}/api/creator-profiles/${creatorProfile.slug}/`,
      { headers: { Authorization: `Bearer ${viewer.access}` } },
    );
    expect(after.status()).toBe(200);
    const afterBody = await after.json();
    expect(afterBody.is_following, 'is_following must be true after the click').toBe(true);
    expect(Number(afterBody.followers_count), 'followers_count must be >= 1').toBeGreaterThanOrEqual(1);

    // Unfollow returns to the initial state (same POST-then-assert rule).
    const unfollowRequest = page.waitForResponse(
      (r) => r.url().includes(`/creator-profiles/${creatorProfile.slug}/follow/`)
        && r.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await page.getByRole('button', { name: 'Following', exact: true }).click();
    const unfollowResponse = await unfollowRequest;
    expect(unfollowResponse.status(), 'the unfollow POST must succeed').toBe(200);
    expect((await unfollowResponse.json()).is_following, 'unfollow response must confirm it')
      .toBe(false);
    await expect(page.getByRole('button', { name: 'Follow', exact: true }))
      .toBeVisible({ timeout: 15_000 });
    const undone = await page.request.get(
      `${BASE}/api/creator-profiles/${creatorProfile.slug}/`,
      { headers: { Authorization: `Bearer ${viewer.access}` } },
    );
    const undoneBody = await undone.json();
    expect(undoneBody.is_following, 'unfollow must persist').toBe(false);
    expect(
      Number(undoneBody.followers_count),
      'the follower count must return to its baseline (never stick at 1)',
    ).toBe(baseline);
  });

  test('an anonymous Follow opens the auth modal in place (no redirect)', async ({ page }) => {
    await seedLang(page);
    await page.goto(`/c/${creatorProfile.slug}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.csp-identity-name')).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Follow', exact: true }).click();
    await expect(
      page.locator('.auth-modal, [data-testid="login-modal"]').first(),
      'an anonymous follow must open the auth modal over the profile',
    ).toBeVisible({ timeout: 15_000 });
    // Still on the profile — the visitor never loses the page.
    await expect(page).toHaveURL(new RegExp(`/c/${creatorProfile.slug}$`));
  });
});

test.describe('Creator public profile — routing', () => {
  test('the legacy /@username link redirects to /c/username', async ({ page }) => {
    await seedLang(page);
    await page.goto(`/@${creatorProfile.slug}`, { waitUntil: 'domcontentloaded' });

    await expect(page, 'the legacy URL must upgrade to the canonical one')
      .toHaveURL(new RegExp(`/c/${creatorProfile.slug}$`), { timeout: 20_000 });
    await expect(page.locator('.csp-identity-name'))
      .toHaveText(creatorProfile.displayName, { timeout: 30_000 });
  });

  test('an unknown creator renders the not-found state', async ({ page }) => {
    await seedLang(page);
    await page.goto(`/c/e2e_missing_${Date.now()}`, { waitUntil: 'domcontentloaded' });

    const notFound = page.locator('.csp-not-found');
    await expect(notFound, 'the not-found state must render').toBeVisible({ timeout: 30_000 });
    await expect(notFound.getByRole('heading', { name: 'Creator not found' })).toBeVisible();
    await expect(notFound.getByRole('button', { name: /Go Back/i })).toBeVisible();
  });
});
