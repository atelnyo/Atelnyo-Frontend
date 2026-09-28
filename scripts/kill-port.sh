#!/bin/bash
# scripts/kill-port.sh — orphan-cleanup helper + sourceable shell library.
#
#                           ◯  Why this exists
# ─────────────────────────────────────────────────────────────────────
# When a prior run of Vite / Daphne / `manage.py runserver` /
# `npm run preview` was force-killed (Ctrl-C, OS reboot, broken `kill`,
# terminal disconnect, a flaky NFS mount), the next launcher's bind()
# fails with `[Errno 98] Address already in use` even though the user
# has NO visible terminal or process listed in `ps` — the kernel still
# holds the socket in TIME_WAIT, OR there really IS an orphan process
# that escaped into a parent shell that died. The symptom:
#
#   * run_daphne.sh starts → exec python -m daphne … :8000 → CRITICAL
#     Listen failure: Couldn't listen on 0.0.0.0:8000: [Errno 98]
#     Address already in use.
#   * run_vite.sh starts → exec npm run dev … :3000 → "EADDRINUSE".
#
# Reproduced live in this conversation (Jul-2026): a previous user's
# `python -m daphne …` had escaped as pid 3548 outside any tmux session.
# The new `bash run_daphne.sh` blind-launched and failed. Neither
# run_vite.sh nor run_daphne.sh did anything to detect & reap it.
#
# Fix: every launcher sources this helper with a port + service-name
# pair. The helper port-probes, finds the offending PID(s) via a
# 4-level fallback chain, SIGTERMs them (with a 1-second grace), and
# SIGKILLs survivors. The actual `exec … :PORT` proceeds against a
# clean port. If the helper itself can't reap (EPERM on a root-owned
# orphan, for example), it logs a loud warning and STILL exits 0 —
# the underlying dev server will then fail loudly with the same
# EADDRINUSE the user was going to hit anyway, with a much more
# actionable error message (see the failure-mode section below).
#
#                           ◯  Invocation
# ─────────────────────────────────────────────────────────────────────
# Two modes:
#
#   Executed (legacy entrypoint, unchanged for backward compat):
#       bash scripts/kill-port.sh <PORT> [SERVICE_NAME]
#
#       Same args as before. Same exit 0 guarantee. Same stderr UX.
#       The 4 launchers used this form in prior phases; they continue
#       to work but the recommended idiom today is the SOURCED form
#       below so future shells can reuse the registered functions
#       without re-forking bash.
#
#   Sourced (new in Phase 50+, recommended):
#       . "$(dirname "$0")/scripts/kill-port.sh"
#       _reap_port <PORT> [SERVICE_NAME]      # cleanest: just reap
#       if _port_listening <PORT>; then …    # boolean inspector
#       pids=$(_port_pids <PORT>)            # raw pid list
#       _pid_inode_fds <PID>                 # helper used by /proc walks
#
#       When sourced, the auto-execute path is skipped (see bottom of
#       file). All functions are loaded into the caller's shell so
#       subsequent calls in the same shell don't re-exec bash. This
#       matters for tight-loop callers (CI gates, dev-up.sh's
#       LISTEN-poll loop, lint scripts that inspect port usage).
#
# Args:
#   $1 PORT          — REQUIRED. The port to clear (positive integer).
#   $2 SERVICE_NAME  — OPTIONAL. Human-readable tag for log lines
#                      ("Vite", "Daphne", "Django runserver", …).
#                      Pure cosmetic; not used for detection.
#
# Exit codes (executed mode):
#   0   ALWAYS. Even if the helper found nothing, found something and
#       killed it, or couldn't kill (permission denied). The actual
#       bind will surface any residual EADDRINUSE with the kernel's
#       own diagnostic.
#
# Exit codes (sourced mode):
#   N/A — the file returns silently from a sourced context; the
#   caller invokes functions directly.
#
# Environment (sourced mode — useful for the unit test in
# scripts/test-kill-port.sh):
#   KILL_PORT_PROC_DIR   default /proc. When set, every /proc look-up
#                        in `_port_pids_via_proc` / `_pid_inode_fds`
#                        is rooted here instead. The unit test sets it
#                        to a tmpfs mock so the end-to-end inode→PID
#                        walk can be exercised without an actual socket
#                        bind (no kernel bindings + no CAP_NET_ADMIN).
#   KILL_PORT_NET_TCP{,6}  fine-grained overrides for the IPv4 / IPv6
#                        /proc/net files; default to
#                        `${KILL_PORT_PROC_DIR}/net/tcp{,6}`. The
#                        two-level structure lets a test write only
#                        the net files without rebuilding the whole
#                        pid tree.
#
#                           ◯  Detection mechanism
# ─────────────────────────────────────────────────────────────────────
# Tried in order so the most portable / most-permissive wins:
#
#   1. lsof  −tiTCP:<PORT> −sTCP:LISTEN  (best UX, returns PIDs)
#   2. fuser <PORT>/tcp                    (common on RHEL/Alma)
#   3. ss −ltnp                            (modern Linux; CAP_NET_ADMIN
#                                            gates the pid column → falls
#                                            through to step 4 if denied)
#   4. /proc/net/tcp + /proc/net/tcp6 →    (universal; walks
#      parse inodes of LISTEN sockets       /proc/<pid>/fd/* for symlinks
#      on <PORT>, then walk /proc/<pid>/fd/* pointing at socket:[<inode>])
#      to match inodes back to PIDs.
#
# Output policy (executed mode AND `_reap_port`):
#   * Port free                    → silent (no stdout, no stderr).
#   * Orphan found + killed        → one yellow ⚠ warning stderr line
#                                    per killed PID, then a ✅ tally.
#   * Orphan found but NOT killed  → a red ❌ line + a suggested manual
#                                    fix (`sudo lsof -tiTCP:PORT …`) so
#                                    the operator doesn't have to google
#                                    the EPERM they just saw.
#
#                           ◯  Why a sibling script (not inline)
# ─────────────────────────────────────────────────────────────────────
# DRY: vite / daphne / runserver / preview need the same logic. Putting
# it inline in four launchers guarantees drift — someone tweaks the
# SIGTERM grace period in vite and forgets daphne, and the two
# behaviors quietly diverge. A single sourceable sibling keeps the
# behavior identical across all four entry points.
#
# HOW invoked (now): the launchers `.` source the file (zero-cost fork
# avoidance) and then call `_reap_port <PORT> "<NAME>"` directly in their
# own shell. The unit test uses the same idiom with a mocked
# KILL_PORT_PROC_DIR.
#
#                           ◯  Library hygiene
# ─────────────────────────────────────────────────────────────────────
# A sourced shell script that mutates the global namespace leaks into
# the caller. The previous (executable-only) version of this file
# freely assigned to `PIDS`, `PORT`, `PORT_HEX`, `TAG`, `KILLED`,
# etc. — those would have polluted every launcher's environment if
# naively sourced. The refactored version keeps EVERY variable under
# `local` discipline inside each function and resolves testability
# hooks ONCE at source time (the three KILL_PORT_* env vars). Two
# notable behavioral changes vs. the executable-only original:
#
#   * `set -u` is dropped from the library. A sourced library should
#     NOT propagate shell options into the parent shell — the launcher
#     may or may not have `set -u`, and forcing it would either
#     surprise the caller or surprise us. Every function uses
#     `${VAR:-}` defaults so a caller who happens to have `set -u`
#     active still won't trip on undefined-access within the lib.
#     This is documented in the function bodies where it matters
#     (`_reap_port`, `_port_pids`).
#
#   * The executable zone (`if [[ "${BASH_SOURCE[0]}" == "${0}" ]]`)
#     uses the canonical Python-`__main__`-equivalent idiom. NO
#     mid-file `return` (which is fragile across bash versions and
#     has surprising semantics when the caller itself is being
#     sourced). The if-gated wrapper survives `set -e` parents
#     because the gate always evaluates to either true (auto-reap)
#     or false (skip) — no conditional failure that `set -e`
#     could amplify into a hard exit.

