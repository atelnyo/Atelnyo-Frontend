/**
 * src/modules/explore/components/HomeFeed.jsx
 *
 * Renders the backend-driven home feed returned by GET /api/feed/home/.
 *
 * Each section has:
 *   type, title, icon, title_key (i18n), items, count
 *
 * The component fetches the feed once on mount, displays skeleton loaders
 * during loading, and renders each section in order using the CardRegistry
 * from src/modules/explore/cards/.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { feedService, getAnonKey } from '../../../services/api';
import { SHEETS } from '../../../routes/sheets';
import { requireLogin } from '../../../utils/history';
import {
  CourseCard, MusicCard, TalentCard, CommunityCard,
  PortfolioCard, ProductCard, EventCard, JobPostCard, SpotlightCard,
  FollowSuggestionCard,
  SectionLabel, PremiumEmpty,
  SkeletonCourseCard, SkeletonMusicCard, SkeletonTalentCard,
} from '../cards';

// ─── Home-feed localStorage cache (second-visit zero-request) ─────────
// Anonymous visitors all receive the IDENTICAL cold-start feed, so the
// sections are safe to cache (5-min TTL, mirroring useExploreCache). A
// revisit within the TTL renders straight from the cache and fires ZERO
// requests. Personalized (logged-in) feeds are NEVER cached — a second
// account on the same browser must not inherit the first user's
// personalization. The engine (classic/deie) is part of the key.
//
// The anon_key is part of the cache too: a visitor who MINTED a key
// (first guest interaction POST) must NOT be served the pre-key
// cold-start snapshot on their next visit — the anon_key mismatch makes
// the gate miss, so the refetch carries the key and the backend
// personalizes the feed.
const FEED_CACHE_KEY = 'atelnyo_feed_cache';
const FEED_CACHE_TTL_MS = 5 * 60 * 1000;

function readFeedCache() {
  try {
    const raw = localStorage.getItem(FEED_CACHE_KEY);
    if (!raw) return { sections: null, isFresh: false, engine: null, anonKey: null };
    const cached = JSON.parse(raw);
    return {
      sections: Array.isArray(cached.sections) ? cached.sections : null,
      isFresh: Date.now() - (cached._timestamp || 0) < FEED_CACHE_TTL_MS,
      engine: cached.engine || null,
      anonKey: cached.anonKey || null,
    };
  } catch {
    return { sections: null, isFresh: false, engine: null, anonKey: null };
  }
}

function writeFeedCache(engine, sections) {
  try {
    localStorage.setItem(FEED_CACHE_KEY, JSON.stringify({
      engine,
      sections,
      anonKey: getAnonKey() || null,
      _timestamp: Date.now(),
    }));
  } catch {
    // Storage full/unavailable — never block the UI.
  }
}

// ─── Section type → card mapping ────────────────────────────────────────
// Each section type maps to:
//   icon:           the SectionLabel icon for the rail header
//   defaultCard:    the card component to render for each item, or
//                   'dynamic' when items carry their own item_type field.
//
const SECTION_RENDERERS = {
  recommended:           { icon: 'fa-star',          defaultCard: 'dynamic' },
  trending_course:       { icon: 'fa-chart-line',    defaultCard: CourseCard },
  trending_music:        { icon: 'fa-music',         defaultCard: MusicCard },
  trending_talent:       { icon: 'fa-user-plus',     defaultCard: TalentCard },
  trending_community:    { icon: 'fa-users',         defaultCard: CommunityCard },
  trending_product:      { icon: 'fa-shopping-bag',  defaultCard: ProductCard },
  trending_job:          { icon: 'fa-briefcase',     defaultCard: JobPostCard },
  upcoming_events:       { icon: 'fa-calendar-alt',  defaultCard: EventCard },
  portfolio_showcase:    { icon: 'fa-palette',       defaultCard: PortfolioCard },
  spotlight:             { icon: 'fa-lightbulb',     defaultCard: SpotlightCard },
  // Roadmap "plis direksyon" — recency + curated rails added to the
  // backend HomeFeedBuilder so fresh content (no score rows yet) and
  // admin-featured courses surface without waiting for the scoring cron.
  featured_courses:      { icon: 'fa-bookmark',      defaultCard: CourseCard },
  newest_course:         { icon: 'fa-sparkles',      defaultCard: CourseCard },
  newest_music:          { icon: 'fa-sparkles',      defaultCard: MusicCard },
  newest_talent:         { icon: 'fa-user-plus',     defaultCard: TalentCard },
  // Visitor rails — fresh content in every category (anonymous users
  // see these before the scoring cron has ranked the rows).
  newest_community:      { icon: 'fa-users',         defaultCard: CommunityCard },
  newest_product:        { icon: 'fa-shopping-bag',  defaultCard: ProductCard },
  newest_job:            { icon: 'fa-briefcase',     defaultCard: JobPostCard },
  // "You May Want to Follow" — creator (account) suggestions from the
  // backend CreatorFollowRecommender (8-signal blend: mutual follows,
  // similar audience, interests, quality, engagement, consistency,
  // language, community relevance). Rendered via FollowSuggestionCard.
  follow_suggestions:    { icon: 'fa-user-plus',     defaultCard: FollowSuggestionCard },
  // DEIE smart-feed sections (backend DEIEFeedService, normalized into
  // the same contract by HomeFeedBuilder.normalize_deie_feed). Items
  // carry their own item_type → dynamic card dispatch.
  following:             { icon: 'fa-user-friends',  defaultCard: 'dynamic' },
  for_you:               { icon: 'fa-star',          defaultCard: 'dynamic' },
  trending:              { icon: 'fa-chart-line',    defaultCard: 'dynamic' },
  latest:                { icon: 'fa-clock',         defaultCard: 'dynamic' },
  communities:           { icon: 'fa-people-group',  defaultCard: 'dynamic' },
  learning_path:         { icon: 'fa-graduation-cap', defaultCard: 'dynamic' },
  opportunities:         { icon: 'fa-briefcase',     defaultCard: 'dynamic' },
  creator_discovery:     { icon: 'fa-user-plus',     defaultCard: 'dynamic' },
  community_discovery:   { icon: 'fa-users',         defaultCard: 'dynamic' },
};

/**
 * Resolve which card component to use for a given item + section.
 * For the "recommended" section items carry their own item_type field.
 */
