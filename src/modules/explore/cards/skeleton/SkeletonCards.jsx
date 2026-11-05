/**
 * Skeleton card components for Explore — extracted from Explore.jsx
 *
 * Every skeleton reuses the REAL card class (``explore-card-course`` /
 * ``-music`` / ``-talent`` / ``-spotlight``), so the loading rail already
 * has the per-type width the live rail will have. The talent skeleton used
 * to be a circle row, but the tour renders a card inside a rail now — the
 * old shape made the rail jump when the feed landed.
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
    <div className="explore-card explore-card-talent explore-skeleton" aria-hidden="true">
      <div className="explore-card-image-wrap" />
      <div className="explore-card-body">
        <div className="explore-skel-line explore-skel-line--title-sm" />
        <div className="explore-skel-line explore-skel-line--sub-sm" />
        <div className="explore-skel-line explore-skel-line--meta" />
      </div>
    </div>
  );
}

/* Event cards have their own template (cover frame + date block + meta +
   action column), so the loading rail uses the real explore-card-event
   class — same width and same zones, no jump when the feed lands. */
export function SkeletonEventCard() {
  return (
    <div className="explore-card explore-card-event explore-skeleton" aria-hidden="true">
      <div className="explore-card-image-wrap explore-card-image-square" />
      <div className="explore-event-layout">
        <div className="explore-event-date">
          <div className="explore-skel-line explore-skel-line--title-sm" style={{ width: 28 }} />
          <div className="explore-skel-line explore-skel-line--sub-sm" style={{ width: 32 }} />
        </div>
        <div className="explore-event-info">
          <div className="explore-skel-line explore-skel-line--title" />
          <div className="explore-skel-line explore-skel-line--sub" />
          <div className="explore-skel-line explore-skel-line--meta" />
        </div>
        <div className="explore-event-action">
          <div className="explore-skel-line" style={{ width: 64, height: 28, borderRadius: 999 }} />
        </div>
      </div>
    </div>
  );
}

/* Spotlight cards are wider (280-320px) than the other rails, so the loading
   rail uses their real class instead of a course card — same width, no jump. */
export function SkeletonSpotlightCard() {
  return (
    <div className="explore-card explore-card-spotlight explore-skeleton" aria-hidden="true">
      <div className="explore-card-image-wrap" />
      <div className="explore-card-body">
        <div className="explore-skel-line explore-skel-line--title" />
        <div className="explore-skel-line explore-skel-line--sub" />
        <div className="explore-skel-line explore-skel-line--meta" />
      </div>
    </div>
  );
}
