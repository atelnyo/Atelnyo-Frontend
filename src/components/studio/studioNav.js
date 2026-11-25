/**
 * src/components/studio/studioNav.js
 *
 * Which sidebar sections deserve a count.
 *
 * A badge in the Studio nav is not decoration: it means "there is work
 * waiting here". So a section gets a badge only when the overview reports
 * something *actionable*:
 *
 *   courses → drafts that are not published yet
 *   orders  → pending orders the seller still has to handle
 *
 * Totals ("12 courses") are deliberately absent — they never change and
 * they teach the creator to ignore the badge.
 *
 * Pure and defensive: the overview payload can be missing, partial, or
 * carry string numbers from JSON. Anything unusable renders no badge
 * rather than "NaN".
 */

export function navBadges(overview) {
  return {
    courses: overview?.content?.courses?.draft || 0,
    orders: overview?.commerce?.orders?.pending || 0,
  };
}

/** '' when there is nothing to show, so callers can just test truthiness. */
export function formatBadge(count) {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return '';
  return n > 99 ? '99+' : String(n);
}
