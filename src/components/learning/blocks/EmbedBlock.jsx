/**
 * src/components/learning/blocks/EmbedBlock.jsx
 *
 * Embed external content — YouTube videos, Google Slides, CodePen,
 * or any URL that provides an embeddable iframe.
 *
 * Block data shape:
 *   { id, type: 'embed', title, embedUrl, caption, height }
 *
 * Supports auto-conversion of common URLs:
 *   - YouTube watch URLs → embed
 *   - Google Docs → preview
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';

function toEmbedUrl(url) {
  if (!url) return '';
  // YouTube watch → embed
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  // Already an embed URL
  if (url.includes('/embed/') && url.includes('youtube')) return url;
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  // Google Docs / Slides → preview
  if (url.includes('docs.google.com')) {
    return url.replace(/\/edit.*$/, '/preview').replace(/\/view.*$/, '/preview');
  }
  // Google Slides direct link
  if (url.includes('slides.google.com')) {
    return url.replace(/\/edit.*$/, '/embed').replace(/\/view.*$/, '/embed');
  }
  return url;
}

export default function EmbedBlock({
  block,
  lang = 'ht',
  index = 0,
  courseId,
  moduleIndex,
  onComplete,
  reportComplete,
  onViewed,
}) {
  const isHt = lang === 'ht';
  const embedUrl = toEmbedUrl(block.embedUrl || '');
  const caption = block.caption || '';
  const height = block.height || 400;
  const completedRef = useRef(false);

  useEffect(() => {
    onViewed?.(block.id);
    // Auto-complete on view (same as CalloutBlock, ImageBlock)
    if (!completedRef.current) {
      completedRef.current = true;
      reportComplete?.();
    }
  }, [block.id, onViewed, reportComplete]);

  const isValidUrl = useMemo(() => {
    if (!embedUrl) return false;
    try { new URL(embedUrl); return true; } catch { return false; }
  }, [embedUrl]);

  return (
    <div className="ls-block ls-block--embed" data-block-type="embed">
      {/* Header */}
      <div className="ls-block-header">
        <span className="ls-block-badge">🌐 {isHt ? 'Embedded' : 'Embed'}</span>
        <h3 className="ls-block-title">{block.title || (isHt ? 'Kontni ekstèn' : 'External Content')}</h3>
      </div>

      {/* Embed container */}
      {isValidUrl ? (
        <div style={{
          position: 'relative', width: '100%',
          borderRadius: 12, overflow: 'hidden',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          marginBottom: caption ? 8 : 0,
        }}>
          <div style={{
            position: 'relative', width: '100%',
            paddingBottom: height ? undefined : '56.25%',
            height: height || 0,
          }}>
            <iframe
              src={embedUrl}
              title={block.title || 'Embedded content'}
              style={{
                position: 'absolute', top: 0, left: 0,
                width: '100%', height: '100%',
                border: 'none',
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      ) : (
        <div style={{
          padding: 40, textAlign: 'center', borderRadius: 12,
          border: '2px dashed var(--border-subtle, #e2e8f0)',
          color: 'var(--text-secondary)',
        }}>
          <i className="fas fa-link" style={{ fontSize: '1.5rem', marginBottom: 8, display: 'block', opacity: 0.5 }} />
          <p>{isHt ? 'Pa gen URL embed valab.' : 'No valid embed URL provided.'}</p>
          <p style={{ fontSize: '0.8rem', marginTop: 4, opacity: 0.7 }}>
            {isHt ? 'Ajoute yon URL nan editè a.' : 'Add a URL in the editor.'}
          </p>
        </div>
      )}

      {/* Caption */}
      {caption && (
        <p style={{
          fontSize: '0.85rem', color: 'var(--text-secondary)',
          textAlign: 'center', marginTop: 8, fontStyle: 'italic',
        }}>
          {caption}
        </p>
      )}
    </div>
  );
}
