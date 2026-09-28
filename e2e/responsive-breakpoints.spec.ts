/**
 * e2e/responsive-breakpoints.spec.ts
 *
 * Responsive regression suite for the content detail pages at the two
 * mobile breakpoints the CSS ships (700px compact layout, 480px small
 * phone) plus 375px (real handset width):
 *
 *   music / talent / job / course  — cd-page shell (hero + body)
 *   portfolio / product            — pd-page shell (hero + body)
 *   spotlight                      — spotlight detail page
 *   event                          — sheet-page shell (no hero)
 *
 * What each test pins:
 *   1. the detail sheet renders (anchor in the DOM + visible);
 *   2. NO horizontal overflow — document.documentElement.scrollWidth
 *      must not exceed the viewport width (a scrollable page on mobile
 *      is the failure mode this suite exists to catch);
 *   3. the hero keeps at least its stage min-height per breakpoint
 *      (heroMin — heroes are content-adaptive and may grow beyond it)
 *      AND its first content section starts BELOW the fixed action
 *      bar at scroll 0 (the core layout contract: content is never
 *      hidden underneath Back/Like/Share);
 *   4. header share/back buttons keep ≥40px touch targets.
 *
 * Self-contained: the detail fetches are stubbed via page.route with
 * canned payloads, so the suite is deterministic and does NOT need the
 * Daphne backend or seeded data (deviates from the live-BE probing in
 * legacy-redirects.spec.ts on purpose — responsive regressions should
 * be caught regardless of DB state). It still needs the Vite server
 * (:3000) like every other spec. Long unbroken description tokens are
 * used deliberately to pin overflow-wrap behavior.
 */
import { test, expect } from '@playwright/test';

// ─── Payloads (minimal shapes the detail components render) ──────────
const LONG_URL = 'https://example.com/yon-chemin-sans-espaces-byen-long-pou-teste-overflow-wrap';
const PAYLOADS = {
  music: { id: 1, title: 'Tit Mizik Long', artist: 'Artis', duration: '3:42', cover_url: '', user_key: 'audit', description: `Yon deskripsyon mizik pou tcheke layout la. ${LONG_URL}` },
  talent: { id: 1, name: 'Talan Designe', role: 'Designer', avatar_url: '', user_key: 'audit', description: `Yon deskripsyon talan pou mobil. ${LONG_URL}` },
  job: { id: 1, title: 'Tit Travay', description: `Deskripsyon travay pou tcheke overflow. ${LONG_URL}`, budget_min: 100, budget_max: 500, currency: 'USD', user_key: 'audit', status: 'published', visibility: 'public' },
  portfolio: { id: 1, title: 'Pwojè', description: `Yon deskripsyon pwojè byen long. ${LONG_URL}`, cover_url: '', created_by_username: 'audit', category: 'tech', views: 5, project_url: 'https://example.com' },
  product: { id: 1, title: 'Pwodwi', description: `Yon deskripsyon pwodwi. ${LONG_URL}`, price: 100, currency: 'USD', image_url: '', seller_username: 'audit', kind: 'digital', category: 'tech', sales_count: 0, review_count: 0, avg_rating: null },
  course: { id: 1, title: 'Kou', description: `Yon deskripsyon kou. ${LONG_URL}`, image_url: '', price: 0, difficulty: 'easy', category: 'tech' },
  spotlight: { id: 1, invention_title: 'Envansyon', invention_description: `Yon deskripsyon envansyon. ${LONG_URL}`, username: 'audit', status: 'approved', link_url: '' },
  event: { id: 1, title: 'Tit Evènman', description: `Yon deskripsyon evènman. ${LONG_URL}`, start_time: '2026-08-08T10:00:00Z', end_time: '2026-08-08T12:00:00Z', location: 'Pòtoprens, Ayiti', user_key: 'audit', community_name: 'Kominote Mizik', cover_url: '' },
};

