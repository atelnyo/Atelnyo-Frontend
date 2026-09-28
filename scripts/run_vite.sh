#!/bin/bash
# run_vite.sh — launcher that always CD's to the project root before running Vite.
# Uses $(dirname "$0") so the script works regardless of where it is cloned to.
cd "$(dirname "$0")"

# Make sure node_modules is installed before launching Vite so the failure mode is clear.
if [ ! -d node_modules ]; then
  echo "❌ Missing node_modules."
  echo "   Run:  npm install"
  exit 1
fi

# ─── Pre-launch syntax check ─────────────────────────────────────────────────
# Babel-parse gate extracted to scripts/_pre-launch-syntax-lint.cjs so
# dev-up.sh can compose the same gate without duplicating ~70 lines of
# heredoc body. The extracted file's doc header carries the full
# rationale (why @babel/parser not transformSync; babel diagnostic
# 6-line cap; tsx via the 'typescript' plugin; toolchain-missing
# fails-loud-with-message; etc). Behavior is byte-identical — the
# parser.parse walking logic moved verbatim, with `src/` now flowing
# in as argv[2] instead of `path.join(process.cwd(), 'src')`.
node "$(dirname "$0")/scripts/_pre-launch-syntax-lint.cjs" "$(dirname "$0")/src"

# ─── Closure-leak lint (catches the MusicCard bug class at CI time) ────────
# Phase 47 regression: scan src/ for module-level components that reference
# identifiers only declared as nested helpers inside another module-level
# component's body. Bug shape: a module-level MusicCard called
# renderSpotlightSection() (defined inside Explore()'s closure body), which
# resolves to undefined at every paint and crashes the whole <Explore> page
# with a ReferenceError. The analyzer is a standalone CLI at
# scripts/lint-closure-leak.cjs; it returns exit 1 on findings and the spec
# is locked against future regressions by
# `node scripts/test-closure-leak.cjs`.
#
# Failure semantics: a finding blocks vite launch (exit 1 from the
# analyzer → || exit 1 chain). Same "refuse to start vite" posture as
# the syntax gate above; the user fixes the leak before the dev server
# is up.
#
# Toolchain note: the analyzer requires @babel/parser + @babel/traverse.
# The syntax gate above already refused to launch if @babel/parser is
# missing, so by this point both are reachable. If a future user
# somehow has parser but not traverse, the analyzer prints a
# diagnostic and exits with code 2 — which we surface here so vite
# doesn't start.
echo '🔎 [closure-leak] scanning src/ for module-level components that reference nested helpers...'
node scripts/lint-closure-leak.cjs
LINT_EXIT=$?
if [ $LINT_EXIT -ne 0 ]; then
  echo ''
  echo '❌ Closure-leak lint FAILED (exit='$LINT_EXIT'). Refusing to start vite.'
  echo '   Each finding is a module-level component referencing an identifier'
  echo "   that's only in scope inside another component's body."
  echo '   Fix: pass the identifier through props, import at top of file,'
  echo '   move the helper to module scope, or inline the JSX into the'
  echo "   defining component's return."
  exit 1
fi
# Mirror the pre-launch syntax gate above: print an explicit OK line
# so devs reading the log can confirm the second pre-launch stage
# ran AND succeeded. The analyzer already prints
# `lint-closure-leak: 0 findings across N files.` of its own, but
# emitting ✅ here matches the syntax gate's success line and makes
# it unambiguous (e.g. a future stderr-only mode of the analyzer
# would still leave this success line as the visible "lint passed"
# signal).
echo '✅ [closure-leak] OK: no module-level component references a sibling component’s nested helper.'

# ─── Orphan-port cleanup (pre-exec gate) ──────────────────────────────────
# Reap any prior dev run that escaped into a dead parent shell and
# did NOT release :8000. Without this, the very behavior the messages
# above explain (a JSX brace mismatch silently kills vite) flips
# sides — vite still refuses to come up, but the cause is now
# `[Errno 98] Address already in use` from an orphaned :8000 bind
# instead of a parse error. The user-facing failure mode is the same
# (“vite never came up”), the fix differs. kill-port.sh kills the
# offending PID via a 4-level fallback (lsof → fuser → ss → /proc)
# and ALWAYS exits 0 — see scripts/kill-port.sh for the full design
# (rationale: a stale PORT_STATE produces a loud EADDRINUSE at exec
# time, which the operator can act on; failing the cleanup helper
# would just add noise on top of that same EADDRINUSE).
. "$(dirname "$0")/scripts/kill-port.sh"
_reap_port 3000 "Vite" || true


exec npm run dev -- --host 0.0.0.0 --port 3000
