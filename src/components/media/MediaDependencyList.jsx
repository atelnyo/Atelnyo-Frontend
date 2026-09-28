/**
 * MediaDependencyList — Renders the per-module-type usage breakdown.
 *
 * Spec (Phase CREATOR EXPERIENCE §6 — Media Dependency):
 *   "Anvan yon Creator efase yon medya. Sistèm nan dwe montre.
 *    'Media sa itilize nan. 2 Courses, 1 Community, 5 Lessons,
 *     3 Products, 1 Homepage Banner.'"
 *
 * Sprint stance:
 *   Until /api/media/:id/dependencies/ ships, uses
 *   `mediaDependencies.computeDependencies(media)` which falls back
 *   to a deterministic seeded spread of `usage_count` when granular
 *   data is missing. The BackendPendingChip hides once the BE
 *   endpoint returns canonical `usage_breakdown`.
 *
 * Behavior:
 *   - Renders nothing when total is 0.
 *   - Each row: module name + count badge + optional module-type pill.
 *   - `inline` mode renders compactly for embedding inside other
 *     components (e.g. the dependency explainer card on the dashboard).
 */
import React from 'react';
import BackendPendingChip from './BackendPendingChip';
import { computeDependencies } from '../../utils/mediaDependencies';
import { makeT } from '../../utils/langBackendStub';

export default function MediaDependencyList({
  lang = 'ht',
  media,
  inline = false,
  showPendingChip = true,
}) {
  const t = makeT(lang);

  if (!media) return null;
  const list = computeDependencies(media, lang);
  if (list.length === 0) {
    return (
      <div className={`media-dependency-list ${inline ? 'media-dependency-list-inline' : ''}`}>
        <p className="media-dependency-empty">
          {lang === 'en'
            ? 'Not used anywhere yet. Safe to delete.'
            : 'Poko itilize okenn kote. San danje pou efase.'}
        </p>
      </div>
    );
  }

  // hasData=true when the granular breakdown is real (e.g. backend).
  // hasData=false when we're showing the deterministic-fallback spread.
  const allFallback = list.every((row) => !row.hasData);

  return (
    <div
      className={`media-dependency-list ${inline ? 'media-dependency-list-inline' : ''}`}
      role="list"
      aria-label={t('deleteConfirmImpacted')}
    >
      <header className="media-dependency-list-header">
        <span className="media-dependency-list-title">
          {t('deleteConfirmImpacted')}
        </span>
        {showPendingChip && allFallback && (
          <BackendPendingChip
            lang={lang}
            endpoint="/api/media/:id/dependencies/"
            inline
          />
        )}
      </header>
      <ul className="media-dependency-list-rows">
        {list.map((row) => (
          <li key={row.moduleId} className="media-dependency-list-row" role="listitem">
            <span className="media-dependency-list-row-name">{row.label}</span>
            <span className="media-dependency-list-row-count" aria-label={`${row.count} ${row.label}`}>
              {row.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
