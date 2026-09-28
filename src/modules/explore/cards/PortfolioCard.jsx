/**
 * src/modules/explore/cards/PortfolioCard.jsx
 *
 * Portfolio project card — extracted from Explore.jsx
 */
import React, { useState } from 'react';
import { portfolioService } from '../../../services/api';
import { useHoverVideoPreview } from '../hooks/useHoverVideoPreview';
import HoverVideoPreview from '../components/HoverVideoPreview';
import { resolvePortfolioVideo } from '../utils/cardHelpers';
import SaveCountChip from './SaveCountChip';

/** Inline SVG fallback — bèl ilistrasyon lè pa gen imaj oswa imaj kase */
function PortfolioFallback({ title }) {
  return (
    <div className="explore-card-fallback">
      <svg viewBox="0 0 600 340" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="pof-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <rect width="600" height="340" fill="url(#pof-grad)" />
        <g transform="translate(300,150)" opacity="0.2">
          <circle cx="0" cy="-20" r="25" fill="none" stroke="#8b5cf6" strokeWidth="2" />
          <path d="M-18 5 L0-15 L18 5" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
          <rect x="-8" y="5" width="16" height="18" rx="3" fill="#8b5cf6" />
        </g>
        <text x="300" y="270" textAnchor="middle" fill="#8b5cf6" opacity="0.5"
              fontFamily="system-ui, -apple-system, sans-serif" fontSize="14" fontWeight="600">
          {title || 'Portfolio'}
        </text>
      </svg>
    </div>
  );
}

export default function PortfolioCard({ project, t, showToast, onOpen, saveCount = null }) {
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const hasImage = Boolean(project.cover_url);

  // Demo video — from media_gallery (type: video) or project_url when it
  // is clearly a video link (resolvePortfolioVideo guards against GitHub /
  // live-site links). Muted hover preview via the shared hook + overlay.
  const videoUrl = resolvePortfolioVideo(project);
  const hasVideo = Boolean(videoUrl);
  const { videoSrc, showPreview, bind } = useHoverVideoPreview({ url: videoUrl });

  function handleClick() {
    portfolioService.view(project.id).catch(() => {});
    onOpen?.(project);
  }
  return (
    <div
      className="explore-card explore-card-course"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
      onMouseEnter={bind.onMouseEnter}
      onMouseLeave={bind.onMouseLeave}
    >
      <div className="explore-card-image-wrap">
        {hasImage && !imgFailed ? (
          <img
            className={`explore-card-image ${imgLoaded ? 'explore-card-image--loaded' : ''}`}
            src={project.cover_url}
            alt={project.title}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <PortfolioFallback title={project.title} />
        )}
        {showPreview && (
          <HoverVideoPreview videoSrc={videoSrc} title={project.title} />
        )}
        {hasVideo && (
          <div
            className="explore-card-video-badge"
            aria-label={t.explore_video_title || 'Demo video'}
            title={t.explore_video_title || 'Demo video'}
          >
            <i className="fas fa-video" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="explore-card-body">
        <div className="explore-card-title">
          <i className="fas fa-palette" aria-hidden="true" style={{ marginRight: 6, opacity: 0.6 }} />
          {project.title}
        </div>
        {project.description && (
          <div className="explore-card-subtitle">
            {project.description.slice(0, 90)}{project.description.length > 90 ? '…' : ''}
          </div>
        )}
        <div className="explore-card-meta">
          {project.category && <span className="explore-card-tag">{project.category}</span>}
          {project.difficulty && (
            <span className="explore-card-tag explore-card-tag-skill">{project.difficulty}</span>
          )}
          <SaveCountChip count={saveCount} t={t} />
          <span className="explore-card-cta" aria-hidden="true">
            <i className="fas fa-arrow-right" />
          </span>
        </div>
      </div>
    </div>
  );
}
