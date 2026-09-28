/**
 * scripts/route-inventory.mjs — canonical inventory of every SPA route.
 *
 * Sources: src/App.jsx <Route path="..."> literals + src/routes/sheets.js
 * SHEETS constants (expanded). Dynamic :params get realistic sample values.
 * Exported as ROUTES; consumed by scripts/audit-all-pages.mjs.
 */

// Sample values for dynamic segments (realistic shapes; these test the
// ROUTE exists — the entity may not, which is allowed to render NotFound)
export const SAMPLES = {
  username: 'Atelnyo',
  slug: 'atelnyo-academy',
  id: '1',
  courseId: '1',
  code: 'TEST-CODE',
  topic: 'wallet',
  key: '1@Atelnyo',
  type: 'course',
};

export const ROUTES = [
  // ── Root & main tabs ──
  '/',
  '/explore',
  '/sheet/explore',
  '/mwen',

  // ── Auth ──
  '/login',
  '/signup',
  '/sheet/auth',

  // ── Public info pages ──
  '/about',
  '/trust',
  '/contact',
  '/accessibility',
  '/status',
  '/developers',
  '/themes',
  '/faq',
  '/help',
  '/help/wallet',
  '/legal',
  '/legal/terms',
  '/verify',
  '/academy',
  '/sheet/academy',

  // ── Explore sheets ──
  '/sheet/explore/music',
  '/sheet/explore/talent',
  '/sheet/explore/job',
  '/sheet/calendar',

  // ── Community ──
  '/sheet/community/atelnyo-academy',
  '/sheet/community/atelnyo-academy/events',
  '/sheet/community/atelnyo-academy/members',

  // ── CMS pages ──
  '/sheet/page/about',
  '/page/about',

  // ── Courses & learning ──
  '/sheet/course/1',
  '/sheet/learn',
  '/sheet/learn/1',
  '/sheet/curriculum/1',

  // ── Content deep links ──
  '/1/by/Atelnyo/course',
  '/1/by/Atelnyo/product',
  '/1@Atelnyo/course',
  '/1@Atelnyo/product',
  '/marketplace/1',
  '/portfolio/1',
  '/sheet/event/1',
  '/sheet/media/1',
  '/sheet/spotlight/1',
  '/company/atelnyo',

  // ── Creator profiles ──
  '/c/Atelnyo',
  '/creator/Atelnyo',
  '/@Atelnyo',

  // ── Search ──
  '/sheet/search',

  // ── Legacy compat ──
  '/courses/1',
  '/go/TEST-CODE',

  // ── Private / gated (must render, not hard-404) ──
  '/sheet/settings',
  '/sheet/studio',
  '/sheet/creator-apply',
  '/sheet/analytics',
  '/sheet/referral',
  '/sheet/notifications',
  '/sheet/wallet',
  '/sheet/messages',
  '/affiliate',
  '/affiliate/discover',
  '/business',
  '/business/orders/mine',
  '/business/atelnyo',
  '/business/atelnyo/workspace',

  // ── Admin (staff-only) ──
  '/sheet/admin/dashboard',
  '/sheet/admin/creators',
  '/sheet/admin/media',
  '/sheet/admin/broken-media',
  '/sheet/admin/validation-queue',
  '/sheet/admin/moderation',
  '/sheet/admin/reports',
  '/sheet/admin/incidents',
  '/sheet/admin/security-center',
  '/sheet/admin/provider-health',
  '/sheet/admin/media-monitor',
  '/sheet/admin/security-monitor',
  '/sheet/admin/users',
  '/sheet/admin/spotlight',
  '/sheet/admin/business-spotlight',
  '/sheet/admin/companies',
  '/sheet/admin/rules',
  '/sheet/admin/faq',
  '/sheet/admin/platform-faq',
  '/sheet/admin/academy',

  // ── DEIE ──
  '/sheet/deie/feed',
  '/sheet/deie/mentor',
  '/sheet/deie/evolution',

  // ── Atelier ──
  '/sheet/atelier',

  // ── System routes ──
  '/404',
];
