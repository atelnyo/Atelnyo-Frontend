/**
 * MediaBreadcrumbs — Trail: Creator Studio → Media Hub → Collection → Media.
 *
 * Spec (Prompt 23 §10):
 *   - Each crumb has route + label + separator + click handler
 *   - ARIA-friendly (role="navigation" + aria-label + aria-current="page")
 *   - Current crumb (the media itself) is rendered as <span> not <button>
 *
 * Used by:
 *   - MediaEntityPage (top of full-page media view)
 *   - MediaInspector (when mounted as a page rather than drawer)
 *
 * Optional `onCrumbClick` callback lets the parent override nav
 * (e.g. for the drawer pattern where we don't want a route change).
 */
import React from 'react';
import useSafeNavigate from '../../hooks/useSafeNavigate';
import { SHEETS } from '../../routes/sheets';

export default function MediaBreadcrumbs({
  media,
  collection = null,
  lang = 'ht',
  onCrumbClick,
}) {
  const navigate = useSafeNavigate();
  const isHt = lang === 'ht';

  const t = (en, ht) => (isHt ? ht : en);

  const crumbs = [
    {
      id: 'studio',
      label: t('Creator Studio', 'Estudio Kreyatè'),
      navigate: () => navigate(SHEETS.STUDIO),
    },
    {
      id: 'hub',
      label: t('Media Hub', 'Sant Medya'),
      navigate: () => navigate(SHEETS.STUDIO),
    },
    ...(collection
      ? [{
          id: 'collection',
          label: collection.name || collection.title || t('Collection', 'Koleksyon'),
          navigate: () => navigate(SHEETS.STUDIO),
        }]
      : []),
    {
      id: 'media',
      label: media?.title
        || media?.original_filename
        || media?.name
        || t('Media', 'Medya'),
      isCurrent: true,
    },
  ];

  return (
    <nav
      className="media-breadcrumbs"
      role="navigation"
      aria-label={t('Breadcrumb', 'Navigasyon')}
    >
      <ol className="media-breadcrumbs-list">
        {crumbs.map((c, i) => (
          <li key={c.id} className="media-breadcrumbs-item">
            {c.isCurrent ? (
              <span
                className="media-breadcrumbs-current"
                aria-current="page"
                title={c.label}
              >
                {c.label}
              </span>
            ) : (
              <>
                <button
                  type="button"
                  className="media-breadcrumbs-link"
                  onClick={() => (onCrumbClick ? onCrumbClick(c) : c.navigate())}
                  aria-label={t('Go to', 'Ale nan') + ' ' + c.label}
                >
                  {c.label}
                </button>
                {i < crumbs.length - 1 && (
                  <span className="media-breadcrumbs-separator" aria-hidden="true">
                    <i className="fas fa-chevron-right" />
                  </span>
                )}
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
