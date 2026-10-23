import { chromium } from 'playwright';

const URL = process.env.BASE_URL || 'http://localhost:3000';
const VIEWPORTS = [
  { name: 'mobile-360', width: 360, height: 740 },
  { name: 'tablet-820', width: 820, height: 1180 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'phone-land-740x360', width: 740, height: 360 },
  { name: 'tablet-island-620x860', width: 620, height: 860 },
];

const measure = (w) =>
  w.evaluate(() => {
    const doc = document.documentElement;
    const vw = window.innerWidth;
    const docW = doc.scrollWidth;
    const offenders = [];
    for (const el of document.querySelectorAll('.auth-shell, .auth-card, .auth-shell *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) {
        offenders.push(
          `${el.className ? '.' + String(el.className).split(' ').slice(0, 2).join('.') : el.tagName} left=${Math.round(r.left)} right=${Math.round(r.right)}`,
        );
        if (offenders.length >= 8) break;
      }
    }
    const card = document.querySelector('.auth-card');
    const shell = document.querySelector('.auth-shell');
    const cr = card?.getBoundingClientRect();
    const sr = shell?.getBoundingClientRect();
    return {
      viewportWidth: vw,
      documentScrollWidth: docW,
      card: cr ? { left: Math.round(cr.left), right: Math.round(cr.right), width: Math.round(cr.width) } : null,
      shell: sr ? { width: Math.round(sr.width) } : null,
      offenders,
    };
  });

const browser = await chromium.launch();
let failures = 0;
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`));
  await page.goto(`${URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForSelector('.auth-card', { timeout: 20000 }).catch(() => {});
  for (const mode of ['login', 'signup']) {
    if (mode === 'signup') {
      await page.click('text=Create an account', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(400);
    }
    const m = await measure(page);
    const overflows = m.documentScrollWidth > m.viewportWidth + 1 || m.offenders.length > 0;        const status = overflows ? 'FAIL' : 'OK';
    if (overflows) failures++;
    console.log(`[${vp.name} / ${mode}] ${status} doc=${m.documentScrollWidth}px viewport=${m.viewportWidth}px card=${JSON.stringify(m.card)} shell=${JSON.stringify(m.shell)}`);
    m.offenders.forEach((o) => console.log(`    ⤷ ${o}`));
  }
  await ctx.close();
}
await browser.close();
process.exit(failures > 0 ? 1 : 0);
