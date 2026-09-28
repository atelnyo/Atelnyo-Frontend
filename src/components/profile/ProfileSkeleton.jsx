/**
 * src/components/profile/ProfileSkeleton.jsx
 *
 * Tier-1 leaf — extracted from CreatorPublicProfile.jsx (stage A-1 refactor).
 *
 * Loading skeletons shown while data is being fetched.
 *   - SkeletonSection() — 3-card shimmer row used inside tab content.
 *   - ProfileSkeleton()  — full-page skeleton (cover + avatar + meta + tabs).
 *
 * STAGE A-1: zero behavior change. Exact verbatim copy.
 */

import React from 'react';

// One card-shaped placeholder: image block + title + description lines.
// Mirrors the real ProfileCatalogCard proportions (16/10 image, body).
function SkeletonCard() {
  return (
    <div className="csp-skeleton-card" style={{ flex: 1 }}>
      <div className="csp-skeleton" style={{ aspectRatio: '16 / 10', borderRadius: 14, width: '100%' }} />
      <div className="csp-skeleton" style={{ height: 12, width: '85%', margin: '10px 0 6px', borderRadius: 6 }} />
      <div className="csp-skeleton" style={{ height: 9, width: '60%', borderRadius: 6 }} />
    </div>
  );
}

export function SkeletonSection() {
  return (
    <div style={{ display: 'flex', gap: 12, padding: 20, alignItems: 'flex-start' }}>
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

export default function ProfileSkeleton() {
  return (
    <div className="csp" role="status" aria-busy="true" aria-label="Loading profile">
      <div className="csp-skeleton csp-skel-cover" />
      <div className="csp-skeleton csp-skel-avatar" />
      <div className="csp-skeleton csp-skel-line csp-skel-line--medium" />
      <div className="csp-skeleton csp-skel-line csp-skel-line--long" />
      <div className="csp-skeleton csp-skel-line csp-skel-line--short" />
      <SkeletonSection />
    </div>
  );
}
