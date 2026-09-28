import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';

/**
 * VideoPlayer — Lecteur videyo ki itilize Media Gateway la.
 *
 * Props:
 *   mediaId     — ID nan MediaAsset
 *   mediaData   — Done pre-chaje
 *   className   — CSS class anplis
 *   autoPlay    — Oto-jwe (defo: false)
 *   controls    — Montre kontwòl (defo: true)
 *   poster      — URL poster si pa gen thumbnail
 *   onEnded     — Callback lè videyo fini
 *   onError     — Callback lè gen erè
 */
export default function VideoPlayer({
  mediaId,
  mediaData,
  className = '',
  autoPlay = false,
  controls = true,
  poster: externalPoster,
  onEnded,
  onError,
}) {
  const [data, setData] = useState(mediaData || null);
  const [loading, setLoading] = useState(!mediaData && mediaId);
  const [error, setError] = useState(null);
  const [isPiP, setIsPiP] = useState(false);
  const videoRef = useRef(null);

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

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else if (videoRef.current.requestPictureInPicture) {
        await videoRef.current.requestPictureInPicture();
        setIsPiP(true);
      }
    } catch (err) {
      // PiP pa disponib
    }
  };

  // ─── Loading ─────────────────────────────────────
  if (loading) {
    return (
      <div
        className={`media-player media-loading ${className}`}
        style={{
          width: '100%',
          aspectRatio: '16/9',
          borderRadius: '12px',
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Loading video"
      >
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '2.5rem', color: 'var(--pink-primary)' }} aria-hidden="true" />
      </div>
    );
  }

  // ─── Error ───────────────────────────────────────
  if (error) {
    return (
      <div
        className={`media-player media-error ${className}`}
        style={{
          width: '100%',
          aspectRatio: '16/9',
          borderRadius: '12px',
          background: '#000',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          color: '#fff',
          cursor: 'pointer',
        }}
        onClick={retry}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); retry(); } }}
        aria-label="Retry loading video"
      >
        <i className="fas fa-exclamation-triangle" style={{ fontSize: '1.5rem', color: '#e74c3c' }} aria-hidden="true" />
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{error}</span>
        <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Tap to retry</span>
      </div>
    );
  }

  // ─── Empty ───────────────────────────────────────
  if (!data?.media_url) {
    return (
      <div
        className={`media-player media-empty ${className}`}
        style={{
          width: '100%',
          aspectRatio: '16/9',
          borderRadius: '12px',
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="No video available"
      >
        <i className="fas fa-video" style={{ fontSize: '2rem', color: '#555' }} aria-hidden="true" />
      </div>
    );
  }

  const posterUrl = externalPoster || data.thumbnail_url || data.preview_url || undefined;

  return (
    <div
      className={`media-player ${className}`}
      style={{
        width: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        background: '#000',
        position: 'relative',
      }}
    >
      <video
        ref={videoRef}
        src={data.media_url}
        poster={posterUrl}
        controls={controls}
        autoPlay={autoPlay}
        preload="metadata"
        style={{ width: '100%', display: 'block', maxHeight: '70vh' }}
        onEnded={onEnded}
        onError={() => {
          setError('Video failed to load');
          if (onError) onError(new Error('Video load error'));
        }}
        playsInline
      >
        Your browser does not support video playback.
      </video>
      {data.duration && (
        <span
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            background: 'rgba(0,0,0,0.7)',
            color: '#fff',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontFamily: 'monospace',
            pointerEvents: 'none',
          }}
        >
          {formatDuration(data.duration)}
        </span>
      )}
      {document.pictureInPictureEnabled && controls && (
        <button
          onClick={togglePiP}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 10px',
            cursor: 'pointer',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            opacity: 0.7,
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => { e.target.style.opacity = '1'; }}
          onMouseLeave={(e) => { e.target.style.opacity = '0.7'; }}
          title={isPiP ? 'Exit Picture-in-Picture' : 'Picture-in-Picture'}
        >
          <i className={`fas ${isPiP ? 'fa-compress' : 'fa-expand'}`} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
