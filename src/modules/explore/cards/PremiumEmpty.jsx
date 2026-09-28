/**
 * src/modules/explore/cards/PremiumEmpty.jsx
 *
 * Premium empty state + error state — extracted from Explore.jsx.
 * Shows a rose illustration for empty catalog, or an error icon + retry button.
 */
import React from 'react';

export default function PremiumEmpty({ search, onClearFilters, t, error }) {
  if (error) {
    return (
      <div className="explore-empty explore-empty-premium explore-empty-error" role="alert">
        <div className="explore-empty-rose explore-empty-icon" aria-hidden="true">
          <i className="fas fa-triangle-exclamation" />
        </div>
        <h3>{t.explore_load_error || 'Could not load catalog'}</h3>
        <p>{error}</p>
        <button type="button" className="explore-empty-cta" onClick={onClearFilters}>
          <i className="fas fa-rotate-left" aria-hidden="true" /> {t.explore_retry || 'Retry'}
        </button>
      </div>
    );
  }
  return (
    <div className="explore-empty explore-empty-premium" role="status">
      <div className="explore-empty-rose" aria-hidden="true">
        <span className="petal p1" />
        <span className="petal p2" />
        <span className="petal p3" />
        <span className="petal p4" />
        <span className="petal p5" />
        <span className="petal p6" />
        <span className="center" />
      </div>
      <h3>{t.explore_empty || (search ? (t.explore_empty_search || 'Pa gen rezilta pou rechèch sa a') : 'Anyen pa jwenn')}</h3>
      <p>{t.explore_empty_hint || 'Eseze yon lòt mo oswa chanje filtè a.'}</p>
      {search && (
        <button type="button" className="explore-empty-cta" onClick={onClearFilters}>
          <i className="fas fa-rotate-left" aria-hidden="true" /> {t.explore_clear_filters || 'Efase rechèch la'}
        </button>
      )}
    </div>
  );
}
