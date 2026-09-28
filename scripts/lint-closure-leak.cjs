#!/usr/bin/env node
/**
 * scripts/lint-closure-leak.cjs
 *
 * Regression lint for the MusicCard bug class — a module-level
 * card component referring to an identifier only declared as a
 * *nested* function inside another module-level component's body.
 *
 * Strategy (clean two-pass, babel Path-based)
 * ------------------------------------------
 *
 * PASS 1 — collect imports + every module-level function as a
 * Babel Path object. A function is "module-level" when its path's
 * nearest ancestor is Program (or one hop through
 * ExportNamedDeclaration / ExportDefaultDeclaration). React HOCs
 * (React.memo, forwardRef) are unwrapped one level so the inner
 * fn is the module-level component. Anonymous default exports
 * (export default function() {}) are skipped.
 *
 * PASS 1b — for each module-level function mf, populate
 * mf.nestedDecls by calling ``mf.path.traverse({ FunctionDeclaration,
 * VariableDeclarator })``. Because mf.path is a Babel NodePath
 * (with scope), ``path.traverse`` works correctly here — NOT the
 * top-level ``traverse(node)`` function — and visits every nested
 * declaration including those inside nested closures (a function
 * nested inside another nested function is still in mf's scope
 * chain, so its declarations are mf's locals).
 *
 * PASS 2 — for each module-level function mf, run
 * ``mf.path.traverse({ Identifier })`` again to walk every
 * identifier descendant. False-positive guards (whitelist,
 * imports, sibling module-fn, JSX intrinsics) run first; then
 * ``p.scope.hasBinding(name)`` is the babel-native backstop (true
 * for parameters, local vars, nested-in-mf helpers, ANY closure
 * chain back to Program scope). If hasBinding is false AND the
 * name is declared as a nested function inside ANOTHER module-level
 * function → flag.
 *
 * Why hasBinding works here but failed in Round 1
 * ----------------------------------------------
 * Round 1 did the same check but on bare AST nodes collected via
 * ``mf.fnNode``. Without a proper Babel NodePath on the reference
 * site, ``p.scope`` resolves to the File/Program scope and reports
 * every name as unresolved (or vice versa). Round 3 only ever calls
 * hasBinding on a Path inside ``mf.path.traverse``, so scope is
 * the lexical scope at that Identifier AST position. The fixture
 * trailing test confirms this catches MusicCard→renderSpotlightSection.
 *
 * Output
 * ------
 * One line per finding: ``file:line:col — function reason``.
 * Exit 1 if any findings (the run_vite.sh pre-launch gate treats
 * exit≠0 as a hard fail), 0 otherwise.
 *
 * Usage
 * -----
 *   node scripts/lint-closure-leak.cjs                 # scan src/
 *   node scripts/lint-closure-leak.cjs path/to/foo.jsx  # scan one file
 *   node scripts/lint-closure-leak.cjs --json           # JSON output
 */
'use strict';

// ── Shared helpers (Round 5 DRY refactor) ─────────────────────────────────
// OK_UNBOUND whitelist + isModuleLevelPath walk + walkDir utility live in
// ``scripts/_closure-leak-helpers.cjs``. Both this analyzer CLI AND the
// verbose debug mirror (``scripts/debug-closure-leak.cjs``) require them
// so a Round-5-style edit (e.g. adding a new React hook to OK_UNBOUND)
// propagates to both consumers without copy-paste drift. The helpers
// module is pure — no top-level side effects on require().
//
// Why the Round 5 extraction: as of Round 4 the analyzer's OK_UNBOUND
// had grown to ~30 names while the debug script's verbose subset
// stayed at ~8. A future fix to one set without the other would
// silently produce divergent behavior (the analyzer would surface
// findings the debug mirror can't reproduce, or vice versa). The
// shared helpers module closes this drift hazard.

const { exts, OK_UNBOUND, isModuleLevelPath, walkDir } = require('./_closure-leak-helpers.cjs');

const fs = require('node:fs');
const path = require('node:path');

let parser;
let traverseMod;
try {
  parser = require('@babel/parser');
  traverseMod = require('@babel/traverse');
} catch (e) {
  console.error('lint-closure-leak: missing @babel/parser or @babel/traverse.');
  console.error('  ' + (e.message || e));
  console.error('  run:  npm install');
  process.exit(2);
}
const traverse = traverseMod.default || traverseMod;

