/**
 * SmartFilters — Filtre avanse pou medya yo.
 *
 * Creator ka filtre pa:
 *   - Images, Videos, Audio, Documents
 *   - Public, Private
 *   - Healthy, Broken
 *   - Recently Added, Recently Used
 *   - Favorites, Collections
 *   - Unused, Processing, Failed
 */
import React from 'react';

const FILTER_GROUPS = [
  {
    id: 'type',
    icon: 'fa-filter',
    labelEn: 'Media Type',
    labelHt: 'Kalite Medya',
    options: [
      { value: 'all', icon: 'fa-th', labelEn: 'All Types', labelHt: 'Tout kalite' },
      { value: 'image', icon: 'fa-image', labelEn: 'Images', labelHt: 'Imaj' },
      { value: 'video', icon: 'fa-video', labelEn: 'Videos', labelHt: 'Videyo' },
      { value: 'audio', icon: 'fa-music', labelEn: 'Audio', labelHt: 'Odyo' },
      { value: 'document', icon: 'fa-file-alt', labelEn: 'Documents', labelHt: 'Dokiman' },
    ],
  },
  {
    id: 'status',
    icon: 'fa-heartbeat',
    labelEn: 'Health',
    labelHt: 'Sante',
    options: [
      { value: 'all', icon: 'fa-circle', labelEn: 'All Status', labelHt: 'Tout estati' },
      { value: 'healthy', icon: 'fa-check-circle', labelEn: 'Healthy', labelHt: 'An sante', color: 'var(--state-success, #10b981)' },
      { value: 'warning', icon: 'fa-exclamation-triangle', labelEn: 'Warning', labelHt: 'Avètisman', color: 'var(--state-warning, #f59e0b)' },
      { value: 'broken', icon: 'fa-times-circle', labelEn: 'Broken', labelHt: 'Kase', color: 'var(--state-error, #ef4444)' },
      { value: 'blocked', icon: 'fa-ban', labelEn: 'Blocked', labelHt: 'Bloke', color: 'var(--state-error-dark, #dc2626)' },
    ],
  },
  {
    id: 'time',
    icon: 'fa-clock',
    labelEn: 'Time',
    labelHt: 'Tan',
    options: [
      { value: 'all', icon: 'fa-list', labelEn: 'All Time', labelHt: 'Tout tan' },
      { value: 'recent', icon: 'fa-clock', labelEn: 'Recently Added', labelHt: 'Fèk ajoute' },
      { value: 'used', icon: 'fa-eye', labelEn: 'Recently Used', labelHt: 'Fèk itilize' },
    ],
  },
  {
    id: 'special',
    icon: 'fa-star',
    labelEn: 'Special',
    labelHt: 'Espesyal',
    options: [
      { value: 'all', icon: 'fa-list', labelEn: 'Show All', labelHt: 'Montre tout' },
      { value: 'favorites', icon: 'fa-star', labelEn: 'Favorites', labelHt: 'Favori', color: 'var(--state-warning, #f59e0b)' },
      { value: 'unused', icon: 'fa-inbox', labelEn: 'Unused', labelHt: 'Pa itilize' },
      { value: 'processing', icon: 'fa-spinner', labelEn: 'Processing', labelHt: 'Ap trete', color: 'var(--state-info, #38bdf8)' },
      { value: 'failed', icon: 'fa-times', labelEn: 'Failed', labelHt: 'Echwe', color: 'var(--state-error, #ef4444)' },
    ],
  },
];

function FilterChip({ option, isActive, onClick, lang }) {
  const isHt = lang === 'ht';
  return (
    <button
      type="button"
      className={`smart-filter-chip ${isActive ? 'smart-filter-chip-active' : ''}`}
      onClick={onClick}
      style={option.color && isActive ? { '--chip-color': option.color } : undefined}
      aria-pressed={isActive}
    >
      <i className={`fas ${option.icon}`} />
      {isHt ? option.labelHt : option.labelEn}
    </button>
  );
}

export default function SmartFilters({
  filters = {},
  onFilterChange,
  lang = 'ht',
  className = '',
}) {
  const isHt = lang === 'ht';
  const [expanded, setExpanded] = React.useState(false);

  const getActive = (groupId, value) => {
    const current = filters[groupId];
    return current === value || (!current && value === 'all');
  };

  const handleClick = (groupId, value) => {
    const newVal = getActive(groupId, value) && value === 'all' ? '' : value;
    onFilterChange?.({ ...filters, [groupId]: newVal === 'all' ? '' : newVal });
  };

  return (
    <div className={`smart-filters ${className}`}>
      <button
        type="button"
        className={`smart-filters-toggle ${expanded ? 'smart-filters-open' : ''}`}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <i className="fas fa-sliders-h" />
        {isHt ? 'Filtre' : 'Filters'}
        <i className={`fas fa-chevron-${expanded ? 'up' : 'down'}`} />
      </button>

      {expanded && (
        <div className="smart-filters-body">
          {FILTER_GROUPS.map((group) => (
            <div key={group.id} className="smart-filter-group">
              <span className="smart-filter-group-label">
                <i className={`fas ${group.icon}`} />
                {isHt ? group.labelHt : group.labelEn}
              </span>
              <div className="smart-filter-options">
                {group.options.map((opt) => (
                  <FilterChip
                    key={opt.value}
                    option={opt}
                    isActive={getActive(group.id, opt.value)}
                    onClick={() => handleClick(group.id, opt.value)}
                    lang={lang}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
