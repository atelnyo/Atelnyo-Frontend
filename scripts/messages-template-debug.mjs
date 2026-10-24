import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'https://atelnyo.site';
const API = 'https://api.atelnyo.site';

const TOKEN = process.env.TOKEN;
const REFRESH = process.env.REFRESH;
if (!TOKEN || !REFRESH) { console.error('TOKEN / REFRESH env required'); process.exit(1); }

const CONVS = [
  { id: 1, participant_id: 10, participant_name: 'Marie-Jeanne Delva', unread_count: 2, last_message: 'Bon, sa fè plezi! Ann pale sou atelye a.', last_message_at: '2026-10-22T18:20:00Z' },
  { id: 2, participant_id: 11, participant_name: 'Jean Baptiste', unread_count: 0, last_message: 'Mesi pou leson desin ou a 😊', last_message_at: '2026-10-21T09:15:00Z' },
  { id: 3, participant_id: 12, participant_name: 'Kelinske Studio', unread_count: 1, last_message: 'Kite m regarde pwodwi ou yo demen matin.', last_message_at: '2026-10-20T22:40:00Z' },
];
const THREAD = {
  1: [
    { id: 101, sender_id: 10, body: 'Bonswa! Mwen la vle pran yon kou mandjen.', subject: 'Leson pou kòmansan?', created_at: '2026-10-22T17:00:00Z' },
    { id: 102, sender_id: 480018, body: 'Bonswa! Byenveni 🎨 ki nivo ou ye kounye a?', created_at: '2026-10-22T17:12:00Z' },
    { id: 103, sender_id: 10, body: 'Mwen kòmansan toutbonn. Eske ou ka eksplike chemine a pou yon etidyan ki pa gen okenn eksperyans? Bon, sa fè plezi! Ann pale sou atelye a — mwen gen lakè? M ap tann repons ou anpil n anpil.', created_at: '2026-10-22T18:20:00Z' },
  ],
  2: [
    { id: 201, sender_id: 11, body: 'Mesi pou leson desin ou a 😊', created_at: '2026-10-21T09:15:00Z' },
  ],
  3: [
    { id: 301, sender_id: 12, body: 'Kite m regarde pwodwi ou yo demen matin.', created_at: '2026-10-20T22:40:00Z' },
  ],
};

const browser = await chromium.launch();
for (const vp of [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1280, height: 800 }]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.addInitScript(() => {
    localStorage.setItem('atelnyo_cookie_consent', JSON.stringify({ version: '1.0', necessary: true, analytics: true, marketing: true, decidedAt: Date.now() }));
    localStorage.setItem('access_token', TOKEN);
    localStorage.setItem('refresh_token', REFRESH);
    localStorage.setItem('user', JSON.stringify({ id: 480018, username: 'atel', display_name: 'atel', is_creator: false }));
  });
  await page.route('**/api/messages/conversations/**', (route) => {
    const url = route.request().url();
    const body = route.request().postDataJSON();
    if (url.endsWith('unread-count/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ unread_count: 3 }) });
    if (url.endsWith('conversations/') && route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CONVS) });
    }
    const m = url.match(/conversations\/(\d+)\/messages\//);
    if (m) {
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 400, sender_id: 480018, body: body?.body || '...', created_at: new Date().toISOString() }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(THREAD[Number(m[1])] || []) });
    }
    return route.continue();
  });
  const measurer = (r) => { if (/\/api\/(me|login|token|refresh)/.test(r.url())) console.log(`[${vp.name}] api:`, r.request().method(), r.url().replace(/^https?:\/\/[^/]+/, ''), '→', r.status()); };
  page.on('response', measurer);
  try {
    // Boot the app on home first so the session + user state resolve,
    // then navigate to the gated messages route.
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(6000);
    await page.goto(BASE + '/sheet/messages', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4500);
    console.log(`[${vp.name}] url:`, page.url(), '| user:', await page.evaluate(() => (localStorage.getItem('user') || 'null').slice(0, 40)));
    await page.screenshot({ path: `/tmp/msgtpl-${vp.name}-inbox.png`, fullPage: true });
    const conv = page.locator('button, [class*="conversationItem"]').filter({ hasText: 'Marie-Jeanne' }).first();
    await conv.click({ timeout: 8000 }).catch((e) => console.log(`[${vp.name}] conv click:`, e.message.split('\n')[0]));
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `/tmp/msgtpl-${vp.name}-chat.png`, fullPage: true });
  } catch (e) {
    console.log(`[${vp.name}] ERROR:`, e.message.split('\n')[0]);
  }
  await page.close();
}
await browser.close();
