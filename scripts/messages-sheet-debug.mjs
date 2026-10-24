import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'https://atelnyo.site';
const TAG = 'messages';

const browser = await chromium.launch();
for (const vp of [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1280, height: 800 }]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.addInitScript(() => {
    localStorage.setItem('atelnyo_cookie_consent', JSON.stringify({ version: '1.0', necessary: true, analytics: true, marketing: true, decidedAt: Date.now() }));
  });
  const responses = [];
  page.on('response', (r) => { if (r.url().includes('api.')) responses.push(r.request().method() + ' ' + r.url().replace(/^https?:\/\/[^/]+/, '') + ' → ' + r.status()); });
  await page.goto(BASE + '/sheet/messages', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(4000);
  console.log(`[${vp.name}] url after load:`, page.url());
  console.log(`[${vp.name}] api calls:`, responses.slice(0, 6).join(' | ') || 'none');
  await page.screenshot({ path: `/tmp/${TAG}-${vp.name}.png`, fullPage: true });
  await page.close();
}
await browser.close();
