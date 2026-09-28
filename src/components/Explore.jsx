/**
 * src/components/Explore.jsx
 *
 * The Explore surface (Phase 14 — Premium).
 *
 * Layers (FE → BE consumer):
 *   • /api/courses/                  via   courseService.getAll()
 *   • /api/explore/music/            via   api.get('explore/music/')
 *   • /api/explore/music/{id}/play/  via   api.post (audio preview counter)
 *   • /api/explore/talents/          via   api.get('explore/talents/')
 *
 * Tier A #2 reference: MUSIC_SEEDS / TALENT_SEEDS retired; the live endpoints
 * are the only source of truth. An empty array renders a premium rose
 * illustration (no stale fallback).
 *
 * Phase 14 features:
 *   • Skeleton loaders per section (instant <100ms paint on chip change).
 *   • Hero stats pills ("12 kou · 8 mizik · 5 talan").
 *   • Featured rail split into 3 typed sub-rows (no shape-mixing flicker).
 *   • Music click → audio preview via <audio> + play-counter POST;
 *     Talent click → opens sheet OR routes to messenger DM (when linked_user).
 *   • Premium empty-state with rose SVG (zero-data never looks broken).
 *   • Server-side `?q=` + `?featured=true` filters supported for scale.
 *   • Full i18n flush: every string reads `t.explore_…` — no inline ternaries.
 *   • Dark-mode + reduced-motion handled in `src/styles/index.css` block.
 */
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import useSafeNavigate from '../hooks/useSafeNavigate';
import api, { courseService, savedMusicService, savedTalentsService, savedItemService, recommendedService, interactionService, communitiesService, jobService, portfolioService, marketplaceService, eventsService, spotlightService, businessSpotlightService, searchService, categoryService } from '../services/api';
import SEOHead, { webSiteSchema } from './shared/SEOHead';
import { buildContentUrl } from '../utils/contentUrl';

// ─── Phase 1: Import modular card components ─────────────────────────────
import {
  CourseCard, MusicCard, TalentCard, CommunityCard,
  PortfolioCard, ProductCard, EventCard, JobPostCard, SpotlightCard,
  SectionLabel, PremiumEmpty,
  SkeletonCourseCard, SkeletonMusicCard, SkeletonTalentCard,
} from '../modules/explore/cards';

// ─── Phase Business Spotlight: Business identity in Spotlight ───────────
import BusinessSpotlightCard from './spotlight/BusinessSpotlightCard';

// ─── Founding a community (creator-with-content gated) ─────────────────
import CreateCommunityModal from './communities/CreateCommunityModal';

// ─── Phase 2: Home Feed component ───────────────────────────────────────
import HomeFeed from '../modules/explore/components/HomeFeed';
import TrendingHashtags from '../modules/explore/components/TrendingHashtags';

// ─── DEIE: Atelnyo Evolution Intelligence Engine Feed ──────────────────
import {
  classNames, normalizeTrack, normalizeTalent, formatPlays,
} from '../modules/explore/utils/cardHelpers';
// Faz 1 (unified search routing) — maps /api/search/ payloads onto the
// Explore card shapes + translates the active chip into a ``types=`` CSV.
import {
  groupSearchResults, filterToSearchTypes,
} from '../modules/explore/utils/searchAdapters';
import {
  readExploreCache, writeExploreCache, clearExploreCache,
  readSearchState, writeSearchState,
} from '../modules/explore/hooks/useExploreCache';

// ─── Filter chips ───────────────────────────────────────────────────────────
const CHIPS = [
  { id: 'all',      icon: 'fa-globe',        ht: 'Tout',     en: 'All',         fr: 'Tout',     es: 'Todo' },
  { id: 'courses',  icon: 'fa-graduation-cap', ht: 'Kou',    en: 'Courses',     fr: 'Cours',    es: 'Cursos' },
  { id: 'music',    icon: 'fa-music',        ht: 'Mizik',    en: 'Music',       fr: 'Musique',  es: 'Música' },
  { id: 'talents',  icon: 'fa-star',         ht: 'Talan',    en: 'Talents',     fr: 'Talents',  es: 'Talentos' },
  { id: 'featured', icon: 'fa-bookmark',     ht: 'Rekòmande', en: 'Featured',   fr: 'Vedette',  es: 'Destacado' },
  { id: 'new',      icon: 'fa-sparkles',     ht: 'Nouvo',    en: 'New',         fr: 'Nouveau',  es: 'Nuevo' },
  { id: "communities",  icon: "fa-users",        ht: "Kominote",  en: "Communities",  fr: "Communautés",  es: "Comunidades" },
  { id: "jobs",  icon: "fa-briefcase",  ht: "Travay",  en: "Jobs",  fr: "Emplois",  es: "Empleos" },
  { id: "portfolio", icon: "fa-palette", ht: "Pòtfolyo", en: "Portfolio", fr: "Portfolio", es: "Portafolio" },
  { id: "marketplace", icon: "fa-shopping-bag", ht: "Mache", en: "Market", fr: "Marché", es: "Mercado" },
  { id: "events", icon: "fa-calendar-alt", ht: "Evènman", en: "Events", fr: "Événements", es: "Eventos" },
  // Phase 47 — Creator Spotlight chip. A curated list of inventions
  // that don't exist anywhere else on the platform. The
  // ``fa-lightbulb`` icon matches the Settings launcher; the label
  // stays short so the chip doesn't wrap on narrow viewports.
  { id: "spotlight", icon: "fa-lightbulb", ht: "Spotlight", en: "Spotlight", fr: "Spotlight", es: "Spotlight" },
];

// ─── Course discovery — language directions ──────────────────────────────
// Distinct pairs (Kreyòl→English is NOT the same experience as
// English→Kreyòl). Labels stay in the teaching→learner order.
const COURSE_DIRECTIONS = [
  { value: 'Kreyòl→English', label: 'Kreyòl → English' },
  { value: 'English→Kreyòl', label: 'English → Kreyòl' },
  { value: 'Kreyòl→Français', label: 'Kreyòl → Français' },
  { value: 'Français→Kreyòl', label: 'Français → Kreyòl' },
  { value: 'Kreyòl→Español', label: 'Kreyòl → Español' },
  { value: 'Español→Kreyòl', label: 'Español → Kreyòl' },
];

// ─── Error message helper (Phase 19.2) ──────────────────────────────
// Translates raw axios / network errors into user-friendly messages.
// Without this, every failed fetch shows the opaque "Network Error"
// string — the user has no idea whether the server is down, the
// connection is blocked, or the request timed out.
function describeFetchError(err, fallbackMsg, lang = 'ht') {
  // CORS preflight failure: browser blocks the response, err.response
  // is undefined and err.message is "Network Error".
  if (!err?.response && (err?.message === 'Network Error' || err?.code === 'ERR_NETWORK')) {
    return lang === 'ht'
      ? 'Pa ka rive sèvè a. Tcheke koneksyon ou oswa eseye ankò pita.'
      : 'Cannot reach the server. Check your connection or try again later.';
  }
  // Request timed out.
  if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
    return lang === 'ht'
      ? 'Sèvè a twò dousman reponn. Eseye ankò pita.'
      : 'Server is too slow to respond. Try again later.';
  }
  // Server returned an HTTP error.
  if (err?.response) {
    const status = err.response.status;
    if (status === 503) {
      return lang === 'ht'
        ? 'Sèvè a an mantansyon. Eseye ankò pita.'
        : 'Server is under maintenance. Try again later.';
    }
    if (status === 429) {
      return lang === 'ht'
        ? 'Twòp rechèt. Tann yon ti tan epi eseye ankò.'
        : 'Too many requests. Wait a moment and try again.';
    }
    if (status >= 500) {
      return lang === 'ht'
        ? 'Erè sèvè. Eseye ankò pita.'
        : 'Server error. Try again later.';
    }
    return err.response.data?.detail || fallbackMsg;
  }
  // Fallback: pass through whatever message we got.
  return err?.message || fallbackMsg;
}

function getChipLabel(chip, lang) {
  const langKey = ['en', 'fr', 'es'].includes(lang) ? lang : 'ht';
  return chip[langKey] || chip.ht;
}

// ─── Recommended-rail card wrapper (Phase 37 negative feedback) ─────────
// Wraps a recommended card with a positioned "Pa enterese" (not
// interested) dismiss button. Keeps the 7 card components untouched — the
// button floats over the card's top-right corner (the cards are
// position:static, so the wrapper supplies the containing block).
// ``flex: 0 0 auto`` is inherited from the card inside the wrapper, so
// the hscroll / grid / column rail layouts keep their exact sizing.
function RecommendedRailCard({ itemType, itemId, onDismiss, t, children }) {
  const label = t.explore_not_interested_aria || 'Pa enterese';
  return (
    <div className="reco-rail-item">
      {children}
      <button
        type="button"
        className="reco-rail-dismiss"
        aria-label={label}
        title={label}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDismiss(itemType, itemId);
        }}
      >
        <i className="fa-solid fa-eye-slash" aria-hidden="true" />
      </button>
    </div>
  );
}

// ─── Phase 22 scoped Recommended rail ────────────────────────────────
// The "Rekòmande pou ou" rail used to surface EVERY content type on ANY
// filter chip — so clicking "Evènman" showed courses/music/jobs at the
// top instead of events ("se lòt yo bay olye de li"). The rail is now
// scoped to the active chip: a type-specific filter (courses, music,
// talents, events, communities, jobs, marketplace) only shows recommended
// items of that type; the meta-filters (featured / new) keep the mixed
// rail since those views legitimately mix types; and portfolio /
// spotlight have no rail at all.
const RECOMMENDED_SCOPE = {
  courses: ['courses'],
  music: ['music'],
  talents: ['talents'],
  events: ['events'],
  communities: ['communities'],
  jobs: ['jobs'],
  marketplace: ['products'],
};

// ─── Popularity-badge fetch scope ──────────────────────────────────
// Which content types actually render on the current chip. The
// save-count fetches (Phase 61) used to fire for ALL 8 types on every
// chip — a "Mizik" view with zero courses/jobs/portfolio visible still
// issued 8 count requests. Now only the visible sections fetch, so a
// chip view drops from 8 → 0-3 requests. ``saveCounts`` state persists
// across chip switches, so a type fetched once stays cached and never
// refetches (the per-type signature guard below skips identical id
// sets).
const VISIBLE_COUNT_TYPES = {
  all: ['music', 'talent', 'course', 'job', 'portfolio', 'product', 'event', 'spotlight'],
  courses: ['course'],
  music: ['music'],
  talents: ['talent'],
  featured: ['course', 'music', 'talent'],
  new: ['course', 'music', 'talent'],
  communities: [],
  jobs: ['job'],
  portfolio: ['portfolio'],
  marketplace: ['product'],
  events: ['event'],
  spotlight: ['spotlight'],
};

// ─── Second-visit zero-request gate ────────────────────────────────────
// The localStorage explore cache (5-min TTL) restores every section for
// instant paint on mount — but the mount fetch effects used to re-fire
// the 9 catalog requests, the recommended rail and the save-count badges
// anyway. Now, when the cache was FRESH AT MOUNT (anonymous visitors),
// those effects skip the network entirely: a revisit within 5 minutes
// paints instantly AND fires zero data-fetching requests. Search (a
// ranked endpoint) is EXEMPT — typing a real query always hits the
// server. The decision is made ONCE at mount (``cacheFreshAtMountRef``,
// see the restore effect) so a first visit whose cache becomes fresh
// mid-session keeps its normal fetch behavior. The home feed and the
// trending-hashtags rail have their own caches inside their components.

// ─── (SectionLabel, skeleton, and card components are now imported
//      from src/modules/explore/cards/ — Phase 1 extraction)

// ─── (CourseCard imported from modules/explore/cards/CourseCard.jsx)

// ─── (MusicCard + TalentCard imported from modules/explore/cards/)


// ─── (CommunityCard + PortfolioCard imported from modules/explore/cards/)

// ─── (ProductCard, EventCard, JobPostCard, SpotlightCard, PremiumEmpty
//      imported from modules/explore/cards/)

// ─── Main component ─────────────────────────────────────────────────────────

