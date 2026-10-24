/**
 * scripts/full-audit.mjs
 *
 * Full UX audit for the Atelnyo frontend:
 *   1. Per-route load speed (domcontentloaded, full load, API settle window)
 *   2. Navigation sanity (does each route render content, not a blank page?)
 *   3. Responsive checks (horizontal overflow per viewport)
 *   4. Console/page errors per route
 *
 * Usage: BASE_URL=http://localhost:4173 node scripts/full-audit.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4173';

const ROUTES = [
  '/', '/explore', '/login', '/signup', '/about', '/trust', '/contact',
  '/accessibility', '/status', '/developers', '/themes', '/faq', '/help',
  '/help/wallet', '/legal', '/legal/terms', '/verify', '/academy',
  '/sheet/explore', '/sheet/explore/music', '/sheet/explore/talent',
  '/sheet/explore/job', '/sheet/calendar', '/sheet/search', '/sheet/deie/feed',
  '/sheet/community/atelnyo-academy', '/sheet/course/1', '/sheet/learn',
  '/sheet/page/about', '/c/Atelnyo', '/@Atelnyo', '/sheet/settings',
  '/sheet/wallet', '/sheet/messages', '/404', '/go/TEST-CODE',
];

const VIEWPORTS = [
  { width: 390, height: 844, name: 'phone' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 1366, height: 800, name: 'laptop' },
];

const cookieInit = () => {
  localStorage.setItem('atelnyo_cookie_consent', JSON.stringify({ version: '1.0', necessary: true, analytics: true, marketing: true, decidedAt: Date.now() }));
};

const getOverflow = () => {
  const docW = document.documentElement;
  const bad = [...document.querySelectorAll('body *')]
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width > docW.clientWidth + 4 && el.offsetParent; })
    .slice(0, 4)
    .map((el) => `${(el.className && el.className.toString ? el.className.toString() : el.tagName).slice(0, 60)} w=${Math.round(el.getBoundingClientRect().width)}`);
  return { vw: docW.clientWidth, scrollW: docW.scrollWidth, overflow: docW.scrollWidth > docW.clientWidth, bad };
};

const hasRealContent = () => {
  const txt = (document.body?.innerText || '').trim();
  return { chars: txt.length, sample: txt.slice(0, 60).replace(/\n+/g, ' | ') };
};

const browser = await chromium.launch();

// ── 1+2+4: route load speed & content, on phone viewport ──
console.log('=== ROUTE LOADING (phone 390x844) ===');
for (const route of ROUTES) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  await page.addInitScript(cookieInit);
  try {
    const t0 = Date.now();
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const dclMs = Date.now() - t0;
    await page.waitForTimeout(4000); // let lazy chunks/API settle
    const settleMs = Date.now() - t0;
    const content = await page.evaluate(hasRealContent);
    const o = await page.evaluate(getOverflow);
    const blankMarkers = await page.evaluate(() => !!document.querySelector('[data-blank-screen], .blank-fallback'));
    console.log(JSON.stringify({ route, dclMs, settleMs, chars: content.chars, sample: content.sample, overflow: o.overall ?? o.overflow, scrollW: o.scrollW, errors: errors.slice(0, 2), blankMarkers }));
  } catch (e) {
    console.log(JSON.stringify({ route, error: String(e).split('\n')[0].slice(0, 150) }));
  }
  await page.close();
}

// ── 3: responsiveness, home + explore + login ──
console.log('\n=== RESPONSIVE OVERFLOW (per viewport) ===');
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.addInitScript(cookieInit);
  try {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);
    console.log(`[${vp.name}] home`, JSON.stringify(await page.evaluate(getOverflow)));
    await page.goto(BASE + '/sheet/explore', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);
    console.log(`[${vp.name}] explore`, JSON.stringify(await page.evaluate(getOverflow)));
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);
    console.log(`[${vp.name}] login`, JSON.stringify(await page.evaluate(getOverflow)));

    // bottom-nav clicks on smallest screen
    if (vp.name === 'phone') {
      console.log('\n=== BOTTOM NAVIGATION (phone) ===');
      for (const label of /Mwen|Explore|Eksplore|Akay|Home|DEIE/ !== undefined ? [] : []) {} // noop
      const navBtns = page.locator('nav button, .bottom-nav-bar button, [class*="bottom-nav"] button');
      const n = Math.min(await navBtns.count(), 6);
      for (let i = 0; i < n; i++) {
        const b = navBtns.nth(i);
        const label = (await b.textContent() || '').trim().slice(0, 24);
        const before = page.url();
        const t0 = Date.now();
        await b.click({ timeout: 4000 }).catch(() => {});
        let acked = false;
        while (Date.now() - t0 < 12000) {
          if (page.url() !== before) { acked = true; break; }
          await page.waitForTimeout(50);
        }
        const ackMs = Date.now() - t0;
        await page.waitForTimeout(1500);
        console.log(JSON.stringify({ navBtn: label, ackMs, acked, url: page.url().replace(BASE, ''), hasContent: (await page.evaluate(hasRealContent)).chars > 0 }));
      }
    }
  } catch (e) {
    console.log(`[${vp.name}] ERROR:`, String(e).split('\n')[0]);
  }
  await page.close();
}

await browser.close();