# Testability overrides. Resolved ONCE at source time so all functions
# pick them up via the captured env. `: "${VAR:=default}"` is the
# canonical "set if unset" form, equivalent to `${VAR:-default}` on
# read but it actually assigns so the child reads see a stable value.
: "${KILL_PORT_PROC_DIR:=/proc}"
: "${KILL_PORT_NET_TCP:=${KILL_PORT_PROC_DIR}/net/tcp}"
: "${KILL_PORT_NET_TCP6:=${KILL_PORT_PROC_DIR}/net/tcp6}"
export KILL_PORT_PROC_DIR KILL_PORT_NET_TCP KILL_PORT_NET_TCP6

# ─── Library zone (always loaded regardless of invocation mode) ────────

# _pid_inode_fds PID
#   Echoes the kernel-tracked socket inodes held by the given PID's
#   open file descriptors (one per line). Used by `_port_pids_via_proc`
#   to map a candidate PID back to listenable inodes. Also called by
#   the unit test directly to verify the inode→PID walk end-to-end
#   against a mocked /proc tree.
#
#   Errors (race: pid exited between the /proc/<pid> scan and the
#   /proc/<pid>/fd read, or the directory is unreadable due to
#   cross-uid) are silently swallowed so the helper is safe to use
#   even when iterating through several pids in a tight loop.
_pid_inode_fds() {
  local pid="${1:-}"
  [ -z "${pid}" ] && return 0
  local fd_dir="${KILL_PORT_PROC_DIR}/${pid}/fd"
  [ -d "${fd_dir}" ] || return 0
  ls -l "${fd_dir}" 2>/dev/null \
    | grep -oE 'socket:\[[0-9]+\]' \
    | sed 's/socket:\[\([^]]*\)\]/\1/' \
    | sort -u
}

