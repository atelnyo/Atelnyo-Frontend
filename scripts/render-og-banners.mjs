#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

const BANNERS = [
  'og-banner-en.svg',
  'og-banner-ht.svg',
  'og-banner-fr.svg',
  'og-banner-es.svg',
];

async function rasterize(browser, svgPath, width, height) {
  const svg = readFileSync(svgPath, 'utf8');
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden;width:${width}px;height:${height}px;background:#14143a;}</style></head><body>${svg}</body></html>`);
  const shot = await page.locator('svg').screenshot({ type: 'png' });
  await page.close();
  return shot;
}

async function main() {
  console.log('Rendering OG banners to PNG (1200x630)...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  for (const svgFile of BANNERS) {
    const pngFile = svgFile.replace('.svg', '.png');
    const inputPath = path.join(PUBLIC, svgFile);
    const outputPath = path.join(PUBLIC, pngFile);
    const pngBuffer = await rasterize(browser, inputPath, 1200, 630);
    writeFileSync(outputPath, pngBuffer);
    console.log(`✓ ${svgFile} → ${pngFile} (${pngBuffer.length} bytes)`);
  }
  // Also create public/og-image.png as a standard canonical copy of og-banner-en.png
  const enPng = readFileSync(path.join(PUBLIC, 'og-banner-en.png'));
  writeFileSync(path.join(PUBLIC, 'og-image.png'), enPng);
  console.log(`✓ og-banner-en.png → og-image.png`);

  await browser.close();
  console.log('All OG banners rendered.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
