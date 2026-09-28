import React from 'react';
import { fmtCount, useCountUp } from './profileUtils';

/**
 * AnimatedStat — animated counter tile (uses useCountUp hook).
 * VERBATIM extraction from CreatorPublicProfile.jsx (post-A-2) for Stage A-3.5.
 * NOTE: prop order is `value, icon, label` (matches inline signature).
 *
 * @param {{ value: number, icon: string, label: string }} props
 */
export function AnimatedStat({ value, icon, label, format }) {
  const animated = useCountUp(value, 800);
  return (
    <div className="csp-glass-stat">
      <div className="csp-glass-stat-value">
        {format ? format(animated) : fmtCount(animated)}
      </div>
      <div className="csp-glass-stat-label">
        <i className={`fas ${icon}`} aria-hidden="true" /> {label}
      </div>
    </div>
  );
}

/**
 * GlassStatsCard — floating, frosted glass, with count-up.
 * VERBATIM extraction from CreatorPublicProfile.jsx (post-A-2) for Stage A-3.5.
 * Stats list: picks / views / students / courses / products.
 *
 * NOTE: The follower count tile was removed 2026-08-13 — the hero now
 * shows the follower count under the handle (Instagram-style), so the
 * stats bar no longer duplicates it.
 *
 * @param {{ profile: any, picksCount: number, lang: string, isOwner: boolean }} props
 */
export default function GlassStatsCard({ profile, picksCount, lang, isOwner, tipTotalAmount = 0, tipTotalCount = 0 }) {
  const stats = [
    { value: picksCount,      label: lang === 'ht' ? 'Picks'    : 'Picks',     icon: 'fa-bookmark' },
    // Real, persistent view count from CreatorPublicProfile.view_count
    // (backend increments it atomically on every public visit).
    // PRIVACY: only the profile owner sees the visit count — visitors
    // must not learn how popular (or not) a creator is.
    ...(isOwner ? [{ value: profile.view_count || 0, label: lang === 'ht' ? 'Vizit' : 'Views', icon: 'fa-eye' }] : []),
    { value: profile.students_count, label: lang === 'ht' ? 'Etidyan' : 'Students', icon: 'fa-user-graduate' },
    { value: profile.courses_count,  label: lang === 'ht' ? 'Kou'    : 'Courses',  icon: 'fa-graduation-cap' },
    { value: profile.products_count, label: lang === 'ht' ? 'Pwodwi'   : 'Products', icon: 'fa-cube' },
    // All-time tips received — PUBLIC social proof (tip_received events
    // are public and the leaderboard is public). Hidden while zero so a
    // fresh creator doesn't show a bare "$0.00" tile.
    ...(tipTotalAmount > 0 ? [{
      value: tipTotalAmount,
      label: lang === 'ht' ? 'Tip resevwa' : 'Tips',
      icon: 'fa-hand-holding-heart',
      format: (n) => `$${Number(n).toFixed(2)}`,
    }] : []),
  ];

  return (
    <div className="csp-glass-stats" role="list" aria-label="Statistics">
      <div className="csp-glass-stats-grid">
        {stats.map((s, i) => (
          <AnimatedStat key={i} value={s.value} icon={s.icon} label={s.label} format={s.format} />
        ))}
      </div>
    </div>
  );
}
