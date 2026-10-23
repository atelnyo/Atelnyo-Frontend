import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const logs = [];

const browser = await chromium.launch();

for (const [name, width, height] of [['mobile', 390, 844], ['desktop', 1366, 900]]) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('console', (m) => { if (m.type() === 'error') logs.push(`[${name}] ${m.text()}`); });
  try {
    await page.addInitScript(() => {
      localStorage.setItem('atelnyo_cookie_consent', JSON.stringify({ version: '1.0', necessary: true, analytics: true, marketing: true, decidedAt: Date.now() }));
    });
    await page.goto(BASE + '/sheet/settings', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `/tmp/settings-${name}-1-open.png`, fullPage: false });

    // Click the Language category tile by its stable test id
    const langTile = page.locator('[data-testid="settings-category-language"]').first();
    const tileCount = await langTile.count();
    logs.push(`[${name}] lang tile count=${tileCount}`);
    if (tileCount > 0) {
      await langTile.click({ timeout: 8000, force: true }).catch((e) => logs.push(`[${name}] tile click failed: ${e.message.split('\n')[0]}`));
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `/tmp/settings-${name}-2-language.png`, fullPage: true });
    }
  } catch (e) {
    logs.push(`[${name}] ${e.message.split('\n')[0]}`);
  }
  await page.close();
}

console.log(logs.join('\n') || 'no logs');
await browser.close();
