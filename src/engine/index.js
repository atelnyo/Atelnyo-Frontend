/**
 * src/engine/index.js
 *
 * Frontend Public Entity Engine — the client-side counterpart of the
 * backend Public Entity Engine.  It receives entity data (from API
 * responses) and produces metadata objects that <SEOHead> consumes.
 *
 * Usage:
 *   import { resolveEntity } from '../engine';
 *   const metadata = resolveEntity('course', courseData, { locale: 'ht' });
 *   return <SEOHead {...metadata} />;
 *
 * Design:
 *   * Adapters are stateless functions — they map entity data → metadata
 *   * The engine never touches the DOM — it returns plain objects
 *   * SEOHead is the only component that writes to <head>
 */

const SITE_NAME = 'Atelnyo';
const BASE_URL = 'https://atelnyo.site';
const DEFAULT_IMAGE = `${BASE_URL}/og-banner-en.svg`;
const DEFAULT_DESCRIPTION = 'An international platform where creators teach online courses, share music, sell products, and grow their digital presence.';

// ─── Helpers ────────────────────────────────────────────────────────

function truncate(str, max = 160) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 3).trimEnd() + '...' : str;
}

function ogLocale(lang = 'ht') {
  const map = { ht: 'ht_HT', en: 'en_US', fr: 'fr_FR', es: 'es_ES' };
  return map[lang] || 'en_US';
}

function absoluteUrl(path) {
  if (!path) return BASE_URL;
  return path.startsWith('http') ? path : `${BASE_URL}${path}`;
}

// ─── Content URL builder (mirrors backend contentPath) ──────────────

export function buildEntityUrl(type, slug, username) {
  if (!slug || !username) return '';
  return `/${slug}/by/${username}/${type}`;
}

export function buildProfileUrl(username) {
  return `/c/${username}`;
}

export function buildBusinessUrl(slug) {
  return `/business/${slug}`;
}

export function buildCompanyUrl(slug) {
  return `/company/${slug}`;
}

// ─── Entity metadata resolver ───────────────────────────────────────

/**
 * Resolve an entity's data into metadata for <SEOHead>.
 *
 * @param {string} entityType - 'course', 'product', 'music', etc.
 * @param {object} data - The entity payload from the API
 * @param {object} context - { locale, market }
 * @returns {object} metadata object for <SEOHead>
 */
export function resolveEntity(entityType, data, context = {}) {
  if (!data) return null;

  const locale = context.locale || 'ht';
  const market = context.market || 'HT';

  // Look up adapter
  const adapter = ADAPTERS[entityType];
  if (!adapter) return null;

  return adapter(data, { locale, market });
}

// ─── Adapter registry ───────────────────────────────────────────────

