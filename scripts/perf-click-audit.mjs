/**
 * scripts/perf-click-audit.mjs
 *
 * Click-latency audit for the Atelnyo frontend (public surfaces).
 * For each test click it measures:
 *   - ackMs: time from click dispatch until the UI acknowledges
 *     (URL change or a target selector appears in the DOM)
 *   - longTasks: main-thread tasks >50ms triggered within 3s after click
 *   - chunkMs: network time of JS chunks fetched by the click (first visit)
 *
 * Usage: BASE_URL=http://localhost:4173 node scripts/perf-click-audit.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.addInitScript(() => {
  localStorage.setItem('atelnyo_cookie_consent', JSON.stringify({ version: '1.0', necessary: true, analytics: true, marketing: true, decidedAt: Date.now() }));
});

// Instrument: long tasks + chunk fetch timing, installed before app code.
const installProbe = async () => {
  await page.evaluate(() => {
    if (window.__perfProbe) return;
    window.__perfProbe = { longTasks: [], chunks: [], mark: null };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__perfProbe.longTasks.push(Math.round(e.duration));
    }).observe({ entryTypes: ['longtask'] });
    const origFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = String(args[0] || '');
      const t0 = performance.now();
      const res = await origFetch(...args);
      if (/\.js($|\?)/.test(url) && window.__perfProbe.mark !== null) {
        window.__perfProbe.chunks.push({ url: url.split('/').pop(), ms: Math.round(performance.now() - t0) });
      }
      return res;
    };
    const origCreate = document.createElement.bind(document);
    document.createElement = (tag) => {
      const el = origCreate(tag);
      if (tag === 'script' && window.__perfProbe.mark !== null) {
        const m = window.__perfProbe.mark;
        el.addEventListener('load', () => {
          window.__perfProbe.chunks.push({ url: (el.src || '').split('/').pop(), ms: Math.round(performance.now() - m) });
        });
      }
      return el;
    };
  });
};

const resetProbe = () => page.evaluate(() => {
  window.__perfProbe.longTasks = [];
  window.__perfProbe.chunks = [];
  window.__perfProbe.mark = performance.now();
});

// Click and wait until URL or DOM acknowledges; returns ackMs.
const clickAndMeasure = async (locator, { expectUrlPart, expectSelector, timeout = 15000 }) => {
  const t0 = Date.now();
  const before = page.url();
  const check = async () => {
    if (expectUrlPart && page.url().includes(expectUrlPart) && page.url() !== before) return true;
    if (expectSelector && (await locator.page().locator(expectSelector).count()) > 0) return true;
    return false;
  };
  await locator.click({ timeout: 5000, force: false });
  let acked = false;
  const deadline = t0 + timeout;
  while (Date.now() < deadline) {
    if (await check()) { acked = true; break; }
    await page.waitForTimeout(50);
  }
  const ackMs = Date.now() - t0;
  await page.waitForTimeout(2000); // let post-click work settle
  const probe = await page.evaluate(() => window.__perfProbe);
  return {
    ackMs, acked,
    longTasks: probe.longTasks,
    totalLongTaskMs: probe.longTasks.reduce((a, b) => a + b, 0),
    chunks: probe.chunks,
  };
};

const results = [];

// 0. Cold load (baseline TTI proxy).
let t0 = Date.now();
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(3000);
results.push({ test: 'cold-load-home', domContentLoadedMs: Date.now() - t0 });
await installProbe();

const step = async (name, locator, opts) => {
  await resetProbe();
  try {
    const r = await clickAndMeasure(locator, opts);
    results.push({ test: name, ...r });
  } catch (e) {
    results.push({ test: name, error: String(e).slice(0, 200) });
  }
};

// 1. Bottom-nav → Explore (lazy chunk on first visit).
const exploreTab = page.locator('[data-testid="bottom-nav-explore"], .bottom-nav-bar button:has-text("Explore"), nav button:has-text("Explore")').first();
if ((await exploreTab.count()) > 0) {
  await step('bottomnav→explore', exploreTab, { expectUrlPart: 'explore', expectSelector: 'main' });
  // 2. Second visit to the same tab (chunk cached — pure re-render cost).
  const backHome = page.locator('.bottom-nav-bar button:has-text("Home"), .bottom-nav-bar button:has-text("Akay"), nav button:has-text("Akay")').first();
  if ((await backHome.count()) > 0) {
    await step('bottomnav→home', backHome, { expectSelector: 'main' });
    await step('bottomnav→explore-2nd', exploreTab, { expectUrlPart: 'explore', expectSelector: 'main' });
  }
}

// 3. Explore category chip (same-page re-render, no navigation).
const chip = page.locator('[data-testid*="category"], .explore-chip, [class*="chip"]').first();
if ((await chip.count()) > 0) {
  await step('explore-chip', chip, { expectSelector: 'main' });
}

// 4. Header settings button (auth-gated → login redirect expected).
const settingsBtn = page.locator('[aria-label*="Paramèt"], [aria-label*="Settings"], .header-btn:has-text("Paramèt")').first();
if ((await settingsBtn.count()) > 0) {
  await step('header→settings', settingsBtn, { expectUrlPart: 'settings', expectSelector: 'main' });
}

// 5. Login page: mode toggle (signup↔login) — pure client re-render.
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(2500);
await installProbe();
const signupToggle = page.locator('button:has-text("Enskri"), button:has-text("Sign up"), button:has-text("Kreye")').first();
if ((await signupToggle.count()) > 0) {
  await step('login→signup-toggle', signupToggle, { expectSelector: 'input[type="password"]' });
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
