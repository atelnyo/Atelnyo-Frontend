/**
 * DEIECard — Versatile card component for DEIE feed items.
 *
 * Renders different card layouts based on section type:
 * - learning_path: Course-style card with progress
 * - opportunities: Job/opportunity card with budget
 * - creator_discovery: Creator card with avatar + role
 * - community_discovery: Community card with member count
 * - default: Generic content card
 */
import React, { memo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { recordContentView, recordNotInterested } from '../../services/deie';
import { creatorProfileService } from '../../services/api';
import { SHEETS } from '../../routes/sheets';
import { requireLogin } from '../../utils/history';

const DEIECard = memo(function DEIECard({ item, sectionType = 'for_you', lang = 'ht', user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isHt = lang === 'ht';
  const isAuthed = !!user;
  const [dismissed, setDismissed] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  // Initialize from backend so the follow button shows correct state
  // without needing an extra API call on every card.
  const [isFollowing, setIsFollowing] = useState(item.is_following === true);
  const [followLoading, setFollowLoading] = useState(false);

  if (dismissed) return null;

  const contentType = item.content_type || item.type;
  const contentId = item.content_id || item.id;
  const title = item.title || item.name || '';
  const subtitle = item.subtitle || item.role || '';
  const description = item.description || item.bio || '';
  const imageUrl = item.image_url || item.thumbnail_url || item.avatar_url || item.cover_url || '';
  const score = item.total || 0;
  const affinityScore = item.affinity_score;

  const handleClick = () => {
    recordContentView(contentType, contentId, 'feed');
    // Navigate to content detail — use username for creator type
    const url = contentType === 'creator'
      ? (item.username ? `/creator/${item.username}` : null)
      : getContentUrl(contentType, contentId);
    if (url) navigate(url);
  };

  const handleDismiss = (e) => {
    e.stopPropagation();
    setDismissed(true);
    recordNotInterested(contentType, contentId);
  };

  const handleFollow = async (e) => {
    e.stopPropagation();
    if (!isAuthed || !item.username) return;
    setFollowLoading(true);
    try {
      const res = await creatorProfileService.follow(item.username);
      setIsFollowing(res?.data?.is_following || false);
    } catch (err) {
      // Silently fail — follow is non-critical in the feed
    } finally {
      setFollowLoading(false);
    }
  };

  const cardClass = `deie-card deie-card-${sectionType}`;

  return (
    <div className={cardClass} onClick={handleClick} role="button" tabIndex={0}
         onKeyDown={(e) => e.key === 'Enter' && handleClick()}>
      {/* Options menu */}
      <div className="deie-card-options">
        <button className="deie-card-options-btn" onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }}
                aria-label="Options">
          <i className="fas fa-ellipsis-v" />
        </button>
        {showOptions && (
          <div className="deie-card-options-menu">
            <button onClick={handleDismiss}>
              <i className="fas fa-times" /> {isHt ? 'Pa montre' : 'Not interested'}
            </button>
          </div>
        )}
      </div>

      {/* Image */}
      {imageUrl && (
        <div className="deie-card-image">
          <img src={imageUrl} alt={title} loading="lazy" onError={(e) => { e.target.style.display = 'none'; }} />
        </div>
      )}

      {/* Score badge */}
      {score > 0 && (
        <div className="deie-card-score" title={`${isHt ? 'Nòt' : 'Score'}: ${score}`}>
          {Math.round(score)}
        </div>
      )}

      <div className="deie-card-body">
        <h3 className="deie-card-title">{title}</h3>
        {subtitle && <p className="deie-card-subtitle">{subtitle}</p>}
        {description && <p className="deie-card-desc">{description.substring(0, 120)}</p>}

        {/* Section-specific details */}
        {sectionType === 'learning_path' && item.difficulty && (
          <span className={`deie-card-badge deie-badge-${item.difficulty}`}>
            {item.difficulty}
          </span>
        )}

        {sectionType === 'opportunities' && item.budget && (
          <div className="deie-card-meta">
            <span><i className="fas fa-dollar-sign" /> {item.budget}</span>
          </div>
        )}

        {sectionType === 'creator_discovery' && item.skills && (
          <div className="deie-card-tags">
            {(Array.isArray(item.skills) ? item.skills : []).slice(0, 3).map((skill, i) => (
              <span key={i} className="deie-tag">{skill}</span>
            ))}
          </div>
        )}

        {/* Follow button — only for creator_discovery section */}
        {sectionType === 'creator_discovery' && item.username && (
          <div className="deie-card-follow-row">
            {isAuthed ? (
              <button
                type="button"
                className={`deie-follow-btn ${isFollowing ? 'deie-following' : ''}`}
                onClick={handleFollow}
                disabled={followLoading}
              >
                {followLoading ? (
                  <i className="fas fa-spinner fa-pulse" />
                ) : isFollowing ? (
                  <><i className="fas fa-user-check" /> {isHt ? 'Ap swiv' : 'Following'}</>
                ) : (
                  <><i className="fas fa-user-plus" /> {isHt ? 'Swiv' : 'Follow'}</>
                )}
              </button>
            ) : (
              <button type="button" className="deie-follow-btn deie-follow-btn--auth"
                 onClick={(e) => { e.stopPropagation(); requireLogin(navigate, location, SHEETS.LOGIN); }}>
                <i className="fas fa-sign-in-alt" /> {isHt ? 'Konekte pou swiv' : 'Sign in to follow'}
              </button>
            )}
            {item.location && (
              <span className="deie-card-location">
                <i className="fas fa-map-marker-alt" /> {item.location}
              </span>
            )}
          </div>
        )}

        {sectionType === 'community_discovery' && item.member_count && (
          <div className="deie-card-meta">
            <span><i className="fas fa-users" /> {item.member_count}</span>
          </div>
        )}

        {/* Affinity explanation */}
        {affinityScore && (
          <div className="deie-card-affinity">
            <i className="fas fa-heart" style={{ color: '#e91e63' }} />
            {' '}{Math.round(affinityScore)}% {isHt ? 'matche' : 'matched'}
          </div>
        )}

        {/* Score breakdown */}
        {item.components && (
          <div className="deie-card-components">
            {Object.entries(item.components).slice(0, 2).map(([key, val]) => (
              <span key={key} className="deie-component-dot" title={key}>
                {key.replace('_', ' ')}: {val}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default DEIECard;

function getContentUrl(contentType, contentId) {
  const urls = {
    course: `/sheet/course/${contentId}`,
    music: `/sheet/music/${contentId}`,
    talent: `/sheet/talent/${contentId}`,
    community: `/sheet/community/${contentId}`,
    event: `/sheet/event/${contentId}`,
    job: `/job/${contentId}`,
    product: `/marketplace/${contentId}`,
    portfolio: `/portfolio/${contentId}`,
  };
  return urls[contentType] || null;
}
