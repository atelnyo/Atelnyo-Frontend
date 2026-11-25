/**
 * src/components/studio/studioEvents.js
 *
 * A one-line signal that the creator's workspace CHANGED.
 *
 * The overview store (nav badges, KPI strip, checklist) is refreshed by the
 * shell on navigation and on tab focus. That leaves one gap: a creator who
 * publishes a course and stays on the same screen still sees the old badge.
 *
 * Sections and the Studio modals call ``notifyStudioChanged()`` after a
 * mutation really succeeded (never optimistically — a failed delete must
 * not invalidate the cache). ``onStudioChanged`` is the shell's single
 * subscription, which turns the signal into ``refreshOverview()``.
 *
 * Deliberately tiny and DOM-based: no context provider, no store library,
 * and safe in non-browser test environments.
 */

export const STUDIO_CHANGED_EVENT = 'atelnyo:studio:changed';

export function notifyStudioChanged(detail = {}) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }
  window.dispatchEvent(new CustomEvent(STUDIO_CHANGED_EVENT, { detail }));
}

/**
 * @param {(detail: object) => void} handler
 * @returns {() => void} unsubscribe
 */
export function onStudioChanged(handler) {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }
  const listener = (event) => handler(event?.detail || {});
  window.addEventListener(STUDIO_CHANGED_EVENT, listener);
  return () => window.removeEventListener(STUDIO_CHANGED_EVENT, listener);
}
