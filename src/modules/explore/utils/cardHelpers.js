/**
 * src/modules/explore/utils/cardHelpers.js
 *
 * Shared utility functions extracted from Explore.jsx for card rendering.
 */
/** Filter out falsy values and join with space. */
export function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

/** Normalize a music track to handle variant URL field names. */
export function normalizeTrack(p) {
  if (!p || typeof p !== 'object') return p;
  return {
    ...p,
    cover: p.cover || p.cover_url || '',
    preview: p.preview || p.preview_url || '',
    video: p.video || p.video_url || '',
    external: p.external || p.external_url || '',
  };
}

/** Normalize a talent to handle variant URL field names. */
export function normalizeTalent(p) {
  if (!p || typeof p !== 'object') return p;
  return {
    ...p,
    avatar: p.avatar || p.avatar_url || '',
  };
}

/** Format a play count into a human-readable string (1.2K, 3.5M, etc.). */
export function formatPlays(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

/** Format an ISO date string into a short display format. */
export function formatEventDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  // toLocaleDateString on an invalid Date does NOT throw — it returns
  // the literal "Invalid Date" — so validate the timestamp explicitly.
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return d.toLocaleDateString(undefined, {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch { return iso; }
}

/** Get a localized chip label from a CHIPS entry. */
export function getChipLabel(chip, lang) {
  const langKey = ['en', 'fr', 'es'].includes(lang) ? lang : 'ht';
  return chip[langKey] || chip.ht;
}

/**
 * Resolve a portfolio project's demo video URL, when one exists.
 * ``media_gallery`` may carry an explicit video entry ({url, type});
 * otherwise ``project_url`` doubles as the demo when it is clearly a
 * video link (YouTube/Vimeo page or direct MP4/WebM). A GitHub repo or
 * live site is NOT a video — it returns '' so the card never mounts a
 * broken player on hover.
 */
export function resolvePortfolioVideo(project) {
  if (!project || typeof project !== 'object') return '';
  const gallery = Array.isArray(project.media_gallery) ? project.media_gallery : [];
  const videoRe = /\.(mp4|webm)(\?|$)/i;
  const galleryVideo = gallery.find(
    (m) => m && (m.type === 'video' || (typeof m.url === 'string' && videoRe.test(m.url))),
  );
  if (galleryVideo?.url) return galleryVideo.url;
  const url = project.project_url || '';
  if (/youtube\.com|youtu\.be|vimeo\.com|facebook\.com|fb\.watch|tiktok\.com/i.test(url)
    || videoRe.test(url)) {
    return url;
  }
  return '';
}