// ─── Per-page contract ────────────────────────────────────────────────
// heroMin: MINIMUM .cd-hero/.pd-hero stage height per viewport width
// (verified against the real CSS in a headless Chromium audit). The hero
// is content-adaptive (height: auto — it grows with its content, see the
// shared [data-detail-sheet] layout system), so it may legitimately
// render taller than the stage minimum; that's why this is a ≥ contract,
// not an exact pin. null = no hero.
//   ⚠ 700px sits exactly on the `max-width: 700px` media boundary and
//   480px on the `max-width: 480px` step. If the design intentionally
//   changes the breakpoints or stage heights, update the CSS AND this
//   table together — don't "fix" the test instead.
// share: does the header carry a share/back button (touch-target check)?
const PAGES = [
  { name: 'music',  url: '/1@audit/music',  anchor: '[data-music-sheet]',  api: '/api/explore/music/1/',  heroMin: { 700: 320, 480: 300, 375: 300 }, share: true },
  { name: 'talent', url: '/1@audit/talent', anchor: '[data-talent-sheet]', api: '/api/explore/talents/1/', heroMin: { 700: 340, 480: 300, 375: 300 }, share: true },
  { name: 'job',    url: '/1@audit/job',    anchor: '[data-job-sheet]',    api: '/api/jobs/1/',           heroMin: { 700: 260, 480: 240, 375: 240 }, share: true },
  { name: 'portfolio', url: '/1@audit/portfolio', anchor: '[data-testid="portfolio-detail-sheet"]', api: '/api/portfolio/projects/1/', heroMin: { 700: 320, 480: 320, 375: 320 }, share: true },
  { name: 'product', url: '/1@audit/product', anchor: '[data-testid="product-detail-sheet"]', api: '/api/marketplace/products/1/', heroMin: { 700: 320, 480: 320, 375: 320 }, share: false },
  { name: 'course', url: '/1@audit/course', anchor: '[data-testid="course-detail-sheet"]', api: '/api/courses/1/', heroMin: { 700: 320, 480: 300, 375: 300 }, share: true },
  { name: 'spotlight', url: '/1@audit/spotlight', anchor: '[data-testid="spotlight-detail-sheet"]', api: '/api/spotlight/1/', heroMin: { 700: 340, 480: 340, 375: 340 }, share: false },
  { name: 'event', url: '/1@audit/event', anchor: '.sheet-page', api: '/api/community-events/1/', heroMin: null, share: true },
];

const VIEWPORTS = [
  { label: '700px breakpoint', width: 700, height: 800 },
  { label: '480px breakpoint', width: 480, height: 800 },
  { label: '375px phone', width: 375, height: 667 },
];

/** Stub the detail fetch with its payload; everything else resolves to {}. */
async function stubApi(page, apiPath, payload) {
  await page.route(/\/api\//, async (route) => {
    const url = decodeURIComponent(route.request().url());
    const method = route.request().method();
    if (method === 'GET' && url.endsWith(apiPath)) {
      return route.fulfill({ status: 200, json: payload });
    }
    return route.fulfill({ status: 200, json: {} });
  });
}

for (const pageCfg of PAGES) {
  for (const vp of VIEWPORTS) {
    test(`${pageCfg.name} @ ${vp.width}px (${vp.label})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.setDefaultTimeout(30000);
      await stubApi(page, pageCfg.api, PAYLOADS[pageCfg.name]);

      await page.goto(pageCfg.url, { waitUntil: 'domcontentloaded' });
      await expect(page.locator(pageCfg.anchor).first(), 'detail sheet should render').toBeVisible({ timeout: 30000 });

      const m = await page.evaluate(() => {
        const sw = document.documentElement.scrollWidth;
        const cw = document.documentElement.clientWidth;
        // Offender dump for actionable failures. Two passes:
        // 1) elements whose box pokes past the viewport (skipping ones
        //    inside overflow-x containers);
        // 2) elements whose TEXT overflows its own box with visible
        //    overflow (e.g. a long unbroken token in a pre-wrap
        //    paragraph) — those inflate scrollWidth without any
        //    bounding-box culprit.
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
        const hero = document.querySelector('.cd-hero, .pd-hero');
        const share = document.querySelector('.cd-header-action-btn, .pd-header-actions button, .sheet-back-btn');
        const header = document.querySelector('.cd-sticky-header, .pd-sticky-header');
        const heroContent = document.querySelector('.cd-hero-content, .pd-hero-content');
        const hb = header?.getBoundingClientRect();
        const hc = heroContent?.getBoundingClientRect();
        const b = share?.getBoundingClientRect();
        return {
          sw, cw, offenders: offenders.slice(0, 5),
          heroH: hero ? Math.round(hero.getBoundingClientRect().height) : null,
          // Gap between the fixed action bar and the first hero content
          // section at scroll 0 — must be ≥ 0 (content never underneath
          // the bar, for every detail content type).
          heroGap: header && heroContent ? Math.round(hc.top - hb.bottom) : null,
          shareW: b ? Math.round(b.width) : 0, shareH: b ? Math.round(b.height) : 0,
        };
      });

      // 1. No horizontal overflow.
      expect(m.sw, `no horizontal overflow (scrollWidth ${m.sw} vs viewport ${m.cw}); offenders: ${JSON.stringify(m.offenders)}`)
        .toBeLessThanOrEqual(m.cw + 1);

      // 2. Hero keeps at least its stage min-height, and its first
      //    content section starts BELOW the fixed action bar (never
      //    hidden underneath it) — the core layout contract.
      if (pageCfg.heroMin) {
        expect(m.heroH, `hero height ≥ min stage at ${vp.width}px`).toBeGreaterThanOrEqual(pageCfg.heroMin[vp.width]);
        expect(m.heroGap, `first content section below the action bar at ${vp.width}px`).toBeGreaterThanOrEqual(0);
      }

      // 3. Header actions keep touch-friendly sizes.
      if (pageCfg.share) {
        expect(m.shareW, 'share/back button width ≥ 40px').toBeGreaterThanOrEqual(40);
        expect(m.shareH, 'share/back button height ≥ 40px').toBeGreaterThanOrEqual(40);
      }
    });
  }
}
