/**
 * src/modules/explore/utils/searchAdapters.js
 *
 * Faz 1 (unified search routing) — adapter layer that maps the
 * CrossModuleSearchViewSet payload (``GET /api/search/?q=``) into the
 * exact card shapes Explore.jsx already renders.
 *
 * The search endpoint returns a normalized dict per result:
 *   { type, id, title, subtitle, description, image_url, url,
 *     creator, badges, ... }
 *
 * Each adapter below spreads the base dict then renames/aliases fields
 * onto the shape the matching card component expects (e.g. MusicCard
 * reads ``track.cover`` + ``track.artist``, TalentCard reads
 * ``talent.avatar`` + ``talent.name``). Unmapped fields simply don't
 * render — the cards all degrade gracefully on missing metadata.
 *
 * ``byType`` is the single entry point: ``{ courses: [...], music: [...] }``
 * keyed by the Explore section names so the caller can drop the arrays
 * straight into the existing per-section state.
 */
import { normalizeTrack, normalizeTalent } from './cardHelpers';

/** Courses: search sends title/image_url; CourseCard reads the same. */
function adaptCourse(r) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    image_url: r.image_url || '',
    is_featured: r.is_featured || false,
    // Keep the normalized url so a click can navigate if needed.
    _url: r.url || '',
  };
}

/** Music: search sends image_url/creator; MusicCard reads cover/artist. */
function adaptMusic(r) {
  return normalizeTrack({
    id: r.id,
    title: r.title,
    artist: r.creator || r.subtitle || '',
    genre: r.genre || '',
    cover_url: r.image_url || '',
    is_featured: r.is_featured || false,
    _url: r.url || '',
  });
}

/** Talents: search sends title/subtitle/image_url; TalentCard reads name/role/avatar. */
function adaptTalent(r) {
  return normalizeTalent({
    id: r.id,
    name: r.title,
    role: r.subtitle || '',
    description: r.description || '',
    avatar_url: r.image_url || '',
    is_new: r.is_new || false,
    is_featured: r.is_featured || false,
    _url: r.url || '',
  });
}

/** Communities: search sends title/subtitle/image_url. */
function adaptCommunity(r) {
  return {
    id: r.id,
    name: r.title,
    description: r.description || r.subtitle || '',
    banner_url: r.image_url || '',
    category: r.category || '',
    is_featured: r.is_featured || false,
    _url: r.url || '',
  };
}

/** Jobs: search sends title/budget subline/price. */
function adaptJob(r) {
  return {
    id: r.id,
    title: r.title,
    description: r.description || '',
    budget_min: r.price ? Number(r.price) * 0.8 : null,
    budget_max: r.price ? Number(r.price) : null,
    is_remote: (r.badges || []).includes('Remote'),
    status: 'published',
    _url: r.url || '',
  };
}

/** Portfolio: search sends title/description/image_url. */
function adaptPortfolio(r) {
  return {
    id: r.id,
    title: r.title,
    description: r.description || '',
    cover_url: r.image_url || '',
    category: r.category || '',
    is_featured: r.is_featured || false,
    _url: r.url || '',
  };
}

/** Marketplace products: search sends title/price/image_url. */
function adaptProduct(r) {
  return {
    id: r.id,
    title: r.title,
    description: r.description || '',
    image_url: r.image_url || '',
    price: r.price ?? 0,
    kind: r.kind || 'product',
    is_featured: r.is_featured || false,
    _url: r.url || '',
  };
}

/** Events: search sends title/date subline/image_url. */
function adaptEvent(r) {
  return {
    id: r.id,
    title: r.title,
    description: r.description || '',
    cover_url: r.image_url || '',
    start_time: r.start_time || null,
    location: r.location || '',
    is_free: (r.badges || []).includes('Free'),
    community_name: r.community_name || r.subtitle || '',
    _url: r.url || '',
  };
}

/**
 * Group a flat search result array into per-section buckets.
 *
 * @param {Array} results — the ``results`` array from /api/search/
 * @returns {Object} — { courses, music, talents, communities, jobs,
 *   portfolio, marketplace, events } (empty arrays when no hits)
 */
export function groupSearchResults(results = []) {
  const buckets = {
    courses: [],
    music: [],
    talents: [],
    communities: [],
    jobs: [],
    portfolio: [],
    marketplace: [],
    events: [],
  };
  for (const r of results) {
    switch (r?.type) {
      case 'course':
        buckets.courses.push(adaptCourse(r));
        break;
      case 'music':
        buckets.music.push(adaptMusic(r));
        break;
      case 'talent':
        buckets.talents.push(adaptTalent(r));
        break;
      case 'community':
        buckets.communities.push(adaptCommunity(r));
        break;
      case 'job':
        buckets.jobs.push(adaptJob(r));
        break;
      case 'portfolio':
        buckets.portfolio.push(adaptPortfolio(r));
        break;
      case 'product':
        buckets.marketplace.push(adaptProduct(r));
        break;
      case 'event':
        buckets.events.push(adaptEvent(r));
        break;
      default:
        // creators/pages/achievements don't have Explore cards — skip.
        break;
    }
  }
  return buckets;
}

/** Map an active filter chip id to the search ``types=`` CSV value. */
export function filterToSearchTypes(filter) {
  switch (filter) {
    case 'courses':
      return 'courses';
    case 'music':
      return 'music';
    case 'talents':
      return 'talents';
    case 'communities':
      return 'communities';
    case 'jobs':
      return 'jobs';
    case 'portfolio':
      return 'portfolio';
    case 'marketplace':
      return 'products';
    case 'events':
      return 'events';
    default:
      // 'all' / 'featured' / 'new' → search everything.
      return undefined;
  }
}
