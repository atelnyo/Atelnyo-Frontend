import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'https://atelnyo.site';
const TAG = process.env.TAG || 'prod';
const CATS = (process.env.CATS || 'appearance,language,security,legal,navigation,creator,account').split(',');
const logs = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  await page.addInitScript(() => {
    localStorage.setItem('atelnyo_cookie_consent', JSON.stringify({ version: '1.0', necessary: true, analytics: true, marketing: true, decidedAt: Date.now() }));
    localStorage.setItem('atelnyo_theme_color', '#d81b60');
  });
  await page.goto(BASE + '/sheet/settings', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(3000);

  for (const cat of CATS) {
    // Start from the hub every time — visible tiles only, no force clicks.
    const back = page.locator('[data-testid="settings-category-back"]').first();
    if ((await back.count()) && (await back.isVisible())) {
      await back.click({ timeout: 5000 });
      await page.waitForTimeout(600);
    }

    const tiles = page.locator(`[data-testid="settings-category-${cat}"]`);
    const n = await tiles.count();
    let clicked = false;
    for (let i = 0; i < n; i++) {
      const t = tiles.nth(i);
      if (await t.isVisible()) {
        await t.click({ timeout: 5000 });
        clicked = true;
        break;
      }
    }
    if (!clicked) { logs.push(`${cat}: no visible tile (${n} in DOM)`); continue; }
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `/tmp/cat-${TAG}-${cat}.png`, fullPage: true });
    logs.push(`${cat}: ✓`);
  }
} catch (e) {
  logs.push(`[script error] ${e.message.split('\n')[0]}`);
}
logs.forEach((l) => console.log(l));
await browser.close();
