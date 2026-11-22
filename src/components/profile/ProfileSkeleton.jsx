/**
 * src/components/profile/ProfileSkeleton.jsx
 *
 * Loading skeletons shown while profile data is being fetched.
 *   - SkeletonSection({ count = 3 }) — responsive card-grid shimmer used
 *     inside tab content.
 *   - ProfileSkeleton({ lang }) — full-page skeleton that mirrors the REAL
 *     public-page structure: rail + cover + avatar + identity/meta + stats +
 *     tab bar + sidebar, so the page doesn't jump when data arrives.
 *
 * All shimmer blocks are aria-hidden; the page wrapper announces the busy
 * state once (role="status"), and motion respects prefers-reduced-motion.
 */
import React from 'react';
import { inlineText } from '../../utils/inlineI18n';

// One card-shaped placeholder: image block + title + description lines.
// Mirrors the real ProfileCatalogCard proportions (16/10 image, body).
function SkeletonCard() {
  return (
    <div className="csp-skeleton-card">
      <div className="csp-skeleton" style={{ aspectRatio: '16 / 10', borderRadius: 14, width: '100%' }} />
      <div className="csp-skeleton" style={{ height: 12, width: '85%', margin: '10px 12px 6px' }} />
      <div className="csp-skeleton" style={{ height: 9, width: '60%', margin: '0 12px' }} />
    </div>
  );
}

export function SkeletonSection({ count = 3 }) {
  return (
    <div className="csp-skeleton-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

// One generic sidebar card block (about / languages / links).
function SidebarCard({ lines = 3 }) {
  return (
    <div className="csp-skel-side-card">
      <div className="csp-skeleton" style={{ height: 12, width: '55%', marginBottom: 10 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="csp-skeleton" style={{ height: 9, width: `${90 - i * 14}%`, marginBottom: 7 }} />
      ))}
    </div>
  );
}

export default function ProfileSkeleton({ lang = 'en' }) {
  const label = lang === 'ht' ? 'Ap chaje pwofil la' : inlineText(lang, 'Loading profile');
  return (
    <div className="csp" role="status" aria-busy="true" aria-label={label}>
      <div className="csp-layout csp-skel-layout">
        {/* Left rail */}
        <div className="csp-skel-rail" aria-hidden="true">
          <div className="csp-skeleton csp-skel-rail-logo" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="csp-skeleton csp-skel-rail-item" />
          ))}
        </div>

        {/* Main column */}
        <div className="csp-skel-main" aria-hidden="true">
          <div className="csp-skeleton csp-skel-cover" />
          <div className="csp-skel-identity">
            <div className="csp-skeleton csp-skel-avatar" />
            <div className="csp-skel-identity-lines">
              <div className="csp-skeleton csp-skel-line csp-skel-line--medium" />
              <div className="csp-skeleton csp-skel-line csp-skel-line--short" />
              <div className="csp-skeleton csp-skel-line csp-skel-line--long" />
            </div>
          </div>
          <div className="csp-skel-stats">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="csp-skeleton csp-skel-stat" />
            ))}
          </div>
          <div className="csp-skel-tabs">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="csp-skeleton csp-skel-tab" />
            ))}
          </div>
          <SkeletonSection count={6} />
        </div>

        {/* Right business sidebar */}
        <aside className="csp-skel-sidebar" aria-hidden="true">
          <SidebarCard lines={4} />
          <SidebarCard lines={2} />
          <SidebarCard lines={3} />
        </aside>
      </div>
    </div>
  );
}
