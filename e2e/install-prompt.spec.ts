/**
 * e2e/install-prompt.spec.ts
 *
 * PWA roadmap item #7 — End-to-end contract for the install prompt
 * banner (src/components/InstallPrompt.jsx ←
 * src/pwa/installation/InstallationManager.js).
 *
 * The native `beforeinstallprompt` event cannot fire in headless
 * Chromium, so the suite dispatches a SYNTHETIC one carrying the
 * deferred-prompt surface the manager requires (a callable `prompt()`
 * — see installPromptHandler.hasUsable). Everything else — the
 * PROMPT_POLICY timing (4s min load + first engagement), the
 * claim-once-per-session rule, the 7-day quiet window, and the
 * accept/dismiss state transitions — runs through the REAL manager.
 *
 * Locked-in guarantees:
 *   1. The banner appears only after the good-moment criteria are met
 *      (prompt captured + min time-on-page + first engagement) and the
 *      manager reports promptAvailable=true / installed=false.
 *   2. Dismiss hides it for the session AND persists the 7-day quiet
 *      window (devrose_pwa_dismissed_at) so a reload never re-offers.
 *   3. Accepting invokes the deferred prompt, hides the banner, and —
 *      critically — NEVER writes the installed marker (only standalone
 *      detection may: _acceptPrompt is a UX outcome, not proof of
 *      installation).
 *
 * Language-stable selectors: CSS classes, not translated strings.
 * Requires only Vite on :3000 — the app degrades gracefully with the
 * backend down, so no API call is load-bearing for these flows.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:3000';
const ARTIFACTS_DIR = 'test-results/install-prompt';

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
});

/**
 * Dispatch a synthetic beforeinstallprompt. The handler stores the
 * event verbatim and hasUsable() requires a callable `prompt()` — a
 * plain Event would set the machine state but never qualify for the
 * banner (claimPrompt → hasInstallPrompt → hasUsable). userChoice is
 * attached so the accept path resolves like a real browser dialog.
 */
async function fireInstallPrompt(page, outcome = 'dismissed') {
  await page.evaluate((o) => {
    const ev = Object.assign(new Event('beforeinstallprompt'), {
      prompt: () => Promise.resolve(),
      userChoice: Promise.resolve({ outcome: o }),
    });
    window.dispatchEvent(ev);
  }, outcome);
}

/**
 * Satisfy the "good moment" engagement criterion (PROMPT_POLICY
 * requireEngagement): a synthetic scroll event flips the manager's
 * one-shot engagement listener; the 4s readiness timer then completes
 * the min-load wait.
 */
async function engage(page) {
  await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
}

/**
 * The manager notifies its subscribers on TWO moments: the event
 * capture and the readiness flip (4s). If React mounts the
 * InstallPrompt subscription AFTER the readiness notification (slow
 * CI boot — heavy Explore page + API calls), the claim would never be
 * attempted and the banner would never show. Waiting past the
 * readiness window and re-dispatching guarantees a post-readiness
 * notification so claimPrompt always runs.
 */
async function promptReady(page) {
  await page.waitForTimeout(4500); // past PROMPT_POLICY.minLoadMs (4000)
  await fireInstallPrompt(page);   // harmless re-_set(PROMPT_AVAILABLE) → notify
}

test.describe('[PWA] Install prompt banner', () => {
  test('banner appears once the prompt is captured and the good-moment criteria are met', async ({ page }) => {
    await page.goto(`${BASE}/`);
    await engage(page);
    await fireInstallPrompt(page);
    await promptReady(page); // 4s readiness + guaranteed post-ready notification

    await expect(page.locator('.pwa-install-banner')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.pwa-install-banner__btn--primary')).toBeVisible();
    await expect(page.locator('.pwa-install-banner__btn--secondary')).toBeVisible();

    // The manager must agree: prompt held + app not installed + the
    // session impression was claimed exactly once.
    const snap = await page.evaluate(() => window.__installationManager.getState());
    expect(snap.promptAvailable).toBe(true);
    expect(snap.installed).toBe(false);
    expect(snap.promptShown).toBe(true);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '01-banner-shown.png'),
      fullPage: true,
    });
  });

  test('dismiss hides the banner for the session AND writes the 7-day quiet-window marker', async ({ page }) => {
    await page.goto(`${BASE}/`);
    await engage(page);
    await fireInstallPrompt(page);
    await promptReady(page);
    await expect(page.locator('.pwa-install-banner')).toBeVisible({ timeout: 10_000 });

    // Dismiss ("Not now") — the banner unmounts immediately.
    await page.locator('.pwa-install-banner__btn--secondary').click();
    await expect(page.locator('.pwa-install-banner')).toHaveCount(0, { timeout: 5_000 });

    // The quiet-window marker is persisted for future visits.
    const ts = await page.evaluate(
      () => parseInt(localStorage.getItem('devrose_pwa_dismissed_at') || '0', 10),
    );
    expect(ts).toBeGreaterThan(0);

    // A reload (new session) with the marker set must NOT re-offer —
    // even when the browser hands us a fresh prompt again.
    await page.reload();
    await engage(page);
    await fireInstallPrompt(page);
    await promptReady(page); // claim would fire here if not for the quiet window
    await expect(page.locator('.pwa-install-banner')).toHaveCount(0);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '02-quiet-window-respected.png'),
      fullPage: true,
    });
  });

  test('accepting invokes the deferred prompt, hides the banner, and never falsifies the installed marker', async ({ page }) => {
    await page.goto(`${BASE}/`);
    await engage(page);
    await fireInstallPrompt(page, 'accepted');
    await promptReady(page);
    await expect(page.locator('.pwa-install-banner')).toBeVisible({ timeout: 10_000 });

    // "Install" → promptInstall → the deferred prompt resolves
    // accepted → the banner unmounts (state leaves PROMPT_AVAILABLE).
    await page.locator('.pwa-install-banner__btn--primary').click();
    await expect(page.locator('.pwa-install-banner')).toHaveCount(0, { timeout: 5_000 });

    // ACCEPTED is a UX outcome, NOT proof of installation — the
    // persisted marker must stay unset (only standalone detection
    // writes devrose_pwa_installed, see _acceptPrompt).
    const marker = await page.evaluate(() => localStorage.getItem('devrose_pwa_installed'));
    expect(marker).toBeNull();
    const snap = await page.evaluate(() => window.__installationManager.getState());
    expect(snap.installed).toBe(false);
    expect(snap.promptOutcome).toBe('accepted');
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '03-accepted.png'),
      fullPage: true,
    });
  });
});
