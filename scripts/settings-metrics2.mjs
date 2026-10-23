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
  const section = document.querySelector('.settings-section');
  const rows = [...section.children];
  const report = rows.map((row, i) => {
    const r = row.getBoundingClientRect();
    const s = getComputedStyle(row);
    // walk ancestors for transforms/rotations
    let anc = row; const ancFx = [];
    while (anc && anc !== document.body) {
      const ts = getComputedStyle(anc).transform;
      const cv = getComputedStyle(anc).transformOrigin;
      if (ts && ts !== 'none') ancFx.push({ cls: anc.className && anc.className.toString().slice(0, 60), transform: ts, origin: cv });
      anc = anc.parentElement;
    }
    return {
      i,
      cls: (row.className || '').toString().slice(0, 60),
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      transform: s.transform,
      margin: s.margin,
      ancestorsWithTransform: ancFx,
    };
  });
  return { rows: report };
});

console.log(JSON.stringify(diag, null, 2));
await browser.close();
