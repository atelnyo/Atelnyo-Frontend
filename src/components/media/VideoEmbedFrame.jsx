import React, { useState } from 'react';

export default function VideoEmbedFrame({
  src,
  title,
  lang = 'en',
  allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
  allowFullScreen = true,
  loading = 'lazy',
  loadingText,
  referrerPolicy,
  className = '',
  frameClassName = '',
  ariaHidden = false,
  tabIndex,
  style = {},
}) {
  const [loadedSrc, setLoadedSrc] = useState('');
  const isLoaded = loadedSrc === src;
  const isHt = lang === 'ht';

  return (
    <div
      className={className}
      aria-hidden={ariaHidden || undefined}
      style={{
        position: 'relative',
        aspectRatio: '16 / 9',
        overflow: 'hidden',
        background: '#000',
        ...style,
      }}
    >
      {!isLoaded && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            color: '#fff',
            background: '#111827',
            fontSize: '0.875rem',
          }}
        >
          <i className="fas fa-spinner fa-spin" aria-hidden="true" />
          <span>{loadingText || (isHt ? 'Ap chaje videyo a...' : 'Loading video...')}</span>
        </div>
      )}
      <iframe
        src={src}
        title={title || (isHt ? 'Videyo' : 'Video')}
        className={frameClassName}
        allow={allow}
        allowFullScreen={allowFullScreen}
        loading={loading}
        referrerPolicy={referrerPolicy}
        tabIndex={tabIndex}
        onLoad={() => setLoadedSrc(src)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 'none',
        }}
      />
    </div>
  );
}
