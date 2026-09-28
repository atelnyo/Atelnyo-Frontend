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
    const host = u.hostname.replace(/^www\./, '');
    const pathId = u.pathname.replace(/^\//, '').split('/').filter(Boolean);
    if (host === 'youtu.be') {
      const id = pathId[0] || '';
      return id ? { kind: 'embed', provider: 'youtube', src: `https://www.youtube.com/embed/${id}` } : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      // ?v=ID, /shorts/ID, /embed/ID, /live/ID all carry the video id
      // in a recognizable slot — the plain page URL (no id) is not
      // a video and falls through to the file branch (or hides).
      let id = u.searchParams.get('v');
      if (!id && pathId[0] === 'shorts') id = pathId[1];
      if (!id && pathId[0] === 'embed') id = pathId[1];
      if (!id && pathId[0] === 'live') id = pathId[1];
      return id ? { kind: 'embed', provider: 'youtube', src: `https://www.youtube.com/embed/${id}` } : null;
    }
    if (host === 'vimeo.com') {
      // Accept /ID and /channels/.../ID — the video id is the LAST
      // numeric path segment (player.vimeo.com/video/ID is also a
      // valid paste).
      let id = null;
      for (let i = pathId.length - 1; i >= 0; i -= 1) {
        if (/^\d+$/.test(pathId[i])) { id = pathId[i]; break; }
      }
      return id ? { kind: 'embed', provider: 'vimeo', src: `https://player.vimeo.com/video/${id}` } : null;
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
      const id = [...pathId].reverse().find((s) => /^\d+$/.test(s)) || '';
      return id
        ? { kind: 'embed', provider: 'tiktok', src: `https://www.tiktok.com/embed/v2/${id}` }
        : null;
    }
    // TikTok share shorteners (vm./vt.tiktok.com) can't be resolved to a
    // video id synchronously (needs a redirect) — hide cleanly rather
    // than mount a broken <video> in the detail sheets.
    if (host === 'vm.tiktok.com' || host === 'vt.tiktok.com') return null;
    // Direct media files (or anything else) → native <video>.
    return { kind: 'file', src: trimmed };
  } catch {
    // Malformed URL — treat as a direct file attempt.
    return { kind: 'file', src: trimmed };
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
  const host = u.hostname.replace(/^www\./, '');
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
