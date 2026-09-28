#!/usr/bin/env node
// scripts/_pre-launch-syntax-lint.cjs — pre-launch JSX / TSX / JS / TS
// syntax gate used by run_vite.sh AND dev-up.sh.
//
//                           ◯  Why this exists
// ─────────────────────────────────────────────────────────────────────
// Pre-launch syntax gate. Catches a JSX brace mismatch / paren / fragment
// inside src/ BEFORE any dev server (vite OR daphne in a full-stack
// spin-up via dev-up.sh) swallows it as an opaque "Internal server
// error" on the first hot-module import. Without this gate, a single
// extra `}` at the end of a component silently kills the dev server
// while daphne keeps running on :8000 — the user has no idea what's
// wrong beyond "vite never came up". With this gate, the syntax error
// is named (file + babel's "Line X, column Y" + token message) and
// the launcher exits 1 BEFORE vite (or daphne) is ever started.
//
//                           ◯  Why @babel/parser (not transformSync)
// ─────────────────────────────────────────────────────────────────────
// preset-env and preset-react are NOT hoisted to top-level
// node_modules in this project — they live inside @vitejs/plugin-
// react's deps and `require('@babel/preset-env')` throws.
// parser.parse() with plugins:['jsx','typescript'] is a pure-syntactic
// check that doesn't need any preset chain and runs per-file in a
// few ms even on the whole src/ tree. Future .ts/.tsx additions are
// tolerated by the 'typescript' plugin entry — no source change
// needed if the codebase later mixes in TS.
//
//                           ◯  Graceful fallback
// ─────────────────────────────────────────────────────────────────────
// If @babel/parser ever disappears from node_modules (e.g. someone
// switches to a non-babel bundler), the gate DOES NOT skip itself —
// it exits 1 with a clear toolchain-missing message. Reason: the
// WHOLE POINT of this gate is to refuse broken startups; silently
// falling through would re-create the exact opaque "vite never came
// up" failure mode the gate was added to prevent. The operator
// reruns `npm install` (or whatever restored the parser) without
// confusion.
//
//                           ◯  Why extracted to its own file
// ─────────────────────────────────────────────────────────────────────
// dev-up.sh (the full-stack orchestrator added with Phase 49) wants
// the same gate BEFORE it spawns either tmux session, so the two
// launchers run the gate up-front and only THEN bring up the stack.
// Two copies of the ~70-line heredoc body would drift on the next
// edit (one would catch the typo, the other wouldn't), so the gate
// lives in this sibling where both run_vite.sh and dev-up.sh can
// invoke it via `node scripts/_pre-launch-syntax-lint.cjs [SRC_DIR]`.
//
//                           ◯  Usage
// ─────────────────────────────────────────────────────────────────────
//   node scripts/_pre-launch-syntax-lint.cjs [SRC_DIR]
//     SRC_DIR defaults to ./src (relative to process.cwd()). Both
//     run_vite.sh and dev-up.sh cd to the project root first, so
//     the default is "the project root's ./src" without explicit args.
// Exit:
//   0 → all .js / .jsx / .ts / .tsx files under SRC_DIR parse cleanly.
//   1 → toolchain missing (@babel/parser) OR syntax failures found.

'use strict';

const fs = require('fs');
const path = require('path');

let parser;
try {
  parser = require('@babel/parser');
} catch (e) {
  // A missing @babel/parser means the gate cannot run — and the WHOLE
  // POINT of this gate is to refuse broken startups. Silently falling
  // through would re-create the exact opaque "vite never came up"
  // failure mode the script was added to prevent. So we exit 1 here
  // so the user is forced to fix their toolchain (typically: rerun
  // `npm install` after a vendor change).
  console.error('❌ Pre-launch lint cannot run: @babel/parser not resolvable.');
  console.error('   ' + e.message);
  console.error('   Re-run `npm install` or restore node_modules/@babel/parser.');
  process.exit(1);
}

const exts = /\.(jsx?|tsx?)$/;
const failures = [];

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (_) { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      // node_modules + dotfiles (e.g. .vite) are skipped to keep the
      // lint focused on first-party source.
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      walk(p);
    } else if (exts.test(e.name)) {
      const code = fs.readFileSync(p, 'utf8');
      try {
        parser.parse(code, {
          sourceType: 'module',
          plugins: ['jsx', 'typescript'],
          errorRecovery: false,
        });
      } catch (err) {
        // Babel's diagnostic is two-part: (1) the "Line X, column Y"
        // header line, (2) a 4–5 line code frame with a caret pointing
        // at the offending column. We keep the first 6 lines so the
        // user sees the caret, but cap at 6 to avoid clobbering the
        // terminal with a multi-file lint dump.
        const raw = (err.message || String(err)).split('\n', 6).join('\n');
        failures.push({ file: p, message: raw });
      }
    }
  }
}

const srcDir = process.argv[2] || path.join(process.cwd(), 'src');
walk(srcDir);

if (failures.length) {
  console.error('❌ Pre-launch lint FAILED — refusing to start vite/daphne:');
  for (const f of failures) {
    console.error('   ' + f.file);
    // Indent the multi-line babel frame so it visually nests under
    // the failing file path.
    console.error(f.message.split('\n').map(l => '       ' + l).join('\n'));
  }
  console.error('\n' + failures.length + ' file(s) with syntax errors. Fix and retry.');
  process.exit(1);
}
console.log('✅ Pre-launch lint OK: all .js/.jsx/.ts/.tsx under ' + srcDir + ' parse cleanly.');
