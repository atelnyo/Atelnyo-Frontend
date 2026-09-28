/**
 * src/seo/NoindexRoute.jsx
 *
 * Drop-in component that injects a <meta name="robots" content="noindex,nofollow">
 * tag for private/authenticated routes. Render it once in App.jsx — it
 * reads the current route from React Router and applies noindex when the
 * route matches a private path.
 *
 * Usage:
 *   <NoindexRoute />
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getRobotsDirective } from './seoConfig';
import { stripLocale, parseLocaleCountry } from '../utils/localeUrl';

// Paths that must always be noindex (private/authenticated)
const PRIVATE_PATHS = [
  '/login',
  '/signup',
  '/settings',
  '/sheet/settings',
  '/sheet/studio',
  '/sheet/calendar',
  '/mwen',
  '/learner',
  '/admin',
  '/creator-studio',
  '/business/workspace',
  '/notifications',
  '/wallet',
  '/chat',
  '/sheet/wallet',
  '/sheet/notifications',
  '/sheet/chat',
];

// stripLocale comes from the SHARED parser (utils/localeUrl.js) so
// every valid locale combo in markets-data.json is stripped (/fr-CA/,
// /ht-DO/, …) — a hardcoded 4-tag regex silently missed the rest and
// made /fr-CA/login etc. look like public pages to the robots logic.

export default function NoindexRoute() {
  const location = useLocation();

  useEffect(() => {
    const pathname = stripLocale(location?.pathname || '/');

    // Check if this is a private route
    const isPrivate = PRIVATE_PATHS.some(
      (p) => pathname === p || pathname.startsWith(p + '/')
    );

    // Also check the SEO config
    const robots = getRobotsDirective(pathname);
    // An INVALID locale attempt (/es-HT/, /fr-XX/…) renders NotFound —
    // it must be noindexed too. (parseLocaleCountry already stripped the
    // segment, so re-test the RAW pathname for a locale-shaped 404.)
    const rawPath = location?.pathname || '/';
    const invalidLocale = parseLocaleCountry(rawPath).reason
      && parseLocaleCountry(rawPath).reason !== 'not-localized';
    const needsNoindex = isPrivate || robots.includes('noindex') || invalidLocale;

    // Find or create robots meta tag
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }

    if (needsNoindex) {
      meta.content = 'noindex, nofollow';
    } else {
      // Restore default for public pages
      meta.content = 'index, follow';
    }

    // Cleanup on unmount
    return () => {
      if (meta && meta.content === 'noindex, nofollow') {
        meta.content = 'index, follow';
      }
    };
  }, [location?.pathname]);

  return null; // This component renders nothing
}
