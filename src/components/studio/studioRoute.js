/**
 * src/components/studio/studioRoute.js
 *
 * One source of truth for "which Studio section is open".
 *
 * The Studio is addressable in two shapes:
 *
 *   /studio/<section>            canonical path route
 *   /sheet/studio?section=<id>   legacy links (Help, activity feed, CTAs)
 *
 * Both resolve in the same order: explicit route (path, then query) → the
 * last section the creator visited → dashboard. A section id the Studio no
 * longer has is returned as `unknown` instead of being silently replaced by
 * the dashboard, so a stale link can say "this section does not exist".
 *
 * Pure functions only — the component owns navigation, this module owns the
 * rules, which keeps them unit-testable without mounting the Studio.
 */

export const STUDIO_ROOT = '/studio';
export const STUDIO_DEFAULT_SECTION = 'dashboard';

/**
 * Canonical address for a section. The dashboard keeps the bare root, so
 * "/studio" and "/studio/dashboard" never both exist as separate pages.
 */
export function studioSectionPath(sectionId) {
  const id = String(sectionId ?? '').trim();
  if (!id || id === STUDIO_DEFAULT_SECTION) return STUDIO_ROOT;
  return `${STUDIO_ROOT}/${encodeURIComponent(id)}`;
}

/** True when the id is one of the sections this Studio actually renders. */
export function isStudioSection(sectionId, validIds = []) {
  return Boolean(sectionId) && Array.isArray(validIds) && validIds.includes(sectionId);
}

/**
 * Resolve the section to open, plus the raw id that was requested (null when
 * nothing explicit was asked for) and the requested id when it is unknown.
 *
 * @param {string[]} validIds — section ids the Studio can render
 * @param {{ pathSection?: string|null, querySection?: string|null, savedSection?: string|null }} sources
 * @returns {{ section: string, requested: string|null, unknown: string|null }}
 */
export function resolveStudioSection(validIds = [], {
  pathSection = null,
  querySection = null,
  savedSection = null,
} = {}) {
  // An explicit route always wins over memory — including the path over the
  // legacy query, so /studio/courses?section=wallet opens Courses.
  const requested = pathSection || querySection || null;
  if (requested) {
    return isStudioSection(requested, validIds)
      ? { section: requested, requested, unknown: null }
      : { section: STUDIO_DEFAULT_SECTION, requested, unknown: requested };
  }
  if (isStudioSection(savedSection, validIds)) {
    return { section: savedSection, requested: null, unknown: null };
  }
  return { section: STUDIO_DEFAULT_SECTION, requested: null, unknown: null };
}
