/**
 * DEIEFeed — Intelligent Home Feed component.
 *
 * Displays 7 personalized sections powered by the DEIE scoring engine.
 *
 * Sections:
 *   1. Following    — Content from followed creators
 *   2. For You       — Algorithm-ranked content
 *   3. Trending      — Popular content adapted to interests
 *   4. Learning Path — Courses matching skill gaps
 *   5. Opportunities — Jobs matched to career DNA
 *   6. Creator Discovery — New creators worth discovering
 *   7. Community Discovery — Communities worth joining
 *
 * Props:
 *   user — User object from the auth store. If null/undefined, a
 *          sign-in prompt is shown instead of the feed.
 *   lang — Language code ('ht' or 'en')
 *   limit — Items per section (default 6)
 */
import React, { memo, useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getHomeFeed } from '../../services/deie';
import { SHEETS } from '../../routes/sheets';
import { requireLogin } from '../../utils/history';
import SkeletonCard from '../SkeletonCard';
import DEIECard from './DEIECard';

const SECTION_ICONS = {
  following: 'fa-user-friends',
  for_you: 'fa-star',
  trending: 'fa-chart-line',
  latest: 'fa-clock',
  communities: 'fa-people-group',
  learning_path: 'fa-graduation-cap',
  opportunities: 'fa-briefcase',
  creator_discovery: 'fa-user-plus',
  community_discovery: 'fa-users',
};

const SECTION_TITLES = {
  following: 'Following',
  for_you: 'For You',
  trending: 'Trending',
  latest: 'Latest',
  communities: 'My Communities',
  learning_path: 'Learning Path',
  opportunities: 'Opportunities',
  creator_discovery: 'Creator Discovery',
  community_discovery: 'Community Discovery',
};

const DEIEFeed = memo(function DEIEFeed({ user, lang = 'ht', limit = 6 }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isHt = lang === 'ht';
  const isAuthed = !!user;
  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getHomeFeed({ limit });
      setFeed(res.data);
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) {
        setError('auth_required');
      } else {
        setError(err.response?.data?.detail || err.message || 'Failed to load feed');
      }
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Only fetch the feed when the user is authenticated — anonymous
  // visitors see the sign-in prompt immediately without a wasted API call.
  useEffect(() => {
    if (isAuthed) fetchFeed();
  }, [fetchFeed, isAuthed]);

  // ── Auth-required prompt (not authenticated or got 401) ──────
  if (!isAuthed || error === 'auth_required') {
    return (
      <div className="deie-feed deie-feed-auth" role="status">
        <div className="deie-auth-icon">
          <i className="fas fa-user-lock" />
        </div>
        <h3>{isHt ? 'Konekte pou wè feed la' : 'Sign in to see your feed'}</h3>
        <p>
          {isHt
            ? 'Konekte oswa kreye yon kont pou resevwa rekòmandasyon pèsonalize.'
            : 'Sign in or create an account to get personalized recommendations.'}
        </p>
        <button type="button" className="deie-auth-btn" onClick={() => requireLogin(navigate, location, SHEETS.LOGIN)}>
          <i className="fas fa-sign-in-alt" /> {isHt ? 'Konekte' : 'Sign in'}
        </button>
      </div>
    );
  }

  // ── Loading state ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="deie-feed">
        <div className="deie-feed-sections">
          {[1, 2, 3].map(i => (
            <div key={i} className="deie-section">
              <div className="deie-section-header-skeleton" />
              <div className="deie-section-grid">
                {[1, 2, 3].map(j => (
                  <SkeletonCard key={j} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────
  if (error && error !== 'auth_required') {
    return (
      <div className="deie-feed deie-feed-error" role="alert">
        <div className="deie-error-icon">
          <i className="fas fa-exclamation-triangle" />
        </div>
        <p className="deie-error-title">
          {isHt ? 'Nou pa ka chaje feed la.' : 'Could not load the feed.'}
        </p>
        <p className="deie-feed-error-detail">{error}</p>
        <button type="button" className="deie-retry-btn" onClick={fetchFeed}>
          <i className="fas fa-redo" /> {isHt ? 'Rekòmanse' : 'Retry'}
        </button>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────
  if (!feed || !feed.sections || feed.sections.length === 0) {
    return (
      <div className="deie-feed deie-feed-empty">
        <i className="fas fa-newspaper" />
        <h3>{isHt ? 'Pa gen kontni nan feed la' : 'No content in your feed'}</h3>
        <p>
          {isHt
            ? 'Eseye swiv kreyatè oswa rantre nan kominote yo pou nouri feed ou.'
            : 'Try following creators or joining communities to populate your feed.'}
        </p>
      </div>
    );
  }

  // ── Feed content ─────────────────────────────────────────────
  return (
    <div className="deie-feed">
      {feed.is_personalized && (
        <div className="deie-feed-personalized-badge">
          <i className="fas fa-magic" />
          <span>{isHt ? 'Feed pèsonalize' : 'Personalized feed'}</span>
        </div>
      )}

      <div className="deie-feed-sections">
        {feed.sections.map((section, idx) => (
          <div key={section.type || idx} className={`deie-section deie-section-${section.type}`}>
            <div className="deie-section-header">
              <i className={`fas ${SECTION_ICONS[section.type] || 'fa-star'}`} />
              <h2 className="deie-section-title">
                {isHt ? getHtTitle(section.type) : SECTION_TITLES[section.type] || section.title}
              </h2>
              {section.is_personalized && (
                <span className="deie-section-personalized-tag">
                  {isHt ? 'Pou ou' : 'For you'}
                </span>
              )}
            </div>

            <div className="deie-section-grid">
              {section.items.map((item, itemIdx) => (
                <DEIECard
                  key={`${item.content_type || item.type}-${item.content_id || item.id}-${itemIdx}`}
                  item={item}
                  sectionType={section.type}
                  lang={lang}
                  user={user}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

export default DEIEFeed;

function getHtTitle(type) {
  const titles = {
    following: 'Ap Swiv',
    for_you: 'Pou Ou',
    trending: 'Tandans',
    latest: 'Dènye',
    communities: 'Kominote Mwen',
    learning_path: 'Chimen Aprantisaj',
    opportunities: 'Opòtinite',
    creator_discovery: 'Dekouvri Kreyatè',
    community_discovery: 'Dekouvri Kominote',
  };
  return titles[type] || 'Rekòmandasyon';
}
