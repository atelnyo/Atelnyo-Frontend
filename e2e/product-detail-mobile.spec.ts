/**
 * Mobile layout check for the marketplace product detail page (/marketplace/:id).
 *
 * The product API is mocked so the test does not depend on the database.
 * For each phone width we assert the document is not wider than the viewport
 * and that no visible element extends past the right edge.
 */
import { test, expect, type Page } from '@playwright/test';

const PRODUCT = {
  id: 201,
  title: 'Long Product Title For Mobile Layout Check With Many Words In It Without Spaces Supercalifragilisticexpialidocious',
  description: 'A long description. '.repeat(40),
  price: 19.99,
  currency: 'USD',
  kind: 'physical',
  image_url: 'https://placehold.co/1200x1200.png',
  gallery: [
    { url: 'https://placehold.co/1200x1200.png' },
    { url: 'https://placehold.co/1200x1200.png' },
    { url: 'https://placehold.co/1200x1200.png' },
    { url: 'https://placehold.co/1200x1200.png' },
  ],
  stock: 5,
  is_active: true,
  category: 'Apparel',
  sales_count: 3,
  avg_rating: 4.2,
  review_count: 4,
  seller_username: 'seller_one',
  creator_name: 'Seller With A Very Long Creator Name Here',
  tags: ['isometric-city-blue-cotton-tee', 'printed-on-demand'],
};

const VIEWPORTS = [
  { name: 'phone-360', width: 360, height: 740 },
  { name: 'phone-375', width: 375, height: 812 },
  { name: 'phone-414', width: 414, height: 896 },
];

async function mockApi(page: Page) {
  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [], count: 0 }),
    }),
  );
  await page.route('**/api/marketplace/products/201/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PRODUCT),
    }),
  );
}

test('buy button is visible in the first screen at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await mockApi(page);
  await page.goto('/marketplace/201', { waitUntil: 'domcontentloaded' });
  const bar = page.locator('.pd-price-card--sticky');
  await expect(bar).toBeAttached({ timeout: 20_000 });
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(300);
  const box = await bar.locator('.pd-cta-btn').boundingBox();
  expect(box, 'sticky buy button box').not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(740);

  // The bar spans the full width and is at least 20px tall.
  const barBox = await bar.boundingBox();
  expect(barBox, 'sticky buy bar box').not.toBeNull();
  expect(barBox!.width).toBeGreaterThanOrEqual(359);
  expect(barBox!.height).toBeGreaterThanOrEqual(20);
  expect(barBox!.y + barBox!.height).toBeCloseTo(740, 0);
});

for (const vp of VIEWPORTS) {
  test(`product detail has no horizontal overflow at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await mockApi(page);
    await page.goto('/marketplace/201', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="product-detail-sheet"]')).toBeVisible({ timeout: 20_000 });
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const report = await page.evaluate((width) => {
      const doc = document.documentElement;
      const offenders: string[] = [];
      document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const style = getComputedStyle(el);
        if (style.position === 'fixed') return;
        if (r.right > width + 1) {
          offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} right=${Math.round(r.right)}`);
        }
      });
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        offenders: offenders.slice(0, 15),
      };
    }, vp.width);

    expect(report.scrollWidth, JSON.stringify(report.offenders, null, 2)).toBeLessThanOrEqual(vp.width);
  });
}
