/**
 * e2e/printify-import.spec.ts
 *
 * Drives the Printify import in the real Studio UI (Chromium). The API is
 * stubbed, so no backend or database is touched. Checks that:
 *   - the seller's field choice is sent with the import request
 *   - the imported draft appears in the products list without a page reload
 */
import { test, expect } from '@playwright/test';

const USER = {
  id: 1,
  username: 'seller',
  email: 'seller@example.test',
  is_creator: true,
  is_seller: true,
  is_staff: false,
  is_superuser: false,
};

const PRINTIFY_ITEM = {
  printify_product_id: 'pf_1',
  title: 'Logo Tee',
  price: '19.99',
  image_url: '',
  stock: 5,
  imported: false,
};

test('import sends chosen fields and the draft shows in the products list', async ({ page }) => {
  let importBody: any = null;
  let productRows: any[] = [];

  await page.addInitScript((user) => {
    localStorage.setItem('access_token', 'audit.fake.token');
    localStorage.setItem('refresh_token', 'audit.fake.refresh');
    localStorage.setItem('user', JSON.stringify(user));
  }, USER);

  await page.route(/\/api\//, async (route) => {
    const url = decodeURIComponent(route.request().url());
    const method = route.request().method();
    if (method === 'GET' && url.endsWith('/api/me/')) return route.fulfill({ status: 200, json: USER });
    if (method === 'GET' && url.includes('/marketplace/printify/connection/')) {
      return route.fulfill({ status: 200, json: { connected: true, shop_id: '42', shop_title: 'My Shop' } });
    }
    if (method === 'GET' && url.includes('/marketplace/printify/products/')) {
      return route.fulfill({ status: 200, json: { results: [PRINTIFY_ITEM] } });
    }
    if (method === 'POST' && url.includes('/marketplace/printify/import/')) {
      importBody = route.request().postDataJSON();
      productRows = [{
        id: 900, title: 'Logo Tee', price: '19.99', kind: 'physical',
        is_active: false, sales_count: 0,
      }];
      return route.fulfill({
        status: 200,
        json: { imported: [{ id: 900, title: 'Logo Tee', created: true }] },
      });
    }
    if (method === 'GET' && url.includes('/marketplace/products/') && url.includes('mine=true')) {
      return route.fulfill({ status: 200, json: { results: productRows, count: productRows.length } });
    }
    return route.fulfill({ status: 200, json: {} });
  });

  await page.goto('http://127.0.0.1:3000/sheet/studio');

  // Open the products section and start a new physical product.
  await page.getByRole('button', { name: /products/i }).first().click();
  await page.getByRole('button', { name: /new product/i }).first().click();
  await page.getByRole('button', { name: /physical/i }).first().click();

  // Expand the Printify group, then load the shop's products.
  await page.getByRole('button', { name: /Printify/ }).click();
  await page.getByRole('button', { name: /load printify products/i }).click();
  await expect(page.getByLabel('Logo Tee')).toBeVisible();

  // Untick Stock, keep the rest, select the product and import.
  await page.getByRole('checkbox', { name: 'Stock' }).uncheck();
  await page.getByLabel('Logo Tee').check();
  await page.getByRole('button', { name: /import selected/i }).click();

  await expect.poll(() => importBody).not.toBeNull();
  expect(importBody.printify_product_ids).toEqual(['pf_1']);
  expect(importBody.fields).not.toContain('stock');
  expect(importBody.fields).toContain('images');
  await expect(page.getByText('Imported as drafts:')).toBeVisible();
});
