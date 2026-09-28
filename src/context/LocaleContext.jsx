/**
 * src/context/LocaleContext.jsx
 *
 * Phase 3 — AtelyonaContext provider for the global locale/market
 * routing architecture (docs/LOCALE_MARKET_ROUTING.md §C.3).
 *
 * The context exposes the CURRENT locale-market context:
 *
 *   { language, country, market, tag, isLocalized, rest }
 *
 * SOURCE OF TRUTH PRIORITY (spec §30 — Detection ≠ Routing):
 *   1. Explicit URL intent    — /fr-HT/... → language=fr, country=HT
 *   2. User preference        — atelnyo_lang + atelnyo_market
 *      (localStorage; backend location_prefs is handled by the
 *      calling layer so this context stays storage-agnostic)
 *   3. Detection              — the calling layer (App.jsx) resolves
 *      this via Location Intelligence (useLocationContext) and passes
 *      it in; the context NEVER prompts for permissions.
 *
 * The context does NOT own routing — it only *reports* the resolved
 * context. LocaleRoute (Phase 4) decides whether to apply it to the
 * app's lang state. This keeps the boundary clean: no setState from a
 * context during render, no URL writes from a provider.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { parseLocaleCountry, stripLocale } from '../utils/localeUrl';
import { DEFAULT_LANGUAGE, DEFAULT_MARKET } from '../config/markets';

const LocaleContext = createContext(null);

/**
 * @param {object} props
 * @param {string} props.pathname    window.location.pathname
 * @param {object} [props.detected]  { country, confidence, sources } from
 *   Location Intelligence — used ONLY when the URL has no locale segment.
 * @param {string} [props.userLanguage]  Explicit user lang (atelnyo_lang).
 * @param {string} [props.userMarket]    Explicit user market (atelnyo_market).
 */
export function LocaleProvider({ pathname = '', detected = null, userLanguage = '', userMarket = '', children }) {
  const context = useMemo(() => {
    const parsed = parseLocaleCountry(pathname);

    // 1. Explicit URL intent wins.
    if (parsed.valid) {
      return {
        language: parsed.language,
        country: parsed.country,
        market: parsed.market,
        tag: parsed.tag,
        isLocalized: true,
        rest: parsed.rest,
        source: 'url',
        confidence: 1,
      };
    }

    // 2. User preference (explicitly stored).
    const lang = userLanguage || DEFAULT_LANGUAGE;
    const market = userMarket || detected?.country || DEFAULT_MARKET;
    return {
      language: lang,
      country: market,
      market,
      tag: `${lang}-${market}`,
      isLocalized: false,
      rest: pathname || '',
      source: userLanguage || userMarket ? 'user' : 'detection',
      confidence: detected?.confidence || 0,
    };
  }, [pathname, detected, userLanguage, userMarket]);

  const value = useMemo(() => ({
    ...context,
    // Convenience: the same path without a locale segment, for
    // components that render the same content in both modes.
    strippedPath: stripLocale(pathname),
  }), [context, pathname]);

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

/** Read the current AtelyonaContext (falls back to defaults when
 *  not wrapped — keeps tests / legacy renders safe). */
export function useLocaleContext() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return {
      language: DEFAULT_LANGUAGE,
      country: DEFAULT_MARKET,
      market: DEFAULT_MARKET,
      tag: `${DEFAULT_LANGUAGE}-${DEFAULT_MARKET}`,
      isLocalized: false,
      rest: '',
      strippedPath: '',
      source: 'default',
      confidence: 0,
    };
  }
  return ctx;
}

export default LocaleProvider;
