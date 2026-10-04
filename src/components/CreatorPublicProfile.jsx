/**
 * src/components/CreatorPublicProfile.jsx
 *
 * CREATOR BUSINESS HUB — Premium 3-column creator showcase (v4.0).
 *
 * Layout:
 *   Desktop:  [Left Nav Rail] [Main Content] [Right Business Sidebar]
 *   Tablet:   [Left Nav Rail] [Main Content]
 *   Mobile:   [Full-width stack] (no rail, no sidebar)
 *
 * Design inspiration: Stripe Dashboard × Linear × Notion
 * NOT Facebook, NOT LinkedIn, NOT TikTok — unique Atelnyo identity.
 *
 * Every visible component is backed by real API data.
 * Every section auto-hides when empty.
 * Sections are configurable from Creator Studio.
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';

import SEOHead, { profileSchema } from './shared/SEOHead';
import { useParams } from 'react-router-dom';
import useSafeNavigate from '../hooks/useSafeNavigate';
import { buildContentUrl } from '../utils/contentUrl';
import { historyBack } from '../utils/history';
import { translations } from '../data/translations';
import {
  creatorProfileService,
  activityFeedService,
  achievementService,
  communitiesService,
  communityEventsService,
  walletService,
  cachedGet,
} from '../services/api';
import { prefetchOnHover, prefetch } from '../services/prefetch';
import '../styles/public-profile.css';

// ═══════════════════════════════════════════════════════════════════════
// STAGE A-3 — Tier-3 trunk imports (verbatim extractions; Stage A-3.5 wiring).
//   ProfileLeftRail, ProfileHeroCover, ProfileActionBar,
//   ProfileGlassStats (default + AnimatedStat named),
//   ProfilePrivacyBanner, ProfileTabsBar.
// ═══════════════════════════════════════════════════════════════════════
import LeftNavRail from './profile/ProfileLeftRail';
import PremiumHero from './profile/ProfileHeroCover';
import ActionBar from './profile/ProfileActionBar';
import GlassStatsCard from './profile/ProfileGlassStats';
import PrivacyBanner from './profile/ProfilePrivacyBanner';
import TabsBar from './profile/ProfileTabsBar';
import ShareModal from './profile/ProfileShareModal';
import ContactModal from './profile/ProfileContactModal';
import SubscribeModal from './profile/SubscribeModal';

// ═══════════════════════════════════════════════════════════════════════
// STAGE A-1 — Tier-1 leaf imports (extracted 2026-07-24).
//   profileConstants, profileUtils, ProfileM3Section, ProfileSkeleton,
//   ProfileEmpty, ProfileSectionContracts.  All verbatim copies; zero
//   behavior change.  CreatorPublicProfile.jsx keeps composition only.
// ═══════════════════════════════════════════════════════════════════════
import {
  OG_IMAGE_FALLBACK,
  RAIL_ITEMS,
  PROFILE_TABS,
  DEFAULT_SECTION_CONFIG,
  getOrderedTabs,
  isSectionVisible,
  getSectionOrder,
} from './profile/profileConstants';
import { fmtCount, fmtDate, useCountUp } from './profile/profileUtils';
import ProfileM3Section from './profile/ProfileM3Section';
import ProfileSkeleton, { SkeletonSection } from './profile/ProfileSkeleton';
import NotFoundState from './profile/ProfileEmpty';
import {
  AboutCard,
  LanguageCard,
  QuickLinksCard,
  FeaturedProductCard,
  ActivityCard,
  CampaignsCard,
  AffiliateCard,
} from './profile/ProfileSectionContracts';

// ═══════════════════════════════════════════════════════════════════════
// STAGE A-2 — Tier-2 stem imports (extracted 2026-07-24).
//   ProfilePicksTab, ProfileCoursesTab, ProfileProductsTab,
//   ProfilePortfolioTab, ProfileReviewsTab, ProfileAboutTab,
//   ProfileDashboardTab.
import DashboardTab from './profile/ProfileDashboardTab';
import PicksTab from './profile/ProfilePicksTab';
import CoursesTab from './profile/ProfileCoursesTab';
import ProductsTab from './profile/ProfileProductsTab';
import PortfolioTab from './profile/ProfilePortfolioTab';
import TikTokTab from './profile/ProfileTikTokTab'; // C.6 — TikTok showcase (opt-in)
import ReviewsTab from './profile/ProfileReviewsTab';
import AboutTab from './profile/ProfileAboutTab';

// ═══════════════════════════════════════════════════════════════════════
// CREATOR STUDIO CONFIG BAR — visible when editing mode is active
// ═══════════════════════════════════════════════════════════════════════

function ConfigBar({ lang }) {
  return (
    <div className="csp-config-bar" role="status">
      <i className="fas fa-edit" aria-hidden="true" />
      <span>
        {lang === 'ht'
          ? 'Edit profile sections from Creator Studio'
          : 'Edit profile sections from Creator Studio'}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT — Creator Business Hub
// ═══════════════════════════════════════════════════════════════════════

export default function CreatorPublicProfile({
  lang = 'ht',
  showToast,
  currentUserId = null,
  editingMode = false,
  username: propUsername,
  onOpenCheckout,
  overrideProfile = null,
  // The logged-in user (null = anonymous) + a callback that opens the
  // auth modal WITHOUT leaving the profile — used by the follow button
  // so an anonymous visitor can sign in/up and the follow completes
  // automatically, staying on the page.
  user = null,
  onAuthRequired,
}) {
  // overrideProfile — used by the Creator Studio preview modal. When set,
  // the component renders THAT profile snapshot instead of fetching by
  // username, so the creator can preview unsaved edits (avatar, name, bio,
  // cover…) exactly as the public page will look. Tab data (courses,
  // products…) is still fetched for real via the username.
  const { username: paramUsername } = useParams();
  const username = propUsername || paramUsername;
  // username is resolved from: prop > useParams > undefined
  // When rendered from CatchAllRoute (path="*"), useParams() returns
  // empty because the * pattern has no :username param — so propUsername
  // must be passed explicitly. The /creator/:username route works via
  // useParams() alone.
  const navigate = useSafeNavigate();
  const t = translations?.[lang] || translations?.ht || {};

  // ─── State ─────────────────────────────────────────────────────────
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Bumped by the load-error Retry button to re-run the fetch effect
  // (a transient failure must not make a real creator look deleted).
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  // Scroll-aware header: transparent + floating over the cover image
  // at the top, glassy once the visitor scrolls (same pattern as the
  // cd/pd detail headers).
  const [scrolled, setScrolled] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [privacyUpdating, setPrivacyUpdating] = useState(false);
  // Public top-tippers leaderboard (dashboard card) — fetched alongside
  // the rest of the dashboard data, best-effort.
  const [tipLeaders, setTipLeaders] = useState([]);
  // All-time tip totals for the hero stats tile (same API call).
  const [tipTotals, setTipTotals] = useState({ count: 0, amount: 0 });

  // Pending-follow intent: an anonymous visitor clicked Follow → the
  // auth modal opens over the profile; once they sign in, the follow
  // fires automatically (see the user-transition effect below).
  const pendingFollowRef = useRef(false);

  // ─── Contact modal (message / hire / collab — REAL backend calls) ──
  const [contactModal, setContactModal] = useState(null); // { mode, presetSubject } | null

  // ─── Paid subscriptions (Phase 60) ───────────────────────────────
  // subscriptionStatus = { enabled, price, subscriber_count, is_subscribed,
  //                        period_end } from the PUBLIC status endpoint.
  const [subscription, setSubscription] = useState(null);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const fetchSubscriptionStatus = useCallback(async () => {
    if (!username) return;
    try {
      const res = await creatorProfileService.subscriptionStatus(username);
      setSubscription(res?.data || null);
    } catch (_) {
      /* subscriptions disabled / offline — hide the button */
    }
  }, [username]);

  useEffect(() => {
    // Deferral (react-hooks/set-state-in-effect): push the fetch into a
    // microtask so the effect body stays free of synchronous setState
    // (same deferral pattern as the profile fetch below).
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) fetchSubscriptionStatus();
    });
    return () => { cancelled = true; };
  }, [fetchSubscriptionStatus]);

  // ─── Click analytics — best-effort POST to /track-click/ (the same
  // endpoint the backend auto-calls for message/hire/book). Feeds the
  // owner's analytics click_breakdown + engagement trend. Never blocks
  // or toasts; errors are swallowed. Defined early so card + tab clicks
  // below can reuse it.
  const trackClick = useCallback((button) => {
    if (!username) return;
    creatorProfileService.trackClick(username, button).catch(() => {});
  }, [username]);

  // ─── Card click — open the SAME detail page as Explore ─────────
  // Cards navigate to the canonical /{slug}@{user}/{type} deep-link
  // (resolved by ContentKeyRoute → MusicSheet / TalentSheet / JobSheet
  // / CourseDetail / ProductDetail / PortfolioDetail / …), matching
  // Explore's click behavior instead of a stay-on-profile modal.
  const handleOpenItem = useCallback((type, id, data) => {
    if (!data) return;
    // Record the catalog click for the creator's analytics (button key =
    // the content type: course / product / portfolio / talent / music…).
    trackClick(type);
    // Communities are the one type with a tabbed page — ContentKeyRoute
    // resolves the key (slug or pk) and redirects to /sheet/community/:slug.
    navigate(buildContentUrl(type, data));
  }, [navigate, trackClick]);

  // Prefetch content detail on card hover — when the user hovers over a
  // course/product/portfolio card, prefetch the detail data so the
  // navigation is instant. Uses the prefetch utility with 30s dedup.
  const prefetchItem = useCallback((type, data) => {
    if (!data?.id) return;
    const slug = data.slug || data.id;
    prefetch(
      () => cachedGet(`${type === 'course' ? 'courses' : `${type}s`}/${slug}/`, undefined, { ttl: 30_000 }),
      `prefetch:${type}:${slug}`,
    );
  }, []);

  // Tab data
  const [courses, setCourses] = useState([]);
  const [products, setProducts] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [picks, setPicks] = useState({ talents: [], music: [] });
  const [activities, setActivities] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [events, setEvents] = useState([]);
  const [affiliateOffers, setAffiliateOffers] = useState([]);
  // REAL affiliate data — /creator-profiles/<slug>/affiliate-status/ (the
  // old ActionBar gates read profile.affiliate_enabled / campaigns_enabled
  // which never exist in the API payload, so the buttons could never show).
  const [affiliateActive, setAffiliateActive] = useState(false);
  const [viewerIsAffiliate, setViewerIsAffiliate] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [tiktokPosts, setTiktokPosts] = useState(null); // C.6 showcase cache
  const [dashLoading, setDashLoading] = useState(false);

  // Owner detection
  const storedUserId = (() => {
    try {
      const raw = localStorage.getItem('atelnyo_user_id') || localStorage.getItem('proauth_user');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const candidate = parsed?.id ?? parsed?.user_id ?? parsed;
      const num = Number(candidate);
      return Number.isFinite(num) && num > 0 ? num : null;
    } catch { return null; }
  })();
  const effectiveUserId = currentUserId ?? storedUserId;
  const isOwner = !!(effectiveUserId && profile?.user_id && effectiveUserId === profile.user_id);

  // ─── Fetch profile ────────────────────────────────────────────────
  useEffect(() => {
    // Preview mode: the studio passes a snapshot — skip the network fetch
    // entirely (the override effect below hydrates state from it).
    if (overrideProfile) return undefined;
    // Per-run cancellation token. Navigating from one /@creator to another
    // keeps this component MOUNTED (same route), so a shared ref that the
    // next run resets to false lets a stale response overwrite the new
    // profile ("sometimes shows the wrong/default creator"). A closure
    // variable per effect run cancels the OLD run correctly on cleanup.
    let cancelled = false;
    // Defer the synchronous setState into a microtask so the effect body
    // stays free of synchronous setState (react-hooks/set-state-in-effect
    // gate — same deferral pattern as PublicProfileSection).
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      // Reset all catalog/dashboard state when navigating between creators
      // (this effect only re-runs on username change). Without this, /@a → /@b
      // would flash a's courses/products/badges on b's profile while the new
      // fetch is in flight.
      setCourses([]);
      setProducts([]);
      setPortfolio([]);
      setJobs([]);
      setReviews([]);
      setPicks({ talents: [], music: [] });
      setActivities([]);
      setAchievements([]);
      setCommunities([]);
      setEvents([]);
      setCampaigns([]);
      // Affiliate/campaigns data is fetched by the tab-independent effect
      // keyed on profile.user_id — reset it here too so /@a → /@b never
      // flashes creator A's affiliate card / buttons on creator B.
      setAffiliateOffers([]);
      setAffiliateActive(false);
      setViewerIsAffiliate(false);
      if (!username) { setLoading(false); setError('not_found'); return; }
      // One automatic retry for TRANSIENT failures (timeout / network
      // drop / 5xx) so a slow first attempt doesn't bounce the visitor
      // to an error screen — only a real 404 (or a second failure)
      // surfaces the error state. This is what makes "pran twòp tan"
      // cases recover on their own instead of faking a missing creator.
      let retries = 0;
      const attemptFetch = () => {
        if (cancelled) return;
        cachedGet(`creator-profiles/${username}/`, undefined, { ttl: 30_000 })
          .then((res) => {
            if (cancelled) return;
            setProfile(res?.data || null);
            setIsFollowing(res?.data?.is_following || false);
            setFollowersCount(res?.data?.followers_count || 0);
            // Record a REAL view (best-effort). The backend ignores the
            // owner's own visits, so this only bumps the public counter for
            // actual visitors. On success we mirror the server's new count
            // into state so the stats bar reflects THIS visit immediately
            // (no stale-by-one flash). Errors never block the page.
            if (res?.data) {
              creatorProfileService.trackView(username)
                .then((viewRes) => {
                  if (cancelled) return;
                  const next = viewRes?.data?.view_count;
                  if (next != null) {
                    setProfile((p) => (p ? { ...p, view_count: next } : p));
                  }
                })
                .catch(() => {});
            }
            setLoading(false);
          })
          .catch((err) => {
            if (cancelled) return;
            const status = err?.response?.status;
            const transient = !err?.response || err?.code === 'ECONNABORTED' || (status && status >= 500);
            if (transient && retries < 1) {
              retries += 1;
              setTimeout(() => attemptFetch(), 1500);
              return;
            }
            setError(status === 404 ? 'not_found' : 'load_error');
            setLoading(false);
          });
      };
      attemptFetch();
    });
    return () => { cancelled = true; };
  }, [username, overrideProfile, reloadKey]);

  // ─── Preview snapshot hydration ───────────────────────────────────
  // Studio preview: mirror the override snapshot into state so the whole
  // page renders the draft instead of the saved profile.
  useEffect(() => {
    if (!overrideProfile) return undefined;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setProfile(overrideProfile);
      setIsFollowing(!!overrideProfile.is_following);
      setFollowersCount(Number(overrideProfile.followers_count) || 0);
      setLoading(false);
      setError(null);
    });
    return () => { cancelled = true; };
  }, [overrideProfile]);

  // ─── Affiliate + campaigns data (TAB-INDEPENDENT) ─────────────────
  // Program-level data powers the sidebar AffiliateCard/CampaignsCard and
  // the ActionBar affiliate/campaigns buttons, which render on EVERY tab.
  // Fetching it inside the dashboard-only branch would leave those sections
  // empty whenever the user is on any other tab — so it lives here, keyed on
  // profile.user_id, and runs once per profile regardless of active tab.
  useEffect(() => {
    if (!profile?.user_id || !username) return undefined;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      Promise.allSettled([
        // Products also feed the sidebar FeaturedProductCard on every tab
        // (same tab-independence rationale as campaigns/affiliate), so
        // fetch them here instead of the dashboard-only branch.
        // Using cachedGet with 60s TTL — creator products don't change often.
        cachedGet(`creator-profiles/${username}/products/`, undefined, { ttl: 60_000 })
          .then(r => r?.data || []).catch(() => []),
        cachedGet(`creator-profiles/${username}/campaigns/`, undefined, { ttl: 60_000 })
          .then(r => r?.data || []).catch(() => []),
        cachedGet(`creator-profiles/${username}/affiliate-status/`, undefined, { ttl: 60_000 })
          .then(r => r?.data || null).catch(() => null),
      ]).then(([prod, camp, aff]) => {
        if (cancelled) return;
        setProducts(Array.isArray(prod.value) ? prod.value : []);
        // Campaigns API returns name + commission_pct/total_sales; the
        // renderer expects title/budget — normalize once here.
        setCampaigns(
          (Array.isArray(camp.value) ? camp.value : []).map((cm) => ({
            ...cm,
            title: cm.name || cm.title,
            budget: cm.budget != null ? cm.budget : cm.commission_pct,
          })),
        );

        // Affiliate offers — REAL data (previously declared state that
        // was NEVER populated, so the sidebar Affiliate card + dashboard
        // "Affiliate Offers" section could never render). An active
        // program with active campaigns yields one offer card per
        // campaign; an active program with no campaigns yields a single
        // program-card using the default commission rate; inactive
        // program → no offers (section hides).
        const program = aff.value;
        setAffiliateActive(!!program?.is_active);
        setViewerIsAffiliate(!!program?.viewer_is_affiliate);
        const rawCampaigns = Array.isArray(camp.value) ? camp.value : [];
        if (program?.is_active && rawCampaigns.length > 0) {
          setAffiliateOffers(rawCampaigns.map((cm) => ({
            id: cm.id,
            title: cm.name || cm.title || 'Campaign',
            commission: cm.commission_pct != null ? cm.commission_pct : 0,
          })));
        } else if (program?.is_active && program.default_commission_pct != null) {
          setAffiliateOffers([{
            id: 'program',
            title: t.profile_affiliate_offers || 'Affiliate Program',
            commission: program.default_commission_pct,
          }]);
        } else {
          setAffiliateOffers([]);
        }
      });
    });
    return () => { cancelled = true; };
    // `t` is a translations-lookup object (stable per lang); included so the
    // fallback label inside picks up a lang switch. Same pattern as the
    // follow/privacy callbacks below.
  }, [profile?.user_id, username, t]);

  // ─── Fetch tab data ──────────────────────────────────────────────
  useEffect(() => {
    // Per-run cancellation token (same rationale as the profile fetch:
    // the component stays mounted across /@creator navigations, so a
    // shared ref would let the previous creator's tab data overwrite
    // the current one).
    let cancelled = false;
    if (!profile || !username) return;
    const tab = activeTab;

    if (tab === 'dashboard') {
      // Deferral (react-hooks/set-state-in-effect): the dashboard fetches
      // below already resolve asynchronously; push the spinner state into
      // a microtask so the effect body has no synchronous setState.
      Promise.resolve().then(() => {
        if (!cancelled) setDashLoading(true);
      });
      Promise.allSettled([
        cachedGet(`creator-profiles/${username}/courses/`, undefined, { ttl: 60_000 })
          .then(r => r?.data || []).catch(() => []),
        cachedGet(`creator-profiles/${username}/portfolio/`, undefined, { ttl: 60_000 })
          .then(r => r?.data || []).catch(() => []),
        cachedGet(`creator-profiles/${username}/reviews/`, undefined, { ttl: 60_000 })
          .then(r => r?.data || []).catch(() => []),
        // Creator's published jobs — real data from /creator-profiles/<slug>/jobs/
        creatorProfileService.jobs(username).then(r => r?.data || []).catch(() => []),
        creatorProfileService.picks(username).then(r => r?.data || { talents: [], music: [] }).catch(() => ({ talents: [], music: [] })),
        // REAL data for the dashboard's Communities / Events / Campaigns
        // sections (previously declared but never fetched — they stayed
        // empty forever). Each is best-effort: a missing module or a 403
        // resolves to [] and never blocks the rest of the dashboard.
        profile.user_id
          ? communitiesService.list({ created_by: profile.user_id, limit: 6 })
              .then(r => r?.data?.results || r?.data || []).catch(() => [])
          : Promise.resolve([]),
        profile.user_id
          ? communityEventsService.list({ created_by: profile.user_id, limit: 5 })
              .then(r => r?.data?.results || r?.data || []).catch(() => [])
          : Promise.resolve([]),
        profile.user_id
          ? walletService.creatorTipLeaderboard(profile.user_id)
              .then(r => r?.data || {}).catch(() => ({}))
          : Promise.resolve({}),
      ]).then(([c, pf, r, jb, pk, comm, ev, tips]) => {
        if (cancelled) return;
        setCourses(Array.isArray(c.value) ? c.value : []);
        setPortfolio(Array.isArray(pf.value) ? pf.value : []);
        setReviews(Array.isArray(r.value) ? r.value : []);
        setJobs(Array.isArray(jb.value) ? jb.value : []);
        const picksData = pk.value || { talents: [], music: [] };
        setPicks({
          talents: Array.isArray(picksData.talents) ? picksData.talents : [],
          music: Array.isArray(picksData.music) ? picksData.music : [],
        });
        setCommunities(Array.isArray(comm.value) ? comm.value : []);
        // The leaderboard response is { top_tippers, total_received,
        // total_amount } — split it into the dashboard card list and the
        // hero stats tile.
        const tipData = tips.value || {};
        setTipLeaders(Array.isArray(tipData.top_tippers) ? tipData.top_tippers : []);
        setTipTotals({
          count: Number(tipData.total_received) || 0,
          amount: Number(tipData.total_amount) || 0,
        });
        // Events serializer returns start_time; the timeline renderer
        // expects date — normalize here so the card just works.
        setEvents(
          (Array.isArray(ev.value) ? ev.value : []).map((e) => ({
            ...e,
            date: e.start_time || e.date,
          })),
        );
        if (!cancelled) setDashLoading(false);
      });

      // Fetch activities — the feed endpoint returns {events: [...]}, NOT
      // a bare array; read .events first or the section stays empty forever.
      if (profile.user_id) {
        activityFeedService.list(profile.user_id)
          .then(r => {
            if (cancelled) return;
            const data = r?.data?.events || r?.data?.results || r?.data || [];
            setActivities(Array.isArray(data) ? data : []);
          })
          .catch(() => {});
      }
      // Fetch achievements — ALWAYS the profile OWNER's badges via the
      // public /achievements/user/<id>/ endpoint (never the viewer's own).
      if (profile.user_id) {
        achievementService.forUser(profile.user_id)
          .then(r => {
            if (cancelled) return;
            const rows = r?.data?.achievements || r?.data?.results || [];
            setAchievements((Array.isArray(rows) ? rows : []).map((a) => ({
              ...a,
              // Flatten the nested achievement definition so the dashboard
              // renderer can read ach.title directly.
              title: a?.achievement?.name || a?.achievement_key || a?.title,
              description: a?.achievement?.description || a?.description,
              icon: a?.achievement?.icon || a?.icon,
            })));
          })
          .catch(() => {});
      }
    } else if (['picks', 'courses', 'products', 'portfolio', 'reviews', 'tiktok'].includes(tab)) {
      // Single tab fetches. Use a larger page so the public profile actually
      // surfaces the creator's catalog (the API caps each endpoint at 20 by
      // default; ?limit=100 lets the full catalog load per tab). Picks stays
      // intentionally capped at its server-side [:20] (anti-favorite-scrape).
      // Deferral (react-hooks/set-state-in-effect): push the spinner into a
      // microtask; the fetcher itself resolves asynchronously below.
      Promise.resolve().then(() => {
        if (!cancelled) setTabLoading(true);
      });
      const fetcher = ({
        picks: () => creatorProfileService.picks(username),
        courses: () => creatorProfileService.courses(username, { limit: 100 }),
        products: () => creatorProfileService.products(username, { limit: 100 }),
        portfolio: () => creatorProfileService.portfolio(username, { limit: 100 }),
        reviews: () => creatorProfileService.reviews(username, { limit: 100 }),
        tiktok: () => cachedGet(`creator-profiles/${username}/tiktok-posts/`, undefined, { ttl: 60_000 }),
      })[tab];
      if (fetcher) {
        fetcher()
          .then((res) => {
            if (cancelled) return;
            const data = Array.isArray(res?.data) ? res.data
              : (res?.data && typeof res.data === 'object' ? res.data : []);
            if (tab === 'courses') setCourses(data);
            else if (tab === 'products') setProducts(data);
            else if (tab === 'portfolio') setPortfolio(data);
            else if (tab === 'reviews') setReviews(data);
            else if (tab === 'tiktok') setTiktokPosts(Array.isArray(data?.posts) ? data.posts : []);
            else if (tab === 'picks') {
              setPicks({
                talents: Array.isArray(data?.talents) ? data.talents : [],
                music: Array.isArray(data?.music) ? data.music : [],
              });
            }
            if (!cancelled) setTabLoading(false);
          })
          .catch(() => { if (!cancelled) setTabLoading(false); });
      }
    }

    return () => { cancelled = true; };
  }, [profile, username, activeTab]);

  // ─── Follow / Unfollow ────────────────────────────────────────────
  // The actual follow/unfollow API call (optimistic UI + rollback).
  // Used both by the button (logged-in users) and by the after-login
  // effect (anonymous visitor who signed in to follow).
  const performFollow = useCallback(() => {
    if (!profile || isOwner) return;
    setFollowLoading(true);
    const prevFollowing = isFollowing;
    setIsFollowing(!prevFollowing);
    setFollowersCount(c => prevFollowing ? Math.max(0, c - 1) : c + 1);

    creatorProfileService.follow(username)
      .then((res) => {
        setIsFollowing(!!res?.data?.is_following);
        setFollowersCount(Number(res?.data?.followers_count) || followersCount);
        if (res?.data?.is_following && res?.data?.creator_has_affiliate_program) {
          showToast?.(
            lang === 'ht'
              ? 'Ou ap swiv yon kreyatè ki gen pwogram afilye! Tcheke paj Afilye pou aplike.'
              : 'You are now following a creator with an active affiliate program! Check the Affiliate page to apply.',
            'hand-holding-usd',
          );
        } else {
          showToast?.(
            res?.data?.is_following
              ? t.profile_follow_success || 'You are now following!'
              : t.profile_unfollow_success || 'Unfollowed.',
            'check-circle',
          );
        }
      })
      .catch(() => {
        setIsFollowing(prevFollowing);
        setFollowersCount(followersCount);
        showToast?.(t.profile_follow_error || 'Connection error.', 'exclamation-triangle');
      })
      .finally(() => setFollowLoading(false));
  }, [profile, username, lang, showToast, followersCount, isOwner, isFollowing]);

  const handleFollow = useCallback(() => {
    if (!profile || isOwner) return;
    if (!user) {
      // Anonymous visitor: open the auth modal IN PLACE (no redirect —
      // they stay on this profile). Remember the intent so the follow
      // fires automatically once they sign in or sign up.
      pendingFollowRef.current = true;
      onAuthRequired?.();
      return;
    }
    performFollow();
  }, [profile, isOwner, user, performFollow, onAuthRequired]);

  // After an anonymous visitor signs in (user flips to truthy) with a
  // pending follow intent, complete the follow automatically. The user
  // never leaves the profile page — the modal just closes over it.
  useEffect(() => {
    if (user && pendingFollowRef.current) {
      pendingFollowRef.current = false;
      performFollow();
    }
  }, [user, performFollow]);

  // ─── Privacy toggle ──────────────────────────────────────────────
  const handleTogglePicksVisibility = useCallback(async () => {
    if (!profile || !isOwner) return;
    const next = !(profile.show_picks_publicly !== false);
    setPrivacyUpdating(true);
    try {
      await creatorProfileService.setPicksVisibility(username, next);
      setProfile((p) => ({ ...p, show_picks_publicly: next }));
      showToast?.(
        next
          ? (t.profile_picks_public || 'Picks are now public.')
          : (t.profile_picks_private || 'Picks are now private.'),
        'check-circle',
      );
    } catch {
      showToast?.(t.profile_update_error || 'Update failed.', 'exclamation-triangle');
    } finally {
      setPrivacyUpdating(false);
    }
  }, [profile, isOwner, username, lang, showToast]);

  // ─── Share ────────────────────────────────────────────────────────
  // ─── Scroll detection for the floating header ───────────────────
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    handler();
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const handleShare = useCallback(() => {
    // Never share a broken "/@" URL — bail when there is no username.
    if (!username) return;
    const url = `${window.location.origin}/c/${username}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: profile?.display_name || username.toLowerCase(),
        text: profile?.bio || '',
        url,
      }).catch(() => setShowShareModal(true));
    } else {
      setShowShareModal(true);
    }
  }, [username, profile]);

  const handleCopyLink = useCallback(() => {
    if (!username) return;
    const url = `${window.location.origin}/c/${username}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  }, [username]);

  // ─── Header back — history-aware (same pattern as the cd/pd detail
  // pages): a visitor lands here from Explore, a detail page or another
  // profile — send them back where they came from instead of dumping
  // them on '/'. Falls back to '/' only on a direct deep-link (no prior
  // history entry). Uses history.state.idx — history.length is
  // unreliable on fresh tabs (a deep link already has length 2).
  const handleHeaderBack = useCallback(() => historyBack(navigate), [navigate]);

  // ─── Tab switch ──────────────────────────────────────────────────
  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    // Record the tab click for the creator's analytics (button key =
    // the tab id: dashboard / picks / courses / products / …).
    trackClick(`tab_${tabId}`);
    // Remember the active tab per creator so returning from a detail
    // page (browser Back / the detail sheet's back button) restores the
    // profile EXACTLY as the visitor left it — same tab, not a reset to
    // the dashboard. Scroll position is restored by the browser's own
    // session-history scroll restoration.
    if (username) {
      try { sessionStorage.setItem(`csp_tab_${username}`, tabId); } catch { /* private mode */ }
    }
    // Scroll to top of content
    const contentEl = document.getElementById('csp-content-scroll');
    if (contentEl) contentEl.scrollIntoView({ behavior: 'smooth' });
  }, [username, trackClick]);

  // ─── Restore saved tab on mount (after a detail-page round-trip) ──
  useEffect(() => {
    if (!username) return undefined;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        const saved = sessionStorage.getItem(`csp_tab_${username}`);
        if (saved && PROFILE_TABS.some((item) => item.id === saved)) {
          setActiveTab(saved);
        }
      } catch { /* private mode */ }
    });
    return () => { cancelled = true; };
  }, [username]);

  // ─── Content Intelligence SEO data ─────────────────────────────
  const [ciSeo, setCiSeo] = useState(null);
  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    creatorProfileService.getSEO(profile.id)
      .then((res) => {
        if (!cancelled && res?.data?.status === 'ready') setCiSeo(res.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [profile?.id]);

  // ─── Meta tags ────────────────────────────────────────────────────
  // ─── Section Config: derive ordered tabs + section order + visibility ─
  const orderedTabs = useMemo(() => profile ? getOrderedTabs(profile) : PROFILE_TABS, [profile]);
  // sectionOrder is used by the sidebar, not by DashboardTab (which uses DASHBOARD_INTERNAL_ORDER)
  const sectionOrder = useMemo(() => profile ? getSectionOrder(profile) : DEFAULT_SECTION_CONFIG.section_order, [profile]);

  // ─── Tab badges — live catalog counts on the tab bar. Hidden when 0.
  const tabBadges = useMemo(() => ({
    picks: (picks.talents?.length || 0) + (picks.music?.length || 0),
    courses: courses.length || 0,
    products: products.length || 0,
    portfolio: portfolio.length || 0,
    reviews: reviews.length || 0,
  }), [picks, courses, products, portfolio, reviews]);

  const fallbackTitle = t.profile_title_default || 'Creator · Atelnyo';
  let pageTitle = fallbackTitle;
  // The creator's custom SEO title (set in the Public Profile editor)
  // wins; otherwise fall back to the display-name template.
  if (profile?.seo_title) {
    pageTitle = profile.seo_title;
  } else if (profile?.display_name) {
    const template = t.profile_title_template || '{name} · Creator · Atelnyo';
    pageTitle = template.replace('{name}', profile.display_name);
  }
  // Custom SEO description (editor) overrides the bio-derived snippet.
  // When no custom description exists, build a rich snippet from profile data
  // so Google has meaningful content to index (not just an empty tag).
  const descriptionForMeta = (() => {
    if (profile?.seo_description) return profile.seo_description;
    if (profile?.bio) {
      return profile.bio.length > 200 ? profile.bio.slice(0, 197).trimEnd() + '…' : profile.bio;
    }
    // Fallback: build a contextual description from available data
    const parts = [];
    const name = profile?.display_name || profile?.artist_name || username;
    if (name) parts.push(name);
    if (profile?.artist_name && profile.artist_name !== profile?.display_name) parts.push('aka ' + profile.artist_name);
    if (profile?.country) parts.push('from ' + profile.country);
    if (profile?.skills?.length) parts.push('specializing in ' + profile.skills.slice(0, 3).join(', '));
    if (profile?.courses_count > 0) parts.push(profile.courses_count + ' course' + (profile.courses_count > 1 ? 's' : ''));
    if (profile?.products_count > 0) parts.push(profile.products_count + ' product' + (profile.products_count > 1 ? 's' : ''));
    return parts.length > 0 ? parts.join(' — ') + ' on Atelnyo.' : '';
  })();
  // og:url stays the bare /@username deep-link so shares across all
  // localized versions aggregate on ONE object. The canonical, however,
  // must be the URL the crawler is actually on (spec §17 — each
  // localized page canonicalizes to itself, never to the bare URL).
  const ogUrl = `${window.location.origin}/c/${username || ''}`;
  // Always use @ in canonical — even if Cloudflare redirected to %40.
  // Crawlers must see the clean /@username URL as canonical.
  const canonicalUrl = `${window.location.origin}/c/${username || ''}`;


  // ─── Render branches ─────────────────────────────────────────────
  if (loading) return <ProfileSkeleton />;
  if (error === 'not_found' || error === 'load_error' || !profile) {
    // A real 404 (hidden/suspended/missing) says "does not exist"; a
    // transient load failure says "couldn't load" + Retry so a flaky
    // connection never makes a valid creator look deleted.
    //
    // BUG FIX: when !profile but no error is set (e.g. the fetch returned
    // null data or the cache served a stale null), treat it as a load error
    // WITH a retry button instead of a permanent "not found" — the creator
    // may still exist on the server.
    const isNotFound = error === 'not_found' && profile == null && !loading;
    const canRetry = error === 'load_error' || (!isNotFound && !loading);
    // Logged-in creators see a "Create Public Profile" CTA on their own
    // 404 page — they can't see a profile because they haven't created
    // one yet.  The button navigates to Creator Studio → Public Profile
    // section where ``handleCreateProfile`` POSTs to /me/ to bootstrap
    // the profile row.
    const canCreate = isNotFound && user?.is_creator;
    return (
      <NotFoundState
        lang={lang}
        mode={isNotFound ? 'not_found' : 'load_error'}
        onBack={() => navigate('/')}
        onRetry={canRetry ? () => setReloadKey((k) => k + 1) : undefined}
        onCreateProfile={canCreate ? () => navigate('/sheet/studio?section=public_profile') : undefined}
      />
    );
  }

  const picksCount = (picks.talents?.length || 0) + (picks.music?.length || 0);
  const showPicksPublicly = profile.show_picks_publicly !== false;

  // Determine tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (          <DashboardTab
            profile={profile}
            lang={lang}
            t={t}
            activities={isOwner ? activities : []}
            courses={courses}
            products={products}
            portfolio={portfolio}
            jobs={jobs}
            picks={picks}
            achievements={achievements}
            reviews={reviews}
            communities={communities}
            events={events}
            affiliateOffers={affiliateOffers}
            campaigns={campaigns}
            tipLeaders={tipLeaders}
            onItemClick={handleOpenItem}
            onViewAll={handleTabChange}
          />
        );
      case 'picks':
        return <PicksTab picks={picks} loading={tabLoading} lang={lang} onItemClick={handleOpenItem} />;
      case 'courses':
        return <CoursesTab courses={courses} loading={tabLoading} lang={lang} onItemClick={handleOpenItem} />;
      case 'products':
        return <ProductsTab products={products} loading={tabLoading} lang={lang} onItemClick={handleOpenItem} />;
      case 'portfolio':
        return <PortfolioTab portfolio={portfolio} loading={tabLoading} lang={lang} onItemClick={handleOpenItem} />;
      case 'tiktok':
        return <TikTokTab posts={tiktokPosts || []} loading={tabLoading} lang={lang} />;
      case 'reviews':
        return <ReviewsTab reviews={reviews} loading={tabLoading} lang={lang} />;
      case 'about':
        return <AboutTab profile={profile} lang={lang} t={t} isOwner={isOwner} />;
      default:
        return <DashboardTab profile={profile} lang={lang} t={t} activities={isOwner ? activities : []}
          courses={courses} products={products} portfolio={portfolio}
          jobs={jobs} picks={picks} achievements={achievements} reviews={reviews}
          communities={communities} events={events} affiliateOffers={affiliateOffers}
          campaigns={campaigns} tipLeaders={tipLeaders}
          onItemClick={handleOpenItem} onViewAll={handleTabChange} />;
    }
  };

  return (
    <div className="csp">
      <SEOHead
        title={ciSeo?.title || profile?.og_title || pageTitle}
        description={ciSeo?.description || profile?.og_description || descriptionForMeta}
        image={ciSeo?.og_image || profile?.og_image || profile.avatar_url || OG_IMAGE_FALLBACK}
        url={`/c/${username}`}
        type="profile"
        schema={ciSeo?.structured_data && Object.keys(ciSeo.structured_data).length > 1 ? ciSeo.structured_data : profileSchema(profile, { courses, products, portfolio, reviews })}
        lang={lang}
        keywords={[
          ...(ciSeo?.keywords || []),
          ...(profile?.seo_keywords || []),
          profile?.display_name,
          profile?.artist_name,
          ...(Array.isArray(profile?.skills) ? profile.skills : []),
          ...(Array.isArray(profile?.languages) ? profile.languages.map((l) => typeof l === 'string' ? l : l.name) : []),
          profile?.country,
          profile?.city,
          // Actual content titles — helps Google match search queries
          ...courses.slice(0, 5).map((c) => c.title).filter(Boolean),
          ...products.slice(0, 5).map((p) => p.title).filter(Boolean),
          ...portfolio.slice(0, 3).map((p) => p.title).filter(Boolean),
          // Categories from actual content
          ...courses.slice(0, 5).map((c) => c.category).filter(Boolean),
          ...products.slice(0, 5).map((p) => p.category).filter(Boolean),
          'Atelnyo',
          'creator',
        ].filter(Boolean)}
        breadcrumbs={[
          { label: 'Home', url: '/' },
          { label: profile.display_name || username.toLowerCase(), url: `/c/${username}` },
        ]}
      />

      {/* Three-column layout */}
      <div className="csp-layout">
        {/* LEFT RAIL */}          <LeftNavRail activeTab={activeTab} onChange={handleTabChange} lang={lang} items={orderedTabs} />

        {/* MAIN CONTENT */}
        <div className="csp-main">
          <header className={`csp-header${scrolled ? ' csp-header--scrolled' : ''}`}>
            <button type="button" className="csp-header-back"
              onClick={handleHeaderBack}
              aria-label={t.profile_back || 'Back'}>
              <i className="fas fa-arrow-left" aria-hidden="true" />
              <span>{t.profile_back || 'Back'}</span>
            </button>
            <span className="csp-header-title">
              {profile.display_name || `@${(profile.username || '').toLowerCase()}`}
            </span>
            {/* Edit button is hidden in preview mode — the studio preview is
                ALREADY the editor; clicking it there would just bounce back. */}
            {isOwner && !overrideProfile && (
              <button type="button" className="csp-header-edit"
                onClick={() => navigate('/sheet/studio?section=public_profile')}
                aria-label={t.profile_edit || 'Edit profile'}
                title={t.profile_edit || 'Edit profile'}>
                <i className="fas fa-pen" aria-hidden="true" />
              </button>
            )}
            <button type="button" className="csp-header-share"
              onClick={() => { trackClick('share'); handleShare(); }}
              aria-label={t.profile_share || 'Share'}>
              <i className="fas fa-share-alt" aria-hidden="true" />
            </button>
          </header>

          <PremiumHero profile={profile} lang={lang} followersCount={followersCount} />

          <ActionBar
            profile={profile} lang={lang} isOwner={isOwner}
            isFollowing={isFollowing}
            onFollow={() => { trackClick('follow'); handleFollow(); }}
            onShare={() => { trackClick('share'); handleShare(); }}
            onCopyLink={() => { trackClick('copy_link'); handleCopyLink(); }}
            copied={copied} followLoading={followLoading}
            showToast={showToast} t={t}
            onMessage={(presetSubject) => { trackClick('message'); setContactModal({ mode: 'message', presetSubject }); }}
            onHire={() => { trackClick('hire'); setContactModal({ mode: 'hire' }); }}
            onCollab={() => { trackClick('collab'); setContactModal({ mode: 'collab' }); }}
            onTip={() => { trackClick('tip'); setContactModal({ mode: 'tip' }); }}
            onBook={() => { trackClick('book_service'); setContactModal({ mode: 'book' }); }}
            onSubscribe={() => { trackClick('subscribe'); setShowSubscribeModal(true); }}
            subscriptionsEnabled={Boolean(subscription?.enabled)}
            isSubscribed={Boolean(subscription?.is_subscribed)}
            affiliateActive={affiliateActive}
            campaignsEnabled={(campaigns?.length || 0) > 0}
            viewerIsAffiliate={viewerIsAffiliate}
          />

          <GlassStatsCard
            profile={profile}
            picksCount={picksCount}
            lang={lang}
            isOwner={isOwner}
            tipTotalAmount={tipTotals.amount}
            tipTotalCount={tipTotals.count}
          />

          {isOwner && (
            <PrivacyBanner
              isPublic={showPicksPublicly}
              lang={lang}
              onToggle={handleTogglePicksVisibility}
              isUpdating={privacyUpdating}
            />
          )}

          {editingMode && <ConfigBar lang={lang} />}

          <TabsBar activeTab={activeTab} onChange={handleTabChange} lang={lang} items={orderedTabs} badges={tabBadges} />

          <div className="csp-content" id="csp-content-scroll" role="tabpanel"
            aria-labelledby={`csp-tab-${activeTab}`}>
            {renderTabContent()}
          </div>
        </div>

        {/* RIGHT SIDEBAR */}          <aside className="csp-sidebar" aria-label="Business sidebar">
            {isSectionVisible(profile, 'about') && <AboutCard profile={profile} />}
            {isSectionVisible(profile, 'languages') && <LanguageCard languages={profile.languages} />}
            {isSectionVisible(profile, 'quicklinks') && (
              <QuickLinksCard
                socialLinks={profile.social_links}
                websiteUrl={profile.website_url}
              />
            )}
            {isSectionVisible(profile, 'featuredProduct') && (
              <FeaturedProductCard profile={profile} products={products} onOpenCheckout={onOpenCheckout} />
            )}
            {/* Last-activity timeline is creator-confidential — only the
                owner sees it (visitors never learn when the creator was
                last active). */}
            {isOwner && isSectionVisible(profile, 'activity') && <ActivityCard activities={activities} lang={lang} />}
            {isSectionVisible(profile, 'campaigns') && <CampaignsCard campaigns={campaigns} lang={lang} />}
            {isSectionVisible(profile, 'affiliate') && <AffiliateCard offers={affiliateOffers} lang={lang} />}
          </aside>
      </div>

      {showShareModal && (
        <ShareModal
          url={`${window.location.origin}/c/${username}`}
          onClose={() => setShowShareModal(false)}
          lang={lang}
        />
      )}

      {showSubscribeModal && subscription?.enabled && (
        <SubscribeModal
          slug={username}
          price={subscription?.price || null}
          lang={lang}
          t={t}
          showToast={showToast}
          onClose={() => setShowSubscribeModal(false)}
          onOpenWallet={() => navigate('/sheet/wallet')}
          onSubscribed={() => fetchSubscriptionStatus()}
          user={user}
          onAuthRequired={onAuthRequired}
        />
      )}

      {contactModal && (
        <ContactModal
          mode={contactModal.mode}
          username={username}
          // The creator's USER id — the tip mode uses it for the REAL
          // wallet transfer (/api/tips/send/), not the notification-only
          // profile endpoint.
          creatorId={profile?.user_id || null}
          lang={lang}
          t={t}
          showToast={showToast}
          presetSubject={contactModal.presetSubject || ''}
          onClose={() => setContactModal(null)}
          // Insufficient wallet balance on a tip → go top up (PayPal).
          onOpenWallet={() => navigate('/sheet/wallet')}
          // Anonymous visitors can compose; pressing Send opens the auth
          // modal in place and the message sends automatically after
          // sign-in — they stay on this profile the whole time.
          user={user}
          onAuthRequired={onAuthRequired}
        />
      )}
    </div>
  );
}
