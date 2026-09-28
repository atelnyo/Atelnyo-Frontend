/**
 * src/seo/useSEO.js
 *
 * Custom hook that auto-applies SEO metadata based on the current route.
 * Reads the route from React Router, matches it against the centralized
 * SEO registry, and returns the correct config for SEOHead.
 *
 * Usage:
 *   const seo = useSEO();                     // auto from route
 *   const seo = useSEO({ title: 'Custom' });  // override title
 *   return <SEOHead {...seo} />;
 */
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { matchSEOConfig, getRobotsDirective } from './seoConfig';
import { stripLocale as parseAndStrip } from '../utils/localeUrl';

/**
 * Parse the effective pathname — strip locale prefix if present.
 * Delegates to the SHARED parser (utils/localeUrl.js) so every locale
 * combo in markets-data.json is recognized (/fr-CA/, /ht-DO/, …) —
 * the old hardcoded 4-tag regex silently missed the other 32 combos.
 * Invalid combos (/es-HT/) are NOT a locale segment (the URL parser
 * 404s them), so the path stays untouched for the noindex flow.
 */
function stripLocale(pathname) {
  if (!pathname) return '/';
  return parseAndStrip(pathname) || '/';
}

/**
 * useSEO — auto-applies correct SEO config for the current route.
 *
 * @param {object} overrides — optional overrides (title, description, image, etc.)
 * @returns {object} props ready to spread into <SEOHead>
 */
export default function useSEO(overrides = {}) {
  const location = useLocation();
  const overridesKey = JSON.stringify(overrides);

  return useMemo(() => {
    const parsed = overridesKey ? JSON.parse(overridesKey) : {};
    const pathname = stripLocale(location?.pathname || '/');
    const match = matchSEOConfig(pathname);

    if (!match) {
      // Unknown route — conservative: noindex
      return {
        title: parsed.title || 'Atelnyo',
        description: parsed.description || '',
        robots: 'noindex',
        noindex: true,
        ...parsed,
      };
    }

    const { route } = match;

    return {
      title: parsed.title || route.title,
      description: parsed.description || route.description,
      robots: parsed.noindex ? 'noindex,nofollow' : (route.robots || 'index,follow'),
      noindex: parsed.noindex ?? !route.indexable,
      type: parsed.type || route.ogType || 'website',
      ...parsed,
    };
  }, [location?.pathname, overridesKey]);
}
