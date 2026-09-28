/**
 * AchievementCard.jsx — Individual achievement display card.
 *
 * Shows a single achievement with icon, title, description, and timestamp.
 * Used in the AchievementFeed and on user profiles.
 */
import React from 'react';

const ACHIEVEMENT_COLORS = {
  badge_earned: '#fbbf24',
  course_completed: '#34d399',
  certificate: '#8b5cf6',
  review_received: '#f59e0b',
  spotlight_approved: '#a855f7',
  streak: '#ef4444',
  milestone: '#3b82f6',
  creator_verified: '#2563eb',
  first_sale: '#10b981',
  community_joined: '#6366f1',
};

function timeAgo(dateStr, lang = 'ht') {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return lang === 'ht' ? 'kounye a' : 'just now';
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    return lang === 'ht' ? `depi ${m} minit` : `${m}m ago`;
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    return lang === 'ht' ? `depi ${h} èdtan` : `${h}h ago`;
  }
  const d = Math.floor(seconds / 86400);
  if (d < 7) return lang === 'ht' ? `depi ${d} jou` : `${d}d ago`;
  if (d < 30) {
    const w = Math.floor(d / 7);
    return lang === 'ht' ? `depi ${w} semèn` : `${w}w ago`;
  }
  return date.toLocaleDateString(lang === 'ht' ? 'ht-HT' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export default function AchievementCard({ achievement, lang = 'ht' }) {
  const {
    user,
    achievement_type,
    title,
    description,
    icon,
    color,
    is_featured,
    created_at,
    metadata,
  } = achievement;

  const accentColor = color || ACHIEVEMENT_COLORS[achievement_type] || '#fbbf24';

  const cardClass = `achievement-card ${is_featured ? 'achievement-card--featured' : ''}`;

  return (
    <div className={cardClass}>
      {/* Icon */}
      <div
        className="achievement-card-icon"
        style={{ background: `${accentColor}20` }}
      >
        <i
          className={`fas ${icon || 'fa-trophy'}`}
          style={{ color: accentColor }}
        />
      </div>

      {/* Content */}
      <div className="achievement-card-content">
        <div className="achievement-card-header">
          <span className="achievement-card-title">{title}</span>
          {is_featured && (
            <span
              className="achievement-card-featured"
              style={{ color: accentColor, background: `${accentColor}15` }}
            >
              ★
            </span>
          )}
        </div>

        {description && (
          <p className="achievement-card-description">{description}</p>
        )}

        <div className="achievement-card-meta">
          {user && (
            <span className="achievement-card-user">
              @{user.username || user.display_name}
            </span>
          )}
          <span className="achievement-card-time">
            {timeAgo(created_at, lang)}
          </span>
        </div>
      </div>
    </div>
  );
}
