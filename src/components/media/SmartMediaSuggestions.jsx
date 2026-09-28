/**
 * SmartMediaSuggestions — Smart suggestions when creating new content.
 *
 * Shows: Recently Used, Most Used, Favorites, Same Collection,
 * Same Category, Same Project, Unused Media, High Quality Media.
 *
 * Creator can click a suggestion to instantly add it to their content
 * without going through the full Media Wizard flow.
 */
import React, { useState } from 'react';
import MediaCard from './MediaCard';

const SUGGESTION_GROUPS = [
  { key: 'recent', icon: 'fa-clock', labelEn: 'Recently Used', labelHt: 'Dènye itilize', maxItems: 6 },
  { key: 'most_used', icon: 'fa-fire', labelEn: 'Most Used', labelHt: 'Pi plis itilize', maxItems: 6 },
  { key: 'favorites', icon: 'fa-star', labelEn: 'Favorites', labelHt: 'Favori', maxItems: 6 },
  { key: 'unused', icon: 'fa-inbox', labelEn: 'Unused Media', labelHt: 'Medya pa itilize', maxItems: 4 },
  { key: 'high_quality', icon: 'fa-crown', labelEn: 'High Quality', labelHt: 'Bon Kalite', maxItems: 4 },
];

export default function SmartMediaSuggestions({
  mediaItems = [],
  onSelect,
  lang = 'ht',
  className = '',
}) {
  const isHt = lang === 'ht';
  const [activeTab, setActiveTab] = useState('recent');
  // If no mediaItems, show empty state
  if (!mediaItems || mediaItems.length === 0) {
    return (
      <div className={`cs-suggestions ${className}`}>
        <div className="cs-suggestions-header">
          <h3 className="cs-suggestions-title">
            <i className="fas fa-lightbulb" />
            {isHt ? 'Sijesyon Medya' : 'Media Suggestions'}
          </h3>
        </div>
        <div className="cs-suggestions-empty">
          <i className="fas fa-lightbulb" />
          <p>{isHt ? 'Pa gen medya pou sijere' : 'No media to suggest'}</p>
        </div>
      </div>
    );
  }

  // Categorize media locally
  const now = Date.now();
  const DAY = 86400000;

  const categorized = {
    recent: mediaItems
      .filter((m) => m.created_at && (now - new Date(m.created_at).getTime()) < 7 * DAY)
      .slice(0, 6),
    most_used: mediaItems
      .filter((m) => m.reference_count > 0)
      .sort((a, b) => (b.reference_count || 0) - (a.reference_count || 0))
      .slice(0, 6),
    favorites: mediaItems
      .filter((m) => m.is_favorite || m.favorite)
      .slice(0, 6),
    unused: mediaItems
      .filter((m) => !m.reference_count || m.reference_count === 0)
      .slice(0, 4),
    high_quality: mediaItems
      .filter((m) => (m.health_score || 0) >= 90)
      .slice(0, 4),
  };

  const currentItems = categorized[activeTab] || [];

  return (
    <div className={`cs-suggestions ${className}`}>
      <div className="cs-suggestions-header">
        <h3 className="cs-suggestions-title">
          <i className="fas fa-lightbulb" />
          {isHt ? 'Sijesyon Medya' : 'Media Suggestions'}
        </h3>
      </div>

      {/* Tabs */}
      <div className="cs-suggestions-tabs">
        {SUGGESTION_GROUPS.map((group) => {
          const count = (categorized[group.key] || []).length;
          if (count === 0) return null;
          return (
            <button
              key={group.key}
              type="button"
              className={`cs-suggestions-tab ${activeTab === group.key ? 'cs-suggestions-tab-active' : ''}`}
              onClick={() => setActiveTab(group.key)}
            >
              <i className={`fas ${group.icon}`} />
              {isHt ? group.labelHt : group.labelEn}
              <span className="cs-suggestions-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Items Grid */}
      {currentItems.length > 0 ? (
        <div className="cs-suggestions-grid">
          {currentItems.map((item, i) => (
            <MediaCard
              key={item.id || item.media_id || i}
              media={item}
              size="small"
              showBadge
              showActions={false}
              onClick={() => onSelect?.(item)}
              lang={lang}
            />
          ))}
        </div>
      ) : (
        <div className="cs-suggestions-empty">
          <i className="fas fa-inbox" />
          <p>{isHt ? 'Pa gen medya nan kategori sa a' : 'No media in this category'}</p>
        </div>
      )}
    </div>
  );
}
