/**
 * e2e/geo-hint.spec.ts
 *
 * Phase 46 — verifies the IP-based country → language auto-suggestion
 * flow end-to-end:
 *
 *   1. The /api/geo/hint/ endpoint responds with the documented
 *      JSON shape on an anonymous request (AllowAny + no auth).
 *   2. The FE auto-applies the suggested lang on first mount when
 *      localStorage is empty.
 *   3. A returning visitor with a stored devrose_lang never hits
 *      the geo endpoint (server hint is NOT consulted on override).
 *
 * The test is intentionally language-stable — selectors target
 * CSS classes + data-testids, NOT translated strings, so the run
 * is independent of the platform's current locale (ht is the
 * default for an in-process test, but the assertions work for
 * any 4-lang variant).
 *
 * The endpoint is also stub-able via page.route() so the test
 * can exercise both the "no hint" and the "do apply a different
 * lang" paths without needing a real MaxMind DB on the box.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS_DIR = 'test-results/geo-hint';

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
});

test.describe('[Geo] Country-based language auto-apply', () => {
  test('endpoint returns the documented JSON shape (anon, no JWT)', async ({ request }) => {
    // Direct API call (no browser) — the same curl probe the
    // user might run from their dev box. We don't assert on a
    // specific country (the CI box could be anywhere), only on
    // the SHAPE — the field names + types are the contract.
    const res = await request.get('http://127.0.0.1:8000/api/geo/hint/');
    expect(res.status()).toBe(200);
    const body = await res.json();
    // ``country`` may be null (no MaxMind DB on CI, private IP,
    // etc.) — that's the documented "no signal" path.
    expect(body).toHaveProperty('country');
    expect(body).toHaveProperty('suggested_lang');
    expect(body).toHaveProperty('is_default');
    // ``suggested_lang`` is ALWAYS one of the 4 supported codes;
    // the server-side SUPPORTED_LANGS guard would prevent any
    // other value from leaking, but we re-assert here to lock
    // the contract.
    expect(['ht', 'en', 'es', 'fr']).toContain(body.suggested_lang);
    // ``is_default`` is true iff ``country`` is null. The FE
    // uses this to suppress the "we set your language" toast
    // for the no-signal path (see App.jsx → useEffect geo hint).
    if (body.country === null) {
      expect(body.is_default).toBe(true);
    } else {
      expect(typeof body.country).toBe('string');
      expect(body.country.length).toBe(2); // ISO-3166 alpha-2
      expect(body.is_default).toBe(false);
    }
  });

  test('first-visit (no localStorage) auto-applies a stubbed hint lang', async ({ page }) => {
    // Stub the geo endpoint to a known lang ('en') so the test is
    // deterministic regardless of the CI box's geolocation.
    // The page must apply 'en' and write it to localStorage on
    // mount (the FE doesn't show a toast when is_default=true,
    // so the test is silent on the toast path).
    await page.context().clearCookies();
    await page.route('**/api/geo/hint/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          country: 'US',
          suggested_lang: 'en',
          is_default: false,
        }),
      }),
    );

    await page.goto('http://127.0.0.1:3000/');
    await page.evaluate(() => {
      try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}
    });
    await page.reload();
    // The FE fires the geo fetch AFTER first paint and applies
    // the lang asynchronously. Wait for the localStorage write
    // that proves the hint was consumed — that's the success
    // signal, more reliable than trying to wait for a UI text
    // change (which depends on the 'en' translation strings
    // being correct on every locale).
    await expect.poll(
      async () => page.evaluate(() => localStorage.getItem('atelnyo_lang')),
      { timeout: 10_000 },
    ).toBe('en');
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '01-first-visit-applies-en.png'),
      fullPage: true,
    });
  });

  test('returning visitor (with devrose_lang) does NOT consult the geo endpoint', async ({ page }) => {
    // Pin a devrose_lang in localStorage BEFORE the page mounts,
    // then watch the network — no /api/geo/hint/ request should
    // ever fire. This is the override contract: a user who has
    // explicitly chosen a lang is NEVER silently switched to
    // their geo-derived one on a future visit.
    let geoCallCount = 0;
    await page.context().clearCookies();
    await page.route('**/api/geo/hint/**', (route) => {
      geoCallCount += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          country: 'FR',
          suggested_lang: 'fr',
          is_default: false,
        }),
      });
    });

    // Stash the override BEFORE the page mounts. The Vite app
    // reads devrose_lang in main.jsx on its first import, so
    // the stubbed hint must arrive AFTER the React state has
    // already been seeded from localStorage.
    await page.addInitScript(() => {
      try { localStorage.setItem('atelnyo_lang', 'ht'); } catch (_) {}
    });
    await page.goto('http://127.0.0.1:3000/');
    // Wait for the page to mount and run the geo-hint useEffect.
    // The useEffect short-circuits when devrose_lang is set, so
    // the route handler should NEVER fire.
    await expect(page.locator('.explore-page')).toBeVisible({ timeout: 15_000 });
    // Give the useEffect a moment to run (it should no-op).
    await page.waitForTimeout(1000);
    expect(geoCallCount, 'override path must not consult /api/geo/hint/').toBe(0);
    // Confirm the override is still 'ht' (the stubbed 'fr' must
    // NOT have overwritten it).
    const currentLang = await page.evaluate(() => localStorage.getItem('atelnyo_lang'));
    expect(currentLang).toBe('ht');
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '02-override-skips-geo.png'),
      fullPage: true,
    });
  });

  test('endpoint error (500) does not break the cold-load', async ({ page }) => {
    // The geo hint is a nice-to-have, NOT a load-bearing
    // dependency. A 500 from the endpoint (e.g. Redis down +
    // MaxMind .mmdb corrupt) must NOT 500 the catalog. The FE
    // catches in geoService.hint and the page renders with the
    // synchronous 'ht' default.
    await page.context().clearCookies();
    await page.route('**/api/geo/hint/**', (route) =>
      route.fulfill({ status: 500, body: 'simulated outage' }),
    );

    await page.goto('http://127.0.0.1:3000/');
    await page.evaluate(() => {
      try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}
    });
    await page.reload();
    // The catalog must render in 'ht' (the default fallback)
    // despite the geo endpoint being down. The localStorage
    // value can stay empty (the FE never persisted on failure)
    // OR be set to 'ht' (the default branch) — both are valid.
    await expect(page.locator('.explore-page')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.explore-hero-title')).toBeVisible();
    const storedLang = await page.evaluate(() => localStorage.getItem('atelnyo_lang'));
    // Either 'ht' (the FE persisted the default) or null (the
    // FE caught the error before the persist step). Both are
    // valid per the App.jsx implementation.
    if (storedLang !== null) {
      expect(storedLang).toBe('ht');
    }
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '03-outage-resilience.png'),
      fullPage: true,
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Phase 60.2/60.3 — NO diaspora toast, NO redirect, INSTANT
  // detection, expanded diaspora markets (edge cases E1–E8 from
  // docs/LOCALE_MARKET_ROUTING.md §C.14).
  // ─────────────────────────────────────────────────────────────────
  // The Phase 46.1 DiasporaToast was REMOVED in 60.3: the platform
  // cannot know who a visitor is, so a presumptuous "Kreyòl
  // Ayisyen?" prompt never renders. The detected language is
  // applied silently for everyone; there is NO URL redirect; the
  // result is cached so the next visit is instant.

  test('E1: HT IP + browser fr-FR + TZ Haiti → lang applied in-app, no redirect, no toast', async ({ page }) => {
    // User in Haiti: the geo hint returns ht. The page must stay
    // on the bare URL (no /ht-HT/ redirect), apply 'ht', and
    // NEVER show the diaspora toast.
    await page.context().clearCookies();
    await page.route('**/api/geo/hint/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          country: 'HT',
          suggested_lang: 'ht',
          is_default: false,
          diaspora_hint: false,
          accept_language_match: false,
        }),
      }),
    );
    await page.goto('http://127.0.0.1:3000/');
    await page.evaluate(() => {
      try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}
    });
    await page.reload();
    await expect(page.locator('.explore-page')).toBeVisible({ timeout: 15_000 });
    // No redirect: the URL stays bare.
    expect(new URL(page.url()).pathname).toBe('/');
    // The lang is applied (localStorage persisted).
    await expect.poll(
      async () => page.evaluate(() => localStorage.getItem('atelnyo_lang')),
      { timeout: 10_000 },
    ).toBe('ht');
    // No presumptuous toast.
    await expect(page.locator('[data-testid="diaspora-toast"]')).toHaveCount(0);
  });

  test('E2: Ayisyen nan Dominikani (IP DO, lang ht) → lang applied, no redirect', async ({ page }) => {
    // A Haitian in the DR: geo returns DO + ht. The page must
    // apply 'ht' in-app and stay on the bare URL (no /ht-DO/).
    await page.context().clearCookies();
    await page.route('**/api/geo/hint/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          country: 'DO',
          suggested_lang: 'ht',
          is_default: false,
          diaspora_hint: true,
          accept_language_match: false,
        }),
      }),
    );
    await page.goto('http://127.0.0.1:3000/');
    await page.evaluate(() => {
      try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}
    });
    await page.reload();
    await expect(page.locator('.explore-page')).toBeVisible({ timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe('/');
    await expect.poll(
      async () => page.evaluate(() => localStorage.getItem('atelnyo_lang')),
      { timeout: 10_000 },
    ).toBe('ht');
    await expect(page.locator('[data-testid="diaspora-toast"]')).toHaveCount(0);
  });

  test('E3: Ayisyen nan Kanada (IP CA, lang ht) → lang applied, no redirect', async ({ page }) => {
    await page.context().clearCookies();
    await page.route('**/api/geo/hint/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          country: 'CA',
          suggested_lang: 'ht',
          is_default: false,
          diaspora_hint: true,
          accept_language_match: false,
        }),
      }),
    );
    await page.goto('http://127.0.0.1:3000/');
    await page.evaluate(() => {
      try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}
    });
    await page.reload();
    await expect(page.locator('.explore-page')).toBeVisible({ timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe('/');
    await expect.poll(
      async () => page.evaluate(() => localStorage.getItem('atelnyo_lang')),
      { timeout: 10_000 },
    ).toBe('ht');
    await expect(page.locator('[data-testid="diaspora-toast"]')).toHaveCount(0);
  });

  test('E4: VPN (IP US) + TZ Haiti + lang ht → lang applied from hint, no redirect, no toast', async ({ page }) => {
    // A VPN exit in the US. The backend may flag vpn in geo_flags
    // (confidence drops), but the FE still applies the hint lang
    // and never forces a redirect or a presumptuous toast.
    await page.context().clearCookies();
    await page.route('**/api/geo/hint/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          country: 'US',
          suggested_lang: 'en',
          is_default: false,
          diaspora_hint: true,
          accept_language_match: false,
          geo_flags: { vpn_detected: true, proxy_detected: false, hosting_detected: false, tor_detected: false },
        }),
      }),
    );
    await page.goto('http://127.0.0.1:3000/');
    await page.evaluate(() => {
      try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}
    });
    await page.reload();
    await expect(page.locator('.explore-page')).toBeVisible({ timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe('/');
    await expect.poll(
      async () => page.evaluate(() => localStorage.getItem('atelnyo_lang')),
      { timeout: 10_000 },
    ).toBe('en');
    await expect(page.locator('[data-testid="diaspora-toast"]')).toHaveCount(0);
  });

  test('E5: explicit /fr-HT/ URL + browser ht → URL intent wins, page renders French', async ({ page }) => {
    // An explicit localized URL is the STRONGEST signal — the geo
    // hint must NOT run over it (spec §21/§30).
    await page.context().clearCookies();
    await page.route('**/api/geo/hint/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          country: 'US',
          suggested_lang: 'en',
          is_default: false,
          diaspora_hint: true,
          accept_language_match: false,
        }),
      }),
    );
    await page.goto('http://127.0.0.1:3000/fr-HT/');
    await page.evaluate(() => {
      try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}
    });
    await page.reload();
    await expect(page.locator('.explore-page')).toBeVisible({ timeout: 15_000 });
    // The URL stays /fr-HT/ (never rewritten).
    expect(new URL(page.url()).pathname).toBe('/fr-HT/');
    // The geo hint's 'en' must NOT overwrite the URL intent 'fr'.
    const lang = await page.evaluate(() => localStorage.getItem('atelnyo_lang'));
    expect(lang).not.toBe('en');
    // No toast on an explicit localized URL.
    await expect(page.locator('[data-testid="diaspora-toast"]')).toHaveCount(0);
  });

  test('E6: /fr-XX/ (invalid country) → 404, never a fake localized page', async ({ page }) => {
    await page.goto('http://127.0.0.1:3000/fr-XX/');
    await expect(page.locator('.not-found-page, .nf-page')).toBeVisible({ timeout: 15_000 });
  });

  test('E7: /ht/ (language without country) → not a localized URL, app renders', async ({ page }) => {
    // '/ht' without a country is NOT a locale URL — the app
    // treats it as a normal path (the catch-all or a tab). The
    // key contract: no fake page, no crash.
    await page.goto('http://127.0.0.1:3000/ht');
    await page.evaluate(() => {
      try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}
    });
    await page.reload();
    // '/ht' is NOT a locale URL — the app renders normally (either
    // the Explore home or the 404 for the unknown path). The key
    // contract: no fake localized page, no crash.
    await expect(page.locator('.explore-page')).toBeVisible({ timeout: 15_000 })
      .catch(async () => {
        await expect(page.locator('.not-found-page')).toBeVisible({ timeout: 5000 });
      });
  });

  test('E8: root + user with location_prefs → detection fallback feeds LocaleProvider, no forced redirect', async ({ page }) => {
    // Root with a stored pref (simulated via the geo cache): the
    // page must render in the cached lang instantly and never
    // force a redirect. The cache write below mimics what a
    // previous visit persisted.
    await page.context().clearCookies();
    await page.addInitScript(() => {
      try {
        localStorage.setItem('atelnyo_location_context', JSON.stringify({
          country: 'HT',
          confidence: 0.9,
          sources: ['user_profile', 'geoip'],
          conflict: { detected: false, description: null },
          isDefault: false,
          suggestedLang: 'ht',
          timestamp: Date.now(),
        }));
      } catch (_) {}
    });
    // If the geo endpoint IS consulted (cold cache should not
    // happen here), make it fail — the cached value must win.
    await page.route('**/api/geo/hint/**', (route) =>
      route.fulfill({ status: 500, body: 'cache must win' }),
    );
    await page.goto('http://127.0.0.1:3000/');
    await expect(page.locator('.explore-page')).toBeVisible({ timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe('/');
    // The lang came from the cache synchronously (applied to <html
    // lang> — localStorage atelnyo_lang is NOT written in the
    // cache-only path, which is fine; the UI speaks the right lang).
    await expect(page.locator('html')).toHaveAttribute('lang', 'ht');
    await expect(page.locator('[data-testid="diaspora-toast"]')).toHaveCount(0);
  });

  test('Phase 60.2: no redirect — bare root stays bare even with a detected market country', async ({ page }) => {
    // The user explicitly asked for NO redirect: a visitor from US
    // must NOT be bounced to /en-US/. The lang applies in-app;
    // the URL never changes. (Regression guard for the redirect
    // that was removed in 60.2.)
    await page.context().clearCookies();
    await page.route('**/api/geo/hint/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          country: 'US',
          suggested_lang: 'en',
          is_default: false,
          diaspora_hint: true,
          accept_language_match: false,
        }),
      }),
    );
    await page.goto('http://127.0.0.1:3000/');
    await page.evaluate(() => {
      try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}
    });
    await page.reload();
    await expect(page.locator('.explore-page')).toBeVisible({ timeout: 15_000 });
    // Give the geo fetch time to resolve — the URL must still be bare.
    await expect.poll(
      async () => page.evaluate(() => localStorage.getItem('atelnyo_lang')),
      { timeout: 10_000 },
    ).toBe('en');
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('Phase 60.3: expanded diaspora markets — CH visitor gets fr applied, no toast', async ({ page }) => {
    // Phase 60.3 added CH/BE/BR/GP/MQ/BS/TC as full MARKETS. A CH
    // visitor gets fr applied in-app (no toast, no redirect).
    await page.context().clearCookies();
    await page.route('**/api/geo/hint/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          country: 'CH',
          suggested_lang: 'fr',
          is_default: false,
          diaspora_hint: true,
          accept_language_match: false,
        }),
      }),
    );
    await page.goto('http://127.0.0.1:3000/');
    await page.evaluate(() => {
      try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}
    });
    await page.reload();
    await expect(page.locator('.explore-page')).toBeVisible({ timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe('/');
    await expect.poll(
      async () => page.evaluate(() => localStorage.getItem('atelnyo_lang')),
      { timeout: 10_000 },
    ).toBe('fr');
    await expect(page.locator('[data-testid="diaspora-toast"]')).toHaveCount(0);
  });

  test('Phase 60.2: result is cached — second visit resolves lang synchronously (no API call)', async ({ page }) => {
    // The INSTANT path: after the first visit persists the cache,
    // the second visit must resolve the lang from localStorage
    // WITHOUT calling the geo endpoint at all. This is the
    // "like a logo" behavior the user asked for.
    let geoCallCount = 0;
    await page.route('**/api/geo/hint/**', (route) => {
      geoCallCount += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          country: 'US',
          suggested_lang: 'en',
          is_default: false,
          diaspora_hint: false,
          accept_language_match: false,
        }),
      });
    });

    // Seed the same cache the geo-hint effect writes on a first
    // visit (fresh timestamp) — the app must use it with ZERO
    // network calls.
    await page.addInitScript(() => {
      try {
        localStorage.setItem('atelnyo_location_context', JSON.stringify({
          country: 'US',
          confidence: 0.8,
          sources: ['geoip'],
          conflict: { detected: false, description: null },
          isDefault: false,
          suggestedLang: 'en',
          timestamp: Date.now(),
        }));
        // No atelnyo_lang — the cache alone must drive the lang.
        localStorage.removeItem('atelnyo_lang');
      } catch (_) {}
    });
    await page.goto('http://127.0.0.1:3000/');
    await expect(page.locator('.explore-page')).toBeVisible({ timeout: 15_000 });
    // Give any (unexpected) effect a moment to fire.
    await page.waitForTimeout(1500);
    // The lang must be applied synchronously from the cache (the UI
    // <html lang> reflects it even though atelnyo_lang was removed).
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    // And the geo endpoint must NEVER have been consulted.
    expect(geoCallCount, 'cached visit must not call /api/geo/hint/').toBe(0);
  });
});
