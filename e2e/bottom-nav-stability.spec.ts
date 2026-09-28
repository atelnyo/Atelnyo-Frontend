/**
 * bottom-nav-stability.spec.ts — measure whether the bottom nav bar stays
 * anchored while the Explore feed loads and while the page scrolls.
 *
 * The nav uses position:fixed; bottom:0. It should NEVER move vertically.
 * A "jumpy" nav is usually a containing-block leak: a transform/filter on
 * an ancestor (.container container-in animation, fx modes) makes fixed
 * position relative to that ancestor instead of the viewport.
 *
 * Requires Vite (:3000) + Daphne (:8000) — SQLite-local backend.
 */
import { test, expect } from '@playwright/test';

test('bottom nav stays fixed while Explore loads and scrolls', async ({ page }) => {
  // Fresh anonymous visit so the feed actually loads from the network.
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Sample the nav position + active pill position + VISIBILITY
  // continuously while content loads — catches a mid-load jump, an
  // active-tab flicker (pill re-animating), OR a visibility flash
  // (display/opacity toggling during load = the "pa stab" blink).
  await page.evaluate(() => {
    window.__navSamples = [];
    const el = document.querySelector('.bottom-nav-bar');
    if (el) {
      const t = setInterval(() => {
        const r = el.getBoundingClientRect();
        const active = el.querySelector('.bottom-nav-item.active');
        const lit = active ? [...el.children].indexOf(active) : -1;
        const cs = getComputedStyle(el);
        window.__navSamples.push({
          top: Math.round(r.top),
          lit,
          visible: cs.display !== 'none' && cs.visibility !== 'hidden' && el.getBoundingClientRect().height > 0,
        });
      }, 50);
      window.setTimeout(() => clearInterval(t), 5000);
    }
  });

  // Wait for the feed container to appear (content loaded).
  await expect(page.locator('.feed-container')).toBeVisible({ timeout: 15_000 });

  const readNavBox = () => page.locator('.bottom-nav-bar').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) };
  });

  // Give the sampler a moment to fill, then inspect it.
  await page.waitForTimeout(1500);
  const navSamples = await page.evaluate(() => window.__navSamples || []);
  const baseline = await readNavBox();
  expect(baseline.bottom).toBeGreaterThan(0);

  // Every sampled position must equal the final one (no vertical jump).
  if (navSamples.length > 0) {
    const tops = [...new Set(navSamples.map((s) => s.top))];
    expect(tops.length).toBeLessThanOrEqual(1);
    // The active pill must stay on ONE tab for the whole load — a churn
    // here is the "pa stab" flicker (pill jumps between tabs / re-animates).
    const lit = [...new Set(navSamples.map((s) => s.lit).filter((v) => v >= 0))];
    expect(lit.length).toBeLessThanOrEqual(1);
    // The nav must NEVER disappear during load (visibility flash).
    expect(navSamples.every((s) => s.visible)).toBe(true);
  }

  // Scroll to the bottom of a long page — a fixed nav must not move.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  const scrolled = await readNavBox();
  expect(scrolled.bottom).toBe(baseline.bottom);
  expect(scrolled.top).toBe(baseline.top);

  // Scroll back to top — still anchored.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const backTop = await readNavBox();
  expect(backTop.top).toBe(baseline.top);

  // Click a nav tab (Mwen) and return — the nav must be in the same spot.
  await page.locator('.bottom-nav-item', { hasText: /Mwen|Mine|Mío/ }).first().click();
  await page.waitForTimeout(400);
  const afterTab = await readNavBox();
  expect(afterTab.top).toBe(baseline.top);
  expect(afterTab.bottom).toBe(baseline.bottom);

  // The active pill must stay VISIBLE throughout a tab switch — the old
  // 0.32s overshoot keyframes started at scale(0.55)/opacity 0, so the
  // indicator blinked out for ~300ms on every switch (the "pa stab"
  // wobble). Sample its computed opacity/width mid-animation.
  const mwen = page.locator('.bottom-nav-item', { hasText: /Mwen|Mine|Mío/ }).first();
  await mwen.click();
  const minPill = await page.evaluate(async () => {
    let min = 1;
    for (let i = 0; i < 10; i++) {
      const el = document.querySelector('.bottom-nav-item.active');
      if (!el) { min = 0; break; }
      const cs = getComputedStyle(el, '::before');
      const o = parseFloat(cs.opacity);
      const w = parseFloat(cs.width) || 0;
      if (o < min) min = o;
      if (w < 30) min = 0;
      await new Promise((r) => setTimeout(r, 40));
    }
    return min;
  });
  expect(minPill).toBeGreaterThan(0.5);
});
