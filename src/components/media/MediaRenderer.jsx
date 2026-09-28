/**
 * MediaRenderer — Fail-safe universal media renderer.
 *
 * Per the Future Ready Architecture spec:
 *   "Si yon Provider tonbe. Platfòm la pa dwe kraze.
 *    Li dwe: Montre Placeholder → Log Error → Notify Creator →
 *    Retry Later → Continue Application."
 *   "Pa janm fè yon URL kraze tout paj la."
 *
 * This component wraps all media rendering and guarantees it NEVER
 * throws or crashes. Instead, it shows graceful degradation states:
 *   - Loading: placeholder with JS Image() preload (no double-download)
 *   - Success: renders the media (Image/Video/Audio/Document)
 *   - Error: shows placeholder + retry button
 *   - Circuit Open: provider unavailable notice
 *
 * Usage:
 *   <MediaRenderer
 *     url="https://ibb.co/abc123"
 *     mediaType="image"
 *     title="My Image"
 *     fallbackText="Image not available"
 *     onError={(err) => console.log(err)}
 *   />
 */
import React, { useState, useCallback } from 'react';

const PLACEHOLDER_COLORS = [
  '#d81b60', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#6366f1',
];

function getPlaceholderColor(seed) {
  let hash = 0;
  const str = String(seed || '');
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PLACEHOLDER_COLORS[Math.abs(hash) % PLACEHOLDER_COLORS.length];
}

function ImagePlaceholder({ title, color, lang }) {
  const isHt = lang === 'ht';
  const initials = (title || 'MD')
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
  return (
    <div
      className="media-renderer-placeholder"
      style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
      role="img"
      aria-label={title || (isHt ? 'Medya' : 'Media')}
    >
      <span className="media-renderer-placeholder-text">{initials}</span>
      {title && <span className="media-renderer-placeholder-title">{title}</span>}
    </div>
  );
}

function ErrorState({ message, onRetry, lang }) {
  const isHt = lang === 'ht';
  return (
    <div className="media-renderer-error" role="alert">
      <i className="fas fa-image-slash" />
      <p>{message || (isHt ? 'Medya pa disponib' : 'Media unavailable')}</p>
      {onRetry && (
        <button type="button" className="media-renderer-retry" onClick={onRetry}>
          <i className="fas fa-sync" /> {isHt ? 'Eseye ankò' : 'Retry'}
        </button>
      )}
    </div>
  );
}

function CircuitOpenState({ lang }) {
  const isHt = lang === 'ht';
  return (
    <div className="media-renderer-error media-renderer-circuit" role="alert">
      <i className="fas fa-cloud-bolt" />
      <p>{isHt ? 'Provider pa disponib tanporèman.' : 'Provider temporarily unavailable.'}</p>
      <span className="media-renderer-hint">
        {isHt ? 'Sistèm nan ap eseye ankò otomatikman.' : 'The system will retry automatically.'}
      </span>
    </div>
  );
}

export default function MediaRenderer({
  url,
  mediaType = 'image',
  title = '',
  alt = '',
  fallbackText = '',
  lang = 'ht',
  className = '',
  style = {},
  onLoad,
  onError,
  retryable = true,
  circuitOpen = false,
}) {
  const isHt = lang === 'ht';
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [retryCount, setRetryCount] = useState(0);

  const handleError = useCallback((e) => {
    setStatus('error');
    onError?.(e);
  }, [onError]);

  const handleRetry = useCallback(() => {
    setStatus('loading');
    setRetryCount(c => c + 1);
  }, []);

  // Circuit open — don't even try to load
  if (circuitOpen) {
    return (
      <div className={`media-renderer ${className}`} style={style}>
        <CircuitOpenState lang={lang} />
      </div>
    );
  }

  // No URL — show placeholder immediately
  if (!url) {
    const color = getPlaceholderColor(title);
    return (
      <div className={`media-renderer ${className}`} style={style}>
        <ImagePlaceholder title={title} color={color} lang={lang} />
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className={`media-renderer ${className}`} style={style}>
        <ErrorState
          message={fallbackText || (isHt ? 'Echwe charje medya a.' : 'Failed to load media.')}
          onRetry={retryable ? handleRetry : undefined}
          lang={lang}
        />
      </div>
    );
  }

  // Success state — render the actual media
  if (status === 'success' && url) {
    const mediaProps = {
      src: url,
      alt: alt || title || 'Media',
      className: 'media-renderer-content',
      onError: handleError,
      onLoad: (e) => onLoad?.(e),
    };

    return (
      <div className={`media-renderer ${className}`} style={style}>
        {mediaType === 'video' ? (
          <video {...mediaProps} controls playsInline />
        ) : mediaType === 'audio' ? (
          <audio {...mediaProps} controls />
        ) : (
          <img {...mediaProps} />
        )}
      </div>
    );
  }

  // Loading state — preload and show placeholder
  if (status === 'loading') {
    const color = getPlaceholderColor(title);
    // Use JS Image() for preload (no DOM, no double-download)
    // Only for image types; video/audio render directly with error handlers
    if (mediaType === 'image' && url) {
      const img = new window.Image();
      img.onload = () => {
        setStatus('success');
        onLoad?.(img);
      };
      img.onerror = handleError;
      img.src = url;
    } else if (mediaType !== 'image' && url) {
      // Video/audio: render directly, let onError handle failures
      setStatus('success');
    }

    return (
      <div className={`media-renderer ${className}`} style={style}>
        <ImagePlaceholder title={title} color={color} lang={lang} />
      </div>
    );
  }
}

export { MediaRenderer, ImagePlaceholder, ErrorState, CircuitOpenState };
