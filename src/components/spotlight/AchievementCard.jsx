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

const LOCALES = { ht: 'fr-HT', fr: 'fr-FR', es: 'es-ES', en: 'en-US' };

const TIME_COPY = {
  ht: { now: 'kounye a', minutes: (n) => `depi ${n} minit`, hours: (n) => `depi ${n} èdtan`, days: (n) => `depi ${n} jou`, weeks: (n) => `depi ${n} semèn`, featured: 'Reyalizasyon vedèt' },
  en: { now: 'just now', minutes: (n) => `${n}m ago`, hours: (n) => `${n}h ago`, days: (n) => `${n}d ago`, weeks: (n) => `${n}w ago`, featured: 'Featured achievement' },
  fr: { now: 'à l’instant', minutes: (n) => `il y a ${n} min`, hours: (n) => `il y a ${n} h`, days: (n) => `il y a ${n} j`, weeks: (n) => `il y a ${n} sem.`, featured: 'Réalisation mise en avant' },
  es: { now: 'ahora mismo', minutes: (n) => `hace ${n} min`, hours: (n) => `hace ${n} h`, days: (n) => `hace ${n} d`, weeks: (n) => `hace ${n} sem.`, featured: 'Logro destacado' },
};

function timeAgo(dateStr, lang = 'en') {
  if (!dateStr) return '';
  const copy = TIME_COPY[lang] || TIME_COPY.en;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return copy.now;
  if (seconds < 3600) return copy.minutes(Math.floor(seconds / 60));
  if (seconds < 86400) return copy.hours(Math.floor(seconds / 3600));
  const days = Math.floor(seconds / 86400);
  if (days < 7) return copy.days(days);
  if (days < 30) return copy.weeks(Math.floor(days / 7));
  return date.toLocaleDateString(LOCALES[lang] || LOCALES.en, {
    month: 'short',
    day: 'numeric',
  });
}

export default function AchievementCard({ achievement, lang = 'en' }) {
  const {
    user,
    achievement_type,
    title,
    description,
    icon,
    color,
    is_featured,
    created_at,
  } = achievement;

  const copy = TIME_COPY[lang] || TIME_COPY.en;
  const stamp = created_at ? timeAgo(created_at, lang) : '';
  const accentColor = color || ACHIEVEMENT_COLORS[achievement_type] || '#fbbf24';
  const cardClass = `achievement-card ${is_featured ? 'achievement-card--featured' : ''}`;

  return (
    <div className={cardClass}>
      <div
        className="achievement-card-icon"
        style={{ background: `${accentColor}20` }}
        aria-hidden="true"
      >
        <i
          className={`fas ${icon || 'fa-trophy'}`}
          style={{ color: accentColor }}
        />
      </div>

      <div className="achievement-card-content">
        <div className="achievement-card-header">
          <span className="achievement-card-title">{title}</span>
          {is_featured && (
            <span
              className="achievement-card-featured"
              style={{ color: accentColor, background: `${accentColor}15` }}
              title={copy.featured}
              aria-label={copy.featured}
              role="img"
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
          {stamp && (
            <time className="achievement-card-time" dateTime={created_at}>
              {stamp}
            </time>
          )}
        </div>
      </div>
    </div>
  );
}
