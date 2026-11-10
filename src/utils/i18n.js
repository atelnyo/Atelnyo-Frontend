/**
 * src/utils/i18n.js — Lightweight i18n helpers for inline translations.
 *
 * Usage:
 *   import { t2, t } from '../utils/i18n';
 *
 *   // Simple lookup (returns string):
 *   {t2(lang, { ht: 'Kou', fr: 'Cours', en: 'Courses' })}
 *
 *   // React component-friendly (accepts 4 positional args):
 *   {t(lang, 'Kou', 'Courses', 'Cours', 'Curso')}
 *
 *   // With template (optional 6th arg):
 *   {t2(lang, { ht: `${count} kou`, fr: `${count} cours`, en: `${count} courses` })}
 *
 * Falls back: lang → 'en' → first available value → ''.
 */

/**
 * Map-based lookup. Pass an object keyed by language code.
 * @param {string} lang - Current supported language code ('ht', 'en', 'fr')
 * @param {Object} map  - { ht: '...', en: '...', fr: '...' }
 * @returns {string}
 */
export function normalizeSupportedLanguage(lang) {
  const code = String(lang || '').trim().toLowerCase().split('-')[0];
  if (code === 'es') return 'en';
  return SUPPORTED_LANGUAGES.includes(code) ? code : null;
}

export function t2(lang, map) {
  if (!map) return '';
  const language = normalizeSupportedLanguage(lang);
  return map[language] || map.en || map.ht || map.fr || Object.values(map)[0] || '';
}

/**
 * Positional-arg lookup (shorter than building an object for simple cases).
 * @param {string} lang
 * @param {string} ht  - Haitian Creole
 * @param {string} en  - English (fallback)
 * @param {string} [fr] - French
 * @param {string} [_legacySpanish] - Ignored legacy positional argument.
 * @returns {string}
 */
export function t(lang, ht, en, fr) {
  switch (normalizeSupportedLanguage(lang)) {
    case 'ht': return ht || en || '';
    case 'fr': return fr || en || ht || '';
    default:   return en || ht || '';
  }
}

/**
 * Check if a value is a translation map (object with language keys).
 * Useful for passing either a string or a translation map to a component.
 */
export function isTranslationMap(val) {
  return val && typeof val === 'object' && !Array.isArray(val);
}

/**
 * Default interface language used as the fallback when the requested
 * language has no matching translation.
 *
 * Kept in sync with src/config/markets.js DEFAULT_LANGUAGE so the
 * frontend and the new backend language-preference defaults agree.
 */
import {
  DEFAULT_LANGUAGE as _DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
} from '../config/markets';
export const DEFAULT_LANGUAGE = _DEFAULT_LANGUAGE;

/**
 * Dev-only missing-translation logger.
 *
 * In development, logs a warn when a t2-style map does not contain the
 * requested language AND does not contain any fallback value, so missing
 * keys are visible during development instead of silently rendering ''.
 *
 * The spec requires: "Log missing translation keys during development."
 * This is intentionally dev-only so production consoles stay clean.
 */
function warnMissingTranslation(lang, map, key) {
  if (import.meta.env?.DEV !== true) return;
  try {
    const hasRequested = !!(map && map[lang]);
    const hasFallback = !!(map && (map.en || Object.values(map)[0]));
    if (!hasRequested && !hasFallback) {
      console.warn(
        `[i18n] missing translation for key "${key || 'inline-map'}" in lang "${lang}".`,
      );
    }
  } catch (_) {
    // best-effort — never let the logger break rendering
  }
}

/**
 * Key-based lookup with a reliable fallback chain.
 *
 * Use this for centralized, consistently-named translation keys
 * (e.g. 'common.save', 'course.start', 'settings.language') instead of
 * scattering inline lang === 'ht' ternaries.
 *
 * Fallback chain:
 *   1. translations[key] for the requested lang
 *   2. translations[key] for DEFAULT_LANGUAGE
 *   3. the explicit fallback argument
 *   4. the key itself (so the UI never renders undefined)
 *
 * The spec requires: "Do not display undefined values." This function
 * always returns a string.
 */
export function translateKey(lang, key, translations, fallback) {
  if (!key) {
    return fallback != null ? String(fallback) : '';
  }
  const dict = translations && typeof translations === 'object' ? translations : null;
  lang = normalizeSupportedLanguage(lang) || DEFAULT_LANGUAGE;
  if (!dict) {
    return fallback != null ? String(fallback) : key;
  }
  // 1. requested language
  try {
    const requested = dict[lang];
    if (requested && typeof requested === 'object' && requested[key] != null) {
      return String(requested[key]);
    }
  } catch (_) {
    /* ignore */
  }
  // 2. default language
  const defLang = DEFAULT_LANGUAGE && DEFAULT_LANGUAGE !== lang ? DEFAULT_LANGUAGE : null;
  if (defLang) {
    try {
      const def = dict[defLang];
      if (def && typeof def === 'object' && def[key] != null) {
        return String(def[key]);
      }
    } catch (_) {
      /* ignore */
    }
  }
  // 3. explicit fallback
  if (fallback != null) {
    return String(fallback);
  }
  // 4. key itself (never undefined)
  return key;
}

/**
 * Resolve a t2-style inline map to a string, with dev missing-key
 * logging. Keeps the existing t2() contract unchanged; the only
 * addition is that missing keys may log in development.
 */
export function t2Resolved(lang, map, key) {
  const out = t2(lang, map);
  warnMissingTranslation(lang, map, key);
  return out;
}
