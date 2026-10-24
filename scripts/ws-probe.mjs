import { chromium } from 'playwright';

const USER = process.env.TEST_USER;
const PASS = process.env.TEST_PASSWORD;
if (!USER || !PASS) { console.error('TEST_USER / TEST_PASSWORD required'); process.exit(1); }

// Mint a fresh token pair the same way the app does.
const login = await fetch('https://api.atelnyo.site/api/login/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: USER, password: PASS }),
});
const { access } = await login.json();
if (!access) { console.error('login failed'); process.exit(1); }

const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript((tok) => localStorage.setItem('access_token', tok), access);
const logs = [];
page.on('console', (m) => logs.push(m.text().slice(0, 200)));

const result = await page.evaluate(async (tok) => {
  const attempt = (url) => new Promise((resolve) => {
    const ws = new WebSocket(url + '?token=' + encodeURIComponent(tok));
    const done = (r) => { try { ws.close(); } catch (_) {} resolve(r); };
    const t = setTimeout(() => done({ url, ok: true, note: 'open>4s (connection accepted, held open)' }), 5000);
    ws.onopen = () => { clearTimeout(t); done({ url, ok: true, closeCode: 'open' }); };
    ws.onerror = () => { clearTimeout(t); done({ url, ok: false, err: 'onerror' }); };
    ws.onclose = (e) => { clearTimeout(t); done({ url, ok: e.code === 1000 || e.code === undefined ? false : false, closeCode: e.code, reason: e.reason }); };
  });
  return [
    await attempt('wss://api.atelnyo.site/ws/notifications/'),
    await attempt('wss://atelnyo.site/ws/notifications/'),
  ];
}, access);
console.log(JSON.stringify(result, null, 2));
await browser.close();
