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
const n = await tiles.count();
let clicked = false;
for (let i = 0; i < n; i++) {
  const t = tiles.nth(i);
  if (await t.isVisible()) { await t.click({ timeout: 5000 }); clicked = true; break; }
}
if (!clicked) throw new Error('no visible appearance tile');
await page.waitForTimeout(1200);

const diag = await page.evaluate(() => {
  const pick = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      rect: { x: Math.round(r.x), w: Math.round(r.width) },
      display: s.display,
      padding: s.padding,
      gap: s.gap,
      flex: s.flex,
      overflow: s.overflow,
      maxWidth: s.maxWidth,
      transform: s.transform,
      cls: el.className,
    };
  };
  const out = {};
  out.content = pick(document.querySelector('.settings-content'));
  const section = document.querySelector('.settings-section');
  out.section = pick(section);
  const items = section ? [...section.querySelectorAll('.settings-item')] : [];
  out.items = items.slice(0, 3).map((it) => ({
    item: pick(it),
    left: pick(it.querySelector('.settings-item-left')),
    icon: pick(it.querySelector('.settings-item-icon')),
    label: pick(it.querySelector('.settings-item-label')),
  }));
  out.docScrollW = document.documentElement.scrollWidth;
  out.bodyOverflowX = document.body.scrollWidth;
  return out;
});

console.log(JSON.stringify(diag, null, 2));
await browser.close();