const ADAPTERS = {
  course: (data, ctx) => ({
    title: data.title || '',
    description: truncate(data.description || data.learning_objective || ''),
    image: data.image_url || DEFAULT_IMAGE,
    url: absoluteUrl(buildEntityUrl('course', data.slug || data.id, data.user_key || data.created_by_username || 'Atelnyo')),
    type: 'website',
    schema: buildCourseSchema(data, ctx),
    author: data.created_by_username || data.user_key || '',
    publishedTime: data.created_at || '',
    modifiedTime: data.updated_at || '',
    noindex: data.status === 'draft',
    lang: ctx.locale,
    breadcrumbs: [
      { label: 'Atelnyo', url: '/' },
      { label: 'Kou', url: '/#explore-courses' },
      { label: data.title, url: buildEntityUrl('course', data.slug || data.id, data.user_key || data.created_by_username || 'Atelnyo') },
    ],
  }),

  product: (data, ctx) => ({
    title: data.title || '',
    description: truncate(data.description || ''),
    image: data.image_url || DEFAULT_IMAGE,
    url: absoluteUrl(buildEntityUrl('product', data.slug || data.id, data.user_key || data.seller_username || 'Atelnyo')),
    type: 'website',
    schema: buildProductSchema(data),
    author: data.seller_username || data.user_key || '',
    publishedTime: data.created_at || '',
    modifiedTime: data.updated_at || '',
    noindex: data.status === 'draft',
    lang: ctx.locale,
    breadcrumbs: [
      { label: 'Atelnyo', url: '/' },
      { label: 'Mache', url: '/#explore-marketplace' },
      { label: data.title, url: buildEntityUrl('product', data.slug || data.id, data.user_key || data.seller_username || 'Atelnyo') },
    ],
  }),

  music: (data, ctx) => ({
    title: data.title || '',
    description: truncate(data.description || data.artist || ''),
    image: data.image_url || DEFAULT_IMAGE,
    url: absoluteUrl(buildEntityUrl('music', data.slug || data.id, data.user_key || data.linked_username || 'Atelnyo')),
    type: 'website',
    schema: buildMusicSchema(data),
    author: data.linked_username || data.user_key || data.artist || '',
    publishedTime: data.created_at || '',
    lang: ctx.locale,
    breadcrumbs: [
      { label: 'Atelnyo', url: '/' },
      { label: 'Mizik', url: '/#explore-music' },
      { label: data.title, url: buildEntityUrl('music', data.slug || data.id, data.user_key || data.linked_username || 'Atelnyo') },
    ],
  }),

  talent: (data, ctx) => ({
    title: data.name || data.title || '',
    description: truncate(data.bio || data.description || ''),
    image: data.image_url || DEFAULT_IMAGE,
    url: absoluteUrl(buildEntityUrl('talent', data.slug || data.id, data.user_key || data.linked_username || 'Atelnyo')),
    type: 'website',
    schema: buildTalentSchema(data),
    author: data.linked_username || data.user_key || '',
    publishedTime: data.created_at || '',
    lang: ctx.locale,
    breadcrumbs: [
      { label: 'Atelnyo', url: '/' },
      { label: 'Talan', url: '/#explore-talents' },
      { label: data.name || data.title, url: buildEntityUrl('talent', data.slug || data.id, data.user_key || data.linked_username || 'Atelnyo') },
    ],
  }),

  job: (data, ctx) => ({
    title: data.title || '',
    description: truncate(data.description || ''),
    image: data.image_url || DEFAULT_IMAGE,
    url: absoluteUrl(buildEntityUrl('job', data.slug || data.id, data.user_key || data.posted_by_name || 'Atelnyo')),
    type: 'website',
    schema: buildJobSchema(data),
    author: data.posted_by_name || data.user_key || '',
    publishedTime: data.created_at || '',
    modifiedTime: data.updated_at || '',
    noindex: data.status !== 'published',
    lang: ctx.locale,
    breadcrumbs: [
      { label: 'Atelnyo', url: '/' },
      { label: 'Travay', url: '/#explore-jobs' },
      { label: data.title, url: buildEntityUrl('job', data.slug || data.id, data.user_key || data.posted_by_name || 'Atelnyo') },
    ],
  }),

  portfolio: (data, ctx) => ({
    title: data.title || '',
    description: truncate(data.description || ''),
    image: data.image_url || DEFAULT_IMAGE,
    url: absoluteUrl(buildEntityUrl('portfolio', data.slug || data.id, data.user_key || data.user_username || 'Atelnyo')),
    type: 'website',
    schema: { '@type': 'CreativeWork', name: data.title },
    author: data.user_username || data.user_key || '',
    publishedTime: data.created_at || '',
    lang: ctx.locale,
    breadcrumbs: [
      { label: 'Atelnyo', url: '/' },
      { label: 'Pòtfolyo', url: '/#explore-portfolio' },
      { label: data.title, url: buildEntityUrl('portfolio', data.slug || data.id, data.user_key || data.user_username || 'Atelnyo') },
    ],
  }),

  spotlight: (data, ctx) => ({
    title: data.invention_title || data.title || '',
    description: truncate(data.invention_description || data.description || ''),
    image: data.image_url || DEFAULT_IMAGE,
    url: absoluteUrl(buildEntityUrl('spotlight', data.slug || data.id, data.user_key || 'Atelnyo')),
    type: 'website',
    schema: { '@type': 'CreativeWork', name: data.invention_title || data.title },
    author: data.user_key || '',
    publishedTime: data.created_at || '',
    lang: ctx.locale,
    breadcrumbs: [
      { label: 'Atelnyo', url: '/' },
      { label: 'Spotlight', url: '/#explore-spotlight' },
      { label: data.invention_title || data.title, url: buildEntityUrl('spotlight', data.slug || data.id, data.user_key || 'Atelnyo') },
    ],
  }),

  community: (data, ctx) => ({
    title: data.name || data.title || '',
    description: truncate(data.description || ''),
    image: data.cover_url || DEFAULT_IMAGE,
    url: absoluteUrl(buildEntityUrl('community', data.slug || data.id, data.user_key || 'Atelnyo')),
    type: 'website',
    schema: { '@type': 'Organization', name: data.name },
    author: data.user_key || '',
    lang: ctx.locale,
    breadcrumbs: [
      { label: 'Atelnyo', url: '/' },
      { label: 'Kominote', url: '/#explore-communities' },
      { label: data.name || data.title, url: buildEntityUrl('community', data.slug || data.id, data.user_key || 'Atelnyo') },
    ],
  }),

  profile: (data, ctx) => ({
    title: data.artist_name || data.username || '',
    description: truncate(data.bio || data.description || ''),
    image: data.avatar_url || data.cover_url || DEFAULT_IMAGE,
    url: absoluteUrl(buildProfileUrl(data.username || 'Atelnyo')),
    type: 'website',
    schema: buildProfileSchema(data),
    author: data.username || '',
    lang: ctx.locale,
    breadcrumbs: [
      { label: 'Atelnyo', url: '/' },
      { label: data.artist_name || data.username, url: buildProfileUrl(data.username || 'Atelnyo') },
    ],
  }),
};