// (exts imported from _closure-leak-helpers.cjs)

// (OK_UNBOUND + isModuleLevelPath imported from _closure-leak-helpers.cjs)

// ── Single-file analysis ───────────────────────────────────────────────
function analyze(file) {
  const code = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      errorRecovery: false,
    });
  } catch (e) {
    return { error: e.message || String(e), findings: [] };
  }

  const imports = new Set();
  const moduleFunctions = []; // { name, path, nestedDecls: Set<string> }

  // ── PASS 1 — imports + module-level functions as Paths ─────────────
  traverse(ast, {
    ImportDeclaration(p) {
      for (const s of p.node.specifiers || []) {
        if (s.local && s.local.name) imports.add(s.local.name);
      }
    },
    FunctionDeclaration(p) {
      if (!isModuleLevelPath(p)) return;
      if (!p.node.id || !p.node.id.name) return;
      moduleFunctions.push({ name: p.node.id.name, path: p, nestedDecls: new Set() });
    },
    VariableDeclarator(p) {
      if (!isModuleLevelPath(p)) return;
      if (!p.node.id || p.node.id.type !== 'Identifier') return;
      if (!p.node.init) return;

      // Unwrap React.memo(function X() {}) / React.forwardRef(function X() {}).
      // The HOC wrapper is itself a CallExpression; the inner function
      // is its first argument and IS the actual module-level component.
      let inner = p.get('init');
      const isHoc =
        inner.node.type === 'CallExpression' &&
        inner.node.arguments.length > 0 &&
        inner.node.arguments[0].type === 'FunctionExpression';
      if (isHoc && inner.node.arguments[0].id && inner.node.arguments[0].id.name) {
        // Skip anonymous HOC wrappers; the inner fn has no name we can
        // attribute findings to.
        moduleFunctions.push({
          name: p.node.id.name,
          path: inner.get('arguments.0'),
          nestedDecls: new Set(),
        });
        return;
      }
      if (isHoc) return; // anonymous HOC — skip

      if (inner.node.type === 'ArrowFunctionExpression' ||
          inner.node.type === 'FunctionExpression') {
        moduleFunctions.push({
          name: p.node.id.name,
          path: inner,
          nestedDecls: new Set(),
        });
      }
    },
  });

  if (moduleFunctions.length === 0) return { findings: [] };

  // ── PASS 1b — populate nestedDecls via sub-traverse ─────────────────
  // mf.path is already a Babel NodePath so sub-traverse works.
  // nestedDecls accumulates: nested FunctionDeclarations AND
  // nested VariableDeclarations whose init is a function
  // expression. Recursive walk so a function declared inside
  // another nested closure inside mf still belongs to mf's scope.
  for (const mf of moduleFunctions) {
    collectNestedDeclsInto(mf.path, mf.nestedDecls);
  }

  function collectNestedDeclsInto(p, out) {
    p.traverse({
      FunctionDeclaration(q) {
        if (q.node.id && q.node.id.type === 'Identifier') {
          out.add(q.node.id.name);
        }
      },
      VariableDeclarator(q) {
        if (q.node.id && q.node.id.type === 'Identifier' &&
            q.node.init &&
            (q.node.init.type === 'ArrowFunctionExpression' ||
             q.node.init.type === 'FunctionExpression')) {
          out.add(q.node.id.name);
        }
      },
    });
  }

  // ── PASS 2 — identify leaked-closure references ─────────────────────
  const findings = [];

  for (const mf of moduleFunctions) {
    const seenAtLine = new Set();
    mf.path.traverse({
      Identifier(p) {
        // Skip non-reference positions (property keys, JSX attr
        // names, shorthand destructuring). Babel's helper covers
        // all of these.
        if (typeof p.isReferencedIdentifier === 'function' &&
            !p.isReferencedIdentifier()) {
          return;
        }
        const name = p.node.name;

        // False-positive guards in priority order. Each one
        // short-circuits with no finding.
        //
        // NOTE: we do NOT special-case lowercase identifiers as
        // "JSX intrinsics". Babel already distinguishes JSX tag
        // names (``<div />``, ``<span />``) from regular identifiers:
        // they're ``JSXIdentifier`` nodes, not ``Identifier`` nodes,
        // and the Identifier visitor above never fires on them. The
        // previous analyzer had an ``isJsxIntrinsic(name)`` guard
        // that returned ``true`` for any name starting with a
        // lowercase letter — which incorrectly skipped legitimate
        // camelCase helpers like ``renderSpotlightSection`` and was
        // the exact bug that produced 0 findings on the positive
        // fixture. See scripts/__lint-fixtures__/closure-leak-bug-shape.jsx.
        if (OK_UNBOUND.has(name)) return;
        if (imports.has(name)) return;
        // Sibling module-level function — direct sibling call or
        // <Sibling /> JSX component reference. Both are valid.
        if (moduleFunctions.some((m) => m !== mf && m.name === name)) return;
        // Babel-native scope backstop — true if the name is
        // bound ANYWHERE in the lexical scope at this site:
        // parameter, local var/let/const, nested function/const
        // inside mf, nested-in-MF closures, nested-in-MF HOCs, etc.
        // The Chain back to Program level is also covered, so a
        // module-level Sibling that's reachable also gets true (we
        // already filtered siblings above; this is a defensive
        // belt-and-suspenders).
        if (p.scope.hasBinding(name)) return;

        // Unresolved by Babel. The only remaining valid case is
        // "undeclared identifier at the source level" — either a
        // bare typo we'd surface as a generic lint error
        // (today: ESLint's job, not ours) OR a leaked-closure
        // ref. To distinguish, check whether the name IS declared
        // nested inside another module-level function.
        const parentMfs = moduleFunctions.filter(
          (m) => m !== mf && m.nestedDecls.has(name),
        );
        if (parentMfs.length === 0) return; // not a leak — let ESLint handle typos

        for (const parentMf of parentMfs) {
          const key = `${p.node.loc?.start?.line ?? '?'}:${name}`;
          if (seenAtLine.has(key)) continue;
          seenAtLine.add(key);
          findings.push({
            file,
            line: p.node.loc?.start?.line ?? null,
            column: p.node.loc?.start?.column ?? null,
            src: mf.name,
            ident: name,
            reason: `references \`${name}\`, which is declared as a nested helper inside \`${parentMf.name}\`. Module-level \`${mf.name}\` is not in \`${parentMf.name}\`'s closure, so this becomes a runtime \`ReferenceError\` at JSX-evaluation time.`,
          });
        }
      },
    });
  }

  // De-dup per (file, line, ident) — a single call site with two
  // references of the same name on the same line gets one finding.
  const seen = new Set();
  const deduped = [];
  for (const f of findings) {
    const k = `${f.file}:${f.line}:${f.ident}`;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(f);
  }
  return { findings: deduped };
}

