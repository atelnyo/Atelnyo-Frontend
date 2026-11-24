/**
 * src/modules/explore/utils/publicVisibility.js
 *
 * Publication guards for Explore catalog rows.
 *
 * The catalog endpoints also return the viewer's OWN Studio drafts (and
 * every status for staff), and the localStorage snapshot can predate an
 * unpublish or a price edit. Every Explore surface therefore re-checks
 * publication instead of trusting a cached row:
 *
 *   • course  → ``status === 'published'`` (missing status = legacy row)
 *   • product → ``is_active !== false``  (is_active=False is a Studio draft)
 *
 * ``applyPublicVisibility`` is the single function used by BOTH cache
 * directions: the mount-time restore and the post-fetch cache write. That
 * keeps a draft from being painted on a revisit and from being persisted
 * back with a fresh TTL.
 */

/** A course belongs in Explore only while its status is 'published'. */
export function isPublicCourse(course) {
  return !course || !course.status || course.status === 'published';
}

/** A product is public only while it is ACTIVE (is_active=True). */
export function isPublicProduct(product) {
  return !product || product.is_active !== false;
}

// Filter one snapshot key in place-of-copy; leave absent keys absent so
// the caller's "is this snapshot usable?" checks keep working.
const filterKey = (snapshot, key, predicate) => (
  Array.isArray(snapshot[key])
    ? { [key]: snapshot[key].filter(predicate) }
    : {}
);

/**
 * Return a copy of an Explore snapshot with unpublished rows stripped.
 * Idempotent — safe to apply on restore and again before writing.
 */
export function applyPublicVisibility(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {return snapshot;}
  return {
    ...snapshot,
    ...filterKey(snapshot, '_courses', isPublicCourse),
    ...filterKey(snapshot, '_recommendedCourses', isPublicCourse),
    ...filterKey(snapshot, '_marketplace', isPublicProduct),
    ...filterKey(snapshot, '_recommendedProducts', isPublicProduct),
  };
}
