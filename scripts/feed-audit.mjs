import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'https://atelnyo.site';
const USER = process.env.TEST_USER;
const PASS = process.env.TEST_PASSWORD;
const TAG = process.env.TAG || 'feed2';

const VIEWPORTS = [
  { name: 'phone-sm', width: 360, height: 780 },
  { name: 'phone-lg', width: 414, height: 896 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'desktop', width: 1920, height: 1080 },
];

const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.addInitScript(() => {
    localStorage.setItem('atelnyo_cookie_consent', JSON.stringify({ version: '1.0', necessary: true, analytics: true, marketing: true, decidedAt: Date.now() }));
  });
  try {
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);
    await page.locator('#auth-login-identifier').fill(USER);
    await page.locator('input[type="password"]').first().fill(PASS);
    await page.locator('form button[type="submit"]').first().click();
    await page.waitForTimeout(7000);
    console.log(`[${vp.name}] post-login url:`, page.url());

    // Client-side navigation — keeps React state (no full reload).
    const spaNav = (path) => page.evaluate((p) => {
      window.history.pushState({}, '', p);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, path);

    const snap = async (name, waitMs) => {
      await page.waitForTimeout(waitMs);
      const m = await page.evaluate(() => {
        const docW = document.documentElement;
        const overflowers = [...document.querySelectorAll('body *')]
          .filter((el) => { const r = el.getBoundingClientRect(); return (r.width > docW.clientWidth + 4 && el.offsetParent); })
          .slice(0, 6)
          .map((el) => `${el.className?.toString?.().slice(0, 50) || el.tagName} w=${Math.round(el.getBoundingClientRect().width)}`);
        return { vw: docW.clientWidth, scrollW: docW.scrollWidth, overflow: docW.scrollWidth > docW.clientWidth, overflowers };
      });
      console.log(`[${vp.name}] ${name}`, JSON.stringify(m), 'url:', page.url());
      await page.screenshot({ path: `/tmp/resp-${TAG}-${vp.name}-${name}.png`, fullPage: false });
    };

    await spaNav('/sheet/deie/feed');
    await snap('deie-feed', 9000);
    await spaNav('/');
    await snap('root-home', 3000);
    const mwen = page.locator('.nav-item:has-text("Mwen"), [data-testid="nav-mwen"]').first();
    if (await mwen.count()) { await mwen.click({ timeout: 5000 }).catch(() => {}); }
    await snap('mwen-tab', 6000);
  } catch (e) {
    console.log(`[${vp.name}] ERROR:`, e.message.split('\n')[0]);
  }
  await page.close();
}
await browser.close();
