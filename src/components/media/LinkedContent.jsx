/**
 * LinkedContent — Montre tout kote yon medya itilize atravè platfòm nan.
 *
 * Egzanp: Course A, Lesson 4, Creator Banner, Homepage, Community,
 * Marketplace, Portfolio, Spotlight, CMS
 */
import React from 'react';

const MODULE_ICONS = {
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

const MODULE_LABELS = {
  course: { en: 'Course', ht: 'Kou' },
  lesson: { en: 'Lesson', ht: 'Leson' },
  product: { en: 'Product', ht: 'Pwodwi' },
  portfolio: { en: 'Portfolio', ht: 'Pòtfolyo' },
  profile_banner: { en: 'Profile Banner', ht: 'Banyè Pwofil' },
  profile_avatar: { en: 'Profile Avatar', ht: 'Avatè Pwofil' },
  music: { en: 'Music Track', ht: 'Track Mizik' },
  cover: { en: 'Cover Image', ht: 'Imaj Kouvèti' },
  community: { en: 'Community', ht: 'Kominote' },
  spotlight: { en: 'Spotlight', ht: 'Spotlight' },
  cms: { en: 'CMS Page', ht: 'Paj CMS' },
  homepage: { en: 'Homepage', ht: 'Paj Premye' },
  other: { en: 'Other', ht: 'Lòt' },
};

export default function LinkedContent({ usages = [], lang = 'ht', className = '' }) {
  const isHt = lang === 'ht';

  if (!usages || usages.length === 0) {
    return (
      <div className="linked-content-empty">
        <i className="fas fa-unlink" />
        <p>{isHt ? 'Medya sa pa itilize okenn kote.' : 'This media is not used anywhere.'}</p>
      </div>
    );
  }

  return (
    <div className={`linked-content ${className}`}>
      <h4 className="linked-content-title">
        <i className="fas fa-link" />
        {isHt ? 'Itilize nan' : 'Used in'} ({usages.length})
      </h4>
      <div className="linked-content-list">
        {usages.map((usage, i) => {
          const mod = usage.module || '';
          const icon = MODULE_ICONS[mod] || 'fa-link';
          const label = MODULE_LABELS[mod] || { en: mod, ht: mod };
          const name = usage.name || usage.title || usage.module_id || '';
          const url = usage.url || '';

          return (
            <div key={i} className="linked-content-item">
              <div className="linked-content-icon">
                <i className={`fas ${icon}`} />
              </div>
              <div className="linked-content-body">
                <span className="linked-content-module">
                  {isHt ? label.ht : label.en}
                </span>
                {name && (
                  <span className="linked-content-name">{name}</span>
                )}
              </div>
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="linked-content-open"
                  title={isHt ? 'Louvri' : 'Open'}
                >
                  <i className="fas fa-external-link-alt" />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
