/**
 * src/modules/explore/cards/CourseCard.jsx
 *
 * Course card component — extracted from Explore.jsx
 */
import React, { useState } from 'react';
import { useHoverVideoPreview } from '../hooks/useHoverVideoPreview';
import HoverVideoPreview from '../components/HoverVideoPreview';
import SaveCountChip from './SaveCountChip';
import TrendingVelocity from './TrendingVelocity';

/** Inline SVG fallback — bèl ilistrasyon rose lè pa gen imaj oswa imaj kase */
function CourseFallback({ title, isHt }) {
  return (
    <div className="explore-card-fallback">
      <svg viewBox="0 0 600 340" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="cf-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d81b60" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <rect width="600" height="340" fill="url(#cf-grad)" />
        <g transform="translate(300,140)" opacity="0.25">
          <path d="M0-50 L-35 15 L35 15 Z" fill="#d81b60" />
          <rect x="-55" y="15" width="110" height="18" rx="9" fill="#d81b60" />
          <rect x="-30" y="44" width="60" height="32" rx="4" fill="#d81b60" opacity="0.7" />
          <circle cx="-50" cy="-55" r="5" fill="#d81b60" opacity="0.5" />
          <circle cx="50" cy="-55" r="5" fill="#d81b60" opacity="0.5" />
        </g>
        <text x="300" y="270" textAnchor="middle" fill="#d81b60" opacity="0.55"
              fontFamily="system-ui, -apple-system, sans-serif" fontSize="14" fontWeight="600">
          {title || (isHt ? 'San tit' : 'Untitled')}
        </text>
      </svg>
    </div>
  );
}

