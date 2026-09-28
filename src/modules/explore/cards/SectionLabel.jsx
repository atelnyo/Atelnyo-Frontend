/**
 * src/modules/explore/cards/SectionLabel.jsx
 *
 * Section header component — extracted from Explore.jsx
 */
import React from 'react';

export default function SectionLabel({ icon, children, count, accent, id }) {
  return (
    <h2 className="explore-section-label" data-accent={accent || 'default'} id={id}>
      {icon && <i className={`fas ${icon}`} aria-hidden="true" />}
      <span>{children}</span>
      {typeof count === 'number' && count > 0 && (
        <span className="explore-section-count">{count}</span>
      )}
    </h2>
  );
}
