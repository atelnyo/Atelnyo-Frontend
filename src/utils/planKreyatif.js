// src/utils/planKreyatif.js
//
// 'Plan Kreyatif' master-toggle hook — gates modals/dialogs/overlays
// declared in the Settings panel so they only render when explicitly
// opted-in. Mirrors the `useRoleGate(action)` shape at
// ``src/hooks/useRoleGate.js`` (PWA Permission Manager) so the two
// hooks feel interchangeable to callers.
//
// Why a hook (vs inlining localStorage reads in every component):
//
// * Same-tab reactivity — Settings.jsx renders the toggle; a
//   gating FAB / modal in another section (e.g. a FAB mounted by
//   App.jsx) might be mounted already when the user flips the
//   toggle. Without a hook + CustomEvent fan-out, the gated
//   component wouldn't see the change unless it polled localStorage
//   on every render. The hook subscribes to `atelnyo:plan-kreyatif-changed`
//   on mount and the toggle dispatches the same event so any
//   subscribed hook re-renders.
//
// * Cross-tab sync — the browser's native 'storage' event fires
//   when ANOTHER tab writes the same localStorage key (NOT on the
//   same tab). The hook listens for it too so toggling Plan Kreyatif
//   in one tab updates gated components in every open tab in real
//   time. Without this, opening `/sheet/atelier` in two tabs means
//   flipping the toggle in tab A leaves tab B's state stale until the
//   user toggles it again in tab B.
//
// * Single source of truth — the localStorage key `atelnyo_plan_kreyatif`
//   is the canonical place to read from. Direct `localStorage.getItem(...)`
//   reads from a component still work (the hook will re-validate after
//   a write event) but using the hook guarantees reactivity.
//
// Storage conventions — matches the existing `atelnyo_sonic_ui` /
// `atelnyo_cyber_cursor` pattern at src/components/Settings.jsx:
//
//   * key: `atelnyo_plan_kreyatif`
//   * values: literal strings 'true' / 'false'
//   * default: false (the user has to opt-in)
//
// Usage:
//
//   // In Settings.jsx (the toggle source):
//   const { enabled, toggle } = usePlanKreyatif();
//   ... `<input checkbox checked={enabled} onChange={(e) => toggle(e.target.checked)} />`
//
//   // In PlanKreatorAssistant.jsx (any component that wants to gate):
//   const { enabled } = usePlanKreyatif();
//   if (!enabled) return null;
//   ... render the FAB / modal / banner

import { useState, useEffect } from 'react';

export const PLAN_KREYATIF_STORAGE_KEY = 'atelnyo_plan_kreyatif';
const CUSTOM_EVENT = 'atelnyo:plan-kreyatif-changed';

function readStored(initialOverride) {
  if (typeof initialOverride === 'boolean') return initialOverride;
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PLAN_KREYATIF_STORAGE_KEY) === 'true';
  } catch (_) {
    // localStorage can throw in disabled-private-mode / sandboxed iframes.
    // Default to false rather than crashing the gating component.
    return false;
  }
}

export function usePlanKreyatif({ initial } = {}) {
  const [enabled, setEnabled] = useState(() => readStored(initial));

  // Cross-tab + same-tab fan-out. Both listeners live in the same
  // useEffect so a single unmount tears them down cleanly, and
  // the cleanup function is stable across renders (empty deps).
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onSameTab = () => setEnabled(readStored(initial));
    const onCrossTab = (e) => {
      if (e.key !== PLAN_KREYATIF_STORAGE_KEY) return;
      setEnabled(e.newValue === 'true');
    };
    window.addEventListener(CUSTOM_EVENT, onSameTab);
    window.addEventListener('storage', onCrossTab);
    return () => {
      window.removeEventListener(CUSTOM_EVENT, onSameTab);
      window.removeEventListener('storage', onCrossTab);
    };
  }, [initial]);

  // toggle(next) — write to localStorage, update local state, then
  // dispatch the same-tab fan-out event. The 'storage' event does
  // NOT fire on same-tab writes, hence the manual dispatch.
  const toggle = (next) => {
    const value = typeof next === 'boolean' ? next : !enabled;
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PLAN_KREYATIF_STORAGE_KEY, value ? 'true' : 'false');
      }
    } catch (_) {
      // Quota / disabled-private-mode — local state still flips
      // so the user sees the optimistic flip; the persistence
      // will retry on the next page load.
    }
    setEnabled(value);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(CUSTOM_EVENT));
    }
  };

  return { enabled, toggle };
}
