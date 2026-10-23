import { chromium } from 'playwright';

const BASE = 'https://atelnyo.site';
const logs = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

page.on('console', (m) => {
  if (m.type() === 'error') logs.push(`[console.error] ${m.text()}`);
});
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

try {
  await page.addInitScript(() => {
    localStorage.setItem('atelnyo_cookie_consent', JSON.stringify({ version: '1.0', necessary: true, analytics: true, marketing: true, decidedAt: Date.now() }));
  });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: '/tmp/live-1-home.png' });

  const mwenBtn = page.locator('[data-testid="mwen-nav-item"]');
  const count = await mwenBtn.count();
  logs.push(`mwen-nav-item count=${count}`);
  if (count === 0) {
    logs.push('visible nav buttons: ' + (await page.locator('.bottom-nav-bar .bottom-nav-item').count()));
  } else {
    await mwenBtn.click({ timeout: 15000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/live-2-mwen.png' });
    const st = await page.evaluate(() => ({
      url: location.href,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      htmlBg: getComputedStyle(document.documentElement).backgroundColor,
      mainChildren: document.querySelector('#a11y-main-content')?.children.length ?? -1,
      mainText: (document.querySelector('#a11y-main-content')?.innerText || '').slice(0, 150),
      rootChildren: (document.getElementById('root') || document.body).children.length,
    }));
    logs.push('STATE: ' + JSON.stringify(st, null, 2));
  }
} catch (e) {
  logs.push(`[script error] ${e.message}`);
}

console.log('=== LIVE PRODUCTION LOGS ===');
logs.forEach((l) => console.log(l));
await browser.close();
