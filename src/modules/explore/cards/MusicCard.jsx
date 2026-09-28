/**
 * src/modules/explore/cards/MusicCard.jsx
 *
 * Music card with inline audio preview — now with music-themed SVG fallback.
 */
import React, { useEffect, useRef, useState } from 'react';
import api from '../../../services/api';
import { classNames, formatPlays } from '../utils/cardHelpers';
import { useHoverVideoPreview } from '../hooks/useHoverVideoPreview';
import HoverVideoPreview from '../components/HoverVideoPreview';
import SaveCountChip from './SaveCountChip';
import TrendingVelocity from './TrendingVelocity';

/** SVG fallback — music-themed gradient with note icon */
function MusicFallback({ title, isHt }) {
  return (
    <div className="explore-card-fallback" style={{ aspectRatio: '1/1' }}>
      <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="mf-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#d81b60" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <rect width="400" height="400" fill="url(#mf-grad)" />
        <g transform="translate(200,180)" opacity="0.2">
          {/* Music note */}
          <ellipse cx="-15" cy="40" rx="20" ry="16" fill="#8b5cf6" />
          <ellipse cx="25" cy="50" rx="20" ry="16" fill="#8b5cf6" />
          <path d="M5 40 L5 -30 L45 -20 L45 50" stroke="#8b5cf6" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 -30 L45 -20" stroke="#8b5cf6" strokeWidth="5" fill="none" strokeLinecap="round" />
        </g>
        <text x="200" y="320" textAnchor="middle" fill="#8b5cf6" opacity="0.5"
              fontFamily="system-ui, -apple-system, sans-serif" fontSize="13" fontWeight="600">
          {title || (isHt ? 'Mizik' : 'Music')}
        </text>
      </svg>
    </div>
  );
}

