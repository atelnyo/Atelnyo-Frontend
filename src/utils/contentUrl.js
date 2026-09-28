/**
 * src/utils/contentUrl.js
 *
 * Content deep-link URL helpers — the canonical shareable URL shape for
 * every Explore content category:
 *
 *   /{slug}/by/{user}/{type}
 *
 * Examples:
 *   /lanmou-sou-do-kay/by/johndoe/music
 *   /marie-blanche/by/marie/talent
 *   /devweb-haïti/by/pierre/job
 *   /solèy-leve/by/jean/spotlight
 *   /sit-web-mireille/by/mireille/portfolio
 *   /konpase-dijital/by/alex/product
 *   /python-avanse/by/rose/course
 *   /fèt-mizik/by/paulo/event
 *   /kominote-mizik/by/louis/community
 *
 * ``{slug}`` is the content's unique slug (title-derived) — the
 * resolvable key on every detail endpoint (the backend's
 * SlugOrPkLookupMixin accepts both the slug and the numeric pk, so a
 * hand-typed legacy link still resolves).
 * ``{user}`` is the owning creator's username: a human-readable
 * namespace that makes the link self-describing, cosmetic for
 * resolution (the FE never validates it). Using the slug (instead of
 * the raw pk) keeps URLs readable, shareable and opaque — a visitor
 * sees the title, not the row counter.
 *
 * The legacy ``/sheet/explore/{type}?id=``, ``/sheet/spotlight/:id``,
 * ``/portfolio/:id``, ``/marketplace/:id``, ``/sheet/course/:id`` and
 * ``/sheet/event/:id`` deep-links still work — each detail component
 * auto-redirects (replace) to the canonical URL once the payload loads
 * (see ``isLegacyContentUrl``).
 */

export const CONTENT_TYPES = [
  'music', 'talent', 'job', 'spotlight', 'portfolio', 'product', 'course', 'event',
  'community',
];

/** Stable fallback used when a content row has no owner username. */
export const CONTENT_USER_FALLBACK = 'Atelnyo';

/** Singular + plural aliases for the ``/type`` segment. */
const TYPE_ALIASES = {
  music: 'music', musics: 'music',
  talent: 'talent', talents: 'talent',
  job: 'job', jobs: 'job',
  spotlight: 'spotlight', spotlights: 'spotlight',
  portfolio: 'portfolio', portfolios: 'portfolio',
  product: 'product', products: 'product',
  course: 'course', courses: 'course',
  event: 'event', events: 'event',
  community: 'community', communities: 'community',
};

/**
 * Types whose resolvable key is their unique slug (not the numeric pk).
 *
 * Every content model gained a title-derived unique slug in migrations
 * 0095 (course/product/job/portfolio) and 0102 (music/talent/spotlight/
 * event); community always had one. ``buildContentUrl`` therefore
 * emits the slug first for ALL categories so the shareable URL reads
 * naturally (``/konpase-dijital/by/alex/product``) while the backend still
 * resolves a hand-typed numeric pk (SlugOrPkLookupMixin). Items whose
 * payload lacks a ``slug`` (stale cache, pre-0095 rows) fall back to
 * the numeric id — the URL still resolves.
 */
const SLUG_KEY_TYPES = {
  community: 1,
  product: 1,
  course: 1,
  music: 1,
  talent: 1,
  job: 1,
  portfolio: 1,
  spotlight: 1,
  event: 1,
};

/** Legacy URL prefixes that auto-upgrade to the canonical format. */
const LEGACY_PREFIX = {
  music: '/sheet/explore/music',
  talent: '/sheet/explore/talent',
  job: '/sheet/explore/job',
  spotlight: '/sheet/spotlight/',
  portfolio: '/portfolio/',
  product: '/marketplace/',
  course: '/sheet/course/',
  event: '/sheet/event/',
};

/** Normalize a raw ``/type`` segment to its canonical key (or null). */
export function normalizeContentType(type) {
  return TYPE_ALIASES[String(type || '').toLowerCase()] || null;
}

/**
 * Best-effort owner username for a content payload. Reads the
 * canonical ``user_key`` field (exposed by every content serializer)
 * and falls back to the legacy field names for stale cached payloads.
 */
export function contentUserKey(item) {
  if (!item) return CONTENT_USER_FALLBACK;
  return (
    item.user_key
    || item.created_by_username
    || item.linked_username
    || item.posted_by_name
    || item.user_name
    || item.seller_username
    || item.username
    || CONTENT_USER_FALLBACK
  );
}

/** Build ``/{slug}/by/{user}/{type}`` from a content payload. */
export function buildContentUrl(type, item) {
  const t = normalizeContentType(type) || type;
  // Every canonical type is slug-keyed (SLUG_KEY_TYPES) — prefer the
  // slug so the URL reads like the title. ``||`` (not ``??``) so an
  // empty-string slug falls back to the numeric id instead of emitting
  // a broken ``/by/user/{type}`` key that parseContentUrl can't match.
  const key = item && (SLUG_KEY_TYPES[t] ? (item.slug || item.id) : (item.id || item.slug));
  const user = contentUserKey(item);
  return `/${key}/by/${user}/${t}`;
}

/**
 * Absolute canonical share URL — ``window.location.origin`` + the
 * ``/{id}@{user}/{type}`` path. This is the link the Share buttons
 * copy / hand to ``navigator.share``, so recipients always land on the
 * canonical deep-link (never a legacy or in-app path). Falls back to
 * the relative path in non-browser environments (unit tests / SSR).
 */
export function buildContentShareUrl(type, item) {
  const path = buildContentUrl(type, item);
  if (typeof window === 'undefined' || !window.location?.origin) return path;
  return new URL(path, window.location.origin).href;
}

/**
 * Parse the ``{id}/by/{user}`` segment of a content URL.
 * Returns ``{ id, user }`` or null when the key has no ``/by/`` separator.
 * ``id`` stays a string — it may be a numeric pk or a slug.
 */
export function parseContentUrl(key) {
  const s = String(key || '').trim();
  // New format: {id}/by/{user}
  const mNew = /^([^/]+)[/]by[/]([^/]+)$/.exec(s);
  if (mNew) return { id: mNew[1], user: decodeURIComponent(mNew[2]) };
  // Legacy format: {id}@{user} (for backwards compat)
  const mOld = /^([^@]+)@([^/]+)$/.exec(s);
  if (mOld) return { id: mOld[1], user: decodeURIComponent(mOld[2]) };
  return null;
}

/**
 * True when ``pathname`` is a legacy detail URL for ``type`` — used by
 * the detail components to fire the one-shot canonical redirect
 * (replace, so history isn't polluted). New-format URLs never match.
 */
export function isLegacyContentUrl(type, pathname) {
  const prefix = LEGACY_PREFIX[type];
  if (!prefix) return false;
  const p = String(pathname || '');
  return p === prefix || p.startsWith(prefix);
}

/** True when ``pathname`` already is a canonical ``/…/by/…/{type}`` URL. */
export function isContentRoutePath(pathname) {
  return /^\/[^/]+\/by\/[^/]+\/(?:music|talent|job|spotlight|portfolio|product|course|event|community)$/
    .test(String(pathname || ''));
}
