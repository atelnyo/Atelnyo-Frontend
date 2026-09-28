/**
 * e2e/editor-flow.spec.ts
 *
 * Creator-side browser verification of the NEW Duplicate action in the
 * LanguagePracticeEditor: clicking "Doublike" on a block inserts an
 * exact copy (fresh id, "(kopye)" title suffix) right after the
 * original — the fastest way to build a variation.
 *
 * No backend needed — the harness holds the blocks in local state.
 *
 * Prerequisite: Vite dev server on :3000. Harness:
 * http://127.0.0.1:3000/e2e/editor-harness.html
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS_DIR = 'test-results/editor-flow';

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
});

test('duplicate inserts a copy right after the original block', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/e2e/editor-harness.html');

  // The two original rows render.
  await expect(page.getByText('Repete 1', { exact: true })).toBeVisible();
  await expect(page.getByText('Vokabilè 1', { exact: true })).toBeVisible();

  // Duplicate the FIRST block (Repete 1).
  await page.getByRole('button', { name: 'Doublike' }).first().click();
  await expect(page.getByText('Repete 1 (kopye)')).toBeVisible();
  await expect(page.getByText('Vokabilè 1 (kopye)')).toHaveCount(0);

  // The copy sits between the original and the second block (its own
  // row, inserted right after the source).
  const repete = await page.getByText('Repete 1', { exact: true }).boundingBox();
  const copy = await page.getByText('Repete 1 (kopye)').boundingBox();
  const vok = await page.getByText('Vokabilè 1', { exact: true }).boundingBox();
  expect(copy).not.toBeNull();
  expect(repete).not.toBeNull();
  expect(vok).not.toBeNull();
  expect(copy.y).toBeGreaterThan(repete.y);
  expect(copy.y).toBeLessThan(vok.y);

  // Duplicate the LAST block (Vokabilè 1) too → its copy follows it.
  await page.getByRole('button', { name: 'Doublike' }).last().click();
  await expect(page.getByText('Vokabilè 1 (kopye)')).toBeVisible();
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, '01-duplicated-blocks.png'),
    fullPage: true,
  });
});

test('drag-and-drop reorders blocks', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/e2e/editor-harness.html');

  const repete = await page.getByText('Repete 1', { exact: true }).boundingBox();
  const vok = await page.getByText('Vokabilè 1', { exact: true }).boundingBox();
  expect(vok.y).toBeGreaterThan(repete.y); // Vokabilè is BELOW Repete

  // Drag Vokabilè's row onto Repete's row → order swaps.
  const rows = page.locator('[data-testid="block-row"]');
  await rows.nth(1).dragTo(rows.nth(0));

  const repeteAfter = await page.getByText('Repete 1', { exact: true }).boundingBox();
  const vokAfter = await page.getByText('Vokabilè 1', { exact: true }).boundingBox();
  expect(vokAfter.y).toBeLessThan(repeteAfter.y); // Vokabilè is now ABOVE
});