// ─── Schema generators (mirror backend) ─────────────────────────────

function buildCourseSchema(data, ctx) {
  const schema = {
    '@type': 'Course',
    name: data.title,
    description: truncate(data.description || '', 300),
    image: data.image_url || DEFAULT_IMAGE,
    provider: { '@type': 'Organization', name: SITE_NAME, url: BASE_URL },
  };
  if (data.created_by_username) {
    schema.author = { '@type': 'Person', name: data.created_by_username };
  }
  if (data.price != null) {
    schema.offers = {
      '@type': 'Offer',
      price: String(data.price),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    };
  }
  if (data.difficulty) schema.educationalLevel = data.difficulty;
  if (data.teaching_language) schema.inLanguage = data.teaching_language;
  return schema;
}

function buildProductSchema(data) {
  const schema = {
    '@type': 'Product',
    name: data.title,
    description: truncate(data.description || '', 300),
    image: data.image_url || DEFAULT_IMAGE,
  };
  if (data.price != null) {
    schema.offers = {
      '@type': 'Offer',
      price: String(data.price),
      priceCurrency: data.currency || 'USD',
      availability: 'https://schema.org/InStock',
    };
  }
  return schema;
}

function buildMusicSchema(data) {
  const schema = {
    '@type': 'MusicRecording',
    name: data.title,
    byArtist: { '@type': 'Person', name: data.artist || data.linked_username || 'Unknown' },
  };
  if (data.genre) schema.genre = data.genre;
  if (data.image_url) schema.image = data.image_url;
  return schema;
}

function buildTalentSchema(data) {
  const schema = {
    '@type': 'Person',
    name: data.name || data.title,
    jobTitle: data.role || 'Creator',
  };
  if (data.bio) schema.description = truncate(data.bio, 300);
  if (data.image_url) schema.image = data.image_url;
  if (data.skills?.length) schema.knowsAbout = data.skills;
  return schema;
}

function buildJobSchema(data) {
  const schema = {
    '@type': 'JobPosting',
    title: data.title,
    description: truncate(data.description || '', 300),
  };
  if (data.location) {
    schema.jobLocation = { '@type': 'Place', address: data.location };
  }
  if (data.is_remote) {
    schema.jobLocation = { '@type': 'Place', address: 'Remote' };
  }
  if (data.budget_min != null) {
    schema.baseSalary = {
      '@type': 'MonetaryAmount',
      minValue: String(data.budget_min),
      maxValue: String(data.budget_max || data.budget_min),
      currency: 'USD',
    };
  }
  return schema;
}

function buildProfileSchema(data) {
  const schema = {
    '@type': 'Person',
    name: data.artist_name || data.username,
    description: truncate(data.bio || '', 300),
    url: `${BASE_URL}/c/${data.username}`,
    memberOf: { '@type': 'Organization', name: SITE_NAME, url: BASE_URL },
  };
  if (data.avatar_url) schema.image = data.avatar_url;
  return schema;
}

// ─── Share URL resolver ─────────────────────────────────────────────

/**
 * Get the canonical share URL for any entity.
 * Used by share buttons and Web Share API.
 */
export function getShareUrl(entityType, data) {
  const locale = context?.locale || 'ht';
  const adapter = ADAPTERS[entityType];
  if (!adapter) return BASE_URL;
  const metadata = adapter(data, { locale });
  return metadata.url || BASE_URL;
}
