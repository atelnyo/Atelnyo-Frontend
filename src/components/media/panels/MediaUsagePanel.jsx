/**
 * MediaUsagePanel — Usage tab content (Slice 0 retro).
 *
 * Delegates to LinkedContent. Adds an aggregate summary header so the
 * panel is self-describing when drawn outside the Inspector (e.g. on
 * the full Entity Page).
 */
import React from 'react';
import LinkedContent from '../LinkedContent';

export default function MediaUsagePanel({ media, lang = 'ht' }) {
  const item = media || {};
  const isHt = lang === 'ht';
  const usages = Array.isArray(item.usages) ? item.usages : [];

  const moduleCounts = usages.reduce((acc, u) => {
    const m = u.module || 'other';
    acc[m] = (acc[m] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="media-panel media-panel-usage">
      {usages.length > 0 && (
        <div className="media-panel-summary" aria-live="polite">
          <span className="media-panel-summary-item">
            <i className="fas fa-link" />
            <strong>{usages.length}</strong> {isHt ? 'referans' : 'references'}
          </span>
          {Object.entries(moduleCounts).slice(0, 4).map(([mod, n]) => (
            <span key={mod} className="media-panel-summary-chip">
              <i className={`fas ${moduleIcon(mod)}`} />
              {mod}: {n}
            </span>
          ))}
        </div>
      )}
      <LinkedContent usages={usages} lang={lang} />
    </div>
  );
}

function moduleIcon(mod) {
  const map = {
    course: 'fa-graduation-cap',
    lesson: 'fa-video',
    product: 'fa-cube',
    portfolio: 'fa-briefcase',
    profile_banner: 'fa-image',
    profile_avatar: 'fa-user-circle',
    music: 'fa-music',
    cover: 'fa-book-cover',
    community: 'fa-users',
    spotlight: 'fa-lightbulb',
    cms: 'fa-pager',
    homepage: 'fa-home',
    other: 'fa-link',
  };
  return map[mod] || 'fa-link';
}
