import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

/**
 * DocumentViewer — Visualizè pou dokiman (PDF, Word, text)
 * ki itilize Media Gateway la.
 *
 * Props:
 *   mediaId     — ID nan MediaAsset
 *   mediaData   — Done pre-chaje
 *   className   — CSS class anplis
 *   height      — Wotè iframe a (defo: 500px)
 *   onError     — Callback lè gen erè
 */
export default function DocumentViewer({
  mediaId,
  mediaData,
  className = '',
  height = 500,
  onError,
}) {
  const [data, setData] = useState(mediaData || null);
  const [loading, setLoading] = useState(!mediaData && mediaId);
  const [error, setError] = useState(null);

  const fetchMedia = useCallback(async () => {
    if (!mediaId || data) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/media/assets/${mediaId}/gateway/`);
      if (res?.data) {
        setData(res.data);
      } else {
        setError('Document not found');
      }
    } catch (err) {
      if (err?.response?.status === 403) setError('Access denied');
      else if (err?.response?.status === 503) setError('Document unavailable (broken link)');
      else setError('Failed to load document');
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  }, [mediaId, data, onError]);

  useEffect(() => {
    if (!mediaData && mediaId) fetchMedia();
  }, [mediaId, mediaData, fetchMedia]);

  // ─── Loading ─────────────────────────────────────
  if (loading) {
    return (
      <div
        className={`media-doc media-loading ${className}`}
        style={{
          width: '100%',
          height: `${height}px`,
          borderRadius: '12px',
          background: 'var(--pink-light, #fce4ec)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          animation: 'pulse 1.5s infinite ease-in-out',
        }}
        aria-label="Loading document"
      >
        <i className="fas fa-file fa-spin" style={{ fontSize: '2rem', color: 'var(--pink-primary)' }} aria-hidden="true" />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #888)' }}>Loading document…</span>
      </div>
    );
  }

  // ─── Error ───────────────────────────────────────
  if (error) {
    return (
      <div
        className={`media-doc media-error ${className}`}
        style={{
          width: '100%',
          height: `${height}px`,
          borderRadius: '12px',
          background: 'var(--pink-light, #fce4ec)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          cursor: 'pointer',
        }}
        onClick={fetchMedia}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fetchMedia(); } }}
        aria-label="Retry loading document"
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
        className={`media-doc media-empty ${className}`}
        style={{
          width: '100%',
          height: `${height}px`,
          borderRadius: '12px',
          background: 'var(--pink-light, #fce4ec)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
        }}
        aria-label="No document available"
      >
        <i className="fas fa-file-alt" style={{ fontSize: '2rem', color: 'var(--text-secondary, #888)' }} aria-hidden="true" />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #888)' }}>No document available</span>
      </div>
    );
  }

  // ─── Determine viewer type ──────────────────────
  const mime = (data.mime_type || '').toLowerCase();
  const isPdf = mime.includes('pdf');
  const isText = mime.includes('text/');
  const isImage = mime.includes('image/');
  const isOffice = mime.includes('word') || mime.includes('officedocument') || mime.includes('sheet');

  return (
    <div
      className={`media-doc ${className}`}
      style={{
        width: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid var(--border-color, rgba(216,27,96,0.1))',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        background: 'var(--card-bg, #fff)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color, rgba(216,27,96,0.1))',
          background: 'var(--pink-light, #fce4ec)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i
            className={`fas ${isPdf ? 'fa-file-pdf' : isText ? 'fa-file-alt' : isImage ? 'fa-file-image' : isOffice ? 'fa-file-word' : 'fa-file'}`}
            style={{ color: 'var(--pink-primary, #d81b60)' }}
            aria-hidden="true"
          />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main, #333)' }}>
            {isPdf ? 'PDF Document' : isText ? 'Text Document' : 'Document'}
          </span>
        </div>
        <a
          href={data.media_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            background: 'var(--pink-primary, #d81b60)',
            color: '#fff',
            textDecoration: 'none',
            fontSize: '0.75rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => { e.target.style.opacity = '0.85'; }}
          onMouseLeave={(e) => { e.target.style.opacity = '1'; }}
        >
          <i className="fas fa-download" aria-hidden="true" />
          Open
        </a>
      </div>

      {/* Viewer */}
      <div style={{ height: `${height - 50}px`, overflow: 'hidden', background: '#f5f5f5' }}>
        {isPdf ? (
          <iframe
            src={`${data.media_url}#navpanes=0&view=FitH`}
            title="PDF Viewer"
            width="100%"
            height="100%"
            style={{ border: 'none' }}
            sandbox="allow-scripts"
            loading="lazy"
          />
        ) : isImage ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '16px' }}>
            <img
              src={data.media_url}
              alt="Document preview"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '4px' }}
              loading="lazy"
            />
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '12px',
              color: '#888',
              padding: '20px',
              textAlign: 'center',
            }}
          >
            <i className="fas fa-file" style={{ fontSize: '2.5rem', opacity: 0.5 }} aria-hidden="true" />
            <span style={{ fontSize: '0.85rem' }}>
              Preview not available for this file type.
            </span>
            <a
              href={data.media_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '8px 20px',
                borderRadius: '6px',
                background: 'var(--pink-primary, #d81b60)',
                color: '#fff',
                textDecoration: 'none',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              <i className="fas fa-download" style={{ marginRight: '6px' }} aria-hidden="true" />
              Download file
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
