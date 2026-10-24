import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'https://atelnyo.site';
const USER = process.env.TEST_USER;
const PASS = process.env.TEST_PASSWORD;

if (!USER || !PASS) { console.error('TEST_USER / TEST_PASSWORD required'); process.exit(1); }

const showPasswordInput = async (page) => {
  const userInput = page.locator('input[type="text"], input[type="email"], input[name="username"], input[name="email"]').first();
  const passInput = page.locator('input[type="password"]').first();
  await userInput.waitFor({ timeout: 15000 });
  await userInput.fill(USER);
  await passInput.fill(PASS);
};

const browser = await chromium.launch();
for (const vp of [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1280, height: 800 }]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.addInitScript(() => {
    localStorage.setItem('atelnyo_cookie_consent', JSON.stringify({ version: '1.0', necessary: true, analytics: true, marketing: true, decidedAt: Date.now() }));
  });
  const apiCalls = [];
  page.on('response', (r) => {
    const u = r.url();
    if (u.includes('messages') || u.includes('login') || u.includes('token') || u.includes('me/')) {
      apiCalls.push(`${r.request().method()} ${u.replace(/^https?:\/\/[^/]+/, '')} → ${r.status()}`);
    }
  });
  try {
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);
    await page.getByLabel('Email or Username', { exact: false }).or(page.locator('#auth-login-identifier')).first().fill(USER);
    await page.locator('input[type="password"]').first().fill(PASS);
    await page.locator('button[type="submit"]').first().click({ timeout: 8000 });
    await page.waitForTimeout(5000);
    console.log(`[${vp.name}] after login:`, page.url());

    await page.goto(BASE + '/sheet/messages', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(5000);
    console.log(`[${vp.name}] messages url:`, page.url());
    console.log(`[${vp.name}] api:`, apiCalls.slice(0, 10).join(' | ') || 'none');
    await page.screenshot({ path: `/tmp/msg-${vp.name}-inbox.png`, fullPage: true });

    // If a conversation exists, click it to open the chat
    const conv = page.locator('button[class*="conversation"], [class*="conversationItem"]').first();
    if (await conv.count()) {
      await conv.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `/tmp/msg-${vp.name}-chat.png`, fullPage: true });
    } else {
      console.log(`[${vp.name}] no conversation items visible`);
    }
  } catch (e) {
    console.log(`[${vp.name}] ERROR:`, e.message.split('\n')[0]);
  }
  await page.close();
}
await browser.close();
