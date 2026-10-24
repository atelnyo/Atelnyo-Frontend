import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'https://atelnyo.site';
const USER = process.env.TEST_USER;
const PASS = process.env.TEST_PASSWORD;
const TAG = process.env.TAG || 'audit';

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
    // Login first if creds provided (gives the personalized feed).
    if (USER && PASS) {
      await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(2500);
      await page.locator('#auth-login-identifier').fill(USER);
      await page.locator('input[type="password"]').first().fill(PASS);
      await page.locator('form button[type="submit"]').first().click();
      await page.waitForTimeout(6000);
    }

    const measure = async (name, target) => {
      await page.goto(BASE + target, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(9000);
      const m = await page.evaluate(() => {
        const docW = document.documentElement;
        const overflowers = [...document.querySelectorAll('body *')]
          .filter((el) => { const r = el.getBoundingClientRect(); return (r.width > docW.clientWidth + 4 && (el.offsetParent || el === document.body)); })
          .slice(0, 6)
          .map((el) => `${el.className?.toString?.().slice(0, 50) || el.tagName} w=${Math.round(el.getBoundingClientRect().width)}`);
        return {
          vw: docW.clientWidth,
          scrollW: docW.scrollWidth,
          bodyH: docW.scrollHeight,
          overflow: docW.scrollWidth > docW.clientWidth,
          overflowers,
        };
      });
      console.log(`[${vp.name}] ${name}`, JSON.stringify(m));
      await page.screenshot({ path: `/tmp/resp-${TAG}-${vp.name}-${name}.png`, fullPage: false });
    };

    await measure('home-root', '/');
    // Explore is the home tab in the root — click Explore in bottom navbar if not logged-in view.
    const exploreBtn = page.locator('[data-testid="nav-explore"], .nav-item:has-text("Explore"), .nav-item:has-text("Eksplore")').first();
    if (await exploreBtn.count()) {
      await exploreBtn.click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(4000);
      const m = await page.evaluate(() => {
        const docW = document.documentElement;
        const overflowers = [...document.querySelectorAll('body *')]
          .filter((el) => { const r = el.getBoundingClientRect(); return (r.width > docW.clientWidth + 4 && el.offsetParent); })
          .slice(0, 6)
          .map((el) => `${el.className?.toString?.().slice(0, 50) || el.tagName} w=${Math.round(el.getBoundingClientRect().width)}`);
        return { vw: docW.clientWidth, scrollW: docW.scrollWidth, overflow: docW.scrollWidth > docW.clientWidth, overflowers };
      });
      console.log(`[${vp.name}] explore-tab`, JSON.stringify(m));
      await page.screenshot({ path: `/tmp/resp-${TAG}-${vp.name}-explore.png`, fullPage: false });
    }
  } catch (e) {
    console.log(`[${vp.name}] ERROR:`, e.message.split('\n')[0]);
  }
  await page.close();
}
await browser.close();
