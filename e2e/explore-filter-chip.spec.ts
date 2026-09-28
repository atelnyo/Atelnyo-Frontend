/**
 * e2e/explore-filter-chip.spec.ts
 *
 * Regression suite for the "Rekòmande pou ou" (Recommended for You)
 * rail scoping fix on the Explore page (commit 9e25226):
 *
 *   PROBLEM: clicking ANY filter chip (e.g. Evènman) showed the mixed
 *   recommended rail with EVERY content type at the top — "se lòt yo
 *   bay olye de li" (it shows others instead of it).
 *   FIX: the rail is scoped to the active chip — a type-specific
 *   filter (courses, music, talents, events, communities, jobs,
 *   marketplace) only shows recommended items of that type;
 *   featured/new keep the mixed rail; portfolio/spotlight have none.
 *
 * What each test pins:
 *   1. Clicking a type-specific chip renders ONLY that type's
 *      recommended cards inside the "Rekòmande pou ou" section.
 *   2. The matching section (e.g. events list for the Evènman chip)
 *      still renders its own cards below the rail.
 *
 * Self-contained: every /api/ endpoint is stubbed via page.route so
 * the test needs the Vite server (:3000) only — no Daphne backend.
 * The recommended rail payload deliberately contains ALL seven types
 * so a scoping regression would render foreign cards and fail.
 */
import { test, expect } from '@playwright/test';

// Recommended rail payloads — one item per content type so a scoping
// regression is immediately visible as a foreign card in the rail.
const RECOMMENDED = {
  results: [
    { item_type: 'course', id: 101, title: 'Kou Rekòmande', _score: 1 },
    { item_type: 'music', id: 102, title: 'Mizik Rekòmande', artist: 'Atis', _score: 1 },
    { item_type: 'talent', id: 103, name: 'Talan Rekòmande', role: 'Mizisyen', _score: 1 },
    { item_type: 'event', id: 104, title: 'Evènman Rekòmande', start_time: '2026-12-01T18:00:00Z', community_name: 'Kominote', _score: 1 },
    { item_type: 'community', id: 105, name: 'Kominote Rekòmande', _score: 1 },
    { item_type: 'job', id: 106, title: 'Travay Rekòmande', _score: 1 },
    { item_type: 'product', id: 107, title: 'Pwodwi Rekòmande', price: 10, _score: 1 },
  ],
};

// Per-section catalog payloads (so the matching section under the rail
// has something to render and we can distinguish rail vs section).
const CATALOG = {
  courses: [{ id: 201, title: 'Kou Katalog', price: 0 }],
  music: [{ id: 202, title: 'Mizik Katalog', artist: 'Atis' }],
  talents: [{ id: 203, name: 'Talan Katalog', role: 'Mizisyen' }],
  communities: [{ id: 204, name: 'Kominote Katalog' }],
  jobs: [{ id: 205, title: 'Travay Katalog' }],
  portfolio: [{ id: 206, title: 'Pòtfolyo Katalog' }],
  products: [{ id: 207, title: 'Pwodwi Katalog', price: 5 }],
  events: [{ id: 208, title: 'Evènman Katalog', start_time: '2026-12-01T18:00:00Z', community_name: 'Kominote', is_free: true }],
  spotlight: [{ id: 209, invention_title: 'Envansyon Spotlight', username: 'kreatè' }],
};

/** Stub every /api/ call: recommended rail + per-section catalogs. */
async function stubApi(page) {
  await page.route(/\api\//, async (route) => {
    const url = decodeURIComponent(route.request().url());
    const method = route.request().method();

    if (method === 'GET' && url.includes('/api/explore/recommended/all/')) {
      return route.fulfill({ status: 200, json: RECOMMENDED });
    }
    if (method === 'GET' && url.includes('/api/courses/')) {
      return route.fulfill({ status: 200, json: CATALOG.courses });
    }
    if (method === 'GET' && url.includes('/api/explore/music/')) {
      return route.fulfill({ status: 200, json: CATALOG.music });
    }
    if (method === 'GET' && url.includes('/api/explore/talents/')) {
      return route.fulfill({ status: 200, json: CATALOG.talents });
    }
    if (method === 'GET' && url.includes('/api/communities/')) {
      return route.fulfill({ status: 200, json: CATALOG.communities });
    }
    if (method === 'GET' && url.includes('/api/jobs/')) {
      return route.fulfill({ status: 200, json: { results: CATALOG.jobs } });
    }
    if (method === 'GET' && url.includes('/api/portfolio/')) {
      return route.fulfill({ status: 200, json: CATALOG.portfolio });
    }
    if (method === 'GET' && url.includes('/api/marketplace/')) {
      return route.fulfill({ status: 200, json: CATALOG.products });
    }
    if (method === 'GET' && url.includes('/api/community-events/upcoming/')) {
      return route.fulfill({ status: 200, json: CATALOG.events });
    }
    if (method === 'GET' && url.includes('/api/spotlight/')) {
      return route.fulfill({ status: 200, json: CATALOG.spotlight });
    }
    if (method === 'GET' && url.includes('/api/categories/')) {
      return route.fulfill({ status: 200, json: [] });
    }
    if (method === 'GET' && url.includes('/api/explore/saved/')) {
      return route.fulfill({ status: 200, json: [] });
    }
    // saved-items counts batch endpoint — non-critical, resolve empty.
    if (method === 'GET' && url.includes('/counts/')) {
      return route.fulfill({ status: 200, json: {} });
    }
    return route.fulfill({ status: 200, json: {} });
  });
}

