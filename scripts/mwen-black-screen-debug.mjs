import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const out = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') out.push(`[console.${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => out.push(`[pageerror] ${e.message}`));

await page.addInitScript(() => {
  localStorage.setItem('atelnyo_cookie_consent', JSON.stringify({ version: '1.0', necessary: true, analytics: true, marketing: true, decidedAt: Date.now() }));
});
await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
await page.screenshot({ path: '/tmp/mwen-debug-1-home.png' });

// Click the Mwen tab in the bottom navbar
const mwenBtn = page.locator('[data-testid="mwen-nav-item"]');
await mwenBtn.click();
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/mwen-debug-2-mwen.png' });

const state = await page.evaluate(() => ({
  url: location.href,
  bodyChildren: document.body.children.length,
  bodyBg: getComputedStyle(document.body).backgroundColor,
  hasMain: !!document.querySelector('#a11y-main-content'),
  mainChildCount: document.querySelector('#a11y-main-content')?.children.length ?? -1,
  mainTextSample: (document.querySelector('#a11y-main-content')?.innerText || '').slice(0, 200),
  visibleRoots: Array.from(document.body.children).map((c) => ({
    tag: c.tagName, cls: (c.className || '').toString().slice(0, 60),
    bg: getComputedStyle(c).backgroundColor, display: getComputedStyle(c).display,
  })),
}));

// Click each bottom-nav item while on the mwen page and screenshot each
const tabs = ['#a11y-main-content'];
const bottomItems = page.locator('.bottom-nav-bar .bottom-nav-item');
const n = await bottomItems.count();
for (let i = 0; i < n; i++) {
  await bottomItems.nth(i).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `/tmp/mwen-debug-3-tab-${i}.png` });
  const st = await page.evaluate(() => ({
    url: location.href,
    mainChildren: document.querySelector('#a11y-main-content')?.children.length ?? -1,
    text: (document.querySelector('#a11y-main-content')?.innerText || '').slice(0, 100),
  }));
  out.push(`TAB ${i} → ${JSON.stringify(st)}`);
}

console.log('=== STATE after clicking Mwen ===');
console.log(JSON.stringify(state, null, 2));
console.log('=== LOGS ===');
out.forEach((l) => console.log(l));

await browser.close();
