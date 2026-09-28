/**
 * Skeleton card components for Explore — extracted from Explore.jsx
 */

import React from 'react';

export function SkeletonCourseCard() {
  return (
    <div className="explore-card explore-card-course explore-skeleton" aria-hidden="true">
      <div className="explore-card-image-wrap" />
      <div className="explore-card-body">
        <div className="explore-skel-line explore-skel-line--title" />
        <div className="explore-skel-line explore-skel-line--sub" />
        <div className="explore-skel-line explore-skel-line--meta" />
      </div>
    </div>
  );
}

export function SkeletonMusicCard() {
  return (
    <div className="explore-card explore-card-music explore-skeleton" aria-hidden="true">
      <div className="explore-card-image-wrap explore-card-image-square" />
      <div className="explore-card-body explore-card-body-tight">
        <div className="explore-skel-line explore-skel-line--title-sm" />
        <div className="explore-skel-line explore-skel-line--sub-sm" />
      </div>
    </div>
  );
}

export function SkeletonTalentCard() {
  return (
    <div className="explore-card explore-card-talent explore-skeleton explore-skeleton-talent" aria-hidden="true">
      <div className="explore-talent-row">
        <div className="explore-skel-circle" />
        <div className="explore-talent-meta">
          <div className="explore-skel-line explore-skel-line--title-sm" />
          <div className="explore-skel-line explore-skel-line--sub-sm" />
        </div>
      </div>
    </div>
  );
}
