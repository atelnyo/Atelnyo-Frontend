/**
 * src/components/profile/profileConstants.js
 *
 * Tier-1 leaf — extracted from CreatorPublicProfile.jsx (stage A-1 refactor).
 *
 * Profile navigation rail + section-config derivation utilities.
 * Imported by:
 *   - src/components/CreatorPublicProfile.jsx (composition root)
 *   - src/components/profile/profileUtils.js (consumer)
 *   - src/components/profile/ProfileLeftRail.jsx (consumer)
 *   - src/components/profile/ProfileDashboardTab.jsx (consumer)
 *
 * STAGE A-1: zero behavior change. Extracted verbatim from monolith.
 *              Default config matches what was hard-coded inline.
 */

// OG image fallback — inline SVG data URI of Atelnyo brand mark.
// Never 404s, never shows Chrome dinosaur. Uses try/catch so a
// btoa() failure (edge case) doesn't crash the module import.
function buildOGFallback() {
  try {
    return 'data:image/svg+xml;base64,' + btoa(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">'
      + '<defs><linearGradient id="og-grad" x1="0%" y1="0%" x2="100%" y2="100%">'
      + '<stop offset="0%" stopColor="#d81b60"/><stop offset="100%" stopColor="#8b5cf6"/></linearGradient>'
      + '</defs><rect width="1200" height="630" fill="url(#og-grad)"/>'
      + '<g transform="translate(600,315)">'
      + '<circle r="180" fill="rgba(255,255,255,0.1)"/>'
      + '<path d="M-60-40 L60-40 L0-100 Z M-50-20 L0-60 L50-20 Z M0-40 L0-60" fill="#fff" opacity="0.9"/>'
      + '<text x="0" y="30" textAnchor="middle" fill="#fff" fontFamily="system-ui,sans-serif"'
      + '  fontSize="48" fontWeight="700" opacity="0.95">Atelnyo</text>'
      + '<text x="0" y="70" textAnchor="middle" fill="rgba(255,255,255,0.6)"'
      + '  fontFamily="system-ui,sans-serif" fontSize="20">Atelnyo</text>'
      + '</g></svg>',
    );
  } catch (_) {
    return 'https://images.unsplash.com/photo-1501504905252-473c47e087f8?auto=format&fit=crop&w=1200&q=80';
  }
}
export const OG_IMAGE_FALLBACK = buildOGFallback();

// Language-aware social banner: the slogan/logo image follows the app
// language (atelnyo_lang). Falls back to the default (ht) banner.
export function ogImageForLang(lang) {
  const code = ['ht', 'en', 'es', 'fr'].includes(lang) ? lang : 'ht';
  return `${window.location.origin}/og-banner-${code}.svg`;
}

// Left navigation rail items (desktop only)
export const RAIL_ITEMS = [
  { id: 'dashboard',  icon: 'fa-th-large',  label: 'Overview',  labelHt: 'Apèsi' },
  { id: 'picks',      icon: 'fa-bookmark',  label: 'Picks',      labelHt: 'Picks' },
  { id: 'courses',    icon: 'fa-graduation-cap', label: 'Courses',   labelHt: 'Kou' },
  { id: 'products',   icon: 'fa-cube',      label: 'Products',   labelHt: 'Pwodwi' },
  { id: 'portfolio',  icon: 'fa-briefcase', label: 'Portfolio',  labelHt: 'Pòtfolyo' },
  // TikTok showcase — opt-in (visibility defaults to false; spec 🖼️)
  { id: 'tiktok',     icon: 'fab fa-tiktok', label: 'TikTok',    labelHt: 'TikTok' },
  { id: 'reviews',    icon: 'fa-star',      label: 'Reviews',    labelHt: 'Revi' },
  { id: 'about',      icon: 'fa-user',      label: 'About',      labelHt: 'Sou nou' },
];

// Profile tabs (also fed to the rail) — will be filtered by section_config
export const PROFILE_TABS = RAIL_ITEMS;

// ─── Default Section Config ──────────────────────────────────────────
// Used when the creator hasn't customized anything in Creator Studio.
export const DEFAULT_SECTION_CONFIG = {
  section_order: [
    'dashboard', 'picks', 'courses', 'products',
    'portfolio', 'tiktok', 'reviews', 'about',
  ],
  section_visibility: {
    dashboard: true, picks: true, courses: true,
    products: true, portfolio: true, tiktok: false, reviews: true,
    about: true,
  },
};

/**
 * Derive visible, ordered tabs from the profile's ``section_config``.
 *
 * 1. Reads ``section_order`` and ``section_visibility`` from the profile.
 * 2. Falls back to ``DEFAULT_SECTION_CONFIG`` when the profile has no config.
 * 3. Returns only the tabs that are both:
 *    - Present in the section_order list (creators may choose to NOT include
 *      a section they don't want, even if visibility is true)
 *    - Marked as visible (visibility[sectionId] !== false)
 * 4. Maps each ID to the full tab definition from ``RAIL_ITEMS`` so icons,
 *    labels, and all other meta are preserved.
 *
 * @param {Object} profile — CreatorPublicProfile data (may have section_config)
 * @returns {Array<Object>} Ordered, filtered array of tab items matching RAIL_ITEMS shape
 */
export function getOrderedTabs(profile) {
  const cfg = profile?.section_config || DEFAULT_SECTION_CONFIG;
  const order = cfg.section_order || DEFAULT_SECTION_CONFIG.section_order;
  const visibility = cfg.section_visibility || DEFAULT_SECTION_CONFIG.section_visibility;
  const tabMap = {};
  RAIL_ITEMS.forEach((item) => { tabMap[item.id] = item; });
  return order
    .filter((id) => visibility[id] !== false && tabMap[id])
    .map((id) => tabMap[id]);
}

/**
 * Check whether a specific section is allowed by ``section_config.visibility``.
 * Falls back to ``true`` when the profile has no config, so legacy profiles
 * without section_config always show everything.
 *
 * @param {Object} profile — CreatorPublicProfile data
 * @param {string} sectionId — e.g. "about", "languages", "quicklinks", "featuredProduct", "activity", "campaigns", "affiliate"
 * @returns {boolean}
 */
export function isSectionVisible(profile, sectionId) {
  const cfg = profile?.section_config || DEFAULT_SECTION_CONFIG;
  const visibility = cfg.section_visibility || DEFAULT_SECTION_CONFIG.section_visibility;
  return visibility[sectionId] !== false;
}

/**
 * Return the section_order array from the profile config (or default).
 * Used by DashboardTab to render dashboard sections in the correct order.
 */
export function getSectionOrder(profile) {
  const cfg = profile?.section_config || DEFAULT_SECTION_CONFIG;
  return cfg.section_order || DEFAULT_SECTION_CONFIG.section_order;
}