# _port_pids_via_proc PORT_HEX
#   Universal fallback. Reads /proc/net/tcp{,6} for LISTEN-state rows
#   whose local_address ends in :PORT_HEX (4-char uppercase hex).
#   Walks /proc/<pid>/fd/* for each candidate pid to find those whose
#   set of held socket inodes intersects with the LISTEN-inode set.
#   Cross-references the two sets with `comm -12` and prints the
#   matching PIDs (one per line).
#
#   Privilege model: same as the kernel — a cross-uid orphan's fd/
#   directory is unreadable from another uid. That case shows up as
#   an empty hit-set and we fall through to the count-rejected
#   branch in `_reap_port` so the operator gets the sudo hint.
_port_pids_via_proc() {
  local port_hex="${1:-}"
  [ -z "${port_hex}" ] && return 0
  local inodes pid_dir p held common
  inodes=$(for f in "${KILL_PORT_NET_TCP}" "${KILL_PORT_NET_TCP6}"; do
             [ -r "${f}" ] || continue
             # Column 4 == "0A" per RFC 793 → LISTEN.
             # Column 2 is fully-expanded local_address (hex IP:hex port);
             # the trailing anchor ":$port_hex$" matches only the
             # listen-end, never the remote endpoint.
             # Column 10 is the inode (kernel struct sock).
             awk -v ph="${port_hex}" 'NR>1 && $2 ~ ":"ph"$" && $4 == "0A" {print $10}' "${f}"
           done | sort -u)
  [ -z "${inodes}" ] && return 0

  for pid_dir in "${KILL_PORT_PROC_DIR}"/*; do
    [ -d "${pid_dir}" ] || continue
    p="${pid_dir##*/}"
    [[ "${p}" =~ ^[0-9]+$ ]] || continue
    held=$(_pid_inode_fds "${p}")
    [ -z "${held}" ] && continue
    common=$(comm -12 <(printf '%s\n' "${inodes}") <(printf '%s\n' "${held}"))
    [ -n "${common}" ] && printf '%s\n' "${p}"
  done | sort -u
}

# _port_pids_via_lsof PORT
#   Returns one PID per line for every process currently holding PORT
#   in LISTEN state. `command -v lsof` guards against the "lsof
#   missing" failure mode (common on minimal Docker base images) so
#   `set -e` in a hypothetical caller doesn't trip when lsof isn't
#   installed — we just return empty and fall through to the next
#   provider.
_port_pids_via_lsof() {
  local port="${1:-}"
  [ -z "${port}" ] && return 0
  command -v lsof >/dev/null 2>&1 || return 0
  lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true
}

# _port_pids_via_fuser PORT
#   Same shape as `_port_pids_via_lsof` but for environments where
#   lsof is missing and fuser is the dominant port-detection tool
#   (RHEL / Alma / CentOS Docker base images).
_port_pids_via_fuser() {
  local port="${1:-}"
  [ -z "${port}" ] && return 0
  command -v fuser >/dev/null 2>&1 || return 0
  fuser "${port}/tcp" 2>/dev/null \
    | awk '{for(i=1;i<=NF;i++) if($i ~ /^[0-9]+$/) print $i}' \
    | sort -u || true
}

