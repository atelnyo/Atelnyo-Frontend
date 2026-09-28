/**
 * e2e/community-alias.spec.ts
 *
 * Phase 49 — Playwright coverage for the community deep-link alias
 * ``/{slug}@{user}/community``. Communities keep their canonical tabbed
 * page at ``/sheet/community/:slug``; the ``/:key/community`` route
 * (CommunityKeyRoute in App.jsx) resolves the key — the community's
 * unique slug, or a numeric pk for hand-typed links — and redirects
 * (replace) to the canonical page.
 *
 * Two tests pin the contract:
 *
 *   1. alias cold-load — visiting ``/{slug}@{user}/community`` from a
 *      fresh context redirects to ``/sheet/community/:slug`` (then the
 *      index ``<Navigate to="events">`` lands on ``…/events``) and the
 *      community detail sheet renders. Anonymous: no JWT.
 *
 *   2. 404 stubbed — when the BE returns 404 for the key, the alias
 *      stays put (no redirect) and the NotFound surface renders
 *      (NOT a blank screen, NOT an infinite spinner, NOT a crash).
 *
 * Selector strategy mirrors the spotlight-detail.spec.ts suite:
 *   * ``data-testid="community-detail-sheet"`` for the detail root.
 *   * ``.not-found-code`` for the NotFound surface (no testid on
 *     NotFound today — the 404 text is the contract).
 *
 * Depends on the live Vite (:3000) + Daphne (:8000) servers, same as
 * every other spec in e2e/.
 */
import { test, expect } from '@playwright/test';

test.describe('Community deep-link alias (/:key/community)', () => {
  test('cold-load: /{slug}@{user}/community redirects to the canonical page', async ({ page, request }) => {
    // Anonymous cold-load via clearCookies + clearStorage + reload.
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

    // Probe the BE for a public community (seed_e2e_data produces one).
    // CatalogPagination wraps the list in { count, next, previous, results }.
    const listResp = await request.get('http://127.0.0.1:8000/api/communities/');
    expect(listResp.status(), '/api/communities/ should be 200 anonymous').toBe(200);
    const row = (await listResp.json())?.results?.[0];
    if (!row?.slug || !row?.user_key) {
      // No seeded community row — skip (better than failing the suite).
      test.skip();
      return;
    }

    // Alias deep-link: the key is the community slug, the ``@user``
    // part is cosmetic (the FE never validates it).
    const alias = `http://127.0.0.1:3000/${row.slug}@${row.user_key}/community`;
    await page.goto(alias);

    // CommunityKeyRoute resolves the slug and replace-redirects to the
    // canonical tabbed page; the index route bounces to the events tab.
    // Slugs are SlugField-safe ([a-z0-9-]), so a plain regex is fine.
    await page.waitForURL(new RegExp(`/sheet/community/${row.slug}(/events)?$`));

    const sheet = page.locator('[data-testid="community-detail-sheet"]');
    await expect(sheet, 'community detail sheet should render after redirect').toBeVisible();
  });

  test('404 stubbed: alias renders NotFound, no redirect', async ({ page }) => {
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

    // Stub only the community *retrieve* path — not the members/events/
    // announcements/files/courses sub-actions, and not the list.
    await page.route('**/api/communities/**', (route) => {
      const url = route.request().url();
      if (/\/api\/communities\/[^/]+\/?$/.test(url)) {
        return route.fulfill({ status: 404, body: JSON.stringify({ detail: 'Not found.' }) });
      }
      return route.continue();
    });

    // Direct deep-link with a slug that's never minted.
    await page.goto('http://127.0.0.1:3000/nonexistent-community@Atelnyo/community');

    // The alias stays on the key URL — the resolve failed, so no
    // redirect happened (CommunityKeyRoute renders NotFound instead).
    await expect(page).toHaveURL(/\/nonexistent-community@devrose\/community$/);

    const notFound = page.locator('.not-found-code');
    await expect(notFound, '404 NotFound surface should render').toBeVisible({ timeout: 5_000 });
    await expect(notFound).toHaveText('404');
  });
});
