/**
 * src/modules/explore/cards/CommunityCard.jsx
 *
 * Community card component — extracted from Explore.jsx
 */
import React, { useState } from 'react';
import ContentFeedbackMenu from '../../../components/shared/ContentFeedbackMenu';

/** SVG fallback — community-themed gradient */
function CommunityFallback({ name }) {
  return (
    <div className="explore-card-fallback">
      <svg viewBox="0 0 600 340" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="com-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#2d1b69" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <rect width="600" height="340" fill="url(#com-grad)" />
        <g transform="translate(300,140)" opacity="0.2">
          {/* Three people silhouette */}
          <circle cx="-30" cy="-20" r="22" fill="#7c3aed" />
          <ellipse cx="-30" cy="30" rx="30" ry="25" fill="#7c3aed" />
          <circle cx="0" cy="-25" r="22" fill="#7c3aed" opacity="0.8" />
          <ellipse cx="0" cy="30" rx="30" ry="25" fill="#7c3aed" opacity="0.8" />
          <circle cx="30" cy="-20" r="22" fill="#7c3aed" />
          <ellipse cx="30" cy="30" rx="30" ry="25" fill="#7c3aed" />
        </g>
        <text x="300" y="270" textAnchor="middle" fill="#7c3aed" opacity="0.5"
              fontFamily="system-ui, -apple-system, sans-serif" fontSize="14" fontWeight="600">
          {name || 'Community'}
        </text>
      </svg>
    </div>
  );
}

const JOIN_MODE_META = {
  public: { icon: 'fa-lock-open', ht: 'Piblik', en: 'Public' },
  approval: { icon: 'fa-hand-paper', ht: 'Apwobasyon', en: 'Approval' },
  invite: { icon: 'fa-envelope', ht: 'Envite sèlman', en: 'Invite only' },
};

export default function CommunityCard({ community, onOpen, t, lang }) {
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const hasImage = Boolean(community.banner_url || community.avatar_url);
  const isHt = lang === 'ht';
  const joinMeta = JOIN_MODE_META[community.join_mode] || null;
  const joinLabel = joinMeta ? (isHt ? joinMeta.ht : joinMeta.en) : null;
  const tags = Array.isArray(community.tags) ? community.tags.filter(Boolean) : [];
  const eventCount = Number(community.event_count) || 0;
  const founder = community.created_by_username || community.user_key || '';
  const memberStatus = community.my_status
    || (community.is_member ? 'active' : null);
  const memberLabel = memberStatus === 'active'
    ? (t?.explore_community_member || (isHt ? 'Manm' : 'Member'))
    : memberStatus === 'pending'
      ? (t?.explore_community_pending || (isHt ? 'Demann voye' : 'Request sent'))
      : null;

  return (
    <div
      className="explore-card explore-card-community"
      onClick={() => onOpen?.(community)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(community); } }}
    >
      <div className="explore-card-image-wrap">
        {hasImage && !imgFailed ? (
          <img
            className={`explore-card-image ${imgLoaded ? 'explore-card-image--loaded' : ''}`}
            src={community.banner_url || community.avatar_url}
            alt={community.name}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <CommunityFallback name={community.name} />
        )}
        {community.is_featured && (
          <div className="explore-card-badge explore-card-badge-star" aria-label={t.explore_chip_featured || 'Featured'}>
            <i className="fas fa-star" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="explore-card-body">
        <div className="explore-card-title">
          <i className="fas fa-users" aria-hidden="true" style={{ marginRight: 6, opacity: 0.6 }} />
          {community.name}
        </div>
        {community.description && (
          <div className="explore-card-subtitle">
            {community.description}
          </div>
        )}
        {(joinLabel || eventCount > 0 || founder || memberLabel) && (
          <div className="explore-card-community-info" data-testid="community-card-info">
            {joinLabel && (
              <span
                className={`explore-card-tag explore-card-join explore-card-join-${community.join_mode}`}
                title={isHt ? 'Kijan moun antre' : 'How to join'}
              >
                <i className={`fas ${joinMeta.icon}`} aria-hidden="true" /> {joinLabel}
              </span>
            )}
            {eventCount > 0 && (
              <span className="explore-card-tag explore-card-events">
                <i className="fas fa-calendar-alt" aria-hidden="true" /> {eventCount} {t?.explore_community_events || (isHt ? 'evènman' : 'events')}
              </span>
            )}
            {founder && (
              <span
                className="explore-card-founder"
                title={`@${founder}`}
              >
                <i className="fas fa-crown" aria-hidden="true" /> @{founder}
              </span>
            )}
            {memberLabel && (
              <span
                className={`explore-card-tag explore-card-member-status explore-card-member-${memberStatus}`}
              >
                <i className={`fas ${memberStatus === 'active' ? 'fa-check-circle' : 'fa-clock'}`} aria-hidden="true" /> {memberLabel}
              </span>
            )}
          </div>
        )}
        {tags.length > 0 && (
          <div className="explore-card-community-tags">
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} className="explore-card-tag explore-card-tag-skill">{tag}</span>
            ))}
            {tags.length > 3 && (
              <span
                className="explore-card-tag explore-card-tag-overflow"
                title={tags.slice(3).join(', ')}
              >
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}
        <div className="explore-card-meta">
          {community.category && (
            <span className="explore-card-tag">{community.category}</span>
          )}
          <span className="explore-card-plays" style={{ marginLeft: 'auto' }}>
            <i className="fas fa-user" aria-hidden="true" /> {community.member_count || 0} {t.explore_community_members || 'members'}
          </span>
          <ContentFeedbackMenu contentType="community" contentId={community.id} />
          <span className="explore-card-cta" aria-hidden="true">
            <i className="fas fa-arrow-right" />
          </span>
        </div>
      </div>
    </div>
  );
}
