/**
 * e2e/admin-responsive-audit.spec.ts
 *
 * Full-panel responsive audit for EVERY admin route at phone viewports
 * (700 / 480 / 375 / 320px). Runs in the default `npx playwright test`
 * so CI pins the whole admin panel's responsiveness. Purpose: answer
 * "is the whole admin panel fully responsive?" with real measurements.
 *
 * For each admin route × viewport it records:
 *   - horizontal overflow (document scrollWidth vs clientWidth)
 *   - top offenders (right-clipped / text-overflowing elements)
 *   - whether the page actually rendered (not bounced to auth, not a
 *     blank fallback) via a count of interactive elements.
 *
 * Prereqs: Daphne :8000 (no Supabase auth env) + Vite :3000 with
 * VITE_API_BASE_URL=/api/, `seed_e2e_data` run (e2e_staff).
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';
const E2E_PASSWORD = 'E2ePass!2024';
const STAFF = { username: 'e2e_staff', email: 'e2e_staff@atelnyo.local' };

const VIEWPORTS = [
  { label: '700', width: 700, height: 800 },
  { label: '480', width: 480, height: 800 },
  { label: '375', width: 375, height: 667 },
  { label: '320', width: 320, height: 568 },
];

const ADMIN_ROUTES = [
  '/sheet/admin/dashboard',
  '/sheet/admin/creators',
  '/sheet/admin/media',
  '/sheet/admin/broken-media',
  '/sheet/admin/validation-queue',
  '/sheet/admin/moderation',
  '/sheet/admin/reports',
  '/sheet/admin/incidents',
  '/sheet/admin/security-center',
  '/sheet/admin/provider-health',
  '/sheet/admin/media-monitor',
  '/sheet/admin/security-monitor',
  '/sheet/admin/users',
  '/sheet/admin/spotlight',
  '/sheet/admin/companies',
  '/sheet/admin/rules',
];

test.describe('admin responsive audit (diagnostic)', () => {
  // Split-brain guard (same as company-admin-review.spec.ts): the
  // repo's .env points at the DEPLOYED API, so without
  // VITE_API_BASE_URL=/api/ the browser app would audit the wrong
  // backend. Fail fast instead of silently testing a foreign API.
  test.beforeAll(async ({ request }) => {
    const health = await request.get(`${BASE}/api/healthz/`).catch(() => null);
    expect(health?.status(), 'local backend must be reachable via the Vite proxy (run Vite with VITE_API_BASE_URL=/api/)').toBe(200);
  });

  test('audit all admin routes @ phone viewports', async ({ page }) => {
    test.setTimeout(300_000);
    // ── 1. Real staff login + seed the session ───────────────────
    const loginResp = await page.request.post(`${BASE}/api/login/`, {
      data: { email: STAFF.email, password: E2E_PASSWORD },
    });
    expect(loginResp.status(), 'staff login must succeed').toBe(200);
    const { access, refresh, user } = await loginResp.json();
    await page.addInitScript(
      ({ access, refresh, user }) => {
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
        localStorage.setItem('user', JSON.stringify(user || {}));
        localStorage.setItem('atelnyo_lang', 'en');
      },
      { access, refresh, user },
    );

    const report = [];
    for (const route of ADMIN_ROUTES) {
      // Boot fresh on the root (re-runs the init-script seed so the
      // session hydrates BEFORE the AuthGate sees the admin route),
      // then SPA-navigate — same pattern as the other specs.
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      await page.evaluate((u) => {
        history.pushState({}, '', u);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, route);
      // Hardening: if the session had not hydrated and AuthGate bounced
      // us, give it a beat and retry the SPA nav once.
      const bounced = await page.evaluate(() => location.pathname.startsWith('/sheet/auth'));
      if (bounced) {
        await page.waitForTimeout(600);
        await page.evaluate((u) => {
          history.pushState({}, '', u);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }, route);
      }
      // Let the lazy chunk load + render.
      await page.waitForTimeout(1600);
      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(250);

        const m = await page.evaluate(() => {
          const cw = document.documentElement.clientWidth;
          const sw = document.documentElement.scrollWidth;
          const offenders = [];
          if (sw > cw + 1) {
            document.querySelectorAll('body *').forEach((el) => {
              const r = el.getBoundingClientRect();
              if (r.width <= 0) return;
              if (r.right >= cw + 1) {
                let clipped = false;
                let p = el.parentElement;
                while (p) {
                  const ox = getComputedStyle(p).overflowX;
                  if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') { clipped = true; break; }
                  p = p.parentElement;
                }
                if (!clipped) offenders.push({ tag: el.tagName, cls: String(el.className || '').slice(0, 60), right: Math.round(r.right) });
              }
              if (el.scrollWidth > el.clientWidth + 1 && ['', 'visible'].includes(getComputedStyle(el).overflowX)) {
                offenders.push({ tag: el.tagName, cls: String(el.className || '').slice(0, 60), over: `${el.scrollWidth} > ${el.clientWidth}` });
              }
            });
          }
          return {
            cw,
            sw,
            overflow: sw > cw + 1,
            offenders: offenders.slice(0, 4),
            path: location.pathname,
            interactive: document.querySelectorAll('button, a, input, select, textarea').length,
            hasHeading: (document.querySelector('h1, h2')?.textContent || '').trim().slice(0, 60),
          };
        });

        report.push({ route, vp: vp.width, ...m });
      }
    }

    // ── 2. Print the full matrix ─────────────────────────────────
    console.log('\n===== ADMIN RESPONSIVE AUDIT MATRIX =====');
    for (const r of report) {
      const flag = r.overflow ? '❌ OVERFLOW' : '✅';
      console.log(
        `${flag} [${String(r.vp).padStart(3)}px] ${r.route.padEnd(30)} ` +
        `sw=${r.sw} cw=${r.cw} interactive=${r.interactive} ` +
        `h1="${r.hasHeading}"` +
        (r.offenders.length ? ` offenders=${JSON.stringify(r.offenders)}` : '') +
        (r.path.startsWith('/sheet/auth') ? ' [AUTH-BOUNCED]' : ''),
      );
    }
    console.log('=============================================');

    // ── 3. Hard assertions ──────────────────────────────────────
    for (const r of report) {
      expect(
        r.path.startsWith('/sheet/auth'),
        `${r.route} @ ${r.vp}px must not bounce to auth`,
      ).toBe(false);
      expect(r.interactive, `${r.route} @ ${r.vp}px must render interactive UI`).toBeGreaterThan(2);
      expect(
        r.overflow,
        `${r.route} @ ${r.vp}px: no horizontal overflow (sw=${r.sw} cw=${r.cw}) offenders=${JSON.stringify(r.offenders)}`,
      ).toBe(false);
    }
  });
});
