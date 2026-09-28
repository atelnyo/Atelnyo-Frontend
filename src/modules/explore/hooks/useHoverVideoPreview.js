/**
 * src/modules/explore/hooks/useHoverVideoPreview.js
 *
 * Shared hover-video-preview state for explore cards (music, course,
 * event). Extracted from MusicCard so every card that supports a video
 * hover preview uses the SAME caution gates:
 *   • desktop pointers only — (hover: hover) and (pointer: fine)
 *   • prefers-reduced-motion users never get autoplaying previews
 *   • a short arm delay (200ms) so sweeping across a rail doesn't load
 *     a player for a 100ms brush past the card
 *
 * Returns the bind handlers for the card + a ``showPreview`` boolean
 * that gates mounting the preview overlay (HoverVideoPreview).
 */
import { useEffect, useRef, useState } from 'react';
import { resolveVideoSource } from '../utils/videoSource';

// Hover-capability + motion gate. Evaluated once at module load (not
// per render) — desktop pointers only, and users with
// prefers-reduced-motion never get autoplaying previews.
const canHoverPlay = (() => {
  if (typeof window === 'undefined') return () => false;
  try {
    const hoverOk = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const motionOk = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return () => hoverOk && motionOk;
  } catch {
    return () => false;
  }
})();

const HOVER_ARM_MS = 200;

/**
 * @param {object} opts
 * @param {string} [opts.url]      — the raw video/trailer URL ('' = none)
 * @param {boolean} [opts.disabled] — force-off (e.g. preview failed)
 * @returns {{ videoSrc: object|null, videoKind: string|null,
 *             showPreview: boolean, bind: { onMouseEnter, onMouseLeave } }}
 */
export function useHoverVideoPreview({ url = '', disabled = false } = {}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef(null);

  // Clear the arm timer if the card unmounts mid-hover.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const videoSrc = resolveVideoSource(url);
  const canPlay = canHoverPlay();
  // Only sources that can actually muted-autoplay get a hover preview:
  // direct files and YouTube/Vimeo embeds. Facebook/TikTok embeds need a
  // click to start, so those cards keep cover + badge and play in the
  // detail sheet.
  const canAutoplay = videoSrc
    ? videoSrc.kind === 'file'
      || videoSrc.provider === 'youtube'
      || videoSrc.provider === 'vimeo'
    : false;
  // ``canAutoplay`` is already false when videoSrc is null.
  const showPreview = canAutoplay && !disabled && canPlay && armed;

  function onMouseEnter() {
    if (disabled || !videoSrc || !canPlay) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setArmed(true), HOVER_ARM_MS);
  }
  function onMouseLeave() {
    setArmed(false);
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }

  return {
    videoSrc,
    showPreview,
    bind: { onMouseEnter, onMouseLeave },
  };
}
