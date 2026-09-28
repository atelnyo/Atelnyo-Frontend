/**
 * e2e/responsive-modals.spec.ts
 *
 * Responsive regression suite for the overlay surfaces at the mobile
 * breakpoints plus real handset widths (700 / 480 / 375 / 320px):
 *
 *   checkout-modal   — the unified payment modal (PayPal/Stripe), opened
 *                      by clicking the Buy CTA on a product detail page
 *   creator-apply    — full-screen "Become a Creator" sheet
 *                      (/sheet/creator-apply, easter-egg gated)
 *
 * What each test pins:
 *   1. the overlay actually opens/renders (the checkout modal only
 *      mounts after an authenticated click — so the suite seeds a
 *      session via localStorage + a /api/me/ stub);
 *   2. NO horizontal overflow — document.documentElement.scrollWidth
 *      must not exceed the viewport width (scrollable overlays on
 *      mobile are the failure mode this suite exists to catch);
 *   3. the modal/sheet box itself fits the viewport (never pokes past
 *      the right edge; the checkout sheet also respects max-height
 *      92vh);
 *   4. touch targets stay ≥ 40px (checkout close button, creator-apply
 *      back button — pinned by the audit that fixed them from 32/36px).
 *
 * Self-contained & deterministic: same stub-via-page.route strategy as
 * responsive-breakpoints.spec.ts — needs the Vite server (:3000) but
 * NOT the Daphne backend or seeded data. The checkout modal runs a
 * 0.22s scale-in animation (checkout-pop); tests wait ~400ms after the
 * modal appears so size measurements don't catch the mid-scale frame.
 */
import { test, expect } from '@playwright/test';

// ─── Seeded session + payloads ─────────────────────────────────────────
const USER = { id: 1, username: 'audit', email: 'audit@test.dev', is_creator: false, first_name: 'Audit', last_name: 'User' };
const LONG_URL = 'https://example.com/yon-chemin-sans-espaces-byen-long-pou-teste-overflow-wrap';
const PRODUCT = {
  id: 1, title: 'Pwodwi pou modals', description: `Yon deskripsyon pwodwi byen long pou tcheke modals la. ${LONG_URL}`,
  price: 100, currency: 'USD', image_url: '', seller_username: 'audit', kind: 'digital',
  category: 'tech', sales_count: 0, review_count: 0, avg_rating: null,
};

const VIEWPORTS = [
  { label: '700px breakpoint', width: 700, height: 800 },
  { label: '480px breakpoint', width: 480, height: 800 },
  { label: '375px phone', width: 375, height: 667 },
  { label: '320px small phone', width: 320, height: 568 },
];

/**
 * Seed a fake session (tokens + user blob + creator-apply easter egg).
 * ⚠ devrose_creator_apply_unlocked pins the 3-tap easter-egg gate that
 * guards /sheet/creator-apply (see App.jsx route comments + CreatorApply
 * LS_KEY). If that gate is ever removed/changed, update this seed — the
 * route would otherwise redirect to "/" and fail with a confusing
 * "pa rann" error.
 */
async function seedAuth(page) {
  await page.addInitScript((user) => {
    localStorage.setItem('access_token', 'audit.fake.token');
    localStorage.setItem('refresh_token', 'audit.fake.refresh');
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('devrose_creator_apply_unlocked', 'true');
  }, USER);
}

/** Stub /api/me/ + the product detail; everything else resolves to {}. */
async function stubApi(page) {
  await page.route(/\api\//, async (route) => {
    const url = decodeURIComponent(route.request().url());
    const method = route.request().method();
    if (method === 'GET' && url.endsWith('/api/me/')) return route.fulfill({ status: 200, json: USER });
    if (method === 'GET' && url.endsWith('/api/marketplace/products/1/')) return route.fulfill({ status: 200, json: PRODUCT });
    return route.fulfill({ status: 200, json: {} });
  });
}

