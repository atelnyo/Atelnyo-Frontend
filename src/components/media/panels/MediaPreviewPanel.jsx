/**
 * MediaPreviewPanel — Preview tab content (Slice 0 retro + Phase-2).
 *
 * Renders image / video / audio / doc / generic file based on
 * media_type. All icons route through the canonical
 * MediaIconography module so the spec icon set stays the single
 * source of truth (no inline `fa-music` / `fa-file-pdf` strings).
 */
import React from 'react';
import ImageViewer from '../ImageViewer';
import AISuggestion from '../AISuggestion';
import MediaTypeIcon from '../MediaIconography';

export default function MediaPreviewPanel({ media, lang = 'ht', className = '' }) {
  const item = media || {};
  const isHt = lang === 'ht';
  const mediaType = item.media_type || item.kind || '';
  const url = item.media_url || item.public_url || '';
  const status = item.health_status || item.status || 'unknown';
  const previewUrl = item.preview_url || url;

  if (!url) {
    return (
      <div className={`media-panel-preview media-panel-empty-preview ${className}`}>
        <MediaTypeIcon kind="image" size={42} color="#94a3b8" />
        <p>{isHt ? 'Pa gen URL pou_preview' : 'No URL to preview'}</p>
      </div>
    );
  }

  return (
    <div className={`media-panel media-panel-preview ${className}`}>
      <div className="inspector-preview">
        {mediaType === 'image' && (
          <ImageViewer mediaData={item} className="inspector-preview-img" />
        )}
        {mediaType === 'video' && (
          <div className="inspector-preview-video">
            <iframe
              src={previewUrl}
              title={item.title || 'Video'}
              className="inspector-preview-iframe"
              allowFullScreen
              allow="autoplay; encrypted-media"
            />
          </div>
        )}
        {mediaType === 'audio' && (
          <div className="inspector-preview-audio">
            <MediaTypeIcon kind="audio" size={36} color="#8b5cf6" />
            <audio src={url} controls preload="metadata" />
          </div>
        )}
        {mediaType === 'document' && (
          <div className="inspector-preview-file">
            <MediaTypeIcon kind="document" size={48} color="#f59e0b" />
            <p>{url.split('/').pop() || (isHt ? 'Dokiman' : 'Document')}</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              <i className="fas fa-external-link-alt" />
              {isHt ? 'Louvri' : 'Open'}
            </a>
          </div>
        )}
        {!['image', 'video', 'audio', 'document'].includes(mediaType) && (
          <div className="inspector-preview-file">
            <MediaTypeIcon kind="document" size={42} color="#94a3b8" />
            <p>{url.split('/').pop() || '—'}</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              <i className="fas fa-external-link-alt" />
              {isHt ? 'Louvri' : 'Open'}
            </a>
          </div>
        )}
      </div>

      {(status === 'broken' || status === 'blocked' || status === 'expired') && (
        <AISuggestion
          statusCode={item.status_code}
          errorMessage={item.error_message}
          provider={item.provider_name || item.provider}
          lang={lang}
        />
      )}
    </div>
  );
}
