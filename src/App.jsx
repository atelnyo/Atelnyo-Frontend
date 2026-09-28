/**
 * App.jsx — root component for the Atelnyo Academy frontend.
 *
 * Top-level responsibilities (in render order):
 *   1. Read user / session / progress / favorites from the Django backend
 *      on mount and re-hydrate them into local state.
 *   2. Hold the active tab + selected course + theme/font/lang settings
 *      that drive the entire SPA.
 *   3. Dispatch toasts and live-fullscreen toggles.
 *
 * WHY do we use a manual `activeTab` state machine instead of
 * `react-router-dom` (already installed)?
 *   - The app grew shell-by-shell around a single `activeTab` slice early on.
 *   - Several features rely on cross-tab state that survives navigation:
 *       • `selectedCourse` carries into CourseDetail;
 *   - Switching to react-router-dom would force re-deriving all of the
 *     above without functional benefit. Keep manual routing unless we are
 *     also adding server-side rendering.
 *
 * Tab reference: see src/components/Tabs.jsx for the canonical tab ids;
 * renderContent() below mirrors that list in its switch statement.
 */
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, lazy, Suspense, startTransition } from 'react';
import { Helmet } from 'react-helmet-async';
import NoindexRoute from './seo/NoindexRoute';
import useSafeNavigate from './hooks/useSafeNavigate';
import ScrollManager from './hooks/ScrollManager';
import useAnchorScroll from './hooks/useAnchorScroll';
import userActivity from './services/userActivity';
import { Routes, Route, useLocation, useNavigate, useParams, Navigate } from 'react-router-dom';
import { useTheme } from './context/ThemeContext';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import HeadInjector from './components/shared/HeadInjector';
// Route-level components — lazy-loaded to shrink the main bundle.
// These are only rendered when their route is active, so deferring
// the import until navigation saves ~200-300 kB from the initial paint.
const CourseDetail = lazy(() => import('./components/CourseDetail'));
const Rules = lazy(() => import('./components/Rules'));
const Wizard = lazy(() => import('./components/Wizard'));
const Settings = lazy(() => import('./components/Settings'));
const CheckoutModal = lazy(() => import('./components/CheckoutModal'));
const Auth = lazy(() => import('./components/Auth'));
const Chatbot = lazy(() => import('./components/Chatbot'));
const Footer = lazy(() => import('./components/Footer'));
const Newsletter = lazy(() => import('./components/Newsletter'));
const Features = lazy(() => import('./components/Features'));
const FAQ = lazy(() => import('./components/FAQ'));
const Stats = lazy(() => import('./components/Stats'));
const DashboardPreview = lazy(() => import('./components/DashboardPreview'));
import NotFound from './components/NotFound';
import SkeletonCard from './components/SkeletonCard';
const Explore = lazy(() => import('./components/Explore').then(m => ({ default: m.Explore })));
import BottomNavBar from './components/BottomNavBar';
const Mwen = lazy(() => import('./components/Mwen'));
import ConnectionBanner from './components/common/ConnectionBanner';
import { t2 } from './utils/i18n';
// Continuity UI — announces that the session was restored after a
// relaunch (memory-kill / reload / browser restart / SW update).
import RestoreBanner from './components/RestoreBanner';
import AuthGate from './components/common/AuthGate';
import RequireRole from './components/common/RequireRole';
import SessionExpiredModal from './components/common/SessionExpiredModal';
import { init as initUpdateEngine } from './services/updateEngine';
import { playNotificationSound } from './services/notificationSound';
// App Controller — the integration layer of the PWA System. It
// composes the Installation Manager (which owns display-mode /
// installed detection — primary media query + platform fallbacks —
// no component sniffs display-mode APIs) and the SW update engine
// into “how is the app running right now?” facts. App.jsx consumes
// THIS layer and never re-implements detection.
import appController from './pwa/app/AppController';
import continuityManager from './pwa/continuity/ContinuityManager';
import useContinuity from './hooks/useContinuity';
import usePullToRefresh from './hooks/usePullToRefresh';
// ─── Accessibility Foundation (Phase 10) ───────────────────────────
import { SkipNavigation, announce, FOCUS_MAIN_ID, getA11yString } from './accessibility';
// ─── Sheet-route-only components (lazy-loaded via React.lazy) ─────
// These are large components that are only rendered when the user
// navigates to a /sheet/* URL. Lazy-loading them shrinks the initial
// bundle by ~200-300 kB. They are loaded on-demand when the route
// match is first visited; a <Suspense> boundary around the <Routes>
// block shows a minimal spinner while they load.
const AffiliateDashboard = lazy(() => import('./components/affiliate/AffiliateDashboard'));
const ProgramDiscovery = lazy(() => import('./components/affiliate/ProgramDiscovery'));
const Atelier           = lazy(() => import('./components/atelier/Atelier'));
const MusicSheet        = lazy(() => import('./components/explore/MusicSheet'));
const TalentSheet       = lazy(() => import('./components/explore/TalentSheet'));
const JobSheet          = lazy(() => import('./components/explore/JobSheet'));
const CalendarView      = lazy(() => import('./components/CalendarView'));
const CreatorAnalytics  = lazy(() => import('./components/CreatorAnalytics'));
const ReferralDashboard = lazy(() => import('./components/ReferralDashboard'));
const CreatorApply      = lazy(() => import('./components/CreatorApply'));
const CreatorStudio     = lazy(() => import('./components/studio/CreatorStudio'));
const SpotlightDetail   = lazy(() => import('./components/SpotlightDetail'));
const CompanyProfileDetail = lazy(() => import('./components/CompanyProfileDetail'));
const BusinessHub = lazy(() => import('./components/business/BusinessHub'));
const BusinessWorkspace = lazy(() => import('./components/business/BusinessWorkspace'));
const BusinessPublicPage = lazy(() => import('./components/business/BusinessPublicPage'));
const BusinessMyOrdersPage = lazy(() => import('./components/business/BusinessMyOrdersPage'));
const AdminCreatorReview= lazy(() => import('./components/admin/AdminCreatorReview'));
const AdminDashboard    = lazy(() => import('./components/admin/AdminDashboard'));
const AdminMediaManager = lazy(() => import('./components/admin/AdminMediaManager'));
const AdminSpotlightReview = lazy(() => import('./components/admin/AdminSpotlightReview'));
const AdminBusinessSpotlightReview = lazy(() => import('./components/admin/AdminBusinessSpotlightReview'));
const AdminCompanyReview = lazy(() => import('./components/admin/AdminCompanyReview'));
const AdminBrokenMediaCenter = lazy(() => import('./components/admin/AdminBrokenMediaCenter'));
const AdminValidationQueue = lazy(() => import('./components/admin/AdminValidationQueue'));
const AdminContentModeration = lazy(() => import('./components/admin/AdminContentModeration'));
const AdminMediaReports = lazy(() => import('./components/admin/AdminMediaReports'));
const AdminMediaIncidents = lazy(() => import('./components/admin/AdminMediaIncidents'));
const AdminSecurityCenter = lazy(() => import('./components/admin/AdminSecurityCenter'));
const AdminUserManagement = lazy(() => import('./components/admin/AdminUserManagement'));
const AdminRuleEngine = lazy(() => import('./components/admin/AdminRuleEngine'));
const AdminFAQ = lazy(() => import('./components/admin/AdminFAQ'));
const AdminPlatformFAQ = lazy(() => import('./components/admin/AdminPlatformFAQ'));
const FAQPage = lazy(() => import('./components/FAQPage'));
const HelpPage = lazy(() => import('./components/HelpPage'));
const CertificateVerify = lazy(() => import('./components/CertificateVerify'));
const AdminProviderHealth = lazy(() => import('./components/admin/AdminProviderHealth'));
const AdminMediaMonitor = lazy(() => import('./components/admin/AdminMediaMonitor'));
const SecurityDashboard = lazy(() => import('./components/admin/SecurityDashboard'));
const CreatorPublicProfile = lazy(() => import('./components/CreatorPublicProfile'));
const SearchResultsPage = lazy(() => import('./components/SearchResultsPage'));
const ProfileItemDetail = lazy(() => import('./components/ProfileItemDetail'));
const ProductDetail      = lazy(() => import('./components/ProductDetail'));
const PortfolioDetail    = lazy(() => import('./components/PortfolioDetail'));
const PolicyPageView = lazy(() => import('./components/legal/PolicyPageView'));
const LegalIndexPage = lazy(() => import('./components/legal/LegalIndexPage'));
const DynamicPageSheet = lazy(() => import('./components/cms/DynamicPage').then(m => ({ default: m.DynamicPageSheet })));
const ThemesPage = lazy(() => import('./components/ThemesPage'));
// Phase 23 — Media Entity Page (full-page media route, lazy-loaded).
// Lives under src/pages/media/ since it consumes the Slice-0 panels
// and the prompt-23 components (Breadcrumbs / CommandBar) but is
// itself a route-level shell, not a reusable component.
const MediaEntityPage = lazy(() => import('./pages/media/MediaEntityPage'));
const NotificationsPage = lazy(() => import('./components/NotificationsPage'));
const WalletPage = lazy(() => import('./pages/wallet/WalletPage'));
// Universal DM inbox (same MessagesSection the Studio uses) — every
// authenticated user, creator or not, reads + replies to conversations.
const MessagesPage = lazy(() => import('./components/studio/sections/MessagesSection'));
// Phase Language — Atelnyo Language Academy (public hub + staff mgmt).
const AcademyHub = lazy(() => import('./components/academy/AcademyHub'));
const AdminLanguageAcademy = lazy(() => import('./components/admin/AdminLanguageAcademy'));
// Phase Learner — dedicated learner experience (dashboard + space).
const LearnerDashboard = lazy(() => import('./components/learning/LearnerDashboard'));
const LearningSpace = lazy(() => import('./components/learning/LearningSpace'));
const CurriculumPlayer = lazy(() => import('./components/learning/CurriculumPlayer'));

// ─── DEIE — Atelnyo Evolution Intelligence Engine (lazy sheet routes) ─
const DEIEFeed       = lazy(() => import('./components/deie/DEIEFeed'));
const MentorChat     = lazy(() => import('./components/deie/MentorChat'));
const EvolutionBadge = lazy(() => import('./components/deie/EvolutionBadge'));
const AboutPage       = lazy(() => import('./components/AboutPage'));
const TrustCenter     = lazy(() => import('./components/TrustCenter'));
const ContactPage     = lazy(() => import('./components/ContactPage'));
const AccessibilityPage = lazy(() => import('./components/AccessibilityPage'));
const StatusPage       = lazy(() => import('./components/StatusPage'));
const DevelopersPage   = lazy(() => import('./components/DevelopersPage'));
const CookieConsent   = lazy(() => import('./components/CookieConsent'));
const GlobalSearchBar = lazy(() => import('./components/GlobalSearchBar'));
const SpotlightIdentity = lazy(() => import('./components/spotlight/SpotlightIdentity'));
import { captureAffiliateToken } from './utils/affiliateAttribution';
// Content deep-link helpers — canonical URLs are ``/{id}@{user}/{type}``
// (see src/utils/contentUrl.js). ContentKeyRoute renders the detail page
// for that shape; each detail page auto-upgrades legacy URLs to it.
import { buildContentUrl, isContentRoutePath, isLegacyContentUrl, normalizeContentType, parseContentUrl } from './utils/contentUrl';
import { historyBack, requireLogin } from './utils/history';
// ─── Global Locale & Market Routing (Phases 3–4) ────────────────
// markets.js = single source of truth for language/market combos;
// localeUrl.js = URL parser/validation + switcher URL rewriting;
// LocaleContext = the resolved AtelyonaContext {language, country,
// market, tag, isLocalized} consumed by switchers + UI.
import { parseLocaleCountry, switchLocale, buildLocaleUrl } from './utils/localeUrl';
import { MARKETS, MARKET_OPTIONS, SUPPORTED_LANGUAGES, defaultLanguageFor, buildLocaleTag, DEFAULT_MARKET } from './config/markets';
import { locationCache } from './services/location/locationCache';
import { getSupportedBrowserLanguage } from './services/location/localeService';
import { TIMEZONE_TO_COUNTRY } from './services/location/timezoneService';
// webmcp.js (116KB) is lazy-loaded — only needed for AI agent tools
import LocaleProvider from './context/LocaleContext';
import useLocalePath from './hooks/useLocalePath';

