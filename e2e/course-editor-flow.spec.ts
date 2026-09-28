/**
 * e2e/course-editor-flow.spec.ts
 *
 * Creator-side browser verification of the two new structure actions in
 * CourseEditor:
 *   1. Drag-and-drop reorders modules.
 *   2. "Kopye blòk yo" copies one module's blocks into another module
 *      (fresh ids) — structure reuse across modules.
 *
 * The editor's debounced autosave is stubbed (/api/courses/**) — no
 * backend needed. Selectors use data-testid (CSS-module classes are
 * hashed in dev).
 *
 * Prerequisite: Vite dev server on :3000. Harness:
 * http://127.0.0.1:3000/e2e/course-editor-harness.html
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS_DIR = 'test-results/course-editor-flow';

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
});

test('module drag-and-drop reorders, and block copy reuses structure across modules', async ({ page }) => {
  // Debounced autosave target (create mode → POST, then PUT).
  await page.route('**/api/courses/**', (route) => {
    const method = route.request().method();
    return route.fulfill({
      status: method === 'POST' ? 201 : 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 999 }),
    });
  });

  await page.goto('http://127.0.0.1:3000/e2e/course-editor-harness.html');
  const rows = page.locator('[data-testid="structure-row"]');
  await expect(rows).toHaveCount(0);
  await expect(page.getByText('Estrikti Kou')).toBeVisible({ timeout: 15_000 });

  // Two modules.
  await page.getByRole('button', { name: 'Ajoute yon modil' }).click();
  await page.getByRole('button', { name: 'Ajoute yon modil' }).click();
  await expect(rows).toHaveCount(2);
  await expect(page.getByText('Modil 1', { exact: true })).toBeVisible();
  await expect(page.getByText('Modil 2', { exact: true })).toBeVisible();

  // Add a repeat block to Modil 1 (select it, add practice, fill target).
  await page.getByText('Modil 1', { exact: true }).click();
  await page.getByRole('button', { name: 'Ajoute pratik' }).click();
  await page.getByRole('button', { name: /Repete apre m/ }).click();
  await page.getByPlaceholder(/chicken sandwich/).fill('bonjou kouman ou ye');
  await page.getByRole('button', { name: 'Ajoute blòk' }).click();
  await expect(page.getByText('bonjou kouman ou ye')).toBeVisible();

  // ─── Drag-and-drop: drag Modil 2's row onto Modil 1's row. ─────────
  const firstTitleBefore = await rows.nth(0).innerText();
  expect(firstTitleBefore).toContain('Modil 1');
  await rows.nth(1).dragTo(rows.nth(0));
  const firstTitleAfter = await rows.nth(0).innerText();
  expect(firstTitleAfter).toContain('Modil 2'); // swapped — Modil 2 first
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '01-modules-reordered.png') });

  // ─── Cross-module copy: Modil 1 is now the SECOND row — copy its
  //     blocks (the repeat block) INTO Modil 2 (first row). ───────────
  await rows.nth(1).getByRole('button', { name: 'Kopye blòk yo' }).click();
  await expect(page.getByText('Kopye 1 blòk yo nan:', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Modil 2', exact: true }).click();
  // Select Modil 2 (first row) → its editor now shows the copied block.
  await rows.nth(0).click();
  await expect(page.getByText('bonjou kouman ou ye')).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '02-block-copied.png') });
});
