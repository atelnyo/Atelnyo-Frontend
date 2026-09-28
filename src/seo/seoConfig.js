/**
 * src/seo/seoConfig.js
 *
 * Centralized SEO route registry — the SINGLE source of truth for every
 * public page's SEO policy. Each route entry defines:
 *
 *   • titleTemplate   — how to build <title> (supports {name}, {slug})
 *   • description     — default meta description (can be overridden per-entity)
 *   • robots          — "index,follow" | "noindex,nofollow" | "noindex"
 *   • ogType          — og:type value
 *   • schemaType      — JSON-LD @type to emit
 *   • indexable       — whether this route is eligible for search indexing
 *   • breadcrumbs     — default breadcrumb labels (dynamic labels added per-entity)
 *
 * WHY a central registry:
 *   • Avoids duplicating SEO logic across 74 routes
 *   • Makes it trivial to audit which pages are indexable
 *   • Enables the useSEO hook to auto-apply correct meta per route
 *   • Prevents accidental indexing of private pages
 */

const SITE_NAME = 'Atelnyo';
const BASE_URL = 'https://atelnyo.site';

// ─── Default descriptions per page type ──────────────────────────────
const DESCRIPTIONS = {
  home: 'An international platform where creators teach online courses, share music, sell products, and grow their digital presence. Join 50+ creators and start learning today.',
  explore: 'Discover online courses, music, talent, and products from 50+ creators on Atelnyo.',
  about: 'About Atelnyo — Learn, Create, Share. An international platform empowering creators, educators, and entrepreneurs.',
  courses: 'Browse all courses on Atelnyo — programming, design, business, language, and more.',
  creator: 'Creator profile on Atelnyo — courses, products, portfolio, and more.',
  course: 'Course on Atelnyo — learn new skills from verified creators.',
  product: 'Product on Atelnyo — discover unique products from creators.',
  music: 'Listen to music on Atelnyo — discover talented artists and their tracks.',
  talent: 'Discover talented creators on Atelnyo — find the right person for your project.',
  job: 'Find remote jobs on Atelnyo — connect with opportunities from verified creators.',
  community: 'Join a community on Atelnyo — connect with like-minded creators.',
  legal: 'Legal information for Atelnyo users.',
  login: 'Sign in to Atelnyo',
  signup: 'Create your Atelnyo account',
  settings: 'Account settings — private page.',
  studio: 'Creator Studio — manage your courses, products, and profile.',
  dashboard: 'Your dashboard — private page.',
  notFound: 'Page not found on Atelnyo.',
};

