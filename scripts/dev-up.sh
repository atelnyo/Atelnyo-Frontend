#!/bin/bash
# dev-up.sh — one-command full Atelnyo dev-stack launch.
#
#                           ◯  What this is
# ─────────────────────────────────────────────────────────────────────
# Without an orchestrator, the operator flow to bring up the full stacks
# is: open terminal 1, run run_vite.sh; open terminal 2, run run_daphne.sh;
# realise a stale `python -m daphne` from a prior session is squatting on
# :3000 (proven live in this conversation: pid 3548 from a previous
# developer escaped its tmux and stuck around), restart one of the
# launchers; open yet another tmux session because Ctrl-C on the
# launcher would also kill the bash heredoc lint gate.
#
# dev-up.sh collapses that into ONE step: a single `bash dev-up.sh`
# brings both Vite AND Daphne up in **detached** tmux sessions named
# `devrose-vite` + `devrose-daphne` (NOT `vite` / `daphne` — those names
# are reserved for any developer who already runs the per-server
# launchers in their own tmux; re-using them would collide and steal),
# runs both pre-flight gates (the same ones run_vite.sh + run_daphne.sh
# run standalone) up front, reaps any orphan :3000 / :8000 binds, then
# tails the live logs until both ports go LISTEN. After dev-up exits,
# tail/attach whichever session you want without disrupting the other.
#
#                           ◯  Phases
# ─────────────────────────────────────────────────────────────────────
#  1. Toolchain sanity — verify node + tmux are reachable.
#     Hard-fail fast if either is missing so we don't half-launch.
#
#  2. src/ syntax lint  — `node scripts/_pre-launch-syntax-lint.cjs src`
#     Same babel parser.parse check run_vite.sh runs locally. Catches
#     a JSX brace / `</>` mismatch BEFORE either tmux session starts so
#     the failure mode is a clear "❌ file X line Y" instead of an opaque
#     "vite never came up" twice over.
#
#  3. closure-leak gate — `node scripts/lint-closure-leak.cjs`
#     Same scan run_vite.sh does. Catches the MusicCard → undefined
#     nested-helper bug class (CHANGELOG Phase 47).
#
#  4. Orphan-port reap   — `bash scripts/kill-port.sh <PORT> <NAME>`
#     Same helper the per-server launchers call inline. Covers the
#     stale-daphne-pid-3548 failure mode AND the (rarer) stale-vite
#     case (e.g. Ctrl-Z then killed parent shell).
#
#  5. Detached tmux spawn
#     Pre-kills any prior `devrose-{vite,daphne}` so a quick re-run
#     of dev-up.sh doesn't append tmux sessions to a list of zombie
#     half-running ones. The orphan-reap in (4) already removed
#     anything bound to the ports; this kills the tmux hosts
#     themselves so a fresh spawn gets a clean window.
#     Each new session runs the existing wrapper (run_vite.sh /
#     run_daphne.sh) so the inner pre-flight gates re-run for
#     defense-in-depth.
#
#  6. Live tail + port-LISTEN wait
#     Background `tail -F` streams both logs to dev-up's stdout (so an
#     operator running this in a tmux pane sees live boot progress).
#     Foreground poll /proc/net/tcp + tcp6 every second for ":3000" +
#     ":8000" in LISTEN state. Both going LISTEN within the timeout
#     means dev-up is done; partial failure prints a diagnostic + the
#     last 30 lines of each log so you don't have to attach to figure
#     out what went wrong.
#
#                           ◯  Customisation
# ─────────────────────────────────────────────────────────────────────
# DEV_UP_TIMEOUT — seconds to wait for both LISTEN. Default 30 (covers
#                  babel-lint + closure-leak + npm-vite warm-cache +
#                  daphne cold boot comfortably). Override:
#                    DEV_UP_TIMEOUT=60 bash dev-up.sh
#
# LOG_DIR         — directory where dev-up drops its {.vite,.daphne}.log
#                  tees. Default /tmp. Override:
#                    LOG_DIR=/var/log/devrose bash dev-up.sh

set -u

cd "$(dirname "$0")"

