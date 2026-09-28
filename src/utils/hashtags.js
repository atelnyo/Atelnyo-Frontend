/**
 * src/utils/hashtags.js
 *
 * Shared helpers for the "#hashtags" input on content creation forms
 * (music, courses, products, events). The input is a plain text field
 * where creators type "#Kreyol #Music" — these helpers normalize the
 * free text into the clean tag array the backend `tags` JSONField
 * stores, and back into a prefixed string for edit mode. The trending
 * hashtag engine (api/services/hashtag_service.py) scans `tags` and
 * turns each item into a #hashtag.
 */

const MAX_TAGS = 10;

/**
 * "#Kreyol #Music, Haiti" -> ["Kreyol", "Music", "Haiti"]
 * Dedupes, strips leading #/＃ and whitespace, caps at MAX_TAGS.
 */
export function parseHashtags(value) {
  if (!value) return [];
  return [...new Set(
    String(value)
      .split(/[\s,]+/)
      .map((t) => String(t).replace(/^[#＃]+/, '').trim())
      .filter(Boolean),
  )].slice(0, MAX_TAGS);
}

/**
 * ["Kreyol", "Music"] -> "#Kreyol #Music"  (edit-mode prefill).
 */
export function hashtagsToInput(tags) {
  if (!Array.isArray(tags)) return '';
  return tags
    .map((t) => `#${String(t).replace(/^#/, '').trim()}`)
    .filter(Boolean)
    .join(' ');
}