// ─── Route SEO Registry ──────────────────────────────────────────────
// Keys are route patterns (matched against effectivePathname).
// More specific routes are matched first.
const SEO_ROUTES = {
  // ─── Public indexable pages ────────────────────────────────────────
  '/': {
    title: SITE_NAME,
    description: DESCRIPTIONS.home,
    robots: 'index,follow',
    ogType: 'website',
    schemaType: 'WebSite',
    indexable: true,
    breadcrumbs: [],
  },
  '/explore': {
    title: 'Explore',
    description: DESCRIPTIONS.explore,
    robots: 'index,follow',
    ogType: 'website',
    indexable: true,
    breadcrumbs: [{ label: 'Home', url: '/' }],
  },
  '/about': {
    title: 'About',
    description: DESCRIPTIONS.about,
    robots: 'index,follow',
    ogType: 'website',
    schemaType: 'AboutPage',
    indexable: true,
    breadcrumbs: [{ label: 'Home', url: '/' }],
  },
  '/trust': {
    title: 'Trust Center',
    description: 'Atelnyo Trust Center: security, privacy, accessibility, browser compatibility, and data controls.',
    robots: 'index,follow',
    ogType: 'website',
    indexable: true,
    breadcrumbs: [{ label: 'Home', url: '/' }],
  },
  '/contact': {
    title: 'Contact',
    description: 'Get in touch with Atelnyo support for general inquiries, privacy, security, and accessibility feedback.',
    robots: 'index,follow',
    ogType: 'website',
    indexable: true,
    breadcrumbs: [{ label: 'Home', url: '/' }],
  },
  '/accessibility': {
    title: 'Accessibility',
    description: 'Atelnyo Accessibility Statement: our commitment to WCAG compliance, keyboard navigation, screen reader support, and inclusive design.',
    robots: 'index,follow',
    ogType: 'website',
    indexable: true,
    breadcrumbs: [{ label: 'Home', url: '/' }],
  },
  '/status': {
    title: 'Platform Status',
    description: 'Check the current status of Atelnyo services, API availability, and system health.',
    robots: 'noindex,nofollow',
    ogType: 'website',
    indexable: false,
    breadcrumbs: [{ label: 'Home', url: '/' }],
  },
  '/developers': {
    title: 'Developers',
    description: 'Atelnyo developer documentation, API reference, integration guides, and open-source resources.',
    robots: 'index,follow',
    ogType: 'website',
    indexable: true,
    breadcrumbs: [{ label: 'Home', url: '/' }],
  },

  // ─── Course pages (dynamic — slug added at runtime) ────────────────
  '/courses': {
    title: 'Courses',
    description: DESCRIPTIONS.courses,
    robots: 'index,follow',
    ogType: 'website',
    indexable: true,
    breadcrumbs: [
      { label: 'Home', url: '/' },
      { label: 'Courses', url: '/explore' },
    ],
  },
  '/courses/': {
    title: 'Course',
    description: DESCRIPTIONS.course,
    robots: 'index,follow',
    ogType: 'article',
    schemaType: 'Course',
    indexable: true,
    breadcrumbs: [
      { label: 'Home', url: '/' },
      { label: 'Courses', url: '/explore' },
    ],
  },

  // ─── Creator profiles (dynamic — username added at runtime) ────────
  '/c/': {
    title: 'Creator',
    description: DESCRIPTIONS.creator,
    robots: 'index,follow',
    ogType: 'profile',
    schemaType: 'ProfilePage',
    indexable: true,
    breadcrumbs: [
      { label: 'Home', url: '/' },
      { label: 'Creators', url: '/explore' },
    ],
  },

  // ─── Product pages (dynamic) ───────────────────────────────────────
  '/products': {
    title: 'Products',
    description: 'Discover products on Atelnyo.',
    robots: 'index,follow',
    ogType: 'website',
    indexable: true,
  },

  // ─── Music / Talent / Job sheets ───────────────────────────────────
  '/sheet/explore/music': {
    title: 'Music',
    description: 'Listen to music on Atelnyo.',
    robots: 'index,follow',
    ogType: 'music.song',
    schemaType: 'MusicRecording',
    indexable: true,
    breadcrumbs: [{ label: 'Home', url: '/' }],
  },
  '/sheet/explore/talent': {
    title: 'Talent',
    description: DESCRIPTIONS.talent,
    robots: 'index,follow',
    ogType: 'profile',
    schemaType: 'Person',
    indexable: true,
    breadcrumbs: [{ label: 'Home', url: '/' }],
  },
  '/sheet/explore/job': {
    title: 'Jobs',
    description: DESCRIPTIONS.job,
    robots: 'index,follow',
    ogType: 'website',
    schemaType: 'JobPosting',
    indexable: true,
    breadcrumbs: [{ label: 'Home', url: '/' }],
  },
  '/sheet/explore': {
    title: 'Explore',
    description: DESCRIPTIONS.explore,
    robots: 'index,follow',
    ogType: 'website',
    indexable: true,
    breadcrumbs: [{ label: 'Home', url: '/' }],
  },

  // ─── Community pages ───────────────────────────────────────────────
  '/sheet/community': {
    title: 'Community',
    description: DESCRIPTIONS.community,
    robots: 'index,follow',
    ogType: 'website',
    indexable: true,
    breadcrumbs: [{ label: 'Home', url: '/' }],
  },

  // ─── Help Center ─────────────────────────────────────────────────
  '/help': {
    title: 'Help Center',
    description: 'Find answers to common questions, learn how to use Atelnyo courses, music, marketplace, and account features. Get support and contact our team.',
    robots: 'index,follow',
    ogType: 'website',
    indexable: true,
    breadcrumbs: [{ label: 'Home', url: '/' }],
  },

  // ─── Legal / Trust pages ───────────────────────────────────────────
  '/legal': {
    title: 'Legal',
    description: DESCRIPTIONS.legal,
    robots: 'index,follow',
    ogType: 'website',
    indexable: true,
    breadcrumbs: [{ label: 'Home', url: '/' }],
  },
  '/legal/': {
    title: 'Legal',
    description: DESCRIPTIONS.legal,
    robots: 'index,follow',
    ogType: 'website',
    indexable: true,
    breadcrumbs: [
      { label: 'Home', url: '/' },
      { label: 'Legal', url: '/legal' },
    ],
  },
  '/themes': {
    title: 'Themes',
    description: 'Browse available themes on Atelnyo.',
    robots: 'index,follow',
    ogType: 'website',
    indexable: true,
    breadcrumbs: [{ label: 'Home', url: '/' }],
  },
  '/academy': {
    title: 'Language Academy',
    description: 'Atelnyo Language Academy — published official language programs (Creole, French, Spanish, English) with structured curricula for every level.',
    robots: 'index,follow',
    ogType: 'website',
    indexable: true,
    breadcrumbs: [{ label: 'Home', url: '/' }],
  },
  '/sheet/academy': {
    title: 'Language Academy',
    description: 'Atelnyo Language Academy — published official language programs (Creole, French, Spanish, English) with structured curricula for every level.',
    robots: 'index,follow',
    ogType: 'website',
    indexable: true,
    breadcrumbs: [{ label: 'Home', url: '/' }],
  },

  // ─── Private / authenticated pages — NOINDEX ──────────────────────
  '/login': {
    title: 'Sign In',
    description: DESCRIPTIONS.login,
    robots: 'noindex,nofollow',
    ogType: 'website',
    indexable: false,
  },
  '/signup': {
    title: 'Sign Up',
    description: DESCRIPTIONS.signup,
    robots: 'noindex,nofollow',
    ogType: 'website',
    indexable: false,
  },
  '/settings': {
    title: 'Settings',
    description: DESCRIPTIONS.settings,
    robots: 'noindex,nofollow',
    ogType: 'website',
    indexable: false,
  },
  '/sheet/settings': {
    title: 'Settings',
    description: DESCRIPTIONS.settings,
    robots: 'noindex,nofollow',
    ogType: 'website',
    indexable: false,
  },
  '/sheet/studio': {
    title: 'Creator Studio',
    description: DESCRIPTIONS.studio,
    robots: 'noindex,nofollow',
    ogType: 'website',
    indexable: false,
  },
  '/sheet/calendar': {
    title: 'Calendar',
    description: 'Your calendar — private page.',
    robots: 'noindex,nofollow',
    ogType: 'website',
    indexable: false,
  },
  '/mwen': {
    title: 'My Profile',
    description: 'Your profile — private page.',
    robots: 'noindex,nofollow',
    ogType: 'website',
    indexable: false,
  },
  '/learner': {
    title: 'Learner Dashboard',
    description: DESCRIPTIONS.dashboard,
    robots: 'noindex,nofollow',
    ogType: 'website',
    indexable: false,
  },
  '/admin': {
    title: 'Admin',
    description: 'Admin panel — private.',
    robots: 'noindex,nofollow',
    ogType: 'website',
    indexable: false,
  },
  '/creator-studio': {
    title: 'Creator Studio',
    description: DESCRIPTIONS.studio,
    robots: 'noindex,nofollow',
    ogType: 'website',
    indexable: false,
  },
  '/business/workspace': {
    title: 'Business Workspace',
    description: 'Business workspace — private.',
    robots: 'noindex,nofollow',
    ogType: 'website',
    indexable: false,
  },
  '/notifications': {
    title: 'Notifications',
    description: 'Your notifications — private page.',
    robots: 'noindex,nofollow',
    ogType: 'website',
    indexable: false,
  },
  '/wallet': {
    title: 'Wallet',
    description: 'Your wallet — private page.',
    robots: 'noindex,nofollow',
    ogType: 'website',
    indexable: false,
  },
  '/chat': {
    title: 'Chat',
    description: 'Messages — private page.',
    robots: 'noindex,nofollow',
    ogType: 'website',
    indexable: false,
  },

  // ─── CMS dynamic pages (indexed unless hidden) ────────────────────
  '/sheet/page': {
    title: 'Page',
    description: '',
    robots: 'index,follow',
    ogType: 'website',
    indexable: true,
  },
  '/page': {
    title: 'Page',
    description: '',
    robots: 'index,follow',
    ogType: 'website',
    indexable: true,
  },
};

