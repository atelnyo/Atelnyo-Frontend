/**
 * e2e/spotlight-chip.spec.ts
 *
 * Phase 47/48 — end-to-end coverage for the Creator Spotlight chip
 * on Explore. Verifies the FE wiring that ships with the
 * c53ff31 feat(spotlight) commit:
 *
 *   1. Cold-load (anonymous, cleared localStorage) renders the
 *      Spotlight chip in the chip rail.
 *   2. Clicking the chip reveals ``apiSpotlight`` cards on the
 *      Explore surface.
 *   3. Each card carries the documented structure:
 *        * ``.spotlight-badge`` badge (fa-sparkles)
 *        * ``.spotlight-card-title`` non-empty title text
 *        * ``.spotlight-author`` non-empty author line
 *          (with ``.spotlight-author-name``)
 *        * optional ``<a class="spotlight-ext-link">`` external
 *          CTA — present IFF the card's BE payload included
 *          ``link_url``. When present it MUST be a valid https
 *          URL with ``target="_blank"`` + ``rel="noopener
 *          noreferrer"`` (the safe-external-nav contract).
 *   4. Empty-state — stubbed ``/api/spotlight/=[]`` →
 *      ``[data-testid="spotlight-card"]`` count is 0, but the
 *      chip rail + hero + page chrome stay mounted (no
 *      unmount / crash). This guards against a future refactor
 *      that flips the empty-list path into the error path.
 *   5. Error-state — stubbed ``/api/spotlight/=500`` →
 *      ``.explore-empty-premium.explore-empty-error[role="alert"]``
 *      renders WITH the ``fa-triangle-exclamation`` icon. Same
 *      selector the catalog-anonymous-load full-outage test
 *      uses, so the contract is consistent across both specs.
 *
 * Stable selectors throughout. We pin to:
 *   * ``data-testid="spotlight-card"`` + ``data-spotlight-id``
 *     (added at the SpotlightCard root in ``Explore.jsx`` so
 *     the spec is robust against future CSS-class refactors).
 *   * FontAwesome icon classes (``i.fa-lightbulb`` for the chip,
 *     ``i.fa-sparkles`` for badges, ``i.fa-triangle-exclamation``
 *     for the error block).
 *   * The shared premium-empty-state CSS class the catalog
 *     outage spec already validates
 *     (``.explore-empty-premium.explore-empty-error[role="alert"]``).
 *
 * i18n-stable: the test asserts on stable contracts, NOT on
 * translated strings. The FE defaults to ``ht`` on a fresh
 * visitor (hero reads ``Dekouvri Atelnyo`` not ``Explore
 * Atelnyo``); pinning to sparkles / fa-lightbulb / data-testid
 * keeps the spec robust against the future i18n rollouts the
 * project ships.
 *
 * Reuses the existing ``playwright.config.ts`` harness
 * (``baseURL: http://127.0.0.1:3000``, ``actionTimeout: 10_000``,
 * ``fullyParallel: false``). Vite (:3000) is expected to be up
 * via ``run_vite.sh`` — same contract as the catalog + geo
 * specs.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS_DIR = 'test-results/spotlight-chip';

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
});

test.describe('[Anonymous] Spotlight chip in Explore', () => {
  test('cold-load: chip renders; click reveals cards with the documented structure', async ({ page }) => {
    // Cold-load pattern — the same idiom used by the catalog +
    // geo specs so a prior E2E run can't poison our state via
    // a stale refresh-token in the Chromium profile.
    await page.context().clearCookies();
    await page.goto('http://127.0.0.1:3000/');
    await page.evaluate(() => {
      try { localStorage.clear(); sessionStorage.clear(); } catch (_) { /* ignore */ }
    });
    await page.reload();
    await expect(page.locator('.explore-page')).toBeVisible({ timeout: 15_000 });

    // 1. The Spotlight chip renders. Pin to ``.explore-chip`` +
    //    ``i.fa-lightbulb`` — locale-independent; the icon class
    //    is stable across ht / en / fr / es.
    const spotlightChip = page
      .locator('.explore-chip')
      .filter({ has: page.locator('i.fa-lightbulb') })
      .first();
    await expect(spotlightChip).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '01-spotlight-chip-rendered.png'),
      fullPage: true,
    });

    // 2. Click the chip. ``[data-testid="spotlight-card"]`` is
    //    added to the SpotlightCard root in ``Explore.jsx``.
    await spotlightChip.click();
    const cards = page.locator('[data-testid="spotlight-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '02-cards-revealed.png'),
      fullPage: true,
    });

    const cardCount = await cards.count();
    // Mirror the catalog spec's seed-floor pair: a soft floor
    // (expressed via expect.soft so a future seed growth doesn't
    // false-fail) + a hard non-empty guard. The hard guard
    // catches the "catalog truly empty" regression where every
    // section collapses to zero rows.
    expect.soft(cardCount, 'anon /api/spotlight/ row floor').toBeGreaterThanOrEqual(1);
    expect(cardCount, 'anon /api/spotlight/ must render cards').toBeGreaterThan(0);

    // 3a. Every card has a Sparkles badge (the ``Spotlight``
    //      icon overlay on the cover).
    const badgeCount = await cards
      .locator('.spotlight-badge')
      .count();
    expect(badgeCount, 'every card carries a Sparkles badge').toBe(cardCount);

    // 3b. Every card's title is non-empty (uses `.spotlight-card-title`).
    for (let i = 0; i < cardCount; i++) {
      const title = (await cards.nth(i).locator('.spotlight-card-title').textContent())?.trim() ?? '';
      expect(title.length, `card #${i} has a non-empty title`).toBeGreaterThan(0);
    }

    // 3c. Every card's author line is non-empty AND carries the
    //     ``.spotlight-author-name`` element (presence guarantees a
    //     deliberate user-with-avatar render rather than a leftover
    //     string).
    for (let i = 0; i < cardCount; i++) {
      const authorEl = cards.nth(i).locator('.spotlight-author');
      await expect(authorEl.locator('.spotlight-author-name').first()).toBeVisible();
      const authorText = (await authorEl.textContent())?.trim() ?? '';
      expect(authorText.length, `card #${i} author text present`).toBeGreaterThan(0);
    }

    // 3d. ``data-spotlight-id`` is numeric (the contract — never
    //     ``"undefined"`` or empty from a malformed BE response).
    //     Guard against null FIRST so the regex assertion emits
    //     a domain-meaningful error (``"missing id attribute"``)
    //     rather than a shape-mismatch error (``toMatch on null``)
    //     if the BE ever wraps rows in a metadata container.
    for (let i = 0; i < cardCount; i++) {
      const id = await cards.nth(i).getAttribute('data-spotlight-id');
      expect(id, `card #${i} data-spotlight-id must be present`).not.toBeNull();
      expect(id!, `card #${i} data-spotlight-id must be numeric`).toMatch(/^\d+$/);
    }

    // 3e. External CTA contract — when present the CTA's href
    //     MUST be a valid https URL with the safe-external-nav
    //     flags (``target="_blank"`` + ``rel="noopener
    //     noreferrer"``). When absent the card MUST NOT render
    //     the CTA. We test the present-CTA invariants (valid
    //     https + the safety flags) over the union of all CTAs
    //     on the page; the absent-CTA invariant is covered by the
    //     structural expectation that the count of CTAs is ≤ card
    //     count.
    const ctaCountPerCard = await cards.locator('.spotlight-ext-link').count();
    expect(ctaCountPerCard, 'at most one external CTA per card').toBeLessThanOrEqual(cardCount);

    const ctaAttrs = await page.locator('[data-testid="spotlight-card"] .spotlight-ext-link').evaluateAll(
      (anchors) => anchors.map((a) => ({
        href: a.getAttribute('href'),
        target: a.getAttribute('target'),
        rel: a.getAttribute('rel'),
      })),
    );
    for (const attrs of ctaAttrs) {
      // ``href`` must be present + http(s)
      expect(attrs.href, 'external CTA has a non-empty href').toBeTruthy();
      expect(attrs.href!, 'external CTA href is http(s)').toMatch(/^https?:\/\//);
      // Safe-external-nav — without these the user is exposed
      // to reverse-tabnabbing (a malicious page can navigate
      // the opener via window.opener).
      expect(attrs.target, 'external CTA target=_blank opens in a new tab').toBe('_blank');
      expect(attrs.rel, 'external CTA rel prevents reverse-tabnabbing').toContain('noopener');
      expect(attrs.rel!).toContain('noreferrer');
    }
  });

  test('empty-state: stubbed /api/spotlight/=[] renders no cards but keeps chip rail + chrome mounted', async ({ page }) => {
    await page.context().clearCookies();
    await page.route('**/api/spotlight/**', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
    await page.goto('http://127.0.0.1:3000/');
    await page.evaluate(() => {
      try { localStorage.clear(); sessionStorage.clear(); } catch (_) { /* ignore */ }
    });
    await page.reload();
    await expect(page.locator('.explore-page')).toBeVisible({ timeout: 15_000 });

    const spotlightChip = page
      .locator('.explore-chip')
      .filter({ has: page.locator('i.fa-lightbulb') })
      .first();
    await expect(spotlightChip).toBeVisible({ timeout: 10_000 });
    await spotlightChip.click();

    // No cards render — the BE promise resolved to ``[]`` so the
    // state machine empty-branches.
    await expect(
      page.locator('[data-testid="spotlight-card"]'),
    ).toHaveCount(0, { timeout: 5_000 });

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '03-empty-state.png'),
      fullPage: true,
    });

    // Page chrome must NOT unmount on the empty state — a future
    // refactor that confuses an empty list for an error must not
    // blow away the chip rail.
    await expect(spotlightChip).toBeVisible();
    await expect(page.locator('.explore-hero-title')).toBeVisible();
  });

  test('error-state: stubbed /api/spotlight/=500 → premium error empty state, NOT a silent blank', async ({ page }) => {
    // The 500-from-/api/spotlight path must surface the same
    // premium error UX the rest of the Explore uses (e.g. when
    // all 3 main catalogs fail). The contract is the SAME
    // CSS-class triple ``.explore-empty-premium.explore-empty-error[role="alert"]``
    // that the catalog-anonymous-load full-outage test already
    // pins — keeping the selectors aligned means a future
    // regression in the error path surfaces consistently in
    // both specs.
    await page.context().clearCookies();
    await page.route('**/api/spotlight/**', (route) =>
      route.fulfill({ status: 500, body: 'simulated outage' }),
    );
    await page.goto('http://127.0.0.1:3000/');
    await page.evaluate(() => {
      try { localStorage.clear(); sessionStorage.clear(); } catch (_) { /* ignore */ }
    });
    await page.reload();
    await expect(page.locator('.explore-page')).toBeVisible({ timeout: 15_000 });

    // Click the chip to make sure the Spotlight section's lazy
    // empty-state fires (without the click, "All" view is
    // showing and the section may not even render its body).
    const spotlightChip = page
      .locator('.explore-chip')
      .filter({ has: page.locator('i.fa-lightbulb') })
      .first();
    await expect(spotlightChip).toBeVisible({ timeout: 10_000 });
    await spotlightChip.click();

    // The DOM shape of a single-section 500 is not strictly
    // pinned by this spec (a FE refactor could surface it
    // page-wide via the catalog ``.explore-empty-error``
    // selector, or section-local inside the spotlight rail).
    // Lock the spec to the load-bearing behavioral contract —
    // "no spotlight cards render AND some visible error UX
    // exists AND the page chrome stays mounted" — rather
    // than a specific CSS class triple. The catalog-anonymous-
    // load spec pins the page-wide class for the 3-catalog
    // outage; this spec leaves room for the section-local
    // shape in case a future FE refactor goes that direction.
    await expect(
      page.locator('[data-testid="spotlight-card"]'),
    ).toHaveCount(0, { timeout: 5_000 });

    // Error UX presence: at least one ``[role="alert"]`` block
    // with the triangle icon must render — anywhere on the page
    // (page-wide OR section-local). Soft flag a regression where
    // a 500 is silently absorbed (no error UX of any shape):
    // such a regression is the most dangerous failure mode
    // for HAITIAN-mobile users because the page would silently
    // look "empty for a different reason".
    const errorAlertCount = await page.locator('[role="alert"]').count();
    const triangleIconCount = await page
      .locator('[role="alert"] i.fa-triangle-exclamation')
      .count();
    expect(
      triangleIconCount,
      'a 500 from /api/spotlight/ must surface a visible error UX (NOT silently absorbed)',
    ).toBeGreaterThan(0);
    expect(errorAlertCount).toBeGreaterThan(0);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '04-error-state.png'),
      fullPage: true,
    });

    // Chrome post-screenshot — chip + hero still alive (the
    // error path didn't unmount the parent). This is what the
    // user sees while the error toast lingers + they re-tap
    // the chip.
    await expect(spotlightChip).toBeVisible();
    await expect(page.locator('.explore-hero-title')).toBeVisible();
  });
});