export default function CourseCard({ course, onOpen, lang, t, saveCount = null, user }) {
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const isHt = lang === 'ht';

  // ─── Premium pricing (mirrors backend PREMIUM_CREATOR_DISCOUNT_PCT) ──
  const isPremium = !!(user?.premium?.is_premium);
  const PREMIUM_DISCOUNT_PCT = 25;
  const premiumPrice = (() => {
    if (!isPremium || course.price == null) return null;
    const price = Number(course.price);
    if (price === 0) return null;
    if (course.owner_type === 'official') return 0;
    return Math.round(price * (100 - PREMIUM_DISCOUNT_PCT)) / 100;
  })();
  // Support both ``image_url`` (direct /api/courses/) and
  // ``thumbnail_url`` (HomeFeed pipeline normalises all image
  // fields to ``thumbnail_url`` — the backend also preserves
  // the original field name, but this fallback handles any
  // future pipeline change defensively).
  const imgSrc = course.image_url || course.thumbnail_url || '';
  const hasImage = Boolean(imgSrc);

  // Promo video — muted hover preview over the cover (shared hook +
  // overlay, same gates as the music cards). Accept ``video_url``
  // (serializer/feed canonical) or ``video`` defensively.
  const video = course.video_url || course.video || '';
  const hasVideo = Boolean(video);
  const { videoSrc, showPreview, bind } = useHoverVideoPreview({ url: video });

  return (
    <div
      className="explore-card explore-card-course"
      onClick={() => onOpen?.(course)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(course); } }}
      onMouseEnter={bind.onMouseEnter}
      onMouseLeave={bind.onMouseLeave}
    >
      <div className="explore-card-image-wrap">
        {hasImage && !imgFailed ? (
          <img
            className={`explore-card-image ${imgLoaded ? 'explore-card-image--loaded' : ''}`}
            src={imgSrc}
            alt={course.title}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <CourseFallback title={course.title} isHt={isHt} />
        )}
        {showPreview && (
          <HoverVideoPreview videoSrc={videoSrc} title={course.title} />
        )}
        {hasVideo && (
          <div
            className="explore-card-video-badge"
            aria-label={t.explore_video_title || 'Promo video'}
            title={t.explore_video_title || 'Promo video'}
          >
            <i className="fas fa-video" aria-hidden="true" />
          </div>
        )}
        {/* External course — learning happens outside atelnyo. Always
            labeled on cards so the delivery model is never a surprise. */}
        {course.delivery_type === 'external' && (
          <div
            className="explore-card-badge explore-card-badge-external"
            title={isHt ? 'Kou ekstèn — aprann yon lòt kote' : 'External — learn elsewhere'}
            aria-label={isHt ? 'Kou ekstèn' : 'External course'}
          >
            <i className="fas fa-globe" aria-hidden="true" />
          </div>
        )}
        {course.is_featured && (
          <div
            className="explore-card-badge explore-card-badge-star"
            title={t.explore_chip_featured || 'Featured'}
            aria-label={t.explore_chip_featured || 'Featured'}
          >
            <i className="fas fa-star" aria-hidden="true" />
          </div>
        )}
        {/* FREE badge — the card says so without opening the course */}
        {Number(course.price) === 0 && (
          <div className="explore-card-badge explore-card-badge-free"
            title={isHt ? 'Gratis' : 'Free'}
            aria-label={isHt ? 'Gratis' : 'Free'}>
            <i className="fas fa-gift" aria-hidden="true" />
            <span>{isHt ? 'GRATIS' : 'FREE'}</span>
          </div>
        )}
        {/* Atelnyo Official — admin-created courses carry the trust badge */}
        {course.owner_type === 'official' && (
          <div className="explore-card-badge explore-card-badge-official"
            title={isHt ? 'Atelnyo Ofisyèl' : 'Atelnyo Official'}
            aria-label={isHt ? 'Atelnyo Ofisyèl' : 'Atelnyo Official'}>
            <i className="fas fa-building-columns" aria-hidden="true" />
            <span>{isHt ? 'OFISYÈL' : 'OFFICIAL'}</span>
          </div>
        )}
        {/* Trending Velocity — shows how fast this course is rising */}
        {Number(course?._score?.trending) > 10 && (
          <TrendingVelocity
            score={course._score.trending}
            lang={lang}
            size="sm"
          />
        )}
        {/* Popilarite — popularity score from the recommendation engine */}
        {Number(course?._score?.popularity) > 0 && (
          <div
            className="explore-card-badge explore-card-popularity"
            title={`${t.feed_popularity || 'Popularity'}: ${Math.round(Number(course._score.popularity))}`}
          >
            <i className="fas fa-fire" aria-hidden="true" />
            <span>{Math.round(Number(course._score.popularity))}</span>
          </div>
        )}
      </div>
      <div className="explore-card-body">
        <div className="explore-card-title">{course.title}</div>
        {course.description && (
          <div className="explore-card-subtitle">
            {course.description}
          </div>
        )}
        <div className="explore-card-meta">
          {course.price != null && (
            <span className="explore-card-price">
              <span className="explore-card-price-label">{t.explore_price_label || 'Price'}</span>
              {Number(course.price) === 0 ? (
                <span className="explore-card-price-value explore-card-price-value--free">
                  {isHt ? 'Gratis' : 'Free'}
                </span>
              ) : premiumPrice !== null ? (
                <span className="explore-card-price-value">
                  <span style={{ textDecoration: 'line-through', opacity: 0.5, marginRight: 4, fontSize: '0.85em' }}>${Number(course.price).toFixed(2)}</span>
                  {premiumPrice === 0 ? (isHt ? 'Gratis' : 'Free') : `$${premiumPrice.toFixed(2)}`}
                  <span style={{ marginLeft: 4, fontSize: '0.6em', color: 'var(--pr-color-orange-500, #f97316)', fontWeight: 600 }}>
                    <i className="fas fa-crown" style={{ marginRight: 1 }} />Premium
                  </span>
                </span>
              ) : (
                <span className="explore-card-price-value">${Number(course.price).toFixed(2)}</span>
              )}
            </span>
          )}
          <SaveCountChip count={saveCount} t={t} />
          <span className="explore-card-cta" aria-hidden="true">
            <i className="fas fa-arrow-right" />
          </span>
        </div>
        {/* Language direction — e.g. Kreyòl → English (distinct from the reverse) */}
        {(course.teaching_language || course.learner_language) && (
          <div className="explore-card-language">
            <i className="fas fa-language" aria-hidden="true" />
            <span>
              {course.learner_language || '?'} → {course.teaching_language || '?'}
            </span>
            {course.difficulty && (
              <span className="explore-card-level">
                {course.difficulty === 'beginner' ? (isHt ? 'Debitan' : 'Beginner')
                  : course.difficulty === 'intermediate' ? (isHt ? 'Mwayen' : 'Intermediate')
                    : (isHt ? 'Avanse' : 'Advanced')}
              </span>
            )}
          </div>
        )}
        {course.creator_name && (
          <div className="explore-card-creator">
            <i className="fas fa-user" aria-hidden="true" />
            <span>{course.creator_name}</span>
          </div>
        )}
      </div>
    </div>
  );
}