/**
 * Match a pathname against the SEO route registry.
 * Tries exact match first, then longest-prefix match.
 *
 * @param {string} pathname — effectivePathname (locale stripped)
 * @returns {{ route: object, matchedPath: string } | null}
 */
export function matchSEOConfig(pathname) {
  if (!pathname) return null;

  // Exact match first
  if (SEO_ROUTES[pathname]) {
    return { route: SEO_ROUTES[pathname], matchedPath: pathname };
  }

  // Longest-prefix match (more specific routes win)
  let bestMatch = null;
  let bestLen = 0;
  for (const [pattern, config] of Object.entries(SEO_ROUTES)) {
    if (pathname.startsWith(pattern) && pattern.length > bestLen) {
      bestMatch = config;
      bestLen = pattern.length;
    }
  }

  return bestMatch ? { route: bestMatch, matchedPath: pathname } : null;
}

/**
 * Check if a route is indexable.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function isIndexable(pathname) {
  const match = matchSEOConfig(pathname);
  return match ? match.route.indexable : false;
}

/**
 * Get the robots directive for a route.
 *
 * @param {string} pathname
 * @returns {string} — "index,follow" | "noindex,nofollow" | "noindex"
 */
export function getRobotsDirective(pathname) {
  const match = matchSEOConfig(pathname);
  return match ? match.route.robots : 'noindex,nofollow';
}

export { SITE_NAME, BASE_URL, DESCRIPTIONS, SEO_ROUTES };
