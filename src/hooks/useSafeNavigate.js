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
import { useNavigate } from 'react-router-dom';

/**
 * Returns a safe navigate function. If useNavigate() throws (Cloud
 * Shell stale-SW cache), returns a no-op that silently fails instead
 * of crashing the component.
 */
export function useSafeNavigate() {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useNavigate();
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