/** Cards rendered inside the "Rekòmande pou ou" section. */
function recommendedCards(page) {
  return page
    .locator('.explore-section, .explore-page')
    .locator('text=Rekòmande pou ou')
    .locator('..')
    .locator('.explore-hscroll, .explore-talent-list, .explore-event-list')
    .locator('.explore-card');
}

test('Evènman chip: recommended rail shows ONLY events', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.setDefaultTimeout(30000);
  await stubApi(page);
  await page.goto('/?filter=events', { waitUntil: 'domcontentloaded' });

  // Chip is active + recommended rail renders.
  const chip = page.locator('.explore-chip[role="tab"]', { hasText: /Evènman|Events/ });
  await expect(chip.first()).toHaveClass(/active/, { timeout: 30000 });

  const rail = page.locator('text=Rekòmande pou ou');
  await expect(rail.first(), 'recommended rail should render').toBeVisible({ timeout: 30000 });

  // Only the recommended EVENT card is in the rail.
  await expect(page.getByText('Evènman Rekòmande').first(), 'recommended event card visible').toBeVisible();
  await expect(page.getByText('Kou Rekòmande'), 'foreign course card must NOT appear in the rail').toHaveCount(0);
  await expect(page.getByText('Mizik Rekòmande'), 'foreign music card must NOT appear in the rail').toHaveCount(0);
  await expect(page.getByText('Talan Rekòmande'), 'foreign talent card must NOT appear in the rail').toHaveCount(0);
  await expect(page.getByText('Kominote Rekòmande'), 'foreign community card must NOT appear in the rail').toHaveCount(0);
  await expect(page.getByText('Travay Rekòmande'), 'foreign job card must NOT appear in the rail').toHaveCount(0);
  await expect(page.getByText('Pwodwi Rekòmande'), 'foreign product card must NOT appear in the rail').toHaveCount(0);

  // The events SECTION below the rail still renders its own catalog.
  await expect(page.getByText('Evènman Katalog').first(), 'events section catalog visible').toBeVisible();
});

test('Kou chip: recommended rail shows ONLY courses', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.setDefaultTimeout(30000);
  await stubApi(page);
  await page.goto('/?filter=courses', { waitUntil: 'domcontentloaded' });

  const rail = page.locator('text=Rekòmande pou ou');
  await expect(rail.first(), 'recommended rail should render').toBeVisible({ timeout: 30000 });

  await expect(page.getByText('Kou Rekòmande').first(), 'recommended course card visible').toBeVisible();
  await expect(page.getByText('Mizik Rekòmande'), 'foreign music card must NOT appear').toHaveCount(0);
  await expect(page.getByText('Evènman Rekòmande'), 'foreign event card must NOT appear').toHaveCount(0);
  await expect(page.getByText('Talan Rekòmande'), 'foreign talent card must NOT appear').toHaveCount(0);
  await expect(page.getByText('Pwodwi Rekòmande'), 'foreign product card must NOT appear').toHaveCount(0);

  await expect(page.getByText('Kou Katalog').first(), 'courses section catalog visible').toBeVisible();
});

test('Mizik chip: recommended rail shows ONLY music', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.setDefaultTimeout(30000);
  await stubApi(page);
  await page.goto('/?filter=music', { waitUntil: 'domcontentloaded' });

  const rail = page.locator('text=Rekòmande pou ou');
  await expect(rail.first(), 'recommended rail should render').toBeVisible({ timeout: 30000 });

  await expect(page.getByText('Mizik Rekòmande').first(), 'recommended music card visible').toBeVisible();
  await expect(page.getByText('Kou Rekòmande'), 'foreign course card must NOT appear').toHaveCount(0);
  await expect(page.getByText('Evènman Rekòmande'), 'foreign event card must NOT appear').toHaveCount(0);
  await expect(page.getByText('Talan Rekòmande'), 'foreign talent card must NOT appear').toHaveCount(0);

  await expect(page.getByText('Mizik Katalog').first(), 'music section catalog visible').toBeVisible();
});

test('Talan chip: recommended rail shows ONLY talents', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.setDefaultTimeout(30000);
  await stubApi(page);
  await page.goto('/?filter=talents', { waitUntil: 'domcontentloaded' });

  const rail = page.locator('text=Rekòmande pou ou');
  await expect(rail.first(), 'recommended rail should render').toBeVisible({ timeout: 30000 });

  await expect(page.getByText('Talan Rekòmande').first(), 'recommended talent card visible').toBeVisible();
  await expect(page.getByText('Kou Rekòmande'), 'foreign course card must NOT appear').toHaveCount(0);
  await expect(page.getByText('Mizik Rekòmande'), 'foreign music card must NOT appear').toHaveCount(0);
  await expect(page.getByText('Evènman Rekòmande'), 'foreign event card must NOT appear').toHaveCount(0);

  await expect(page.getByText('Talan Katalog').first(), 'talents section catalog visible').toBeVisible();
});

test('Spotlight chip: NO recommended rail at all', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.setDefaultTimeout(30000);
  await stubApi(page);
  await page.goto('/?filter=spotlight', { waitUntil: 'domcontentloaded' });

  // Spotlight has no recommended rail — the label must never render.
  await expect(page.locator('text=Rekòmande pou ou'), 'no recommended rail on spotlight chip').toHaveCount(0, { timeout: 30000 });

  // The spotlight section still renders its own catalog.
  await expect(page.getByText('Envansyon Spotlight').first(), 'spotlight section catalog visible').toBeVisible();
});
