/**
 * e2e/legacy-redirects.spec.ts
 *
 * Phase 49 — Playwright coverage for the legacy → canonical URL upgrade
 * across every Explore content category. The canonical shareable shape
 * is ``/{slug}@{user}/{type}`` (slug-first since migrations 0095/0102
 * gave every content model a unique title slug; the backend resolves
 * the slug or the numeric pk alike); each detail component
 * auto-redirects (replace) from its legacy deep-link once the payload
 * loads:
 *
 *   music      /sheet/explore/music?id=<id>   → /<slug>@<user>/music
 *   talent     /sheet/explore/talent?id=<id>  → /<slug>@<user>/talent
 *   job        /sheet/explore/job?id=<id>     → /<slug>@<user>/job
 *   portfolio  /portfolio/<id>                → /<slug>@<user>/portfolio
 *   product    /marketplace/<id>              → /<slug>@<user>/product
 *   course     /sheet/course/<id>             → /<slug>@<user>/course
 *
 * One test per category, all following the spotlight-detail.spec.ts
 * contract: anonymous cold-load (no JWT), a backend probe for a real
 * row (test.skip() when the dev DB has no seed row for that category —
 * the seed command only guarantees ExploreTalent), and a
 * ``waitForURL`` on the canonical shape so assertions never race the
 * second mount. Detail-page anchors:
 *
 *   * ``data-music-sheet`` / ``data-talent-sheet`` / ``data-job-sheet``
 *     (stable data attributes on the sheets' root divs)
 *   * ``data-testid="portfolio-detail-sheet"`` /
 *     ``data-testid="product-detail-sheet"`` /
 *     ``data-testid="course-detail-sheet"`` (added for this suite)
 *
 * Depends on the live Vite (:3000) + Daphne (:8000) servers, same as
 * every other spec in e2e/.
 */
import { test, expect } from '@playwright/test';

/**
 * Probe a catalog list endpoint for the first public row. Returns
 * ``{ id, user_key }`` or null — a non-200 (auth-gated endpoint) or an
 * empty catalog (no seed row) means the test should skip.
 */
async function probeRow(request, url) {
  const resp = await request.get(url, { params: { page_size: 1 } });
  if (resp.status() !== 200) return null;
  const data = await resp.json();
  // Lists are paginated ({count, next, previous, results}) on the
  // catalog viewsets; a bare array is the fallback for any endpoint
  // that isn't.
  const rows = Array.isArray(data) ? data : (data?.results || []);
  const row = rows[0];
  if (!row || row.id == null) return null;
  // ``slug`` is the canonical URL key (migrations 0095/0102); the
  // numeric id is kept as a fallback for stale rows that predate it.
  return {
    id: String(row.id),
    slug: row.slug || String(row.id),
    user_key: row.user_key || null,
  };
}

const LEGACY_SPECS = [
  {
    name: 'music',
    legacy: (id) => `/sheet/explore/music?id=${id}`,
    api: 'http://127.0.0.1:8000/api/explore/music/',
    canonical: /\/[^/]+@[^/]+\/music$/,
    anchor: '[data-music-sheet]',
  },
  {
    name: 'talent',
    legacy: (id) => `/sheet/explore/talent?id=${id}`,
    api: 'http://127.0.0.1:8000/api/explore/talents/',
    canonical: /\/[^/]+@[^/]+\/talent$/,
    anchor: '[data-talent-sheet]',
  },
  {
    name: 'job',
    legacy: (id) => `/sheet/explore/job?id=${id}`,
    api: 'http://127.0.0.1:8000/api/jobs/',
    canonical: /\/[^/]+@[^/]+\/job$/,
    anchor: '[data-job-sheet]',
  },
  {
    name: 'portfolio',
    legacy: (id) => `/portfolio/${id}`,
    api: 'http://127.0.0.1:8000/api/portfolio/projects/',
    canonical: /\/[^/]+@[^/]+\/portfolio$/,
    anchor: '[data-testid="portfolio-detail-sheet"]',
  },
  {
    // Products resolve by slug or pk alike (SlugOrPkLookupMixin); the
    // canonical key is the title slug, so the URL-match is loose (any
    // key) here.
    name: 'product',
    legacy: (id) => `/marketplace/${id}`,
    api: 'http://127.0.0.1:8000/api/marketplace/products/',
    canonical: /\/[^/]+@[^/]+\/product$/,
    anchor: '[data-testid="product-detail-sheet"]',
  },
  {
    name: 'course',
    legacy: (id) => `/sheet/course/${id}`,
    api: 'http://127.0.0.1:8000/api/courses/',
    canonical: /\/[^/]+@[^/]+\/course$/,
    anchor: '[data-testid="course-detail-sheet"]',
  },
];

for (const spec of LEGACY_SPECS) {
  test(`legacy ${spec.name} deep-link auto-upgrades to /{id}@{user}/${spec.name}`, async ({ page, request }) => {
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

    const row = await probeRow(request, spec.api);
    if (!row) {
      // No seed row (or an auth-gated catalog) — skip rather than fail.
      test.skip();
      return;
    }

    // Visit the legacy URL as a hard load (the pasted-link shape), then
    // wait for the one-shot replace-redirect to the canonical
    // /{slug}@{user}/{type} deep-link. The key is the title slug
    // (falls back to the numeric id for stale rows).
    await page.goto(`http://127.0.0.1:3000${spec.legacy(row.id)}`);
    await page.waitForURL(spec.canonical, { timeout: 15_000 });
    expect(page.url(), 'canonical URL should carry the resolved key')
      .toContain(`/${row.slug}@`);
    // Pin the ``@user`` half too — the redirect payload carries the same
    // owner username as the list row (same serializer). Only when the
    // row exposes one: a null user_key falls back client-side, so the
    // assertion would be wrong. Usernames may contain accents, which
    // buildContentUrl percent-encodes — match the encoded form.
    if (row.user_key) {
      expect(page.url(), 'canonical URL should carry the owner username')
        .toContain(`@${encodeURIComponent(row.user_key)}/`);
    }

    // The detail page rendered — the anchor lives on the root of each
    // detail component (present through the loading skeleton).
    const sheet = page.locator(spec.anchor).first();
    await expect(sheet, `${spec.name} detail sheet should render after the redirect`).toBeVisible();
  });
}
