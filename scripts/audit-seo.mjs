/**
 * scripts/audit-seo.mjs — run BOTH crawl audits in one command.
 *
 *   1. audit-crawlable-routes.mjs — sitemap URLs + key public pages +
 *      legacy URL shapes (with soft-404 detection)
 *   2. audit-all-pages.mjs — every SPA route from route-inventory.mjs
 *
 * Usage:
 *   npm run audit:seo                          → https://atelnyo.site
 *   npm run audit:seo -- http://127.0.0.1:3000 → local dev server
 *
 * Exits non-zero if EITHER audit fails, so it can gate CI later.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE = process.argv[2] || 'https://atelnyo.site';
const here = path.dirname(fileURLToPath(import.meta.url));

const AUDITS = [
  'audit-crawlable-routes.mjs',
  'audit-all-pages.mjs',
];

let failed = false;

for (const script of AUDITS) {
  console.log(`\n━━━ ${script} — ${BASE} ━━━\n`);
  const code = await new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(here, script), BASE], {
      stdio: 'inherit',
    });
    child.on('exit', resolve);
    child.on('error', (e) => {
      console.error(`Failed to launch ${script}: ${e.message}`);
      resolve(1);
    });
  });
  if (code !== 0) failed = true;
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (failed) {
  console.log('🚨 SEO audit FAILED — see the ❌ lines above.');
  process.exit(1);
}
console.log('🎉 Both audits passed — site is fully crawlable.');
