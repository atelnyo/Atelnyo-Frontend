/**
 * src/services/location/localeService.js
 *
 * LocaleService — browser language/locale signals.
 *
 * Signal 4 of the Atelyona Location Intelligence spec. CRITICAL RULE:
 * the browser locale is a LANGUAGE signal, NEVER a country detector.
 * A browser set to "fr-FR" does not mean the user is in France — a
 * Haitian user's phone is often set to French. The SignalFusionEngine
 * therefore consumes locale ONLY through LanguageIntelligence (and the
 * fusion engine ignores it for country entirely).
 *
 * This module exposes:
 *   * getBrowserLocales()      — ordered list of navigator.languages
 *   * getPrimaryLocale()       — navigator.language (or first of list)
 *   * getLocaleLanguage()      — the BCP-47 language tag, lowercased
 *   * getLocaleRegion()        — the region subtag, if any (informational)
 *   * getSupportedBrowserLanguage() — first browser language the
 *     platform actually ships (used by App's lang initializer)
 *
 * Privacy: pure browser introspection, no network, no storage.
 */

/**
 * Ordered browser locale list.
 *
 * @returns {string[]} e.g. ['fr-FR', 'ht', 'en-US']. Empty when the API
 *   is unavailable (never throws).
 */
export function getBrowserLocales() {
  try {
    if (typeof navigator === 'undefined') return [];
    if (Array.isArray(navigator.languages) && navigator.languages.length) {
      return navigator.languages.filter(Boolean).map(String);
    }
    if (navigator.language) return [String(navigator.language)];
    return [];
  } catch (_) {
    return [];
  }
}

/**
 * The primary locale (navigator.language or the first entry).
 *
 * @returns {string|null} e.g. 'fr-FR', or null when unavailable.
 */
export function getPrimaryLocale() {
  const locales = getBrowserLocales();
  return locales[0] || null;
}

/**
 * Extract the BCP-47 language tag (lowercased, region stripped).
 *
 * @param {string} [locale] Defaults to the primary browser locale.
 * @returns {string|null} e.g. 'fr', 'ht', 'en'. Null when no locale.
 */
export function getLocaleLanguage(locale = null) {
  const value = locale ?? getPrimaryLocale();
  if (!value) return null;
  return value.split('-')[0].toLowerCase() || null;
}

/**
 * Extract the region subtag (uppercased), if present.
 *
 * @param {string} [locale] Defaults to the primary browser locale.
 * @returns {string|null} e.g. 'FR', 'HT'. Null when absent.
 *
 * NOTE: informational only — the region of a locale is NOT evidence of
 * current physical location (a phone bought in France with an ht-* or
 * fr-FR locale can be used in Haiti).
 */
export function getLocaleRegion(locale = null) {
  const value = locale ?? getPrimaryLocale();
  if (!value) return null;
  const parts = value.split('-');
  return parts.length > 1 && /^[A-Za-z]{2}$/.test(parts[1])
    ? parts[1].toUpperCase()
    : null;
}

/**
 * First browser language the platform actually supports.
 *
 * Walks the FULL ordered navigator.languages list (not just
 * navigator.language) so a user whose OS language is unsupported but
 * who listed a supported language second (e.g. ['de-DE', 'fr-FR'])
 * still gets their language. Falls back to the primary language when
 * no allowlist is given.
 *
 * @param {string[]} [supported] Allowlist of BCP-47 language codes
 *   (e.g. ['ht','en','fr','es'] from markets-data.json). Null/omitted
 *   = return the primary language unfiltered.
 * @returns {string|null} e.g. 'fr'. Null when no match / no locale.
 */
export function getSupportedBrowserLanguage(supported = null) {
  const langs = getBrowserLocales()
    .map((l) => getLocaleLanguage(l))
    .filter(Boolean);
  if (!langs.length) return null;
  if (Array.isArray(supported) && supported.length) {
    for (const lang of langs) {
      if (supported.includes(lang)) return lang;
    }
    return null;
  }
  return langs[0];
}

/**
 * Build the language signal object for LanguageIntelligence.
 *
 * @returns {{ source: string, locales: string[], primary: string|null,
 *             language: string|null, region: string|null,
 *             availability: string, timestamp: number }}
 */
export function getLocaleSignal() {
  const locales = getBrowserLocales();
  return {
    source: 'locale',
    locales,
    primary: locales[0] || null,
    language: getLocaleLanguage(locales[0] || null),
    region: getLocaleRegion(locales[0] || null),
    availability: locales.length ? 'available' : 'unavailable',
    timestamp: Date.now(),
  };
}
