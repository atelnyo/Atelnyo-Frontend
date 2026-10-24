/**
 * scripts/link-audit.mjs
 *
 * Link audit for the Atelnyo SPA.
 *   1. Crawl key public pages, collect every <a href> and [data-link].
 *   2. Classify targets: internal route / anchor / mailto / external.
 *   3. Load each unique internal target and check it does NOT land on
 *      the catch-all 404 ("Page Not Found" / "404 | Oops!").
 *   4. Report dead links with the page + element the user clicked from.
 *
 * Usage: BASE_URL=http://localhost:4173 node scripts/link-audit.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const PAGES = ['/', '/about', '/trust', '/contact', '/help', '/legal', '/faq', '/status', '/developers', '/themes', '/login', '/signup', '/accessibility', '/academy', '/404'];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
await page.addInitScript(() => {
  localStorage.setItem('atelnyo_cookie_consent', JSON.stringify({ version: '1.0', necessary: true, analytics: true, marketing: true, decidedAt: Date.now() }));
});

const collect = () => page.evaluate(() => {
  const normalize = (href) => {
    try { return new URL(href, location.origin); } catch { return null; }
  };
  const links = [];
  for (const a of document.querySelectorAll('a[href]')) {
    const raw = a.getAttribute('href') || '';
    const nav = normalize(a.href);
    if (!nav) { links.push({ raw, kind: 'invalid' }); continue; }
    const kind = raw.startsWith('#') || a.href.endsWith('#') ? 'anchor'
      : a.href.startsWith('mailto:') ? 'mailto'
      : nav.origin !== location.origin ? 'external'
      : 'internal';
    links.push({
      raw,
      kind,
      pathname: kind === 'internal' ? nav.pathname : undefined,
      text: (a.innerText || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40),
    });
  }
  return links;
});

/** 404 detection: the catch-all renders "Loading page..." too, so let the
 * DynamicPage 404 path resolve before deciding. */
const isDead = async (pathname) => {
  const page404 = await browser.newPage({ viewport: { width: 1366, height: 800 } });
  await page404.addInitScript(() => {
    localStorage.setItem('atelnyo_cookie_consent', JSON.stringify({ version: '1.0', necessary: true, analytics: true, marketing: true, decidedAt: Date.now() }));
  });
  let dead;
  try {
    await page404.goto(BASE + pathname, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page404.waitForTimeout(4500); // allow async fetchers to fail/land on 404
    dead = await page404.evaluate(() => {
      const txt = document.body.innerText || '';
      const is404 = /404/.test(txt.slice(0, 200)) && /Page Not Found|Oops!/.test(txt);
      const isSpinnerStuck = /^Loading\.\.\.$|^Loading page\.\.\.$|^Loading themes\.\.\.$|^Loading policy\.\.\.$/m.test(txt.trim());
      return { is404, isSpinnerStuck, sample: txt.replace(/\n+/g, ' | ').slice(0, 120) };
    });
  } catch (e) {
    dead = { is404: null, isSpinnerStuck: null, sample: String(e).slice(0, 120) };
  }
  await page404.close();
  return dead;
};

const results = [];
const checked = new Map();

for (const p of PAGES) {
  await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(3500);
  const links = await collect();
  for (const l of links) {
    if (l.kind !== 'internal') continue;
    // skip fragment-only links and the current page
    if (!l.pathname || l.pathname === p) continue;
    if (checked.has(l.pathname)) {
      checked.get(l.pathname).from.push(`${p} :: "${l.text}"`);
      continue;
    }
    checked.set(l.pathname, { pathname: l.pathname, from: [`${p} :: "${l.text}"`] });
  }
}

for (const entry of checked.values()) {
  const dead = await isDead(entry.pathname);
  results.push({ ...entry, is404: dead.is404, spinnerStuck: dead.isSpinnerStuck, sample: dead.sample });
}

console.log(JSON.stringify(results, null, 2));
console.log('\n=== SUMMARY ===');
const bad = results.filter((r) => r.is404 || r.spinnerStuck);
for (const b of bad) {
  console.log(`DEAD ${b.pathname}`);
  b.from.slice(0, 4).forEach((f) => console.log(`  ← ${f}`));
}
console.log(`\n${results.length} unique internal targets checked, ${bad.length} dead.`);
await browser.close();