function resolveCardComponent(item, sectionRenderer) {
  if (sectionRenderer.defaultCard !== 'dynamic') {
    return sectionRenderer.defaultCard;
  }
  // Dynamic dispatch based on item_type
  const type = item.item_type || '';
  const CARD_MAP = {
    course:    CourseCard,
    music:     MusicCard,
    talent:    TalentCard,
    community: CommunityCard,
    event:     EventCard,
    product:   ProductCard,
    job:       JobPostCard,
    portfolio: PortfolioCard,
    spotlight: SpotlightCard,
    creator:   FollowSuggestionCard,
  };
  const Card = CARD_MAP[type];
  return Card || null;
}

// ─── Guest welcome card ────────────────────────────────────────────────
// First-time (anonymous) visitors get a welcome CARD that sits inside
// the first rail of the feed — same shape/width as a CourseCard (image
// on top, title + CTA below) — instead of a full-width banner above the
// page. The feed stays fully browsable, no auth wall.
function GuestWelcomeCard({ lang, t, onSignUp }) {
  const isHt = lang === 'ht';
  const title = t.feed_guest_title || (isHt ? 'Byenveni sou Atelnyo' : 'Welcome to Atelnyo');
  const desc = t.feed_guest_desc || (isHt
    ? 'Dekouvri kou, mizik, talan ak opòtinite. Kreye yon kont gratis pou swiv sa ou renmen ak resevwa rekòmandasyon pèsonalize.'
    : 'Discover courses, music, talents and opportunities. Create a free account to save what you love and get personalized recommendations.');
  const cta = t.feed_guest_cta || (isHt ? 'Kreye yon kont gratis' : 'Create a free account');

  return (
    <div
      className="explore-card explore-card-course feed-guest-card"
      role="button"
      tabIndex={0}
      aria-label={title}
      onClick={onSignUp}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSignUp();
        }
      }}
    >
      <div className="explore-card-image-wrap feed-guest-card__image">
        <div className="feed-guest-card__badge" aria-hidden="true">
          <i className="fas fa-hand-sparkles" />
        </div>
      </div>
      <div className="explore-card-body">
        <div className="explore-card-title">{title}</div>
        <div className="explore-card-subtitle">{desc}</div>
        <div className="explore-card-meta feed-guest-card__meta">
          <span className="feed-guest-card__cta-text">
            <i className="fas fa-user-plus" aria-hidden="true" />
            {cta}
          </span>
          <span className="explore-card-cta" aria-hidden="true">
            <i className="fas fa-arrow-right" />
          </span>
        </div>
      </div>
    </div>
  );
}


