/**
 * src/utils/profileUtils.js
 *
 * Shared utilities — hash hue, image resize, relative time.
 * Profile-related helpers (fieldVisibility, privacy) removed in
 * 2026-Q3 cleanup (migration 0050 dropped the Profile model).
 *
 * Exports
 * -------
 *  hashHue(seed) — deterministic 0-359 hue from a string
 *  resizeImage(file, maxW, maxH, quality) — JPEG downsampler
 *  PERSONA_LABELS — 4-language persona pill labels
 *  bucketRelativeTime(iso, lang) — human-friendly time strings
 *
 * Profile-related helpers (fieldVisibility, privacy) were removed in
 * 2026-Q3 cleanup (migration 0050 dropped the Profile model).
 */

// ─── 1. hashHue ────────────────────────────────────────────────────────────
/**
 * Deterministic 0-359 hue from an arbitrary string.
 * Uses the classic djb2-like 31-multiplier string hash and clamps to
 * the hue circle. Same algorithm as the previous inline copies so
 * the rose colors for existing users do NOT change on rollout.
 *
 * @param {string|number|null|undefined} seed
 * @returns {number} integer in [0, 359]
 */
export function hashHue(seed) {
  const s = String(seed == null ? '' : seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;  // keep in 32-bit unsigned
  }
  return h % 360;
}

// ─── 2. resizeImage ────────────────────────────────────────────────────────
/**
 * Resize an image File to fit inside maxW × maxH, preserving aspect
 * ratio. Returns a JPEG data URL (smaller than PNG for the same view).
 * Used by every avatar picker in the app (MyProfile, Settings, future
 * profile widgets).
 *
 * @param {File|Blob} file
 * @param {number} maxW
 * @param {number} maxH
 * @param {number} [quality=0.85]  JPEG quality in [0, 1]
 * @returns {Promise<string>} data URL
 */
export function resizeImage(file, maxW, maxH, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxW || height > maxH) {
          const ratio = Math.min(maxW / width, maxH / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error('Image decode failed'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

// ─── 3. PERSONA_LABELS ─────────────────────────────────────────────────────
/**
 * 4-language label set for the persona pill toggle. Kept in the
 * utils module so any future component (not just JadenWoz) can
 * show the same labels.
 */
export const PERSONA_LABELS = {
  ht: { stranger: 'Nenpòt moun', friend: 'Zanmi Komen', you: 'Ou menm' },
  en: { stranger: 'Stranger',   friend: 'Mutual Friend', you: 'You' },
  es: { stranger: 'Cualquiera', friend: 'Amigo en común', you: 'Tú' },
  fr: { stranger: 'Inconnu',    friend: 'Ami commun',   you: 'Vous' },
};

// ─── 5. bucketRelativeTime ─────────────────────────────────────────────────
/**
 * Compact relative-time formatter for the activity log timeline.
 * Falls back to a localized short date for entries older than a week.
 *
 * Examples (now = 2026-07-02 12:00 UTC):
 *   bucketRelativeTime('2026-07-02T11:55:00Z', 'en') -> '5m ago'
 *   bucketRelativeTime('2026-07-02T09:00:00Z', 'en') -> '3h ago'
 *   bucketRelativeTime('2026-07-01T12:00:00Z', 'en') -> 'Yesterday'
 *   bucketRelativeTime('2026-06-28T12:00:00Z', 'en') -> '4d ago'
 *   bucketRelativeTime('2026-05-15T12:00:00Z', 'en') -> 'May 15'
 *
 * @param {string} iso  ISO-8601 timestamp
 * @param {string} lang  2-char language code (ht/en/es/fr)
 * @returns {string}
 */
export function bucketRelativeTime(iso, lang = 'en') {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const diffMin = Math.round(diffMs / 60000);

  // Ultra-recent: minutes
  if (diffMin < 1) return lang === 'ht' ? 'kounye a' : 'now';
  if (diffMin < 60) return lang === 'ht' ? `${diffMin}m de sa` : `${diffMin}m ago`;

  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return lang === 'ht' ? `${diffH}h de sa` : `${diffH}h ago`;

  // Yesterday bucket
  const oneDayMs = 86_400_000;
  if (diffH < 48) return lang === 'ht' ? 'Yè' : 'Yesterday';

  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return lang === 'ht' ? `${diffD}j de sa` : `${diffD}d ago`;

  // Older: short month + day
  try {
    return new Date(iso).toLocaleDateString(
      lang === 'ht' ? 'fr-HT' : lang,
      { month: 'short', day: 'numeric' },
    );
  } catch (_) {
    return new Date(iso).toLocaleDateString();
  }
}
