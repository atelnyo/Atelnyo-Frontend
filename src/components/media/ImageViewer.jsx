import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

/**
 * ImageViewer — Affiche yon imaj atravè Media Gateway la.
 *
 * Props:
 *   mediaId  — ID nan MediaAsset (itilize gateway pou chache URL la)
 *   mediaData — Done pre-chaje (si deja genyen, pa fè gateway call)
 *   className — CSS class anplis
 *   alt       — Alt tèks pou imaj la
 *   lazy      — lazy loading (defo: true)
 *   onClick   — handler lè klike sou imaj la
 */
export default function ImageViewer({
  mediaId,
  mediaData,
  className = '',
  alt = '',
  lazy = true,
  onClick,
}) {
  const [data, setData] = useState(mediaData || null);
  const [loading, setLoading] = useState(!mediaData && mediaId);
  const [error, setError] = useState(null);
  const [imgError, setImgError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const fetchMedia = useCallback(async () => {
    if (!mediaId) return;
    // Always reset error states — critical for retry after image load failure.
    // data may already exist from the initial gateway fetch, but we still
    // need to reset imgError + bump retryCount so the <img key={retryCount}>
    // forces the browser to re-request the URL.
    setImgError(false);
    setRetryCount((c) => c + 1);
    if (data) return; // Gateway data still valid — just retry the browser load
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/media/assets/${mediaId}/gateway/`);
      if (res?.data) {
        setData(res.data);
      } else {
        setError('Media not found');
      }
    } catch (err) {
      if (err?.response?.status === 403) {
        setError('Access denied');
      } else if (err?.response?.status === 503) {
        setError('Media unavailable (broken link)');
      } else {
        setError('Failed to load media');
      }
    } finally {
      setLoading(false);
    }
  }, [mediaId, data]);

  useEffect(() => {
    if (!mediaData && mediaId) fetchMedia();
  }, [mediaId, mediaData, fetchMedia]);

  // ─── Loading ─────────────────────────────────────
  if (loading) {
    return (
      <div
        className={`media-viewer media-loading ${className}`}
        style={{
          width: '100%',
          aspectRatio: '16/9',
          borderRadius: '12px',
          background: 'var(--pink-light, #fce4ec)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'pulse 1.5s infinite ease-in-out',
        }}
        aria-label="Loading media"
      >
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--pink-primary)' }} aria-hidden="true" />
      </div>
    );
  }

  // ─── Error ───────────────────────────────────────
  if (error) {
    return (
      <div
        className={`media-viewer media-error ${className}`}
        style={{
          width: '100%',
          aspectRatio: '16/9',
          borderRadius: '12px',
          background: 'var(--pink-light, #fce4ec)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          color: 'var(--text-secondary, #888)',
          cursor: 'pointer',
        }}
        onClick={fetchMedia}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fetchMedia(); } }}
        aria-label="Retry loading media"
      >
        <i className="fas fa-exclamation-triangle" style={{ fontSize: '1.5rem', color: '#e74c3c' }} aria-hidden="true" />
        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{error}</span>
        <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>Tap to retry</span>
      </div>
    );
  }

  // ─── Empty ───────────────────────────────────────
  if (!data?.media_url) {
    return (
      <div
        className={`media-viewer media-empty ${className}`}
        style={{
          width: '100%',
          aspectRatio: '16/9',
          borderRadius: '12px',
          background: 'var(--pink-light, #fce4ec)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary, #888)',
        }}
        aria-label="No media available"
      >
        <i className="fas fa-image" style={{ fontSize: '2rem', opacity: 0.5 }} aria-hidden="true" />
      </div>
    );
  }

  // ─── Image ───────────────────────────────────────
  if (imgError) {
    return (
      <div
        className={`media-viewer media-error ${className}`}
        style={{
          width: '100%',
          aspectRatio: '16/9',
          borderRadius: '12px',
          background: 'var(--pink-light, #fce4ec)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          color: 'var(--text-secondary, #888)',
          cursor: 'pointer',
        }}
        onClick={fetchMedia}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fetchMedia(); } }}
        aria-label="Retry loading image"
      >
        <i className="fas fa-broken-image" style={{ fontSize: '1.5rem', color: '#e74c3c' }} aria-hidden="true" />
        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Image failed to load</span>
        <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>Tap to retry</span>
      </div>
    );
  }

  return (
    <div
      className={`media-viewer ${className}`}
      style={{
        width: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}
    >
      <img
        key={retryCount}
        src={data.media_url}
        alt={alt || 'Media'}
        loading={lazy ? 'lazy' : undefined}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          aspectRatio: data.width && data.height ? `${data.width}/${data.height}` : undefined,
          objectFit: 'cover',
        }}
        onError={() => setImgError(true)}
      />
    </div>
  );
}
