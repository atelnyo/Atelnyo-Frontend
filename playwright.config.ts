/**
 * playwright.config.ts
 *
 * End-to-end test config for the Atelnyo Academy SPA. The test suite
 * (e2e/explore-talent-connect.spec.ts) drives the talent-Connect flow
 * from the Explore page through to a freshly-mounted Kot3Chat
 * conversation. It depends on the live Vite (:3000) + Daphne (:8000)
 * servers already being up — ``run_vite.sh`` + ``run_daphne.sh`` are
 * the standard local-dev entry points.
 *
 * Key choices:
 *   • ``baseURL: http://127.0.0.1:3000`` — Vite proxies /api and /ws
 *     to Daphne, so the test only needs to know about :3000.
 *   • ``fullyParallel: false`` + ``workers: 1`` — the suite shares
 *     DB state via the seed_e2e_data command; a parallel run
 *     would race the createThread call.
 *   • ``webServer: undefined`` — Vite is started by run_vite.sh
 *     outside of Playwright (saves ~10s on test startup).
 *   • ``actionTimeout: 10_000`` + ``navigationTimeout: 30_000`` —
 *     the lazy chunk fetch + slide transition is ~1.5s on a cold
 *     cache; 10s is a comfortable margin for a slow CI box.
 *   • ``reporter: process.env.CI ? 'dot' : 'list'`` — terse output
 *     in CI, full list locally.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? 'dot' : 'list',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    // English copy in selectors is more stable across dev machines
    // than the default Haitian Creole; the i18n toggles below force
    // en for the test run so ``page.getByRole('button', { name: /Message on Atelnyo/i })``
    // works regardless of localStorage.devrose_lang on the dev box.
    extraHTTPHeaders: {},
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
