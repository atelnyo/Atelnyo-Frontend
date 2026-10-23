import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4173';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript(() => {
  localStorage.setItem('atelnyo_cookie_consent', JSON.stringify({ version: '1.0', necessary: true, analytics: true, marketing: true, decidedAt: Date.now() }));
});
await page.goto(BASE + '/sheet/settings', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(3000);

const tiles = page.locator('[data-testid="settings-category-appearance"]');
let n = await tiles.count(); let clicked = false;
for (let i = 0; i < n; i++) { const t = tiles.nth(i); if (await t.isVisible()) { await t.click({ timeout: 5000 }); clicked = true; break; } }
if (!clicked) throw new Error('no visible appearance tile');
await page.waitForTimeout(1200);

const diag = await page.evaluate(() => {
  const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const section = document.querySelector('.settings-section');
  const pick = (row) => {
    const out = { row: rect(row), children: [] };
    [...row.querySelectorAll(':scope > *')].forEach((c) => {
      const s = getComputedStyle(c);
      out.children.push({ cls: c.className.toString().slice(0, 50), rect: rect(c), position: s.position, marginLeft: s.marginLeft, transform: s.transform, fontSize: s.fontSize });
      [...c.querySelectorAll(':scope > *')].slice(0, 4).forEach((gc) => {
        const gs = getComputedStyle(gc);
        out.children.push({ cls: '·' + gc.className.toString().slice(0, 50), rect: rect(gc), position: gs.position, marginLeft: gs.marginLeft, transform: gs.transform });
      });
    });
    return out;
  };
  return [...section.children].slice(0, 6).map(pick);
});

console.log(JSON.stringify(diag, null, 2));
await browser.close();
