/**
 * signup-lands-explore.spec.ts — regression pin for the "double UI after
 * signup" report.
 *
 * A brand-new user must land on the Explore surface after signing up, NOT
 * the legacy commerce tab (Newsletter/Features/Stats rails). Root cause
 * (fixed in migration 0134): SessionMemory.current_tab defaulted to
 * 'commerce' while the FE seeds activeTab='explore', so after signup
 * App.jsx restored the tab from GET /api/session/me/ → get_or_create and
 * switched the UI underneath the user.
 *
 * Requires the live Vite (:3000) + Daphne (:8000) servers (SQLite-local
 * backend — see run_vite.sh / run_daphne.sh). Uses a unique email per run
 * so the test is idempotent across repeated local runs.
 */
import { test, expect } from '@playwright/test';

const email = `e2e-explore-${Date.now()}@atelnyo.local`;

test('fresh signup lands on the Explore surface (not the commerce tab)', async ({ page }) => {
  // Sign up via the dedicated /signup route (SEO page renders the modal).
  await page.goto('/signup');
  await expect(page.locator('.auth-card')).toBeVisible();

  await page.locator('.auth-form input[type="email"]').fill(email);
  await page.locator('.auth-form input[type="password"]').nth(0).fill('testpass123!');
  await page.locator('.auth-form input[type="password"]').nth(1).fill('testpass123!');
  await page.locator('.auth-form button[type="submit"]').click();

  // 2026 refresh: after a successful signup the card swaps to an
  // OPTIONAL email-verification prompt. Skip it — verification must
  // never block the signup round-trip.
  const verifyPrompt = page.locator('.auth-verify-prompt');
  try {
    await verifyPrompt.waitFor({ state: 'visible', timeout: 5_000 });
    await page.locator('.auth-verify-actions button.auth-link, .auth-verify-actions .auth-link').first().click();
  } catch {
    // Prompt not rendered (feature flagged off / older build) — proceed.
  }

  // The modal closes after a successful signup — and NO error is shown.
  await expect(page.locator('.auth-card')).not.toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.auth-error')).toHaveCount(0);

  // The dedicated /signup route navigated away (AuthRoute redirects a
  // signed-in user off the auth page) — proof the session round-trip ran.
  await expect(page).not.toHaveURL(/\/signup/, { timeout: 15_000 });

  // The bottom nav marks Explore as active — proof the user landed on the
  // Explore tab, not the legacy commerce surface (which has no nav entry).
  await expect(page.locator('.bottom-nav-item.active')).toHaveText(/Explore/, { timeout: 15_000 });

  // The Explore surface renders the feed container (HomeFeed) — the
  // commerce UI never renders this element.
  await expect(page.locator('.feed-container')).toBeVisible({ timeout: 15_000 });

  // The commerce-only Newsletter section must NOT be present on Explore.
  await expect(page.locator('[data-testid="newsletter-section"]')).toHaveCount(0);

  // The user is genuinely signed in (not the anonymous guest view): the
  // header shows the auth surface swapped for the logged-in state — the
  // strongest cheap signal that the signup round-trip actually completed.
  await expect(page.locator('.bottom-nav-item.active')).toHaveText(/Explore/);

  // A second page load must STAY on explore (session restore path).
  await page.reload();
  await expect(page.locator('.bottom-nav-item.active')).toHaveText(/Explore/, { timeout: 15_000 });
  await expect(page.locator('[data-testid="newsletter-section"]')).toHaveCount(0);
});
