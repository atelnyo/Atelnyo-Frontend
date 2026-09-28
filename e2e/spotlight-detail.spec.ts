/**
 * e2e/spotlight-detail.spec.ts
 *
 * Phase 49 §11.2 — Playwright coverage for the Spotlight deep-link
 * page (``/sheet/spotlight/<id>`` and the canonical
 * ``/{id}@{user}/spotlight`` content deep-link). The legacy
 * ``/sheet/spotlight/<id>`` URL auto-redirects (replace) to the
 * canonical shape once the payload loads.
 *
 * Three tests pin the contract:
 *
 *   1. anonymous deep-link load (cold) — visiting
 *      ``/sheet/spotlight/<id>`` directly from a fresh context
 *      renders the detail page with the canonical meta tag set +
 *      the model content card. Anonymous means:
 *      no JWT (the page is the canonical re-engagement surface
 *      for a pasted link, so it must work for the social share
 *      recipient who isn't signed in).
 *
 *   2. from Explore card click — the Spotlight chip card on
 *      /sheet/explore is now a deep-link trigger; clicking it
 *      navigates to the detail page. This is the canonical
 *      in-app path; mirrors the FE flow documented in the
 *      component docstring.
 *
 *   3. 404 stubbed — when the BE returns 404, the page renders
 *      the error path (NOT a blank screen, NOT a silent crash).
 *      Mirrors the catalog-anonymous-load.spec.ts structure.
 *
 * Selector strategy mirrors the existing spotlight-chip.spec.ts:
 *   * ``data-testid`` for the test-ID-DOM-contract surface (most
 *     stable — survives CSS-name churn).
 *   * ``data-spotlight-id`` for catalog-row PK anchor.
 *   * FontAwesome icon classes for iconography-stable assertions.
 *
 * Meta-tag assertions use ``page.locator('meta[property="og:title"]')``
 * which is the same selector Helmet renders the meta tag UNDER in
 * the page head. We assert presence + content via the ``content``
 * attribute (Playwright's HTMLMetaElement API), not the inner
 * TEXT (meta tags don't have inner text).
 */
import { test, expect } from '@playwright/test';

