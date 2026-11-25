/**
 * src/components/studio/studioOverview.js
 *
 * Shared snapshot of ``GET /api/studio/overview/``.
 *
 * Three places need the same workspace numbers at the same moment: the
 * sidebar badges, the (published-only) onboarding checklist and the
 * dashboard KPI strip. Fetching per component meant duplicate requests and
 * three different moments of truth — a creator could see "3 drafts" in the
 * nav while the strip said "4".
 *
 * This module is the single owner:
 *   • ``refreshOverview()`` is single-flight — concurrent callers share one
 *     request, and the promise is released the moment it settles.
 *   • subscribers get every successful snapshot, so all consumers update
 *     together.
 *   • a FAILED refresh keeps the last good snapshot and reports the error;
 *     it never replaces real numbers with zeros.
 *
 * Sidebar/KPI refresh is driven by the shell (section change + tab focus),
 * so publishing a course or handling an order shows up without a reload.
 */
import { useCallback, useEffect, useState } from 'react';
import { studioService } from '../../services/api';

let snapshot = null;
let inFlight = null;
const listeners = new Set();

function publish(next, error = null) {
  snapshot = next;
  listeners.forEach((listener) => {
    try {
      listener(next, error);
    } catch {
      // One broken consumer must not stop the others.
    }
  });
}

export function refreshOverview() {
  if (inFlight) return inFlight;

  inFlight = studioService.overview()
    .then((res) => {
      const next = res?.data || null;
      publish(next);
      return next;
    })
    .catch((error) => {
      // Keep the last good snapshot — a transient failure is not "empty".
      publish(snapshot, error);
      return snapshot;
    })
    .finally(() => { inFlight = null; });

  return inFlight;
}

/** @returns {() => void} unsubscribe */
export function subscribeOverview(listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useStudioOverview(enabled = true) {
  const [state, setState] = useState(() => ({
    data: snapshot,
    error: null,
    loading: enabled && snapshot == null,
  }));

  useEffect(() => {
    if (!enabled) return undefined;
    const unsubscribe = subscribeOverview((data, error) => {
      setState({ data, error: error || null, loading: false });
    });
    refreshOverview();
    return unsubscribe;
  }, [enabled]);

  // Explicit retry (LoadError): only show the spinner when there is
  // nothing to show yet — a stale number beats a flash of empty layout.
  const refresh = useCallback(() => {
    setState((s) => ({ ...s, loading: s.data == null }));
    return refreshOverview();
  }, []);

  return { ...state, refresh };
}

/** Test-only: module state must not leak between cases. */
export function resetOverviewCache() {
  snapshot = null;
  inFlight = null;
  listeners.clear();
}
