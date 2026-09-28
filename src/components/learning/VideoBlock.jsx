/**
 * src/components/learning/VideoBlock.jsx
 *
 * §20 — Video Block Experience (Phase 10 — Accessibility)
 *
 * Provider-agnostic video rendering with:
 *   - Accessible title (iframe title attribute)
 *   - Keyboard-accessible controls (native video controls)
 *   - Captions support (track element)
 *   - Transcript link support
 *   - Loading state with aria-live announcement
 *   - Error state with role="alert"
 *   - No forced autoplay with sound
 *   - Responsive aspect ratio
 *   - Fullscreen where supported
 *
 * Phase 10 accessibility:
 *   - iframe gets meaningful title
 *   - video gets accessible label
 *   - captions/transcript metadata support
 *   - loading announced to screen readers
 */
import React, { useState, useCallback } from 'react';
import { resolveVideoSource } from '../../modules/explore/utils/videoSource';
import styles from './learning.module.css';

export default function VideoBlock({ block, lang = 'ht', reportComplete }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);
  const [watchDone, setWatchDone] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const v = resolveVideoSource(block.videoUrl);
  if (!v) {
    return (
      <div className="ls-block-media-empty" role="status" style={{
        padding: '24px 16px', textAlign: 'center', color: 'var(--text-secondary)',
      }}>
        <i className="fas fa-video" style={{ fontSize: '1.5rem', opacity: 0.3, marginBottom: 8, display: 'block' }} aria-hidden="true" />
        <span style={{ fontSize: '0.85rem' }}>{t('The video link could not be loaded.', 'Pa t kapab chaje videyo a.')}</span>
      </div>
    );
  }

  const handleVideoError = useCallback(() => {
    setLoadError(true);
  }, []);

  if (loadError) {
    return (
      <div className="ls-block-media-empty" role="alert" style={{
        padding: '24px 16px', textAlign: 'center', color: 'var(--text-secondary)',
      }}>
        <i className="fas fa-triangle-exclamation" style={{ fontSize: '1.5rem', opacity: 0.3, marginBottom: 8, display: 'block' }} aria-hidden="true" />
        <span style={{ fontSize: '0.85rem' }}>{t('This video could not be loaded.', 'Videyo sa a pa t kapab chaje.')}</span>
      </div>
    );
  }

  // Phase 10: meaningful video title for accessibility
  const videoTitle = block.title || block.config?.title || t('Video lesson', 'Leson videyo');
  const captionUrl = block.captions || block.config?.captions || '';
  const transcriptUrl = block.transcript || block.config?.transcript || '';

  return (
    <div className={styles.practiceContent}>
      {/* Accessible loading announcement */}
      {!isLoaded && !loadError && (
        <div role="status" aria-live="polite" className="sr-only">
          {t('Loading video...', 'Ap chaje videyo...')}
        </div>
      )}

      {/* Aspect-ratio container */}
      <div className="ls-block-video-wrapper" style={{
        position: 'relative', width: '100%',
        aspectRatio: block.aspectRatio || '16 / 9',
        borderRadius: 10, overflow: 'hidden',
        background: 'var(--surface-card-alt, #f1f5f9)',
      }}>
        {v.kind === 'embed' ? (
          <iframe
            src={v.src}
            // Phase 10: meaningful title for screen readers
            title={videoTitle}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            onError={handleVideoError}
            onLoad={() => setIsLoaded(true)}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: '100%', height: '100%', border: 'none',
            }}
          />
        ) : (
          <video
            src={v.src}
            controls
            playsInline
            poster={block.posterUrl || undefined}
            onError={handleVideoError}
            onLoadedData={() => setIsLoaded(true)}
            // Phase 10: accessible label for the video player
            aria-label={videoTitle}
            style={{
              width: '100%', height: '100%', objectFit: 'contain',
            }}
          >
            {/* Phase 10: captions track if available */}
            {captionUrl && (
              <track
                kind="captions"
                src={captionUrl}
                srcLang={lang === 'ht' ? 'ht' : lang}
                label={isHt ? 'Sous-tit' : lang === 'fr' ? 'Sous-titres' : lang === 'es' ? 'Subtítulos' : 'Captions'}
                default
              />
            )}
          </video>
        )}
      </div>

      {/* Phase 10: transcript link */}
      {transcriptUrl && (
        <div style={{ marginTop: 8 }}>
          <a
            href={transcriptUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '0.82rem',
              color: 'var(--color-primary, #d81b60)',
              textDecoration: 'none',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <i className="fas fa-file-lines" aria-hidden="true" />
            {t('Read transcript', 'Li traskripsyon an')}
          </a>
        </div>
      )}

      <button
        type="button"
        className={`${styles.practiceBtn} ${watchDone ? styles.practiceBtnDone : ''}`}
        onClick={() => {
          setWatchDone(true);
          reportComplete();
        }}
        aria-pressed={watchDone}
      >
        <i className="fas fa-check" aria-hidden="true" />
        {watchDone ? t('Watched', 'Gade') : t('I finished watching', 'M fin gade')}
      </button>
    </div>
  );
}
