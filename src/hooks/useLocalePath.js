/**
 * src/hooks/useLocalePath.js
 *
 * Phase 4 — derive the locale-aware path values from the router location.
 *
 * Returns (memoized on the location object):
 *   • parsedLocale       — parseLocaleCountry(location.pathname)
 *   • effectivePathname  — the path WITHOUT a leading valid locale segment
 *                          ('/ht-HT/explore' → '/explore'; bare paths unchanged)
 *   • effectiveLocation  — a location-like object remapped to the stripped
 *                          path, passed to <Routes location={...}> so the SAME
 *                          route tree serves bare AND localized URLs
 *
 * WHY a dedicated hook: the react-hooks v7 compiler (preserve-manual-
 * memoization) refuses to preserve App.jsx's pre-existing useCallback
 * memos when the raw parseLocaleCountry() return value is read inside
 * App's body — it can't prove the object is stable. Reading it here,
 * behind a custom hook + useMemo, keeps the values opaque to the
 * compiler (exactly like the useLocation() result) so App's own hooks
 * stay fully analyzable.
 */
import { useMemo } from 'react';
import { parseLocaleCountry } from '../utils/localeUrl';

export default function useLocalePath(location) {
  return useMemo(() => {
    const pathname = location?.pathname || '';
    const parsedLocale = parseLocaleCountry(pathname);
    const effectivePathname = parsedLocale.valid
      ? (parsedLocale.rest || '/')
      : pathname;
    return {
      parsedLocale,
      effectivePathname,
      effectiveLocation: parsedLocale.valid
        ? { ...location, pathname: effectivePathname }
        : undefined,
    };
  }, [location]);
}
