/**
 * src/modules/explore/utils/videoSource.js
 *
 * Shared video-source resolver for explore music surfaces.
 *
 * Extracted from MusicSheet.jsx so the card's hover preview and the
 * detail sheet resolve a ``video_url`` EXACTLY the same way — one
 * source of truth instead of two drifting copies.
 *
 * Returns ``{ kind, provider, src }`` where kind is one of:
 *   - 'embed'  — recognized platform URL → iframe embed src (provider
 *                is 'youtube' | 'vimeo' | 'facebook' | 'tiktok')
 *   - 'file'   — direct MP4/WebM file URL → <video src>
 *   - null     — not a recognized video URL (hidden)
 *
 * Matches what the studio editors accept (react-player): YouTube,
 * Vimeo, Facebook, TikTok, or a direct media file.
 */

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{6,}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
]);
const VIMEO_HOSTS = new Set(['vimeo.com', 'player.vimeo.com']);
const VIDEO_FILE_RE = /\.(mp4|m4v|webm|ogv|ogg|mov)$/i;

function hostOf(u) {
  return u.hostname.toLowerCase().replace(/^www\./, '');
}

function pathParts(u) {
  return u.pathname.replace(/^\//, '').split('/').filter(Boolean);
}

/** Convert ``90``, ``1m30s`` or ``1h2m3s`` to seconds. */
function parseTimecode(value) {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  if (/^\d+$/.test(raw)) return Number(raw);
  let total = 0;
  let matched = false;
  const re = /(\d+)\s*([hms])/gi;
  let match;
  while ((match = re.exec(raw)) !== null) {
    matched = true;
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    total += unit === 'h' ? amount * 3600 : unit === 'm' ? amount * 60 : amount;
  }
  return matched ? total : 0;
}

function youtubeStartSeconds(u) {
  const raw = u.searchParams.get('start') || u.searchParams.get('t') || '';
  if (raw) return parseTimecode(raw);
  const hash = u.hash.replace(/^#/, '');
  const match = /(?:^|&)t=([^&]+)/.exec(hash);
  return match ? parseTimecode(decodeURIComponent(match[1])) : 0;
}

function buildYoutubeEmbed(id, start) {
  // Keep www.youtube.com: the production CSP already allows that exact
  // frame host. The ID and start are validated/normalized above.
  const params = new URLSearchParams({ rel: '0', playsinline: '1' });
  if (start > 0) params.set('start', String(start));
  return `https://www.youtube.com/embed/${encodeURIComponent(id)}?${params.toString()}`;
}

function vimeoDetails(u) {
  const parts = pathParts(u);
  let id = '';
  let idIndex = -1;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (/^\d+$/.test(parts[i])) { id = parts[i]; idIndex = i; break; }
  }
  if (!id) return null;

  let hash = u.searchParams.get('h') || '';
  if (!hash && idIndex >= 0) {
    const next = parts[idIndex + 1];
    if (next && /^[A-Za-z0-9]+$/.test(next) && !/^\d+$/.test(next)) hash = next;
  }

  const rawStart = u.searchParams.get('t') || '';
  let start = parseTimecode(rawStart);
  if (!start) {
    const fragment = /(?:^|&)t=(\d+)(?:s)?/.exec(u.hash.replace(/^#/, ''));
    start = fragment ? Number(fragment[1]) : 0;
  }

  const params = new URLSearchParams({ dnt: '1' });
  if (hash) params.set('h', hash);
  const base = `https://player.vimeo.com/video/${id}?${params.toString()}`;
  return { id, src: `${base}${start > 0 ? `#t=${start}s` : ''}` };
}

/** Extract a YouTube video id from any supported YouTube URL, or '' if none. */
export function youtubeVideoId(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const u = new URL(url.trim());
    const host = hostOf(u);
    const parts = pathParts(u);
    let id = '';

    if (host === 'youtu.be') {
      id = parts[0] || '';
    } else if (YOUTUBE_HOSTS.has(host)) {
      id = u.searchParams.get('v') || '';
      if (!id) {
        const marker = parts.findIndex((part) => ['shorts', 'embed', 'live', 'v'].includes(part));
        if (marker >= 0) id = parts[marker + 1] || '';
      }
    }

    return YOUTUBE_ID_RE.test(id) ? id : '';
  } catch { /* malformed — no id */ }
  return '';
}

/** Public thumbnail for a YouTube URL (hqdefault), or '' when not YouTube. */
export function youtubeThumbnail(url) {
  const id = youtubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
}

/**
 * Cover fallback chain: explicit cover → YouTube video thumbnail → ''.
 * Lets creators skip the cover field when the video already carries
 * artwork (YouTube), instead of forcing a second URL paste.
 */
export function coverWithFallback({ cover, cover_url, video, video_url } = {}) {
  if (cover || cover_url) return cover || cover_url;
  return youtubeThumbnail(video || video_url || '');
}

function hasAudioExtension(url) {
  const pathname = url.split(/[?#]/, 1)[0] || '';
  const fileName = pathname.split('/').pop() || '';
  return /\.(mp3|wav|m4a|aac|ogg|oga|flac|opus|aiff|alac)(?:$|[?#])/i.test(fileName);
}

export function resolveVideoSource(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  // Music preview URLs are usually direct audio files; treat them as audio
  // rather than video so the explorer never mounts a <video> player for a
  // track that is meant to play in an audio-first UI. This avoids the slow
  // "looks like no video" delay when a .mp3/.wav/.m4a URL is mistaken for a
  // video asset.
  if (hasAudioExtension(trimmed)) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const host = hostOf(u);

    const youtubeId = youtubeVideoId(trimmed);
    if (youtubeId) {
      return {
        kind: 'embed',
        provider: 'youtube',
        src: buildYoutubeEmbed(youtubeId, youtubeStartSeconds(u)),
      };
    }

    if (VIMEO_HOSTS.has(host)) {
      const vimeo = vimeoDetails(u);
      return vimeo
        ? { kind: 'embed', provider: 'vimeo', src: vimeo.src }
        : null;
    }

    if (host === 'facebook.com' || host === 'm.facebook.com' || host === 'fb.watch') {
      // Any Facebook video URL (watch, /videos/ID, fb.watch short
      // links…) embeds through the official plugin — no id parsing
      // needed, the plugin resolves the href itself.
      return {
        kind: 'embed',
        provider: 'facebook',
        src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(trimmed)}`,
      };
    }

    if (host === 'tiktok.com') {
      // /@user/video/ID — the video id is the last numeric segment.
      const parts = pathParts(u);
      const id = [...parts].reverse().find((s) => /^\d+$/.test(s)) || '';
      return id
        ? { kind: 'embed', provider: 'tiktok', src: `https://www.tiktok.com/embed/v2/${id}` }
        : null;
    }

    // TikTok share shorteners (vm./vt.tiktok.com) can't be resolved to a
    // video id synchronously (needs a redirect) — hide cleanly rather
    // than mount a broken <video> in the detail sheets.
    if (host === 'vm.tiktok.com' || host === 'vt.tiktok.com') return null;

    // Direct media files only. A random web page must never mount a
    // <video> element that then shows a broken player.
    if (VIDEO_FILE_RE.test(u.pathname)) {
      return { kind: 'file', src: u.toString() };
    }
    return null;
  } catch {
    return null;
  }
}

// Autoplay/mute/playsinline params for the CARD hover preview. The
// detail sheet uses the plain embed src (a click starts the full
// video); the card appends these so the SAME iframe embed can start
// muted-inline without a user gesture. YouTube expects ``mute``,
// Vimeo expects ``muted`` — split by provider so each gets the param
// it actually honors. ``controls=0`` hides the player chrome so the
// preview reads as a clean live thumbnail on the card.
function buildHoverEmbedParams(u) {
  const host = hostOf(u);
  if (host.includes('youtube')) {
    u.searchParams.set('autoplay', '1');
    u.searchParams.set('mute', '1');
    u.searchParams.set('playsinline', '1');
    u.searchParams.set('controls', '0');
    u.searchParams.set('rel', '0');
    u.searchParams.set('modestbranding', '1');
  } else {
    // player.vimeo.com
    u.searchParams.set('autoplay', '1');
    u.searchParams.set('muted', '1');
    u.searchParams.set('playsinline', '1');
    u.searchParams.set('controls', '0');
  }
  return u.toString();
}

/**
 * Return the autoplay-capable embed src for a card hover preview.
 * ``resolveVideoSource`` already returns the SAME embed src the detail
 * sheet renders — this appends the muted-autoplay params on top so the
 * iframe can start playing inline on hover with no user gesture.
 *
 * Only YouTube/Vimeo embeds support reliable muted-autoplay; Facebook /
 * TikTok return null so those cards keep cover + badge and play in the
 * detail sheet (the hook also gates ``showPreview`` on this). Returns
 * null for non-embed (direct file) sources too.
 */
export function hoverEmbedSrc(videoSrc) {
  if (!videoSrc || videoSrc.kind !== 'embed' || !videoSrc.src) return null;
  if (videoSrc.provider !== 'youtube' && videoSrc.provider !== 'vimeo') return null;
  // Embed srcs are always well-formed here — resolveVideoSource builds
  // them from an already-successful ``new URL()`` parse.
  return buildHoverEmbedParams(new URL(videoSrc.src));
}
