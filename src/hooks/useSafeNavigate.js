/**
 * src/hooks/useSafeNavigate.js
 *
 * Safe wrapper around react-router-dom's useNavigate().
 *
 * Cloud Shell Web Preview injects scripts that can corrupt React's
 * internal dispatcher for pre-bundled dependencies (react-router-dom).
 * When useNavigate() calls React.useContext() internally, it crashes
 * with "Cannot read properties of null (reading 'useContext')".
 *
 * This hook catches that error and returns a no-op navigate function
 * instead, allowing the component to render without navigation rather
 * than crashing the entire page.
 *
 * Usage:
 *   import { useSafeNavigate } from '../hooks/useSafeNavigate';
 *   const navigate = useSafeNavigate();
 *   // navigate(url) or navigate(-1) — safe even in Cloud Shell
 */
import { startTransition } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Returns a safe navigate function. If useNavigate() throws (Cloud
 * Shell stale-SW cache), returns a no-op that silently fails instead
 * of crashing the component.
 *
 * Every successful navigation is wrapped in React.startTransition:
 * most routes are React.lazy chunks, and a navigation that triggers a
 * chunk load from a synchronous click handler (discrete input) makes
 * React throw minified error #426 — "A component suspended while
 * responding to synchronous input... updates that suspend should be
 * wrapped with startTransition". Centralizing the wrap here protects
 * every useSafeNavigate() call site at once.
 */
export function useSafeNavigate() {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const navigate = useNavigate();
    // Guard: if useNavigate() returned undefined (not a function),
    // treat it as unavailable — do NOT return undefined, return a
    // no-op that is itself a function so callers can always invoke it.
    if (typeof navigate !== 'function') {
      const noop = (_url, _opts) => undefined;
      noop.safe = true;
      return noop;
    }
    return (url, opts) => startTransition(() => navigate(url, opts));
  } catch (e) {
    // Cloud Shell proxy / stale service worker cache corrupted
    // React's dispatcher for the pre-bundled react-router-dom.
    // Log once per mount so the console isn't spammed.
    if (typeof window !== 'undefined' && !window.__atelnyo_nav_warned) {
      window.__atelnyo_nav_warned = true;
      console.warn(
        '[useSafeNavigate] navigation unavailable — Cloud Shell SW cache ' +
        'may be serving stale react-router-dom. Hard-refresh (Ctrl+Shift+R) ' +
        'to fix, or use SSH tunnel to bypass the proxy.',
      );
    }
    // Return a no-op navigate that silently does nothing.
    // The component still renders; navigation buttons just won't work.
    const noop = (_url, _opts) => undefined;
    noop.safe = true; // marker for debugging
    return noop;
  }
}

export default useSafeNavigate;
