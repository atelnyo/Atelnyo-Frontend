/**
 * Community post rules shared by every composer.
 *
 * The backend validates CommunityPost content at 2,000 code points. Keep
 * the same unit on the client so an emoji is not counted twice by the
 * browser's UTF-16 `maxLength`.
 */
export const POST_MAX_LENGTH = 2000;

export function countPostChars(value) {
  return Array.from(String(value ?? '')).length;
}

export function validatePostDraft(value) {
  const text = String(value ?? '').trim();
  const length = countPostChars(text);
  if (length === 0) {
    return { ok: false, reason: 'empty', text, length, max: POST_MAX_LENGTH };
  }
  if (length > POST_MAX_LENGTH) {
    return { ok: false, reason: 'too_long', text, length, max: POST_MAX_LENGTH };
  }
  return { ok: true, reason: null, text, length, max: POST_MAX_LENGTH };
}
