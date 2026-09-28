/**
 * src/modules/explore/cards/SaveCountChip.jsx
 *
 * Tiny presentational chip for the Explore cards — shows the total
 * number of saves (across ALL users) for a catalog item so visitors
 * can gauge popularity without opening the detail page.
 *
 * The number comes from the public batch endpoint
 * ``GET /api/explore/saved/items/counts/`` (see ``savedItemService
 * .counts`` in services/api.js) — ONE request per section, then each
 * card renders its own chip from the returned map.
 *
 * Renders nothing when count is 0 / unknown, so a quiet catalog
 * stays visually clean (and the anonymous first paint never shows a
 * flash of empty chips).
 */
import React from 'react';

export default function SaveCountChip({ count, t }) {
  const n = Number(count) || 0;
  if (n <= 0) return null;
  const raw = (t && (t.explore_save_count || t.mwen_save_count)) || '{count} saves';
  const label = String(raw).replace('{count}', String(n));
  return (
    <span className="explore-card-save-count" title={label} aria-label={label}>
      <i className="fas fa-heart" aria-hidden="true" />
      {n > 999 ? '999+' : n}
    </span>
  );
}
