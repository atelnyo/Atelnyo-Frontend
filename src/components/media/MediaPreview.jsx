/**
 * MediaPreview — Preview medya ak metadòdetay.
 *
 * Montre yon preview (Image, Video, Audio, Document) avèk:
 *   - Media type badge
 *   - Provider badge
 *   - Dimensions (width × height)
 *   - File size
 *   - Duration (video/audio)
 *   - MIME type
 *   - Status indicator
 *   - Copy URL button
 */
import React, { useState } from 'react';
import MediaBadge from './MediaBadge';
import ImageViewer from './ImageViewer';

function fmtFileSize(bytes) {
  if (bytes == null) return '—';
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

function fmtDuration(seconds) {
  if (seconds == null || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MediaPreview({
  data,
  media,
  mediaId,
  className = '',
  lang = 'ht',
}) {
  const item = data || media || {};
  const [copied, setCopied] = useState(false);
  const isHt = lang === 'ht';

  if (!item) return null;

  const mediaType = item.media_type || item.kind || '';
  const status = item.health_status || item.status || 'unknown';
  const url = item.media_url || item.public_url || '';
  const provider = item.provider_name || item.provider || '';
  const mimeType = item.mime_type || '';
  const width = item.width;
  const height = item.height;
  const size = item.size_bytes || item.file_size || item.content_length;
  const duration = item.duration;

  const handleCopyUrl = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`media-preview ${className}`}>
      {/* ─── Viewer ───────────────────────────────────────────── */}
      <div className="media-preview-viewer">
        {mediaType === 'image' ? (
          <ImageViewer mediaData={item} className="media-preview-image" />
        ) : mediaType === 'video' ? (
          <div className="media-preview-video">
            <iframe
              src={item.preview_url || url}
              title={item.title || 'Video preview'}
              className="media-preview-iframe"
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          </div>
        ) : mediaType === 'audio' ? (
          <div className="media-preview-audio">
            <div className="media-preview-audio-icon">
              <i className="fas fa-music" />
            </div>
            <audio
              src={url}
              controls
              className="media-preview-audio-player"
              preload="metadata"
            >
              {isHt ? 'Navigatè w pa sipòte odyo.' : 'Your browser does not support audio.'}
            </audio>
          </div>
        ) : (
          <div className="media-preview-file">
            <i className="fas fa-file-alt" />
            <p>{url ? url.split('/').pop() : (isHt ? 'Medya' : 'Media')}</p>
          </div>
        )}
      </div>

      {/* ─── Metadata ─────────────────────────────────────────── */}
      <div className="media-preview-meta">
        <div className="media-preview-meta-row">
          <MediaBadge status={status} lang={lang} />
          {provider && (
            <span className="media-preview-provider">
              <i className="fas fa-cloud" aria-hidden="true" />
              {provider}
            </span>
          )}
          {mediaType && (
            <span className="media-preview-type">
              <i className={`fas ${mediaType === 'image' ? 'fa-image' : mediaType === 'video' ? 'fa-video' : mediaType === 'audio' ? 'fa-music' : 'fa-file'}`} aria-hidden="true" />
              {mediaType}
            </span>
          )}
        </div>

        <div className="media-preview-meta-grid">
          {width && height && (
            <div className="media-preview-meta-item">
              <span className="media-preview-meta-label">{isHt ? 'Dimansyon' : 'Dimensions'}</span>
              <span className="media-preview-meta-value">{width} × {height}</span>
            </div>
          )}
          {size != null && (
            <div className="media-preview-meta-item">
              <span className="media-preview-meta-label">{isHt ? 'Gwosè' : 'Size'}</span>
              <span className="media-preview-meta-value">{fmtFileSize(size)}</span>
            </div>
          )}
          {duration != null && duration > 0 && (
            <div className="media-preview-meta-item">
              <span className="media-preview-meta-label">{isHt ? 'Dire' : 'Duration'}</span>
              <span className="media-preview-meta-value">{fmtDuration(duration)}</span>
            </div>
          )}
          {mimeType && (
            <div className="media-preview-meta-item">
              <span className="media-preview-meta-label">MIME</span>
              <span className="media-preview-meta-value">{mimeType}</span>
            </div>
          )}
        </div>

        {/* URL */}
        {url && (
          <div className="media-preview-url">
            <code className="media-preview-url-text">{url}</code>
            <button
              type="button"
              className="media-preview-url-copy"
              onClick={handleCopyUrl}
              title={isHt ? 'Kopi URL' : 'Copy URL'}
              aria-label={isHt ? 'Kopi URL' : 'Copy URL'}
            >
              <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
