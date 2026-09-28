/**
 * src/config/markets.js
 *
 * Phase 3 — Centralized Market + Locale configuration for Atelyona's
 * global routing architecture (docs/LOCALE_MARKET_ROUTING.md).
 *
 * The DATA lives in src/config/markets-data.json — the single source
 * of truth shared with the backend (backend/api/management/commands/
 * generate_sitemap.py reads the same file, so the sitemap's locale
 * combos can never drift from the frontend's). This module is the thin
 * logic layer: it re-exports the raw data and derives everything the
 * app consumes:
 *   • which language+country combinations produce valid URLs (/ht-HT/),
 *   • the default language per market,
 *   • currency / timezone per market (reserved — content/market
 *     availability is wired via the same file),
 *   • the 4 translation languages the platform ships.
 *
 * RULES:
 *   • A URL like /fr-XX/ is INVALID unless 'fr' ∈ supportedLanguages
 *     of market 'XX' — the URL parser enforces this (no fake pages).
 *   • Language and country are independent: /fr-HT/ (French + Haiti)
 *     is a valid, distinct context from /ht-HT/.
 *   • marketEnabled=false reserves the entry for a future market
 *     without emitting URLs today.
 */
import marketsData from './markets-data.json';

/** Languages the platform ships translations for (src/data/translations.js). */
export const SUPPORTED_LANGUAGES = marketsData.supportedLanguages;

/** Language display metadata (shared with switchers). */
export const LANGUAGE_LABELS = marketsData.languageLabels;

/** Country/market display metadata (shared with the market switcher). */
export const MARKET_LABELS = marketsData.marketLabels;

/** Country code → market config (from the shared JSON). */
export const MARKETS = marketsData.markets;

/** The default market when none is detected / stored. */
export const DEFAULT_MARKET = marketsData.defaultMarket;
/** The default language when none is stored (matches atelnyo_lang default). */
export const DEFAULT_LANGUAGE = marketsData.defaultLanguage;

/**
 * Enabled market options for the market/country switcher — derived
 * from MARKETS so the switcher can never offer a disabled market.
 * Each option: { code, name, flag, defaultLanguage, supportedLanguages }.
 */
export const MARKET_OPTIONS = Object.entries(MARKETS)
  .filter(([, m]) => m.marketEnabled)
  .map(([code, m]) => ({
    code,
    name: MARKET_LABELS[code]?.name || code,
    flag: MARKET_LABELS[code]?.flag || '🌍',
    defaultLanguage: m.defaultLanguage,
    supportedLanguages: m.supportedLanguages,
  }));

/** Build a locale-country tag from parts, e.g. ('ht','HT') → 'ht-HT'. */
export function buildLocaleTag(language, country) {
  return `${String(language || '').toLowerCase()}-${String(country || '').toUpperCase()}`;
}

/**
 * True when (language, country) is a valid, enabled combination.
 * A market must exist, be enabled, and support the language.
 */
export function isSupportedLocale(language, country) {
  const market = MARKETS[String(country || '').toUpperCase()];
  if (!market || !market.marketEnabled) return false;
  return market.supportedLanguages.includes(String(language || '').toLowerCase());
}

/** Country's default language (falls back to the platform default). */
export function defaultLanguageFor(country) {
  const market = MARKETS[String(country || '').toUpperCase()];
  return (market && market.defaultLanguage) || DEFAULT_LANGUAGE;
}
