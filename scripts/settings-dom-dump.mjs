import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4173';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript(() => {
  localStorage.setItem('atelnyo_cookie_consent', JSON.stringify({ version: '1.0', necessary: true, analytics: true, marketing: true, decidedAt: Date.now() }));
});
await page.goto(BASE + '/sheet/settings', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(3000);

const tiles = page.locator('[data-testid="settings-category-appearance"]');
let n = await tiles.count(); let clicked = false;
for (let i = 0; i < n; i++) { const t = tiles.nth(i); if (await t.isVisible()) { await t.click({ timeout: 5000 }); clicked = true; break; } }
if (!clicked) throw new Error('no visible appearance tile');
await page.waitForTimeout(1200);

const out = await page.evaluate(() => {
  const lefts = document.querySelectorAll('.settings-item-left').length;
  const items = document.querySelectorAll('.settings-item').length;
  const iconWraps = document.querySelectorAll('.settings-item-icon').length;
  const first = document.querySelector('.settings-item');
  const second = document.querySelectorAll('.settings-item')[1];
  return {
    counts: { lefts, items, iconWraps },
    first: first ? first.outerHTML.slice(0, 600) : null,
    second: second ? second.outerHTML.slice(0, 300) : null,
  };
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
