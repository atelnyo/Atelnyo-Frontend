import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4173';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript(() => {
  localStorage.setItem('atelnyo_cookie_consent', JSON.stringify({ version: '1.0', necessary: true, analytics: true, marketing: true, decidedAt: Date.now() }));
});
const settingsRequests = [];
page.on('response', (res) => { const u = res.url(); if (/Settings|index-.*\.js/.test(u)) settingsRequests.push(u.split('/').pop() + ' ' + res.status()); });

await page.goto(BASE + '/sheet/settings', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(3000);

const chunks = await page.evaluate(() => performance.getEntriesByType('resource').filter((r) => /Settings-|index-.*\.js/.test(r.name)).map((r) => r.name.split('/').pop()));

// Which Settings chunk did the DOM use? Check a marker only in the new markup.
const hasLeftMarkup = await page.evaluate(() => !!document.querySelector('.settings-item .settings-item-left'));

console.log('script/network:', settingsRequests, '/perf:', chunks, '/ domHasLeft:', hasLeftMarkup);
await browser.close();