// ─── Chunk Load Error Boundary ───────────────────────────────────
// Catches "Failed to fetch dynamically imported module" errors that
// happen when a new deployment changes JS chunk hashes. Shows a
// user-friendly reload button instead of a white screen.
class ChunkLoadErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    // Only catch chunk/module load errors from failed dynamic
    // import(). Browser-specific messages:
    //   - Chrome: "Failed to fetch dynamically imported module"
    //   - Firefox: "error loading dynamically imported module"
    //   - Safari:  "Failed to fetch" (no prefix)
    // Other errors propagate upward so they crash visibly and get
    // noticed in Sentry / the browser console.
    if (error && (
      error.message?.includes('dynamically imported') ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('Failed to fetch')
    )) {
      return { hasError: true, error };
    }
    // Propagate non-chunk errors upward instead of hitting
    // React's 50-retry re-render limit.
    throw error;
  }
  componentDidCatch(error, info) {
    console.error('[ChunkLoadErrorBoundary]', error?.message || error);
  }
  handleReload = () => {
    window.location.reload();
  };
  render() {
    if (this.state.hasError) {
      const isHt = localStorage.getItem('atelnyo_lang') === 'ht';
      return (
        <div className="chunk-error-boundary" role="alert">
          <div className="chunk-error-card">
            <div className="chunk-error-icon">
              <i className="fas fa-exclamation-triangle" />
            </div>
            <h2>{isHt ? 'Nouvo vèsyon disponib' : 'New version available'}</h2>
            <p>
              {isHt
                ? 'Yon nouvo vèsyon app la disponib. Rechaje paj la pou w jwenn dènye mizajou yo.'
                : 'A new version of the app is available. Reload the page to get the latest updates.'}
            </p>
            <button
              type="button"
              className="chunk-error-btn"
              onClick={this.handleReload}
            >
              <i className="fas fa-sync-alt" /> {isHt ? 'Rechaje paj la' : 'Reload page'}
            </button>
            <p className="chunk-error-tip">
              {isHt
                ? "Si pwoblèm nan kontinye, netwaye cache navigatè a oswa ouvri app la nan yon nouvo tab."
                : "If the issue persists, clear your browser cache or open the app in a new tab."}
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Learner route error boundary ─────────────────────────────────
// The Learning Space is the post-enrollment destination; a render
// crash there must NEVER surface as a blank/black page (no recovery,
// learner feels the app died right after enrolling). This boundary
// catches any render error in the learner routes and shows the same
// recoverable state the Learning Space itself uses for load failures.
class LearnerRouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    console.error('[LearnerRouteErrorBoundary]', error?.message || error);
  }
  render() {
    if (this.state.hasError) {
      const isHt = localStorage.getItem('atelnyo_lang') === 'ht';
      return (
        <div className="ls-page">
          <div className="ls-state" role="alert">
            <i className="fas fa-triangle-exclamation" aria-hidden="true" />
            <h3>
              {isHt
                ? 'Yon erè rive lè w ap chaje espas aprantisaj la.'
                : 'Something went wrong loading the learning space.'}
            </h3>
            <p>
              {isHt
                ? 'Eseye ankò oswa retounen. Pwogrè ou anrejistre sou sèvè a.'
                : 'Try again or go back. Your progress is saved on the server.'}
            </p>
            <div className="ls-state-actions">
              <button type="button" className="ls-btn" onClick={() => window.history.back()}>
                <i className="fas fa-arrow-left" aria-hidden="true" /> {isHt ? 'Retounen' : 'Back'}
              </button>
              <button type="button" className="ls-btn ls-btn--primary" onClick={() => window.location.reload()}>
                <i className="fas fa-rotate-right" aria-hidden="true" /> {isHt ? 'Eseye ankò' : 'Try again'}
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Legal & Fact Policies components ────────────────────────────
import PolicyConsentBanner from './components/legal/PolicyConsentBanner';
import ViolationNotice from './components/legal/ViolationNotice';

// ─── Static imports ──────────────────────────────────────────────
// Components used on the initial render or in main content are kept
// as static imports so they load eagerly with the first paint.
import CommunityDetail, {
  CommunityEvents,
  CommunityMembers,
  CommunityBannedMembers,
  CommunityAnnouncements,
  CommunityFiles,
  CommunityCourses,
} from './components/CommunityDetail';
const ActivityTimeline = lazy(() => import('./components/ActivityTimeline'));
import { SHEETS } from './routes/sheets';
import EmailVerificationRoute from './routes/EmailVerificationRoute';
import { translations } from './data/translations';
import api, { courseService, communitiesService, authService, sessionService, progressService, favoriteService, activityFeedService, proposalService, clearTokenPair, broadcastLogout, API_URL } from './services/api';
import { useAuthStore } from './store/useAuthStore';
import permissionManager from './pwa/permissions/PermissionManager';
// firebase.js lazy-loaded — only needed for push notifications
let _firebaseMod = null;
const _loadFirebase = () => _firebaseMod || import('./services/firebase').then(m => { _firebaseMod = m; return m; });
import {
  connectNotificationSocket,
  disconnectNotificationSocket,
} from './services/notificationsSocket';

// ─── Init PWA update engine on module load ────────────────────────
// Detects new SW versions automatically and dispatches
// atelnyo:sw:update events for the InstallPrompt banner.
if (typeof window !== 'undefined') {
  import('./services/updateEngine').then(m => m.init()).catch(() => {});
}

/**
 * CmsPageLegacyRedirect — legacy /page/:slug → /sheet/page/:slug (T093).
 * ``replace`` keeps the old URL out of history so the back button returns
 * to where the visitor came from, not to the redirect hop.
 */
function CmsPageLegacyRedirect() {
  const { slug } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    if (slug) navigate(`/sheet/page/${encodeURIComponent(slug)}`, { replace: true });
  }, [slug, navigate]);
  return null;
}

/**
 * LocaleSync — applies URL locale intent to app state (spec §30).
 *
 * Cold loads are covered by App's lazy useState initializers and
 * explicit actions by the switcher handlers; this tiny component only
 * fills the browser back/forward gap (popstate between two DIFFERENT
 * localized URLs, e.g. /en-US/… → back → /fr-HT/…).
 *
 * It is a separate child component ON PURPOSE: the state update lives
 * in an effect here so the react-hooks compiler only skips THIS file's
 * scope — App's own hooks stay fully analyzable (no cascading
 * preserve-manual-memoization errors). The ref guard makes the
 * onResolved call fire only when the resolved context actually
 * changes.
 */
function LocaleSync({ pathname, lang, market, onResolved }) {
  const lastRef = useRef('');
  useEffect(() => {
    const p = parseLocaleCountry(pathname);
    if (!p.valid) { return undefined; }
    const key = `${p.language}:${p.country}`;
    if (key === lastRef.current) { return undefined; }
    lastRef.current = key;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    onResolved(p.language, p.country);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, lang, market, onResolved]);
  return null;
}

/**
 * PolicyPageRoute — extracts :slug from React Router params and
 * renders PolicyPageView. Separate component so useParams() works
 * inside the <Route element={...}> context.
 */
function PolicyPageRoute({ lang, showToast }) {
  const { slug } = useParams();
  return <PolicyPageView slug={slug} lang={lang} showToast={showToast} />;
}

/**
 * CatchAllRoute — handles the catch-all <Route path="*" />.
 * React Router v6 does not match the @ character in route path patterns
 * (e.g. "/@:username"), so this wrapper checks the current URL manually.
 * If the path starts with /@, it renders <CreatorPublicProfile> with the
 * extracted username. Otherwise it renders <NotFound>.
 */
function CatchAllRoute({ lang, showToast, currentUserId, onOpenCheckout, user, onAuthRequired, pathname }) {
  const location = useLocation();
  const navigate = useNavigate();
  // ``pathname`` is the EFFECTIVE path (locale segment stripped) passed
  // by App — a localized /ht-HT/@username must still resolve the
  // creator profile instead of 404-ing.
  const p = pathname || location.pathname;

  // Match /c/username (new pattern) and legacy /@username (redirect).
  if (p.match(/^\/c\/([^/]+)/)) {
    const username = p.match(/^\/c\/([^/]+)/)?.[1];
    if (username) {
      return (
        <CreatorPublicProfile
          lang={lang}
          showToast={showToast}
          currentUserId={currentUserId}
          username={username}
          onOpenCheckout={onOpenCheckout}
          // user + onAuthRequired: the follow button opens the auth
          // modal in place for anonymous visitors and completes the
          // follow automatically after sign-in — no redirect away.
          user={user}
          onAuthRequired={onAuthRequired}
        />
      );
    }
  }

  // Unknown path — redirect to the proper /404 route which renders
  // NotFound inside <main> via the effectivePathname check in App.
  return null;
}

/**
 * AuthRoute — guards the canonical /login + /signup pages: a user who
 * is already signed in has no business re-filling the form, so they get
 * bounced home instead of seeing a login screen over their session.
 * Renders the Auth modal otherwise, pinned to the URL's mode.
 */
function AuthRoute({ user, mode, lang, onLoginSuccess, showToast }) {
  const navigate = useNavigate();
  const location = useLocation();
  if (user) {
    // A signed-in user has no business on the auth form. If they were
    // bounced here by AuthGate while the session was still hydrating
    // (page reload of a gated route), send them BACK to where they
    // were going instead of dumping them on the homepage. Only trust
    // the ``from`` state when it is a real, non-auth destination.
    const from = location.state?.from;
    const isAuthPath = from && (from.startsWith('/login') || from.startsWith('/signup') || from.startsWith('/sheet/auth'));
    if (from && !isAuthPath) {
      navigate(from, { replace: true });
      return null;
    }
    return <Navigate to="/" replace />;
  }
  return (
    <Auth
      isOpen
      initialMode={mode}
      seo
      // Switching login ↔ signup must KEEP the ``from`` state, or a
      // user bounced here by AuthGate (e.g. from /sheet/studio) who
      // flips to the signup form would lose their return destination
      // and land on the homepage after registering.
      onModeSwitch={(next) => {
        const state = location.state?.from ? { state: { from: location.state.from } } : undefined;
        navigate(next === 'login' ? SHEETS.LOGIN : SHEETS.SIGNUP, state);
      }}
      // Closing the auth page returns to where the user came from (or
      // the Explore home for a fresh-tab deep-link).
      onClose={() => historyBack(navigate)}
      onLoginSuccess={onLoginSuccess}
      lang={lang}
      showToast={showToast}
    />
  );
}

/**
 * CourseDetailRoute — fetches a course by id (pk or slug) and renders
 * the full CourseDetail page. Mounted at BOTH the canonical
 * ``/{id}@{user}/course`` deep-link (id passed as a prop) and the
 * legacy ``/sheet/course/:id`` route (id from the URL param). Once the
 * payload loads, a legacy URL auto-redirects (replace) to the canonical
 * ``/{id}@{user}/course`` shape.
 */
function CourseDetailRoute({ lang, id: propId, user, showToast, onOpenCheckout, onAuthOpen }) {
  const { id: paramId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const id = propId ?? paramId;
  const stateCourse = location.state?.course;
  const [course, setCourse] = useState(stateCourse || null);
  const [loading, setLoading] = useState(!stateCourse);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (stateCourse || !id) return;
    let cancelled = false;
    // Intentional synchronous reset so an id change (legacy → canonical
    // route swap, related-course nav) starts a clean fetch — matches the
    // fetch-effect pattern used across App.jsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFailed(false);
    courseService.getById(id)
      .then((res) => { if (!cancelled) setCourse(res?.data || null); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, stateCourse]);

  // Canonical URL upgrade: legacy /sheet/course/:id → /{id}@{user}/course.
  useEffect(() => {
    if (!course?.id) return;
    if (!isLegacyContentUrl('course', location.pathname)) return;
    navigate(buildContentUrl('course', course), { replace: true });
  }, [course?.id, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="cd-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--cd-primary, #2563eb)' }} />
      </div>
    );
  }
  if (failed || !course) {
    return <NotFound lang={lang} onBack={() => navigate('/')} />;
  }
  return (
    // History-aware back: returns to the page the course was opened
    // from (public profile, Explore, related-course …); falls back to
    // the Explore home for fresh-tab deep-links with no prior entry.
    <CourseDetail
      course={course}
      lang={lang}
      translations={translations}
      onBack={() => historyBack(navigate)}
      user={user}
      showToast={showToast}
      onOpenCheckout={onOpenCheckout}
      onAuthOpen={onAuthOpen}
      onEnterLearning={(c, moduleIndex) => {
        // ``moduleIndex`` (optional) deep-links straight into that
        // module's step session inside the Learning Space — "Open this
        // module" from the course page jumps to the module, not just
        // the space's landing view.
        // startTransition: LearningSpace is React.lazy — suspends during
        // the synchronous render phase of a click handler. Wrapping in
        // startTransition tells React this is a non-urgent update so it
        // catches the suspension via Suspense instead of erroring #426.
        const q = moduleIndex != null ? `?module=${Number(moduleIndex)}` : '';
        startTransition(() => {
          navigate(`${SHEETS.LEARN_COURSE_URL(c?.id)}${q}`);
        });
      }}
    />
  );
}

/**
 * LearningSpaceRoute — the dedicated Learning Space for one course
 * (mounted at /sheet/learn/:courseId). Auth-gated; the space itself
 * re-checks backend entitlement (``/courses/<id>/access/``) before
 * rendering lessons — the frontend never authorizes.
 */
function LearningSpaceRoute({ lang, translations, user, showToast, onNavigate }) {
  const { courseId } = useParams();
  const navigate = useNavigate();
  // ?resume=1 (from the dashboard's "Continue" card) drops the learner
  // straight into the step session at their last module — the Duolingo
  // "resume where you left off" entry. Read once at mount.
  const query = new URLSearchParams(window.location.search);
  const resumeOnLoad = query.get('resume') === '1';
  // ?module=N (from the course page's "Open this module" action) opens
  // that specific module's step session. Read once at mount.
  const moduleOnLoadRaw = query.get('module');
  const moduleOnLoad = moduleOnLoadRaw != null && /^\d+$/.test(moduleOnLoadRaw)
    ? Number(moduleOnLoadRaw)
    : null;
  return (
    <LearningSpace
      courseId={courseId}
      lang={lang}
      translations={translations}
      user={user}
      showToast={showToast}
      autoResume={resumeOnLoad}
      initialModule={moduleOnLoad}
      onBack={() => navigate(SHEETS.LEARN)}
      onOpenCourse={(course) => navigate(buildContentUrl('course', course), { state: { course } })}
      onNavigate={onNavigate}
    />
  );
}

/**
 * CurriculumPlayerRoute — the new Chapter → Lesson → ContentBlock
 * learning experience (mounted at /sheet/curriculum/:courseId).
 */
function CurriculumPlayerRoute({ lang, user, showToast }) {
  const { courseId } = useParams();
  return (
    <CurriculumPlayer
      courseId={courseId}
      lang={lang}
      onBlockComplete={(lessonId, blockId) => {
        progressService.recordPosition(courseId, { module_index: 0, block_index: -1, block_id: String(blockId) }).catch(() => {});
      }}
      onLessonComplete={(lessonId) => {
        showToast?.(lang === 'ht' ? '✅ Leson fini!' : '✅ Lesson complete!', 'check-circle');
      }}
    />
  );
}

/**
 * CommunityKeyRoute — resolves the ``/{slug}@{user}/community`` deep-link
 * to the canonical community page. ``contentId`` may be the community's
 * unique slug (the normal case) or a numeric pk (hand-typed link) — the
 * backend's CommunityViewSet resolves either via SlugOrPkLookupMixin.
 *
 * Communities already have a canonical detail URL with tab routes
 * (``/sheet/community/:slug``), so the ``/:key/community`` form is a
 * shareable alias: this route fetches the community once and redirects
 * (replace) so the alias never pollutes history and the tabs, bottom-nav
 * highlighting and CommunityDetail's slug-based fetch all keep working.
 */
function CommunityKeyRoute({ contentId, lang = 'en' }) {
  const navigate = useNavigate();
  const location = useLocation();
  // Explore cards pass the community payload via location.state — the
  // slug is known immediately, so the common click path skips the fetch
  // and hops straight to the canonical page. External / hand-typed
  // deep-links have no state and resolve the key (slug or pk) against
  // the API instead.
  const stateSlug = location.state?.community?.slug || null;
  const [slug, setSlug] = useState(stateSlug || null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (stateSlug || !contentId) return;
    let cancelled = false;
    communitiesService.get(contentId)
      .then((res) => {
        if (cancelled) return;
        const resolvedSlug = res?.data?.slug;
        if (resolvedSlug) setSlug(resolvedSlug);
        else setFailed(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [contentId, stateSlug]);

  // Canonical redirect once the slug is known. ``replace`` keeps the
  // shareable alias out of history (back-button returns to where the
  // visitor came from, not to the alias hop).
  useEffect(() => {
    if (!slug) return;
    navigate(`/sheet/community/${encodeURIComponent(slug)}`, { replace: true });
  }, [slug, navigate]);

  if (failed) {
    return <NotFound lang={lang} onBack={() => navigate('/')} />;
  }
  return (
    <div className="cd-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--cd-primary, #2563eb)' }} />
    </div>
  );
}

/**
 * ContentKeyRoute — renders the canonical ``/{id}@{user}/{type}``
 * deep-link for every Explore content category. ``:key`` carries the
 * ``{id}@{user}`` pair (id may be a numeric pk or a unique slug); the
 * backend resolves either via SlugOrPkLookupMixin. Malformed keys or
 * unknown types render NotFound (same as the catch-all).
 *
 * ``community`` is the one exception to "renders the detail page" —
 * communities keep their canonical tabbed URL at
 * ``/sheet/community/:slug``, so CommunityKeyRoute resolves the key
 * (slug or pk) and redirects there (replace).
 *
 * React Router v6 happily matches ``@`` inside a path segment value,
 * so ``/:key/:type`` captures ``12@johndoe/music`` as key='12@johndoe'
 * and type='music'. Static-first routes (``/creator/:username``,
 * ``/marketplace/:id``, ``/portfolio/:id``, ``/legal/:slug`` …) always
 * win over this dynamic pair, and the single-segment routes never match.
 */
function ContentKeyRoute({ lang, showToast, user, onOpenCheckout }) {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // NEW format (/:slug/by/:user/:type) — 4 segments, slug+user+type are separate params
  // LEGACY format (/:key/:type) — 2 segments, key contains "slug@user"
  const isNewFormat = Boolean(params.slug && params.user && params.type);
  const id = isNewFormat ? params.slug : (parseContentUrl(params.key)?.id || null);
  const ctype = isNewFormat ? normalizeContentType(params.type) : normalizeContentType(params.type);  if (!id || !ctype) {
    return <NotFound lang={lang} onBack={() => navigate('/')} />;
  }

  // ``key={id}`` remounts the detail page when the canonical route
  // re-matches with a different key (e.g. clicking a related item), so
  // state from the previous content never flashes while the new payload
  // loads.
  switch (ctype) {
    case 'music':
      return <MusicSheet key={id} lang={lang} showToast={showToast} user={user} contentId={id} />;
    case 'talent':
      return <TalentSheet key={id} lang={lang} showToast={showToast} user={user} contentId={id} />;
    case 'job':
      return <JobSheet key={id} lang={lang} showToast={showToast} user={user} contentId={id} />;
    case 'spotlight':
      return <SpotlightDetail key={id} lang={lang} showToast={showToast} user={user} contentId={id} />;
    case 'portfolio':
      return <PortfolioDetail key={id} lang={lang} showToast={showToast} user={user} contentId={id} />;
    case 'product':
      return <ProductDetail key={id} lang={lang} showToast={showToast} user={user} onOpenCheckout={onOpenCheckout} contentId={id} />;
    case 'course':
      return <CourseDetailRoute key={id} lang={lang} user={user} showToast={showToast} id={id} onOpenCheckout={onOpenCheckout} onAuthOpen={() => requireLogin(navigate, location, SHEETS.LOGIN)} />;
    case 'event':
      return <ProfileItemDetail key={id} lang={lang} showToast={showToast} user={user} type="event" contentId={id} />;
    case 'community':
      return <CommunityKeyRoute key={id} lang={lang} contentId={id} />;
    default:
      return <NotFound lang={lang} onBack={() => navigate('/')} />;
  }
}

/**
 * AffiliateGoRedirect — resolves a branded ``/go/<code>`` affiliate link.
 *
 * The affiliate link model's ``full_url`` is ``{FRONTEND_BASE_URL}/go/<code>``
 * (the clean URL affiliates share), but click-tracking + the attribution
 * JWT live on the backend at ``/api/go/<code>/`` (the ``affiliate-redirect``
 * view). Netlify's ``/*  /index.html  200`` rewrite sends every unknown
 * path here, so without this route the shareable link would render
 * <NotFound>. This route bounces the visitor to the API endpoint — the
 * backend records the click, issues the token, and 302-redirects to the
 * landing page with the ``#aff_token=<JWT>`` fragment, which CheckoutModal
 * reads at payment time.
 *
 * ``API_URL`` (VITE_API_BASE_URL or '/api/') is used so the bounce works
 * for BOTH same-origin and cross-origin backends (the deployed API lives
 * on a separate domain). The backend answers with an absolute Location
 * (FRONTEND_BASE_URL), so the fragment lands on the frontend, not the API.
 */
function AffiliateGoRedirect() {
  const { code } = useParams();
  useEffect(() => {
    if (!code) { return; }
    // API_URL is a module-level constant and window is global — neither
    // is a dependency, so the effect legitimately runs once per code.
    window.location.replace(`${API_URL}go/${code}/`);
  }, [code]);
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <i
          className="fas fa-circle-notch fa-spin"
          style={{ fontSize: '2rem', marginBottom: 12, color: 'var(--pink-primary)' }}
        />
        <p>Redirecting…</p>
      </div>
    </div>
  );
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// T009 — list endpoints now return a {count, next, previous, results}
// envelope; unwrap both the paginated and legacy raw-array shapes.
function unwrapList(data) {
  return Array.isArray(data) ? data : (data?.results || []);
}

// Tabs that render WITHOUT any selected-context (course/product) — a
// continuity restore may only land on one of these so a stale restore
// point can never mount a detail view (description/product-detail)
// with a null selectedCourse/selectedProduct.
const SAFE_RESTORE_TABS = ['explore', 'commerce', 'mwen', 'rules'];

function App() {
  // Phase 4 — lang initializer: an explicit localized URL (/fr-HT/…)
  // wins over the stored preference on cold load (spec §30 — URL
  // intent is the strongest signal); otherwise the existing
  // localStorage preference applies.
  //
  // Phase 60.2/60.3 — INSTANT detection (sub-ms, no network):
  //   1. cached geo result (previous visit) resolves synchronously from
  //      localStorage — like a logo that appears before the API answers;
  //   2. if no cache yet, the browser TIMEZONE (Intl — synchronous,
  //      zero network) gives an instant country hint for the core
  //      audience timezones (America/Port-au-Prince → ht, etc.), so a
  //      first-time Haitian visitor never flashes the wrong language
  //      while ipwho.is answers.
  const [lang, setLang] = useState(() => {
    const p = parseLocaleCountry(
      typeof window !== 'undefined' ? window.location.pathname : '',
    );
    if (p.valid) return p.language;
    const stored = localStorage.getItem('atelnyo_lang');
    if (stored) return stored;
    // Signal 5 — location cache (synchronous, from a previous visit's
    // server geo detection). The server hint is the platform's
    // authoritative answer for this visitor, so it ranks ABOVE the
    // browser-locale guess (spec Phase 60.2/60.3 + E8: a repeat
    // visitor with a cached detection must NOT be flipped by their
    // OS language).
    const cached = locationCache.get();
    if (cached?.suggestedLang && ['ht','en','es','fr'].includes(cached.suggestedLang)) {
      return cached.suggestedLang;
    }
    // Signal 6 — browser locale detection (synchronous, zero network).
    // navigator.languages gives the user's OS/browser language instantly.
    // The FULL ordered list is walked against the platform's supported
    // languages (markets-data.json) so an OS set to an unsupported
    // language (de-DE) still matches a supported preference (fr-FR).
    // Like GitHub: auto-detect on first visit, but never persist — the
    // user's explicit choice (via the switcher) always wins on reload.
    const browserLang = getSupportedBrowserLanguage(SUPPORTED_LANGUAGES);
    if (browserLang) {
      return browserLang;
    }
    return 'ht';
  });
  // Market (country context) — mirrors lang: URL wins, then the stored
  // preference. Persisted by the market switcher; empty = not chosen.
  const [market, setMarket] = useState(() => {
    const p = parseLocaleCountry(
      typeof window !== 'undefined' ? window.location.pathname : '',
    );
    return p.valid ? p.country : (localStorage.getItem('atelnyo_market') || '');
  });
  // Detected country — fed to LocaleProvider as the detection fallback
  // for the bare root path. Phase 60.2 — initialized synchronously from
  // the localStorage cache so the market/flag appears INSTANTLY on every
  // visit (like a logo), before any API response; the geo-hint effect
  // only refines it when the cache is stale/missing.
  const [detectedGeo, setDetectedGeo] = useState(() => {
    const cached = locationCache.get();
    if (!cached?.country) return null;
    return {
      country: cached.country,
      confidence: cached.confidence || 0,
      sources: cached.sources?.length ? cached.sources : ['geoip'],
      fromCache: true,
    };
  });
  // Stable ref mirror of ``lang`` so long-lived event listeners (the
  // atelnyo:auth:logout handler registered once on boot) read the CURRENT
  // language instead of the first-render closure — otherwise the
  // "Session expired" toast/modal would speak the wrong language after
  // the user switches language mid-session.
  const langRef = useRef(lang);
  useEffect(() => { langRef.current = lang; }, [lang]);
  const { isDark, setMode: setThemeMode, fontSize, setFontSize } = useTheme();

  // ─── WebMCP: Register tools for AI agents (lazy-loaded 116KB) ──
  useEffect(() => {
    import('./services/webmcp').then(m => m.initWebMCP()).catch(() => {});
  }, []);

  // ─── User Activity: track page visits for chatbot context ────
  useEffect(() => {
    userActivity.trackPage(window.location.pathname);
  }, [location.pathname]);

  const [activeTab, setActiveTab] = useState('explore');
  const [courses, setCourses] = useState([]);
  const [userProgress, setUserProgress] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [user, setUser] = useState(null);
  const [filteredCourses, setFilteredCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [checkoutState, setCheckoutState] = useState(null); // { type, meta }
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [toasts, setToasts] = useState([]);
  // True while the unmissable "Session expired" modal is on screen
  // (server killed the session while the user was browsing).
  const [sessionExpiredOpen, setSessionExpiredOpen] = useState(false);
  // Guards the session-expired flow against duplicate fire-and-forget
  // paths (boot /api/me/ catch + interceptor broadcast can both call
  // handleLogout('session_expired') for the same dead token). One death
  // should surface exactly ONE toast + ONE modal.
  const lastForcedLogoutAtRef = useRef(0);
  // ─── Continuity consumer (PWA §6 step #5) ───────────────────────
  // Where-the-user-is persistence: the Continuity Manager owns launch
  // context + the last-active clock; the restore point (activeTab /
  // lang / per-route scroll) lives in appStateStore and is reachable
  // ONLY through the manager's façades (getRestorePoint /
  // saveRestorePoint / saveScrollPosition / restoreScrollPosition) —
  // App.jsx is the sole UI consumer of the restore point.
  const activeTabRef = useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  // True while a programmatic scroll restore is in flight — suppresses
  // the throttled scroll-saver so a restore write never races the save
  // of the same position (the scrollTo restore fires a scroll event).
  const scrollRestoringRef = useRef(false);
  // Mirrors ``isSheetRoute`` for the scroll-saver (declared before it,
  // synced after — see the effect below isSheetRoute's computation).
  const isSheetRouteRef = useRef(false);
  const applyRestorePoint = useCallback((point) => {
    if (!point) return;
    // Only context-free tabs may be restored (SAFE_RESTORE_TABS).
    if (typeof point.activeTab === 'string' && SAFE_RESTORE_TABS.includes(point.activeTab)) {
      // First-wins vs the async server-session restore (current_tab):
      // the local restore point applies only while the tab is still
      // the untouched default, so a server value never gets clobbered.
      setActiveTab((prev) => (prev === 'explore' ? point.activeTab : prev));
    }
    // lang already persists to localStorage synchronously; the restore
    // point copy is the resilience fallback when localStorage was
    // cleared independently of IndexedDB (different clearing scopes).
    if (typeof point.lang === 'string' && !localStorage.getItem('atelnyo_lang')) {
      setLang(point.lang);
    }
  }, []);
  // Lightweight session re-validation — pings an authed endpoint so
  // the axios 401 interceptor can wipe a dead token and broadcast
  // atelnyo:auth:logout (the session-expired modal) if it's gone.
  // Shared with the boot focus/pageshow health check below.
  const revalidateSessionHealth = useCallback(() => {
    const hasToken =
      localStorage.getItem('access_token') ||
      localStorage.getItem('token');
    if (!hasToken) return;
    activityFeedService.unreadCount().catch(() => {});
  }, []);
  // Wire the three continuity contracts: noteActive on interactions
  // (inside the hook), the restore point on a relaunch, and session
  // re-validation on the returned / staleSession rising edges.
  useContinuity({
    onRestorePoint: applyRestorePoint,
    onReturned: revalidateSessionHealth,
    onStale: revalidateSessionHealth,
  });
  // Anchor scroll — smooth-scrolls to any #section-id in the URL.
  // Shared at the App level so it works from any entry point (direct
  // link, footer anchor, chip click) even when navigating between tabs.
  useAnchorScroll();
  // (Phase 46.1 diaspora toast removed in Phase 60.3 — the language is
  // auto-applied for everyone now, and a "Kreyòl Ayisyen?" prompt is
  // presumptuous: the platform cannot know who the visitor is.)

  // Phase 47 — Cloud Shell Web Preview hint banner. Fired once on
  // mount when the origin ends with ``cloudshell.dev`` and the user
  // has not yet dismissed it. The Cloud Shell auth-proxy intercepts
  // every API call (including the /dapi/ alias — see vite.config.js)
  // and 302-redirects to Google's OAuth, which the browser refuses
  // cross-origin; meanwhile ``settings.py`` has
  // ``CORS_ALLOWED_ORIGIN_REGEXES = []`` so Django rejects
  // ``*.cloudshell.dev`` at the CORS preflight layer. The hint banner
  // is the project-policy replacement for the now-removed silent
  // reload fallback in src/services/api.js's response interceptor —
  // be loud on first render so the developer isn't stuck wondering
  // why every XHR comes back as ``Network Error``.
  const [showCloudShellHint, setShowCloudShellHint] = useState(false);
  // Legal & Fact Policies — consent banner and violation notice
  const [showViolationNotice, setShowViolationNotice] = useState(false);
  // ─── Notification bell state ──────────────────────────────────────
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  // Triggers a one-shot bell swing animation when a new notification
  // arrives (count increased). Reset after the animation duration.
  const [bellSwing, setBellSwing] = useState(false);
  // True while the live notification WebSocket is open. The 30s
  // unread-count HTTP poll is paused while the channel is live (it
  // becomes a reconciliation fallback when the socket drops).
  const [notifWsConnected, setNotifWsConnected] = useState(false);
  // Bumped when a live notification arrives so an already-open dropdown
  // re-fetches its list (ActivityTimeline re-runs its initial load on
  // refreshToken change).
  const [notifRefreshToken, setNotifRefreshToken] = useState(0);
  // Mirrors of the bell count for the chime/priming logic. The refs
  // avoid reading state inside a state updater (side effects belong
  // outside the reducer) and let us tell "first fetch on boot/login"
  // apart from "count actually grew" — pre-existing unread must NOT
  // ring the bell the moment the app opens.
  const notifCountRef = useRef(0);
  const notifPrimedRef = useRef(false);
  // Last user id whose unread counters were primed. The socket effect
  // resets the priming ONLY when the account actually changes — a new
  // `user` OBJECT for the same account (e.g. atelnyo:auth:user-updated
  // after a profile edit) must not zero the count ref, or a WS event
  // frame landing before the reconnect re-sync would chime for a
  // notification the user already saw.
  const notifUserIdRef = useRef(null);
  // Shared "one item was read" handler (dropdown + full page). Keeps
  // the badge state AND the count ref in lockstep so a subsequent
  // unread broadcast or poll never reintroduces a stale delta.
  const handleNotifRead = useCallback(() => {
    const next = Math.max(0, notifCountRef.current - 1);
    notifCountRef.current = next;
    setUnreadNotifCount(next);
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await activityFeedService.unreadCount();
      const count = res?.data?.unread ?? 0;
      setUnreadNotifCount(count);
      // Chime + bell swing only for a NEW notification — i.e. the count
      // grew AFTER the initial sync. The very first fetch (login/boot)
      // must stay silent even when the user already has unread items.
      if (notifPrimedRef.current && count > notifCountRef.current) {
        try {
          if (user?.notification_prefs?.sound ?? true) {
            playNotificationSound();
          }
        } catch {
          // best-effort
        }
        // Swing the bell once to draw attention to the new notification.
        setBellSwing(true);
        setTimeout(() => setBellSwing(false), 1000);
      }
      notifPrimedRef.current = true;
      notifCountRef.current = count;
    } catch {
      // best-effort
    }
  }, [user]);

  useEffect(() => {
    // fetchUnreadCount is async — the setState calls happen inside a
    // Promise resolution, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUnreadCount();
    // While the live notification socket is open it carries every
    // update in real time; the poll is only the reconciliation fallback
    // (socket down / token rejected / reconnecting).
    if (notifWsConnected) { return undefined; }
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount, notifWsConnected]);

  // ─── Real-time notification socket ─────────────────────────────
  // Opens on login, closes on logout. The server pushes new
  // ActivityFeedEvents over the channel layer instantly; the badge,
  // bell swing and chime all fire from the socket's authoritative
  // unread count — exactly like a foreground push, but without
  // waiting for the 30s poll.
  useEffect(() => {
    if (!user) {
      disconnectNotificationSocket();
      // The teardown branch resets socket state synchronously — same
      // pattern as the poll effect below.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotifWsConnected(false);
      return undefined;
    }
    // Fresh session/account — the very first unread sync must stay
    // silent (pre-existing unread from a previous login is not "new").
    // Only reset on an actual account switch (see notifUserIdRef above);
    // a same-account user refresh keeps the primed counters.
    if (notifUserIdRef.current !== user.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      notifPrimedRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      notifCountRef.current = 0;
      notifUserIdRef.current = user.id;
    }
    connectNotificationSocket({
      onEvent: ({ event, unread }) => {
        setNotifRefreshToken((n) => n + 1);
        const next = typeof unread === 'number' ? unread : notifCountRef.current + 1;
        setUnreadNotifCount(next);
        if (next > notifCountRef.current) {
          try {
            if (user?.notification_prefs?.sound ?? true) {
              playNotificationSound();
            }
          } catch {
            // best-effort
          }
          setBellSwing(true);
          setTimeout(() => setBellSwing(false), 1000);
        }
        notifCountRef.current = next;
        // Dispatch to chatbot for real-time display
        try {
          window.dispatchEvent(new CustomEvent('atelnyo:notif:new', { detail: { event, unread: next } }));
        } catch { /* non-critical */ }
      },
      onUnread: ({ unread, total }) => {
        if (typeof unread === 'number') {
          setUnreadNotifCount(unread);
          notifCountRef.current = unread;
        }
      },
      onStatus: ({ connected }) => {
        setNotifWsConnected(Boolean(connected));
        // Re-sync the badge whenever the channel (re)connects — a stale
        // count could have accumulated while the socket was down. The
        // consumer sends no prime frame (the handshake stays DB-free),
        // so this HTTP call is the source of truth on (re)connect.
        if (connected) { fetchUnreadCount(); }
      },
    });
    return () => disconnectNotificationSocket();
  }, [user]);

  // Esc closes the notification dropdown (paired with the
  // click-outside backdrop in the dropdown's JSX).
  useEffect(() => {
    if (!isNotifOpen) { return undefined; }
    const onKey = (e) => {
      if (e.key === 'Escape') { setIsNotifOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isNotifOpen]);

  // Declared before the proposal handlers below (their useCallback deps
  // reference showToast — a const referenced in a deps array before its
  // declaration trips react-hooks/exhaustive-deps).
  const showToast = (message, icon = 'info-circle') => {
    // MUST stay in sync with ``--toast-lifetime`` in src/styles/tokens.css
    // (the .toast-progress bar animates over the same 4000ms). The
    // ``leaving`` flag flips ~300ms before removal so the CSS scale/
    // fade-out (``.toast-leaving``) plays instead of an abrupt pop —
    // mirrors the entrance spring on the way out.
    const TOAST_LIFETIME_MS = 4000;
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, icon }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => (t.id === id ? { ...t, leaving: true } : t)));
    }, TOAST_LIFETIME_MS - 300);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, TOAST_LIFETIME_MS);
  };

  const handleAcceptProposal = useCallback(async (event) => {
    const proposalId = event?.data?.proposal_id;
    if (!proposalId) return;
    try {
      await proposalService.accept(proposalId, {});
      showToast?.(
        t2(lang, { ht: '✅ Proposal aksepte!', en: '✅ Proposal accepted!' }),
        'check-circle',
      );
      fetchUnreadCount();
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail || (t2(lang, { ht: 'Pa t kapab aksepte.', en: 'Could not accept.' })),
        'circle-exclamation',
      );
    }
  }, [lang, showToast, fetchUnreadCount]);

  const handleRejectProposal = useCallback(async (event) => {
    const proposalId = event?.data?.proposal_id;
    if (!proposalId) return;
    try {
      await proposalService.reject(proposalId, '');
      showToast?.(
        t2(lang, { ht: 'Proposal rejte.', en: 'Proposal rejected.' }),
        'ban',
      );
      fetchUnreadCount();
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail || (t2(lang, { ht: 'Pa t kapab rejte.', en: 'Could not reject.' })),
        'circle-exclamation',
      );
    }
  }, [lang, showToast, fetchUnreadCount]);

  const toggleTheme = () => {
    setThemeMode(isDark ? 'light' : 'dark');
  };

  // ─── Checkout (Phase 32 + PayPal PRIMARY) ──────────────────────
  // Opens the unified CheckoutModal. Requires an authenticated user;
  // anonymous visitors are bounced to the auth sheet.
  const handleOpenCheckout = (type, price, meta = {}) => {
    if (!user) {
      showToast(
        t2(lang, { ht: 'Konekte pou w peye.', en: 'Please log in to pay.' }),
        'user-lock',
      );
      setIsAuthOpen(true);
      return;
    }
    setCheckoutState({ type, meta: { ...meta, price } });
  };

  const handleLangChange = (newLang) => {
    setLang(newLang);
    localStorage.setItem('atelnyo_lang', newLang);
    // Continuity restore point — keeps lang in the async restore point
    // too (localStorage is the primary; this is the resilience copy).
    continuityManager.saveRestorePoint({ lang: newLang });
    // Market-aware language switch (spec §22): on a localized URL the
    // switcher KEEPS the market and rewrites the path into the new
    // language (/ht-HT/courses → /fr-HT/courses) — it never jumps to
    // a different country. On a bare URL it just applies + persists.
    if (parsedLocale.valid) {
      const next = switchLocale(rrLocation.pathname, { language: newLang });
      if (next && next !== rrLocation.pathname) {
        navigateRR(next, { replace: true });
      }
    }
    showToast(translations[newLang].lang_changed || 'Language changed', 'language');
  };

  // ─── Market/country switcher (spec §23) ───────────────────────────
  // Independent from the language switcher: changing market keeps the
  // current language when the market supports it (switchLocale handles
  // the fallback to the market's default language). The explicit choice
  // persists to atelnyo_market (device-level preference, same storage
  // layer as atelnyo_lang).
  const handleMarketChange = (newMarket) => {
    if (!MARKETS[newMarket]) { return; }
    setMarket(newMarket);
    localStorage.setItem('atelnyo_market', newMarket);
    const next = switchLocale(rrLocation.pathname, { country: newMarket });
    if (next && next !== rrLocation.pathname) {
      navigateRR(next, { replace: true });
    }
    showToast(
      lang === 'ht' ? `✅ Peyi chanje — ${newMarket}` : `✅ Country changed — ${newMarket}`,
      'globe',
    );
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setIsAuthOpen(false);
    // Refresh the permissions matrix so the new user's current_role
    // (e.g. 'authenticated') replaces the previously-cached
    // anonymous/null role. Without this, useRoleGate hooks read a
    // stale anonymous role and every self-service gate (apply_creator,
    // apply_spotlight, save_talent, etc.) stays DENY even though the
    // user just logged in successfully.
    permissionManager.refreshPermissionsMatrix().catch(() => {});
    // Fetch Session and Progress for the new user
    sessionService.get().then(sRes => {
      if (sRes.data.current_tab) {setActiveTab(sRes.data.current_tab);}
    }).catch(() => {});
    progressService.getAll().then(pRes => {
      setUserProgress(pRes.data);
    }).catch(() => {});
    favoriteService.getAll().then(fRes => {
      const favs = Array.isArray(fRes.data) ? fRes.data : (fRes.data?.results || []);
      setFavorites(favs.map(f => f?.course).filter(Boolean));
    }).catch(() => {});
    // ─── Register for web push notifications (lazy-loaded) ────────
    _loadFirebase().then(({ registerPushNotifications, sendTestPush }) => {
      registerPushNotifications((foregroundMsg) => {
        showToast(
          `🔔 ${foregroundMsg.title} — ${foregroundMsg.body}`,
          'bell',
        );
        notifCountRef.current += 1;
        setUnreadNotifCount(notifCountRef.current);
        setBellSwing(true);
        setTimeout(() => setBellSwing(false), 1000);
        try {
          if (userData?.notification_prefs?.sound ?? true) {
            playNotificationSound();
          }
        } catch {
          // sound is best-effort
        }
      }).then(() => {
        if (userData?.is_staff || userData?.is_superuser) {
          sendTestPush().then((result) => {
            if (result?.sent > 0) {
              showToast('📳 Tès push reyisi! ' + result.sent + ' aparèy reyisi.', 'check-circle');
            }
          }).catch(() => {});
        }
      }).catch(() => { /* FCM is non-critical */ });
    }).catch(() => { /* FCM is non-critical */ });
  };

  const handleLogout = async (reason = 'user') => {
    // Best-effort: tell the server to blacklist the current refresh token
    // so it can't be reused after we drop it client-side. We don't block the
    // local logout on this — if the request fails (e.g. already-expired
    // refresh) we still wipe localStorage and proceed.
    //
    // WHY skip the server call when ``reason='session_expired'``: on a
    // forced expiry the refresh token is already blacklisted server-side
    // (the /api/refresh/ call that triggered this forced-logout itself
    // returned 401). Hitting /api/logout/ again would just give us another
    // 401 and waste a request. Settings.jsx route passes 'user' so the
    // explicit Logout button still triggers the server-side blacklist.
    const refresh = localStorage.getItem('refresh_token');
    if (refresh && reason === 'user') {
      try { await authService.logout(refresh); } catch (e) { /* ignore — tokens may already be invalid */ }
    }
    // Wipe EVERYTHING auth-related.
    // ─── Unregister FCM push token (lazy-loaded, best-effort) ──────
    _loadFirebase().then(m => m.unregisterToken()).catch(() => {});
    clearTokenPair();
    // §38-§39 — Clear learning drafts + session states on logout.
    // User A's learning work must not leak into User B's session.
    import('./services/appStateStore').then(m => m.clearAppState()).catch(() => {});
    // Clear the Zustand auth store too — components gated on
    // useAuthStore (useAuth hook / auth flows) must flip to logged-out
    // at the same time as localStorage + App state, or they'd keep
    // surfacing the stale session.
    try { useAuthStore.getState().clearAuth(); } catch (_) { /* best-effort */ }
    // Refresh the permissions matrix so the stale 'authenticated'/
    // 'creator' role flips back to anonymous. Without this, a
    // browsing session after logout still sees apply_creator=true
    // and the Easter egg sections stay visible on the next Settings
    // open (even though the user is no longer signed in).
    permissionManager.refreshPermissionsMatrix().catch(() => {});
    setUser(null);
    setUserProgress([]);
    setActiveTab('explore');
    // Reason-aware toast: a forced expiry ≠ a user-clicked Logout, and
    // saying "Ou dekonekte!" when the user didn't click anything just
    // confuses them into thinking the server disconnected (see Profile
    // page auto-logout bug). Per-reason copy:
    const currentLang = langRef.current;
    // Dedupe: the boot 401 catch and the interceptor broadcast can both
    // arrive for the same dead token within the same tick — only the
    // first one should show the toast + modal.
    if (reason === 'session_expired') {
      const now = Date.now();
      if (now - lastForcedLogoutAtRef.current < 1500) { return; }
      lastForcedLogoutAtRef.current = now;
    }
    let toastMsg = currentLang === 'ht' ? 'Ou dekonekte!' : 'Logged out!';
    if (reason === 'session_expired') {
      toastMsg = currentLang === 'ht'
        ? 'Sesyon ou ekspire. Tanpri konekte ankò.'
        : 'Session expired. Please log in again.';
      // Unmissable blocking notice — the 4s toast is easy to miss on
      // full-screen /sheet/ routes (Creator Studio, wallet, etc.), and
      // a silent state flip looks like "the app kicked me out for no
      // reason". The modal explains WHY + offers a one-tap re-login.
      setSessionExpiredOpen(true);
    } else if (reason === 'password_changed') {
      toastMsg = currentLang === 'ht' ? 'Modpas chanje. Ou dekonekte.' : 'Password changed. Logged out.';
    } else if (reason === 'account_deleted') {
      toastMsg = currentLang === 'ht' ? 'Kont ou efase.' : 'Account deleted.';
    }
    showToast(toastMsg, 'sign-out-alt');
  };

  const refreshUser = () => {
    authService.getMe().then(res => {
      setUser(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
    }).catch(err => console.error("Refresh error:", err));
  };

  useEffect(() => {
    // Font size is now managed by ThemeProvider — sync legacy localStorage
    // key so persisted preference survives across old ↔ new code deployments.
    try { localStorage.setItem('atelnyo_fontsize', fontSize); } catch (_) {}
  }, [fontSize]);

  useEffect(() => {
    // ThemeProvider handles body class injection — keep legacy
    // localStorage key in sync for backward compat with any tools
    // or Playwright tests that read atelnyo_theme.
    try { localStorage.setItem('atelnyo_theme', isDark ? 'dark' : 'light'); } catch (_) {}
  }, [isDark]);

  // Load User and Session
  useEffect(() => {
    // JWT: Django-issued (access_token / legacy token) — TiDB-native auth.
    const token =
      localStorage.getItem('access_token')
      || localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        queueMicrotask(() => setUser(parsedUser));
      } catch { /* ignore corrupt cache */ }
    }

    // Listen for forced sign-outs triggered by the axios interceptor when the
    // refresh token is rejected by the server (e.g. expired/blacklisted).
    // Delegate to ``handleLogout`` so the reason-aware toast strings
    // (Session expired / Password changed / Account deleted) match the
    // event the server threw. We pull the ``reason`` from
    // ``event.detail`` (defined in api.js → broadcastLogout).
    const onForcedLogout = (e) => {
      handleLogout(e?.detail?.reason || 'session_expired');
    };
    window.addEventListener('atelnyo:auth:logout', onForcedLogout);

    // Creator Studio profile edits (PATCH /api/me/) dispatch this event
    // with the fresh UserSerializer blob so the app-wide ``user`` state
    // (Header avatar, username, is_creator gate) updates immediately —
    // no reload, no re-login required.
    const onUserUpdated = (e) => {
      if (e?.detail?.user) {
        setUser(e.detail.user);
        try { localStorage.setItem('user', JSON.stringify(e.detail.user)); } catch { /* ignore */ }
      }
    };
    window.addEventListener('atelnyo:auth:user-updated', onUserUpdated);

    if (token) {
      authService.getMe()
        .then(res => {
          const userData = res.data;
          setUser(userData);
          try { localStorage.setItem('user', JSON.stringify(userData)); } catch (_) {}

          // Restore Session from Backend
          sessionService.get().then(sRes => {
            if (sRes.data.current_tab) {
              setActiveTab(sRes.data.current_tab);
            }
          }).catch(() => {});

          // Load Progress & Favorites
          progressService.getAll().then(pRes => setUserProgress(pRes.data)).catch(() => {});
          favoriteService.getAll().then(fRes => {
            const favs = Array.isArray(fRes.data) ? fRes.data : (fRes.data?.results || []);
            setFavorites(favs.map(f => f?.course).filter(Boolean));
          }).catch(() => {});
        })
        .catch((err) => {
          console.error("Auth error:", err);
          if (err.response?.status === 401) {
            // 401 on boot's /api/me/ means the stored refresh token is
            // dead — pass 'session_expired' so the user sees
            // "Session expired. Please log in again." instead of the
            // misleading "Ou dekonekte!" (which implies they clicked).
            handleLogout('session_expired');
          }
        });
    }

    // ─── Proactive session-health check ─────────────────────────
    // The 30s unread-count poll covers the main app, but on a tab the
    // user parked (or a sheet route with no authed traffic) a dead
    // token stays invisible until the next action. Re-validating on
    // focus/page-show means expiry is caught the moment the user comes
    // back — the axios 401 interceptor then wipes tokens and broadcasts
    // atelnyo:auth:logout, which surfaces the session-expired modal.
    // (The same check also runs via the Continuity consumer hook on
    // the ``returned`` / ``staleSession`` rising edges — §6 step #5.)
    window.addEventListener('focus', revalidateSessionHealth);
    window.addEventListener('pageshow', revalidateSessionHealth);

    return () => {
      window.removeEventListener('atelnyo:auth:logout', onForcedLogout);
      window.removeEventListener('atelnyo:auth:user-updated', onUserUpdated);
      window.removeEventListener('focus', revalidateSessionHealth);
      window.removeEventListener('pageshow', revalidateSessionHealth);
    };
  }, [revalidateSessionHealth]);

  const toggleFavorite = (courseId) => {
    if (!user) {
      showToast(t2(lang, { ht: 'Ou dwe konekte pou w mete yon kou nan favori.', en: 'Login to favorite a course.' }), 'user-lock');
      setIsAuthOpen(true);
      return;
    }

    const isFav = favorites.includes(courseId);
    
    // Optimistic Update
    if (isFav) {
      setFavorites(prev => prev.filter(id => id !== courseId));
      favoriteService.remove(courseId).catch(() => {
        setFavorites(prev => [...prev, courseId]); 
        showToast('Erè nan koneksyon.', 'exclamation-triangle');
      });
    } else {
      setFavorites(prev => [...prev, courseId]);
      favoriteService.create(courseId).catch(() => {
        setFavorites(prev => prev.filter(id => id !== courseId));
        showToast('Erè nan koneksyon.', 'exclamation-triangle');
      });
    }
  };

  // Sync Session Tab to Backend
  useEffect(() => {
    if (user) {
      sessionService.update({ current_tab: activeTab });
    }
  }, [activeTab, user]);

  // ─── Continuity: persist + restore where the user is (§6 #5) ────
  // activeTab → restore point (debounced; the backend sync above stays
  // the server-side source for logged-in sessions — this is the local
  // offline-first copy that also works signed-out and off-line).
  useEffect(() => {
    const timer = setTimeout(() => {
      continuityManager.saveRestorePoint({ activeTab });
    }, 400);
    return () => clearTimeout(timer);
  }, [activeTab]);

  // Per-route scroll: SAVE (throttled, trailing) — the restore point
  // owns _scrollPositions; read/written only via the manager façades.
  // Scoped to the MAIN surface (``!isSheetRoute``): while a detail /
  // sheet page scrolls, its position must NEVER be written into the
  // catalog tab's slot — that was the "scrolling down one surface
  // affects another" bleed (the detail's scrollY overwrote the
  // catalog's saved position). ScrollManager owns sheet-route
  // positioning; this saver only tracks tab positions on ``/``.
  useEffect(() => {
    let lastSave = 0;
    const onScroll = () => {
      if (scrollRestoringRef.current) return;
      if (isSheetRouteRef.current) return; // sheet routes: no tab-slot writes
      const now = Date.now();
      if (now - lastSave < 800) return;
      lastSave = now;
      if (typeof window === 'undefined') return;
      continuityManager.saveScrollPosition(activeTabRef.current, window.scrollY);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Suppress scroll-saves from the moment a tab change commits — the
  // layout effect runs BEFORE paint, so a layout-clamp scroll event
  // from the new tab's shorter content can never write the OLD tab's
  // position under the NEW tab's key before the restore reads it.
  useLayoutEffect(() => {
    scrollRestoringRef.current = true;
  }, [activeTab]);

  // Per-route scroll: RESTORE on tab change (and on boot — the first
  // run restores the starting tab's position, which is 0 on a fresh
  // launch and the saved one on a relaunch).
  useEffect(() => {
    let alive = true;
    continuityManager.restoreScrollPosition(activeTab).then((y) => {
      if (!alive || typeof window === 'undefined') return;
      if (y > 0) {
        window.scrollTo(0, y);
        // Release the suppress flag once the restore settles — the
        // scrollTo above fires a scroll event; the short grace window
        // covers the same-position case where no event fires.
        setTimeout(() => { scrollRestoringRef.current = false; }, 100);
      } else {
        scrollRestoringRef.current = false;
      }
    });
    return () => { alive = false; };
  }, [activeTab]);

  useEffect(() => {
    // Async fetch: synchronous first-statement setState resets the
    // skeleton before the network request — same intentional pattern
    // as CheckoutModal.jsx / DepositModal.jsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoadingCourses(true);
    courseService.getAll()
      .then(res => {
        try {
          const courseList = unwrapList(res.data);
          if (courseList.length) {
            // Shuffle the order of courses to randomize them on every refresh.
            // We intentionally do NOT filter titles (an earlier version hid
            // any course whose title contained "Pro" via /\bpro\b/i — that
            // dropped real sellable courses like "Python Pro (Automation)"
            // from commerce + favori even after the user enrolled via the
            // Wizard, which reads `selectedCourse` directly and bypassed
            // this filter). Every course the API returns is rendered.
            const shuffled = shuffleArray(courseList);
            setCourses(shuffled);
            setFilteredCourses(shuffled);
          }
        } catch (innerErr) {
          console.error('Inner react logic error:', innerErr);
          showToast('Erè entèn: ' + innerErr.message, 'exclamation-triangle');
        }
      })
      .catch(err => {
        console.error('Error fetching courses:', err);
        showToast('Erè nan koneksyon ak sèvè a: ' + (err.response?.statusText || err.message), 'exclamation-triangle');
      })
      .finally(() => setIsLoadingCourses(false));
  }, []);

  const handleSearch = (query) => {
    const filtered = courses.filter(course => 
      course.title.toLowerCase().includes(query.toLowerCase()) ||
      course.description.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredCourses(filtered);
  };

  const t = translations[lang] || translations['ht'];
  const navigateRR = useSafeNavigate();
  const rrLocation = useLocation();
  // ─── Locale-market resolution from the URL (Phase 4) ─────────────
  // parsedLocale is the ONLY reader of the leading locale segment:
  //   • valid combo (/ht-HT/…) → explicit context
  //   • invalid attempt (/fr-XX/) → NotFound (early return below)
  //   • 'not-localized'        → normal app
  // effectivePathname = the path WITHOUT the locale segment — used for
  // chrome decisions (isSheetRoute) and to remap <Routes> so the SAME
  // route tree serves both bare and localized URLs (one copy of every
  // component — no per-language route definitions).
  const { parsedLocale, effectivePathname, effectiveLocation } = useLocalePath(rrLocation);

  // URL intent drives lang/market while on a localized URL (spec §30 —
  // Detection ≠ Routing; explicit URL wins). Cold loads are covered by
  // the lazy useState initializers above; explicit user actions by the
  // switcher handlers; browser back/forward between DIFFERENT localized
  // URLs by <LocaleSync> (rendered below) — a tiny child component that
  // owns the sync so App's own hooks stay compiler-clean.
  // URL locale intent -> app state (back/forward gap only; see LocaleSync).
  const handleLocaleResolved = useCallback((language, country) => {
    setLang(language);
    setMarket(country);
  }, [lang, market]);
  // ── Notification bell ────────────────────────────────────────────
  // Click: an ANONYMOUS user goes to /sheet/auth (same behavior as
  // NotificationsPage's own guard) — the bell must never silently
  // toggle an empty dropdown. Logged-in users toggle the dropdown.
  const handleBellClick = useCallback(() => {
    if (!user) {
      setIsNotifOpen(false);
      requireLogin(navigateRR, rrLocation, SHEETS.AUTH);
      return;
    }
    setIsNotifOpen((o) => !o);
  }, [user, navigateRR, rrLocation]);
  // ─── Affiliate attribution: capture #aff_token=<JWT> eagerly ───────
  // The /go/<code> redirect lands the visitor with the attribution JWT in
  // the URL fragment. The fragment is dropped on the FIRST SPA navigation
  // (react-router replaces the whole URL), so waiting until CheckoutModal
  // opens would lose the token for general-link landings (/creator/…).
  // Capture it into sessionStorage on every route change — idempotent and
  // cheap (a hash check) — so it survives navigation until checkout.
  useEffect(() => {
    captureAffiliateToken();
  }, [rrLocation]);
  // Memoized so components using onNavigate prop get a stable callback.
  // Wrapped in startTransition because most routes are React.lazy —
  // suspending during a synchronous click handler throws error #426
  // (black page). startTransition makes the update non-urgent so
  // React catches the suspension via Suspense instead.
  const handleNavigate = useCallback((url, opts) => {
    startTransition(() => { navigateRR(url, opts); });
  }, [navigateRR]);

  // ─── Phase 59 — creator decides on a profile invitation ──────────
  // Accepting (hire / collab / book) opens the auto-created DM thread
  // so the creator can discuss details with the requester; rejecting
  // just marks the event. Both notify the requester (backend).
  const handleAcceptRequest = useCallback(async (event) => {
    const eventId = event?.id;
    if (!eventId) return;
    try {
      await activityFeedService.respond(eventId, 'accept');
      showToast?.(
        t2(lang, { ht: '✅ Demann aksepte! Konvèsasyon louvri.', en: '✅ Request accepted! Conversation opened.' }),
        'check-circle',
      );
      fetchUnreadCount();
      // Land the creator in the new thread (top of the inbox list).
      navigateRR('/sheet/messages');
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail || (t2(lang, { ht: 'Pa t kapab aksepte.', en: 'Could not accept.' })),
        'circle-exclamation',
      );
    }
  }, [lang, showToast, fetchUnreadCount, navigateRR]);

  const handleRejectRequest = useCallback(async (event) => {
    const eventId = event?.id;
    if (!eventId) return;
    try {
      await activityFeedService.respond(eventId, 'reject');
      showToast?.(
        t2(lang, { ht: 'Demann rejte.', en: 'Request rejected.' }),
        'ban',
      );
      fetchUnreadCount();
      // Refresh the open dropdown so the row flips to its status chip.
      setNotifRefreshToken((n) => n + 1);
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail || (t2(lang, { ht: 'Pa t kapab rejte.', en: 'Could not reject.' })),
        'circle-exclamation',
      );
    }
  }, [lang, showToast, fetchUnreadCount, setNotifRefreshToken]);
  // /sheet/* OR /creator/* — either one suppresses the global app chrome
  // (Header / .container / Footer) so the dedicated page component renders
  // full-viewport. The Creator Public Profile (/creator/:username) is NOT
  // under /sheet/, so without this gate the main chrome would stay visible
  // underneath the profile — a broken double render.
  const isSheetRoute = effectivePathname.startsWith('/sheet/') || effectivePathname.startsWith('/creator/') || effectivePathname.startsWith('/portfolio/') || effectivePathname.startsWith('/marketplace/') || effectivePathname.match(/^\/c\//) || effectivePathname.match(/^\/(@|%40)/i) || effectivePathname.startsWith('/legal/') || effectivePathname === '/themes' || effectivePathname === '/faq' || effectivePathname === '/help' || effectivePathname === '/about' || effectivePathname === '/trust' || effectivePathname === '/contact' || effectivePathname === '/accessibility' || effectivePathname === '/status' || effectivePathname === '/developers' || effectivePathname === '/verify' || effectivePathname.startsWith('/affiliate') || effectivePathname.startsWith('/page/') || effectivePathname.startsWith('/company/') || effectivePathname === '/business' || effectivePathname.startsWith('/business/') || effectivePathname === SHEETS.LOGIN || effectivePathname === SHEETS.SIGNUP || isContentRoutePath(effectivePathname) || effectivePathname === '/explore' || effectivePathname.startsWith('/explore/');

  // ─── Sheet isolation ────────────────────────────────────────────────
  // Phase 36.1 — toggles `body.sheet-open` whenever the URL is under
  // /sheet/* (any sheet route, including deep sub-routes like
  // /sheet/community/:slug/events). The matching CSS rule in
  // ``styles/index.css`` (search for ``body.sheet-open``) hides the
  // root <Header> + .container (Tabs + <main> Explore + Footer) so
  // the underlying app chrome doesn't bleed through under the
  // sheet surface. Atelier (the ONLY pre-existing fixed-position
  // overlay) already has its own ``body.atelier-open`` class for
  // scroll lock — we DON'T add it here because community/calendar/
  // analytics/referral sheets want native body scrolling, not a
  // trapped scroll container.
  //
  // ``display: none`` (vs conditional React rendering) is intentional
  // — it keeps the underlying components MOUNTED so closing a sheet
  // and returning to ``/`` doesn't re-fetch / scroll-rest the
  // Explore page from scratch. The class also works for the existing
  // fixed-position sheets (Atelier z-5000, MusicSheet z-2000) because
  // hiding the underlying chrome just removes the bleed-through; the
  // sheet's own positioning still layers on top.
  useEffect(() => {
    if (isSheetRoute) {
      document.body.classList.add('sheet-open');
    } else {
      document.body.classList.remove('sheet-open');
    }
    // Belt-and-suspenders cleanup so a future App remount (HMR,
    // tests, error-boundary recovery) doesn't leave the body class
    // stranded if the new mount boots on a non-sheet route.
    return () => { document.body.classList.remove('sheet-open'); };
  }, [isSheetRoute]);

  // Sync the scroll-saver's sheet-route mirror (declared early to avoid
  // TDZ — the saver effect above reads it; this sync runs after the
  // computation so the value is live).
  useEffect(() => {
    isSheetRouteRef.current = isSheetRoute;
  }, [isSheetRoute]);

  // Phase 58 — hide the bottom nav when the inline Settings overlay
  // is open. We use a body class instead of the sibling selector
  // because Settings is rendered AFTER BottomNavBar in the DOM,
  // so `.settings-overlay.active ~ .bottom-nav-bar` never matches.
  useEffect(() => {
    if (isSettingsOpen) {
      document.body.classList.add('settings-open');
    } else {
      document.body.classList.remove('settings-open');
    }
    return () => { document.body.classList.remove('settings-open'); };
  }, [isSettingsOpen]);

  // ─── Geo-hint: auto-apply language on first visit (Phase 46) ──────────
  // Fires ONCE on mount when the user has no atelnyo_lang key in
  // localStorage. Calls /api/geo/hint/ (anonymous, no auth required)
  // and applies the suggested_lang. If the user already has a stored
  // lang preference, the effect short-circuits — the override contract
  // is that a user's explicit choice is NEVER silently overwritten.
  //
  // Phase 60.2 — INSTANT + NO REDIRECT + NO PRESUMPTUOUS PROMPT:
  //   * No URL redirect — the detected country/lang are applied in-app
  //     only (the bare URL stays put; the localized /en-US/ URLs remain
  //     available to visitors who arrive on them or use the switcher).
  //   * The result is written to the LocationCache (localStorage), so
  //     the NEXT visit resolves country + language synchronously at
  //     boot — like a logo that appears before the API even answers.
  //   * The detected language is applied for EVERY first-time visitor
  //     (diaspora included) — no "Kreyòl Ayisyen?" toast: the platform
  //     does not know who the visitor is, so it never assumes.
  useEffect(() => {
    if (localStorage.getItem('atelnyo_lang')) {return;} // Explicit choice already made
    // Localized URLs are an explicit context (spec §21/§30) — never
    // auto-detect or suggest a language over them.
    if (parseLocaleCountry(rrLocation.pathname).valid) {return;}
    // Phase 60.2 — INSTANT path: a fresh cached detection (written by
    // a previous visit) already resolved the lang synchronously in the
    // initializer above — do NOT re-hit the API. This is the "like a
    // logo" behavior: zero network on repeat visits.
    if (locationCache.isFresh() && locationCache.get()?.country) {return;}
    // Use window.fetch directly (bypasses axios interceptor) so
    // Playwright's page.route() interception works reliably.
    // The geo endpoint is anonymous (no auth required), so the
    // interceptor's token-attachment logic is unnecessary here.
    // URL is built from API_URL (VITE_API_BASE_URL) so local dev
    // pointing at the deployed API doesn't hit the vite proxy's
    // dead 127.0.0.1:8000 backend (hardcoded '/api/...' → 500).
    window.fetch(`${API_URL}geo/hint/`)
      .then((r) => r.json())
      .then((data) => {
        const { suggested_lang, is_default } = data;
        const country = data?.country ? String(data.country).toUpperCase() : null;
        // Phase 4 — keep the detected country for LocaleProvider's
        // detection fallback (bare root, no explicit choice yet).
        setDetectedGeo(country ? { country, confidence: 0, sources: ['geoip'] } : null);
        // Phase 60.2 — cache the detection so the NEXT visit shows the
        // country + language INSTANTLY at boot (no network at all).
        // Only derived data is stored (country code + suggested lang +
        // timestamp) — never the IP, never coordinates.
        if (country) {
          try {
            locationCache.set({
              country,
              confidence: 0,
              sources: ['geoip'],
              conflict: { detected: false, description: null },
              isDefault: is_default === true,
              suggestedLang: suggested_lang || defaultLanguageFor(country),
              timestamp: Date.now(),
            });
          } catch (_) { /* private mode / quota — in-memory still works */ }
        }
        // Phase 60.2 — apply the detected language for EVERY first-time
        // visitor (diaspora included) so the page never sits stuck in
        // the default 'ht' while the toast waits for an answer. The
        // browser-locale initializer above gave instant display; the
        // authoritative server hint refines it here.
        if (suggested_lang && ['ht','en','es','fr'].includes(suggested_lang)) {
          setLang(suggested_lang);
          try { localStorage.setItem('atelnyo_lang', suggested_lang); } catch (_) {}
        }
      })
      .catch(() => {});
  }, []);  

  // ─── Cloud Shell Web Preview hint (Phase 47) ──────────────────────────────────
  // Fires ONCE on mount when:
  //   1. ``window.location.hostname`` ends with ``cloudshell.dev``
  //      (Google Cloud Shell Web Preview origin pattern).
  //   2. The user has not yet dismissed this hint
  //      (``atelnyo_cloudshell_hint_dismissed`` !== '1' in localStorage).
  //
  // We do NOT gate on any network call — the hint must surface even
  // when every API call is failing (which is exactly the situation
  // we want to explain). The dismissal flag is per-origin per-browser
  // so a developer who legitimately moves between Web Preview and a
  // local tunnel will see the hint again after ``localStorage.clear()``
  // but not on every page reload.
  //
  // SSR / Node test harness safe — the function is wrapped in a
  // ``typeof window`` guard so module-load on the server doesn't throw.
  useEffect(() => {
    if (typeof window === 'undefined') {return;}
    try {
      const host = window.location && window.location.hostname;
      if (typeof host !== 'string' || !host.endsWith('cloudshell.dev')) {return;}
      if (localStorage.getItem('atelnyo_cloudshell_hint_dismissed') === '1') {return;}
      // One-shot mount-only detection (runs once via the empty deps) —
      // intentional state set, not a cascade.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowCloudShellHint(true);
    } catch (_) {
      // localStorage may be disabled in a sandboxed iframe — surface
      // the hint anyway so the developer at least sees the message.
      try { setShowCloudShellHint(true); } catch (__) {}
    }
  }, []);  

  // Routing / View Logic
  const renderContent = () => {
    switch (activeTab) {
      case 'commerce':
        return (
          <div className="fade-in-up">
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <h2 className="explore-hero-title">{t.hero_title}</h2>
              <p dangerouslySetInnerHTML={{ __html: t.hero_desc }} />
            </div>

            <SearchBar lang={lang} translations={translations} onSearch={handleSearch} />
            
            <div className="product-grid">
              {isLoadingCourses ? (
                [1, 2, 3, 4].map(i => <SkeletonCard key={i} />)
              ) : filteredCourses.length > 0 ? filteredCourses.map(course => (
                <div key={course.id} className="product-card" onClick={() => { setSelectedCourse(course); setActiveTab('description'); }}>
                  {course.is_featured && <div className="badge-featured"><i className="fas fa-star" /> {t.featured_badge}</div>}
                  <div className="favorite-btn" onClick={(e) => { e.stopPropagation(); toggleFavorite(course.id); }} style={{
                    position: 'absolute', top: '10px', right: '10px', zIndex: 20, background: 'rgba(255,255,255,0.9)', 
                    width: '35px', height: '35px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: favorites.includes(course.id) ? 'var(--pink-primary)' : '#ccc', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                  }}>
                    <i className={favorites.includes(course.id) ? 'fas fa-heart' : 'far fa-heart'} />
                  </div>
                  <div className="product-image-container" style={{ width: '100%', aspectRatio: '16/9', overflow: 'hidden', borderRadius: '12px', marginBottom: '15px' }}>
                    <img 
                      src={course.image_url} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      alt={course.title}
                      onError={(e) => { e.target.src = `https://via.placeholder.com/600x340/d81b60/ffffff?text=${encodeURIComponent(course.title)}` }}
                    />
                    <div className="product-overlay">{t.full_details_title}</div>
                  </div>
                  <span className="product-name">{course.title}</span>
                  <span className="product-price"><span className="price-label">{t.price_label}</span> ${course.price}</span>
                  {/* Enskri: menm aksyon ak kat la (ouvri detay kou a) —
                      bouton an pa t janm gen onClick, kidonk li te sanble
                      mouri. */}
                  <button type="button" className="btn-action" onClick={() => { setSelectedCourse(course); setActiveTab('description'); }}>
                    {t.enroll_btn}
                  </button>
                </div>
              )) : (
                <div style={{ textAlign: 'center', gridColumn: '1 / -1', padding: '50px' }}>
                   <p>Pa gen okenn kou ki jwenn.</p>
                </div>
              )}
            </div>

            <Features lang={lang} translations={translations} />
            
            {user && (
              <DashboardPreview 
                lang={lang} 
                translations={translations} 
                userProgress={userProgress} 
                courses={courses}
              />
            )}

            <Stats lang={lang} translations={translations} />
            <Newsletter lang={lang} t={t} />
            <FAQ lang={lang} translations={translations} />
          </div>
        );
      case 'description':
        return selectedCourse ? (
          <CourseDetail 
            course={selectedCourse} 
            lang={lang} 
            translations={translations} 
            onBack={() => setActiveTab('explore')}
            onEnroll={() => setIsWizardOpen(true)}
            user={user}
            showToast={showToast}
            onAuthOpen={() => setIsAuthOpen(true)}
          />
        ) : (
          <NotFound lang={lang} onBack={() => setActiveTab('explore')} />
        );
      case 'product-detail':
        return selectedProduct ? (
          <ProductDetail
            product={selectedProduct}
            lang={lang}
            onBack={() => { setSelectedProduct(null); setActiveTab('explore'); }}
            onOpenCheckout={(type, price, meta) => handleOpenCheckout(type, price, meta)}
            user={user}
            showToast={showToast}
          />
        ) : (
          <NotFound lang={lang} onBack={() => setActiveTab('explore')} />
        );
      case 'favori':
        return (
          <div className="fade-in-up">
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <h2 style={{ color: 'var(--pink-primary)' }}>Favori m yo</h2>
              <p>Tout kou ou renmen yo kote yo ye a.</p>
            </div>
            {favorites.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px' }}>
                <i className="far fa-heart" style={{ fontSize: '3rem', color: 'var(--text-secondary)', marginBottom: '20px' }} />
                <p>Ou poko gen okenn kou nan favori.</p>
                <button className="btn-action" onClick={() => setActiveTab('explore')} style={{ width: 'auto' }}>Wè tout kou yo</button>
              </div>
            ) : (
                <div className="product-grid">
                    {courses.filter(c => favorites.includes(c.id)).map(course => (
                        <div key={course.id} className="product-card" onClick={() => { setSelectedCourse(course); setActiveTab('description'); }}>
                            <span className="product-name">{course.title}</span>
                            <button className="btn-action">Detay</button>
                        </div>
                    ))}
                </div>
            )}
          </div>
        );
      case 'explore':
        return (
          <Explore
            user={user}
            lang={lang}
            translations={translations}
            onOpenCourse={(course) => navigateRR(buildContentUrl('course', course), { state: { course } })}
            onOpenMusicSheet={(track) => navigateRR(buildContentUrl('music', track), { state: { track } })}
            onOpenTalentSheet={(talent) => navigateRR(buildContentUrl('talent', talent), { state: { talent } })}
            onOpenJobSheet={(job) => navigateRR(buildContentUrl('job', job), { state: { job } })}
            onOpenProduct={(product) => { setSelectedProduct(product); navigateRR(buildContentUrl('product', product)); }}
            onOpenPortfolio={(project) => navigateRR(buildContentUrl('portfolio', project), { state: { project } })}
            onOpenCheckout={(type, price, meta) => handleOpenCheckout(type, price, meta)}
            showToast={showToast}
          />
        );
      case 'mwen':
        return (
          <Mwen
            user={user}
            lang={lang}
            translations={translations}
            showToast={showToast}
            onOpenTalentSheet={(talent) => navigateRR(buildContentUrl('talent', talent), { state: { talent } })}
            onOpenMusicSheet={(track) => navigateRR(buildContentUrl('music', track), { state: { track } })}
            onOpenJobSheet={(job) => navigateRR(buildContentUrl('job', job), { state: { job } })}
            onOpenExplore={() => setActiveTab('explore')}
          />
        );
      case 'admin':
        navigateRR(SHEETS.ADMIN_DASHBOARD);
        return null;
      case 'rules':
        return <Rules lang={lang} translations={translations} />;
      default:
        return <NotFound lang={lang} onBack={() => setActiveTab('explore')} />;
    }
  };

  // Tabs that have their own dedicated shell (no app chrome, no
  // header / tabs / footer / container). When we add a new fullscreen
  // tab, follow the "early return with a minimal shell" pattern so
  // the global chrome is completely absent from the DOM rather than
  // conditionally hidden inside a shared shell — it can't bleed
  // through, scale the entry card, or race the fullscreen surface's
  // z-index.

  // ─── navActiveTab (BottomNavBar highlight) ────────────────────────────
  // Drive the bar's .active highlight from the URL when a sheet route is
  // mounted — otherwise the React ``activeTab`` state (which only tracks
  // root-level tab clicks) leaves the wrong button highlighted while the
  // user is looking at Settings / Talent / Calendar / Community etc.
  //   /sheet/settings          → 'settings'
  //   /sheet/auth              → null (no highlight while sign-in is up)
  //   /sheet/explore/*, calendar, analytics, atelier, community/*  → 'explore'
  //   /sheet/referral          → 'mwen' (referral belongs to "mine")
  //   inline Settings overlay  → 'settings' (isSettingsOpen=true)
  //   root (/)                 → activeTab (user-clicked Explore/Mwen)

  // u2500u2500u2500 PWA Native Experience u2500u2500u2500
  // Phase 57 u2014 adaptive UI: add pwa-installed body class when running
  // as an installed PWA. CSS rules in pwa-upgrade.css remove browser chrome,
  // apply safe-area-inset padding, and optimize touch interactions.
  // Phase 58 u2014 pull-to-refresh: on installed PWA, swipe-down at the top
  // of the main scroll container refreshes the course list with haptic
  // feedback, matching native Android pull-to-refresh behaviour.
  useEffect(() => {
    // ─── PWA Native Experience ──────────────────────────────────────
    // ``pwa-installed`` body class drives the adaptive PWA CSS. The
    // answer comes from the App Controller (which composes the
    // Installation Manager's install state) and is REACTIVE — if the
    // user installs mid-session (accept dialog → browser installs →
    // standalone detection), the class applies immediately instead of
    // only at the next page load.
    const applyPwaClass = (runtime) => {
      try {
        document.body.classList.toggle('pwa-installed', !!runtime.installed);
      } catch (_) {}
    };
    applyPwaClass(appController.getRuntime());
    const unsubscribe = appController.subscribe(applyPwaClass);
    // Listen for SW messages (background sync trigger) — App Controller
    // integration: the SW tells the app to drain the offline queue.
    const onSwMsg = (event) => {
      if (event.data?.type === 'PROCESS_OFFLINE_QUEUE') {
        import('./services/offlineQueue').then(m => m.default.process()).catch(() => {});
      }
    };
    navigator.serviceWorker?.addEventListener('message', onSwMsg);
    return () => {
      unsubscribe();
      navigator.serviceWorker?.removeEventListener('message', onSwMsg);
    };
  }, []);

  // Phase 58 u2014 pull-to-refresh on main content when installed as PWA
  usePullToRefresh(() => {
    if (isLoadingCourses) return;
    import('./hooks/useHaptic').then(m => m.default()?.success?.()).catch(() => {});
    setIsLoadingCourses(true);
    courseService.getAll()
      .then(res => {
        try {
          const courseList = unwrapList(res.data);
          if (courseList.length) {
            const shuffled = shuffleArray(courseList);
            setCourses(shuffled);
            setFilteredCourses(shuffled);
          }
        } catch (innerErr) {
          console.error('Pull-to-refresh error:', innerErr);
        }
      })
      .catch(err => {
        console.error('Pull-to-refresh network error:', err);
      })
      .finally(() => setIsLoadingCourses(false));
  });

  // Phase 57 u2014 state preservation: save active tab + route on change,
  // restore on first mount for seamless PWA resume.
  useEffect(() => {
    import('./services/appStateStore').then(m => m.saveAppState({ activeTab, lang })).catch(() => {});
  }, [activeTab, lang]);
  const navActiveTab = (() => {
    if (isSheetRoute && rrLocation) {
      // Effective path (locale segment stripped) so the bottom-nav
      // highlights correctly on localized sheets (/ht-HT/sheet/…).
      const p = effectivePathname;
      if (p === SHEETS.SETTINGS) {return 'settings';}
      // Auth surfaces (legacy /sheet/auth + canonical /login, /signup)
      // render the same modal — no bottom-nav tab should stay lit.
      if (p === SHEETS.AUTH || p === SHEETS.LOGIN || p === SHEETS.SIGNUP) {return null;}
      if (p.startsWith('/sheet/explore/') ||
          p === SHEETS.CALENDAR ||
          p === SHEETS.ANALYTICS ||
          p === SHEETS.ATELIER ||
          p.startsWith('/sheet/community/')) {return 'explore';}
      if (p === SHEETS.REFERRAL) {return 'mwen';}
      // Phase 50 — Creator Apply is reached from Settings, so the
      // settings tab stays highlighted. Keeps the bottom-nav indicator
      // consistent with where the user came from.
      if (p === SHEETS.CREATOR_APPLY) {return 'settings';}
      if (p === SHEETS.NOTIFICATIONS) {return null;}
      if (p === SHEETS.WALLET) {return null;}
      if (p.startsWith('/sheet/spotlight/')) {return 'explore';}
      if (p.startsWith('/portfolio/')) {return 'explore';}
      if (p.startsWith('/marketplace/')) {return 'explore';}
      // Canonical content deep-links — /{id}@{user}/{type}.
      if (isContentRoutePath(p)) {return 'explore';}
      return activeTab;
    }
    return isSettingsOpen ? 'settings' : activeTab;
  })();

  // Language-aware social/brand meta (slogan banner + titles). The static
  // index.html ships the default (ht) tags for crawlers that don't run JS;
  // this root Helmet keeps title / og:title / og:image / description in
  // sync with the app language so shared links carry the right banner.
  // Nested page-level Helmet (product, spotlight, ...) overrides these
  // per-route as designed by react-helmet-async.
  // OG / social meta is ALWAYS English for consistent sharing across
  // languages. The <title> tag follows the app language for in-tab UX.
  const brandMetaLocalized = {
    en: { title: 'Atelnyo — Learn, Create, Share | Online Courses, Music, Products' },
    ht: { title: 'Atelnyo — Aprann, Kreye, Pataje | Kou, Mizik, Pwodwi' },
    es: { title: 'Atelnyo — Aprende, Crea, Comparte | Cursos, Música, Productos' },
    fr: { title: 'Atelnyo — Apprenez, Créez, Partagez | Cours, Musique, Produits' },
  };
  const brandMeta = {
    title: brandMetaLocalized[lang]?.title || brandMetaLocalized.en.title,
    ogTitle: 'Atelnyo — Explore Courses, Music, Talent & More',
    ogImage: '/og-banner-en.svg',
    desc: 'An international platform where creators teach online courses, share music, sell products, and grow their digital presence. Explore 50+ creators and start learning today.',
  };
  const ogImageUrl = brandMeta.ogImage
    ? new URL(brandMeta.ogImage, window.location.origin).href
    : '';

  // ─── Locale URL validation (spec §38) ─────────────────────────────
  // A path that LOOKS like a locale attempt but is not a supported
  // combination (/fr-XX/, /zz-US/, /es-HT/…) must never render a fake
  // page — NotFound instead. Pure non-locale paths (reason
  // 'not-localized') pass through to the normal app. All hooks have
  // already run by this point, so this early return is safe.
  if (parsedLocale.reason && parsedLocale.reason !== 'not-localized') {
    return (
      <LocaleProvider pathname={rrLocation.pathname} detected={detectedGeo} userLanguage={lang} userMarket={market}>
        <NoindexRoute />
        <Helmet>
          <html lang={market ? `${lang}-${market}` : lang} />
          <title>{t2(lang, { ht: '404 — Paj Pa Jwenn', fr: '404 — Page non trouvée', es: '404 — Página no encontrada', en: '404 — Page Not Found' })} — Atelnyo</title>
          {/* Invalid locale combos are 404s — never index them. */}
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <NotFound lang={lang} onBack={() => navigateRR('/')} />
      </LocaleProvider>
    );
  }

  return (
    <LocaleProvider pathname={rrLocation.pathname} detected={detectedGeo} userLanguage={lang} userMarket={market}>
    <div className="App">
      <SkipNavigation lang={lang} />
      <NoindexRoute />
      {/* Injects admin-configured head codes (verification meta, analytics,
          pixel, custom HTML/scripts) from /api/config/public/. */}
      <HeadInjector />
      <Helmet>
        <html lang={market ? `${lang}-${market}` : lang} />
        <title>{brandMeta.title}</title>
        <meta name="description" content={brandMeta.desc} />
        <meta property="og:title" content={brandMeta.ogTitle} />
        <meta property="og:description" content={brandMeta.desc} />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="fb:app_id" content="934278055774246" />
        {/* og:locale uses the full language_TERRITORY form (en_US, fr_CA,
            ht_HT…) so crawlers + sharers know both the language AND the
            market the page is serving. Fall back to the default market
            when the bare root has no market yet. */}
        <meta property="og:locale" content={`${lang}_${market || DEFAULT_MARKET}`} />
        <meta name="twitter:title" content={brandMeta.ogTitle} />
        <meta name="twitter:description" content={brandMeta.desc} />
        <meta name="twitter:image" content={ogImageUrl} />
        <meta name="twitter:image:alt" content="Atelnyo — Explore Courses, Music, Talent & More" />
        {/* Phase 60.3 — global SEO: hreflang alternates. Canonical is
            deliberately NOT emitted here: per-page canonicals (detail
            sheets' /slug/by/user/course form) come from <SEOHead>, and
            two different canonical values on one page is exactly the
            contradiction Google treats as a soft error.
            hreflang lists every valid {lang}-{COUNTRY} alternate, so
            Google indexes /ht-HT/, /en-US/, /fr-CA/, … as the same
            content in other languages instead of duplicates. */}
        {MARKET_OPTIONS.flatMap((m) => m.supportedLanguages.map((l) => {
          const localizedPath = buildLocaleUrl(l, m.code, effectivePathname);
          if (!localizedPath) return null; // invalid combo — no fake page
          // hreflang MUST be unique per value. A bare language code
          // ("fr") would appear for 12 different market URLs — Google
          // requires language-COUNTRY (fr-HT, fr-CA, fr-CH…) whenever a
          // language spans multiple markets, which is every language
          // here. The {lang}-{COUNTRY} tag is also self-referencing on
          // each localized URL (spec §16).
          const tag = buildLocaleTag(l, m.code);
          return (
            <link
              key={`${l}-${m.code}`}
              rel="alternate"
              hrefLang={tag}
              href={`${window.location.origin}${localizedPath}`}
            />
          );
        })).filter(Boolean)}
        <link rel="alternate" hrefLang="x-default" href={`${window.location.origin}${effectivePathname || '/'}`} />
      </Helmet>

      {/* ─── LocaleSync: URL locale intent → app state (spec §30).
           Covers back/forward between different localized URLs; the
           lazy initializers + switcher handlers cover the rest. ─── */}
      <LocaleSync
        pathname={rrLocation.pathname}
        lang={lang}
        market={market}
        onResolved={handleLocaleResolved}
      />

      {/* ─── ScrollManager: single owner of route-level scroll.
           Detail pages always open at the top; the catalog restores
           its position on return. Mounted once, renders null. ─── */}
      <ScrollManager />

      {/* ─── Connection status banner (offline / slow / sync) ────── */}
      <ConnectionBanner lang={lang} />

      {/* ─── Continuity: session-restored banner (relaunch) ──────── */}
      <RestoreBanner lang={lang} />

      <Header
        lang={lang}
        translations={translations}
        toggleTheme={toggleTheme}
        darkMode={isDark}
        onOpenSearch={() => setSearchOpen(true)}
        user={user}
        onLogout={handleLogout}
        onLangChange={handleLangChange}
        onBellClick={handleBellClick}
        isNotifOpen={isNotifOpen}
        unreadNotifCount={unreadNotifCount}
        bellSwing={bellSwing}
      />

      {/* ─── Notification dropdown (bell) ─────────────────────────── */}
      {isNotifOpen && user && (
        <>
        {/* Click-outside veil — closes the dropdown on any outside
            tap/click (and swallows the event so it cannot fall
            through to a control beneath). Esc also closes (keydown
            effect below). */}
        <div
          className="notif-dropdown-backdrop"
          aria-hidden="true"
          onClick={() => setIsNotifOpen(false)}
        />
        <div className="notif-dropdown" role="dialog" aria-label={t2(lang, { ht: 'Notifikasyon', en: 'Notifications' })}>
          <div className="notif-dropdown__header">
            <h3>
              <i className="fas fa-bell" aria-hidden="true" />
              {t2(lang, { ht: 'Notifikasyon', en: 'Notifications' })}
            </h3>
            <button
              type="button"
              className="notif-dropdown__close"
              onClick={() => setIsNotifOpen(false)}
              aria-label={t2(lang, { ht: 'Fèmen', en: 'Close' })}
            >
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="notif-dropdown__body">
            <ActivityTimeline
              lang={lang}
              userId={user?.id}
              t={t}
              refreshToken={notifRefreshToken}
              onMarkRead={handleNotifRead}
              onNavigate={navigateRR}
              onAcceptProposal={handleAcceptProposal}
              onRejectProposal={handleRejectProposal}
              onAcceptRequest={handleAcceptRequest}
              onRejectRequest={handleRejectRequest}
            />
          </div>
          <div className="notif-dropdown__footer">
            <button
              type="button"
              className="notif-dropdown__mark-all"
              onClick={() => {
                // Explicit action — the badge is only cleared when the
                // user actually asks for it (never on open/close).
                activityFeedService.markAllRead().catch(() => {});
                setUnreadNotifCount(0);
                notifCountRef.current = 0;
                // Re-fetch the open list so the unread highlights clear
                // immediately (ActivityTimeline re-runs on refreshToken).
                setNotifRefreshToken((n) => n + 1);
              }}
            >
              <i className="fas fa-check-double" aria-hidden="true" /> {t2(lang, { ht: 'Make tout li li', en: 'Mark all read' })}
            </button>
            <button
              type="button"
              className="notif-dropdown__see-all"
              onClick={() => {
                // Navigation only — the full page owns read-state. It
                // shows the unread items + a "Mark all read" toolbar,
                // so opening it must NOT wipe the badge.
                setIsNotifOpen(false);
                navigateRR(SHEETS.NOTIFICATIONS);
              }}
            >
              <i className="fas fa-arrow-right" aria-hidden="true" /> {t2(lang, { ht: 'Wè tout notifikasyon yo', en: 'See all notifications' })}
            </button>
          </div>
        </div>
        </>
      )}

      <div className="container" role="presentation">
        <main id="a11y-main-content" tabIndex="-1" aria-label={getA11yString(lang, 'contentLandmark')}>
          {/* Skip the chrome-rendered Explore when the URL is under /sheet/* —
              the sheet-routed <Explore> already covers /sheet/explore, and
              mounting both would double-fetch the catalog + double-register
              the IntersectionObserver. isSheetRoute is computed from
              rrLocation.pathname.startsWith('/sheet/'). */}
          {effectivePathname === '/' && (
            /* Suspense boundary around renderContent() is REQUIRED: the
               activeTab='product-detail' case renders the lazy-loaded
               <ProductDetail>. Without a Suspense boundary here, React
               throws "A component suspended while rendering, but no
               fallback UI was specified" → the whole app crashes to a
               black page (the /sheet/* route already has its own
               Suspense, which is why only the root-tab click broke). */
            /* The tab surface (renderContent) is owned by the ROOT path
               ONLY: activeTab is a root-level state machine (Explore /
               Mwen / commerce tabs) whose URL never leaves '/'. For
               every other path the <Routes> tree owns the page — so
               gating on effectivePathname === '/' (instead of
               !isSheetRoute) stops the home page from rendering
               UNDERNEATH a catch-all 404 for unknown URLs (the "paj
               index anba, 404 anba li" double render).
               NOTE: the 404 NotFound is also rendered here (via
               notFoundPath state) so it appears inside <main>, not
               at the bottom of the DOM tree. */
            <Suspense fallback={
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '80px 0', minHeight: '40vh',
              }}>
                <i className="fas fa-spinner fa-pulse fa-2x" style={{ color: 'var(--pink-primary, #d81b60)' }} aria-hidden="true" />
              </div>
            }>
              {renderContent()}
            </Suspense>
          )}
          {/* 404: render inside <main> so it appears in the content area,
              not at the bottom of the DOM tree after Footer + modals.
              The /404 route in Routes catches the path; we detect it here
              via effectivePathname. */}
          {effectivePathname === '/404' && (
            <NotFound lang={lang} onBack={() => navigateRR('/')} />
          )}
        </main>

        <Footer lang={lang} translations={translations} />
      </div>

      {/* Cookie Consent Banner — GDPR/CCPA compliant consent management */}
      <Suspense fallback={null}>
        <CookieConsent lang={lang} />
      </Suspense>

      <Suspense fallback={null}>
        <Settings 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)}
          onAuthOpen={() => { setIsSettingsOpen(false); setIsAuthOpen(true); }}
          lang={lang}
          onLangChange={handleLangChange}
          market={market}
          onMarketChange={handleMarketChange}
          darkMode={isDark}
          toggleTheme={toggleTheme}
          fontSize={fontSize}
          setFontSize={setFontSize}
          translations={translations}
          user={user}
          onLogout={handleLogout}
          showToast={showToast}
          onProfileUpdate={refreshUser}
          onOpenCheckout={(type, price, meta) => handleOpenCheckout(type, price, meta)}
        />
      </Suspense>

      <Suspense fallback={null}>
        <CheckoutModal
          isOpen={!!checkoutState}
          onClose={() => setCheckoutState(null)}
          type={checkoutState?.type || 'order'}
          meta={checkoutState?.meta || {}}
          lang={lang}
          user={user}
          showToast={showToast}
          onAuthRequired={() => { setCheckoutState(null); setIsAuthOpen(true); }}
          onSuccess={checkoutState?.meta?.onSuccess}
        />
      </Suspense>

      <Suspense fallback={null}>
        <Wizard 
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          selectedCourse={selectedCourse}
          lang={lang}
          translations={translations}
          showToast={showToast}
          onEnrollSuccess={(id) => {
            progressService.getAll().then(pRes => setUserProgress(pRes.data)).catch(() => {});
          }}
        />
      </Suspense>

      <Suspense fallback={null}>
        <Auth 
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onLoginSuccess={handleLoginSuccess}
          lang={lang}
          showToast={showToast}
        />
      </Suspense>

      <Suspense fallback={null}>
        <Chatbot lang={lang} translations={translations} />
      </Suspense>

      {/* Cloud Shell proxy-safe: only mount when open so useNavigate()
          isn't called during the dangerous startup window when Cloud
          Shell injects its own scripts that corrupt React's dispatcher. */}
      {searchOpen && (
        <Suspense fallback={null}>
          <GlobalSearchBar
            isOpen={searchOpen}
            onClose={() => { setSearchOpen(false); setSearchResults(null); }}
            onSearchResults={(data) => { setSearchResults(data); setSearchOpen(false); navigateRR(SHEETS.SEARCH); }}
            onNavigate={handleNavigate}
            lang={lang}
          />
        </Suspense>
      )}

      {/* BottomNavBar stays mounted on every route (including /sheet/* overlays).
          The previous conditional hide caused the bar to disappear when the user
          navigated into a sheet, which removed the only path back to the Explore
          surface. The bar now floats above sheets via z-index 2500 (defined in
          styles/index.css) and uses the ``onNavigate`` override so clicking a
          tab from a sheet route calls ``navigate('/')`` first — that exits the
          /sheet/* URL prefix and restores the underlying chrome. The inline
          <Settings isOpen={isSettingsOpen} ...> overlay is still rendered
          alongside this; /sheet/settings is a separate URL-driven deep-link
          to the same component. */}
      <BottomNavBar
        activeTab={navActiveTab}
        setActiveTab={setActiveTab}
        lang={lang}
        t={t}
        isStaff={user?.is_staff}
        showSettings
        onNavigate={(tabId) => {
          // When clicked from inside a /sheet/* URL, escape the sheet first so
          // the underlying app chrome (header / tabs / footer) re-mounts and
          // activeTab takes effect on the root Explore/Mwen surface. From a
          // localized URL, return to the LOCALIZED home so the explicit
          // language/country context is preserved (spec §21).
          if (isSheetRoute) {
            navigateRR(parsedLocale?.valid ? `/${parsedLocale.tag}` : '/');
          }
          setActiveTab(tabId);
        }}
      />

      {/* ═══ Policy Consent Banner — shows when user needs to accept updated policies ═══ */}
      {user && (
        <PolicyConsentBanner
          lang={lang}
          showToast={showToast}
        />
      )}

      {/* ═══ Violation Notice — shows when user has active policy violations ═══ */}
      <ViolationNotice
        isOpen={showViolationNotice}
        onClose={() => setShowViolationNotice(false)}
        lang={lang}
        showToast={showToast}
      />

      {/* Phase 47 — Cloud Shell unsupported-env hint banner.
          Renders fixed-bottom when window.location.hostname ends with
          'cloudshell.dev' (the Google Cloud Shell Web Preview origin
          pattern) so the developer sees an actionable hint instead of
          a silent avalanche of CORS-preflight failures. Persistent (does
          NOT auto-dismiss like the generic toasts) — the user needs to
          click "OK" or take the SSH-tunnel action to make it go away. */}
      {showCloudShellHint && (
        <div
          className="cloud-shell-hint"
          role="alert"
          aria-live="polite"
          data-testid="cloud-shell-hint"
        >
          <div className="cloud-shell-hint__body">
            <i className="fas fa-cloud" aria-hidden="true" />
            <div>
              <strong>
                {(lang === 'ht')
                  ? 'Cloud Shell Web Preview pa sip\u00f2te Atelnyo API.'
                  : (lang === 'fr')
                    ? 'Cloud Shell Web Preview n\u2019est pas pris en charge.'
                    : (lang === 'es')
                      ? 'Cloud Shell Web Preview no es compatible.'
                      : 'Cloud Shell Web Preview is not supported.'}
              </strong>
              <p>
                {(lang === 'ht')
                  ? 'Tout ap\u00e8l API (/dapi/*) sek\u00f2se pa proxy Google a epi bloke pa CORS. S\u00e8vi ak tin\u00e8l SSH sou machin lokal la\u00a0:'
                  : (lang === 'fr')
                    ? 'Tous les appels API (/dapi/*) sont intercept\u00e9s par le proxy Google et bloqu\u00e9s par le CORS Django. Utilisez le tunnel SSH vers votre machine locale\u00a0:'
                    : (lang === 'es')
                      ? 'Todas las llamadas a la API (/dapi/*) son interceptadas por el proxy de Google y bloqueadas por CORS en Django. Usa el t\u00fanel SSH a tu m\u00e1quina local\u00a0:'
                      : 'All API calls (/dapi/*) are intercepted by the Google auth-proxy and blocked by Django CORS. Use the SSH tunnel to your local machine:'}
                <code>
                  gcloud cloud-shell ssh --authorize-session --ssh-flag="-L 3000:localhost:3000 -L 8000:localhost:8000"
                </code>
                {(lang === 'ht')
                  ? 'ouvri http://localhost:3000 sou Chrome lokal la.'
                  : (lang === 'fr')
                    ? 'puis ouvrez http://localhost:3000 dans votre Chrome LOCAL.'
                    : (lang === 'es')
                      ? 'luego abre http://localhost:3000 en tu Chrome LOCAL.'
                      : 'then open http://localhost:3000 in your LOCAL Chrome.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="cloud-shell-hint__dismiss"
            data-testid="cloud-shell-hint-dismiss"
            onClick={() => {
              try { localStorage.setItem('atelnyo_cloudshell_hint_dismissed', '1'); } catch (_) {}
              setShowCloudShellHint(false);
            }}
            aria-label={t2(lang, { ht: 'Fèmen', en: 'Dismiss' })}
          >
            {t2(lang, { ht: 'OK', en: 'Got it' })}
          </button>
        </div>
      )}

      <div id="toast-container" aria-label={lang === 'ht' ? 'Notifikasyon' : 'Notifications'}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`toast${toast.leaving ? ' toast-leaving' : ''}`}
            data-icon={toast.icon}
            role="status"
            aria-live={toast.icon?.includes('exclamation') || toast.icon?.includes('triangle') || toast.icon?.includes('circle-exclamation') ? 'assertive' : 'polite'}
          >
            <i className={`fas fa-${toast.icon}`} aria-hidden="true" />
            <span>{toast.message}</span>
            <button
              type="button"
              className="toast-dismiss"
              onClick={() => {
                setToasts(prev => prev.filter(t => t.id !== toast.id));
              }}
              aria-label={lang === 'ht' ? 'Fèmen' : 'Dismiss'}
              style={{
                background: 'none', border: 'none', color: 'inherit', cursor: 'pointer',
                padding: '4px 8px', opacity: 0.6, fontSize: '0.8rem', minHeight: '32px',
              }}
            >
              <i className="fas fa-times" aria-hidden="true" />
            </button>
            <span className="toast-progress" aria-hidden="true" />
          </div>
        ))}
      </div>

      {/* ─── Session expired — unmissable notice + one-tap re-login ── */}
      <SessionExpiredModal
        open={sessionExpiredOpen}
        lang={lang}
        onLogin={() => { setSessionExpiredOpen(false); setIsAuthOpen(true); }}
        onDismiss={() => setSessionExpiredOpen(false)}
      />

      {/* ═══ Sheet Routes — every /sheet/* path renders a dedicated overlay ═══ */}
      {/* <ChunkLoadErrorBoundary> catches "Failed to fetch dynamically
           imported module" errors when a deployment changes chunk hashes.
           <Suspense> shows a spinner while lazy-loaded components load. */}
      <ChunkLoadErrorBoundary>
      <Suspense fallback={
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          background: 'var(--surface-page, var(--bg-page, #ffdae9))',
        }}>
          <i className="fas fa-spinner fa-pulse fa-2x" style={{ color: 'var(--color-primary, var(--pink-primary, #d81b60))' }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)' }}>Loading…</span>
        </div>
      }>
      <Routes location={effectiveLocation}>
        {/* Public catalog page — /explore (and localized /ht-HT/explore)
            renders the full Explore catalog (courses, music, talent,
            jobs, products via filter chips). Full-page like
            /sheet/explore; isSheetRoute hides the chrome for it. */}
        <Route path="/explore" element={
          <Explore
            user={user}
            lang={lang}
            market={market}
            translations={translations}
            onOpenCourse={(course) => navigateRR(buildContentUrl('course', course), { state: { course } })}
            onOpenMusicSheet={(track) => navigateRR(buildContentUrl('music', track), { state: { track } })}
            onOpenTalentSheet={(talent) => navigateRR(buildContentUrl('talent', talent), { state: { talent } })}
            onOpenJobSheet={(job) => navigateRR(buildContentUrl('job', job), { state: { job } })}
            onOpenProduct={(product) => { setSelectedProduct(product); navigateRR(buildContentUrl('product', product)); }}
            onOpenPortfolio={(project) => navigateRR(buildContentUrl('portfolio', project), { state: { project } })}
            onOpenCheckout={(type, price, meta) => handleOpenCheckout(type, price, meta)}
            showToast={showToast}
          />
        } />
        <Route path="/sheet/explore" element={
          <Explore
            user={user}
            lang={lang}
            market={market}
            translations={translations}
            onOpenCourse={(course) => navigateRR(buildContentUrl('course', course), { state: { course } })}
            onOpenMusicSheet={(track) => navigateRR(buildContentUrl('music', track), { state: { track } })}
            onOpenTalentSheet={(talent) => navigateRR(buildContentUrl('talent', talent), { state: { talent } })}
            onOpenJobSheet={(job) => navigateRR(buildContentUrl('job', job), { state: { job } })}
            onOpenProduct={(product) => { setSelectedProduct(product); navigateRR(buildContentUrl('product', product)); }}
            onOpenPortfolio={(project) => navigateRR(buildContentUrl('portfolio', project), { state: { project } })}
            onOpenCheckout={(type, price, meta) => handleOpenCheckout(type, price, meta)}
            showToast={showToast}
          />
        } />
        <Route path="/sheet/settings" element={
          <Settings
            isOpen
            onClose={() => navigateRR('/')}
            onAuthOpen={() => requireLogin(navigateRR, rrLocation, SHEETS.LOGIN)}
            lang={lang}
            onLangChange={handleLangChange}
            market={market}
            onMarketChange={handleMarketChange}
            darkMode={isDark}
            toggleTheme={toggleTheme}
            fontSize={fontSize}
            setFontSize={setFontSize}
            translations={translations}
            user={user}
            onLogout={handleLogout}
            showToast={showToast}
            onProfileUpdate={refreshUser}
            onOpenCheckout={(type, price, meta) => handleOpenCheckout(type, price, meta)}
          />
        } />
        {/* ─── Auth routes ────────────────────────────────────────
            /sheet/auth is the legacy alias (AuthGate + older callers
            still navigate there); /login and /signup are the SEO
            canonical auth URLs. All three render the same Auth modal —
            the dedicated routes pin the mode via initialMode so the
            address bar always matches the visible form, and the footer
            login/signup links navigate between the two URLs (see
            onModeSwitch below). seo mounts per-mode <Helmet> meta so a
            shared /login link produces a clean, crawlable page. */}
        <Route path="/sheet/auth" element={
          <AuthRoute
            user={user}
            mode="login"
            lang={lang}
            onLoginSuccess={handleLoginSuccess}
            showToast={showToast}
          />
        } />
        <Route path="/login" element={
          <AuthRoute
            user={user}
            mode="login"
            lang={lang}
            onLoginSuccess={handleLoginSuccess}
            showToast={showToast}
          />
        } />
        {/* Phase 39 — referral landing: the shared link is
            https://atelnyo.site/signup?ref=CODE — render the auth modal
            directly (URL + query stay intact so Auth.jsx reads ?ref= and
            attributes the new account to the referrer). initialMode
            pins the form to signup so the URL and the visible form
            always agree (a /signup link must never show the login
            form). */}
        <Route path="/signup" element={
          <AuthRoute
            user={user}
            mode="signup"
            lang={lang}
            onLoginSuccess={handleLoginSuccess}
            showToast={showToast}
          />
        } />
        {/* Password reset deep link — the email CTA lands here. The Auth
            modal reads ?token= on mount, flips to the reset form with the
            token pre-seeded, and strips the secret from the address bar.
            No user-gate: the requester has JUST forgotten their password,
            so requiring a session would be absurd. */}
        <Route path="/reset-password" element={
          <AuthRoute
            user={null}
            mode="reset"
            lang={lang}
            onLoginSuccess={handleLoginSuccess}
            showToast={showToast}
          />
        } />
        {/* Email verification deep link — the verification email lands
            here. Reads ?token=, POSTs it to /api/email/verify/confirm/
            (AllowAny — the token IS the proof), then shows the outcome
            and a link back to /login. Stripped of any user gate for the
            same reason as /reset-password. */}
        <Route path="/verify-email" element={
          <EmailVerificationRoute lang={lang} />
        } />
        {/* Phase ∞ — affiliate short links: the shareable URL is
            https://atelnyo.site/go/DCAN-XXXX (model full_url). The
            SPA catch-all would render NotFound, so this route bounces to
            /api/go/<code>/ which records the click + 302s to the landing
            page with #aff_token=<JWT> — captured into sessionStorage by
            App.jsx (survives SPA navigation) and read by CheckoutModal
            at checkout. */}
        <Route path="/go/:code" element={<AffiliateGoRedirect />} />
        <Route path="/sheet/atelier" element={<Atelier lang={lang} isOpen onClose={() => navigateRR('/')} showToast={showToast} />} />
        <Route path="/affiliate" element={
          <AuthGate user={user}>
            <AffiliateDashboard lang={lang} showToast={showToast} />
          </AuthGate>
        } />
        <Route path="/affiliate/discover" element={
          <AuthGate user={user}>
            <ProgramDiscovery lang={lang} showToast={showToast} />
          </AuthGate>
        } />
        {/* /sheet/profile removed — Profile feature deleted (2026-Q3 cleanup) */}
        <Route path="/sheet/explore/music" element={<MusicSheet lang={lang} showToast={showToast} user={user} />} />
        <Route path="/sheet/explore/talent" element={<TalentSheet lang={lang} showToast={showToast} user={user} />} />
        <Route path="/sheet/explore/job" element={<JobSheet lang={lang} showToast={showToast} user={user} />} />
        <Route path="/sheet/calendar" element={<CalendarView lang={lang} showToast={showToast} user={user} />} />
        {/* Phase Language — Atelnyo Language Academy public hub.
            Lists published official programs + drills into each
            program's level curriculum. Public, no auth required. */}
        <Route path={SHEETS.ACADEMY} element={
          <AcademyHub
            lang={lang}
            translations={translations}
            onOpenCourse={(course) => navigateRR(buildContentUrl('course', course), { state: { course } })}
            onBack={() => navigateRR('/')}
            showToast={showToast}
          />
        } />
        {/* /academy — clean canonical alias of /sheet/academy. The dynamic
            sitemap (explore/views/sitemap_view.py) advertises /academy to
            crawlers, but only the /sheet/* shape existed — every crawler
            hit on the advertised URL rendered NotFound (soft-404). Both
            shapes now render the same public hub. */}
        <Route path="/academy" element={
          <AcademyHub
            lang={lang}
            translations={translations}
            onOpenCourse={(course) => navigateRR(buildContentUrl('course', course), { state: { course } })}
            onBack={() => navigateRR('/')}
            showToast={showToast}
          />
        } />
        {/* Phase Learner — global learner area (Continue Learning / My
            Courses / Completed / Saved / Recommended). Auth-gated: the
            dashboard reads the user's real Enrollment + UserProgress. */}
        <Route path={SHEETS.LEARN} element={
          <LearnerRouteErrorBoundary>
          <AuthGate user={user}>
            <LearnerDashboard
              lang={lang}
              translations={translations}
              user={user}
              showToast={showToast}
              onBack={() => navigateRR('/')}
              onOpenLearning={(course, opts = {}) => {
                if (!course?.id) return;
                const resume = opts?.resume ? '?resume=1' : '';
                startTransition(() => {
                  navigateRR(`${SHEETS.LEARN_COURSE_URL(course.id)}${resume}`);
                });
              }}
              onOpenCourse={(course) => course
                ? navigateRR(buildContentUrl('course', course), { state: { course } })
                : navigateRR('/')}
              onOpenCourseById={(id) => id && startTransition(() => navigateRR(SHEETS.LEARN_COURSE_URL(id)))}
            />
          </AuthGate>
          </LearnerRouteErrorBoundary>
        } />
        {/* Phase Learner — dedicated Learning Space for one course.
            Re-checks backend entitlement before showing lessons. */}
        <Route path={SHEETS.LEARN_COURSE} element={
          <LearnerRouteErrorBoundary>
          <AuthGate user={user}>
            <LearningSpaceRoute
              lang={lang}
              translations={translations}
              user={user}
              showToast={showToast}
              onNavigate={handleNavigate}
            />
          </AuthGate>
          </LearnerRouteErrorBoundary>
        } />
        <Route path="/sheet/curriculum/:courseId" element={
          <LearnerRouteErrorBoundary>
          <AuthGate user={user}>
            <CurriculumPlayerRoute
              lang={lang}
              user={user}
              showToast={showToast}
            />
          </AuthGate>
          </LearnerRouteErrorBoundary>
        } />
        <Route path="/sheet/community/:slug" element={<CommunityDetail lang={lang} showToast={showToast} user={user} />}>
          <Route index element={<Navigate to="events" replace />} />
          <Route path="events" element={<CommunityEvents />} />
          <Route path="members" element={<CommunityMembers />} />
          <Route path="banned" element={<CommunityBannedMembers />} />
          <Route path="announcements" element={<CommunityAnnouncements />} />
          <Route path="files" element={<CommunityFiles />} />
          <Route path="courses" element={<CommunityCourses />} />
        </Route>
        <Route path="/sheet/analytics" element={
          <AuthGate user={user}>
            <CreatorAnalytics lang={lang} showToast={showToast} user={user} />
          </AuthGate>
        } />
        <Route path="/sheet/referral" element={
          <AuthGate user={user}>
            <ReferralDashboard lang={lang} showToast={showToast} user={user} />
          </AuthGate>
        } />
        {/* Phase 36.1 — Community detail page is now URL-driven on its tabs.
            The parent route renders <CommunityDetail> which fetches community
            info once, exposes it via <Outlet context>, and renders the tab
            nav. Each sub-tab is its own route + component (member, events,
            announcements, files, courses). A bare visit to /sheet/community/:slug
            (e.g. from Explore.jsx › navigate(`/sheet/community/${slug}`))
            hits the ``index`` <Navigate to="events" replace /> so the user
            lands on the same default tab as before the refactor. */}
        {/* Phase ∞ — Admin Dashboard. Staff-only overview page with
            statistics, Creator queue, health checks, and quick links.
            Gated by AuthGate + RequireRole. */}
        <Route path={SHEETS.ADMIN_DASHBOARD} element={
          <AuthGate user={user}>
            <RequireRole user={user} role="staff" redirect="/">
              <AdminDashboard
                lang={lang}
                showToast={showToast}
                user={user}
                onNavigate={handleNavigate}
              />
            </RequireRole>
          </AuthGate>
        } />
        {/* Phase ∞ — Admin Creator Review. Staff-only. */}
        <Route path={SHEETS.ADMIN_CREATORS} element={
          <AuthGate user={user}>
            <RequireRole user={user} role="staff" redirect="/">
              <AdminCreatorReview
                lang={lang}
                showToast={showToast}
                user={user}
                onNavigate={handleNavigate}
              />
            </RequireRole>
          </AuthGate>
        } />
        <Route path={SHEETS.ADMIN_MEDIA} element={
          <AuthGate user={user}>
            <RequireRole user={user} role="staff" redirect="/">
              <AdminMediaManager
                lang={lang}
                showToast={showToast}
                user={user}
                onNavigate={handleNavigate}
              />
            </RequireRole>
          </AuthGate>
        } />
        {/* Phase 47/48 — Admin Spotlight Review. Staff-only. */}
        <Route path={SHEETS.ADMIN_SPOTLIGHT} element={
          <AuthGate user={user}>
            <RequireRole user={user} role="staff" redirect="/">
              <AdminSpotlightReview
                lang={lang}
                showToast={showToast}
                user={user}
                onNavigate={handleNavigate}
              />
            </RequireRole>
          </AuthGate>
        } />
        {/* Business Spotlight — Admin Review. Staff-only. */}
        <Route path={SHEETS.ADMIN_BUSINESS_SPOTLIGHT} element={
          <AuthGate user={user}>
            <RequireRole user={user} role="staff" redirect="/">
              <AdminBusinessSpotlightReview
                lang={lang}
                showToast={showToast}
                user={user}
                onNavigate={handleNavigate}
              />
            </RequireRole>
          </AuthGate>
        } />
        {/* Phase Company — Admin Company Profile Review. Staff-only. */}
        <Route path={SHEETS.ADMIN_COMPANIES} element={
          <AuthGate user={user}>
            <RequireRole user={user} role="staff" redirect="/">
              <AdminCompanyReview
                lang={lang}
                showToast={showToast}
                user={user}
                onNavigate={handleNavigate}
              />
            </RequireRole>
          </AuthGate>
        } />
        {/* Phase ADMIN MEDIA CENTER — Broken Media Center */}
        <Route path={SHEETS.ADMIN_BROKEN_MEDIA} element={
          <AuthGate user={user}>
            <RequireRole user={user} role="staff" redirect="/">
              <AdminBrokenMediaCenter
                lang={lang}
                showToast={showToast}
                user={user}
                onNavigate={handleNavigate}
              />
            </RequireRole>
          </AuthGate>
        } />
        {/* Phase ADMIN MEDIA CENTER — Validation Queue */}
        <Route path={SHEETS.ADMIN_VALIDATION_QUEUE} element={
          <AuthGate user={user}>
            <RequireRole user={user} role="staff" redirect="/">
              <AdminValidationQueue
                lang={lang}
                showToast={showToast}
                user={user}
                onNavigate={handleNavigate}
              />
            </RequireRole>
          </AuthGate>
        } />
        {/* Phase ADMIN MEDIA CENTER — Content Moderation */}
        <Route path={SHEETS.ADMIN_MODERATION} element={
          <AuthGate user={user}>
            <RequireRole user={user} role="staff" redirect="/">
              <AdminContentModeration
                lang={lang}
                showToast={showToast}
                user={user}
                onNavigate={handleNavigate}
              />
            </RequireRole>
          </AuthGate>
        } />
        {/* Phase ADMIN MEDIA CENTER — Media Reports */}
        <Route path={SHEETS.ADMIN_REPORTS} element={
          <AuthGate user={user}>
            <RequireRole user={user} role="staff" redirect="/">
              <AdminMediaReports
                lang={lang}
                showToast={showToast}
                user={user}
                onNavigate={handleNavigate}
              />
            </RequireRole>
          </AuthGate>
        } />
        <Route path={SHEETS.ADMIN_INCIDENTS} element={
          <AuthGate user={user}>
            <RequireRole user={user} role="staff" redirect="/">
              <AdminMediaIncidents
                lang={lang}
                showToast={showToast}
                user={user}
                onNavigate={handleNavigate}
              />
            </RequireRole>
          </AuthGate>
        } />
        {/* Phase MEDIA SECURITY & TRUST — Admin Security Center */}
        <Route path={SHEETS.ADMIN_SECURITY} element={
          <AuthGate user={user}>
            <RequireRole user={user} role="staff" redirect="/">
              <AdminSecurityCenter
                lang={lang}
                showToast={showToast}
                user={user}
                onNavigate={handleNavigate}
              />
            </RequireRole>
          </AuthGate>
        } />
        {/* Phase Premium — Admin User Management. Staff-only. */}
        <Route path={SHEETS.ADMIN_USERS} element={
          <AuthGate user={user}>
            <RequireRole user={user} role="staff" redirect="/">
              <AdminUserManagement
                lang={lang}
                showToast={showToast}
                user={user}
                onNavigate={handleNavigate}
              />
            </RequireRole>
          </AuthGate>
        } />
        {/* Phase 1 — Admin Rule Engine. Staff-only. */}
        <Route path={SHEETS.ADMIN_RULE_ENGINE} element={
          <AuthGate user={user}>
            <RequireRole user={user} role="staff" redirect="/">
              <AdminRuleEngine
                lang={lang}
                translations={translations}
                showToast={showToast}
                user={user}
              />
            </RequireRole>
          </AuthGate>
        } />
        {/* Admin FAQ — staff-specific help center. */}
        <Route path={SHEETS.ADMIN_FAQ} element={
          <AuthGate user={user}>
            <RequireRole user={user} role="staff" redirect="/">
              <AdminFAQ
                lang={lang}
                showToast={showToast}
                onNavigate={navigateRR}
              />
            </RequireRole>
          </AuthGate>
        } />
        {/* Admin Platform FAQ — manage the public FAQ page. */}
        <Route path="/sheet/admin/platform-faq" element={
          <AuthGate user={user}>
            <RequireRole user={user} role="staff" redirect="/">
              <AdminPlatformFAQ
                lang={lang}
                showToast={showToast}
                onNavigate={navigateRR}
              />
            </RequireRole>
          </AuthGate>
        } />
        {/* Phase ∞ — Admin Provider Health Monitor. Staff-only. */}
        <Route path={SHEETS.ADMIN_PROVIDER_HEALTH} element={
          <AuthGate user={user}>
            <RequireRole user={user} role="staff" redirect="/">
              <AdminProviderHealth
                lang={lang}
                showToast={showToast}
                user={user}
              />
            </RequireRole>
          </AuthGate>
        } />
        {/* Phase ∞ — Admin Media Monitor. Staff-only. */}
        <Route path={SHEETS.ADMIN_MEDIA_MONITOR} element={
          <AuthGate user={user}>
            <RequireRole user={user} role="staff" redirect="/">
              <AdminMediaMonitor
                lang={lang}
                showToast={showToast}
              />
            </RequireRole>
          </AuthGate>
        } />
        {/* Phase ∞ — Admin Security Monitor. Staff-only. */}
        <Route path={SHEETS.ADMIN_SECURITY_MONITOR} element={
          <AuthGate user={user}>
            <RequireRole user={user} role="staff" redirect="/">
              <SecurityDashboard
                lang={lang}
                showToast={showToast}
              />
            </RequireRole>
          </AuthGate>
        } />
        {/* Phase Language — Admin Language Academy. Staff-only: generate
            the official curriculum per program, publish/unpublish, and
            review every program course (drafts included). */}
        <Route path={SHEETS.ADMIN_ACADEMY} element={
          <AuthGate user={user}>
            <RequireRole user={user} role="staff" redirect="/">
              <AdminLanguageAcademy
                lang={lang}
                showToast={showToast}
                user={user}
                onNavigate={handleNavigate}
              />
            </RequireRole>
          </AuthGate>
        } />
        {/* Phase 50 — Creator Apply. Double-gated: this route is a
            thin pass-through to <CreatorApply> which itself enforces
            (a) the user is logged in, (b) the localStorage unlock
            flag ``atelnyo_creator_apply_unlocked`` is set. Unmet
            gates redirect via ``<Navigate replace>`` — anonymous
            users bounce to /sheet/auth, the rest bounce to /. This
            honors the product spec "li pa dwe fèt poy tout user":
            the surface is not in the bottom-nav, not linked in the
            Footer, and not discoverable from /sheet/settings without
            a 3-tap easter-egg on a hidden footer line. */}
        <Route path={SHEETS.CREATOR_APPLY} element={
          <CreatorApply
            lang={lang}
            showToast={showToast}
            user={user}
            onClose={() => navigateRR('/')}
          />
        } />
        {/* Phase ∞ — Creator Studio (full workspace). Accessible only
            to users with is_creator=true. The component itself gates
            on this flag and redirects to / with a toast if the user
            is not a creator. We also wrap with AuthGate to catch
            anonymous users BEFORE the component mounts. */}
        <Route path={SHEETS.STUDIO} element={
          <AuthGate user={user}>
            <RequireRole user={user} role="creator" redirect="/">
              <CreatorStudio
                lang={lang}
                showToast={showToast}
                user={user}
              />
            </RequireRole>
          </AuthGate>
        } />
        {/* Universal DM inbox — every authenticated user (creator or
            not) reads + replies to their conversations here. The same
            MessagesSection component the Studio uses. */}
        <Route path={SHEETS.MESSAGES} element={
          <AuthGate user={user}>
            <MessagesPage lang={lang} t={t} showToast={showToast} />
          </AuthGate>
        } />
        {/* Phase 58 — Notifications center. Requires auth. */}
        <Route path={SHEETS.NOTIFICATIONS} element={
          <AuthGate user={user}>
            <NotificationsPage
              lang={lang}
              user={user}
              t={t}
              // Real-time: a notification arriving while the page is
              // open bumps this token and the shared timeline re-fetches.
              refreshToken={notifRefreshToken}
              // Keep the header badge in sync the instant the page marks
              // items read (the WS ``unread`` broadcast is the fallback).
              onMarkRead={handleNotifRead}
              onMarkAllRead={() => {
                notifCountRef.current = 0;
                setUnreadNotifCount(0);
              }}
            />
          </AuthGate>
        } />
        {/* Phase 58 — Wallet standalone page. Requires auth. */}
        <Route path={SHEETS.WALLET} element={
          <AuthGate user={user}>
            <WalletPage
              lang={lang}
              user={user}
              showToast={showToast}
              t={t}
            />
          </AuthGate>
        } />
        {/* Phase 49 §11.2 — Public Spotlight deep-link. Reachable
            two ways: (a) from the Spotlight chip in Explore (the
            card onClick navigates to ``/sheet/spotlight/${item.id}``)
            and (b) from a pasted link in any messenger. The page
            fetches the canonical payload fresh from the BE on
            every mount so a deep-link to a cold-loaded card always
            renders the latest admin review. Body.sheet-open (set in
            the ``isSheetRoute`` useEffect above) hides the global
            chrome so the page occupies the full viewport without an
            explicit fixed-position wrapper. Open Graph + Twitter
            Card meta tags are mounted by the component via
            react-helmet-async so a pasted link produces a rich
            preview in chat clients that render embedded JS. The
            known crawler limitation is documented in
            SpotlightDetail.jsx. */}
        <Route
          path={SHEETS.SPOTLIGHT_DETAIL}
          element={<SpotlightDetail lang={lang} showToast={showToast} user={user} />}
        />
        {/* Spotlight Identity — user achievement showcase */}
        <Route
          path="/sheet/spotlight/identity/:username"
          element={<SpotlightIdentity lang={lang} />}
        />
        {/* Phase Company — public company page deep-link. URL-driven:
            the component fetches GET /api/companies/<slug> fresh on
            each mount, so a cold link always renders the latest
            approved payload. Public (no AuthGate) — same as the
            Spotlight deep-link. */}
        <Route
          path={SHEETS.COMPANY_DETAIL}
          element={<CompanyProfileDetail lang={lang} showToast={showToast} />}
        />
        {/* Phase Business — Business Hub (/business). Lists the account's
            business profiles (separate identity from the Creator branch)
            + create CTA. Auth-gated; owner-scoped backend. */}
        <Route path={SHEETS.BUSINESS} element={
          <AuthGate user={user}>
            <BusinessHub lang={lang} showToast={showToast} />
          </AuthGate>
        } />
        {/* Phase Business — Business Workspace (/business/:slug/workspace).
            The management context for ONE business profile: context
            header "Business Profile: [Name]" + return-to-creator. URL-
            driven + sheet-isolated (isSheetRoute includes /business/). */}
        <Route path={SHEETS.BUSINESS_WORKSPACE} element={
          <AuthGate user={user}>
            <BusinessWorkspace lang={lang} showToast={showToast} />
          </AuthGate>
        } />
        {/* Phase Business — PUBLIC business profile deep-link. URL-driven:
            the component fetches GET /api/business/profiles/<slug> fresh on
            each mount, so a cold link always renders the latest ACTIVE
            payload via the PII-free public serializer. Public (no AuthGate)
            — same as the Company + Spotlight deep-links. React Router ranks
            the 3-segment workspace route above this 2-segment one, so
            /business/:slug/workspace can never be swallowed by :slug. */}
        {/* Phase Business — customer-side "My Orders" tracker. The
            static 3-segment path outranks the 2-segment :slug route,
            so /business/orders/mine can never be swallowed by a
            business slug. Auth-gated (it's the customer's own data). */}
        <Route path={SHEETS.BUSINESS_MY_ORDERS} element={
          <AuthGate user={user}>
            <BusinessMyOrdersPage lang={lang} showToast={showToast} />
          </AuthGate>
        } />
        <Route
          path={SHEETS.BUSINESS_PUBLIC}
          element={<BusinessPublicPage lang={lang} showToast={showToast} />}
        />
        {/* ═══ DEIE Routes — Atelnyo Evolution Intelligence Engine (auth required) ═══ */}
        <Route path="/sheet/deie/feed" element={
          <AuthGate user={user}>
            <DEIEFeed lang={lang} user={user} />
          </AuthGate>
        } />
        <Route path="/sheet/deie/mentor" element={
          <AuthGate user={user}>
            <MentorChat lang={lang} />
          </AuthGate>
        } />
        <Route path="/sheet/deie/evolution" element={
          <AuthGate user={user}>
            <EvolutionBadge lang={lang} showDetails />
          </AuthGate>
        } />
        {/* Phase 23 \u00a72 \u2014 Media Entity Page (full-page media view, NOT a popup).
            The MediaInspector remains the in-tab drawer; this route is
            the canonical deep-link + browser-back destination for
            "Open Media" actions coming from MediaCard / Studio /
            Search. Body.sheet-open hides the global chrome. */}
        <Route path={SHEETS.MEDIA_ENTITY} element={
          <MediaEntityPage
            lang={lang}
            user={user}
            showToast={showToast}
          />
        } />
        {/* Swallow the root URL (``/``) explicitly so the catch-all ``*`` below
            does NOT fire for it. The root path is rendered by ``renderContent()``
            inside ``<main>`` (Explore / commerce / mwen / rules / description /
            favori / etc.) — if we leave ``/`` unhandled inside <Routes>,
            React-Router falls through to ``*`` and the NotFound component
            renders UNDERNEATH the active tab's content, producing the
            "product → then 404" double render the user reported from the
            Explore + commerce surfaces. ``element={null}`` keeps the route
            matched (so the catch-all is skipped) while rendering nothing to
            the DOM — the root page is owned by ``renderContent()`` alone. */}
        <Route path="/" element={null} />
        {/* Phase 54 — Creator Public Profile. Dynamic route at
            /creator/:username. The page fetches the canonical
            payload fresh from the BE on every mount so a deep-link
            always renders the latest data. Open Graph + Twitter Card
            meta tags are mounted via react-helmet-async. */}        {/* /creator/:username — primary route (avoids @ character issues with CDN) */}
        <Route path="/creator/:username" element={
          <CreatorPublicProfile
            lang={lang}
            showToast={showToast}
            currentUserId={user?.id}
            onOpenCheckout={(type, price, meta) => handleOpenCheckout(type, price, meta)}
          />
        } />
        {/* /@:username — REMOVED 2026-07-30: React Router v6 does not match
            the @ character in route path patterns, causing a 404 error.
            Handled by CatchAllRoute (<Route path="*" />) below instead. */}        {/* /sheet/page/:slug — Dynamic CMS pages (About, Pricing, FAQ, etc.)
            Canonical under /sheet/ per the sheet-routing convention (T093).
            The legacy /page/:slug shape redirects (replace) to the canonical
            URL so old bookmarks / shared links keep working. */}
        <Route path="/sheet/page/:slug" element={
           <DynamicPageSheet lang={lang} showToast={showToast} />
        } />
        <Route path="/page/:slug" element={
          <CmsPageLegacyRedirect />
        } />
        {/* /legal — Legal index hub; /legal/:slug — policy detail */}
        <Route path="/legal" element={
          <LegalIndexPage lang={lang} />
        } />
        <Route path="/legal/:slug" element={
          <PolicyPageRoute lang={lang} showToast={showToast} />
        } />
        {/* /faq — Public FAQ page (platform-wide, managed by admins) */}
        <Route path="/faq" element={
          <FAQPage lang={lang} />
        } />
        {/* /help — Help Center (real help content, well-indexed) */}
        <Route path="/help" element={
          <HelpPage lang={lang} market={market} />
        } />
        {/* /help/:topic — crawlable deep link to a help topic section
            (e.g. /help/wallet). The topic maps to the matching anchor. */}
        <Route path="/help/:topic" element={
          <HelpPage lang={lang} market={market} />
        } />
        {/* /verify — Public certificate verification (QR code landing page) */}
        <Route path="/verify" element={
          <CertificateVerify />
        } />
        {/* /about — Official Atelnyo About page (Trust & Digital Identity) */}
        <Route path="/about" element={
          <AboutPage lang={lang} market={market} />
        } />
        {/* /trust — Trust Center (security, privacy, accessibility, compatibility) */}
        <Route path="/trust" element={
          <TrustCenter lang={lang} market={market} />
        } />
        {/* /contact — Official contact page */}
        <Route path="/contact" element={
          <ContactPage lang={lang} market={market} />
        } />
        {/* /accessibility — Accessibility statement */}
        <Route path="/accessibility" element={
          <AccessibilityPage lang={lang} market={market} />
        } />
        {/* /status — Platform status */}
        <Route path="/status" element={
          <StatusPage lang={lang} market={market} />
        } />
        {/* /developers — Developer documentation */}
        <Route path="/developers" element={
          <DevelopersPage lang={lang} market={market} />
        } />
        {/* /themes — Theme Library (browse + apply backend themes) */}
        <Route path="/themes" element={
          <ThemesPage lang={lang} translations={translations} showToast={showToast} />
        } />
        {/* Catch-all 404 — silences "No routes matched location …" warnings for any future deep-link or stale bookmark, and routes them to the existing NotFound component which already renders a back-to-root button. The explicit ``/`` route above guarantees this only fires for truly-unknown URLs (e.g. a stale /sheet/foo bookmark), not for the legitimate root URL. */}
        <Route path={SHEETS.SEARCH} element={
          <SearchResultsPage
            query={searchResults?.query || ''}
            results={searchResults?.results || []}
            total={searchResults?.total || 0}
            facets={searchResults?.facets || {}}
            currentPage={searchResults?.page || 1}
            totalPages={searchResults?.total_pages || 1}
            lang={lang}
          />
        } />
        {/* Profile detail routes — prevents 404 when clicking cards
            on the Creator Public Profile. Placeholder until dedicated
            pages are built. */}
        <Route path="/sheet/course/:id" element={
          <CourseDetailRoute
            lang={lang}
            user={user}
            showToast={showToast}
            onOpenCheckout={(type, price, meta) => handleOpenCheckout(type, price, meta)}
            onAuthOpen={() => setIsAuthOpen(true)}
          />
        } />
        <Route path="/marketplace/:id" element={
          <ProductDetail
            lang={lang}
            onOpenCheckout={(type, price, meta) => handleOpenCheckout(type, price, meta)}
            showToast={showToast}
            user={user}
          />
        } />
        <Route path="/portfolio/:id" element={
          <PortfolioDetail lang={lang} showToast={showToast} user={user} />
        } />
        <Route path="/sheet/event/:id" element={
          <ProfileItemDetail lang={lang} showToast={showToast} user={user} type="event" />
        } />
        {/* /c/:username — Creator public profile. Must come BEFORE
            /:key/:type so React Router doesn't match key="c". */}
        <Route path="/c/:username" element={
          <CreatorPublicProfile
            lang={lang}
            showToast={showToast}
            currentUserId={user?.id}
            user={user}
            onOpenCheckout={(type, price, meta) => handleOpenCheckout(type, price, meta)}
            onAuthRequired={() => setIsAuthOpen(true)}
          />
        } />
        {/* NEW canonical format — /{slug}/by/{user}/{type} (4 segments). */}
        <Route path="/:slug/by/:user/:type" element={
          <ContentKeyRoute
            lang={lang}
            showToast={showToast}
            user={user}
            onOpenCheckout={(type, price, meta) => handleOpenCheckout(type, price, meta)}
          />
        } />
        {/* LEGACY format — /{id}@{user}/{type} (2 segments, @ in key).
            Renders the matching detail page; malformed keys / unknown types fall
            through to NotFound. Static-first sibling routes always win
            over this dynamic pair (see ContentKeyRoute docstring). */}
        <Route path="/:key/:type" element={
          <ContentKeyRoute
            lang={lang}
            showToast={showToast}
            user={user}
            onOpenCheckout={(type, price, meta) => handleOpenCheckout(type, price, meta)}
          />
        } />
        {/* /404 — proper 404 route. Unknown paths redirect here via
            the catch-all ``*`` below. NotFound renders inside <main>
            (see the effectivePathname check in App). */}
        <Route path="/404" element={null} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
      </Suspense>
      </ChunkLoadErrorBoundary>
    </div>
    </LocaleProvider>
  );
}

export default App;
