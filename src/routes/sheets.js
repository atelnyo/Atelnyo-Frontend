export const SHEETS = Object.freeze({
  ATELIER: '/sheet/atelier',
  // Settings — bare-rendered route so the cog icon in the global
  // Header no longer relies on `setIsSettingsOpen(true)` state; the
  // page itself is now addressable (deep-linkable, browser-back-able)
  // and lives behind the same /sheet/* element-replacement boundary
  // that already keeps Atelier bleed-free.
  SETTINGS: '/sheet/settings',
  // Auth — bare-rendered route so the Login / Signup button inside
  // /sheet/settings (or any future caller) can navigate to a dedicated
  // URL instead of relying on App.jsx's isAuthOpen state. Single Auth
  // mount inside the /sheet/* fragment; the regular App branches no
  // longer need their own copy because there is no in-tab Login trigger
  // left — the only one was Settings, which is now a route.
  AUTH: '/sheet/auth',
  // SEO-friendly canonical auth URLs (T-SEO): /login and /signup are
  // dedicated public routes (not /sheet/* overlays) so search engines
  // and social crawlers get a clean, shareable URL for each auth mode.
  // The modal reads the route's initialMode and the auth footer's
  // switch links navigate between the two so the URL always matches
  // the visible form. /sheet/auth stays as a legacy alias that
  // redirects here.
  LOGIN: '/login',
  SIGNUP: '/signup',
  // Phase Language — Atelnyo Language Academy public hub. Lists the
  // official programs (published only — the backend enforces the draft
  // gate) and drills into a program's Beginner/Intermediate/Advanced
  // course curriculum. Public, no auth required.
  ACADEMY: '/sheet/academy',
  // Phase Learner — global learner area + dedicated Learning Space.
  //   /sheet/learn            — Continue Learning / My Courses /
  //                             Completed / Saved / Recommended.
  //   /sheet/learn/:courseId  — the Learning Space for one course
  //                             (orientation, curriculum, progress,
  //                             practice, assessment, messaging).
  LEARN: '/sheet/learn',
  LEARN_COURSE: '/sheet/learn/:courseId',
  LEARN_COURSE_URL: (courseId) => `/sheet/learn/${courseId}`,
  // Phase Language — Admin Language Academy. Staff-only management:
  // generate the curriculum per program, publish/unpublish, and review
  // every program course (drafts included).
  ADMIN_ACADEMY: '/sheet/admin/academy',
  // Phase Language — Admin Language Academy. Staff-only management:
  // generate the curriculum per program, publish/unpublish, and review
  // every program course (drafts included).
  ADMIN_ACADEMY: '/sheet/admin/academy',
  // Phase 18 — Explore detail sheets. The Explore page (the public
  // catalog at /) used to silently fall through to a placeholder
  // toast on every music + talent card click because App.jsx never
  // passed the onOpenMusicSheet / onOpenTalentSheet / onConnectTalent
  // props. These two routes + the matching components in
  // ``components/explore/`` finish that wiring so the cards open a
  // real detail view.
  //
  // The entity is passed via React-Router ``state`` (not URL params)
  // because the objects are deep + the route shouldn't be
  // deep-linkable in a meaningful way (the API is the source of
  // truth; a hard refresh on the sheet without state bounces to
  // / via a defensive ``<Navigate to="/" replace />`` in each
  // sheet component). Mounted as Routes inside the existing /sheet/*
  // fragment so the bottom-nav + global app chrome stay
  // bleed-free (same isolation contract as Privacy/Settings/Auth).
  EXPLORE_MUSIC:  '/sheet/explore/music',
  EXPLORE_TALENT: '/sheet/explore/talent',
  // Phase 34 — Full calendar view (month/week grid of events
  // + course deadlines). Mounted as a sheet route so the bottom-nav
  // + global app chrome stay bleed-free.
  CALENDAR: '/sheet/calendar',
  // Phase 36 — Community detail page. Dynamic route with :slug param.
  // Navigate via navigate(`/sheet/community/${community.slug}`).
  //
  // The Community sheet is now URL-driven on its tabs too: each
  // ``events``/``members``/``announcements``/``files``/``courses``
  // sub-tab lives at ``/sheet/community/:slug/<tab>``. The parent
  // route has an ``index`` redirect to ``events`` so a bare
  // visit (or a legacy ``navigate('/sheet/community/${slug}')``
  // from Explore) still lands on the same default. Use the helper
  // below when a future caller wants to deep-link a specific tab.
  COMMUNITY: '/sheet/community/:slug',
  COMMUNITY_TAB: (slug, tab) => `/sheet/community/${slug}/${tab}`,
  // Phase 38 — Creator Analytics Dashboard
  ANALYTICS: '/sheet/analytics',
  // Phase 39 — Referral & Affiliate Dashboard
  REFERRAL: '/sheet/referral',
  // Phase 50 — Creator Apply (gated). Same hidden-trigger pattern
  // as Spotlight: a 3-tap easter egg in Settings reveals a launcher
  // that navigates here. The route itself is NOT in the bottom-nav
  // and the component itself does a hard <Navigate to="/"> if the
  // user is anonymous OR the localStorage unlock flag is missing.
  // This makes the surface opt-in (not "for all users") as the
  // product spec requires. ``onClose`` returns the user to /.
  CREATOR_APPLY: '/sheet/creator-apply',
  // Phase 49 §11.2 — Public Spotlight deep-link routing.
  // Dynamic route with :id param. Navigate via
  // ``navigate(`/sheet/spotlight/${approved.id}`)``.
  //
  // The detail page is the canonical deep-link target for the
  // re-engagement URLs the Phase 49 roadmap promises ("other
  // Phase 49 candidates can re-use the deep-link for re-engagement
  // URLs" — announcement surfaces, message-thread forward links,
  // etc). The page is URL-driven, NOT state-driven: the
  // SpotlightApplication payload is fetched fresh from the BE on
  // each mount so a deep-link to a cold-loaded card always renders
  // the canonical data with the latest admin review.
  //
  // Open Graph + Twitter Card meta tags are mounted via
  // ``react-helmet-async`` inside SpotlightDetail.jsx so a pasted
  // link produces a rich preview in chat clients that render
  // embedded JS. The known crawl-bot limitation is documented in
  // the component's own header — Facebook's crawler does not
  // execute JS, so the OG preview on a fresh FB share falls back to
  // the static index.html meta tags. A future Phase 49 sub-deliverable
  // (Phase 49 §11.5) adds a crawler-aware Django-rendered HTML
  // endpoint that returns proper meta tags on first request so this
  // gap closes.
  SPOTLIGHT_DETAIL: '/sheet/spotlight/:id',
  // Phase Company — dedicated in-app company page. Dynamic route
  // with :slug param (navigate via ``navigate(`/company/${slug}`)``).
  // The page is URL-driven: the CompanyProfile payload is fetched
  // fresh from the BE on each mount so a deep-link always renders
  // the latest approved data.
  COMPANY_DETAIL: '/company/:slug',
  // Phase Business — Business Hub. Lists the account's business
  // profiles (separate identity from the Creator branch) + create CTA.
  // Auth-gated; the backend list endpoint is owner-scoped.
  BUSINESS: '/business',
  // Phase Business — Business Workspace. The management context for a
  // single business profile. Dynamic route with :slug param (navigate
  // via navigate(`/business/${profile.slug}/workspace`)). The page is
  // URL-driven: the BusinessProfile payload is fetched fresh on each
  // mount, so a deep-link always renders the latest data. Auth-gated;
  // non-owners get a 404 from the owner-scoped backend.
  BUSINESS_WORKSPACE: '/business/:slug/workspace',
  // Phase Business — PUBLIC Business Profile page. Dynamic route with
  // :slug param (navigate via navigate(SHEETS.businessPublicUrl(slug))).
  // URL-driven + PUBLIC (no AuthGate): the backend retrieve serves
  // ACTIVE profiles to anyone via the PII-free public serializer and
  // 404s dormant ones for non-owners. Discovery-isolated: reachable
  // only by knowing the slug — never listed in Explore / Home Feed /
  // Search.
  BUSINESS_PUBLIC: '/business/:slug',
  // Helper for building a public-page link from a known slug.
  BUSINESS_PUBLIC_URL: (slug) => `/business/${encodeURIComponent(slug || '')}`,
  // Phase Business — customer-side "My Orders" page. Lists EVERY order
  // the signed-in account has placed across business profiles (the
  // customer counterpart to the owner's workspace Orders tab). The
  // static 3-segment route outranks the 2-segment /business/:slug
  // public-page route in React Router's ranking, so "orders/mine" can
  // never be swallowed by a slug.
  BUSINESS_MY_ORDERS: '/business/orders/mine',
  // Phase ∞ — Creator Studio. A full workspace for creators to manage
  // their courses, music, products, portfolio, wallet, analytics,
  // messages, and settings — all in one place. Only visible to users
  // with is_creator=true role (gate enforced in the component itself
  // so the route doesn't 404 on anonymous users — it just redirects).
  STUDIO: '/sheet/studio',
  // Phase 58 — Notifications center. Full-screen notification list
  // with mark-read actions. Accessible from the header bell icon.
  NOTIFICATIONS: '/sheet/notifications',
  // Phase ∞ — Universal direct-message inbox. Every authenticated user
  // (creator or not) can read + reply to their conversations here; the
  // same MessagesSection the Studio uses, mounted for everyone so a
  // non-creator who messaged a creator can see the reply.
  MESSAGES: '/sheet/messages',
  // Phase 58 — Wallet standalone page.
  WALLET: '/sheet/wallet',
  // Phase ∞ — Admin Creator Review. Staff-only page that lists all
  // creator applications with Approve / Reject / Under Review actions.
  // Only accessible to users with is_staff or is_superuser.
  ADMIN_DASHBOARD: '/sheet/admin/dashboard',
  ADMIN_CREATORS: '/sheet/admin/creators',
  // Phase 53 — Admin Media Provider Manager
  ADMIN_MEDIA: '/sheet/admin/media',
  ADMIN_BROKEN_MEDIA: '/sheet/admin/broken-media',
  ADMIN_VALIDATION_QUEUE: '/sheet/admin/validation-queue',
  ADMIN_MODERATION: '/sheet/admin/moderation',
  ADMIN_REPORTS: '/sheet/admin/reports',
  ADMIN_INCIDENTS: '/sheet/admin/incidents',
  ADMIN_SECURITY: '/sheet/admin/security-center',
  ADMIN_PROVIDER_HEALTH: '/sheet/admin/provider-health',
  ADMIN_MEDIA_MONITOR: '/sheet/admin/media-monitor',
  ADMIN_SECURITY_MONITOR: '/sheet/admin/security-monitor',
  // Phase Premium — Admin User Management. Staff-only page listing
  // users with premium status + Grant/Revoke premium actions (the
  // admin panel is the approve surface for premium entitlements,
  // mirroring the AdminCreatorReview approve flow).
  ADMIN_USERS: '/sheet/admin/users',
  // Phase 47/48 — Admin Spotlight Application Manager
  ADMIN_SPOTLIGHT: '/sheet/admin/spotlight',
  ADMIN_BUSINESS_SPOTLIGHT: '/sheet/admin/business-spotlight',
  // Phase Company — Admin Company Profile Review
  ADMIN_COMPANIES: '/sheet/admin/companies',
  // Phase 1 — Admin Rule Engine
  ADMIN_RULE_ENGINE: '/sheet/admin/rules',
  // Admin FAQ — staff-specific help center for admin tools.
  ADMIN_FAQ: '/sheet/admin/faq',
  // Phase 54 — Creator Public Profile
  // Dynamic route with @:username param (industry-standard).
  // Navigate via navigate(`/@${username}`).
  // Legacy /creator/:username redirects to /@:username via App.jsx.
  CREATOR_PROFILE: '/c/:username',
  CREATOR_PROFILE_LEGACY: '/creator/:username',
  // Phase 55 — Search & Discovery Engine
  SEARCH: '/sheet/search',
  // Phase 23 — Media Entity Page (full-page view of a single media).
  // Dynamic route with :id param. Navigate via
  // navigate(`/sheet/media/${media.id}`, { state: { media } }).
  // The page accepts the media payload via React-Router state OR a
  // sessionStorage cache set by the studio panels (utils/mediaCache.js).
  // A bare visit to /sheet/media/:id without state falls back to the
  // page's "no media loaded" empty state and bounces to /sheet/studio.
  MEDIA_ENTITY: '/sheet/media/:id',
});
