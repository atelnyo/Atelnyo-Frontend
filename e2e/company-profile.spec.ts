/**
 * e2e/company-profile.spec.ts
 *
 * Phase Company — Playwright coverage for the in-app company page
 * (``/company/:slug``).
 *
 * Four tests pin the contract:
 *
 *   1. anonymous deep-link load (cold) — visiting ``/company/<slug>``
 *      directly from a fresh context renders the company page with
 *      the canonical meta tag set + hero content. Anonymous means:
 *      no JWT (the page is the public storefront, so it must work
 *      for the share recipient who isn't signed in).
 *
 *   2. verified badge renders when the profile is approved+verified.
 *
 *   3. team + offerings sections render from the public payload.
 *
 *   4. 404 stubbed — when the BE returns 404, the page renders the
 *      error path (NOT a blank screen).
 *
 * Selector strategy mirrors spotlight-detail.spec.ts:
 *   * ``data-testid`` for the test-ID-DOM-contract surface.
 *   * Meta-tag assertions scope to ``[data-rh="true"]`` (the marker
 *     react-helmet-async stamps on every tag it manages) so they
 *     never race the static index.html tags.
 */
import { test, expect } from '@playwright/test';

test.describe('Company profile page', () => {
  test('cold-load: /company/<slug> renders meta + hero', async ({ page, request }) => {
    await page.context().clearCookies();
    await page.goto('http://127.0.0.1:3000/');
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (_) {
        /* ignore — sandboxed iframe */
      }
    });

    // Probe the BE for an approved company profile (the owner seeds
    // one via the Creator Studio flow; the list is anonymous-OK).
    const listResp = await request.get('http://127.0.0.1:8000/api/companies/');
    expect(listResp.status(), '/api/companies/ should be 200 anonymous').toBe(200);
    const listData = await listResp.json();
    const approvedRow = (Array.isArray(listData) ? listData : (listData?.results || []))[0];
    if (!approvedRow?.slug) {
      // No approved seed row — skip (better than failing the suite).
      test.skip();
      return;
    }

    await page.goto(`http://127.0.0.1:3000/company/${approvedRow.slug}`);
    await page.reload();

    // Page rendered.
    const sheet = page.locator('[data-testid="company-detail-sheet"]');
    await expect(sheet, 'company sheet should be in the DOM').toBeVisible();

    // Company name visible in the hero.
    await expect(
      page.getByRole('heading', { name: approvedRow.company_name }),
      'company name heading should render',
    ).toBeVisible();

    // Meta tag set is mounted (Helmet).
    const ogTitle = page.locator('head meta[property="og:title"][data-rh="true"]');
    await expect(ogTitle, 'og:title meta tag should be present (Helmet-managed)').toHaveCount(1);
    const ogTitleContent = await ogTitle.getAttribute('content');
    expect(ogTitleContent?.length ?? 0, 'og:title must be > 0 chars').toBeGreaterThan(0);

    const twitterCard = page.locator('head meta[name="twitter:card"][data-rh="true"]');
    await expect(twitterCard, 'twitter:card meta tag should be present').toHaveCount(1);

    // Back button present (the action bar must not overlap the hero —
    // the shared [data-detail-sheet] layout guarantees it).
    const backBtn = page.locator('[data-testid="company-detail-back-btn"]');
    await expect(backBtn, 'back button should render').toBeVisible();
  });

  test('verified badge renders for approved+verified profile', async ({ page, request }) => {
    await page.context().clearCookies();
    await page.goto('http://127.0.0.1:3000/');
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (_) {
        /* ignore */
      }
    });

    const listResp = await request.get('http://127.0.0.1:8000/api/companies/');
    const listData = await listResp.json();
    const rows = Array.isArray(listData) ? listData : (listData?.results || []);
    const verifiedRow = rows.find((r) => r.is_verified) || rows[0];
    if (!verifiedRow?.slug) {
      test.skip();
      return;
    }

    await page.goto(`http://127.0.0.1:3000/company/${verifiedRow.slug}`);
    const sheet = page.locator('[data-testid="company-detail-sheet"]');
    await expect(sheet).toBeVisible();

    if (verifiedRow.is_verified) {
      await expect(
        page.locator('[data-testid="company-verified-badge"]'),
        'verified badge should render when is_verified=true',
      ).toBeVisible();
    }
  });

  test('team + offerings sections render from public payload', async ({ page, request }) => {
    await page.context().clearCookies();
    await page.goto('http://127.0.0.1:3000/');
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (_) {
        /* ignore */
      }
    });

    const listResp = await request.get('http://127.0.0.1:8000/api/companies/');
    const listData = await listResp.json();
    const rows = Array.isArray(listData) ? listData : (listData?.results || []);
    const withContent = rows.find(
      (r) => (r.team_members?.length || 0) > 0 || (r.products_services?.length || 0) > 0,
    ) || rows[0];
    if (!withContent?.slug) {
      test.skip();
      return;
    }

    await page.goto(`http://127.0.0.1:3000/company/${withContent.slug}`);
    const sheet = page.locator('[data-testid="company-detail-sheet"]');
    await expect(sheet).toBeVisible();

    // Sections render conditionally (only when data exists) — the
    // layout must not crash either way.
    if ((withContent.team_members?.length || 0) > 0) {
      await expect(page.locator('[data-testid="company-team-section"]')).toBeVisible();
    }
    if ((withContent.products_services?.length || 0) > 0) {
      await expect(page.locator('[data-testid="company-offerings-section"]')).toBeVisible();
    }
  });

  test('404 stubbed: unknown slug renders error path', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('http://127.0.0.1:3000/');
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (_) {
        /* ignore */
      }
    });

    // A slug that cannot exist — the BE returns 404 → the page
    // must render the error empty state (not a crash, not blank).
    await page.goto('http://127.0.0.1:3000/company/definitely-not-a-real-company-slug-xyz');
    const sheet = page.locator('[data-testid="company-detail-sheet"]');
    await expect(sheet).toBeVisible();
    // The not-found hero message is the empty-state text (HT fallback
    // when no lang is set — anonymous visitors default to 'ht').
    await expect(sheet.getByText(/pa egziste|not found|Not found/i)).toBeVisible();
  });
});