// (walkDir imported from _closure-leak-helpers.cjs)

// ── Main ──────────────────────────────────────────────────────────────
function main() {
  const argv = process.argv.slice(2);
  const jsonOut = argv.includes('--json');
  const targets = argv.filter((a) => !a.startsWith('--'));

  let files;
  if (targets.length > 0) {
    files = targets.map((t) => path.resolve(t));
    files = files.filter((f) => f.endsWith('.js') || f.endsWith('.jsx') ||
                              f.endsWith('.ts') || f.endsWith('.tsx'));
  } else {
    files = [];
    const abs = path.resolve(path.join(process.cwd(), 'src'));
    if (fs.existsSync(abs)) files.push(...walkDir(abs));
  }

  const allFindings = [];
  for (const f of files) {
    const { error, findings } = analyze(f);
    if (error) {
      console.error(`lint-closure-leak: parse error in ${f}: ${error.split('\n')[0]}`);
      process.exitCode = 2;
      continue;
    }
    allFindings.push(...findings);
  }

  if (jsonOut) {
    console.log(JSON.stringify({ findings: allFindings }, null, 2));
  } else {
    if (allFindings.length === 0) {
      console.log(`lint-closure-leak: 0 findings across ${files.length} files.`);
    } else {
      console.log(`lint-closure-leak: ${allFindings.length} finding${allFindings.length === 1 ? '' : 's'}:`);
      for (const f of allFindings) {
        console.log(`  ${f.file}:${f.line}:${(f.column ?? 0) + 1} — ${f.src} ${f.reason}`);
      }
      console.log('');
      console.log('Fix: pass the leaking identifier through props, import it at');
      console.log("     the top of the file, move the helper to module scope, or");
      console.log("     inline the JSX so the call site is inside the defining scope.");
      process.exitCode = 1;
    }
  }
}

main();
