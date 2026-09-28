#!/usr/bin/env node
/**
 * scripts/render-icons.mjs — render the Atelnyo brand SVGs to PNGs.
 *
 * Uses Playwright's headless Chromium to rasterize each SVG at 2x
 * resolution (crisp edges, real font fallback), then Pillow downscales
 * to every PWA-required size with LANCZOS (better than a one-shot
 * screenshot at each size).
 *
 * Outputs:
 *   public/icon-{96,144,192,384,512}.png   (app icon, "any")
 *   public/icon-maskable-{192,512}.png      (maskable safe-zone)
 *   public/og-image.png                     (1200×630 social banner)
 *
 * Run from repo root:  node scripts/render-icons.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

// { svg, masterSize, outputs: [{file, w, h}] }
const TARGETS = [
  {
    svg: 'icon-512.svg',
    masterSize: 1024,
    outputs: [
      { file: 'icon-96.png', w: 96 },
      { file: 'icon-144.png', w: 144 },
      { file: 'icon-192.png', w: 192 },
      { file: 'icon-384.png', w: 384 },
      { file: 'icon-512.png', w: 512 },
    ],
  },
  {
    svg: 'icon-maskable-512.svg',
    masterSize: 1024,
    outputs: [
      { file: 'icon-maskable-192.png', w: 192 },
      { file: 'icon-maskable-512.png', w: 512 },
    ],
  },

];

async function rasterize(browser, svgPath, width, height, transparent = false) {
  const svg = readFileSync(svgPath, 'utf8');
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
  const shot = await page.locator('svg').screenshot({ omitBackground: transparent });
  await page.close();
  return shot;
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  for (const t of TARGETS) {
    const isOg = t.masterSize === null;
    const [w, h] = isOg ? [1200, 630] : [t.masterSize, t.masterSize];
    const png = await rasterize(browser, path.join(PUBLIC, t.svg), w, h, t.transparent === true);
    const master = path.join(PUBLIC, `.${t.svg.replace('.svg', '')}.master.png`);
    writeFileSync(master, png);
    const py = [
      'from PIL import Image',
      `im = Image.open(${JSON.stringify(master)}).convert('RGBA')`,
    ];
    for (const out of t.outputs) {
      py.push(
        `im.resize((${out.w}, ${out.h ?? out.w}), Image.LANCZOS).save(${JSON.stringify(path.join(PUBLIC, out.file))})`
      );
    }
    execFileSync('python3', ['-c', py.join('\n')], { stdio: 'inherit' });
    console.log(`✓ ${t.svg} → ${t.outputs.map((o) => o.file).join(', ')}`);
  }
  await browser.close();
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
