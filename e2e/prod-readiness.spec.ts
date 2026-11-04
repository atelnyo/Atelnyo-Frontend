// @ts-check
/**
 * e2e/prod-readiness.spec.ts
 *
 * Read-only production readiness probe (Playwright + Chromium).
 * Hits the LIVE site with a handful of normal page loads — no login,
 * no purchases, no writes — and reports:
 *   • HTTP status + timings (domcontentloaded / full load)
 *   • failed API requests (status >= 400) and console errors
 *   • that key surfaces render instead of crashing
 *
 * Run: npx playwright test e2e/prod-readiness.spec.ts
 */
import { test, expect } from '@playwright/test';

const PROD = 'https://atelnyo.site';
const API = 'https://api.atelnyo.site';

test.describe('prod readiness (read-only)', () => {
  test('API healthz is ok', async ({ request }) => {
    const started = Date.now();
    const res = await request.get(`${API}/api/healthz/`);
    const ms = Date.now() - started;
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.components.db).toBe('ok');
    console.log(`[readiness] healthz ${ms}ms db=${body.components.db} tables=${body.components.schema_table_count}`);
  });

  const surfaces = [
    { path: '/', name: 'home' },
    { path: '/store', name: 'store' },
    { path: '/explore', name: 'explore' },
  ];

  for (const { path, name } of surfaces) {
    test(`${name} loads without crashing`, async ({ page }) => {
      const failed = [];
      const consoleErrors = [];
      page.on('response', (r) => {
        if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
      });
      page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 200)));

      const t0 = Date.now();
      const res = await page.goto(`${PROD}${path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      const domMs = Date.now() - t0;
      expect(res?.status()).toBeLessThan(400);

      // Let the SPA boot + fan-out finish (Explore fires ~15 requests).
      await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
      const totalMs = Date.now() - t0;

      const bodyText = (await page.textContent('body')) || '';
      expect(bodyText.trim().length).toBeGreaterThan(0);

      const apiFails = failed.filter((f) => f.includes('api.atelnyo.site'));
      console.log(
        `[readiness] ${name}: dom=${domMs}ms total=${totalMs}ms ` +
          `apiFails=${apiFails.length} allFails=${failed.length} jsErrors=${consoleErrors.length}`,
      );
      if (apiFails.length > 0) console.log(`[readiness] ${name} failed API:\n  - ${apiFails.slice(0, 10).join('\n  - ')}`);
      if (consoleErrors.length > 0) console.log(`[readiness] ${name} JS errors:\n  - ${consoleErrors.slice(0, 5).join('\n  - ')}`);

      // Soft signal, hard crash only: no 5xx from our API, page actually rendered.
      expect(apiFails.filter((f) => /^5\d\d/.test(f))).toEqual([]);
      expect(bodyText).not.toMatch(/application error|something went wrong/i);
    });
  }
});
