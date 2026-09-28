#!/usr/bin/env node
/**
 * scripts/test-closure-leak.cjs
 *
 * CLI regression test for scripts/lint-closure-leak.cjs.
 *
 * Runs the analyzer against TWO positive fixtures and asserts the
 * expected finding count + per-fixture guard conditions:
 *
 *   1. closure-leak-bug-shape.jsx  →  EXACTLY 1 finding at the
 *      module-level MusicCard → nested renderSpotlightSection site.
 *      Guards: the finding names MusicCard, names
 *      renderSpotlightSection, and does NOT contain false-positive
 *      signals (useState / console.log / localFn).
 *
 *   2. closure-leak-bug-shape-hoc.jsx  →  EXACTLY 2 findings, one
 *      per HOC-wrapped module-level component (Wrap1 via
 *      React.memo, Wrap2 via forwardRef). Guards: each finding
 *      names the leak target and does NOT attribute findings to
 *      the anonymous HOC wrapper (Anon) — which would be a hint
 *      that the HOC unwrap branch has started forcing attribution
 *      on anonymous inner FunctionExpressions. We assert NO finding
 *      line refers to `Anon` exactly because of that: if a future
 *      scope-refactor starts forcing attribution to anonymous
 *      wrappers, this assertion fails loudly instead of silently
 *      producing a false-positive.
 *
 * Why this script exists
 * ----------------------
 * The analyzer is babel-based static analysis. A future @babel
 * update, a future JSX runtime change, or a future scope-tracking
 * refactor could silently stop catching the bug shape (the
 * Round 1 + Round 2 iterations of the analyzer had exactly that
 * property — the lint seemed fine against current code on the dev
 * box but the fixture proved otherwise). This test locks the
 * detector behavior so future regressions on the analyzer itself
 * fail loudly, even if the FE source tree happens to be clean at
 * the moment.
 *
 * Exit status: 0 on pass, 1 on fail.
 *
 * Usage
 * -----
 *   node scripts/test-closure-leak.cjs
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const FIXTURES = [
  // [absolute_path, expected_finding_count, name_in_assert_msg]
  [
    path.resolve(__dirname, '__lint-fixtures__', 'closure-leak-bug-shape.jsx'),
    1,
    'closure-leak-bug-shape.jsx',
  ],
  [
    path.resolve(__dirname, '__lint-fixtures__', 'closure-leak-bug-shape-hoc.jsx'),
    2,
    'closure-leak-bug-shape-hoc.jsx',
  ],
];

for (const [f] of FIXTURES) {
  if (!fs.existsSync(f)) {
    console.error(`test-closure-leak: FAIL — fixture missing: ${f}`);
    process.exit(1);
  }
}

function fail(msg) {
  console.error(`test-closure-leak: FAIL — ${msg}`);
  process.exit(1);
}
function assert(cond, msg) {
  if (!cond) fail(msg);
}

// Output lines look like:
//   /abs/path/to/file.jsx:42:9 — MusicCard references `renderSpotlightSection`, ...
const FINDING_LINE_RE = /^\s*\/.*:\d+:(\d+)?\s+—\s+/;

/**
 * Run the analyzer as a child process. The analyzer exits 1
 * when findings are present (which is exactly what we WANT to
 * assert here). execFileSync throws on non-zero exit; we read
 * stdout from the error object instead.
 */