# ─── Phase 1: toolchain sanity ─────────────────────────────────────────────
# `command -v` is POSIX-portable; both node + tmux need to be on PATH so
# the syntax-lint call (node) and the detached spawn (tmux) work.
# Failing fast here is cheap and saves the user the "vite never came
# up, daphne never came up, dev-up silently half-launched" footgun.
command -v node >/dev/null 2>&1 \
  || { echo '❌ dev-up: node not in PATH — install Node.js first.'; exit 1; }
command -v tmux >/dev/null 2>&1 \
  || { echo '❌ dev-up: tmux not on PATH — install tmux first.'; exit 1; }

# ─── Phase 2: src/ syntax gate (delegated) ─────────────────────────────────
# Same babel-parse check run_vite.sh runs locally; we run it ONCE
# here so dev-up fails fast on bad code WITHOUT spinning up two tmux
# sessions just to print an error from each.
echo '🔎 [syntax] parsing src/ with @babel/parser...'
node "$(dirname "$0")/scripts/_pre-launch-syntax-lint.cjs" "$(dirname "$0")/src" \
  || { echo '❌ dev-up: src/ syntax lint failed — fix and retry.'; exit 1; }

# ─── Phase 3: closure-leak gate (delegated) ────────────────────────────────
# Same scan run_vite.sh does. Both pre-flight gates use the SAME
# scripts the per-server launchers invoke; one source of truth, no
# drift between dev-up's gate and the inner launcher's gate.
echo '🔎 [closure-leak] scanning src/ for module-level components that reference nested helpers...'
node "$(dirname "$0")/scripts/lint-closure-leak.cjs" \
  || { echo '❌ dev-up: closure-leak lint failed — fix and retry.'; exit 1; }

# ─── Phase 4: orphan-port reap (delegated) ─────────────────────────────────
# Clear :3000 (vite) and :8000 (daphne) just before spawn. The helper
# itself (kill-port.sh) prints a WARN line per killed orphan + a sudo
# hint if the orphan was cross-uid; port-free path is silent.
echo '🧹 [orphan-reap] clearing :3000 + :8000 before spawn...'
bash "$(dirname "$0")/scripts/kill-port.sh" 3000 "Vite"   || true
bash "$(dirname "$0")/scripts/kill-port.sh" 8000 "Daphne" || true

# ─── Phase 5: detached tmux spawn ──────────────────────────────────────────
# Kill any prior `devrose-vite` / `devrose-daphne` so re-running dev-up
# doesn't pile up zombie half-running tmux sessions. Reserved names
# `vite` / `daphne` (the user's own per-server launcher tmux names)
# are NOT touched here — the orchestrator's names are deliberately
# prefixed to avoid collision.
tmux kill-session -t devrose-vite   2>/dev/null || true
tmux kill-session -t devrose-daphne 2>/dev/null || true

LOG_DIR="${LOG_DIR:-/tmp}"
[ -d "$LOG_DIR" ] || { echo "❌ dev-up: LOG_DIR=$LOG_DIR does not exist" >&2; exit 1; }
VITE_LOG="$LOG_DIR/devrose-vite.log"
DAPHNE_LOG="$LOG_DIR/devrose-daphne.log"
# Truncate so live-tail in Phase 6 starts clean — a non-truncated
# prior-run log would dump stale content on every tmux attach.
: > "$VITE_LOG"
: > "$DAPHNE_LOG"

# Spawn detached. Each session runs the existing wrapper script
# (run_vite.sh / run_daphne.sh) so the inner pre-flight gates
# (syntax + closure-leak + port-cleanup) re-run for defense-in-depth.
# stdout + stderr tee'd to /tmp/devrose-{vite,daphne}.log so the
# Phase-6 tail has something to follow.
# Defensive quoting: the `\"$VITE_LOG\"` / `\"$DAPHNE_LOG\"` inside the
# tmux command line protects LOG_DIRs whose path contains whitespace
# (default /tmp is safe today; the override LOG_DIR=/var/log/devrose
# + a future site that has a space in its name would silently word-split
# the unquoted form). The outer shell receives the inner \"\" double-
# quotes intact, then hands the string to tmux as one argv, and tmux
# passes it to /bin/sh — sh sees the literal "..." and word-splits
# correctly even with spaces.
tmux new-session -d -s devrose-vite   "bash run_vite.sh   2>&1 | tee -a \"$VITE_LOG\""
tmux new-session -d -s devrose-daphne "bash run_daphne.sh 2>&1 | tee -a \"$DAPHNE_LOG\""

