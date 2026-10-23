import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4173';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript(() => {
  localStorage.setItem('atelnyo_cookie_consent', JSON.stringify({ version: '1.0', necessary: true, analytics: true, marketing: true, decidedAt: Date.now() }));
});
await page.goto(BASE + '/sheet/settings', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(3000);

const tiles = page.locator('[data-testid="settings-category-storage"]');
let n = await tiles.count(); let clicked = false;
for (let i = 0; i < n; i++) { const t = tiles.nth(i); if (await t.isVisible()) { await t.click({ timeout: 5000 }); clicked = true; break; } }
if (!clicked) throw new Error('no visible storage tile');
await page.waitForTimeout(2000);

const diag = await page.evaluate(() => {
  const panel = document.querySelector('.settings-section .stg-panel');
  if (!panel) return null;
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const out = [];
  panel.querySelectorAll('*').forEach((el) => {
    const r = rect(el);
    if (r.y < 560 && r.w > 0) out.push({ cls: el.className.toString().slice(0, 70), ...r, txt: (el.textContent || '').trim().slice(0, 40) });
  });
  return out;
});
console.log(JSON.stringify(diag, null, 2));
await browser.close();
