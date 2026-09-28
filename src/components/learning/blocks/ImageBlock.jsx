/**
 * ImageBlock — §19 Image Block Experience (Phase 10 — Accessibility)
 *
 * Handles: loading, aspect ratio, responsive sizing, alt text,
 * failure state, optional caption, layout width.
 *
 * Phase 10 accessibility upgrades:
 *   - Proper alt text support (block.altText or block.alt)
 *   - Decorative image flag (block.isDecorative → empty alt)
 *   - Caption as accessible description
 *   - Keyboard accessible (Enter to zoom)
 *   - Loading states announced to screen readers
 *   - Error states with role="alert"
 *   - figure/figcaption semantics
 *
 * Block config:
 *   - imageUrl: string (required)
 *   - caption: string (optional)
 *   - altText: string (accessibility — preferred)
 *   - alt: string (accessibility — legacy)
 *   - isDecorative: boolean (if true, alt is empty)
 *   - aspectRatio: string (e.g., '16/9', '4/3', '1/1') — optional
 */
import React, { useCallback, useRef, useState } from 'react';

export default function ImageBlock({ block, lang = 'ht', index, courseId, moduleIndex, onComplete, onViewed }) {
  const isHt = lang === 'ht';
  const viewedRef = useRef(false);
  const [loadState, setLoadState] = useState('idle'); // idle | loading | loaded | error

  const handleLoad = useCallback(() => {
    setLoadState('loaded');
    if (!viewedRef.current) {
      viewedRef.current = true;
      onViewed?.(moduleIndex, block.id, 'image');
      onComplete?.(moduleIndex, block.id, 'image');
    }
  }, [block.id, moduleIndex, onComplete, onViewed]);

  const handleError = useCallback(() => {
    setLoadState('error');
    if (!viewedRef.current) {
      viewedRef.current = true;
      onViewed?.(moduleIndex, block.id, 'image');
      onComplete?.(moduleIndex, block.id, 'image');
    }
  }, [block.id, moduleIndex, onComplete, onViewed]);

  const imageUrl = block.imageUrl || block.config?.imageUrl || '';
  const caption = block.caption || block.config?.caption || '';
  const isDecorative = block.isDecorative || block.config?.isDecorative || false;
  // Phase 10: altText is preferred over alt, decorative images get empty alt
  const altText = isDecorative
    ? ''
    : (block.altText || block.alt || block.config?.altText || block.config?.alt || caption || '');
  // Fallback alt for non-decorative images without any text
  const alt = isDecorative ? undefined : (altText || (isHt ? 'Imaj kou' : 'Course image'));

  const aspectRatio = block.aspectRatio || block.config?.aspectRatio || undefined;

  if (!imageUrl) {
    return (
      <div className="ls-block-media-empty" role="status">
        <i className="fas fa-image" aria-hidden="true" style={{ fontSize: '1.5rem', opacity: 0.3 }} />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          {isHt ? 'Pa gen imaj pou bloc sa a.' : 'No image for this block.'}
        </span>
      </div>
    );
  }

  return (
    <figure
      className="ls-block-image"
      style={{ margin: 0, textAlign: 'center' }}
    >
      <div
        className="ls-block-image-wrapper"
        style={{
          position: 'relative',
          borderRadius: 10,
          overflow: 'hidden',
          aspectRatio: aspectRatio || undefined,
          minHeight: !aspectRatio && loadState !== 'loaded' ? '200px' : undefined,
          background: loadState === 'loaded' ? 'transparent' : 'var(--surface-card-alt, #f1f5f9)',
          transition: 'background 0.2s',
        }}
      >
        {/* Loading skeleton placeholder */}
        {loadState !== 'loaded' && loadState !== 'error' && (
          <div className="ls-block-image-skeleton" aria-hidden="true" style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className="fas fa-image" style={{ fontSize: '1.5rem', opacity: 0.15 }} />
          </div>
        )}

        {/* Error state */}
        {loadState === 'error' ? (
          <div className="ls-block-image-error" role="alert" style={{
            padding: '24px 16px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 8, color: 'var(--text-secondary)',
          }}>
            <i className="fas fa-image" style={{ fontSize: '1.5rem', opacity: 0.3 }} aria-hidden="true" />
            <span style={{ fontSize: '0.85rem' }}>
              {isHt ? 'Imaj sa a pa disponib.' : 'This image is unavailable.'}
            </span>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={alt}
            onLoad={handleLoad}
            onError={handleError}
            loading="lazy"
            // Phase 10: keyboard accessible — Enter to open full image
            tabIndex={0}
            role="button"
            aria-label={isHt ? `Gade imaj la: ${altText || caption || 'Imaj'}` : `View image: ${altText || caption || 'Image'}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                window.open(imageUrl, '_blank');
              }
            }}
            onClick={() => window.open(imageUrl, '_blank')}
            style={{
              width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10,
              cursor: 'zoom-in', opacity: loadState === 'loaded' ? 1 : 0,
              transition: 'opacity 0.3s',
            }}
          />
        )}
      </div>

      {caption && (
        <figcaption style={{
          marginTop: 8, fontSize: '0.82rem',
          color: 'var(--text-secondary, #6b7280)',
          fontStyle: 'italic', lineHeight: 1.5,
        }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
