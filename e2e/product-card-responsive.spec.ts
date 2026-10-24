/**
 * Responsive check for the marketplace ProductCard on /explore.
 *
 * The /api/explore/recommended/all/ response is mocked so the test does not
 * depend on the database. For each viewport we assert that every product
 * card sits inside the viewport and that its text does not overflow its box.
 */
import { test, expect, devices, type Page } from '@playwright/test';

const PRODUCTS = [
  {
    id: 101,
    title: 'Logo Tee — Premium Cotton Unisex Crewneck With A Very Long Product Name',
    description: 'Soft cotton tee printed on demand with a very long description that keeps going past the card limit.',
    price: 12.5,
    currency: 'USD',
    kind: 'physical',
    image_url: '',
    stock: 3,
    is_active: true,
    category: 'Apparel',
    sales_count: 14,
    avg_rating: 4.5,
    review_count: 8,
    seller_username: 'seller_one',
    creator_name: 'Seller With A Long Creator Name',
  },
  {
    id: 102,
    title: 'Digital Pack',
    description: 'Short.',
    price: 0,
    currency: 'USD',
    kind: 'digital',
    image_url: '',
    stock: null,
    is_active: true,
    category: 'Design',
    sales_count: 0,
    seller_username: 'seller_two',
  },
];

const VIEWPORTS = [
  { name: 'phone-360', width: 360, height: 740 },
  { name: 'phone-412', width: 412, height: 915 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 800 },
];

async function mockExplore(page: Page) {
  // The backend is not running in this test: answer every other API call with
  // an empty 200 so the page renders instead of showing "Could not load catalog".
  // Routes registered later take precedence, so the product mock below wins.
  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [], count: 0 }),
    }),
  );
  // Marketplace rail (Explore → marketplaceService.list → marketplace/products/).
  await page.route('**/api/marketplace/products/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: PRODUCTS, count: PRODUCTS.length }),
    }),
  );
  await page.route('**/api/explore/recommended/all/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: PRODUCTS.map((p) => ({ ...p, item_type: 'product' })),
        count: PRODUCTS.length,
      }),
    }),
  );
}

for (const vp of VIEWPORTS) {
  test(`product cards fit the viewport at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await mockExplore(page);
    await page.goto('/explore', { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'Market' }).click();

    const cards = page.locator('#explore-marketplace .explore-card-product');
    await expect(cards.first()).toBeVisible({ timeout: 20_000 });
    const count = await cards.count();
    expect(count).toBe(PRODUCTS.length);

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const box = await card.boundingBox();
      expect(box, `card ${i} has a box`).not.toBeNull();
      // Card must not be wider than the viewport.
      expect(box!.width, `card ${i} width <= viewport`).toBeLessThanOrEqual(vp.width);

      // Text / buy button must not overflow the card horizontally.
      const overflow = await card.evaluate((el) => {
        const cardRect = el.getBoundingClientRect();
        const bad: string[] = [];
        el.querySelectorAll<HTMLElement>(
          '.explore-card-title, .explore-card-subtitle, .explore-card-tag, .explore-product-buy-btn, .explore-card-price',
        ).forEach((node) => {
          const r = node.getBoundingClientRect();
          if (r.right > cardRect.right + 1 || r.left < cardRect.left - 1) {
            bad.push(`${node.className} right=${Math.round(r.right)} cardRight=${Math.round(cardRect.right)}`);
          }
        });
        return bad;
      });
      expect(overflow, `card ${i} overflow: ${overflow.join('; ')}`).toEqual([]);
    }
  });
}

// Android emulation: Pixel 5 (touch, mobile user agent, 393px wide).
test.describe('Android Pixel 5', () => {
  test('product cards fit the viewport on Android Pixel 5', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ ...devices['Pixel 5'], baseURL });
    const page = await context.newPage();
    try {
      await mockExplore(page);
      await page.goto('/explore', { waitUntil: 'domcontentloaded' });
      await page.getByRole('tab', { name: 'Market' }).click();

      const cards = page.locator('#explore-marketplace .explore-card-product');
      await expect(cards.first()).toBeVisible({ timeout: 20_000 });
      expect(await cards.count()).toBe(PRODUCTS.length);

      const vpWidth = await page.evaluate(() => window.innerWidth);
      for (let i = 0; i < PRODUCTS.length; i++) {
        const box = await cards.nth(i).boundingBox();
        expect(box, `card ${i} has a box`).not.toBeNull();
        expect(box!.width, `card ${i} width <= viewport`).toBeLessThanOrEqual(vpWidth);
      }
    } finally {
      await context.close();
    }
  });
});
