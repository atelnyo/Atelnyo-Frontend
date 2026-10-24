/**
 * Mobile layout check for the talent detail hero (/:id/by/:user/talent).
 *
 * The talent API is mocked with a long name, role, location and bio so the
 * test does not depend on the database. At 360px the title must sit inside
 * the gradient stage, the "View Profile" button must be the element under
 * its own centre (not covered), and the first card must start below it.
 */
import { test, expect, type Page } from '@playwright/test';

const TALENT = {
  id: 401,
  name: 'E2E Test Talent With A Long Display Name For Mobile',
  role: 'E2E Test Role — Senior Creative Developer And Designer',
  location: 'Test City, Long Province Name',
  bio: 'Biography text. '.repeat(30),
  avatar: 'https://placehold.co/280x280.png',
  is_featured: true,
  is_new: false,
  linked_username: 'e2e_bob',
  created_at: '2026-01-01T00:00:00Z',
};

async function mockApi(page: Page) {
  // Pre-accept the cookie banner, a fixed overlay that covers the page.
  await page.addInitScript(() => {
    localStorage.setItem(
      'atelnyo_cookie_consent',
      JSON.stringify({ version: '1.0', necessary: true, analytics: false, marketing: false, timestamp: Date.now() }),
    );
  });
  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [], count: 0 }),
    }),
  );
  await page.route('**/api/explore/talents/401/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TALENT),
    }),
  );
}

test('talent hero keeps title, avatar and profile button clear of the cards at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await mockApi(page);
  await page.goto('/401/by/e2e_bob/talent', { waitUntil: 'domcontentloaded' });

  const stage = page.locator('section.cd-hero--talent');
  const title = stage.locator('.cd-hero-title');
  await expect(title).toBeVisible({ timeout: 20_000 });
  await expect(stage).toBeVisible();

  const button = page.locator('.cd-body-inner button', { hasText: /Gade Pwofil|View Profile|Voir le profil|Ver perfil/ });
  await expect(button).toBeVisible();

  const stageBox = await stage.boundingBox();
  const titleBox = await title.boundingBox();
  const buttonBox = await button.boundingBox();
  const firstCardBox = await page.locator('.cd-body-inner > section.cd-section').first().boundingBox();
  expect(stageBox && titleBox && buttonBox && firstCardBox).toBeTruthy();

  // Title sits fully inside the gradient stage.
  expect(titleBox!.y).toBeGreaterThanOrEqual(stageBox!.y);
  expect(titleBox!.y + titleBox!.height).toBeLessThanOrEqual(stageBox!.y + stageBox!.height);

  // The button is the element at its own centre (nothing covers it).
  const hitIsButton = await button.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && el.contains(hit);
  });
  expect(hitIsButton).toBe(true);

  // The first card starts below the button, with a visible gap.
  expect(firstCardBox!.y).toBeGreaterThanOrEqual(buttonBox!.y + buttonBox!.height + 12);
});
