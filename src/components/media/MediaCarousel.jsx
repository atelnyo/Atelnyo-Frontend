/**
 * MediaCarousel — Karousèl medya ak flèch navigasyon + dot endikatè.
 *
 * Karakteristik:
 *   - Responsive (ajiste selon kontène)
 *   - Navigasyon: flèch bò gòch/dwat, dot anba a
 *   - Touch support (glis)
 *   - Infinite loop
 *   - Otomatik (opsyonèl)
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import MediaCard from './MediaCard';

export default function MediaCarousel({
  items = [],
  autoPlay = false,
  autoPlayInterval = 4000,
  showArrows = true,
  showDots = true,
  size = 'medium',
  onClick,
  lang = 'ht',
  className = '',
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchDelta, setTouchDelta] = useState(0);
  const touchStartRef = useRef(null);
  const touchDeltaRef = useRef(0);  // synced with state for closure safety
  const autoplayRef = useRef(null);
  const containerRef = useRef(null);

  const total = items.length;

  const goTo = useCallback((index) => {
    setCurrentIndex(((index % total) + total) % total);
  }, [total]);

  const goNext = useCallback(() => goTo(currentIndex + 1), [goTo, currentIndex]);
  const goPrev = useCallback(() => goTo(currentIndex - 1), [goTo, currentIndex]);

  // ─── Autoplay ───────────────────────────────────────────────────
  useEffect(() => {
    if (!autoPlay || total <= 1) return;
    autoplayRef.current = setInterval(goNext, autoPlayInterval);
    return () => clearInterval(autoplayRef.current);
  }, [autoPlay, goNext, autoPlayInterval, total]);

  // ─── Touch handlers ────────────────────────────────────────────
  const handleTouchStart = (e) => {
    touchStartRef.current = e.touches[0].clientX;
    touchDeltaRef.current = 0;
    setTouchDelta(0);
    if (autoplayRef.current) clearInterval(autoplayRef.current);
  };

  const handleTouchMove = (e) => {
    if (touchStartRef.current === null) return;
    const delta = e.touches[0].clientX - touchStartRef.current;
    touchDeltaRef.current = delta;
    setTouchDelta(delta);
  };

  const handleTouchEnd = () => {
    if (Math.abs(touchDeltaRef.current) > 50) {
      if (touchDeltaRef.current > 0) goPrev();
      else goNext();
    }
    touchStartRef.current = null;
    touchDeltaRef.current = 0;
    setTouchDelta(0);
  };

  if (!items || items.length === 0) {
    return null;
  }

  const isHt = lang === 'ht';

  return (
    <div
      className={`media-carousel ${className}`}
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role="region"
      aria-label={isHt ? 'Karousèl medya' : 'Media carousel'}
      aria-roledescription="carousel"
    >
      {/* ─── Track ─────────────────────────────────────────────── */}
      <div
        className="media-carousel-track"
        style={{
          transform: `translateX(calc(-${currentIndex * 100}% + ${touchDelta}px))`,
          transition: touchDelta ? 'none' : 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {items.map((item, index) => (
          <div
            key={item.id || item.media_id || index}
            className="media-carousel-slide"
            role="group"
            aria-roledescription="slide"
            aria-label={`${isHt ? 'Diapozitif' : 'Slide'} ${index +1} ${isHt ? 'sou' : 'of'} ${total}`}
            aria-hidden={index !== currentIndex}
          >
            <MediaCard
              media={item}
              size={size}
              showBadge
              showActions={false}
              onClick={onClick ? () => onClick(item) : undefined}
              lang={lang}
            />
          </div>
        ))}
      </div>

      {/* ─── Arrows ────────────────────────────────────────────── */}
      {showArrows && total > 1 && (
        <>
          <button
            type="button"
            className="media-carousel-arrow media-carousel-arrow-prev"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            aria-label={isHt ? 'Anvan' : 'Previous'}
          >
            <i className="fas fa-chevron-left" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="media-carousel-arrow media-carousel-arrow-next"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            aria-label={isHt ? 'Apre' : 'Next'}
          >
            <i className="fas fa-chevron-right" aria-hidden="true" />
          </button>
        </>
      )}

      {/* ─── Dots ──────────────────────────────────────────────── */}
      {showDots && total > 1 && (
        <div className="media-carousel-dots" role="tablist">
          {items.map((_, index) => (
            <button
              key={index}
              type="button"
              className={`media-carousel-dot ${index === currentIndex ? 'media-carousel-dot-active' : ''}`}
              onClick={() => goTo(index)}
              role="tab"
              aria-selected={index === currentIndex}
              aria-label={`${isHt ? 'Diapozitif' : 'Slide'} ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
