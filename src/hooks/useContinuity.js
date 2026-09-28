/**
 * src/hooks/useContinuity.js
 *
 * CONTINUITY CONSUMER HOOK — the app root's single connection to the
 * Continuity Manager (src/pwa/continuity/ContinuityManager.js). The
 * manager OWNS launch context, the last-active clock and return-to-app
 * signals; this hook wires the three UI contracts:
 *
 *   1. noteActive()      — passive listeners record every meaningful
 *                          interaction (pointer / key / touch / scroll)
 *                          so the last-active clock stays honest (the
 *                          manager throttles the persistence itself).
 *   2. Restore point     — on a RETURN relaunch, fetch the persisted
 *                          restore point (activeTab / lang / scroll /
 *                          …) ONCE and hand it to onRestorePoint. A
 *                          FIRST launch has no restore point by
 *                          definition; a failed fetch is a nicety
 *                          missed, never a gate.
 *   3. Session signals   — the RISING EDGES of ``returned`` (the app
 *                          came back to the foreground after a gap ≥
 *                          the return threshold) and ``staleSession``
 *                          (the user was away longer than the policy)
 *                          are reported so the app can re-validate the
 *                          auth session before the user continues.
 *
 * All callbacks are optional; the hook is safe to mount anywhere
 * (guards window/Node). The app reads and writes restore-point data
 * through the manager's façades only — components never import
 * appStateStore directly.
 */
import { useEffect, useRef } from 'react';
import continuityManager from '../pwa/continuity/ContinuityManager.js';

// Low-frequency interaction events (scroll is wired separately — it is
// high-frequency and must stay a passive listener).
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart'];

export function useContinuity({
  onRestorePoint,
  onReturned,
  onStale,
} = {}) {
  // ── 1. noteActive(): record every meaningful interaction ────────
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onActivity = () => continuityManager.noteActive();
    const onScroll = () => continuityManager.noteActive();
    ACTIVITY_EVENTS.forEach((ev) => {
      window.addEventListener(ev, onActivity, { passive: true });
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      ACTIVITY_EVENTS.forEach((ev) => {
        window.removeEventListener(ev, onActivity);
      });
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // ── 2. Restore point: fetch ONCE on a RETURN relaunch ───────────
  const restoreFiredRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!continuityManager.isRelaunch()) return undefined;
    if (restoreFiredRef.current) return undefined;
    restoreFiredRef.current = true;
    let alive = true;
    continuityManager.getRestorePoint()
      .then((point) => {
        if (alive) onRestorePoint?.(point);
      })
      .catch(() => {
        // A restore point is a nicety, never a gate — a failed read
        // must not block the app shell.
      });
    return () => { alive = false; };
  }, [onRestorePoint]);

  // ── 3. returned / staleSession rising edges → callbacks ─────────
  // `prev` lives in a ref so a re-subscribe (callback identity change)
  // never forgets the last seen edge and re-fires a stale signal.
  const prevRef = useRef({ returned: false, stale: false });
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    return continuityManager.subscribe((state) => {
      const prev = prevRef.current;
      if (state.returned && !prev.returned) onReturned?.();
      if (state.sessionStatus === 'stale' && !prev.stale) onStale?.();
      prev.returned = state.returned === true;
      prev.stale = state.sessionStatus === 'stale';
    });
  }, [onReturned, onStale]);
}

export default useContinuity;
