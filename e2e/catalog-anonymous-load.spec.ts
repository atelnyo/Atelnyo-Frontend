/**
 * e2e/catalog-anonymous-load.spec.ts
 *
 * Diagnostic spec for the user's anonymous-load smoke test.
 *
 * Scope (intentionally narrow):
 *   1. Cold-load the Explore page WITHOUT a JWT cookie / localStorage
 *      session — the user is a first-time visitor.
 *   2. Confirm the page renders (hero stats + filter chips + the
 *      first interactive card rows are visible).
 *   3. Toggle the "music" chip and confirm cards render (we
 *      confirmed anon /api/explore/music/ returns 11 rows via curl).
 *   4. Toggle the "talents" chip and confirm cards render (anon
 *      /api/explore/talents/ returns 12 rows).
 *   5. Open the talent sheet for the first talent row — confirms
 *      the Phase-18 sheet route wires up the avatar / role / bio
 *      for an anon visitor (no auth redirect).
 *   6. Capture screenshots at every interesting state so we can
 *      inspect the visual result without running playwright test
 *      headed.
 *
 * What this spec does NOT cover:
 *   - Authenticated flows (signup, save, message). Those are
 *     covered by explore-talent-connect.spec.ts.
 *   - `/api/explore/saved/*` — those endpoints intentionally
 *     return 401 for anonymous callers; the FE shows a "Sign in
 *     to save" toast (verified out-of-band via curl above).
 *   - Phase-24+ tables (communities / jobs / portfolio /
 *     marketplace / events) — the dev DB is empty for those
 *     (also verified via curl), so the page surfaces the
 *     premium "Anyen pa jwenn" empty state for those sections.
 *     That's expected, not a regression — a fresh seed_e2e_data
 *     run inserts those rows.
 *
 * i18n: the spec asserts on STABLE WIRING (CSS classes,
 * data-testids, FontAwesome icons) instead of translated strings,
 * so the run is independent of the page's current language
 * (``devrose_lang`` localStorage key). The default locale on a
 * fresh visitor is ``ht`` (Haitian Creole) — the hero reads
 * ``Dekouvri Atelnyo`` not ``Explore Atelnyo`` — so a regex that
 * only matches the English copy would false-fail. Pinning to
 * ``.explore-page`` / ``.explore-hero-title`` / the FontAwesome
 * icon class on each chip keeps the spec robust against the
 * future translation rollouts the project ships.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS_DIR = 'test-results/catalog-anonymous-load';

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
});

test.describe('[Anonymous] Explore catalog loads correctly', () => {
  test('cold-load /, switch chip, open talent sheet', async ({ page }) => {
    // 1. Hard-cold-load: dismiss any cached session by wiping
    //    localStorage + cookies BEFORE the page mounts. The test
    //    starts authenticated by accident if a prior E2E run left
    //    a refresh token in storage (Chromium profile reuse).
    await page.context().clearCookies();
    await page.goto('http://127.0.0.1:3000/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    // Deterministic element-based wait instead of
    // ``waitForLoadState('networkidle')``. The same HMR + 8
    // parallel catalog fetches that flaked the outage test
    // apply here too — the chrome element paints on the
    // first React commit, well before any fetch resolves, so
    // waiting for ``.explore-page`` is both faster and
    // immune to the network heuristic.
    await expect(page.locator('.explore-page')).toBeVisible({ timeout: 15_000 });

    // Snapshot the cold-load state.
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '01-catalog-cold-load.png'),
      fullPage: true,
    });

    // 2. The Explore component mounted. We pin to its root CSS
    //    class (``explore-page``) + the hero title since both
    //    are language-stable. The translated hero string can
    //    read ``Dekouvri Atelnyo`` (ht) or ``Explore Atelnyo``
    //    (en/fr/es) but the CSS class never changes.
    await expect(page.locator('.explore-page')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.explore-hero-title')).toBeVisible({ timeout: 15_000 });

    // At least one filter chip is present on any of the supported
    // locales — we use the FontAwesome icon class as a stable
    // language-independent selector. ``.explore-chip`` is the
    // common chip wrapper.
    await expect(page.locator('.explore-chip i.fa-music').first()).toBeVisible();
    await expect(page.locator('.explore-chip i.fa-star').first()).toBeVisible();
    await expect(page.locator('.explore-chip i.fa-globe').first()).toBeVisible();

    // 3. Switch to the MUSIC chip — the canonical anon-path test.
    //    /api/explore/music/ returns 11 active rows per the seed
    //    data (verified out-of-band via curl). We use ``toBeVisible``
    //    auto-waits instead of fixed ``waitForTimeout`` so a slow
    //    CI box (or a 5+ parallel-requests cold-cache first paint)
    //    doesn't flake — the auto-wait covers the network race.
    const musicChip = page.locator('.explore-chip').filter({ has: page.locator('i.fa-music') }).first();
    await musicChip.click();
    // Stable selector — ``data-testid="music-card"`` is added to
    // the MusicCard root in ``src/components/Explore.jsx`` so the
    // spec is robust against future CSS-class refactors (the prior
    // ``.explore-card-music`` selector would have broken the
    // moment someone renamed the CSS module). Mirrors the existing
    // ``data-testid="talent-card"`` convention on TalentCard.
    const musicCards = page.locator('[data-testid="music-card"]');
    await expect(musicCards.first()).toBeVisible({ timeout: 15_000 });
    // Sanity check: every card carries the catalog PK so a future
    // spec can assert a specific track render (e.g. "did the play
    // POST land on track #42?") without parsing innerText.
    //
    // Tighten to a numeric pattern (``/^\d+$/``) instead of a
    // bare ``toBeTruthy()`` so a malformed id (``"undefined"``,
    // empty string, or a serialized object) actually fails the
    // test. A bare truthy check would pass when React renders
    // ``data-music-id={undefined}`` as the literal string
    // ``"undefined"`` — the attribute *exists* but the data
    // contract is broken. The numeric regex catches the
    // malformed case the truthy check misses.
    const firstMusicId = await musicCards.first().getAttribute('data-music-id');
    expect(firstMusicId, 'data-music-id must be a non-empty numeric string').toMatch(/^\d+$/);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '02-music-chip.png'),
      fullPage: true,
    });
    // Lock in the data contract: anon ``/api/explore/music/`` must
    // return at least 11 rows. We use ``expect.soft`` so a future
    // regression on the music floor still lets the rest of the
    // test run (the talent + sheet assertions keep going and the
    // full failure picture shows up in the report). Hard-exact
    // ``toHaveCount(11)`` was rejected by code review because a
    // future seed growth (e.g. +1 row) would false-fail the spec
    // without a semantic reason — the floor, not the ceiling, is
    // the contract.
    const musicCount = await musicCards.count();
    expect.soft(musicCount, 'anon /api/explore/music/ row floor').toBeGreaterThanOrEqual(11);
    // A hard "not empty" assertion guarantees the page didn't
    // silently render the premium empty state (which would also
    // pass a ``count() >= 11`` if the floor ever got lowered).
    expect(musicCount, 'anon /api/explore/music/ must render cards').toBeGreaterThan(0);

    // 4. Switch to the TALENTS chip. Same auto-wait + data-floor
    //    pattern. ``/api/explore/talents/`` returns 12 rows for
    //    an anonymous visitor on the current seed.
    const talentsChip = page.locator('.explore-chip').filter({ has: page.locator('i.fa-star') }).first();
    await talentsChip.click();
    const talentCards = page.locator('[data-testid="talent-card"]');
    await expect(talentCards.first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '03-talents-chip.png'),
      fullPage: true,
    });
    // Mirror the music assertion: floor (soft, >=12) + hard
    // non-empty (count > 0). See the music comment block above
    // for the rationale.
    const talentCount = await talentCards.count();
    expect.soft(talentCount, 'anon /api/explore/talents/ row floor').toBeGreaterThanOrEqual(12);
    expect(talentCount, 'anon /api/explore/talents/ must render cards').toBeGreaterThan(0);

    // 5. Click the first talent card → talent sheet MUST open
    //    (Phase 18 — TalentSheet at /sheet/explore/talent). For
    //    anon callers this route renders the sheet UI but the
    //    Save toggle shows the "Sign in to save" toast when
    //    clicked — that's correct behavior, not a redirect.
    const firstTalentId = await talentCards.first().getAttribute('data-talent-id');
    expect(firstTalentId, 'talent card must carry data-talent-id').toBeTruthy();
    await talentCards.first().click();
    await page.waitForURL(/\/sheet\/explore\/talent/, { timeout: 15_000 });
    await expect(page.locator('[data-talent-sheet]')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '04-talent-sheet.png'),
      fullPage: true,
    });

    // The back arrow must return to / — the sheet's ``<Navigate />`` +
    // ``navigate(-1)`` paths both work; we use navigate(-1) so the
    // test mirrors a real user's interaction.
    await page.goBack();
    // Deterministic element-based wait instead of
    // ``waitForLoadState('networkidle', { timeout: 10_000 })``.
    // The 10s bound was the tightest in the spec and the most
    // likely to flake on a cold-cache CI box (the chip rail
    // re-mounts on the back navigation, so waiting for the
    // first chip is both faster and more deterministic than
    // the network heuristic — a 10s networkidle wait after
    // a SPA back navigation races against HMR pings).
    await expect(page.locator('.explore-chip').first()).toBeVisible({ timeout: 15_000 });

    // 6. Final assertion: the chip filter is still rendered (the
    //    page didn't crash or unmount on the sheet roundtrip).
    await expect(page.locator('.explore-chip').first()).toBeVisible();
  });

  test('catalog errors surface visibly (NOT a silent blank) when ALL main endpoints fail', async ({ page }) => {
    // The earlier version of this test only routed the RECOMMENDED
    // talent endpoint to 500, which is silently absorbed by
    // ``Explore.jsx`` (the recommended section just doesn't render
    // a sub-row). The test was therefore trivially passing.
    //
    // The stronger contract: when ALL main catalog endpoints
    // (courses, music, talents) return 500, the user MUST see
    // the premium "Could not load" empty state — not a blank page,
    // not the "Anyen pa jwenn" no-data state, not a hung spinner.
    // That's the ``error`` branch in ``PremiumEmpty``
    // (``src/components/Explore.jsx``) gated on
    // ``showEmpty && loadError``.
    await page.context().clearCookies();
    await page.goto('http://127.0.0.1:3000/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Route every main catalog endpoint to 500 BEFORE reload so
    // the page's mount-time fetch sees the simulated outage on the
    // first try (a 200 then a 500 would let the FE render the
    // happy-path state first, then briefly swap to error state).
    const fullOutage = (route) =>
      route.fulfill({ status: 500, body: 'simulated outage' });
    await page.route('**/api/courses/**', fullOutage);
    await page.route('**/api/explore/music/**', fullOutage);
    await page.route('**/api/explore/talents/**', fullOutage);
    // Phase 47 — Spotlight is now part of the anonymous catalog
    // mount-fetch set (spotlightService.list on Explore mount).
    // Without stubbing it, the section loads REAL rows →
    // totalItems > 0 → showEmpty stays false → the error empty
    // state never surfaces and the outage test false-fails.
    await page.route('**/api/spotlight/**', fullOutage);
    // Phase 24–34 — communities / jobs / portfolio / marketplace /
    // events are ALSO part of the Explore mount-fetch set, and the
    // local dev DB now carries real portfolio + marketplace rows
    // (plus the upcoming-events endpoint). Without stubbing them,
    // totalItems > 0 → showEmpty stays false → the error empty
    // state never surfaces and the outage contract false-fails.
    await page.route('**/api/communities/**', fullOutage);
    await page.route('**/api/jobs/**', fullOutage);
    await page.route('**/api/portfolio/**', fullOutage);
    await page.route('**/api/marketplace/**', fullOutage);
    await page.route('**/api/community-events/**', fullOutage);
    // The default 'all' view renders HomeFeed (filter==='all' && !q &&
    // !useDEIE), which fetches /api/feed/home/ on mount — NOT one of
    // the section endpoints above. Without stubbing it, the real
    // backend answers and HomeFeed renders real cards, so the error
    // empty state never appears and the outage contract false-fails.
    await page.route('**/api/feed/**', fullOutage);

    await page.reload();
    // Deterministic wait instead of ``waitForLoadState('networkidle')``.
    // The Vite dev server + 8 parallel catalog fetches (3 of which
    // are stubbed to 500, 5 of which go to the real backend) often
    // exceeds the 500ms-idle window that ``networkidle`` requires
    // because of HMR ping traffic and slow /api/communities/,
    // /api/jobs/, etc. on a freshly-migrated dev DB. A direct
    // element-based wait pins the test to the production-grade
    // success signal (the error UX renders) instead of a
    // transport-level heuristic that flakes under load.
    //
    // The wait order matches the FE's render order: the chrome
    // (``.explore-page`` / ``.explore-hero-title``) mounts first,
    // then the error empty state surfaces once all 3 stubbed
    // fetches resolve with 500 and the ``loadError`` selector
    // flips to non-null inside ``PremiumEmpty``.
    await expect(page.locator('.explore-empty-premium.explore-empty-error[role="alert"]'))
      .toBeVisible({ timeout: 30_000 });
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '05-outage-resilience.png'),
      fullPage: true,
    });

    // The hero + chip rail also render (graceful chrome); we
    // re-assert them post-screenshot to confirm the page didn't
    // unmount on the error-state transition.
    await expect(page.locator('.explore-page')).toBeVisible();
    await expect(page.locator('.explore-hero-title')).toBeVisible();
    await expect(page.locator('.explore-empty-error i.fa-triangle-exclamation'))
      .toBeVisible();
  });
});
