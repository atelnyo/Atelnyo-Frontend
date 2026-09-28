/**
 * src/modules/explore/cards/TalentCard.jsx
 *
 * Talent card with Connect wiring — now with talent-themed SVG fallback.
 */
import React, { useState } from 'react';
import { classNames } from '../utils/cardHelpers';
import SaveCountChip from './SaveCountChip';
import TrendingVelocity from './TrendingVelocity';

/** SVG fallback — talent-themed gradient with star/person icon */
function TalentFallback({ name, isHt }) {
  return (
    <div className="explore-card-fallback">
      <svg viewBox="0 0 600 340" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="tf-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <rect width="600" height="340" fill="url(#tf-grad)" />
        <g transform="translate(300,130)" opacity="0.2">
          {/* Person silhouette */}
          <circle cx="0" cy="-20" r="30" fill="#10b981" />
          <ellipse cx="0" cy="40" rx="45" ry="35" fill="#10b981" />
          {/* Star */}
          <polygon points="0,-80 10,-55 35,-55 15,-38 25,-10 0,-28 -25,-10 -15,-38 -35,-55 -10,-55" fill="#f59e0b" opacity="0.6" />
        </g>
        <text x="300" y="270" textAnchor="middle" fill="#10b981" opacity="0.5"
              fontFamily="system-ui, -apple-system, sans-serif" fontSize="13" fontWeight="600">
          {name || (isHt ? 'Talan' : 'Talent')}
        </text>
      </svg>
    </div>
  );
}

export default function TalentCard({ talent, onOpenSheet, showToast, t, isSaved, onSaveToggle, lang, saveCount = null }) {
  const [imgFailed, setImgFailed] = useState(false);
  // Feed items arrive with ``avatar_url`` (backend canonical field);
  // Explore normalises to ``avatar``. Accept BOTH so the HomeFeed rail
  // doesn't fall back to the SVG avatar for every talent.
  const avatar = talent.avatar || talent.avatar_url || '';
  const hasAvatar = Boolean(avatar);

  function handleClick() {
    if (onOpenSheet) {onOpenSheet(talent);}
  }
  function handleSaveClick(e) {
    e.stopPropagation();
    if (onSaveToggle) {onSaveToggle(talent);}
  }
  return (
    <div
      className={classNames('explore-card explore-card-talent', talent.is_new && 'explore-card-new')}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(e); } }}
      data-testid="talent-card"
      data-talent-id={talent.id}
    >
      <div className="explore-card-image-wrap">
        {hasAvatar && !imgFailed ? (
          <img
            className="explore-talent-avatar"
            src={avatar}
            alt={talent.name}
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <TalentFallback name={talent.name} isHt={lang === 'ht'} />
        )}
        {talent.is_new && <span className="explore-new-pill" style={{ position: 'absolute', top: 8, right: 8 }}>{t.explore_chip_new || 'New'}</span>}
        {/* Trending Velocity — shows how fast this creator is rising */}
        {Number(talent?._score?.trending) > 10 && (
          <TrendingVelocity
            score={talent._score.trending}
            lang={lang}
            size="sm"
          />
        )}
        {talent.is_featured && (
          <span
            className="explore-featured-pill"
            style={{ position: 'absolute', top: 8, left: 8 }}
            title={t.explore_chip_featured || 'Featured'}
          >
            <i className="fas fa-star" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="explore-talent-meta" data-testid="talent-card-meta">
        <div className="explore-card-title">
          {talent.name}
        </div>
        <div className="explore-card-subtitle">{talent.role}</div>
        {talent.skills && talent.skills.length > 0 && (
          <div className="explore-talent-skills">
            {talent.skills.slice(0, 3).map((s) => (
              <span key={s} className="explore-card-tag explore-card-tag-skill">{s}</span>
            ))}
            {talent.skills.length > 3 && (
              <span
                className="explore-card-tag explore-card-tag-overflow"
                title={talent.skills.slice(3).join(', ')}
                aria-label={`${talent.skills.length - 3} plis konpetans: ${talent.skills.slice(3).join(', ')}`}
              >
                +{talent.skills.length - 3}
              </span>
            )}
          </div>
        )}
        {talent.location && (
          <div className="explore-talent-location">
            <i className="fas fa-map-marker-alt" aria-hidden="true" /> {talent.location}
          </div>
        )}
        {talent.linked_username && (
          <div className="explore-talent-linked" title={`@${talent.linked_username}`}>
            <i className="fas fa-user-check" aria-hidden="true" />
            <span>@{talent.linked_username}</span>
          </div>
        )}
      </div>
      <div className="explore-talent-actions">
        <button
          type="button"
          className={classNames('explore-talent-save', isSaved && 'is-saved')}
          onClick={handleSaveClick}
          aria-pressed={Boolean(isSaved)}
          aria-label={isSaved ? (t.mwen_unsave || 'Remove from saved') : (t.mwen_save || 'Save')}
          title={isSaved ? (t.mwen_unsave || 'Remove from saved') : (t.mwen_save || 'Save')}
          data-testid="talent-card-save-btn"
        >
          <i className={isSaved ? 'fas fa-heart' : 'far fa-heart'} aria-hidden="true" />
        </button>
        <SaveCountChip count={saveCount} t={t} />
        <button
          type="button"
          className="explore-talent-cta"
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenSheet) {onOpenSheet(talent);}
          }}
          aria-label={t.explore_sheet_talent_title || 'View talent'}
        >
          <i className="fas fa-arrow-right" aria-hidden="true" />
          <span>{t.explore_sheet_talent_title || (lang === 'ht' ? 'Wè' : 'View')}</span>
        </button>
      </div>
    </div>
  );
}
