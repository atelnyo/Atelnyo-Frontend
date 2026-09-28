#!/bin/bash
# run_preview.sh — launcher for ``npm run preview``, Vite's built-
# mode server (serves the production ``dist/`` bundle so an operator
# can sanity-check the prod build locally without a real host).
#
# This launcher pairs with ``run_vite.sh`` for the
# "I just ran ``npm run build`` and want to spot-check the result
# via a real HTTP server (not file://)" workflow. Their ports don't
# collide (preview defaults to :4173, dev defaults to :3000), so
# running both side-by-side is FINE — each gate clears its own port
# and neither touches the other.
#
# Usage:  bash run_preview.sh        # serves dist/ on :4173
#         Ctrl-C to stop.
#
cd "$(dirname "$0")"

# ─── Orphan-port cleanup (pre-exec gate) ──────────────────────────────────
# ``vite preview`` binds :4173 by default. Without this gate, a
# stale ``npm run preview`` from a prior dev session blocks the new
# launch with EADDRINUSE — and unlike :3000/:8000 (which have their
# own gates), :4173 had NO wrapper script at all, so nobody noticed
# the missing cleanup until a user ran preview-then-preview. The
# helper (scripts/kill-port.sh) does the detection + reap; see its
# design comment for the 4-level fallback (lsof → fuser → ss →
# /proc) and the always-exit-0 rationale.
. "$(dirname "$0")/scripts/kill-port.sh"
_reap_port 4173 "Vite preview" || true

exec npm run preview -- --host 0.0.0.0 --port 4173
