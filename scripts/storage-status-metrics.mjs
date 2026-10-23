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
  const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const pill = document.querySelector('.stg-status');
  if (!pill) return { pill: null };
  const chain = [];
  let anc = pill;
  while (anc && anc !== document.body && chain.length < 8) {
    const s = getComputedStyle(anc);
    chain.push({ cls: anc.className.toString().slice(0, 60), rect: rect(anc), position: s.position, marginLeft: s.marginLeft, left: s.left, display: s.display, padding: s.padding });
    anc = anc.parentElement;
  }
  return { pill: { ...rect(pill), display: getComputedStyle(pill).display }, chain };
});
console.log(JSON.stringify(diag, null, 2));
await browser.close();
