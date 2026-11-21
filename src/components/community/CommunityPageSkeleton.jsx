/* eslint-disable react/prop-types -- presentational skeleton, no PropTypes anywhere in the codebase */
/**
 * src/components/community/CommunityPageSkeleton.jsx
 *
 * Page-shaped loading state for /community/:slug. The spinner it
 * replaces gave no hint of what was coming; this mirrors the real
 * banner → description → tabs → rows rhythm, so the page does not jump
 * when the community arrives.
 */
import React from 'react';

const ROW_WIDTHS = ['68%', '54%', '61%'];

export default function CommunityPageSkeleton({ lang = 'en' }) {
  const label = lang === 'ht'
    ? 'Ap chaje kominote a'
    : lang === 'fr'
      ? 'Chargement de la communauté'
      : lang === 'es'
        ? 'Cargando la comunidad'
        : 'Loading community';

  return (
    <div
      className="community-detail c-page-skeleton"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <div className="c-banner c-page-skeleton-banner" aria-hidden="true">
        <div className="c-banner-content">
          <span className="c-page-skeleton-avatar" />
          <div className="c-banner-info c-page-skeleton-lines">
            <span className="c-page-skeleton-line c-page-skeleton-line--title" />
            <span className="c-page-skeleton-line c-page-skeleton-line--meta" />
          </div>
          <span className="c-page-skeleton-btn" />
        </div>
      </div>

      <div className="c-page-skeleton-body" aria-hidden="true">
        <span className="c-page-skeleton-line" />
        <span className="c-page-skeleton-line c-page-skeleton-line--short" />

        <div className="c-page-skeleton-tabs">
          {['home', 'events', 'posts', 'members', 'files'].map((tab) => (
            <span key={tab} />
          ))}
        </div>

        {ROW_WIDTHS.map((width) => (
          <div className="c-page-skeleton-row" key={width}>
            <span className="c-page-skeleton-circle" />
            <span className="c-page-skeleton-lines" style={{ width }}>
              <span className="c-page-skeleton-line" />
              <span className="c-page-skeleton-line c-page-skeleton-line--short" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