test.describe('Spotlight deep-link (§11.2)', () => {
  test('cold-load: /sheet/spotlight/<id> renders meta + content', async ({ page, request }) => {
    // Anonymous cold-load via clearCookies + clearStorage +
    // reload. Same idiom as the catalog + spotlight-chip suites
    // so the project-wide contract stays consistent.
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

    // Probe the BE for an approved Spotlight id (the seed in
    // backend/management/commands/seed_e2e_data.py produces at
    // least one). Use request (axios-style) so this doesn't
    // depend on the FE auth flow at all — the public list is
    // anonymous-OK.
    const listResp = await request.get('http://127.0.0.1:8000/api/spotlight/');
    expect(listResp.status(), '/api/spotlight/ should be 200 anonymous').toBe(200);
    // The list is paginated ({count, next, previous, results}) —
    // unwrap the envelope before indexing the first row.
    const listData = await listResp.json();
    const approvedRow = (Array.isArray(listData) ? listData : (listData?.results || []))[0];
    if (!approvedRow?.id) {
      // No approved seed row — skip (better than failing the suite).
      test.skip();
      return;
    }
    const approvedId = approvedRow.id;
    // The canonical key is the title slug (migration 0102); the legacy
    // visit is still keyed by pk and the redirect carries the slug.
    const approvedSlug = approvedRow.slug || String(approvedId);

    // Deep-link visit with a hard reload so the URL is the
    // canonical entry shape (NOT a navigation from /sheet/explore).
    // The legacy /sheet/spotlight/<id> route auto-redirects (replace)
    // to the canonical /{slug}@{user}/spotlight shape once the payload
    // loads — wait for that redirect so the assertions below run on
    // the stable canonical URL (never racing the second mount).
    await page.goto(`http://127.0.0.1:3000/sheet/spotlight/${approvedId}`);
    // The legacy /sheet/spotlight/<pk> URL redirects (replace) to the
    // canonical /{slug}/by/{user}/spotlight shape (contentUrl.js).
    await page.waitForURL(/\/by\/[^/]+\/spotlight$/);
    expect(page.url(), 'canonical URL should carry the slug key').toContain(`/${approvedSlug}/by/`);
    await page.reload();

    // Page rendered.
    const sheet = page.locator('[data-testid="spotlight-detail-sheet"]');
    await expect(sheet, 'detail sheet should be in the DOM').toBeVisible();

    // Meta tag set is mounted (Helmet). Assert presence + content
    // — grok the meta[name=description] as the proxy for "meta
    // tags landed at all" since it's the cheapest readback.
    //
    // react-helmet-async marks every tag it manages with
    // ``data-rh="true"``. index.html ALSO ships static og:title /
    // twitter:card tags for pre-JS crawlers, so a bare
    // ``meta[property="og:title"]`` would match 2 elements. The
    // contract here is "the page's Helmet mounted a canonical meta
    // set", so we scope to the data-rh marker Helmet owns.
    const ogTitle = page.locator('head meta[property="og:title"][data-rh="true"]');
    await expect(ogTitle, 'og:title meta tag should be present (Helmet-managed)').toHaveCount(1);
    const ogTitleContent = await ogTitle.getAttribute('content');
    expect(ogTitleContent, 'og:title must be non-empty').toBeTruthy();
    expect(ogTitleContent?.length ?? 0, 'og:title must be > 0 chars').toBeGreaterThan(0);

    // Twitter Card set + canonical link.
    const twitterCard = page.locator('head meta[name="twitter:card"][data-rh="true"]');
    await expect(twitterCard, 'twitter:card meta tag should be present (Helmet-managed)').toHaveCount(1);
    const twitterCardValue = await twitterCard.getAttribute('content');
    expect(twitterCardValue).toBe('summary_large_image');
    const canonical = page.locator('head link[rel="canonical"]');
    await expect(canonical, 'canonical link should be present').toHaveCount(1);

    // Content renders (same data-testid we read in SpotlightDetail.jsx).
    const card = page.locator('[data-testid="spotlight-detail-invention-card"]');
    await expect(card, 'invention card should be rendered').toBeVisible();
  });

  test('in-app path: Explore card click navigates to detail', async ({ page, request }) => {
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

    // Switch to the Spotlight chip in Explore.
    await page.locator('button[role="tab"]', { hasText: 'Spotlight' }).click();
    // Wait for the Spotlight card list to land (the same selector
    // the spotlight-chip.spec.ts uses for root). The anonymous page
    // fires ~17 parallel catalog requests on first paint, so under
    // load the spotlight fetch can land ~5–8s in — a 5s default
    // timeout is too tight and flakes. Give it 15s.
    const firstCard = page.locator('[data-testid="spotlight-card"]').first();
    await expect(firstCard, 'first spotlight card should render').toBeVisible({ timeout: 15_000 });
    const spotlightId = await firstCard.getAttribute('data-spotlight-id');
    expect(spotlightId, 'data-spotlight-id must be numeric').toMatch(/^\d+$/);

    // Click and verify URL — the canonical content deep-link shape
    // is now /{slug}@{user}/spotlight (the SpotlightCard builds it
    // from the payload's slug + username via buildContentUrl).
    // Probe the list for the row's slug so the assertion pins the
    // exact canonical key (the payload is the same serializer). The
    // list is paginated ({count, next, previous, results}) — unwrap
    // the envelope the same way probeRow does in legacy-redirects.
    const listResp = await request.get('http://127.0.0.1:8000/api/spotlight/');
    const listData = await listResp.json();
    const rows = Array.isArray(listData) ? listData : (listData?.results || []);
    const row = rows.find((r) => String(r.id) === spotlightId) || rows[0];
    const spotlightSlug = row?.slug || spotlightId;
    await firstCard.click();
    await page.waitForURL(/\/by\/[^/]+\/spotlight$/);
    expect(page.url()).toContain(`/${spotlightSlug}/by/`);

    // Detail page rendered.
    const sheet = page.locator('[data-testid="spotlight-detail-sheet"]');
    await expect(sheet).toBeVisible();
    const card = page.locator('[data-testid="spotlight-detail-invention-card"]');
    await expect(card).toBeVisible();
  });

  test('share button copies the crawler-aware /og/ URL (and it resolves)', async ({ page, request }) => {
    // Stub the clipboard BEFORE any navigation so the share handler's
    // fallback path (no navigator.share in headless Chromium) writes
    // into a window-scoped capture we can assert on.
    await page.addInitScript(() => {
      window.__sharedUrl = null;
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text) => { window.__sharedUrl = text; },
        },
      });
    });
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

    // Probe the BE for an approved Spotlight id (same probe as the
    // cold-load test) — skip when no seed row exists.
    const listResp = await request.get('http://127.0.0.1:8000/api/spotlight/');
    expect(listResp.status(), '/api/spotlight/ should be 200 anonymous').toBe(200);
    const listData = await listResp.json();
    const approvedRow = (Array.isArray(listData) ? listData : (listData?.results || []))[0];
    if (!approvedRow?.id) {
      test.skip();
      return;
    }
    const approvedId = approvedRow.id;

    // Deep-link visit → canonical redirect → share.
    await page.goto(`http://127.0.0.1:3000/sheet/spotlight/${approvedId}`);
    await page.waitForURL(/\/by\/[^/]+\/spotlight$/);
    const sheet = page.locator('[data-testid="spotlight-detail-sheet"]');
    await expect(sheet, 'detail sheet should be in the DOM').toBeVisible();
    const shareBtn = page.locator('[data-testid="spotlight-detail-share-btn"]');
    await expect(shareBtn, 'the header share button must be present').toBeVisible();
    await shareBtn.click();

    // The copied URL must be the crawler-aware /og/ endpoint (NOT the
    // bare SPA URL) — that is what unfurls with real metadata.
    await expect
      .poll(
        () => page.evaluate(() => window.__sharedUrl),
        { timeout: 5_000 },
      )
      .toContain(`/sheet/spotlight/${approvedId}/og/`);

    // End-to-end contract: that copied URL must actually resolve to
    // prerendered OG HTML on the backend (mirrors the business OG e2e
    // test — a shared link is only useful if the endpoint serves it).
    const ogResp = await request.get(`http://127.0.0.1:8000/sheet/spotlight/${approvedId}/og/`);
    expect(ogResp.status(), 'the OG endpoint must serve 200 for an approved spotlight').toBe(200);
    const html = await ogResp.text();
    expect(html, 'the prerendered HTML must carry OG tags').toContain('og:title');
    // og:title must echo the invention title — read it from the DETAIL
    // payload (the same serializer the SPA renders, so the field name
    // is certain; the list serializer is only guaranteed id/slug).
    const detailResp = await request.get(`http://127.0.0.1:8000/api/spotlight/${approvedId}/`);
    expect(detailResp.status(), 'detail retrieve should be 200').toBe(200);
    const detail = await detailResp.json();
    const title = detail?.invention_title;
    expect(title, 'the approved spotlight must carry an invention_title').toBeTruthy();
    expect(html, 'og:title must echo the invention title').toContain(title);
    expect(html, 'the SPA deep-link must be the meta-refresh target')
      .toContain(`/sheet/spotlight/${approvedId}`);
    expect(
      ogResp.headers()['x-crawler-tag'],
      'the crawler-tag header must be present (log correlation)',
    ).toBeTruthy();
  });

  test('404 stubbed: error path renders, no silent crash', async ({ page }) => {
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

    // Intercept /api/spotlight/<pk>/ return 404 for the next
    // browse. Mirrors the catalog stubbed-error pattern.
    await page.route('**/api/spotlight/**', (route) => {
      const url = route.request().url();
      // Only stub the *retrieve-by-id* path (GET /api/spotlight/<num>/),
      // not the list endpoint (GET /api/spotlight/). The list is
      // needed by the Explore chip; only the detail fetch should
      // 404 in this test.
      if (/\/api\/spotlight\/\d+\/?$/.test(url)) {
        return route.fulfill({ status: 404, body: JSON.stringify({ detail: 'Not found.' }) });
      }
      return route.continue();
    });

    // Direct deep-link with a non-existent id. The numeric check
    // in SpotlightDetail.jsx accepts any positive integer; we use
    // a large number that's never minted.
    await page.goto('http://127.0.0.1:3000/sheet/spotlight/999999999');
    const errorBox = page.locator('[data-testid="spotlight-detail-sheet"] [role="alert"]');
    await expect(errorBox, 'error path should be visible, not a silent crash').toBeVisible({ timeout: 5_000 });
    // ...and the chrome stays mounted (the sheet IS the chrome for
    // this surface; we just check it isn't unmounted).
    await expect(page.locator('[data-testid="spotlight-detail-sheet"]')).toBeVisible();
  });
});