function runAnalyzer(fixturePath) {
  let stdout;
  try {
    stdout = execFileSync(process.execPath, [
      path.resolve(__dirname, 'lint-closure-leak.cjs'),
      fixturePath,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    stdout = (e.stdout || '').toString();
    if (!stdout) {
      console.error(`analyzer output (stderr): ${e.stderr || e.message}`);
      fail(`analyzer invocation failed to produce output for ${fixturePath}`);
    }
  }
  return stdout;
}

// ── Fixture 1 — plain module-level sibling ───────────────────────────
{
  const [fixture, expectedCount, name] = FIXTURES[0];
  console.log(`\n=== ${name} ===`);
  const stdout = runAnalyzer(fixture);
  console.log(stdout.trimEnd() || '(empty)');
  console.log('====================================');

  const findingLines = stdout
    .split('\n')
    .filter((ln) => FINDING_LINE_RE.test(ln));

  assert(
    findingLines.length === expectedCount,
    `expected EXACTLY ${expectedCount} finding on ${name}; got ${findingLines.length}`,
  );

  const finding = findingLines[0];
  assert(/MusicCard/.test(finding),
    `finding on ${name} did not name MusicCard: ${finding}`);
  assert(/renderSpotlightSection/.test(finding),
    `finding on ${name} did not name renderSpotlightSection: ${finding}`);
  assert(!/useState|console\.log|localFn/.test(finding),
    `false-positive leaked into the finding text: ${finding}`);
}

// ── Fixture 2 — HOC unwrap paths + anonymous HOC skip ────────────────
{
  const [fixture, expectedCount, name] = FIXTURES[1];
  console.log(`\n=== ${name} ===`);
  const stdout = runAnalyzer(fixture);
  console.log(stdout.trimEnd() || '(empty)');
  console.log('====================================');

  const findingLines = stdout
    .split('\n')
    .filter((ln) => FINDING_LINE_RE.test(ln));

  assert(
    findingLines.length === expectedCount,
    `expected EXACTLY ${expectedCount} findings on ${name}; got ${findingLines.length}`,
  );

  // Both findings should point at the leak target AND should
  // attribute to the OUTER const name (`Wrap1`, `Wrap2`) — the
  // user-facing module-level identifier — NOT the inner named
  // FunctionExpression name (`MemoCard`, `FwdCard`).  The
  // analyzer uses ``p.node.id.name`` for VariableDeclarator's id
  // (the OUTER const) but ``inner.arguments[0].id.name`` was
  // tempting; tightening this asserts the analyzer keeps using
  // the outer name so the test fails loudly if a future
  // refactor accidentally rekeys attribution to the inner name.
  //
  // We DON'T expect "Anon" anywhere because the anonymous HOC
  // body is intentionally NOT registered (known false-negative).
  let seenWrap1 = false;
  let seenWrap2 = false;
  let sawAnonAttribution = false;
  let sawMemoCardAttribution = false;
  let sawFwdCardAttribution = false;
  for (const ln of findingLines) {
    assert(/renderSpotlightSection/.test(ln),
      `HOC-finding missing leak target: ${ln}`);
    assert(!/useState|console\.log|localFn/.test(ln),
      `false-positive leaked into the HOC finding: ${ln}`);
    // \b forces wrap-CR boundary so "Wrap1" inside "Wrap1\bblah"
    // would still match and "wrapped" wouldn't accidentally match.
    if (/Wrap1\b/.test(ln)) seenWrap1 = true;
    if (/Wrap2\b/.test(ln)) seenWrap2 = true;
    if (/\bMemoCard\b/.test(ln)) sawMemoCardAttribution = true;
    if (/\bFwdCard\b/.test(ln)) sawFwdCardAttribution = true;
    // Anon — the const name of the anonymous HOC wrapper — is
    // what would appear if a future refactor starts FORCEing
    // attribution. Asserting its absence guards against the
    // future regression where the anonymous HOC skip branch
    // is removed.
    if (/\bAnon\b/.test(ln)) sawAnonAttribution = true;
  }
  assert(seenWrap1, `${name}: did not flag Wrap1 (React.memo unwrap branch)`);
  assert(seenWrap2, `${name}: did not flag Wrap2 (forwardRef unwrap branch)`);
  // Attribution must use the OUTER const name (Wrap1/Wrap2),
  // not the inner named-function expression (MemoCard/FwdCard).
  // If both leak sites accidentally rekeyed to the inner name,
  // we want this test to scream, not pass.
  assert(!sawMemoCardAttribution,
    `${name}: finding attributed to inner fn name 'MemoCard' instead of outer const 'Wrap1'; analyzer rekeyed attribution to FunctionExpression.id.name`);
  assert(!sawFwdCardAttribution,
    `${name}: finding attributed to inner fn name 'FwdCard' instead of outer const 'Wrap2'; analyzer rekeyed attribution to FunctionExpression.id.name`);
  assert(!sawAnonAttribution,
    `${name}: finding attributed to anonymous HOC 'Anon'; future-refactor detector needed`);
}

console.log(
  '\ntest-closure-leak: PASS  ' +
  '(1 finding on plain sibling fixture, 2 findings on HOC fixture, 0 false positives)',
);
process.exit(0);
