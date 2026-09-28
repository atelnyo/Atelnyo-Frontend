/**
 * src/utils/localeUrl.js
 *
 * Phase 3 — Centralized URL / locale parser for Atelyona's global
 * routing (docs/LOCALE_MARKET_ROUTING.md §C.4).
 *
 * URL shape:  /{lang}-{COUNTRY}/<path>
 *   • lang    — 2-letter lowercase language code (ht, fr, en, es)
 *   • COUNTRY — 2-letter uppercase ISO-3166 market (HT, DO, CA, US, FR)
 *   • example: /ht-HT/explore, /fr-HT/courses, /en-US/creators
 *
 * CONTRACT:
 *   • parseLocaleCountry(pathname) — the ONLY reader of the URL
 *     segment. Validates the combination against markets.js; an
 *     invalid combo (/fr-XX/, /ht/) returns { valid: false } so the
 *     router can 404 instead of creating a fake page.
 *   • buildLocaleUrl(language, country, path) — canonical URL builder
 *     (used by switchers + SEO helpers).
 *   • stripLocale(pathname) — returns the path WITHOUT a leading
 *     locale segment ('' when none) so existing routes keep working.
 *   • isLocalePath(pathname) — true when the path starts with a
 *     VALID locale segment.
 *
 * The parser is pure (no window/localStorage) so it is unit-testable
 * and usable server-side (sitemap generation) later.
 */

import {
  MARKETS,
  SUPPORTED_LANGUAGES,
  isSupportedLocale,
  buildLocaleTag,
  defaultLanguageFor,
  DEFAULT_LANGUAGE,
  DEFAULT_MARKET,
} from '../config/markets';

// BCP-47-style segment: /ht-HT/  (lang lowercase, country uppercase)
const LOCALE_SEGMENT_RE = /^\/?([a-z]{2})-([A-Z]{2})(?:\/|$)/;

/**
 * Parse a leading locale-country segment from a pathname.
 *
 * @param {string} pathname  e.g. '/ht-HT/explore' or '/ht-HT' or '/explore'
 * @returns {{
 *   valid: boolean,
 *   language: string|null,
 *   country: string|null,
 *   market: string|null,       // = country (market context)
 *   tag: string|null,          // 'ht-HT'
 *   rest: string,              // path WITHOUT the locale segment
 *   reason: string|null        // 'not-localized' | 'invalid-language' |
 *                              // 'invalid-country' | 'unsupported-combo' | null
 * }}
 */
export function parseLocaleCountry(pathname) {
  const input = String(pathname || '');
  const m = LOCALE_SEGMENT_RE.exec(input);
  if (!m) {
    return {
      valid: false, language: null, country: null, market: null,
      tag: null, rest: input, reason: 'not-localized',
    };
  }
  const language = m[1];
  const country = m[2];
  // rest = everything after the locale segment, normalized to start
  // with '/' when non-empty ('explore' → '/explore', '' stays '').
  const restRaw = input.slice(m[0].length);
  const rest = restRaw && !restRaw.startsWith('/') ? `/${restRaw}` : restRaw;

  if (!SUPPORTED_LANGUAGES.includes(language)) {
    return {
      valid: false, language, country, market: country,
      tag: buildLocaleTag(language, country),
      rest,
      reason: 'invalid-language',
    };
  }
  if (!MARKETS[country]) {
    return {
      valid: false, language, country, market: country,
      tag: buildLocaleTag(language, country),
      rest,
      reason: 'invalid-country',
    };
  }
  if (!isSupportedLocale(language, country)) {
    return {
      valid: false, language, country, market: country,
      tag: buildLocaleTag(language, country),
      rest,
      reason: 'unsupported-combo',
    };
  }
  return {
    valid: true, language, country, market: country,
    tag: buildLocaleTag(language, country),
    rest,
    reason: null,
  };
}

/**
 * True when the pathname carries a VALID locale segment.
 * ('/fr-XX/…' and '/ht/…' return false — no fake pages.)
 */
export function isLocalePath(pathname) {
  return parseLocaleCountry(pathname).valid;
}

/**
 * Strip a leading VALID locale segment from a pathname.
 * Returns the path with the locale removed ('' when none / invalid).
 * '/ht-HT/explore' → '/explore' ; '/explore' → '/explore'
 */
export function stripLocale(pathname) {
  const parsed = parseLocaleCountry(pathname);
  if (!parsed.valid) return String(pathname || '');
  const rest = parsed.rest;
  return rest.startsWith('/') ? rest : `/${rest}`;
}

/**
 * Build a canonical locale URL.
 * @param {string} language  'ht' | 'fr' | 'en' | 'es'
 * @param {string} country   'HT' | 'DO' | 'CA' | 'US' | 'FR'
 * @param {string} [path]    '/explore' (default '')
 * @returns {string} '/ht-HT' or '/ht-HT/explore' ('' when invalid combo)
 */
export function buildLocaleUrl(language, country, path = '') {
  if (!isSupportedLocale(language, country)) return '';
  const tag = buildLocaleTag(language, country);
  const p = String(path || '');
  if (!p || p === '/') return `/${tag}`;
  return `/${tag}${p.startsWith('/') ? p : `/${p}`}`;
}

/**
 * Rewrite a current path into the same path under a different
 * language (language switcher: KEEP market) — or a different market
 * (market switcher: KEEP language when supported, else market default).
 *
 * '/ht-HT/courses' → setLanguage('fr')   → '/fr-HT/courses'
 * '/ht-HT/courses' → setMarket('CA')     → '/ht-CA/courses'
 * '/ht-HT/courses' → setMarket('US')     → '/en-US/courses' (ht ∉ US.supported)
 */
export function switchLocale(pathname, { language, country } = {}) {
  const parsed = parseLocaleCountry(pathname);
  const currentLang = parsed.valid ? parsed.language : DEFAULT_LANGUAGE;
  const currentCountry = parsed.valid ? parsed.country : DEFAULT_MARKET;
  const rest = parsed.valid ? parsed.rest : String(pathname || '');

  const nextLang = language || currentLang;
  const nextCountry = country || currentCountry;

  // Market switch where the current language isn't supported → fall
  // back to the market's default language.
  if (country && !isSupportedLocale(nextLang, nextCountry)) {
    return buildLocaleUrl(defaultLanguageFor(nextCountry), nextCountry, rest);
  }
  return buildLocaleUrl(nextLang, nextCountry, rest);
}
