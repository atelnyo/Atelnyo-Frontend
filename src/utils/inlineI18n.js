/**
 * src/utils/inlineI18n.js
 *
 * `inlineText(lang, english)` fills the gap left by components that
 * still carry inline copy as `lang === 'ht' ? 'Kreyòl' : 'English'`
 * conditionals: when the active interface language is Spanish, it
 * returns the Spanish counterpart of the English branch.
 *
 * Lookup order:
 *   1. exact English value in src/data/translations.js (reverse map)
 *   2. exact English value in src/data/inlineTranslations.es.js
 *   3. the original English text
 *
 * The reverse maps are built lazily once per page load. Non-Spanish
 * languages are returned untouched so this helper is a no-op for
 * ht/en/fr — existing behavior cannot regress.
 */
import { translations } from '../data/translations';
import { INLINE_ES } from '../data/inlineTranslations.es';

let reverseMap = null;

function buildReverseMap() {
  const map = new Map();
  const en = translations.en || {};
  const es = translations.es || {};
  for (const key of Object.keys(en)) {
    const english = en[key];
    const spanish = es[key];
    if (typeof english === 'string' && typeof spanish === 'string' && !map.has(english)) {
      map.set(english, spanish);
    }
  }
  for (const [english, spanish] of Object.entries(INLINE_ES)) {
    if (typeof spanish === 'string' && spanish && !map.has(english)) {
      map.set(english, spanish);
    }
  }
  return map;
}

export function inlineText(lang, english) {
  if (lang !== 'es' || typeof english !== 'string') return english;
  if (!reverseMap) reverseMap = buildReverseMap();
  return reverseMap.get(english) || english;
}
