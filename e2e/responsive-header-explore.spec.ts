/**
 * e2e/responsive-header-explore.spec.ts
 *
 * Overflow regression suite for the app chrome + Explore home feed at
 * the widths where phones and tablets differ most (320px small phone,
 * 375px standard phone, 768px tablet):
 *
 *   Header   — global app chrome (.app-header), rendered on non-sheet
 *              routes; media-query breakpoints at 500px/400px
 *   Explore  — the home feed surface (.explore-page → .feed-container),
 *              whose catalog rails (.explore-hscroll) scroll horizontally
 *              ON PURPOSE — so the pin is page-level: rails must scroll
 *              INSIDE their container without inflating the document
 *              width (document.documentElement.scrollWidth ≤ viewport).
 *
 * What each test pins:
 *   1. Header + Explore render (anchors visible);
 *   2. NO horizontal overflow — scrollWidth ≤ viewport, with the usual
 *      offender dump for actionable failures;
 *   3. the Header and feed boxes fit inside the viewport (right edge
 *      never pokes past clientWidth).
 *
 * Self-contained: the home feed is stubbed via page.route with two real
 * sections (courses + music cards, deliberately long unbroken titles)
 * so actual card rails render — an empty feed would hide the layout
 * this suite exists to protect. Everything else resolves to {}. The
 * root route is public, so no auth seeding is needed. Needs the Vite
 * server (:3000), not the Daphne backend.
 */
import { test, expect } from '@playwright/test';

const LONG_TITLE = 'Yon tit kou byen long pou tcheke overflow sou ekran piti menm si li dire plis ke 40 karaktè.';

const FEED = {
  sections: [
    {
      type: 'trending_course', title: 'Kou Popilè', count: 3,
      items: [
        { id: 1, title: LONG_TITLE, image_url: '', price: 0, difficulty: 'easy', category: 'tech' },
        { id: 2, title: 'Dezyèm kou', image_url: '', price: 10, currency: 'USD', difficulty: 'medium', category: 'design' },
        { id: 3, title: 'Twazyèm kou', image_url: '', price: 0, difficulty: 'hard', category: 'music' },
      ],
    },
    {
      type: 'trending_music', title: 'Mizik Popilè', count: 2,
      items: [
        { id: 1, title: LONG_TITLE, artist: 'Artis byen long tou pou tcheke ellipsis la', duration: '3:42', cover_url: '' },
        { id: 2, title: 'Chante 2', artist: 'Artis 2', duration: '2:10', cover_url: '' },
      ],
    },
  ],
};

const VIEWPORTS = [
  { label: '320px small phone', width: 320, height: 568 },
  { label: '375px phone', width: 375, height: 667 },
  { label: '768px tablet', width: 768, height: 1024 },
];

/** Stub the home feed with real sections; everything else resolves to {}. */
async function stubApi(page) {
  await page.route(/\api\//, async (route) => {
    const url = decodeURIComponent(route.request().url());
    // feedService.home(6, ...) sends query params (?limit=6&engine=home),
    // so match on includes(), not endsWith().
    if (route.request().method() === 'GET' && url.includes('/api/feed/home/')) {
      return route.fulfill({ status: 200, json: FEED });
    }
    return route.fulfill({ status: 200, json: {} });
  });
}

/** Page-level overflow + box geometry (offender dump included). */
async function auditRoot(page) {
  return page.evaluate(() => {
    const cw = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    const offenders = [];
    if (sw > cw + 1) {
      document.querySelectorAll('body *').forEach((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (r.width <= 0) return;
        let clipped = false;
        if (r.right >= cw + 1) {
          let p = el.parentElement;
          while (p) {
            const ox = getComputedStyle(p).overflowX;
            if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') { clipped = true; break; }
            p = p.parentElement;
          }
          if (!clipped) offenders.push({ tag: el.tagName, cls: String(el.className || '').slice(0, 60), right: Math.round(r.right) });
        }
        if (el.scrollWidth > el.clientWidth + 1 && (cs.overflowX === 'visible' || cs.overflowX === '')) {
          offenders.push({ tag: el.tagName, cls: String(el.className || '').slice(0, 60), textOverflow: `${el.scrollWidth} > ${el.clientWidth}` });
        }
      });
    }
    const box = (sel) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r ? { w: Math.round(r.width), right: Math.round(r.right) } : null;
    };
    return { sw, cw, offenders: offenders.slice(0, 5), header: box('.app-header'), explore: box('.explore-page'), feed: box('.feed-container') };
  });
}

for (const vp of VIEWPORTS) {
  test(`Header + Explore @ ${vp.width}px (${vp.label})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.setDefaultTimeout(30000);
    await stubApi(page);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.app-header').first(), 'header should render').toBeVisible({ timeout: 30000 });
    await expect(page.locator('.feed-container').first(), 'explore feed should render').toBeVisible({ timeout: 30000 });
    // Pin the LOADED state: feed sections with real cards (not skeleton/empty).
    await expect(page.locator('.feed-section').first(), 'feed sections should render').toBeVisible({ timeout: 30000 });

    const m = await auditRoot(page);

    // 1. No horizontal overflow — catalog rails must scroll INSIDE
    //    their .explore-hscroll containers, never widen the document.
    expect(m.sw, `no horizontal overflow (scrollWidth ${m.sw} vs viewport ${m.cw}); offenders: ${JSON.stringify(m.offenders)}`)
      .toBeLessThanOrEqual(m.cw + 1);

    // 2. Header box fits the viewport.
    expect(m.header, 'header present').not.toBeNull();
    expect(m.header.right, 'header right edge stays inside the viewport').toBeLessThanOrEqual(m.cw + 1);

    // 3. Explore surface + feed container fit the viewport.
    expect(m.explore, 'explore surface present').not.toBeNull();
    expect(m.explore.right, 'explore right edge stays inside the viewport').toBeLessThanOrEqual(m.cw + 1);
    expect(m.feed, 'feed container present').not.toBeNull();
    expect(m.feed.right, 'feed container right edge stays inside the viewport').toBeLessThanOrEqual(m.cw + 1);
  });
}