/**
 * Collect: page-level overflow (with offender dump), the overlay box
 * geometry, and the touch-target button size. Mirrors the offender
 * heuristic in responsive-breakpoints.spec.ts (box poking past the
 * viewport, plus text overflowing its own visible-overflow box).
 */
async function auditOverlay(page, overlaySel, btnSel) {
  return page.evaluate(([overlaySel, btnSel]) => {
    const cw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
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
    const overlay = document.querySelector(overlaySel);
    const o = overlay?.getBoundingClientRect();
    const btn = document.querySelector(btnSel);
    const b = btn?.getBoundingClientRect();
    return {
      sw, cw, offenders: offenders.slice(0, 5),
      box: o ? { w: Math.round(o.width), right: Math.round(o.right), h: Math.round(o.height) } : null,
      btn: b ? { w: Math.round(b.width), h: Math.round(b.height) } : null,
      // scrollable content is expected for both overlays; just report it
      innerScrollable: overlay ? overlay.scrollHeight > overlay.clientHeight : false,
      maxHeightPct: o ? Math.round((o.height / vh) * 100) : null,
    };
  }, [overlaySel, btnSel]);
}

for (const vp of VIEWPORTS) {
  test(`checkout modal @ ${vp.width}px (${vp.label})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.setDefaultTimeout(30000);
    await seedAuth(page);
    await stubApi(page);

    // Open the modal the real way: product page → Buy CTA.
    await page.goto('/1@audit/product', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="product-detail-sheet"]').first()).toBeVisible({ timeout: 30000 });
    await page.click('.pd-cta-btn >> nth=0');
    await expect(page.locator('.checkout-modal')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(400); // let checkout-pop (0.22s scale-in) settle

    const m = await auditOverlay(page, '.checkout-modal', '.checkout-close');

    // 1. No horizontal overflow.
    expect(m.sw, `no horizontal overflow (scrollWidth ${m.sw} vs viewport ${m.cw}); offenders: ${JSON.stringify(m.offenders)}`)
      .toBeLessThanOrEqual(m.cw + 1);

    // 2. Modal box fits the viewport (right edge never past viewport).
    expect(m.box.right, 'modal right edge stays inside the viewport').toBeLessThanOrEqual(m.cw + 1);
    // 3. Modal respects the 92vh height cap (content scrolls inside).
    expect(m.maxHeightPct, 'modal height ≤ 92vh').toBeLessThanOrEqual(92);

    // 4. Close button keeps a ≥ 40px touch target.
    expect(m.btn.w, 'close button width ≥ 40px').toBeGreaterThanOrEqual(40);
    expect(m.btn.h, 'close button height ≥ 40px').toBeGreaterThanOrEqual(40);
  });

  test(`creator-apply sheet @ ${vp.width}px (${vp.label})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.setDefaultTimeout(30000);
    await seedAuth(page);
    await stubApi(page);

    await page.goto('/sheet/creator-apply', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="creator-apply-sheet"]').first()).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(600); // let the server-draft fetch settle

    const m = await auditOverlay(page, '.creator-apply-content', '.creator-apply-header .icon-btn');

    // 1. No horizontal overflow.
    expect(m.sw, `no horizontal overflow (scrollWidth ${m.sw} vs viewport ${m.cw}); offenders: ${JSON.stringify(m.offenders)}`)
      .toBeLessThanOrEqual(m.cw + 1);

    // 2. The sheet content column never pokes past the viewport.
    expect(m.box.right, 'content column stays inside the viewport').toBeLessThanOrEqual(m.cw + 1);

    // 3. Content is scrollable (long form is reachable on short screens).
    expect(m.innerScrollable, 'creator-apply content scrolls vertically').toBe(true);

    // 4. Back button keeps a ≥ 40px touch target.
    expect(m.btn.w, 'back button width ≥ 40px').toBeGreaterThanOrEqual(40);
    expect(m.btn.h, 'back button height ≥ 40px').toBeGreaterThanOrEqual(40);
  });
}
