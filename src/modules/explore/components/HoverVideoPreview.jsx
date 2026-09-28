/**
 * src/modules/explore/components/HoverVideoPreview.jsx
 *
 * Overlay that plays a card's video muted-inline while hovered —
 * direct MP4/WebM via a native <video>, YouTube/Vimeo via the SAME
 * iframe embed the detail sheets render with autoplay+mute+playsinline
 * params appended (hoverEmbedSrc). Mount it INSIDE the card's image
 * wrap — it is absolutely positioned to fill it.
 *
 * Caution gates live in useHoverVideoPreview; this component only
 * mounts when the parent's ``showPreview`` is true. pointer-events:none
 * (via the shared .explore-card-hover-video class) keeps the card's
 * onClick opening the detail sheet.
 */
import React, { useEffect, useRef, useState } from 'react';
import { hoverEmbedSrc } from '../utils/videoSource';

export default function HoverVideoPreview({ videoSrc, title = '', onFail }) {
  const videoRef = useRef(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const kind = videoSrc?.kind || null;

  // Play + rewind the preview <video> on mount/unmount so a stale
  // <video> never keeps playing audio-less after mouseleave (the
  // component unmounts and the cleanup pauses + resets it). Embeds
  // need no play() — their autoplay params handle it, and unmounting
  // the iframe stops playback.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || kind !== 'file') return undefined;
    // Autoplay muted inline — no user gesture needed, but still
    // guard the promise so a blocked play() can't surface an
    // unhandled rejection.
    v.play().catch(() => { /* autoplay blocked — cover stays */ });
    return () => {
      try { v.pause(); v.currentTime = 0; } catch (_) { /* noop */ }
    };
  }, [kind]);

  if (!videoSrc) return null;

  if (kind === 'file') {
    if (videoFailed) return null;
    return (
      <video
        ref={videoRef}
        className="explore-card-hover-video"
        src={videoSrc.src}
        muted
        playsInline
        preload="none"
        aria-hidden="true"
        tabIndex={-1}
        onError={() => { setVideoFailed(true); onFail?.(); }}
      />
    );
  }

  // iframes don't fire onError, so a deleted/private video shows the
  // provider's error UI muted inside the card while hovering —
  // unavoidable without the player JS API (the sheets behave the same).
  return (
    <iframe
      className="explore-card-hover-video explore-card-hover-embed"
      src={hoverEmbedSrc(videoSrc)}
      title={title || 'Video preview'}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
