/**
 * e2e/responsive-admin.spec.ts
 *
 * Responsive regression suite for the admin surfaces at the mobile
 * breakpoints plus real handset widths (700 / 480 / 375 / 320px):
 *
 *   admin dashboard  — /sheet/admin/dashboard  (.ad-dash-shell)
 *   admin users      — /sheet/admin/users      (.aum-shell)
 *   admin media      — /sheet/admin/media      (.amm-shell)
 *   CMS page         — /sheet/page/about      (.dynamic-page, public)
 *
 * What each test pins:
 *   1. the page renders (shell in the DOM + visible);
 *   2. NO horizontal overflow — document.documentElement.scrollWidth
 *      must not exceed the viewport width (with the usual offender
 *      dump for actionable failures);
 *   3. admin header back buttons keep ≥ 40px touch targets.
 *
 * ⚠ Admin routes are wrapped in AuthGate. On a COLD deep-link the gate
 * renders before the boot effect hydrates `user` from localStorage
 * (queueMicrotask + async /api/me/), so the very first commit sees
 * user=null and bounces to /sheet/auth — a cold-load race, not a
 * layout defect. Real staff reach these pages via SPA navigation from
 * the app chrome, so this suite mirrors that: it boots on the public
 * root, waits for the session to land, then SPA-navigates (history
 * pushState + popstate — what BrowserRouter listens to) to each admin
 * route. CMS is a public route and is loaded directly.
 *
 * Self-contained & deterministic: seeded staff session (localStorage
 * access_token + user blob with is_staff/is_superuser) + /api/me/ and
 * admin/cms payloads stubbed via page.route. Needs the Vite server
 * (:3000) but NOT the Daphne backend or seeded data.
 */
import { test, expect } from '@playwright/test';

// ─── Seeded session + payloads ─────────────────────────────────────────
const USER = { id: 1, username: 'admin', email: 'admin@test.dev', is_staff: true, is_superuser: true, first_name: 'Admin', last_name: 'User' };
const STATS = {
  total_users: 1250, online_users: 42, reports_pending: 3, banned_users: 7,
  voice_calls_today: 12, video_calls_today: 5, messages_today: 320,
  active_conversations: 88, groups_created: 24, storage_bytes: 1024 * 1024 * 512,
  server_health: { db: true, cache_layer: true },
};
const CMS_PAGE = {
  slug: 'about', template: 'basic', title: 'A Propos', lang: 'ht',
  sections: [
    { id: 's1', section_type: 'hero', order: 0, config_json: { title: 'Devrose', subtitle: 'Platfòm kreyatif la', background_image: '' } },
    { id: 's2', section_type: 'rich_text', order: 1, config_json: { content: 'Yon deskripsyon byen long sou Devrose pou tcheke layout la. '.repeat(6) } },
    { id: 's3', section_type: 'grid', order: 2, config_json: { columns: 3, items: [{ title: 'A' }, { title: 'B' }, { title: 'C' }, { title: 'D' }, { title: 'E' }] } },
    { id: 's4', section_type: 'faq', order: 3, config_json: { items: [{ q: 'Kijan sa mache?', a: 'Repons byen long. '.repeat(4) }] } },
  ],
};

const VIEWPORTS = [
  { label: '700px breakpoint', width: 700, height: 800 },
  { label: '480px breakpoint', width: 480, height: 800 },
  { label: '375px phone', width: 375, height: 667 },
  { label: '320px small phone', width: 320, height: 568 },
];

const ADMIN_PAGES = [
  { name: 'admin dashboard', url: '/sheet/admin/dashboard', anchor: '.ad-dash-shell', back: '.ad-dash-back', refresh: '.ad-dash-refresh' },
  { name: 'admin users', url: '/sheet/admin/users', anchor: '.aum-shell', back: '.aum-back', refresh: '.aum-refresh' },
  { name: 'admin media', url: '/sheet/admin/media', anchor: '.amm-shell', back: '.amm-back', refresh: '.amm-refresh' },
];

/** Seed a fake staff session before the app boots. */
async function seedAuth(page) {
  await page.addInitScript((user) => {
    localStorage.setItem('access_token', 'audit.fake.token');
    localStorage.setItem('refresh_token', 'audit.fake.refresh');
    localStorage.setItem('user', JSON.stringify(user));
  }, USER);
}

