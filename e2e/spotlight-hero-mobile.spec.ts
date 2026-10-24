/**
 * Mobile layout check for the Spotlight detail hero (/sheet/spotlight/:id).
 *
 * The spotlight API is mocked with a very long title so the test does not
 * depend on the database. The gradient stage must grow to contain the text,
 * and the text must not escape the stage at 360px.
 */
import { test, expect, type Page } from '@playwright/test';

const LONG_TITLE = 'Atelnyo Academy — Platfòm Kreyatè Ayisyen. '.repeat(8);

const PAYLOAD = {
  id: 301,
  invention_title: LONG_TITLE,
  category: 'other',
  status: 'approved',
  display_name: 'Atelnyo Academy',
  username: 'atelnyo',
  description: 'Description.',
  logo_url: 'https://placehold.co/240x240.png',
  image_url: '',
};

async function mockApi(page: Page) {
  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [], count: 0 }),
    }),
  );
  await page.route('**/api/spotlight/301/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PAYLOAD),
    }),
  );
}

test('spotlight hero background covers a long title at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await mockApi(page);
  await page.goto('/sheet/spotlight/301', { waitUntil: 'domcontentloaded' });
  const stage = page.locator('[data-spotlight-page] .cd-hero');
  const title = page.locator('[data-spotlight-page] .cd-hero-title');
  // Auto-waiting assertion: the title only exists once the payload has rendered.
  await expect(title).toBeVisible({ timeout: 20_000 });
  await expect(stage).toBeVisible();

  const stageBox = await stage.boundingBox();
  const titleBox = await title.boundingBox();
  expect(stageBox, 'hero stage box').not.toBeNull();
  expect(titleBox, 'hero title box').not.toBeNull();

  // Title sits fully inside the gradient stage, with breathing room below it.
  expect(titleBox!.y).toBeGreaterThanOrEqual(stageBox!.y);
  expect(titleBox!.y + titleBox!.height).toBeLessThanOrEqual(stageBox!.y + stageBox!.height);
  expect(stageBox!.y + stageBox!.height - (titleBox!.y + titleBox!.height)).toBeGreaterThanOrEqual(24);
});
