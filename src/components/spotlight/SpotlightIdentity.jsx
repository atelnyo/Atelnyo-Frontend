/**
 * SpotlightIdentity.jsx — Full Spotlight Identity page.
 *
 * Displays a user's complete Spotlight identity:
 *   * Trust score with visual badge
 *   * Achievement statistics (badges, courses, reviews)
 *   * Achievement feed (recent achievements)
 *   * Verification status
 *
 * The identity summary and the achievement feed load independently:
 * changing a feed filter never re-fetches the identity header, and a
 * filter that matches nothing shows an explicit empty state instead of
 * silently falling back to the unfiltered recent list.
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import TrustScoreBadge from './TrustScoreBadge';
import AchievementCard from './AchievementCard';
import api from '../../services/api';

const COPY = {
  ht: {
    loading: 'Ap chaje idantite Spotlight la…',
    error: 'Nou pa t kapab chaje idantite a.',
    retry: 'Eseye ankò',
    missingUser: 'Pa gen itilizatè pou paj sa a.',
    empty: 'Pa gen reyalizasyon ankò',
    emptyFiltered: 'Pa gen reyalizasyon nan kategori sa a.',
    achievements: 'Reyalizasyon',
    filtersLabel: 'Filtre reyalizasyon yo',
    verified: 'Verifye',
    spotlight: 'Spotlight',
    badges: 'Badges',
    courses: 'Kou fini',
    reviews: 'Revizyon',
    followers: 'Swivè',
    all: 'Tout',
    filterBadges: 'Badges',
    filterCourses: 'Kou',
    filterReviews: 'Revizyon',
    filterSpotlight: 'Spotlight',
    filterVerified: 'Verifye',
    achievementsError: 'Nou pa t kapab chaje reyalizasyon yo.',
  },
  en: {
    loading: 'Loading Spotlight identity…',
    error: 'Could not load this identity.',
    retry: 'Try again',
    missingUser: 'No user for this page.',
    empty: 'No achievements yet',
    emptyFiltered: 'No achievements in this category.',
    achievements: 'Achievements',
    filtersLabel: 'Achievement filters',
    verified: 'Verified',
    spotlight: 'Spotlight',
    badges: 'Badges',
    courses: 'Courses Done',
    reviews: 'Reviews',
    followers: 'Followers',
    all: 'All',
    filterBadges: 'Badges',
    filterCourses: 'Courses',
    filterReviews: 'Reviews',
    filterSpotlight: 'Spotlight',
    filterVerified: 'Verified',
    achievementsError: 'Could not load achievements.',
  },
  fr: {
    loading: 'Chargement de l’identité Spotlight…',
    error: 'Impossible de charger cette identité.',
    retry: 'Réessayer',
    missingUser: 'Aucun utilisateur pour cette page.',
    empty: 'Aucune réalisation pour le moment',
    emptyFiltered: 'Aucune réalisation dans cette catégorie.',
    achievements: 'Réalisations',
    filtersLabel: 'Filtres des réalisations',
    verified: 'Vérifié',
    spotlight: 'Spotlight',
    badges: 'Badges',
    courses: 'Cours terminés',
    reviews: 'Avis',
    followers: 'Abonnés',
    all: 'Tout',
    filterBadges: 'Badges',
    filterCourses: 'Cours',
    filterReviews: 'Avis',
    filterSpotlight: 'Spotlight',
    filterVerified: 'Vérifié',
    achievementsError: 'Impossible de charger les réalisations.',
  },
  es: {
    loading: 'Cargando la identidad Spotlight…',
    error: 'No se pudo cargar esta identidad.',
    retry: 'Intentar de nuevo',
    missingUser: 'No hay usuario para esta página.',
    empty: 'Aún no hay logros',
    emptyFiltered: 'No hay logros en esta categoría.',
    achievements: 'Logros',
    filtersLabel: 'Filtros de logros',
    verified: 'Verificado',
    spotlight: 'Spotlight',
    badges: 'Insignias',
    courses: 'Cursos completados',
    reviews: 'Reseñas',
    followers: 'Seguidores',
    all: 'Todo',
    filterBadges: 'Insignias',
    filterCourses: 'Cursos',
    filterReviews: 'Reseñas',
    filterSpotlight: 'Spotlight',
    filterVerified: 'Verificado',
    achievementsError: 'No se pudieron cargar los logros.',
  },
};

const STATS_CONFIG = [
  { key: 'badges_earned', icon: 'fa-medal', color: '#fbbf24', label: 'badges' },
  { key: 'courses_completed', icon: 'fa-graduation-cap', color: '#34d399', label: 'courses' },
  { key: 'reviews_received', icon: 'fa-star', color: '#f59e0b', label: 'reviews' },
  { key: 'total_followers', icon: 'fa-users', color: '#3b82f6', label: 'followers' },
];

const ACHIEVEMENT_FILTERS = [
  { value: '', label: 'all' },
  { value: 'badge_earned', label: 'filterBadges' },
  { value: 'course_completed', label: 'filterCourses' },
  { value: 'review_received', label: 'filterReviews' },
  { value: 'spotlight_approved', label: 'filterSpotlight' },
  { value: 'creator_verified', label: 'filterVerified' },
];

function IdentitySkeleton({ label }) {
  return (
    <div
      className="spotlight-identity spotlight-skeleton"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="spotlight-identity-header si-skel-header" aria-hidden="true">
        <div className="si-skel-avatar" />
        <div className="si-skel-lines">
          <span className="si-skel-line si-skel-line--title" />
          <span className="si-skel-line si-skel-line--sub" />
        </div>
      </div>
      <div className="spotlight-stats" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="spotlight-stat si-skel-stat">
            <span className="si-skel-line si-skel-line--icon" />
            <span className="si-skel-line si-skel-line--number" />
            <span className="si-skel-line si-skel-line--sub" />
          </div>
        ))}
      </div>
      <div className="spotlight-feed" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="achievement-card si-skel-achievement">
            <span className="si-skel-line si-skel-line--icon" />
            <div className="si-skel-lines">
              <span className="si-skel-line si-skel-line--title" />
              <span className="si-skel-line si-skel-line--sub" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SpotlightIdentity({ lang = 'en' }) {
  const { username } = useParams();
  const copy = COPY[lang] || COPY.en;

  const [identity, setIdentity] = useState(null);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [identityError, setIdentityError] = useState(null);
  const [retryTick, setRetryTick] = useState(0);

  const [achievements, setAchievements] = useState([]);
  const [achievementsLoading, setAchievementsLoading] = useState(true);
  const [achievementsError, setAchievementsError] = useState(false);
  const [achievementsRetryTick, setAchievementsRetryTick] = useState(0);
  const [filter, setFilter] = useState('');

  // Identity summary — independent of the feed filter.
  useEffect(() => {
    if (!username) {
      setIdentityLoading(false);
      setIdentityError(copy.missingUser);
      return undefined;
    }
    let cancelled = false;
    setIdentityLoading(true);
    setIdentityError(null);
    api.get(`spotlight/achievements/identity/${encodeURIComponent(username)}/`)
      .then((res) => {
        if (!cancelled) setIdentity(res?.data || null);
      })
      .catch(() => {
        if (!cancelled) setIdentityError(copy.error);
      })
      .finally(() => {
        if (!cancelled) setIdentityLoading(false);
      });
    return () => { cancelled = true; };
  }, [username, retryTick, copy.error, copy.missingUser]);

  // Achievement feed — re-fetches on filter change only.
  useEffect(() => {
    if (!username) {
      setAchievementsLoading(false);
      return undefined;
    }
    let cancelled = false;
    setAchievementsLoading(true);
    setAchievementsError(false);
    api.get('spotlight/achievements/', {
      params: { user: username, ...(filter ? { type: filter } : {}) },
    })
      .then((res) => {
        if (cancelled) return;
        const data = res?.data;
        const rows = Array.isArray(data) ? data : (data?.results || data?.achievements || []);
        setAchievements(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (cancelled) return;
        setAchievements([]);
        setAchievementsError(true);
      })
      .finally(() => {
        if (!cancelled) setAchievementsLoading(false);
      });
    return () => { cancelled = true; };
  }, [username, filter, achievementsRetryTick]);

  if (identityLoading) {
    return <IdentitySkeleton label={copy.loading} />;
  }

  if (identityError) {
    return (
      <div className="spotlight-identity">
        <div className="spotlight-error" role="alert">
          <i className="fas fa-triangle-exclamation" aria-hidden="true" />
          <p>{identityError}</p>
          <button
            type="button"
            className="spotlight-retry-btn"
            onClick={() => setRetryTick((n) => n + 1)}
          >
            <i className="fas fa-rotate-right" aria-hidden="true" /> {copy.retry}
          </button>
        </div>
      </div>
    );
  }

  if (!identity) return null;

  const user = identity.user || {};
  const stats = identity.identity || {};
  const recent = Array.isArray(identity.recent_achievements) ? identity.recent_achievements : [];
  const feed = filter ? achievements : (achievements.length > 0 ? achievements : recent);

  return (
    <div className="spotlight-identity spotlight-animate-in">
      {/* ─── Header ─── */}
      <div className="spotlight-identity-header">
        <div className="spotlight-avatar">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.display_name || user.username || ''} />
          ) : (
            <i className="fas fa-user" aria-hidden="true" />
          )}
        </div>

        <div className="spotlight-user-info">
          <div className="spotlight-user-name">
            <h2>{user.display_name || user.username}</h2>
            {stats.is_verified_creator && (
              <span className="spotlight-badge spotlight-badge--verified">
                <i className="fas fa-check-circle" aria-hidden="true" /> {copy.verified}
              </span>
            )}
            {stats.spotlight_approved && (
              <span className="spotlight-badge spotlight-badge--spotlight">
                <i className="fas fa-star" aria-hidden="true" /> {copy.spotlight}
              </span>
            )}
          </div>
          {user.username && <p className="spotlight-username">@{user.username}</p>}
        </div>

        <TrustScoreBadge score={Number(stats.trust_score) || 0} size={80} lang={lang} />
      </div>

      {/* ─── Stats Grid ─── */}
      <div className="spotlight-stats">
        {STATS_CONFIG.map((stat) => (
          <div key={stat.key} className="spotlight-stat">
            <i
              className={`fas ${stat.icon} spotlight-stat-icon`}
              style={{ color: stat.color }}
              aria-hidden="true"
            />
            <div className="spotlight-stat-value">{stats[stat.key] || 0}</div>
            <div className="spotlight-stat-label">{copy[stat.label]}</div>
          </div>
        ))}
      </div>

      {/* ─── Achievement filters ─── */}
      <div className="spotlight-filters" role="group" aria-label={copy.filtersLabel}>
        {ACHIEVEMENT_FILTERS.map((f) => (
          <button
            key={f.value || 'all'}
            type="button"
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
            className={`spotlight-filter-btn ${filter === f.value ? 'spotlight-filter-btn--active' : ''}`}
          >
            {copy[f.label]}
          </button>
        ))}
      </div>

      {/* ─── Achievement feed ─── */}
      <div className="spotlight-feed-heading">
        <h3>{copy.achievements}</h3>
        <span>{stats.total_achievements || 0}</span>
      </div>

      <div
        className="spotlight-feed"
        aria-live="polite"
        aria-busy={achievementsLoading ? 'true' : undefined}
      >
        {achievementsLoading ? (
          <div className="spotlight-feed-loading" role="status" aria-label={copy.loading}>
            <i className="fas fa-spinner fa-spin" aria-hidden="true" />
          </div>
        ) : achievementsError ? (
          <div className="spotlight-error spotlight-error--inline" role="alert">
            <i className="fas fa-triangle-exclamation" aria-hidden="true" />
            <p>{copy.achievementsError}</p>
            <button
              type="button"
              className="spotlight-retry-btn"
              onClick={() => setAchievementsRetryTick((n) => n + 1)}
            >
              <i className="fas fa-rotate-right" aria-hidden="true" /> {copy.retry}
            </button>
          </div>
        ) : feed.length > 0 ? (
          feed.map((a, i) => (
            <AchievementCard
              key={a.id || i}
              achievement={{ ...a, user }}
              lang={lang}
            />
          ))
        ) : (
          <div className="spotlight-empty">
            <i className="fas fa-trophy" aria-hidden="true" />
            <p>{filter ? copy.emptyFiltered : copy.empty}</p>
          </div>
        )}
      </div>
    </div>
  );
}