export function Explore({
  user,
  lang = 'ht',
  // Phase 4/§29 — resolved market context (URL locale segment or the
  // user's stored atelnyo_market choice). Empty string = no explicit
  // market → the backend returns the GLOBAL catalog (markets=[] rows
  // included), keeping the bare root fully backwards compatible.
  market = '',
  translations,
  onOpenCourse,
  onOpenMusicSheet,
  onOpenTalentSheet,
  onOpenJobSheet,
  onOpenProduct,
  onOpenPortfolio,
  onOpenCheckout,         // Phase 32 — marketplace + escrow checkout wiring
  showToast,
}) {
  const t = translations?.[lang] || translations?.ht || {};
  // Current path — drives the self-canonical (Explore mounts at /,
  // /explore AND /sheet/explore; each must canonicalize to itself).
  const { pathname } = useLocation();

  // ─── Faz 2 (URL-state filters) ────────────────────────────────────────
  // The active filter chip + search query now live in the URL
  // (``?filter=music&q=lanmou``) so:
  //   • the browser Back button restores the previous filter/search
  //   • a shared link re-opens the exact filtered Explore view
  //   • the document title reflects the combination (e.g. "Mizik — Atelnyo")
  //
  // The URL is the source of truth for INITIAL state; the existing
  // localStorage layer (readSearchState/writeSearchState) remains as a
  // fallback for the tab-mounted Explore (whose URL is just "/").
  //
  // Implementation guard: we only write the URL when the user actually
  // changes filter/search (never on mount), and we read it only to seed
  // state — so the popstate/back-button path works without a sync loop.
  const [searchParams, setSearchParams] = useSearchParams();

  // Seed from URL first, fall back to localStorage for the tab mount.
  const urlFilter = searchParams.get('filter');
  const urlQ = searchParams.get('q') || '';
  const [search, setSearch] = useState(() => {
    if (urlQ) return urlQ;
    const saved = readSearchState();
    return saved.search || '';
  });
  const debouncedSearch = useDeferredValue(search);
  const [filter, setFilter] = useState(() => {
    if (urlFilter && CHIPS.some((chip) => chip.id === urlFilter)) return urlFilter;
    const saved = readSearchState();
    return saved.filter || 'all';
  });

  // Keep the URL in sync with user-driven changes. `replace: true` keeps
  // the history stack shallow (filter toggling shouldn't spawn 8 entries).
  useEffect(() => {
    const params = {};
    if (filter && filter !== 'all') params.filter = filter;
    if (search.trim()) params.q = search.trim();
    const next = new URLSearchParams(params);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filter]);

  // React to browser Back/Forward (the URL changed without us setting it).
  useEffect(() => {
    const spFilter = searchParams.get('filter');
    const spQ = searchParams.get('q') || '';
    if (spFilter !== urlFilter || spQ !== urlQ) {
      // Syncing state from the URL on popstate is the point of this
      // effect — the URL is the source of truth for Back/Forward.
      if (spFilter && CHIPS.some((chip) => chip.id === spFilter)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFilter(spFilter);
      } else if (!spFilter) {
        setFilter('all');
      }
      setSearch(spQ);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Faz 2 — dynamic document title per filter combination. Uses
  // ``search.trim()`` (not the later ``q`` const) to avoid a TDZ read
  // — this effect lives before ``const q = …`` in the component body.
  useEffect(() => {
    const chip = CHIPS.find((c) => c.id === filter);
    const chipLabel = chip ? getChipLabel(chip, lang) : '';
    const suffix = lang === 'ht' ? 'Atelnyo · Dekouvèt' : 'Atelnyo · Explore';
    const trimmed = search.trim();
    document.title = [chipLabel && filter !== 'all' ? chipLabel : '', trimmed ? `"${trimmed}"` : '', suffix]
      .filter(Boolean)
      .join(' · ');
    return () => { document.title = 'Atelnyo'; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search, lang]);

  // ─── State ─────────────────────────────────────────────────────────────
  // Search input stays live so the textbox updates per keystroke; the
  // fetch only fires against ``debouncedSearch`` (200ms idle) so a burst
  // of typing doesn't race 6 endpoint hits (reviewer #6).
  //
  // ``hasMounted`` flips to ``true`` after the first paint so the
  // entrance keyframes in ``styles/index.css`` (gated by
  // ``.explore-page:not(.is-mounted)``) only play on the very first
  // mount. Every later filter chip click re-renders the section list,
  // but without this gate the cascading ``animation-delay`` would
  // replay on every remount and read as a 0.5s blink the user didn't
  // ask for. ``useEffect`` (not ``useLayoutEffect``) is fine here
  // because the entrance is at opacity:0 only at the very first
  // paint and resolves to opacity:1 within 0.5s — well before the
  // second-paint flip to ``is-mounted`` — so no flicker is visible.
  //
  // Intentional UX nuance: if the user clicks a filter chip DURING
  // the first 0.5s entrance, ``hasMounted`` is still ``false`` so the
  // newly-revealed sections DO play the rise. This reads as
  // "sections rising in as they're revealed" rather than as a bug.
  const [hasMounted, setHasMounted] = useState(false);
  // One-shot flip after first paint gates the entrance keyframes —
  // intentional mount-only state set (see comment block above).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setHasMounted(true); }, []);

  // ─── DEIE togggle — switch between classic HomeFeed and DEIE smart feed ──
  const [useDEIE, setUseDEIE] = useState(() => {
    try { return localStorage.getItem('atelnyo_deie_feed') === 'true'; }
    catch { return false; }
  });
  const toggleDEIE = () => {
    const next = !useDEIE;
    setUseDEIE(next);
    try { localStorage.setItem('atelnyo_deie_feed', String(next)); } catch {}
  };

  // ─── Normalized category filter (backend migration 0096) ───────────────
  // Per-tab dropdown driven by the Category table IDs: options come from
  // GET /api/categories/?scope= and the client arrays are filtered by
  // ``category_id`` (the numeric ID, not the display string).
  const CATEGORY_SCOPE_BY_FILTER = {
    courses: 'course',
    music: 'music',
    communities: 'community',
    products: 'product',
    portfolio: 'portfolio',
    spotlight: 'spotlight',
  };
  const [catId, setCatId] = useState('');
  const [catOptions, setCatOptions] = useState([]);

  useEffect(() => {
    // NOTE: intentionally NOT gated by the second-visit cache — the
    // options are scope-specific (per chip), so they must always load
    // for the active scope. On the default 'all' view this effect
    // returns early (no scope) and fires nothing.
    // Changing tabs resets the category selection + reloads the options
    // for the newly active scope.
    setCatId('');
    setCatOptions([]);
    const scope = CATEGORY_SCOPE_BY_FILTER[filter];
    if (!scope) return;
    let mounted = true;
    categoryService.list(scope)
      .then((res) => {
        if (!mounted) return;
        const data = res?.data?.results ?? res?.data?.data ?? res?.data ?? [];
        setCatOptions(Array.isArray(data) ? data : []);
      })
      .catch(() => { if (mounted) setCatOptions([]); });
    return () => { mounted = false; };
  }, [filter]);

  // Save search/filter to localStorage on every change (tab-mount fallback)
  useEffect(() => {
    writeSearchState(search, filter);
  }, [search, filter]);
  const [courses, setCourses] = useState([]);
  // ─── Course discovery filters (language direction / level / price /
  //     owner). Client-side over the already-fetched course list — the
  //     backend also supports these as query params, but filtering here
  //     keeps the existing catalog fetch pattern untouched. ───────────
  const [courseDir, setCourseDir] = useState('all');
  const [courseLevel, setCourseLevel] = useState('all');
  const [coursePrice, setCoursePrice] = useState('all');
  const [courseOwner, setCourseOwner] = useState('all');
  const [apiMusic, setApiMusic] = useState([]);
  const [apiTalents, setApiTalents] = useState([]);
  const [apiCommunities, setApiCommunities] = useState([]);
  const [apiJobs, setApiJobs] = useState([]);
  const [apiPortfolio, setApiPortfolio] = useState([]);
  const [apiMarketplace, setApiMarketplace] = useState([]);
  const [apiEvents, setApiEvents] = useState([]);
  // Phase 47 — Creator Spotlight public list. Fetched on mount +
  // user change (the BE returns only approved rows, so the list
  // is safe to cache across user sessions). The fetch is
  // anonymous-OK so we don't gate on `user` — but we re-fetch on
  // identity change to invalidate the cache in case a freshly-
  // approved application is what the user came back to see.
  const [apiSpotlight, setApiSpotlight] = useState([]);
  // Phase Business Spotlight — Business profiles in Spotlight section.
  const [apiBusinessSpotlight, setApiBusinessSpotlight] = useState([]);
  // Phase 61 — Popularity badges: total saves per item (across ALL
  // users) for every Explore section, fetched with ONE batch request
  // per content type. Shape: { music: {id: count}, talent: {...}, ... }.
  const [saveCounts, setSaveCounts] = useState({});
  // Per-section "still loading after first paint" flags so skeletons
  // surface per chip without re-flashing on chip change (Phase 14.1).
  const [loadingSections, setLoadingSections] = useState({
    courses: true,
    music: true,
    talents: true,
    communities: true,
    jobs: true,
    portfolio: true,
    marketplace: true,
    events: true,
    spotlight: true,
    businessSpotlight: true,
  });
  // Phase 19.2 — per-section load error state. The catch handlers
  // below used to silently set empty arrays on any API failure,
  // which surfaced as the premium "Anyen pa jwenn" empty state —
  // indistinguishable from "the DB has no data". An anonymous
  // visitor hitting a network blip saw an empty page with no
  // indication that the API had actually failed. We now capture
  // the error message and:
  //   * surface a toast (one per failed section) so the user
  //     immediately knows something is wrong
  //   * pass it to the empty state so the message reads
  //     "Could not load X. Tap retry." instead of "No results"
  //   * keep the "no data" empty state for the happy-path case
  //     (catalog genuinely empty) so the two scenarios don't
  //     conflate.
  const [loadErrors, setLoadErrors] = useState({
    courses: null,
    music: null,
    talents: null,
    communities: null,
    jobs: null,
    portfolio: null,
    marketplace: null,
    events: null,
    spotlight: null,
    businessSpotlight: null,
  });
  // Phase 22 — Recommended rail (scored by compute_scores nightly cron).
  // Separate state from the filter-driven sections so the recommended
  // rail always shows (even when the user is on a specific chip).
  const [recommendedMusic, setRecommendedMusic] = useState([]);
  const [recommendedTalents, setRecommendedTalents] = useState([]);
  const [recommendedCourses, setRecommendedCourses] = useState([]);
  // Phase 37 — AI-Powered Discovery 2.0: recommended states for all
  // 7 content types so the rail surfaces events, communities, jobs,
  // and marketplace products alongside the original trio.
  const [recommendedEvents, setRecommendedEvents] = useState([]);
  const [recommendedCommunities, setRecommendedCommunities] = useState([]);
  const [recommendedJobs, setRecommendedJobs] = useState([]);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [loadingRecommended, setLoadingRecommended] = useState(true);
  // Phase 37 — rail error + retry state. The recommended fetch used to
  // fail silently (spinner off, no message) — an anonymous visitor on a
  // network blip saw the rail vanish with no explanation. The error is
  // now captured and the rail renders a small recoverable message with a
  // retry action (same contract as the per-section ``loadErrors``).
  const [recommendedError, setRecommendedError] = useState(null);
  const [recommendedReload, setRecommendedReload] = useState(0);
  // ─── Phase 19.1 — quick-save state (Phase 19's bookmark icon on
  // every card). We hold the user's saved talent + music IDs as
  // Sets (O(1) membership checks per card) so the catalog page can
  // render N cards without N round-trips to /saved/?. The initial
  // fetch fires once on mount / user-change (NOT on every
  // search/filter change — saved state is global to the user, not
  // per-filter). The Sets are mutated optimistically on toggle +
  // reverted on API failure.
  const [savedTalentIds, setSavedTalentIds] = useState(() => new Set());
  const [savedMusicIds, setSavedMusicIds] = useState(() => new Set());
  // ─── Refs mirror the latest Set so the toggle handlers can read
  // the freshest state inside the SAME render cycle (the closure
  // `savedTalentIds.has(id)` would otherwise see a stale value if
  // the user fires two rapid clicks before React has applied the
  // first setState). The refs are kept in sync via a useEffect
  // that fires after every render. This is the canonical
  // "callback needs latest state" pattern — see the
  // https://react.dev/reference/react/useRef#caveats section.
  const savedTalentIdsRef = useRef(savedTalentIds);
  const savedMusicIdsRef = useRef(savedMusicIds);
  useEffect(() => { savedTalentIdsRef.current = savedTalentIds; }, [savedTalentIds]);
  useEffect(() => { savedMusicIdsRef.current = savedMusicIds; }, [savedMusicIds]);
  // ``showToastRef`` keeps a stable ref to the latest ``showToast``
  // so the catalog-useEffect doesn't have ``showToast`` as a dep —
  // avoiding re-fetches when App.jsx re-renders (which creates a new
  // ``showToast`` on every render without useCallback). The ref
  // ensures the catch handler and error-toast use the freshest
  // function without triggering the effect.
  const showToastRef = useRef(showToast);
  useEffect(() => { showToastRef.current = showToast; }, [showToast]);
  // Phase 37 — the active search query captured in a ref so the
  // card_click handlers (stable useCallback closures) can attach
  // SEARCH_RESULT_CLICK metadata without re-creating on every keystroke.
  // ``clickMeta`` reads the ref at push time, so even a first-render
  // closure sees the freshest query (spec §24: a click that follows a
  // query is a stronger interest signal than an organic browse click).
  const searchQueryRef = useRef('');
  const clickMeta = () => (searchQueryRef.current
    ? { metadata: { query: searchQueryRef.current } }
    : {});

  // Phase 22 — Wrapper callbacks that log card_click interactions
  // BEFORE delegating to the original sheet-open handlers. This
  // avoids the scope issue where MusicCard/TalentCard (module-level
  // components) can't access interactionBatchRef (Explore closure).
  const handleLogAndOpenMusic = useCallback((track) => {
    interactionBatchRef.current.push({ item_type: 'music', item_id: track.id, action: 'card_click', ...clickMeta() });
    scheduleFlush();
    onOpenMusicSheet?.(track);
  }, [onOpenMusicSheet]);
  const handleLogAndOpenTalent = useCallback((talent) => {
    interactionBatchRef.current.push({ item_type: 'talent', item_id: talent.id, action: 'card_click', ...clickMeta() });
    scheduleFlush();
    onOpenTalentSheet?.(talent);
  }, [onOpenTalentSheet]);
  const handleLogAndOpenCourse = useCallback((course) => {
    interactionBatchRef.current.push({ item_type: 'course', item_id: course.id, action: 'card_click', ...clickMeta() });
    scheduleFlush();
    onOpenCourse?.(course);
  }, [onOpenCourse]);

  // Phase 32 — Product card click: log interaction + navigate to detail.
  const handleLogAndOpenProduct = useCallback((product) => {
    interactionBatchRef.current.push({ item_type: 'product', item_id: product.id, action: 'card_click', ...clickMeta() });
    scheduleFlush();
    onOpenProduct?.(product);
  }, [onOpenProduct]);

  // Phase 26 — Portfolio card click: log interaction + navigate to detail.
  const handleLogAndOpenPortfolio = useCallback((project) => {
    interactionBatchRef.current.push({ item_type: 'portfolio', item_id: project.id, action: 'card_click', ...clickMeta() });
    scheduleFlush();
    onOpenPortfolio?.(project);
  }, [onOpenPortfolio]);

  // Phase 47 — Spotlight card click: log interaction + navigate to the
  // canonical /{id}@{user}/spotlight deep-link.
  const navigate = useSafeNavigate();
  const handleLogAndOpenSpotlight = useCallback((spotlightItem) => {
    interactionBatchRef.current.push({ item_type: 'spotlight', item_id: spotlightItem.id, action: 'card_click', ...clickMeta() });
    scheduleFlush();
    if (spotlightItem?.id) {
      startTransition(() => {
        navigate(buildContentUrl('spotlight', spotlightItem), { state: { spotlight: spotlightItem } });
      });
    }
  }, [navigate]);

  // Phase 24 — Community card click: navigate via the canonical
  // /{slug}@{user}/community deep-link. CommunityKeyRoute resolves the
  // slug and redirects (replace) to the tabbed /sheet/community/:slug
  // page, so every category now shares the id@user/content URL shape.
  // The payload rides along in location.state so the redirect hops to
  // the canonical page without an extra fetch on the common path.
  const handleOpenCommunity = useCallback((community) => {
    if (community?.slug || community?.id) {
      startTransition(() => {
        navigate(buildContentUrl('community', community), { state: { community } });
      });
    }
  }, [navigate]);

  // ── Found a community ──────────────────────────────────────────────
  // Eligibility is server-owned (creators with published content).
  // Clicking the CTA probes ``can_create`` first so ineligible users
  // get an explanatory toast instead of a modal they can't submit;
  // the modal itself is a defensive double-check against races.
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const handleFoundCommunityClick = useCallback(async () => {
    if (!user) {
      showToast?.(t?.community_login_required || (lang === 'ht'
        ? 'Konekte pou w ka fonde yon kominote.'
        : 'Log in to found a community.'), 'circle-exclamation');
      return;
    }
    try {
      const res = await communitiesService.canCreate();
      const data = res?.data?.data ?? res?.data ?? {};
      if (data?.can_create) {
        setShowCreateCommunity(true);
      } else {
        showToast?.(t?.community_create_gated || (lang === 'ht'
          ? 'Sèlman kreyatè ki gen kontni pibliye ka fonde kominote. Pibliye yon kou, yon pwodwi, oswa yon mizik anvan.'
          : 'Only creators with published content can found a community. Publish a course, product, or music first.'), 'circle-exclamation');
      }
    } catch {
      // Network/other failure — let the modal open; the server re-checks
      // on submit, so nothing insecure happens from a stale probe.
      setShowCreateCommunity(true);
    }
  }, [user, lang, t, showToast]);

  const handleCommunityCreated = useCallback((community) => {
    setShowCreateCommunity(false);
    if (community?.slug || community?.id) {
      // Prepend optimistically, then navigate to the new community.
      setApiCommunities((prev) => [community, ...prev]);
      startTransition(() => {
        navigate(buildContentUrl('community', community), { state: { community } });
      });
    }
  }, [navigate]);

  // "You May Want to Follow" rail — creator suggestion → public profile.
  const handleOpenCreatorProfile = useCallback((creator) => {
    const username = creator?.username || creator?.slug;
    if (username) {
      startTransition(() => {
        navigate(`/c/${username}`, { state: { creator } });
      });
    }
  }, [navigate]);

  // After a follow toggle in the suggestion card, refetch the feed so
  // just-followed creators drop out of the next rail automatically.
  const [creatorFollowRefresh, setCreatorFollowRefresh] = useState(0);
  const handleCreatorFollowed = useCallback(() => {
    setCreatorFollowRefresh((k) => k + 1);
  }, []);

  // ─── Initial saved-IDs fetch (Phase 19.1) ─────────────────────────
  // Fetches the user's full saved-talent + saved-music lists ONCE
  // (on mount + on user change). We extract the catalog-row PKs
  // into Sets so the cards can check ``savedTalentIds.has(talent.id)``
  // in O(1) instead of doing N round-trips. Errors are silent
  // (empty Set = "nothing saved" — same UX as a fresh user).
  //
  // The Promise.allSettled pattern is the same one Mwen.jsx uses
  // so a partial backend outage doesn't blank the whole list.
  // The ``cancelled`` guard avoids a race where the user signs
  // out mid-fetch: the setState calls fire on an unmounted /
  // stale component which React tolerates but a slow network
  // would still mutate state after the next mount's fresh fetch
  // had already overwritten ours.
  useEffect(() => {
    if (!user) {
      // Anonymous: empty Sets so every card renders the
      // unsaved-state heart. The heart click will fire the
      // ``Sign in to save`` toast via handleToggleSaveTalent
      // (it checks for ``user`` too and shortcuts the API call).
      // React to the identity flip (user → null) by resetting the
      // saved Sets — intentional effect-driven sync, not a cascade.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSavedTalentIds(new Set());
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSavedMusicIds(new Set());
      return undefined;
    }
    let cancelled = false;
    Promise.allSettled([
      savedTalentsService.list().then((r) => (r?.data || []).map((s) => s.talent?.id).filter(Boolean)),
      savedMusicService.list().then((r) => (r?.data || []).map((s) => s.music?.id).filter(Boolean)),
    ]).then(([talentsRes, musicRes]) => {
      if (cancelled) return;
      // UNION-merge: the server's canonical saved-list is unioned
      // into whatever the local Set already holds, so a click that
      // fired during the ~100-500ms the GET was in flight doesn't
      // get clobbered when the response lands. Without this, the
      // user's optimistic add would be silently overwritten by the
      // pre-click server snapshot, and the heart would flip
      // "on → off" right after their tap (reviewer MEDIUM #3).
      //
      // Tradeoff: an optimistic REMOVE during the same window can
      // be temporarily reverted (the server snapshot re-adds the
      // item, since the server still has it saved at fetch time),
      // then corrected by the subsequent remove call. The window
      // is sub-second and self-healing — the alternative (a
      // clobbering ``new Set(serverIds)``) loses optimistic adds,
      // which is the more common + more visible failure mode for
      // a user who is actively saving while the page loads.
      if (talentsRes.status === 'fulfilled') {
        setSavedTalentIds((prev) => {
          const next = new Set(prev);
          for (const id of talentsRes.value) next.add(id);
          return next;
        });
      }
      if (musicRes.status === 'fulfilled') {
        setSavedMusicIds((prev) => {
          const next = new Set(prev);
          for (const id of musicRes.value) next.add(id);
          return next;
        });
      }
    }).catch(() => { /* leave Sets empty on error */ });
    return () => { cancelled = true; };
  }, [user]);

  // ─── Toggle handlers (Phase 19.1) ────────────────────────────────────
  // Optimistic Set update + revert on failure. The same shape
  // exists in Mwen.jsx for the unsave button; the only difference
  // here is the input is the talent/music OBJECT (not the save
  // row) because the cards don't carry the save row's PK — they
  // only have the catalog row's PK. The backend's
  // `?talent_id=` / `?music_id=` query-param shortcuts let us
  // POST/DELETE without looking up the save row first.
  const handleToggleSaveTalent = useCallback((talent) => {
    if (!talent?.id) return;
    if (!user) {
      // Anonymous: don't round-trip the server (would 401). Just
      // show the toast so the user knows what to do.
      showToast?.(t.mwen_signin_required || 'Sign in to save', 'user-lock');
      return;
    }
    const id = talent.id;
    // Read the LATEST Set via the ref (NOT the closure value) so
    // two rapid clicks before the first setState applies both see
    // the freshest state — otherwise both could read ``wasSaved=false``
    // and double-create. The ref is kept in sync with the state
    // by a useEffect above (reviewer HIGH #1).
    const wasSaved = savedTalentIdsRef.current.has(id);
    // Optimistic flip — the heart re-renders immediately, no
    // spinner needed for a sub-100ms endpoint.
    setSavedTalentIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(id);
      else next.add(id);
      return next;
    });
    const promise = wasSaved
      ? savedTalentsService.remove(id)
      : savedTalentsService.create(id);
    promise.catch(() => {
      // Revert so the heart doesn't lie.
      setSavedTalentIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(id);
        else next.delete(id);
        return next;
      });
      showToast?.(t.mwen_unsave_error || 'Could not save. Try again.', 'circle-exclamation');
    });
  }, [user, showToast, t]);

  const handleToggleSaveMusic = useCallback((track) => {
    if (!track?.id) return;
    if (!user) {
      showToast?.(t.mwen_signin_required || 'Sign in to save', 'user-lock');
      return;
    }
    const id = track.id;
    // See handleToggleSaveTalent — same ref-based pattern.
    const wasSaved = savedMusicIdsRef.current.has(id);
    setSavedMusicIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(id);
      else next.add(id);
      return next;
    });
    const promise = wasSaved
      ? savedMusicService.remove(id)
      : savedMusicService.create(id);
    promise.catch(() => {
      setSavedMusicIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(id);
        else next.delete(id);
        return next;
      });
      showToast?.(t.mwen_unsave_error || 'Could not save. Try again.', 'circle-exclamation');
    });
  }, [user, showToast, t]);

  // ─── Fetch on mount + when debounced search / filter change ─────────────
  // We pass ``?q=`` and ``?featured=true`` server-side so scale is fine
  // (Phase 6). Empty results still render skeletons the first paint.
  //
  // ``seqRef`` guards against race: when a user toggles chip or refines
  // search quickly, an older cycle's slow ``/api/courses/`` response can
  // arrive AFTER a newer cycle's fast ``/api/explore/music/`` response
  // — without a seq check, ``setCourses`` would overwrite the newer
  // array with stale data, briefly mis-syncing the FE.
  //
  // Implementation note: we INLINE the seq check inside each .then
  // rather than currying the setter — a curried ``guard(setCourses)``
  // would pass the resolver FUNCTION as the value-arg, which React
  // interprets as an updater function (``(prev) => newValue``) and
  // overwrites every response with ``[]`` (reviewer #1 regression).
  const seqRef = useRef(0);
  // Phase 22 — Interaction tracking: IntersectionObserver on the content
  // area logs card_impression events as cards scroll into view.
  // Debounced batch flush: the observer fires once per card per 50%
  // visibility crossing; we collect in a ref and flush every 2s.
  // The ref is wiped on unmount so no stale interactions leak.
  const interactionBatchRef = useRef([]);
  const interactionTimerRef = useRef(null);
  const flushInteractions = useCallback(() => {
    if (interactionTimerRef.current) {
      clearTimeout(interactionTimerRef.current);
      interactionTimerRef.current = null;
    }
    if (interactionBatchRef.current.length > 0) {
      interactionService.log(interactionBatchRef.current);
      interactionBatchRef.current = [];
    }
  }, []);
  const scheduleFlush = useCallback(() => {
    if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
    interactionTimerRef.current = setTimeout(flushInteractions, 2000);
  }, [flushInteractions]);
  useEffect(() => () => { flushInteractions(); }, [flushInteractions]);

  // Phase 37 — "Pa enterese" (not interested) on recommended rail cards.
  // Logs the negative signal IMMEDIATELY (flush, not the 2s batch) so
  // the backend penalty lands + the per-user rail cache invalidates
  // (spec §17 controls), then removes the card from the local rail. The
  // next rail load will have the item sunk by compute_penalties.
  const dismissRecommended = useCallback((itemType, itemId) => {
    interactionBatchRef.current.push({
      item_type: itemType,
      item_id: itemId,
      action: 'not_interested',
      metadata: { surface: 'recommended_rail' },
    });
    flushInteractions();
    // Drop the localStorage snapshot too — otherwise a user who
    // dismisses an item then revisits within the 5-min TTL hits the
    // zero-request gate and the cache restore re-paints the dismissed
    // card (self-heals on the next real fetch, but avoid the flicker).
    clearExploreCache(user?.id);
    // Remove locally so the card disappears immediately.
    switch (itemType) {
      case 'music': setRecommendedMusic((p) => p.filter((x) => x.id !== itemId)); break;
      case 'talent': setRecommendedTalents((p) => p.filter((x) => x.id !== itemId)); break;
      case 'course': setRecommendedCourses((p) => p.filter((x) => x.id !== itemId)); break;
      case 'event': setRecommendedEvents((p) => p.filter((x) => x.id !== itemId)); break;
      case 'community': setRecommendedCommunities((p) => p.filter((x) => x.id !== itemId)); break;
      case 'job': setRecommendedJobs((p) => p.filter((x) => x.id !== itemId)); break;
      case 'product': setRecommendedProducts((p) => p.filter((x) => x.id !== itemId)); break;
      default: break;
    }
    showToast?.(t.explore_not_interested || 'Nou pap montre sa ankò', 'eye-slash');
  }, [flushInteractions, showToast, t]);

  // Phase 37 — rail retry: bumps a counter that re-fires the
  // recommended fetch effect (deps below include ``recommendedReload``).
  const retryRecommended = useCallback(() => setRecommendedReload((k) => k + 1), []);

  // ─── Restore cached explore data on first mount (instant paint) ──────
  const cacheRestoredRef = useRef(false);
  // Second-visit zero-request gate: decided ONCE at mount (the restore
  // effect below is the only place the snapshot is read for the gate, so
  // StrictMode's guarded second run can't flip it). Revisit with a fresh
  // cache → the mount fetch effects skip the network; first visit or a
  // logged-in user → ref stays false and everything fetches normally.
  // The cache is per-user now, so a fresh-at-mount snapshot necessarily
  // belongs to whoever is mounting — but the gate ALSO compares the
  // mount-time user against the current user so a mid-session login /
  // logout (Explore stays mounted) always falls through and fetches
  // fresh personalized data instead of serving the previous account's
  // cached snapshot.
  const cacheFreshAtMountRef = useRef(false);
  const mountUserIdRef = useRef(user?.id || null);

  useEffect(() => {
    if (cacheRestoredRef.current) return;
    const { data: cached, isFresh } = readExploreCache(user?.id);
    cacheFreshAtMountRef.current = isFresh && Boolean(cached && cached._courses);
    if (cached && cached._courses) {
      // One-shot restore of the localStorage snapshot for instant
      // paint (runs once via cacheRestoredRef). Synchronous setState
      // here is the whole point — hydrate state from the cache before
      // the network responses land, so no skeleton flash on revisits.
      /* eslint-disable react-hooks/set-state-in-effect */
      // Restore all cached data for instant display
      setCourses(cached._courses || []);
      setApiMusic(cached._music || []);
      setApiTalents(cached._talents || []);
      setApiCommunities(cached._communities || []);
      setApiJobs(cached._jobs || []);
      setApiPortfolio(cached._portfolio || []);
      setApiMarketplace(cached._marketplace || []);
      setApiEvents(cached._events || []);
      setApiSpotlight(cached._spotlight || []);
      setApiBusinessSpotlight(cached._businessSpotlight || []);
      setRecommendedMusic(cached._recommendedMusic || []);
      setRecommendedTalents(cached._recommendedTalents || []);
      setRecommendedCourses(cached._recommendedCourses || []);
      setRecommendedEvents(cached._recommendedEvents || []);
      setRecommendedCommunities(cached._recommendedCommunities || []);
      setRecommendedJobs(cached._recommendedJobs || []);
      setRecommendedProducts(cached._recommendedProducts || []);
      // Popularity badges + category options ride along so the gated
      // mount fetch doesn't leave them blank on a cached revisit.
      setSaveCounts(cached._saveCounts || {});
      if (Array.isArray(cached._catOptions)) setCatOptions(cached._catOptions);
      setLoadingSections({
        courses: false, music: false, talents: false, communities: false,
        jobs: false, portfolio: false, marketplace: false, events: false, spotlight: false, businessSpotlight: false,
      });
      /* eslint-enable react-hooks/set-state-in-effect */
      if (cached._recommendedMusic) setLoadingRecommended(false);
    }
    cacheRestoredRef.current = true;
  }, []);

  // ─── Write cache after each fetch cycle completes ────────────────────
  const wroteCacheRef = useRef(false);

  // Reset cache-write gate whenever filter or search changes
  useEffect(() => {
    wroteCacheRef.current = false;
  }, [debouncedSearch, filter]);

  useEffect(() => {
    const allDone = Object.values(loadingSections).every((v) => !v);
    if (allDone && !wroteCacheRef.current) {
      writeExploreCache({
        _courses: courses,
        _music: apiMusic,
        _talents: apiTalents,
        _communities: apiCommunities,
        _jobs: apiJobs,
        _portfolio: apiPortfolio,
        _marketplace: apiMarketplace,
        _events: apiEvents,
        _spotlight: apiSpotlight,
        _businessSpotlight: apiBusinessSpotlight,
        _recommendedMusic: recommendedMusic,
        _recommendedTalents: recommendedTalents,
        _recommendedCourses: recommendedCourses,
        _recommendedEvents: recommendedEvents,
        _recommendedCommunities: recommendedCommunities,
        _recommendedJobs: recommendedJobs,
        _recommendedProducts: recommendedProducts,
        _saveCounts: saveCounts,
        _catOptions: catOptions,
      }, user?.id);
      wroteCacheRef.current = true;
    }
  }, [loadingSections, user?.id, courses, apiMusic, apiTalents, apiCommunities, apiJobs,
      apiPortfolio, apiMarketplace, apiEvents, apiSpotlight,
      recommendedMusic, recommendedTalents, recommendedCourses,
      recommendedEvents, recommendedCommunities, recommendedJobs, recommendedProducts]);

  // ─── Top-up the explore cache with late-arriving data ────────────────
  // The main write fires when every section finishes loading; save-count
  // badges and category options can resolve AFTER that, so a targeted
  // rewrite tops them up (and refreshes the TTL) so a cached revisit
  // restores them too.
  useEffect(() => {
    if (!wroteCacheRef.current) return;
    const { data: cached } = readExploreCache(user?.id);
    if (!cached) return;
    writeExploreCache({ ...cached, _saveCounts: saveCounts, _catOptions: catOptions }, user?.id);
  }, [saveCounts, catOptions, user?.id]);

  // Phase 22 / Faz 3 — Fetch recommended items on mount + user change.
  // Faz 3 (consolidated recommendations): ONE merged call instead of the
  // previous 7 parallel GETs. The backend /api/explore/recommended/all/
  // returns ``{ results: [{ item_type, ...item, _score }], count }`` — we
  // bucket each result back into the per-type states below so the render
  // JSX (which already renders 7 typed rails) stays untouched. We keep the
  // 7 individual service methods available in api.js (they're still used
  // by HomeFeed sections + the DEIE feed), but the Explore rail itself
  // now travels on a single request.
  useEffect(() => {
    // Second-visit zero-request gate (fresh-at-mount cache, any user):
    // the restore effect already painted the recommended rails, so skip
    // the network call and release the spinner. Login/logout mid-session
    // falls through — the mount-time user no longer matches, so the new
    // identity fetches its own personalized data.
    if (cacheFreshAtMountRef.current && mountUserIdRef.current === (user?.id || null)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoadingRecommended(false);
      return;
    }
    let cancelled = false;
    // Async fetch: the synchronous first-statement setState is the same
    // intentional pattern the rest of the codebase uses (see
    // CheckoutModal.jsx / DepositModal.jsx) — reset the rail spinner
    // before the network request starts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingRecommended(true);
    setRecommendedError(null);
    recommendedService.all(30)
      .then((res) => {
        if (cancelled) return;
        const results = Array.isArray(res?.data?.results) ? res.data.results : [];
        const buckets = {
          music: [], talents: [], courses: [],
          events: [], communities: [], jobs: [], products: [],
        };
        for (const item of results) {
          switch (item?.item_type) {
            case 'music': buckets.music.push(item); break;
            case 'talent': buckets.talents.push(item); break;
            case 'course': buckets.courses.push(item); break;
            case 'event': buckets.events.push(item); break;
            case 'community': buckets.communities.push(item); break;
            case 'job': buckets.jobs.push(item); break;
            case 'product': buckets.products.push(item); break;
            default: break;
          }
        }
        setRecommendedMusic(buckets.music.map(normalizeTrack));
        setRecommendedTalents(buckets.talents.map(normalizeTalent));
        setRecommendedCourses(buckets.courses);
        setRecommendedEvents(buckets.events);
        setRecommendedCommunities(buckets.communities);
        setRecommendedJobs(buckets.jobs);
        setRecommendedProducts(buckets.products);
        setLoadingRecommended(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadingRecommended(false);
        const message = err?.response?.data?.detail
          || err?.message
          || t.explore_recommended_error
          || 'Rekòmandasyon pa t ka chaje.';
        setRecommendedError(message);
      });
    return () => { cancelled = true; };
  }, [user, recommendedReload]);

  useEffect(() => {
    const mySeq = ++seqRef.current;

    // ─── Faz 1 (unified search routing) ───────────────────────────
    // When the user types a real query (2+ chars — the backend enforces
    // the same floor), we issue ONE cross-module search request instead
    // of the 9 per-module fetches below. The search endpoint ranks
    // results globally (a high-rank music track can beat a low-rank
    // talent) and we bucket results back into the per-section states so
    // the render layer is untouched. Queries shorter than 2 chars fall
    // through to the normal 9-fetch catalog path.
    const activeQ = q.trim();
    // Phase 37 — capture the active query so subsequent card_click events
    // log as search-result clicks with the query in metadata (spec §24).
    searchQueryRef.current = activeQ.length >= 2 ? activeQ : '';
    if (activeQ.length >= 2) {
      const typesCsv = filterToSearchTypes(filter);
      searchService.search(activeQ, typesCsv)
        .then((res) => {
          if (seqRef.current !== mySeq) return;
          const results = Array.isArray(res?.data?.results) ? res.data.results : [];
          const buckets = groupSearchResults(results);
          setCourses(buckets.courses);
          setApiMusic(buckets.music);
          setApiTalents(buckets.talents);
          setApiCommunities(buckets.communities);
          setApiJobs(buckets.jobs);
          setApiPortfolio(buckets.portfolio);
          setApiMarketplace(buckets.marketplace);
          setApiEvents(buckets.events);
          setLoadErrors({
            courses: null, music: null, talents: null, communities: null,
            jobs: null, portfolio: null, marketplace: null, events: null,
            spotlight: null,
          });
        })
        .catch((err) => {
          if (seqRef.current !== mySeq) return;
          const message = describeFetchError(err, t.explore_load_error || 'Could not search.', lang);
          setCourses([]); setApiMusic([]); setApiTalents([]);
          setApiCommunities([]); setApiJobs([]); setApiPortfolio([]);
          setApiMarketplace([]); setApiEvents([]);
          setLoadErrors((p) => ({
            ...p,
            courses: message, music: message, talents: message,
            communities: message, jobs: message, portfolio: message,
            marketplace: message, events: message,
          }));
        })
        .finally(() => {
          if (seqRef.current === mySeq) {
            setLoadingSections({
              courses: false, music: false, talents: false, communities: false,
              jobs: false, portfolio: false, marketplace: false, events: false,
              spotlight: false,
            });
          }
        });
      return;
    }

    // Second-visit zero-request gate (fresh-at-mount cache, any user):
    // the restore effect already painted every section from localStorage,
    // so skip the 9 parallel catalog fetches — chip views render
    // client-side from the restored data. The search branch ABOVE is
    // exempt (the ranked endpoint must always run). Login/logout
    // mid-session falls through (mount-time user mismatch).
    if (cacheFreshAtMountRef.current && mountUserIdRef.current === (user?.id || null)) return;

    api.get('courses/', {
      params: {
        ...(q ? { q } : {}),
        ...(filter === 'featured' ? { featured: 'true' } : {}),
        // Spec §29 — content vs market: gate the catalog per market.
        // Only sent when a market is explicit (localized URL / stored
        // choice) — never the bare-root default, so detection never
        // silently hides GLOBAL content.
        ...(market ? { market } : {}),
      },
      timeout: 60000,
    })
      .then((res) => {
        if (seqRef.current === mySeq) {
          // /api/courses/ returns a {count, next, previous, results}
          // envelope (T009) — unwrap BOTH the paginated and legacy
          // raw-array shapes like the sibling fetches below. Without
          // this, the courses chip always painted an empty grid while
          // the recommended rail + "Anyen pa jwenn" empty state
          // suggested the catalog had no data.
          setCourses(Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.data?.results)
              ? res.data.results
              : []);
          setLoadErrors((p) => ({ ...p, courses: null }));
        }
      })
      .catch((err) => {
        if (seqRef.current === mySeq) {
          setCourses([]);
          const message = describeFetchError(err, t.explore_load_error || 'Could not load courses.', lang);
          setLoadErrors((p) => ({ ...p, courses: message }));
        }
      })
      .finally(() => {
        if (seqRef.current === mySeq) setLoadingSections((p) => ({ ...p, courses: false }));
      });

    api.get('explore/music/', {
      params: {
        ...(q ? { q } : {}),
        ...(filter === 'featured' ? { featured: 'true' } : {}),
      },
      timeout: 60000,
    })
      .then((r) => {
        if (seqRef.current !== mySeq) return;
        const items = Array.isArray(r?.data)
          ? r.data
          : Array.isArray(r?.data?.results)
          ? r.data.results
          : [];
        setApiMusic(items.map(normalizeTrack));
        setLoadErrors((p) => ({ ...p, music: null }));
      })
      .catch((err) => {
        if (seqRef.current === mySeq) {
          setApiMusic([]);
          const message = describeFetchError(err, t.explore_load_error || 'Could not load music.', lang);
          setLoadErrors((p) => ({ ...p, music: message }));
        }
      })
      .finally(() => {
        if (seqRef.current === mySeq) setLoadingSections((p) => ({ ...p, music: false }));
      });

    api.get('explore/talents/', {
      params: {
        ...(q ? { q } : {}),
        ...(filter === 'featured' ? { featured: 'true' } : {}),
      },
      timeout: 60000,
    })
      .then((r) => {
        if (seqRef.current !== mySeq) return;
        const items = Array.isArray(r?.data)
          ? r.data
          : Array.isArray(r?.data?.results)
          ? r.data.results
          : [];
        setApiTalents(items.map(normalizeTalent));
        setLoadErrors((p) => ({ ...p, talents: null }));
      })
      .catch((err) => {
        if (seqRef.current === mySeq) {
          setApiTalents([]);
          const message = describeFetchError(err, t.explore_load_error || 'Could not load talents.', lang);
          setLoadErrors((p) => ({ ...p, talents: message }));
        }
      })
      .finally(() => {
        if (seqRef.current === mySeq) setLoadingSections((p) => ({ ...p, talents: false }));
      });

    // Phase 24 — Communities fetch.
    communitiesService.list(q ? { q } : undefined).then((r) => {
        if (seqRef.current !== mySeq) return;
        const items = Array.isArray(r?.data) ? r.data : Array.isArray(r?.data?.results) ? r.data.results : [];
        setApiCommunities(items);
        setLoadErrors((p) => ({ ...p, communities: null }));
    }).catch((err) => {
        if (seqRef.current === mySeq) {
            setApiCommunities([]);
            const message = describeFetchError(err, t.explore_load_error || 'Could not load communities.', lang);
            setLoadErrors((p) => ({ ...p, communities: message }));
        }
    }).finally(() => {
        if (seqRef.current === mySeq) setLoadingSections((p) => ({ ...p, communities: false }));
    });

    // Phase 25 — Jobs fetch.
    jobService.list(q ? { q, status: 'published' } : { status: 'published' }).then((r) => {
        if (seqRef.current !== mySeq) return;
        const items = Array.isArray(r?.data) ? r.data : Array.isArray(r?.data?.results) ? r.data.results : [];
        setApiJobs(items);
        setLoadErrors((p) => ({ ...p, jobs: null }));
    }).catch((err) => {
        if (seqRef.current === mySeq) {
            setApiJobs([]);
            const message = describeFetchError(err, t.explore_load_error || 'Could not load jobs.', lang);
            setLoadErrors((p) => ({ ...p, jobs: message }));
        }
    }).finally(() => {
        if (seqRef.current === mySeq) setLoadingSections((p) => ({ ...p, jobs: false }));
    });

    // Phase 26 — Portfolio fetch.
    portfolioService.list(q ? { q } : undefined).then((r) => {
        if (seqRef.current !== mySeq) return;
        const items = Array.isArray(r?.data) ? r.data : Array.isArray(r?.data?.results) ? r.data.results : [];
        setApiPortfolio(items);
        setLoadErrors((p) => ({ ...p, portfolio: null }));
    }).catch((err) => {
        if (seqRef.current === mySeq) {
            setApiPortfolio([]);
            const message = describeFetchError(err, t.explore_load_error || 'Could not load portfolio.', lang);
            setLoadErrors((p) => ({ ...p, portfolio: message }));
        }
    }).finally(() => {
        if (seqRef.current === mySeq) setLoadingSections((p) => ({ ...p, portfolio: false }));
    });

    // Phase 32 — Marketplace products fetch.
    // §29 — same market gating as courses (backend ProductViewSet
    // accepts ?market=; empty = GLOBAL catalog).
    marketplaceService.list({ ...(q ? { q } : {}), ...(market ? { market } : {}) }).then((r) => {
        if (seqRef.current !== mySeq) return;
        const items = Array.isArray(r?.data) ? r.data : Array.isArray(r?.data?.results) ? r.data.results : [];
        setApiMarketplace(items);
        setLoadErrors((p) => ({ ...p, marketplace: null }));
    }).catch((err) => {
        if (seqRef.current === mySeq) {
            setApiMarketplace([]);
            const message = describeFetchError(err, t.explore_load_error || 'Could not load marketplace.', lang);
            setLoadErrors((p) => ({ ...p, marketplace: message }));
        }
    }).finally(() => {
        if (seqRef.current === mySeq) setLoadingSections((p) => ({ ...p, marketplace: false }));
    });

    // Phase 34 — Events fetch (upcoming across all communities).
    eventsService.upcoming({ limit: 20 }).then((r) => {
        if (seqRef.current !== mySeq) return;
        const items = Array.isArray(r?.data) ? r.data : Array.isArray(r?.data?.results) ? r.data.results : [];
        setApiEvents(items);
        setLoadErrors((p) => ({ ...p, events: null }));
    }).catch((err) => {
        if (seqRef.current === mySeq) {
            setApiEvents([]);
            const message = describeFetchError(err, t.explore_load_error || 'Could not load events.', lang);
            setLoadErrors((p) => ({ ...p, events: message }));
        }
    }).finally(() => {
        if (seqRef.current === mySeq) setLoadingSections((p) => ({ ...p, events: false }));
    });

    // Phase 47 — Spotlight fetch. The BE returns only approved
    // rows so the list is safe to render without a status filter.
    // We re-fire on every catalog refresh (debouncedSearch / filter /
    // lang) so the Spotlight rail stays in sync with the rest of
    // the page; the cost is one tiny list call per refresh, which
    // is acceptable.
    spotlightService.list().then((r) => {
        if (seqRef.current !== mySeq) return;
        const items = Array.isArray(r?.data) ? r.data : Array.isArray(r?.data?.results) ? r.data.results : [];
        setApiSpotlight(items);
        setLoadErrors((p) => ({ ...p, spotlight: null }));
    }).catch((err) => {
        if (seqRef.current === mySeq) {
            setApiSpotlight([]);
            const message = describeFetchError(err, t.explore_load_error || 'Could not load spotlight.', lang);
            setLoadErrors((p) => ({ ...p, spotlight: message }));
        }
    }).finally(() => {
        if (seqRef.current === mySeq) {
            setLoadingSections((p) => ({ ...p, spotlight: false }));
        }
    });
    // Phase Business Spotlight — Fetch Business Spotlight listings.
    // These are Business profiles approved for Spotlight, shown alongside
    // Creator Spotlights in the Spotlight section.
    businessSpotlightService.list().then((r) => {
        if (seqRef.current !== mySeq) return;
        const items = Array.isArray(r?.data) ? r.data : Array.isArray(r?.data?.results) ? r.data.results : [];
        setApiBusinessSpotlight(items);
        setLoadErrors((p) => ({ ...p, businessSpotlight: null }));
    }).catch((err) => {
        if (seqRef.current === mySeq) {
            setApiBusinessSpotlight([]);
            const message = describeFetchError(err, t.explore_load_error || 'Could not load business spotlight.', lang);
            setLoadErrors((p) => ({ ...p, businessSpotlight: message }));
        }
    }).finally(() => {
        if (seqRef.current === mySeq) {
            setLoadingSections((p) => ({ ...p, businessSpotlight: false }));
        }
    });
    // Phase 19.2 — deps use ``lang`` (a primitive, stable comparison)
    // instead of ``showToast`` (which used to be here but caused
    // an infinite re-fetch loop: App re-render → new showToast ref
    // → effect re-fires → N× requests → Vite proxy drops → Network
    // Error → error-toast → App re-render → loop). ``showToastRef``
    // keeps the latest fn without being a dep.
    //
    // Phase 32.1 — ``user?.id`` (a primitive: number/string) is in
    // the dep array so the catalog re-fetches when the user identity
    // CHANGES (login/logout). Previously the effect was identity-blind:
    // a freshly-authenticated user could see the anonymous-fetched
    // catalog state, but if the recommended rail took the user's
    // attention away from the marketplace section, the user would
    // report it as "missing" — re-fetching on identity change forces
    // a fresh state read so the section always shows the current
    // user's catalog. Using ``user?.id`` (a primitive) avoids the
    // infinite-loop risk of using the full ``user`` object (whose
    // reference changes on every parent re-render).
  }, [debouncedSearch, filter, lang, market, t.explore_load_error, user?.id]);

  // ─── Save-count popularity badges (Phase 61) ─────────────────────
  // ONE batch request per content type (public /counts/ endpoint) so
  // a section of N cards never fires N requests. Re-fires when a
  // section's data set changes (fresh load / search / cache restore);
  // the signature ref skips redundant refetches for identical id
  // sets. Failures are silent — cards simply render without a badge.
  const saveCountsSigRef = useRef({});
  useEffect(() => {
    // Second-visit zero-request gate (fresh-at-mount cache, any user):
    // the restored badges (_saveCounts) already cover the restored items,
    // so skip the counts fetch. On the FIRST visit the ref is false (no
    // cache at mount) so badges load normally regardless of when the
    // cache gets written.
    if (cacheFreshAtMountRef.current && mountUserIdRef.current === (user?.id || null)) return;
    const sections = {
      music: apiMusic,
      talent: apiTalents,
      course: courses,
      job: apiJobs,
      portfolio: apiPortfolio,
      product: apiMarketplace,
      event: apiEvents,
      spotlight: apiSpotlight,
    };
    // Only fetch popularity badges for sections the CURRENT chip
    // actually renders (see VISIBLE_COUNT_TYPES). ``filter`` is a dep
    // so switching chips (music → all) fetches the newly-visible
    // types; already-fetched types are skipped by the signature guard.
    const visibleTypes = VISIBLE_COUNT_TYPES[filter] || [];
    Object.entries(sections).forEach(([type, items]) => {
      if (!visibleTypes.includes(type)) return;
      if (!Array.isArray(items) || items.length === 0) return;
      const ids = items.map((it) => it?.id).filter((v) => Number.isFinite(Number(v)));
      if (ids.length === 0) return;
      const sig = ids.join(',');
      if (saveCountsSigRef.current[type] === sig) return;
      saveCountsSigRef.current[type] = sig;
      savedItemService.counts(type, ids)
        .then((counts) => {
          // Only apply when this is still the freshest request for
          // the type — a slower earlier response (search A) must not
          // overwrite a newer one (search B) with stale counts.
          if (saveCountsSigRef.current[type] !== sig) return;
          setSaveCounts((prev) => ({ ...prev, [type]: counts }));
        })
        .catch(() => {
          // Clear the guard so a later data change retries the fetch
          // (badges are non-critical — a silent miss is fine).
          if (saveCountsSigRef.current[type] === sig) delete saveCountsSigRef.current[type];
        });
    });
  }, [apiMusic, apiTalents, courses, apiJobs, apiPortfolio, apiMarketplace, apiEvents, apiSpotlight, filter]);

  // ─── Deduped error toast — fires ONE toast per failure batch
  // (not 3 when all endpoints fail). Uses ``showToastRef`` so the
  // effect doesn't re-fire when App.jsx re-renders (the ref keeps
  // the latest stable showToast without being a dep). Resets when
  // all errors clear.
  const lastErrorToastKeyRef = useRef(null);
  useEffect(() => {
    const messages = [loadErrors.courses, loadErrors.music, loadErrors.talents, loadErrors.communities, loadErrors.jobs, loadErrors.portfolio, loadErrors.marketplace, loadErrors.events, loadErrors.spotlight]
      .filter(Boolean);
    if (messages.length === 0) {
      lastErrorToastKeyRef.current = null;
      return;
    }
    const errorKey = messages.join('|');
    if (lastErrorToastKeyRef.current === errorKey) return;
    lastErrorToastKeyRef.current = errorKey;
    showToastRef.current?.(messages[0], 'circle-exclamation');
  }, [loadErrors.courses, loadErrors.music, loadErrors.talents, loadErrors.communities, loadErrors.jobs, loadErrors.portfolio, loadErrors.marketplace, loadErrors.events]);

  // ─── Filter derivations ────────────────────────────────────────────────
  const q = search.trim().toLowerCase();

  const filteredCourses = useMemo(() => {
    let list = courses;
    if (q) {
      list = list.filter((c) =>
        (c.title || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q)
      );
    }
    if (filter === 'featured') return list.filter((c) => c.is_featured);
    if (catId) {
      const cid = Number(catId);
      list = list.filter((c) => Number(c.category_id) === cid);
    }
    // Language direction — distinct pairs (Kreyòl→English ≠ English→Kreyòl).
    if (courseDir !== 'all') {
      const [src, dst] = courseDir.split('→').map((s) => s.trim());
      list = list.filter((c) =>
        (c.teaching_language || '').toLowerCase() === (src || '').toLowerCase() &&
        (c.learner_language || '').toLowerCase() === (dst || '').toLowerCase()
      );
    }
    if (courseLevel !== 'all') {
      const lvl = courseLevel.toLowerCase();
      list = list.filter((c) => (c.level || c.difficulty || '').toLowerCase() === lvl);
    }
    if (coursePrice === 'free') {
      list = list.filter((c) => Number(c.price) === 0);
    } else if (coursePrice === 'paid') {
      list = list.filter((c) => Number(c.price) > 0);
    }
    if (courseOwner === 'official') {
      list = list.filter((c) => c.owner_type === 'official');
    } else if (courseOwner === 'creator') {
      list = list.filter((c) => c.owner_type !== 'official');
    }
    return list;
  }, [courses, q, filter, catId, courseDir, courseLevel, coursePrice, courseOwner]);

  const filteredMusic = useMemo(() => {
    let list = apiMusic || [];
    if (q) {
      list = list.filter((m) =>
        (m.title || '').toLowerCase().includes(q) ||
        (m.artist || '').toLowerCase().includes(q) ||
        (m.genre || '').toLowerCase().includes(q)
      );
    }
    if (filter === 'featured') return list.filter((m) => m.is_featured);
    if (catId) {
      const cid = Number(catId);
      list = list.filter((m) => Number(m.category_id) === cid);
    }
    return list;
  }, [q, filter, apiMusic, catId]);

  const filteredTalents = useMemo(() => {
    let list = apiTalents || [];
    if (q) {
      list = list.filter((t2) =>
        (t2.name || '').toLowerCase().includes(q) ||
        (t2.role || '').toLowerCase().includes(q) ||
        (t2.skills || []).some((s) => String(s).toLowerCase().includes(q)) ||
        (t2.location || '').toLowerCase().includes(q)
      );
    }
    if (filter === 'featured') return list.filter((t2) => t2.is_featured);
    return list;
  }, [q, filter, apiTalents]);

  const filteredCommunities = useMemo(() => {
    let list = apiCommunities || [];
    if (q) {
      list = list.filter((c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q) ||
        (c.category || '').toLowerCase().includes(q)
      );
    }
    if (catId) {
      const cid = Number(catId);
      list = list.filter((c) => Number(c.category_id) === cid);
    }
    return list;
  }, [q, apiCommunities, catId]);

  const filteredJobs = useMemo(() => {
    let list = apiJobs || [];
    if (q) {
      list = list.filter((j) =>
        (j.title || '').toLowerCase().includes(q) ||
        (j.description || '').toLowerCase().includes(q) ||
        (j.skills_required || []).some((s) => String(s).toLowerCase().includes(q))
      );
    }
    return list;
  }, [q, apiJobs]);

  const filteredPortfolio = useMemo(() => {
    let list = apiPortfolio || [];
    if (q) {
      list = list.filter((p) =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.skills_used || []).some((s) => String(s).toLowerCase().includes(q))
      );
    }
    if (catId) {
      const cid = Number(catId);
      list = list.filter((p) => Number(p.category_id) === cid);
    }
    return list;
  }, [q, apiPortfolio, catId]);

  const filteredMarketplace = useMemo(() => {
    let list = apiMarketplace || [];
    if (q) {
      list = list.filter((p) =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q)
      );
    }
    if (filter === 'featured') return list.filter((p) => p.is_featured);
    if (catId) {
      const cid = Number(catId);
      list = list.filter((p) => Number(p.category_id) === cid);
    }
    return list;
  }, [q, filter, apiMarketplace, catId]);

  const filteredEvents = useMemo(() => {
    let list = apiEvents || [];
    if (q) {
      list = list.filter((e) =>
        (e.title || '').toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        (e.location || '').toLowerCase().includes(q) ||
        (e.community_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [q, apiEvents]);

  // Phase 47 — Spotlight filter derivation. The Spotlight chip is
  // the only filter that explicitly scopes to this list; on "all"
  // we show it too so the curated list surfaces on first paint.
  const filteredSpotlight = useMemo(() => {
    // Combine Creator Spotlight and Business Spotlight
    let creatorList = (apiSpotlight || []).map((s) => ({ ...s, _type: 'creator' }));
    let businessList = (apiBusinessSpotlight || []).map((s) => ({ ...s, _type: 'business' }));
    let list = [...creatorList, ...businessList];
    if (q) {
      list = list.filter((s) =>
        (s.invention_title || s.business_name || '').toLowerCase().includes(q) ||
        (s.invention_description || s.business_description || '').toLowerCase().includes(q) ||
        (s.username || s.business_slug || '').toLowerCase().includes(q) ||
        (s.category || s.business_category || '').toLowerCase().includes(q)
      );
    }
    if (catId) {
      const cid = Number(catId);
      list = list.filter((s) => Number(s.category_id || s.business_category_id) === cid);
    }
    return list;
  }, [q, apiSpotlight, apiBusinessSpotlight, catId]);

  // ─── Visible sections by chip ──────────────────────────────────────────
  // Phase 14.5 — Featured rail no longer mixes 3 card shapes in one row.
  // We render 3 typed sub-rows under one section label.
  const visibleSections = useMemo(() => {
    switch (filter) {
      case 'courses':
        return { courses: filteredCourses };
      case 'music':
        return { music: filteredMusic };
      case 'talents':
        return { talents: filteredTalents };
      case 'featured':
        return {
          featuredCourses: filteredCourses.filter((c) => c.is_featured).slice(0, 8),
          featuredMusic:   filteredMusic.filter((m) => m.is_featured).slice(0, 8),
          featuredTalents: filteredTalents.filter((t2) => t2.is_featured).slice(0, 6),
        };
      case 'new':
        return {
          newCourses: filteredCourses.slice(0, 5),
          newMusic:   filteredMusic.slice(0, 5),
          newTalents: filteredTalents.filter((t2) => t2.is_new),
        };
      case 'communities':
        return { communities: filteredCommunities };
      case 'jobs':
        return { jobs: filteredJobs };
      case 'portfolio':
        return { portfolio: filteredPortfolio };
      case 'marketplace':
        return { marketplace: filteredMarketplace };
      case 'events':
        return { events: filteredEvents };
      case 'spotlight':
        return { spotlight: filteredSpotlight };
      case 'all':
      default:
        return {
          featuredCourses: filteredCourses.filter((c) => c.is_featured).slice(0, 6),
          featuredMusic:   filteredMusic.filter((m) => m.is_featured).slice(0, 6),
          featuredTalents: filteredTalents.slice(0, 4),
          courses: filteredCourses,
          music: filteredMusic,
          newTalents: filteredTalents.filter((t2) => t2.is_new),
          communities: filteredCommunities.slice(0, 4),
          jobs: filteredJobs.slice(0, 4),
          portfolio: filteredPortfolio.slice(0, 4),
          marketplace: filteredMarketplace.slice(0, 4),
          events: filteredEvents.slice(0, 6),
          // Phase 47 — Surface the curated Spotlight list on the
          // default "Tout" view so the chip isn't required to see
          // it. Capped at 8 to avoid overwhelming the first paint
          // — the Spotlight chip is the deep-dive for the full
          // list. We slice AFTER filtering so the search query
          // still narrows the surface.
          spotlight: filteredSpotlight.slice(0, 8),
        };
    }
  }, [filter, filteredCourses, filteredMusic, filteredTalents, filteredCommunities, filteredJobs, filteredPortfolio, filteredMarketplace, filteredEvents, filteredSpotlight]);

  const totalItems =
    (visibleSections.featuredCourses?.length || 0) +
    (visibleSections.featuredMusic?.length || 0) +
    (visibleSections.featuredTalents?.length || 0) +
    (visibleSections.courses?.length || 0) +
    (visibleSections.music?.length || 0) +
    (visibleSections.talents?.length || 0) +
    (visibleSections.newCourses?.length || 0) +
    (visibleSections.newMusic?.length || 0) +
    (visibleSections.newTalents?.length || 0) +
    (visibleSections.communities?.length || 0) +
    (visibleSections.jobs?.length || 0) +
    (visibleSections.portfolio?.length || 0) +
    (visibleSections.marketplace?.length || 0) +
    (visibleSections.events?.length || 0) +
    (visibleSections.spotlight?.length || 0);

  const showEmpty =
    !loadingSections.courses &&
    !loadingSections.music &&
    !loadingSections.talents &&
    !loadingSections.communities &&
    !loadingSections.jobs &&
    !loadingSections.portfolio &&
    !loadingSections.marketplace &&
    !loadingSections.events &&
    !loadingSections.spotlight &&
    totalItems === 0;

  // Phase 19.2 — when ANY section failed to load AND there are no
  // items to display, show the load-error empty state instead of the
  // "Anyen pa jwenn" no-data state. The user gets a "Retry" button
  // that re-runs the same useEffect (via the debouncedSearch +
  // filter deps) by toggling the filter or clearing the search —
  // a real "Retry" would need a separate ref; we re-use the
  // existing clear-filters pattern so the error state clears
  // alongside the data state.
  const loadError = showEmpty && (loadErrors.courses || loadErrors.music || loadErrors.talents || loadErrors.communities || loadErrors.jobs || loadErrors.portfolio || loadErrors.marketplace || loadErrors.events || loadErrors.spotlight);

  // Phase 47 — Spotlight section sub-component. Renders the
  // curated list of approved inventions as a horizontal scroller
  // matching the other sections' visual rhythm. Capped at 8 on
  // the "Tout" view (see the visibleSections case above) so the
  // section stays scannable; the dedicated chip is the deep-dive.
  // Each card uses ``explore-card-spotlight`` so the CSS polish in
  // styles/index.css can scope its glow + lift to this surface.
  // ═══ Community Vision card (intro / mission statement) ═══
  const renderCommunityVision = () => (
    (filter === 'all' || filter === 'communities') && !q && !useDEIE && (
      <div className="explore-community-vision">
        <div className="explore-vision-badge">
          <i className="fas fa-users" aria-hidden="true" />
          <span>{t.explore_community_vision_title || (lang === 'ht' ? 'Vizyon Kominote' : 'Community Vision')}</span>
        </div>
        <p className="explore-vision-msg">
          {t.explore_community_vision_msg || (lang === 'ht'
            ? 'Kreye espè, pataje konnenans, ak bati ponte nan yon kominote ki pi bon pou tout moun.'
            : 'Create opportunity, share knowledge, and build bridges within a community better for everyone.')}
        </p>
        <div className="explore-vision-actions">
          <button
            type="button"
            className="explore-vision-cta"
            onClick={() => setFilter('communities')}
          >
            <i className="fas fa-arrow-right" aria-hidden="true" />
            <span>{t.explore_community_vision_cta || (lang === 'ht' ? 'Jwenn Kominote' : 'Browse Communities')}</span>
          </button>
          <button
            type="button"
            className="explore-vision-cta explore-vision-cta--create"
            onClick={handleFoundCommunityClick}
          >
            <i className="fas fa-plus" aria-hidden="true" />
            <span>{t.community_create_cta || (lang === 'ht' ? 'Fonde yon Kominote' : 'Found a Community')}</span>
          </button>
        </div>
      </div>
    )
  );

  function renderSpotlightSection() {
    if (!visibleSections.spotlight) return null;
    return (
      <>
        {visibleSections.spotlight.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <SectionLabel icon="fa-lightbulb" count={visibleSections.spotlight.length} accent="spotlight">
                {t.explore_section_spotlight || (lang === 'ht' ? 'Spotlight · Envansyon' : 'Spotlight · Inventions')}
              </SectionLabel>
              <button
                type="button"
                className="explore-see-all-btn"
                onClick={() => setFilter('spotlight')}
                style={{ color: 'var(--color-primary, #d81b60)' }}
              >
                {lang === 'ht' ? 'Wè tout' : 'See all'} <i className="fas fa-arrow-right" aria-hidden="true" />
              </button>
            </div>
            <div className="explore-hscroll">
              {visibleSections.spotlight.map((item) => (
                item._type === 'business' ? (
                  <BusinessSpotlightCard key={`biz-${item.id}`} business={item} />
                ) : (
                  <SpotlightCard key={item.id} item={item} t={t} lang={lang} onOpen={handleLogAndOpenSpotlight} saveCount={saveCounts.spotlight?.[item.id]} />
                )
              ))}
            </div>
          </>
        )}
        {loadingSections.spotlight && visibleSections.spotlight.length === 0 && (filter === 'all' || filter === 'spotlight') && (
          <>
            <SectionLabel icon="fa-lightbulb" accent="spotlight">
              {t.explore_section_spotlight || (lang === 'ht' ? 'Spotlight · Envansyon' : 'Spotlight · Inventions')}
            </SectionLabel>
            <div className="explore-hscroll">
              {Array.from({ length: 3 }).map((_, i) => <SkeletonCourseCard key={i} />)}
            </div>
          </>
        )}
        {/* Phase 47/48 — Section-local error state: when the
            /api/spotlight/ fetch fails but the rest of the catalog
            loaded fine, show a visible error UX inside the Spotlight
            section instead of silently absorbing the failure (the
            page-wide ``loadError`` PremiumEmpty only fires when ALL
            sections are empty). Same ``explore-empty-error`` shape +
            ``role="alert"`` + ``fa-triangle-exclamation`` the
            catalog outage spec pins, so the contract is consistent
            across both surfaces. */}
        {!loadingSections.spotlight && loadErrors.spotlight && visibleSections.spotlight.length === 0 && (
          <PremiumEmpty
            search={false}
            onClearFilters={clearFilters}
            t={t}
            error={loadErrors.spotlight}
          />
        )}
      </>
    );
  }

  function clearFilters() {
    setSearch('');
    setFilter('all');
  }

  // ─── Phase 22 scoped Recommended rail ───────────────────────────────
  const recTypes = RECOMMENDED_SCOPE[filter];
  const hasAnyRecommended =
    recommendedCourses.length > 0 ||
    recommendedMusic.length > 0 ||
    recommendedTalents.length > 0 ||
    recommendedEvents.length > 0 ||
    recommendedCommunities.length > 0 ||
    recommendedJobs.length > 0 ||
    recommendedProducts.length > 0;
  const showRecommendedRail = recTypes
    ? recTypes.some((type) => {
        switch (type) {
          case 'courses': return recommendedCourses.length > 0;
          case 'music': return recommendedMusic.length > 0;
          case 'talents': return recommendedTalents.length > 0;
          case 'events': return recommendedEvents.length > 0;
          case 'communities': return recommendedCommunities.length > 0;
          case 'jobs': return recommendedJobs.length > 0;
          case 'products': return recommendedProducts.length > 0;
          default: return false;
        }
      })
    : (filter === 'featured' || filter === 'new') && hasAnyRecommended;
  // Skeleton only renders on chips that can actually show a rail.
  const showRecommendedLoading = filter === 'featured' || filter === 'new' || Boolean(recTypes);

  

  // ─── SEO: multilingual meta tags for the Explore page ──────────────
  // English is the primary SEO language (widest crawl coverage); the
  // current UI lang title/description override for localized visitors.
  // Geo-based language is already handled by the App.jsx geo-hint
  // effect which sets the UI lang on first visit.
  const seoTitles = {
    ht: 'Atelnyo — Dekouvèt: Kou, Mizik, Talan, Pwodwi, ak Plis',
    en: 'Atelnyo — Explore: Courses, Music, Talent, Products & More',
    fr: 'Atelnyo — Explorer : Cours, Musique, Talents, Produits & Plus',
    es: 'Atelnyo — Explorar: Cursos, Música, Talento, Productos y Más',
  };
  const seoDescriptions = {
    ht: 'Dekouvri kou, mizik, talan, pwodwi, travay, ak kominote sou Atelnyo. Kreyatè Ayisyen ak Caribbean ki ap pataje konesans ak kreyativite.',
    en: 'Discover courses, music, talent, products, jobs, and communities on Atelnyo. Haitian and Caribbean creators sharing knowledge and creativity.',
    fr: 'Découvrez cours, musique, talents, produits, emplois et communautés sur Atelnyo. Créateurs haïtiens et caribéens partageant savoir et créativité.',
    es: 'Descubre cursos, música, talento, productos, empleos y comunidades en Atelnyo. Creadores haitianos y caribeños compartiendo conocimiento y creatividad.',
  };

  return (
    <>
    <SEOHead
      title={seoTitles[lang] || seoTitles.en}
      description={seoDescriptions[lang] || seoDescriptions.en}
      image="https://atelnyo.site/og-banner-en.svg"
      /* Canonical must match the REAL mount point. Explore renders at
         BOTH /explore and /sheet/explore (plus / for the bare root tab).
         Pointing everything at / made /explore tell Google it was a copy
         of the homepage — GSC reported it as "duplicate without user-
         selected canonical". Self-canonical on the active path. */
      url={pathname === '/' || pathname === '/sheet/explore' ? pathname : '/explore'}
      type="website"
      schema={webSiteSchema()}
      lang={lang}
      locale={market ? `${lang}-${market}` : ''}
      breadcrumbs={[{ label: 'Home', url: '/' }]}
    />
    <main className={classNames('explore-page', hasMounted && 'is-mounted')} onClick={() => { /* close any open popovers */ }}>
      {/* Hero — semantic <header> with <h1> for page heading hierarchy */}
      <header className="explore-hero">
        <h1 className="explore-hero-title">{t.hero_title || 'Atelnyo'}</h1>
        <p className="explore-hero-desc">
          {t.explore_hero_desc || 'Dekouvri kou, mizik, talan, ak plis ankò.'}        </p>
      </header>

      {/* Sticky search — semantic <nav> with role="search" for crawlers */}
      <nav className="explore-search-wrap" role="search" aria-label={lang === 'ht' ? 'Chèche' : 'Search'}>
        <div className="explore-search">
          <i className="fas fa-search explore-search-leading" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.explore_search_placeholder || 'Chèche kou, mizik, talan…'}
            aria-label={t.explore_search_placeholder || 'Search'}
          />
          {search && (
            <button
              type="button"
              className="explore-search-clear"
              onClick={() => setSearch('')}
              aria-label={t.common_close || 'Clear'}
            >
              <i className="fas fa-times" aria-hidden="true" />
            </button>
          )}
        </div>
      </nav>

      {/* Filter chips */}
      <div className="explore-chips" role="tablist" aria-label={t.explore_filter_aria || 'Explore filter'}>
        {CHIPS.map((chip) => (
          <button
            type="button"
            key={chip.id}
            role="tab"
            aria-selected={filter === chip.id}
            className={classNames('explore-chip', filter === chip.id && 'active')}
            onClick={() => { setFilter(chip.id); if (chip.id === 'all' || chip.id === 'featured' || chip.id === 'new') { window.history.replaceState(null, '', window.location.pathname + window.location.search); window.scrollTo({ top: 0, behavior: 'smooth' }); } else { window.location.hash = `explore-${chip.id}`; } }}
          >
            <i className={`fas ${chip.icon}`} aria-hidden="true" />
            <span>{getChipLabel(chip, lang)}</span>
          </button>
        ))}
      </div>

      {/* Normalized category filter (by ID) — shown on category-capable tabs */}
      {CATEGORY_SCOPE_BY_FILTER[filter] && catOptions.length > 0 && (
        <div className="explore-cat-filter-wrap">
          <label htmlFor="explore-cat-select">
            <i className="fas fa-tags" aria-hidden="true" />
            <span>{t.explore_category_filter || (lang === 'ht' ? 'Kategori' : 'Category')}</span>
          </label>
          <select
            id="explore-cat-select"
            className="explore-cat-filter"
            value={catId}
            onChange={(e) => setCatId(e.target.value)}
            aria-label={t.explore_category_filter || 'Category'}
          >
            <option value="">{t.explore_category_all || (lang === 'ht' ? 'Tout' : 'All')}</option>
            {catOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Content */}
      {/* DEIE toggle — switch between classic HomeFeed and DEIE smart feed */}
      {/* Only show for authenticated users — DEIE feed requires auth */}
      {filter === 'all' && !q && user && (
        <div className="explore-deie-toggle">
          <button
            type="button"
            className={`deie-toggle-btn ${!useDEIE ? 'active' : ''}`}
            onClick={toggleDEIE}
            title={lang === 'ht' ? 'Feed klasik' : 'Classic feed'}
          >
            <i className="fas fa-layer-group" />
            <span>{lang === 'ht' ? 'Klasik' : 'Classic'}</span>
          </button>
          <button
            type="button"
            className={`deie-toggle-btn ${useDEIE ? 'active' : ''}`}
            onClick={toggleDEIE}
            title={lang === 'ht' ? 'Feed entelijan DEIE' : 'DEIE smart feed'}
          >
            <i className="fas fa-brain" />
            <span>{lang === 'ht' ? 'DEIE Entelijan' : 'DEIE Smart'}</span>
          </button>
        </div>
      )}

      {/* Content — HomeFeed (classic engine) or HomeFeed (DEIE smart engine) */}
      <div className="explore-content">
        {filter === 'all' && !q && (
          <TrendingHashtags
            lang={lang}
            limit={8}
            onSearch={(tagKey) => { setFilter('all'); setSearch(tagKey); }}
          />
        )}
        {filter === 'all' && !q && !useDEIE ? (
          <HomeFeed
            lang={lang}
            translations={translations}
            user={user}
            onOpenCourse={handleLogAndOpenCourse}
            onOpenMusicSheet={handleLogAndOpenMusic}
            onOpenTalentSheet={handleLogAndOpenTalent}
            onOpenJobSheet={onOpenJobSheet}
            onOpenProduct={handleLogAndOpenProduct}
            onOpenPortfolio={handleLogAndOpenPortfolio}
            onOpenCheckout={onOpenCheckout}
            showToast={showToast}
            savedMusicIds={savedMusicIds}
            savedTalentIds={savedTalentIds}
            onToggleSaveMusic={handleToggleSaveMusic}
            onToggleSaveTalent={handleToggleSaveTalent}
            onOpenCommunity={handleOpenCommunity}
            onOpenProfile={handleOpenCreatorProfile}
            onFollowed={handleCreatorFollowed}
            refreshSignal={creatorFollowRefresh}
          />
        ) : filter === 'all' && !q && useDEIE ? (
          // DEIE smart feed — same rich card pipeline, backend routes
          // to DEIEFeedService via engine=deie + normalizes the items.
          <HomeFeed
            lang={lang}
            translations={translations}
            user={user}
            useDEIE
            onOpenCourse={handleLogAndOpenCourse}
            onOpenMusicSheet={handleLogAndOpenMusic}
            onOpenTalentSheet={handleLogAndOpenTalent}
            onOpenJobSheet={onOpenJobSheet}
            onOpenProduct={handleLogAndOpenProduct}
            onOpenPortfolio={handleLogAndOpenPortfolio}
            onOpenCheckout={onOpenCheckout}
            showToast={showToast}
            savedMusicIds={savedMusicIds}
            savedTalentIds={savedTalentIds}
            onToggleSaveMusic={handleToggleSaveMusic}
            onToggleSaveTalent={handleToggleSaveTalent}
            onOpenCommunity={handleOpenCommunity}
            onOpenProfile={handleOpenCreatorProfile}
            onFollowed={handleCreatorFollowed}
            refreshSignal={creatorFollowRefresh}
          />
        ) : (
          <>
            {/* Phase 22 — Recommended for You rail (only for specific filter views) */}
            {filter !== 'all' && !loadingRecommended && !recommendedError && showRecommendedRail && (
              <>
                <SectionLabel icon="fa-magic" accent="recommended">
                  {t.explore_recommended || 'Rekòmande pou ou'}
                </SectionLabel>
                {(!recTypes || recTypes.includes('courses')) && recommendedCourses.length > 0 && (
                  <div className="explore-hscroll">
                    {recommendedCourses.map((c) => (
                      <RecommendedRailCard key={`rc-${c.id}`} itemType="course" itemId={c.id} onDismiss={dismissRecommended} t={t}>
                        <CourseCard course={c} onOpen={handleLogAndOpenCourse} lang={lang} t={t} saveCount={saveCounts.course?.[c.id]} user={user} />
                      </RecommendedRailCard>
                    ))}
                  </div>
                )}
                {(!recTypes || recTypes.includes('music')) && recommendedMusic.length > 0 && (
                  <div className="explore-hscroll">
                    {recommendedMusic.map((track) => (
                      <RecommendedRailCard key={`rm-${track.id}`} itemType="music" itemId={track.id} onDismiss={dismissRecommended} t={t}>
                        <MusicCard
                          track={track}
                          onOpen={handleLogAndOpenMusic}
                          showToast={showToast}
                          t={t}
                          isSaved={savedMusicIds.has(track.id)}
                          saveCount={saveCounts.music?.[track.id]}
                          onSaveToggle={handleToggleSaveMusic}
                        />
                      </RecommendedRailCard>
                    ))}
                  </div>
                )}
                {(!recTypes || recTypes.includes('talents')) && recommendedTalents.length > 0 && (
                  <div className="explore-talent-list">
                    {recommendedTalents.map((t2) => (
                      <RecommendedRailCard key={`rt-${t2.id}`} itemType="talent" itemId={t2.id} onDismiss={dismissRecommended} t={t}>
                        <TalentCard
                          talent={t2}
                          onOpenSheet={handleLogAndOpenTalent}
                          showToast={showToast}
                          lang={lang}
                          t={t}
                          isSaved={savedTalentIds.has(t2.id)}
                          saveCount={saveCounts.talent?.[t2.id]}
                          onSaveToggle={handleToggleSaveTalent}
                        />
                      </RecommendedRailCard>
                    ))}
                  </div>
                )}
                {(!recTypes || recTypes.includes('events')) && recommendedEvents.length > 0 && (
                  <div className="explore-event-list">
                    {recommendedEvents.map((ev) => (
                      <RecommendedRailCard key={`rev-${ev.id}`} itemType="event" itemId={ev.id} onDismiss={dismissRecommended} t={t}>
                        <EventCard
                          event={ev}
                          t={t}
                          showToast={showToast}
                          onOpenCheckout={onOpenCheckout}
                          user={user}
                          saveCount={saveCounts.event?.[ev.id]}
                        />
                      </RecommendedRailCard>
                    ))}
                  </div>
                )}
                {(!recTypes || recTypes.includes('communities')) && recommendedCommunities.length > 0 && (
                  <div className="explore-hscroll">
                    {recommendedCommunities.map((c) => (
                      <RecommendedRailCard key={`rcom-${c.id}`} itemType="community" itemId={c.id} onDismiss={dismissRecommended} t={t}>
                        <CommunityCard community={c} onOpen={handleOpenCommunity} t={t} lang={lang} />
                      </RecommendedRailCard>
                    ))}
                  </div>
                )}
                {(!recTypes || recTypes.includes('jobs')) && recommendedJobs.length > 0 && (
                  <div className="explore-hscroll">
                    {recommendedJobs.map((j) => (
                      <RecommendedRailCard key={`rj-${j.id}`} itemType="job" itemId={j.id} onDismiss={dismissRecommended} t={t}>
                        <JobPostCard job={j} t={t} showToast={showToast} onOpenSheet={onOpenJobSheet} saveCount={saveCounts.job?.[j.id]} />
                      </RecommendedRailCard>
                    ))}
                  </div>
                )}
                {(!recTypes || recTypes.includes('products')) && recommendedProducts.length > 0 && (
                  <div className="explore-hscroll">
                    {recommendedProducts.map((p) => (
                      <RecommendedRailCard key={`rp-${p.id}`} itemType="product" itemId={p.id} onDismiss={dismissRecommended} t={t}>
                        <ProductCard product={p} t={t} onOpen={handleLogAndOpenProduct} showToast={showToast} onOpenCheckout={onOpenCheckout} saveCount={saveCounts.product?.[p.id]} />
                      </RecommendedRailCard>
                    ))}
                  </div>
                )}
              </>
            )}
            {filter !== 'all' && !loadingRecommended && recommendedError && showRecommendedLoading && (
              <div className="reco-rail-state reco-rail-error" role="alert">
                <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                <span>{recommendedError}</span>
                <button type="button" className="reco-rail-retry" onClick={retryRecommended}>
                  {t.explore_retry || 'Eseye ankò'}
                </button>
              </div>
            )}
            {filter !== 'all' && !loadingRecommended && !recommendedError && showRecommendedLoading && !showRecommendedRail && (
              <div className="reco-rail-state reco-rail-empty">
                <i className="fa-solid fa-sparkles" aria-hidden="true" />
                <span>{t.explore_recommended_empty || 'Rekòmandasyon ap konstwi — navige kontni an anba a.'}</span>
              </div>
            )}
            {filter !== 'all' && loadingRecommended && showRecommendedLoading && (
              <>
                <SectionLabel icon="fa-magic" accent="recommended">
                  {t.explore_recommended || 'Rekòmande pou ou'}
                </SectionLabel>
                <div className="explore-hscroll">
                  {Array.from({ length: 4 }).map((_, i) => <SkeletonCourseCard key={i} />)}
                </div>
              </>
            )}

            {/* Featured courses */}
            {visibleSections.featuredCourses && visibleSections.featuredCourses.length > 0 && (
              <>
                <SectionLabel icon="fa-graduation-cap" count={visibleSections.featuredCourses.length} accent="courses">
                  {t.explore_section_featured_courses || 'Rekòmande · Kou'}
                </SectionLabel>
                <div className="explore-hscroll">
                  {visibleSections.featuredCourses.map((c) => (
                    <CourseCard key={`fc-${c.id}`} course={c} onOpen={handleLogAndOpenCourse} lang={lang} t={t} saveCount={saveCounts.course?.[c.id]} />
                  ))}
                </div>
              </>
            )}
            {filter === 'featured' && loadingSections.courses && (
              <>
                <SectionLabel icon="fa-graduation-cap" accent="courses">
                  {t.explore_section_featured_courses || 'Rekòmande · Kou'}
                </SectionLabel>
                <div className="explore-hscroll">
                  {Array.from({ length: 4 }).map((_, i) => <SkeletonCourseCard key={i} />)}
                </div>
              </>
            )}

            {/* Featured music */}
            {visibleSections.featuredMusic && visibleSections.featuredMusic.length > 0 && (
              <>
                <SectionLabel icon="fa-music" count={visibleSections.featuredMusic.length} accent="music">
                  {t.explore_section_featured_music || 'Rekòmande · Mizik'}
                </SectionLabel>
                <div className="explore-hscroll">
                  {visibleSections.featuredMusic.map((m) => (
                    <MusicCard
                      key={`fm-${m.id}`}
                      track={m}
                      onOpen={handleLogAndOpenMusic}
                      showToast={showToast}
                      t={t}                        isSaved={savedMusicIds.has(m.id)}
                        saveCount={saveCounts.music?.[m.id]}
                        onSaveToggle={handleToggleSaveMusic}
                    />
                  ))}
                </div>
              </>
            )}
            {filter === 'featured' && loadingSections.music && (
              <>
                <SectionLabel icon="fa-music" accent="music">
                  {t.explore_section_featured_music || 'Rekòmande · Mizik'}
                </SectionLabel>
                <div className="explore-hscroll">
                  {Array.from({ length: 4 }).map((_, i) => <SkeletonMusicCard key={i} />)}
                </div>
              </>
            )}

            {/* Featured talents */}
            {visibleSections.featuredTalents && visibleSections.featuredTalents.length > 0 && (
              <>
                <SectionLabel icon="fa-star" count={visibleSections.featuredTalents.length} accent="talents">
                  {t.explore_section_featured_talents || 'Rekòmande · Talan'}
                </SectionLabel>
                <div className="explore-talent-list">
                  {visibleSections.featuredTalents.map((t2) => (
                    <TalentCard
                      key={`ft-${t2.id}`}
                      talent={t2}
                      onOpenSheet={handleLogAndOpenTalent}
                      showToast={showToast}
                      lang={lang}
                      t={t}
                      isSaved={savedTalentIds.has(t2.id)}
                      saveCount={saveCounts.talent?.[t2.id]}
                      onSaveToggle={handleToggleSaveTalent}
                    />
                  ))}
                </div>
              </>
            )}
            {filter === 'featured' && loadingSections.talents && (
              <>
                <SectionLabel icon="fa-star" accent="talents">
                  {t.explore_section_featured_talents || 'Rekòmande · Talan'}
                </SectionLabel>
                <div className="explore-talent-list">
                  {Array.from({ length: 3 }).map((_, i) => <SkeletonTalentCard key={i} />)}
                </div>
              </>
            )}

            {/* Per-type sections — <section> with aria-labelledby for SEO */}
            {visibleSections.courses && visibleSections.courses.length > 0 && (
              <section id="explore-courses" aria-labelledby="lbl-courses">
                <SectionLabel icon="fa-graduation-cap" count={visibleSections.courses.length} accent="courses" id="lbl-courses">
                  {t.explore_section_courses || 'Kou'}
                </SectionLabel>
                {filter === 'courses' && (
                  <div className="explore-course-filters">
                    <select
                      className="explore-course-filter"
                      value={courseDir}
                      onChange={(e) => setCourseDir(e.target.value)}
                      aria-label="Language direction"
                    >
                      <option value="all">{lang === 'ht' ? 'Tout lang' : lang === 'fr' ? 'Toutes les langues' : lang === 'es' ? 'Todos los idiomas' : 'All languages'}</option>
                      {COURSE_DIRECTIONS.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                    <select
                      className="explore-course-filter"
                      value={courseLevel}
                      onChange={(e) => setCourseLevel(e.target.value)}
                      aria-label="Level"
                    >
                      <option value="all">{lang === 'ht' ? 'Tout nivo' : lang === 'fr' ? 'Tous les niveaux' : lang === 'es' ? 'Todos los niveles' : 'All levels'}</option>
                      <option value="beginner">{lang === 'ht' ? 'Debitan' : lang === 'fr' ? 'Débutant' : lang === 'es' ? 'Principiante' : 'Beginner'}</option>
                      <option value="intermediate">{lang === 'ht' ? 'Mwayen' : lang === 'fr' ? 'Intermédiaire' : lang === 'es' ? 'Intermedio' : 'Intermediate'}</option>
                      <option value="advanced">{lang === 'ht' ? 'Avanse' : lang === 'fr' ? 'Avancé' : lang === 'es' ? 'Avanzado' : 'Advanced'}</option>
                    </select>
                    <select
                      className="explore-course-filter"
                      value={coursePrice}
                      onChange={(e) => setCoursePrice(e.target.value)}
                      aria-label="Price"
                    >
                      <option value="all">{lang === 'ht' ? 'Tout pri' : lang === 'fr' ? 'Tous les prix' : lang === 'es' ? 'Todos los precios' : 'All prices'}</option>
                      <option value="free">FREE / Gratis</option>
                      <option value="paid">{lang === 'ht' ? 'Peze' : lang === 'fr' ? 'Payant' : lang === 'es' ? 'De pago' : 'Paid'}</option>
                    </select>
                    <select
                      className="explore-course-filter"
                      value={courseOwner}
                      onChange={(e) => setCourseOwner(e.target.value)}
                      aria-label="Source"
                    >
                      <option value="all">{lang === 'ht' ? 'Tout sous' : lang === 'fr' ? 'Toutes les sources' : lang === 'es' ? 'Todas las fuentes' : 'All sources'}</option>
                      <option value="official">Atelnyo Official</option>
                      <option value="creator">{lang === 'ht' ? 'Kreyatè' : lang === 'fr' ? 'Créateurs' : lang === 'es' ? 'Creadores' : 'Creators'}</option>
                    </select>
                    {(courseDir !== 'all' || courseLevel !== 'all' || coursePrice !== 'all' || courseOwner !== 'all') && (
                      <button
                        className="explore-course-filter-reset"
                        onClick={() => {
                          setCourseDir('all');
                          setCourseLevel('all');
                          setCoursePrice('all');
                          setCourseOwner('all');
                        }}
                      >
                        {lang === 'ht' ? 'Retire filtè' : lang === 'fr' ? 'Effacer' : lang === 'es' ? 'Borrar' : 'Clear'}
                      </button>
                    )}
                  </div>
                )}
                <div className="explore-hscroll">
                  {visibleSections.courses.map((course) => (
                    <CourseCard key={course.id} course={course} onOpen={handleLogAndOpenCourse} lang={lang} t={t} saveCount={saveCounts.course?.[course.id]} />
                  ))}
                </div>
              </section>
            )}
            {filter === 'courses' && loadingSections.courses && (
              <>
                <SectionLabel icon="fa-graduation-cap" accent="courses">
                  {t.explore_section_courses || 'Kou'}
                </SectionLabel>
                <div className="explore-hscroll">
                  {Array.from({ length: 4 }).map((_, i) => <SkeletonCourseCard key={i} />)}
                </div>
              </>
            )}

            {visibleSections.music && visibleSections.music.length > 0 && (
              <section id="explore-music" aria-labelledby="lbl-music">
                <SectionLabel icon="fa-music" count={visibleSections.music.length} accent="music" id="lbl-music">
                  {t.explore_section_music || 'Mizik'}
                </SectionLabel>
                <div className="explore-hscroll">
                  {visibleSections.music.map((track) => (
                    <MusicCard
                      key={track.id}
                      track={track}
                      onOpen={handleLogAndOpenMusic}
                      showToast={showToast}
                      t={t}
                      isSaved={savedMusicIds.has(track.id)}
                      saveCount={saveCounts.music?.[track.id]}
                      onSaveToggle={handleToggleSaveMusic}
                    />
                  ))}
                </div>
              </section>
            )}
            {filter === 'music' && loadingSections.music && (
              <>
                <SectionLabel icon="fa-music" accent="music">
                  {t.explore_section_music || 'Mizik'}
                </SectionLabel>
                <div className="explore-hscroll">
                  {Array.from({ length: 4 }).map((_, i) => <SkeletonMusicCard key={i} />)}
                </div>
              </>
            )}

            {/* Talents section (filter 'talents' chip + 'all' view) */}
            {visibleSections.talents && visibleSections.talents.length > 0 && (
              <section id="explore-talents" aria-labelledby="lbl-talents">
                <SectionLabel icon="fa-star" count={visibleSections.talents.length} accent="talents" id="lbl-talents">
                  {t.explore_section_talents || 'Talan'}
                </SectionLabel>
                <div className="explore-talent-list">
                  {visibleSections.talents.map((t2) => (
                    <TalentCard
                      key={`t-${t2.id}`}
                      talent={t2}
                      onOpenSheet={handleLogAndOpenTalent}
                      showToast={showToast}
                      lang={lang}
                      t={t}
                      isSaved={savedTalentIds.has(t2.id)}
                      saveCount={saveCounts.talent?.[t2.id]}
                      onSaveToggle={handleToggleSaveTalent}
                    />
                  ))}
                </div>
              </section>
            )}
            {filter === 'talents' && loadingSections.talents && (
              <>
                <SectionLabel icon="fa-star" accent="talents">
                  {t.explore_section_talents || 'Talan'}
                </SectionLabel>
                <div className="explore-talent-list">
                  {Array.from({ length: 3 }).map((_, i) => <SkeletonTalentCard key={i} />)}
                </div>
              </>
            )}

            {/* New / Nouvo sections (filter 'new' chip) */}
            {filter === 'new' && visibleSections.newCourses && visibleSections.newCourses.length > 0 && (
              <>
                <SectionLabel icon="fa-graduation-cap" count={visibleSections.newCourses.length} accent="courses">
                  {t.explore_section_new_courses || 'Nouvo · Kou'}
                </SectionLabel>
                <div className="explore-hscroll">
                  {visibleSections.newCourses.map((course) => (
                    <CourseCard key={`nc-${course.id}`} course={course} onOpen={handleLogAndOpenCourse} lang={lang} t={t} saveCount={saveCounts.course?.[course.id]} />
                  ))}
                </div>
              </>
            )}
            {filter === 'new' && loadingSections.courses && (
              <>
                <SectionLabel icon="fa-graduation-cap" accent="courses">
                  {t.explore_section_new_courses || 'Nouvo · Kou'}
                </SectionLabel>
                <div className="explore-hscroll">
                  {Array.from({ length: 4 }).map((_, i) => <SkeletonCourseCard key={i} />)}
                </div>
              </>
            )}

            {filter === 'new' && visibleSections.newMusic && visibleSections.newMusic.length > 0 && (
              <>
                <SectionLabel icon="fa-music" count={visibleSections.newMusic.length} accent="music">
                  {t.explore_section_new_music || 'Nouvo · Mizik'}
                </SectionLabel>
                <div className="explore-hscroll">
                  {visibleSections.newMusic.map((track) => (
                    <MusicCard
                      key={`nm-${track.id}`}
                      track={track}
                      onOpen={handleLogAndOpenMusic}
                      showToast={showToast}
                      t={t}
                      isSaved={savedMusicIds.has(track.id)}
                      saveCount={saveCounts.music?.[track.id]}
                      onSaveToggle={handleToggleSaveMusic}
                    />
                  ))}
                </div>
              </>
            )}
            {filter === 'new' && loadingSections.music && (
              <>
                <SectionLabel icon="fa-music" accent="music">
                  {t.explore_section_new_music || 'Nouvo · Mizik'}
                </SectionLabel>
                <div className="explore-hscroll">
                  {Array.from({ length: 4 }).map((_, i) => <SkeletonMusicCard key={i} />)}
                </div>
              </>
            )}

            {filter === 'new' && visibleSections.newTalents && visibleSections.newTalents.length > 0 && (
              <>
                <SectionLabel icon="fa-star" count={visibleSections.newTalents.length} accent="talents">
                  {t.explore_section_new_talents || 'Nouvo · Talan'}
                </SectionLabel>
                <div className="explore-talent-list">
                  {visibleSections.newTalents.map((t2) => (
                    <TalentCard
                      key={`nt-${t2.id}`}
                      talent={t2}
                      onOpenSheet={handleLogAndOpenTalent}
                      showToast={showToast}
                      lang={lang}
                      t={t}
                      isSaved={savedTalentIds.has(t2.id)}
                      saveCount={saveCounts.talent?.[t2.id]}
                      onSaveToggle={handleToggleSaveTalent}
                    />
                  ))}
                </div>
              </>
            )}

{renderCommunityVision()}

            {visibleSections.communities && visibleSections.communities.length > 0 && (
              <section id="explore-communities" aria-labelledby="lbl-communities">
                <SectionLabel icon="fa-users" count={visibleSections.communities.length} accent="communities" id="lbl-communities">
                  {t.explore_section_communities || 'Kominote'}
                </SectionLabel>
                <div className="explore-hscroll">
                  {visibleSections.communities.map((c) => (
                    <CommunityCard key={`com-${c.id}`} community={c} onOpen={handleOpenCommunity} t={t} lang={lang} />
                  ))}
                </div>
              </section>
            )}

            {visibleSections.jobs && visibleSections.jobs.length > 0 && (
              <section id="explore-jobs" aria-labelledby="lbl-jobs">
                <SectionLabel icon="fa-briefcase" count={visibleSections.jobs.length} accent="jobs" id="lbl-jobs">
                  {t.explore_section_jobs || 'Travay'}
                </SectionLabel>
                <div className="explore-hscroll">
                  {visibleSections.jobs.map((j) => (
                    <JobPostCard key={`job-${j.id}`} job={j} t={t} showToast={showToast} onOpenSheet={onOpenJobSheet} saveCount={saveCounts.job?.[j.id]} />
                  ))}
                </div>
              </section>
            )}

            {visibleSections.portfolio && visibleSections.portfolio.length > 0 && (
              <section id="explore-portfolio" aria-labelledby="lbl-portfolio">
                <SectionLabel icon="fa-palette" count={visibleSections.portfolio.length} accent="portfolio" id="lbl-portfolio">
                  {t.explore_section_portfolio || 'Pòtfolyo'}
                </SectionLabel>
                <div className="explore-hscroll">
                  {visibleSections.portfolio.map((p) => (
                    <PortfolioCard key={`pf-${p.id}`} project={p} t={t} showToast={showToast} onOpen={handleLogAndOpenPortfolio} saveCount={saveCounts.portfolio?.[p.id]} />
                  ))}
                </div>
              </section>
            )}

            {visibleSections.marketplace && visibleSections.marketplace.length > 0 && (
              <section id="explore-marketplace" aria-labelledby="lbl-marketplace">
                <SectionLabel icon="fa-shopping-bag" count={visibleSections.marketplace.length} accent="marketplace" id="lbl-marketplace">
                  {t.explore_section_marketplace || 'Mache'}
                </SectionLabel>
                <div className="explore-hscroll">
                  {visibleSections.marketplace.map((p) => (
                    <ProductCard key={`mp-${p.id}`} product={p} t={t} onOpen={handleLogAndOpenProduct} showToast={showToast} onOpenCheckout={onOpenCheckout} saveCount={saveCounts.product?.[p.id]} />
                  ))}
                </div>
              </section>
            )}

            {visibleSections.events && visibleSections.events.length > 0 && (
              <section id="explore-events" aria-labelledby="lbl-events">
                <SectionLabel icon="fa-calendar-alt" count={visibleSections.events.length} accent="events" id="lbl-events">
                  {t.explore_section_events || 'Evènman'}
                </SectionLabel>
                <div className="explore-event-list">
                  {visibleSections.events.map((ev) => (
                    <EventCard
                      key={`ev-${ev.id}`}
                      event={ev}
                      t={t}
                      showToast={showToast}
                      onOpenCheckout={onOpenCheckout}
                      user={user}
                      saveCount={saveCounts.event?.[ev.id]}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Spotlight section */}
            <section id="explore-spotlight" aria-labelledby="lbl-spotlight">
            {renderSpotlightSection()}
            </section>

            {/* Premium empty state */}
            {filter !== 'all' && showEmpty && (
              <PremiumEmpty
                search={search}
                onClearFilters={clearFilters}
                t={t}
                error={loadError}
              />
            )}
          </>
        )}
      </div>
    </main>

    {showCreateCommunity && (
      <CreateCommunityModal
        lang={lang}
        t={t}
        showToast={showToast}
        onClose={() => setShowCreateCommunity(false)}
        onCreated={handleCommunityCreated}
      />
    )}
    </>
  );
}

export default Explore;