export default function MusicCard({ track, onOpen, showToast, t, isSaved, onSaveToggle, saveCount = null, lang = 'ht' }) {
  const [previewing, setPreviewing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  // Hover video preview — direct MP4/WebM via a muted <video>, and
  // YouTube/Vimeo via the SAME iframe embed the detail sheet uses with
  // autoplay+mute+playsinline params appended so it can start inline
  // without a user gesture. Shared caution gates + arm delay live in
  // useHoverVideoPreview; ``previewDisabled`` trips when the preview
  // video itself fails so the card falls back to the static cover.
  const [previewDisabled, setPreviewDisabled] = useState(false);
  const audioRef = useRef(null);
  const lastProgress = useRef(0);

  // Derived URL fields — MUST be declared before any effect below
  // references them (JS ``const`` lives in the temporal dead zone
  // until its declaration executes; putting ``[video]`` in an effect
  // dep array before this line threw ``Cannot access 'video' before
  // initialization`` on EVERY MusicCard render, blanking the whole
  // Explore page).
  const cover = track.cover || track.cover_url || '';
  const preview = track.preview || track.preview_url || '';
  const video = track.video || track.video_url || '';

  useEffect(() => {
    return () => { if (audioRef.current) audioRef.current.pause(); };
  }, []);

  // If the track changes (feed refetch / edit), a previously failed
  // preview gets another chance. Intentional synchronous reset on
  // track change — same pattern as the fetch-effects in App.jsx.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviewDisabled(false);
  }, [video]);

  // Feed items (HomeFeed / recommended / DEIE rails) arrive with the
  // backend canonical field names (``cover_url`` / ``preview_url`` /
  // ``video_url``); Explore.jsx normalises to the short names via
  // ``normalizeTrack`` (see ../utils/cardHelpers). Accept BOTH here so
  // every rail renders the real cover instead of the SVG fallback —
  // same pattern as TalentCard (``avatar || avatar_url``). Without
  // this, the HomeFeed music rail showed the placeholder on every
  // card until the sheet opened (the sheet reads both names). If the
  // field mapping ever changes, update ``normalizeTrack`` AND this
  // block together.
  const hasPreview = Boolean(preview);
  const hasVideo = Boolean(video);
  const hasCover = Boolean(cover);

  // ─── Hover video preview (caution-gated) ─────────────────────────
  //   • Any recognized video: direct MP4/WebM (<video>) and YouTube /
  //     Vimeo (the sheet's iframe embed + autoplay params).
  //   • Only on devices with a real hover pointer (desktop). Touch
  //     cards never autoplay — they keep cover + badge + click→sheet.
  //   • Respect prefers-reduced-motion — no autoplay for those users.
  //   • The <video> uses preload="none" and the iframe only mounts on
  //     hover — nothing downloads for cards the user never hovers.
  //   • pointer-events:none — clicks still open the detail sheet.
  //   • One-at-a-time is inherent: only the hovered card mounts a
  //     preview, and mouseleave unmounts it (an iframe remounts fresh
  //     each hover, so every preview starts from 0).
  const { videoSrc, showPreview, bind } = useHoverVideoPreview({
    url: video,
    disabled: previewDisabled,
  });

  function handleClick(e) {
    if (e.target.closest('.explore-card-preview-bar')) return;
    if (e.target.closest('.explore-card-save-overlay')) return;
    if (onOpen) {
      onOpen(track);
    } else if (!hasPreview) {
      return;
    }
  }

  async function togglePreview(e) {
    e.stopPropagation();
    if (!hasPreview) {
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (previewing) {
      audio.pause();
      setPreviewing(false);
      return;
    }
    try {
      await audio.play();
      setPreviewing(true);
      api.post(`/explore/music/${track.id}/play/`).catch(() => {});
    } catch (err) {
      showToast?.(t.explore_audio_blocked || 'Tap again to play', 'play');
    }
  }

  function handleSaveClick(e) {
    e.stopPropagation();
    if (onSaveToggle) onSaveToggle(track);
  }

  function onTimeUpdate() {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const now = Date.now();
    if (now - lastProgress.current < 200) return;
    lastProgress.current = now;
    setProgressPct(Math.min(100, (audio.currentTime / audio.duration) * 100));
  }
  function onEnded() {
    setPreviewing(false);
    setProgressPct(0);
    lastProgress.current = 0;
  }

  return (
    <div
      className={`explore-card explore-card-music${showPreview ? ' is-video-previewing' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(e); } }}
      onMouseEnter={bind.onMouseEnter}
      onMouseLeave={bind.onMouseLeave}
      data-testid="music-card"
      data-music-id={track.id}
    >
      <div className="explore-card-image-wrap explore-card-image-square">
        {hasCover && !imgFailed ? (
          <img
            className={`explore-card-image ${imgLoaded ? 'explore-card-image--loaded' : ''}`}
            src={cover}
            alt={track.title}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <MusicFallback title={track.title} isHt={false} />
        )}
        {/* Hover video preview — shared overlay (native <video> or
            iframe embed). pointer-events:none keeps the card's onClick
            firing. */}
        {showPreview && (
          <HoverVideoPreview
            videoSrc={videoSrc}
            title={track.title || 'Music video preview'}
            onFail={() => setPreviewDisabled(true)}
          />
        )}
        <button
          type="button"
          className={`explore-card-play-overlay ${previewing ? 'is-playing' : ''}`}
          onClick={togglePreview}
          aria-label={previewing ? (t.explore_pause || 'Pause') : (t.explore_play || 'Play preview')}
          aria-pressed={previewing}
        >
          <i className={`fas ${previewing ? 'fa-pause' : 'fa-play'}`} aria-hidden="true" />
        </button>
        {track.is_featured && (
          <div className="explore-card-badge explore-card-badge-star" aria-label={t.explore_chip_featured || 'Featured'}>
            <i className="fas fa-star" aria-hidden="true" />
          </div>
        )}
        <button
          type="button"
          className={classNames('explore-card-save-overlay', isSaved && 'is-saved')}
          onClick={handleSaveClick}
          aria-pressed={Boolean(isSaved)}
          aria-label={isSaved ? (t.mwen_unsave || 'Remove from saved') : (t.mwen_save || 'Save')}
          title={isSaved ? (t.mwen_unsave || 'Remove from saved') : (t.mwen_save || 'Save')}
          data-testid="music-card-save-btn"
        >
          <i className={isSaved ? 'fas fa-heart' : 'far fa-heart'} aria-hidden="true" />
        </button>
        <div className="explore-card-duration">{track.duration}</div>
        {/* Trending Velocity — shows how fast this track is rising */}
        {Number(track?._score?.trending) > 10 && (
          <TrendingVelocity
            score={track._score.trending}
            lang={lang || 'ht'}
            size="sm"
          />
        )}
        {hasVideo && (
          <div
            className="explore-card-video-badge"
            aria-label={t.explore_video_title || 'Music Video'}
            title={t.explore_video_title || 'Music Video'}
          >
            <i className="fas fa-video" aria-hidden="true" />
          </div>
        )}
        {hasPreview && (
          <div
            className="explore-card-preview-bar"
            onClick={(e) => e.stopPropagation()}
            style={{ '--pct': `${progressPct}%` }}
          >
            <div className="explore-card-preview-fill" />
          </div>
        )}
      </div>
      <div className="explore-card-body explore-card-body-tight">
        <div className="explore-card-title">{track.title}</div>
        <div className="explore-card-subtitle">{track.artist}</div>
        <div className="explore-card-meta">
          {track.genre && <span className="explore-card-tag">{track.genre}</span>}
          <span className="explore-card-plays">
            <i className="fas fa-headphones" aria-hidden="true" /> {formatPlays(track.plays)}
          </span>
          <SaveCountChip count={saveCount} t={t} />
        </div>
      </div>
      {hasPreview && (
        <audio
          ref={audioRef}
          src={preview}
          preload="none"
          onTimeUpdate={onTimeUpdate}
          onEnded={onEnded}
        />
      )}
    </div>
  );
}
