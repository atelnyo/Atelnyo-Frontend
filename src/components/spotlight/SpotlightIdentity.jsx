/**
 * SpotlightIdentity.jsx — Full Spotlight Identity page.
 *
 * Displays a user's complete Spotlight identity:
 *   * Trust score with visual badge
 *   * Achievement statistics (badges, courses, reviews)
 *   * Achievement feed (recent achievements)
 *   * Verification status
 *
 * This is the "identity card" for creators on Atelnyo —
 * showing everything they've accomplished on the platform.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import TrustScoreBadge from './TrustScoreBadge';
import AchievementCard from './AchievementCard';
import api from '../../services/api';

const STATS_CONFIG = [
  { key: 'badges_earned', icon: 'fa-medal', color: '#fbbf24', labelHt: 'Badges', labelEn: 'Badges' },
  { key: 'courses_completed', icon: 'fa-graduation-cap', color: '#34d399', labelHt: 'Kou fini', labelEn: 'Courses Done' },
  { key: 'reviews_received', icon: 'fa-star', color: '#f59e0b', labelHt: 'Revizyon', labelEn: 'Reviews' },
  { key: 'total_followers', icon: 'fa-users', color: '#3b82f6', labelHt: 'Swivè', labelEn: 'Followers' },
];

const ACHIEVEMENT_FILTERS = [
  { value: '', labelHt: 'Tout', labelEn: 'All' },
  { value: 'badge_earned', labelHt: 'Badges', labelEn: 'Badges' },
  { value: 'course_completed', labelHt: 'Kou', labelEn: 'Courses' },
  { value: 'review_received', labelHt: 'Revizyon', labelEn: 'Reviews' },
  { value: 'spotlight_approved', labelHt: 'Spotlight', labelEn: 'Spotlight' },
  { value: 'creator_verified', labelHt: 'Verifye', labelEn: 'Verified' },
];

export default function SpotlightIdentity({ lang = 'ht' }) {
  const { username } = useParams();
  const [identity, setIdentity] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');

  const t = useCallback((ht, en) => lang === 'ht' ? ht : en, [lang]);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    setError(null);

    Promise.all([
      api.get(`spotlight/identity/${username}/`),
      api.get('spotlight/achievements/', { params: { user: username, ...(filter ? { type: filter } : {}) } }),
    ])
      .then(([identityRes, achievementsRes]) => {
        setIdentity(identityRes.data);
        setAchievements(achievementsRes.data?.results || achievementsRes.data?.achievements || []);
      })
      .catch(err => {
        console.error('Spotlight identity fetch error:', err);
        setError(t('Erè nan chaje idantite', 'Error loading identity'));
      })
      .finally(() => setLoading(false));
  }, [username, filter, t]);

  if (loading) {
    return (
      <div className="spotlight-identity spotlight-loading">
        <i className="fas fa-spinner fa-spin" />
        <p>{t('Ap chaje...', 'Loading...')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="spotlight-identity spotlight-error">
        <i className="fas fa-exclamation-triangle" />
        <p>{error}</p>
      </div>
    );
  }

  if (!identity) return null;

  const { user, identity: stats, recent_achievements } = identity;

  return (
    <div className="spotlight-identity spotlight-animate-in">
      {/* ─── Header ─── */}
      <div className="spotlight-identity-header">
        {/* Avatar */}
        <div className="spotlight-avatar">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.display_name} />
          ) : (
            <i className="fas fa-user" />
          )}
        </div>

        {/* Info */}
        <div className="spotlight-user-info">
          <div className="spotlight-user-name">
            <h2>{user.display_name || user.username}</h2>
            {stats.is_verified_creator && (
              <span className="spotlight-badge spotlight-badge--verified">
                <i className="fas fa-check-circle" /> {t('Verifye', 'Verified')}
              </span>
            )}
            {stats.spotlight_approved && (
              <span className="spotlight-badge spotlight-badge--spotlight">
                <i className="fas fa-star" /> Spotlight
              </span>
            )}
          </div>
          <p className="spotlight-username">@{user.username}</p>
        </div>

        {/* Trust Score */}
        <TrustScoreBadge score={stats.trust_score} size={80} lang={lang} />
      </div>

      {/* ─── Stats Grid ─── */}
      <div className="spotlight-stats">
        {STATS_CONFIG.map(stat => (
          <div key={stat.key} className="spotlight-stat">
            <i className={`fas ${stat.icon} spotlight-stat-icon`} style={{ color: stat.color }} />
            <div className="spotlight-stat-value">{stats[stat.key] || 0}</div>
            <div className="spotlight-stat-label">
              {lang === 'ht' ? stat.labelHt : stat.labelEn}
            </div>
          </div>
        ))}
      </div>

      {/* ─── Achievement Filter ─── */}
      <div className="spotlight-filters">
        {ACHIEVEMENT_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`spotlight-filter-btn ${filter === f.value ? 'spotlight-filter-btn--active' : ''}`}
          >
            {lang === 'ht' ? f.labelHt : f.labelEn}
          </button>
        ))}
      </div>

      {/* ─── Achievement Feed ─── */}
      <div className="spotlight-feed">
        {(achievements.length > 0 ? achievements : recent_achievements || []).map((a, i) => (
          <AchievementCard
            key={a.id || i}
            achievement={{ ...a, user: user }}
            lang={lang}
          />
        ))}

        {achievements.length === 0 && (!recent_achievements || recent_achievements.length === 0) && (
          <div className="spotlight-empty">
            <i className="fas fa-trophy" />
            <p>{t('Pa gen reyalizasyon ankò', 'No achievements yet')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
