import { inlineText } from '../../utils/inlineI18n';
/**
 * src/components/profile/seoPreview.js
 *
 * Search-result preview for the profile editor.
 *
 * Limits are display guidance, not backend validation:
 *   • 60 chars for a title (Google truncates around this width);
 *   • 160 chars for a description.
 * The backend stores up to 160 chars for seo_title and has no hard
 * description limit, so the editor must not silently invent one.
 */

export const SEO_RECOMMENDED = Object.freeze({
  title: 60,
  description: 160,
});

const SITE_NAME = 'Atelnyo';
const SITE_DOMAIN = 'atelnyo.site';

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function truncateSeoText(value, limit) {
  const text = clean(value);
  if (!text || text.length <= limit) { return text; }
  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

/**
 * @param {object} input
 * @param {string} input.title
 * @param {string} input.description
 * @param {string} input.artistName
 * @param {string} input.username
 * @param {string} input.bio
 * @param {'ht'|'en'} lang
 */
export function buildSeoPreview({
  title,
  description,
  artistName,
  username,
  bio,
} = {}, lang = 'en') {
  const isHt = lang === 'ht';
  const cleanTitle = clean(title);
  const cleanDescription = clean(description);
  const fallbackTitle = `${clean(artistName) || (isHt ? 'Kreyatè' : inlineText(lang, 'Creator'))} — ${SITE_NAME}`;
  const fallbackDescription = clean(bio)
    || (isHt
      ? 'Pwofil kreyatè sou Atelnyo — pwojè, kou ak sèvis.'
      : inlineText(lang, 'Creator profile on Atelnyo — projects, courses and services.'));

  return {
    title: truncateSeoText(cleanTitle || fallbackTitle, SEO_RECOMMENDED.title),
    description: truncateSeoText(cleanDescription || fallbackDescription, SEO_RECOMMENDED.description),
    url: `${SITE_DOMAIN}${username ? `/c/${username}` : ''}`,
    titleCount: cleanTitle.length,
    descriptionCount: cleanDescription.length,
    titleTooLong: cleanTitle.length > SEO_RECOMMENDED.title,
    descriptionTooLong: cleanDescription.length > SEO_RECOMMENDED.description,
  };
}
