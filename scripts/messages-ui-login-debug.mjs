import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'https://atelnyo.site';
const USER = process.env.TEST_USER;
const PASS = process.env.TEST_PASSWORD;
if (!USER || !PASS) { console.error('TEST_USER / TEST_PASSWORD required'); process.exit(1); }

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text().slice(0, 160)); });
page.on('request', (r) => { if (r.method() !== 'GET') console.log('req:', r.method(), r.url().replace(/^https?:\/\/[^/]+/, '')); });
page.on('requestfailed', (r) => { if (r.method() !== 'GET') console.log('FAILED:', r.method(), r.url().replace(/^https?:\/\/[^/]+/, ''), '|', r.failure()?.errorText); });
page.on('response', (r) => { if (r.request().method() === 'POST') console.log('res:', r.status(), r.url(), r.headers()['access-control-allow-origin'] || 'NO-ACAO'); });

try {
  await page.addInitScript(() => {
    localStorage.setItem('atelnyo_cookie_consent', JSON.stringify({ version: '1.0', necessary: true, analytics: true, marketing: true, decidedAt: Date.now() }));
  });
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(3000);

  const inputs = await page.evaluate(() => [...document.querySelectorAll('input')]
    .map((i) => ({ type: i.type, id: i.id, name: i.name, visible: !!(i.offsetWidth || i.offsetHeight) })));
  console.log('inputs:', JSON.stringify(inputs));

  const ident = page.locator('#auth-login-identifier, input[name="identifier"], input[name="username"], input[type="email"]').first();
  await ident.fill(USER, { timeout: 10000 });
  const pwd = page.locator('input[type="password"]').first();
  await pwd.fill(PASS, { timeout: 10000 });

  const btns = await page.evaluate(() => [...document.querySelectorAll('button')]
    .map((b) => ({ type: b.type, text: (b.textContent || '').trim().slice(0, 30), visible: !!(b.offsetWidth || b.offsetHeight) })));
  console.log('buttons:', JSON.stringify(btns.filter((b) => b.visible)));

  await page.locator('form.auth-form button[type="submit"], form button[type="submit"]').first().click({ timeout: 10000 });
  await page.waitForTimeout(30000);
  console.log('after submit url:', page.url());
  await page.screenshot({ path: '/tmp/ui-login-1.png', fullPage: false });

  if (page.url().includes('/login') || page.url().includes('auth')) {
    // Retry: maybe validation toast. Capture the form state.
    const vals = await page.evaluate(() => [...document.querySelectorAll('input')]
      .map((i) => ({ id: i.id, value: i.value.slice(0, 8) })));
    console.log('field values:', JSON.stringify(vals));
  } else {
    await page.goto(BASE + '/sheet/messages', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(12000);
    console.log('messages url:', page.url());
    await page.screenshot({ path: '/tmp/msg-real-inbox.png', fullPage: true });
  }
} catch (e) {
  console.log('ERROR:', e.message.split('\n')[0]);
}
await browser.close();