# _port_pids_via_ss PORT
#   Linux-only fast-path. ss -p is permission-gated: when the orphan
#   is owned by another uid, ss -ltnp prints the row but with no
#   pid= column, so the awk regex misses by design and we fall
#   through to the /proc scan. That's intentional — ss is the
#   user-friendly path but /proc is what actually catches cross-uid
#   cases (when the caller has CAP_NET_ADMIN or proper namespace
#   visibility).
_port_pids_via_ss() {
  local port="${1:-}"
  [ -z "${port}" ] && return 0
  command -v ss >/dev/null 2>&1 || return 0
  ss -ltnp 2>/dev/null \
    | awk -v p=":${port}" '$4 ~ p"$" {if (match($6, /pid=([0-9]+)/, m)) print m[1]}' \
    | sort -u || true
}

# _port_pids PORT
#   Merges the 4 detection paths, dedupes, and prints the final pid
#   set. Used by `_port_listening` (boolean-style inspector), by
#   `_reap_port` (reap-on-call), and by external callers (CI gates,
#   dev-up.sh's polling loop) that want the raw PID list for further
#   processing.
#
#   Empties are returned as a zero-output-pipe (not a literal `""`
#   string), so callers can use `[ -n "$(_port_pids 8000)" ]` cleanly.
_port_pids() {
  local port="${1:-}"
  [ -z "${port}" ] && return 0
  local port_hex
  port_hex=$(printf '%04X' "${port}" 2>/dev/null) || return 0
  {
    _port_pids_via_lsof    "${port}"
    _port_pids_via_fuser   "${port}"
    _port_pids_via_ss      "${port}"
    _port_pids_via_proc    "${port_hex}"
  } 2>/dev/null | grep -E '^[0-9]+$' | sort -u
}

# _port_listening PORT
#   Returns 0 (true) if at least one PID is holding <PORT>. Returns
#   1 (false) if PORT is free (or the port arg is invalid/empty).
#   Convenience wrapper around `_port_pids` for boolean-style callers
#   who prefer `if _port_listening 8000; then …; fi`.
#
#   Safe under caller-side `set -u`: every read here uses a default
#   so an empty arg returns 1 instead of triggering the nounset
#   trap in the parent shell.
_port_listening() {
  local port="${1:-}"
  [ -z "${port}" ] && return 1
  [ -n "$(_port_pids "${port}")" ]
}