echo '🚀 [spawn] launched detached tmux sessions devrose-vite + devrose-daphne'

# ─── Phase 6: live tail + port-LISTEN wait ─────────────────────────────────
# /proc/net/tcp stores its local port in 4-hex upper-case and state
# 0A = LISTEN. We split the local_address cell on ":" and compare
# the last field to the expected hex port — sidesteps the awk regex
# anchoring confusion when `$` and `"` interact (cleaner than
# `$2 ~ ph "$"` with substitution gymnastics).
port_listening() {
  local port="$1"
  local hex
  printf -v hex '%04X' "$port"
  for f in /proc/net/tcp /proc/net/tcp6; do
    [ -r "$f" ] || continue
    awk -v want="$hex" '
      NR>1 && $4 == "0A" {
        n = split($2, p, ":")
        if (p[n] == want) exit 0
      }
      END { exit 1 }
    ' "$f" && return 0
  done
  return 1
}

# Background tail: streams both logs to dev-up's stdout so the
# operator running this in a tmux pane sees live boot progress.
# `tail -F` (capital F) keeps following after truncation/rename so
# the truncations we did before spawn don't break the stream.
tail -F "$VITE_LOG" "$DAPHNE_LOG" &
TAIL_PID=$!

# Initialize the OK flags BEFORE the loop so `set -u` doesn't trip
# reading them in the summary block if the loop body never runs
# (e.g. DEV_UP_TIMEOUT=0, defensive default).
vite_ok=0
daphne_ok=0

TIMEOUT_SECS="${DEV_UP_TIMEOUT:-30}"
echo "⏳ [wait] polling :3000 + :8000 for LISTEN (timeout ${TIMEOUT_SECS}s)..."
elapsed=0
while [ "$elapsed" -lt "$TIMEOUT_SECS" ]; do
  sleep 1
  elapsed=$((elapsed + 1))
  port_listening 3000; vite_ok=$?
  port_listening 8000; daphne_ok=$?
  if [ "$vite_ok" -eq 0 ] && [ "$daphne_ok" -eq 0 ]; then
    echo ""
    echo "✅ both ports LISTEN after ${elapsed}s"
    break
  fi
done

# Stop the tail so dev-up exits cleanly. `kill` is the right signum
# for tail's keep-tracking loop, and `wait` reaps it.
kill "$TAIL_PID" 2>/dev/null || true
wait "$TAIL_PID" 2>/dev/null || true

# ─── Final summary + remediation hints on partial failure ──────────────────
if [ "$vite_ok" -eq 0 ] && [ "$daphne_ok" -eq 0 ]; then
  echo ""
  echo "🎉 dev-up: both servers are live."
  echo "   vite   → http://127.0.0.1:3000"
  echo "   daphne → http://127.0.0.1:8000"
  echo ""
  echo "Tail their live logs:"
  echo "   tail -F $VITE_LOG $DAPHNE_LOG"
  echo ""
  echo "Attach to a tmux session:"
  echo "   tmux attach -t devrose-vite"
  echo "   tmux attach -t devrose-daphne"
  echo ""
  echo "Stop the stack:"
  echo "   tmux kill-session -t devrose-vite; tmux kill-session -t devrose-daphne"
  exit 0
else
  echo ""
  echo "❌ dev-up: timed out waiting after ${TIMEOUT_SECS}s"
  echo "   vite   :3000 $([ "$vite_ok" -eq 0 ] && echo 'OK' || echo 'NOT listening — see log below')"
  echo "   daphne :8000 $([ "$daphne_ok" -eq 0 ] && echo 'OK' || echo 'NOT listening — see log below')"
  echo ""
  echo "Last 30 lines of vite log   ($VITE_LOG):"
  tail -30 "$VITE_LOG"
  echo ""
  echo "Last 30 lines of daphne log ($DAPHNE_LOG):"
  tail -30 "$DAPHNE_LOG"
  exit 1
fi