/** Stub /api/me/ + the admin/cms payloads; everything else resolves to {}. */
async function stubApi(page) {
  await page.route(/\api\//, async (route) => {
    const url = decodeURIComponent(route.request().url());
    const method = route.request().method();
    if (method === 'GET' && url.endsWith('/api/me/')) return route.fulfill({ status: 200, json: USER });
    if (method === 'GET' && url.endsWith('/api/admin/dashboard/')) return route.fulfill({ status: 200, json: STATS });
    if (method === 'GET' && url.includes('/api/admin/users/premium_stats/')) return route.fulfill({ status: 200, json: { premium_count: 15, revenue: 2500 } });
    if (method === 'GET' && url.includes('/api/admin/users/')) return route.fulfill({ status: 200, json: { results: [], count: 0 } });
    if (method === 'GET' && url.endsWith('/api/pages/about/render/')) return route.fulfill({ status: 200, json: CMS_PAGE });
    if (method === 'GET' && url.endsWith('/api/media/providers/')) return route.fulfill({ status: 200, json: [] });
    return route.fulfill({ status: 200, json: {} });
  });
}

/** Client-side navigation the way real users reach admin pages (post-boot). */
async function spaNavigate(page, url) {
  await page.evaluate((u) => {
    history.pushState({}, '', u);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, url);
}

/** Overflow + touch-target measurement (offender dump included).
 * btnSels: header buttons to measure (back + refresh) — all must be ≥ 40px. */
async function auditAdmin(page, btnSels) {
  return page.evaluate((btnSels) => {
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
    const btns = btnSels.map((sel) => {
      const b = document.querySelector(sel)?.getBoundingClientRect();
      return b ? { w: Math.round(b.width), h: Math.round(b.height) } : null;
    });
    return { sw, cw, offenders: offenders.slice(0, 5), btns };
  }, btnSels);
}

for (const pageCfg of ADMIN_PAGES) {
  for (const vp of VIEWPORTS) {
    test(`${pageCfg.name} @ ${vp.width}px (${vp.label})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.setDefaultTimeout(30000);
      await seedAuth(page);
      await stubApi(page);

      // Boot on the public root, let the session hydrate, then SPA-navigate.
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      await spaNavigate(page, pageCfg.url);
      // Hardening: if the session had not hydrated and AuthGate bounced us,
      // give it a beat and retry the SPA nav once.
      const bounced = await page.evaluate(() => location.pathname.startsWith('/sheet/auth'));
      if (bounced) {
        await page.waitForTimeout(600);
        await spaNavigate(page, pageCfg.url);
      }
      await expect(page.locator(pageCfg.anchor).first()).toBeVisible({ timeout: 30000 });
      await page.waitForTimeout(400);

      const m = await auditAdmin(page, [pageCfg.back, pageCfg.refresh]);

      // 1. No horizontal overflow.
      expect(m.sw, `no horizontal overflow (scrollWidth ${m.sw} vs viewport ${m.cw}); offenders: ${JSON.stringify(m.offenders)}`)
        .toBeLessThanOrEqual(m.cw + 1);

      // 2. Header buttons (back + refresh) keep ≥ 40px touch targets.
      for (const btn of m.btns) {
        expect(btn, 'header button present').not.toBeNull();
        expect(btn.w, 'header button width ≥ 40px').toBeGreaterThanOrEqual(40);
        expect(btn.h, 'header button height ≥ 40px').toBeGreaterThanOrEqual(40);
      }
    });
  }
}

for (const vp of VIEWPORTS) {
  test(`CMS page @ ${vp.width}px (${vp.label})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.setDefaultTimeout(30000);
    await stubApi(page);

    await page.goto('/sheet/page/about', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.dynamic-page').first()).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(400);

    const m = await auditAdmin(page, []);

    // CMS is a public page: no horizontal overflow is the only pin.
    expect(m.sw, `no horizontal overflow (scrollWidth ${m.sw} vs viewport ${m.cw}); offenders: ${JSON.stringify(m.offenders)}`)
      .toBeLessThanOrEqual(m.cw + 1);
  });
}
