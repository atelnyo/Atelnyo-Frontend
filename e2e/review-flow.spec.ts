/**
 * e2e/review-flow.spec.ts
 *
 * Browser verification of REVIEW mode (ModuleSession with review=true):
 * a practice-only session over a completed module's blocks that NEVER
 * writes progress. The spec asserts:
 *   • the review header ("Revizyon · …")
 *   • completing a step does NOT call onComplete (no progress write)
 *   • the review-complete screen ("Revizyon fini!") with the honest
 *     "progress is unchanged" message
 *
 * Prerequisite: Vite dev server on :3000. Harness:
 * http://127.0.0.1:3000/e2e/review-harness.html
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS_DIR = 'test-results/review-flow';

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
});

test('review session practices without writing progress and completes', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/e2e/review-harness.html');

  const session = page.locator('.ls-session');
  await expect(session).toBeVisible({ timeout: 15_000 });

  // Review header + step counter.
  await expect(session.getByText('Revizyon · Modil Test')).toBeVisible();
  await expect(session.getByText('Etap 1 sou 1')).toBeVisible();

  // Complete the (single) vocabulary step.
  await session.getByPlaceholder('Tape mo a…').fill('mèsi');
  await session.getByRole('button', { name: 'Tcheke' }).click();
  await expect(session.getByText('Kòrèk!')).toBeVisible();

  // REVIEW MUST NOT WRITE PROGRESS — onComplete never fired.
  const wroteProgress = await page.evaluate(() => window.__reviewComplete ?? null);
  expect(wroteProgress).toBeNull();

  // Finish the review → review-complete screen.
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('Enter');
  await expect(session.getByText('Revizyon fini!')).toBeVisible();
  await expect(
    session.getByText('Ou revize 1 sou 1 etap. Pwogrè ou pa chanje — se pratik.'),
  ).toBeVisible();

  await session.screenshot({
    path: path.join(ARTIFACTS_DIR, '01-review-complete.png'),
    fullPage: true,
  });
});
