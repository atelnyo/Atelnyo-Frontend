#!/usr/bin/env node
/**
 * scripts/_closure-leak-helpers.cjs
 *
 * Shared helpers for scripts/lint-closure-leak.cjs (the analyzer
 * CLI) AND scripts/debug-closure-leak.cjs (the verbose diagnostic
 * mirror). Round 5 refactor: extracted these from both consumers
 * to a single source-of-truth module so an edit to one side
 * (e.g. extending ``OK_UNBOUND`` with a new React hook)
 * propagates to the other without a copy-paste drift hazard.
 *
 * Why no top-level side effects on ``require()``
 * ----------------------------------------------
 * ``lint-closure-leak.cjs`` calls ``main()`` at module load. If
 * the shared helpers module ALSO printed anything on import
 * (e.g. ``console.log('loaded')``), the analyzer's
 * ``run_vite.sh`` pre-launch gate would output noise on every
 * dev startup. Keep this file pure: just data + functions,
 * exported via ``module.exports``.
 *
 * Why these specific exports
 * --------------------------
 *  * ``OK_UNBOUND`` — global/whitelist names that resolve at
 *    runtime even without a source-level binding (so the
 *    analyzer's PASS 2 doesn't flag ``console.log`` as a leak).
 *  * ``isModuleLevelPath`` — the Round-4 walk-loop that
 *    correctly handles every ``const X = …`` at module
 *    level (the original naïve check silently dropped them
 *    because VariableDeclarator's parent is VariableDeclaration,
 *    not Program).
 *  * ``exts`` + ``walkDir`` — file discovery for the analyzer.
 *    ``debug-closure-leak.cjs`` doesn't need walkDir (it walks
 *    one explicit path at a time), but it's exported anyway so
 *    a future one-shot debug that needs recursive walking doesn't
 *    re-import the regex from elsewhere.
 */
'use strict';

const exts = /\.(jsx?|tsx?)$/;

/**
 * Whitelist of names that bind at runtime even when no source-level
 * binding is visible to Babel. Both the analyzer and the debug
 * mirror short-circuit on this set. Includes:
 *
 *  * Browser / JS engine globals (window, document, fetch, …)
 *  * React + ReactDOM entry points + every React hook as of
 *    the React 18 / 19 surface (``useTransition``,
 *    ``useSyncExternalStore``, …)
 *  * Node-style globals (``process``, ``Buffer``, ``__dirname``,
 *    ``module``, ``exports``) — relevant because the lint also
 *    runs against ``scripts/``-side CJS helpers, not just
 *    browser-side JSX.
 *
 * A future change that adds e.g. ``AbortController`` to this
 * set only requires editing one file — that's the whole point of
 * the Round 5 extraction. Sending a tampered-device token
 * through a deeper flag without shoehorning in a "skip unless
 * explicitly JSX" check.
 */
const OK_UNBOUND = new Set([
  // Browser / JS engine globals
  'console', 'Math', 'Date', 'JSON', 'window', 'document',
  'URL', 'URLSearchParams', 'Blob', 'File', 'FormData',
  'Headers', 'Request', 'Response', 'fetch',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'setImmediate', 'queueMicrotask',
  'parseInt', 'parseFloat', 'isNaN', 'Number', 'String', 'Boolean',
  'Array', 'Object', 'Promise', 'Symbol', 'Error', 'TypeError',
  'globalThis', 'undefined', 'NaN', 'Infinity',
  // React + ReactDOM entry points
  'React', 'ReactDOM',
  // React hooks
  'useState', 'useEffect', 'useMemo', 'useCallback', 'useRef',
  'useDeferredValue', 'useNavigate', 'useReducer', 'useContext',
  'useImperativeHandle', 'useLayoutEffect', 'useDebugValue',
  'useId', 'useTransition', 'useSyncExternalStore',
  // Node-style globals (build-time / dev-only)
  'process', 'Buffer', 'global', 'require',
  '__dirname', '__filename', 'module', 'exports',
]);

/**
 * Round-4 walk-loop fix: ``VariableDeclarator``'s ``parentPath``
 * is the wrapping ``VariableDeclaration`` statement (NOT
 * Program). The original naïve check
 *   ``p.parentPath.type === 'Program'``
 * silently dropped every ``const X = …`` at module level and
 * every ``export const X = …``. The walk past
 * ``VariableDeclaration`` + ``ExportNamedDeclaration`` +
 * ``ExportDefaultDeclaration`` correctly identifies module-level
 * consts while still rejecting function-body locals (whose
 * ancestor is a ``BlockStatement``, not Program).
 *
 * The walk also handles exported function declarations so a
 * single helper covers both FD-shaped and const-arrow/fn shapes.
 *
 * Anonymous ``export default function () {}`` is intentionally
 * rejected: we need a name to attribute findings to. The
 * FunctionDeclaration visitor separately short-circuits on
 * ``p.node.id.name`` so anonymous FDs are dropped there too.
 */
function isModuleLevelPath(p) {
  let cur = p.parentPath;
  while (cur && (
    cur.type === 'VariableDeclaration' ||
    cur.type === 'ExportNamedDeclaration' ||
    cur.type === 'ExportDefaultDeclaration'
  )) {
    cur = cur.parentPath;
  }
  return Boolean(cur && cur.type === 'Program');
}

/**
 * Recursively walk a directory for source files matching ``exts``.
 * Symlinks + dotfiles + node_modules are excluded to keep the
 * lint focused on first-party source. Errors during the walk
 * (permission denied, missing dir) are swallowed and treated
 * as an empty result — the analyzer's main() reports a clean
 * scan instead of crashing the dev server.
 */
function walkDir(dir) {
  // Lazy require so the helpers module stays import
  // side-effect-free. Node caches `require('node:fs')` and
  // `require('node:path')` results on first call regardless
  // of when that call happens -- moving the require() calls
  // inside walkDir keeps the helpers module off the
  // ``npm run dev`` cold-load path (run_vite.sh requires
  // this file as a pre-launch gate; if the helpers touched
  // node:fs / node:path at require() time, every dev start
  // would warm the filesystem + path caches for no reason).
  const fs = require('node:fs');
  const path = require('node:path');
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (_) { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      out.push(...walkDir(p));
    } else if (exts.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

module.exports = { exts, OK_UNBOUND, isModuleLevelPath, walkDir };