// ─── HomeFeed Component ─────────────────────────────────────────────────

export default function HomeFeed({
  lang = 'ht',
  translations,
  user,
  // true → request the DEIE smart feed (engine=deie on /api/feed/home/)
  // instead of the classic HomeFeedBuilder feed.
  useDEIE = false,
  onOpenCourse,
  onOpenMusicSheet,
  onOpenTalentSheet,
  onOpenJobSheet,
  onOpenProduct,
  onOpenPortfolio,
  onOpenCheckout,
  showToast,
  savedMusicIds,
  savedTalentIds,
  onToggleSaveMusic,
  onToggleSaveTalent,
  onOpenCommunity,
  // "You May Want to Follow" rail — creator suggestions need the
  // authenticated user (for the Follow button) + a profile deep-link
  // handler + a way to notify the parent after a follow toggle.
  onOpenProfile,
  onFollowed,
  // Bump to force a feed refetch (e.g. after following a creator so the
  // just-followed account drops out of the next suggestion rail).
  refreshSignal = 0,
}) {
  const t = translations?.[lang] || translations?.ht || {};
  // Route hook — declared at the top so the hook order stays stable
  // across the early returns below (loading/error/empty states).
  const navigate = useNavigate();
  const location = useLocation();

  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Bumped by the retry button so a failed load can be re-attempted
  // without unmounting the component (the effect below depends on it).
  const [reloadKey, setReloadKey] = useState(0);
  // Toggled once sections actually render so the CSS cascade entrance
  // (``.feed-entered``) plays exactly when content appears — not while
  // the skeleton is up, and not on every re-render.
  const [entered, setEntered] = useState(false);
  const fetchRef = useRef(0);

  // ─── Fetch home feed on mount / retry ────────────────────────────────
  useEffect(() => {
    const seq = ++fetchRef.current;

    // Second-visit zero-request gate (anonymous only). A fresh cache
    // renders straight from localStorage with NO network request. It
    // only applies on a plain mount (no pending follow-refresh / retry),
    // so a just-followed creator still drops out of the suggestion rail
    // (refreshSignal bump → real refetch) and the retry button works
    // (reloadKey bump → real refetch). Re-checked per run — StrictMode's
    // dev double-mount sees the same fresh cache and skips both times.
    if (!user && refreshSignal === 0 && reloadKey === 0) {
      const cached = readFeedCache();
      if (
        cached.isFresh
        && cached.engine === (useDEIE ? 'deie' : 'home')
        && cached.anonKey === (getAnonKey() || null)
        && cached.sections && cached.sections.length > 0
      ) {
        /* eslint-disable react-hooks/set-state-in-effect */
        setSections(cached.sections);
        setLoading(false);
        setError(null);
        setEntered(true);
        /* eslint-enable react-hooks/set-state-in-effect */
        return;
      }
    }

    // Async fetch: synchronous first-statement setState resets the
    // skeleton before the network request — same intentional pattern
    // as CheckoutModal.jsx / DepositModal.jsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    feedService.home(6, useDEIE ? 'deie' : 'home')
      .then((res) => {
        if (seq !== fetchRef.current) return;
        // Unwrap ApiResponseRenderer envelope if present
        const data = (res.data?.data) || res.data || {};
        const items = Array.isArray(data.sections) ? data.sections : [];
        setSections(items);
        setError(null);
        // Content is on screen — release the cascade entrance (the
        // CSS animation is gated on ``.feed-entered``).
        setEntered(true);
        // Cache anonymous results so the next visit within 5 minutes
        // paints instantly with zero requests.
        if (!user) writeFeedCache(useDEIE ? 'deie' : 'home', items);
      })
      .catch((err) => {
        if (seq !== fetchRef.current) return;
        setSections([]);
        setError(
          err?.response?.data?.detail
            || err?.message
            || t.explore_load_error
            || 'Could not load feed.',
        );
      })
      .finally(() => {
        if (seq === fetchRef.current) setLoading(false);
      });
  }, [user?.id, t.explore_load_error, reloadKey, useDEIE, refreshSignal]);

  const handleRetry = useCallback(() => {
    // Real refetch: bump reloadKey (the effect re-runs). Setting
    // loading here gives the user instant skeleton feedback.
    setError(null);
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  // ─── Loading state ──────────────────────────────────────────────────
  // Mirror the typical HomeFeed shape (course rail → music rail → talent
  // rail) so each skeleton matches the content that will actually land:
  // course-shaped cards for mixed rails, square music cards, and
  // circle-avatar talent rows. (Before, the whole screen showed 4 course
  // skeletons, then jumped to 5-8 real rails once data arrived.)
  if (loading) {
    return (
      <div className="feed-container">
        <SectionLabel icon={t.explore_recommended_icon || 'fa-star'}>
          {t.explore_recommended || (lang === 'ht' ? 'Rekòmande pou ou' : 'Recommended For You')}
        </SectionLabel>
        <div className="explore-hscroll" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCourseCard key={`course-${i}`} />)}
        </div>
        <SectionLabel icon="fa-music">
          {lang === 'ht' ? 'Mizik' : 'Music'}
        </SectionLabel>
        <div className="explore-hscroll" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonMusicCard key={`music-${i}`} />)}
        </div>
        <SectionLabel icon="fa-user-plus">
          {lang === 'ht' ? 'Talan' : 'Talent'}
        </SectionLabel>
        <div className="explore-hscroll" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonTalentCard key={`talent-${i}`} />)}
        </div>
        <div className="feed-loading-more" role="status">
          <i className="fas fa-spinner fa-spin" aria-hidden="true" />
          <span>{t.explore_loading || (lang === 'ht' ? 'Ap chaje...' : 'Loading...')}</span>
        </div>
      </div>
    );
  }

  // ─── Error state ─────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="feed-container">
        <PremiumEmpty
          search={false}
          onClearFilters={handleRetry}
          t={t}
          error={error}
        />
      </div>
    );
  }

  // ─── Empty state ────────────────────────────────────────────────────
  if (!sections || sections.length === 0) {
    return (
      <div className="feed-container feed-empty">
        <div className="feed-empty-icon">
          <i className="fas fa-compass" aria-hidden="true" />
        </div>
        <h3>
          {t.explore_empty_title || (lang === 'ht' ? 'Anyen pa jwenn' : 'Nothing found yet')}
        </h3>
        <p>
          {t.explore_empty_desc || (lang === 'ht'
            ? 'Pa gen kontni pou montre kounye a. Tcheke pita!'
            : 'No content to show right now. Check back later!')}
        </p>
      </div>
    );
  }

  // ─── Render sections ────────────────────────────────────────────────
  // Visitor experience: a first-time (anonymous) visitor gets a welcome
  // CARD as the FIRST item of the first rail — it reads as just another
  // content card in the feed body, not a banner on top of the page.
  const isGuest = !user;
  return (
    <div className={`feed-container${entered ? ' feed-entered' : ''}`}>
      {sections.map((section, sectionIdx) => {
        const renderer = SECTION_RENDERERS[section.type] || {
          icon: 'fa-star',
          defaultCard: null,
        };
        const sectionTitle = t[section.title_key] || section.title || section.type;
        const items = section.items || [];
        if (items.length === 0) return null;

        return (
          <div key={section.type} className="feed-section">
            {/* Section header */}
            <SectionLabel
              icon={renderer.icon || section.icon || 'fa-star'}
              count={section.count || items.length}
              accent={section.type.replace(/^trending_/, '').replace(/^upcoming_/, '')}
            >
              {sectionTitle}
            </SectionLabel>

            {/* Items row — the guest welcome card leads the FIRST rail */}
            <div className="explore-hscroll">
              {isGuest && sectionIdx === 0 && (
                <GuestWelcomeCard
                  key="feed-guest-card"
                  lang={lang}
                  t={t}
                  onSignUp={() => requireLogin(navigate, location, SHEETS.SIGNUP)}
                />
              )}
              {items.map((item, idx) => {
                const Card = resolveCardComponent(item, renderer);
                if (!Card) return null;

                // Build common props that all cards accept
                const cardKey = `${section.type}-${item.id || idx}`;
                const commonProps = { t, lang, showToast };

                // Dispatch based on card type
                if (Card === CourseCard) {
                  return (
                    <CourseCard
                      key={cardKey}
                      course={item}
                      onOpen={onOpenCourse}
                      lang={lang}
                      t={t}
                      {...commonProps}
                    />
                  );
                }
                if (Card === MusicCard) {
                  return (
                    <MusicCard
                      key={cardKey}
                      track={item}
                      onOpen={onOpenMusicSheet}
                      showToast={showToast}
                      t={t}
                      isSaved={savedMusicIds?.has(item.id)}
                      onSaveToggle={onToggleSaveMusic}
                      {...commonProps}
                    />
                  );
                }
                if (Card === TalentCard) {
                  return (
                    <TalentCard
                      key={cardKey}
                      talent={item}
                      onOpenSheet={onOpenTalentSheet}
                      showToast={showToast}
                      t={t}
                      isSaved={savedTalentIds?.has(item.id)}
                      onSaveToggle={onToggleSaveTalent}
                      {...commonProps}
                    />
                  );
                }
                if (Card === CommunityCard) {
                  return (
                    <CommunityCard
                      key={cardKey}
                      community={item}
                      onOpen={onOpenCommunity}
                      t={t}
                      lang={lang}
                      {...commonProps}
                    />
                  );
                }
                if (Card === EventCard) {
                  return (
                    <EventCard
                      key={cardKey}
                      event={item}
                      t={t}
                      showToast={showToast}
                      onOpenCheckout={onOpenCheckout}
                      user={user}
                      {...commonProps}
                    />
                  );
                }
                if (Card === ProductCard) {
                  return (
                    <ProductCard
                      key={cardKey}
                      product={item}
                      t={t}
                      showToast={showToast}
                      onOpen={onOpenProduct}
                      onOpenCheckout={onOpenCheckout}
                      {...commonProps}
                    />
                  );
                }
                if (Card === JobPostCard) {
                  // Opens the JobSheet detail page (budget, skills, poster,
                  // apply). Escrow funding stays bound to CONTRACT
                  // MILESTONES — the sheet's apply flow submits a proposal,
                  // never a checkout.
                  return (
                    <JobPostCard
                      key={cardKey}
                      job={item}
                      t={t}
                      showToast={showToast}
                      onOpenSheet={onOpenJobSheet}
                      {...commonProps}
                    />
                  );
                }
                if (Card === PortfolioCard) {
                  return (
                    <PortfolioCard
                      key={cardKey}
                      project={item}
                      t={t}
                      showToast={showToast}
                      onOpen={onOpenPortfolio}
                      {...commonProps}
                    />
                  );
                }
                if (Card === SpotlightCard) {
                  return (
                    <SpotlightCard
                      key={cardKey}
                      item={item}
                      t={t}
                      lang={lang}
                      {...commonProps}
                    />
                  );
                }
                if (Card === FollowSuggestionCard) {
                  return (
                    <FollowSuggestionCard
                      key={cardKey}
                      item={item}
                      t={t}
                      lang={lang}
                      showToast={showToast}
                      user={user}
                      onOpenProfile={onOpenProfile}
                      onFollowed={onFollowed}
                    />
                  );
                }

                // Fallback: render the Card component generically
                return <Card key={cardKey} item={item} {...commonProps} />;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