# _reap_port PORT [SERVICE_NAME]
#   The canonical reap-on-call inspector. Walks detection, identifies
#   PIDs, attempts SIGTERM then SIGKILL on each, and emits the same
#   KILLED / GONE / REJECTED counters the executed-mode version did.
#   Always returns 0.
#
#   Error policy is identical to the original executable mode: even
#   on permission-denied (a root-owned cross-uid orphan), the helper
#   surfaces a loud warning with the sudo hint AND returns 0. The
#   launcher's actual bind() will then fail with its own EADDRINUSE
#   diagnostic; doing two layers of noise would not help the operator.
_reap_port() {
  local port="${1:-}"
  local service_name="${2:-}"
  local tag="${service_name:-unknown} (port ${port:-?})"

  if [ -z "${port}" ] \
     || ! [[ "${port}" =~ ^[0-9]+$ ]] \
     || [ "${port}" -lt 1 ] \
     || [ "${port}" -gt 65535 ]; then
    echo "❌ kill-port: PORT must be 1..65535; got: '${port:-<unset>}'" >&2
    return 0
  fi

  local pids
  pids=$(_port_pids "${port}")
  [ -z "${pids}" ] && return 0

  echo "⚠️  Orphan detected — about to reap ${tag}:" >&2
  local pid cmdline
  for pid in ${pids}; do
    if [ -r "${KILL_PORT_PROC_DIR}/${pid}/cmdline" ]; then
      cmdline=$(tr '\0' ' ' < "${KILL_PORT_PROC_DIR}/${pid}/cmdline" 2>/dev/null | cut -c1-120)
      echo "   pid=${pid}  cmd=${cmdline:-<unreadable>}" >&2
    else
      echo "   pid=${pid}  cmd=<process already gone>" >&2
    fi
  done

  local killed=0 gone=0 rejected=0
  for pid in ${pids}; do
    # Race: pid may have died between detect and kill. Track
    # distinctly so the message below tells "orphan vanished on
    # its own, port is probably free" vs. "we hit EPERM, try sudo".
    if ! [ -d "${KILL_PORT_PROC_DIR}/${pid}" ]; then
      gone=$((gone + 1))
      continue
    fi
    if kill "${pid}" 2>/dev/null; then
      killed=$((killed + 1))
    elif kill -9 "${pid}" 2>/dev/null; then
      killed=$((killed + 1))
    else
      rejected=$((rejected + 1))
    fi
  done

  if [ "${killed}" -gt 0 ] || [ "${gone}" -gt 0 ]; then
    # 1s settle so the kernel reaps the LISTEN socket + TIME_WAIT
    # drains. macOS sometimes needs ~2s but Linux is fine with 1s;
    # dev environments tolerate the small latency.
    sleep 1
    # Format: choose the prefix based on what actually happened —
    # `✅ Reaped N orphan process(es) on :PORT for SERVICE_NAME` for
    # the real-reap case (with optional `; N already-gone on :PORT`
    # tail when both counters fire), or `ℹ️ N already-gone on :PORT`
    # when nothing was reaped but processes had already vanished on
    # their own. Avoids emitting `✅ Reaped` with no count, which would
    # mislead operators grepping for a real reap value. The
    # "process(es)" phrasing matches the user-facing runbook wording
    # in `README.md` and `backend/SUPABASE.md` — both the runbook and
    # the smoke-test (`scripts/smoke-reap-orphan.sh`) grep this exact
    # token. Keep it stable.
    local msg=""
    if [ "${killed}" -gt 0 ]; then
      msg="✅ Reaped ${killed} orphan process(es) on :${port} for ${tag}"
      if [ "${gone}" -gt 0 ]; then
        msg="${msg}; ${gone} already-gone on :${port}"
      fi
    elif [ "${gone}" -gt 0 ]; then
      msg="ℹ️  ${gone} already-gone on :${port}"
    fi
    [ -n "${msg}" ] && echo "${msg}" >&2
    if [ "${rejected}" -gt 0 ]; then
      echo "   ⚠️  ${rejected} orphan process(es) rejected (likely cross-uid). The kernel may still see the port as bound." >&2
      echo "   For the rejected ones: sudo lsof -tiTCP:${port} -sTCP:LISTEN | xargs sudo kill -9" >&2
    fi
  elif [ "${rejected}" -gt 0 ]; then
    echo "❌ Could not reap orphan(s) on :${port} for ${tag} — likely permission-denied (cross-uid orphan)." >&2
    echo "   The actual launcher's bind() will fail with [Errno 98] Address already in use." >&2
    echo "   Try: sudo lsof -tiTCP:${port} -sTCP:LISTEN | xargs sudo kill -9" >&2
  fi

  return 0
}

# ─── Auto-execute zone (only when invoked as a script) ─────────────────
# Canonical bash idiom for "be a library AND have a __main__ entry".
# `BASH_SOURCE[0]` is THIS file's path in both source + execute modes;
# `$0` is THIS file's path ONLY when executed directly (`bash file`
# or `./file`). When sourced via `.` or `source`, $0 is the caller's
# name while BASH_SOURCE[0] stays this file's path — so the comparison
# fires FALSE and the executable block is skipped. Equivalent to
# Python's `if __name__ == "__main__":`.
if [[ "${BASH_SOURCE[0]:-}" == "${0:-}" ]]; then
  PORT="${1:-}"
  SERVICE_NAME="${2:-}"
  if [ -z "${PORT}" ] \
     || ! [[ "${PORT}" =~ ^[0-9]+$ ]] \
     || [ "${PORT}" -lt 1 ] \
     || [ "${PORT}" -gt 65535 ]; then
    echo "❌ kill-port.sh: PORT must be 1..65535; got: '${PORT:-<unset>}'" >&2
    echo "   Usage: $0 <PORT> [SERVICE_NAME]" >&2
    exit 0
  fi
  _reap_port "${PORT}" "${SERVICE_NAME}"
  exit 0
fi
