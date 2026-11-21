/**
 * Community rules are managed as an ordered list. A rule can be kept for
 * later without being shown on the public page (`is_active === false`).
 * Sorting here keeps the home preview, the full rules tab, and the studio
 * preview in the same order without duplicating that logic.
 */
export function visibleCommunityRules(rules) {
  return (Array.isArray(rules) ? rules : [])
    .filter((rule) => rule && rule.is_active !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
