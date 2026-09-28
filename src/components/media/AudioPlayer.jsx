import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';

/**
 * AudioPlayer — Lecteur odyo ki itilize Media Gateway la.
 *
 * Props:
 *   mediaId     — ID nan MediaAsset
 *   mediaData   — Done pre-chaje
 *   className   — CSS class anplis
 *   autoPlay    — Oto-jwe (defo: false)
 *   onEnded     — Callback lè odyo fini
 *   onError     — Callback lè gen erè
 *   compact     — Vèsyon ti (defo: false)
 */
export default function AudioPlayer({
  mediaId,
  mediaData,
  className = '',
  autoPlay = false,
  onEnded,
  onError,
  compact = false,
}) {
  const [data, setData] = useState(mediaData || null);
  const [loading, setLoading] = useState(!mediaData && mediaId);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);
  const animFrameRef = useRef(null);

  // Media-Gateway fetch split into a pure request fn (no setState) +
  // state-writing helpers. The initial load effect wires them via
  // promise callbacks so NO setState ever runs synchronously in the
  // effect body (react-hooks/set-state-in-effect), and the effect
  // gets a proper cancellation flag.
  const getMedia = useCallback(
    () => api.get(`/media/assets/${mediaId}/gateway/`),
    [mediaId],
  );

  const applyMedia = useCallback((res) => {
    if (res?.data) {
      setData(res.data);
      setError(null);
    } else {
      setError('Media not found');
    }
  }, []);

  const applyError = useCallback((err) => {
    if (err?.response?.status === 403) setError('Access denied');
    else if (err?.response?.status === 503) setError('Media unavailable (broken link)');
    else setError('Failed to load media');
    if (onError) onError(err);
  }, [onError]);

  const finishLoading = useCallback(() => setLoading(false), []);

  useEffect(() => {
    if (mediaData || !mediaId) return;
    let cancelled = false;
    getMedia()
      .then((res) => { if (!cancelled) applyMedia(res); })
      .catch((err) => { if (!cancelled) applyError(err); })
      .finally(() => { if (!cancelled) finishLoading(); });
    return () => { cancelled = true; };
  }, [mediaData, mediaId, getMedia, applyMedia, applyError, finishLoading]);

  // Retry path (error-state tap) — event handler, setState is fine.
  const retry = useCallback(() => {
    setLoading(true);
    getMedia()
      .then(applyMedia)
      .catch(applyError)
      .finally(finishLoading);
  }, [getMedia, applyMedia, applyError, finishLoading]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      if (data?.duration && !audioRef.current.duration) {
        setDuration(data.duration);
      }
    }
  };

  const handlePlay = () => setPlaying(true);
  const handlePause = () => setPlaying(false);

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    if (audioRef.current) {
      audioRef.current.currentTime = pct * (duration || audioRef.current.duration || 0);
    }
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  // ─── Loading ─────────────────────────────────────
  if (loading) {
    return (
      <div
        className={`media-audio media-loading ${className}`}
        style={{
          width: '100%',
          padding: compact ? '16px' : '24px',
          borderRadius: '12px',
          background: 'var(--pink-light, #fce4ec)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          animation: 'pulse 1.5s infinite ease-in-out',
        }}
        aria-label="Loading audio"
      >
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '1.5rem', color: 'var(--pink-primary)' }} aria-hidden="true" />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #888)' }}>Loading audio…</span>
      </div>
    );
  }

  // ─── Error ───────────────────────────────────────
  if (error) {
    return (
      <div
        className={`media-audio media-error ${className}`}
        style={{
          width: '100%',
          padding: compact ? '16px' : '24px',
          borderRadius: '12px',
          background: 'var(--pink-light, #fce4ec)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          cursor: 'pointer',
        }}
        onClick={retry}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); retry(); } }}
        aria-label="Retry loading audio"
      >
        <i className="fas fa-exclamation-triangle" style={{ fontSize: '1.2rem', color: '#e74c3c' }} aria-hidden="true" />
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{error} — tap to retry</span>
      </div>
    );
  }

  // ─── Empty ───────────────────────────────────────
  if (!data?.media_url) {
    return (
      <div
        className={`media-audio media-empty ${className}`}
        style={{
          width: '100%',
          padding: compact ? '16px' : '24px',
          borderRadius: '12px',
          background: 'var(--pink-light, #fce4ec)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
        }}
        aria-label="No audio available"
      >
        <i className="fas fa-music" style={{ fontSize: '1.2rem', color: 'var(--text-secondary, #888)' }} aria-hidden="true" />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #888)' }}>No audio available</span>
      </div>
    );
  }

  return (
    <div
      className={`media-audio ${className}`}
      style={{
        width: '100%',
        padding: compact ? '12px 16px' : '20px',
        borderRadius: '12px',
        background: 'var(--card-bg, #fff)',
        border: '1px solid var(--border-color, rgba(216,27,96,0.1))',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      <audio
        ref={audioRef}
        src={data.media_url}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={() => { setPlaying(false); if (onEnded) onEnded(); }}
        onError={() => setError('Audio failed to load')}
        style={{ display: 'none' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          style={{
            width: compact ? '36px' : '44px',
            height: compact ? '36px' : '44px',
            borderRadius: '50%',
            border: 'none',
            background: 'var(--pink-primary, #d81b60)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: compact ? '0.9rem' : '1.1rem',
            flexShrink: 0,
            transition: 'transform 0.15s, box-shadow 0.15s',
            boxShadow: '0 2px 8px rgba(216,27,96,0.3)',
          }}
          onMouseEnter={(e) => { e.target.style.transform = 'scale(1.05)'; }}
          onMouseLeave={(e) => { e.target.style.transform = 'scale(1)'; }}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          <i className={`fas ${playing ? 'fa-pause' : 'fa-play'}`} aria-hidden="true" />
        </button>

        {/* Progress Bar + Time */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div
            onClick={handleSeek}
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '3px',
              background: 'var(--pink-light, #fce4ec)',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
            }}
            role="slider"
            aria-label="Audio progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressPct)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') { e.preventDefault(); if (audioRef.current) audioRef.current.currentTime = Math.min((currentTime + 5), duration); }
              if (e.key === 'ArrowLeft') { e.preventDefault(); if (audioRef.current) audioRef.current.currentTime = Math.max((currentTime - 5), 0); }
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: '100%',
                borderRadius: '3px',
                background: 'var(--pink-primary, #d81b60)',
                transition: 'width 0.1s linear',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary, #888)', fontFamily: 'monospace' }}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(data.duration || duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds) {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
