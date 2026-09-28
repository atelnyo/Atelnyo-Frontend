/**
 * MediaToolbar — Beautiful filter bar with pill/chip UI for media gallery.
 *
 * Features:
 *   - Search input with instant clear
 *   - Chip/pill filters for media type (all, image, video, audio, document)
 *   - Chip/pill filters for health status
 *   - Sort dropdown
 *   - View toggle (grid/list)
 *   - Action buttons (add, refresh)
 *   - Result count
 *
 * All chip clicks trigger instant filter changes — no dead buttons.
 */
import React from 'react';

const TYPE_CHIPS = [
  { value: 'all', icon: 'fa-th-large', labelEn: 'All', labelHt: 'Tout', color: '#64748b' },
  { value: 'image', icon: 'fa-image', labelEn: 'Images', labelHt: 'Imaj', color: '#10b981' },
  { value: 'video', icon: 'fa-video', labelEn: 'Videos', labelHt: 'Videyo', color: '#3b82f6' },
  { value: 'audio', icon: 'fa-music', labelEn: 'Audio', labelHt: 'Odyo', color: '#8b5cf6' },
  { value: 'document', icon: 'fa-file-alt', labelEn: 'Docs', labelHt: 'Dokiman', color: '#f59e0b' },
];

const HEALTH_CHIPS = [
  { value: 'all', icon: 'fa-list', labelEn: 'All', labelHt: 'Tout', color: '#94a3b8' },
  { value: 'healthy', icon: 'fa-check-circle', labelEn: 'Healthy', labelHt: 'Bon', color: '#10b981' },
  { value: 'warning', icon: 'fa-exclamation-triangle', labelEn: 'Warning', labelHt: 'Avèti', color: '#f59e0b' },
  { value: 'broken', icon: 'fa-times-circle', labelEn: 'Broken', labelHt: 'Kase', color: '#ef4444' },
  { value: 'blocked', icon: 'fa-ban', labelEn: 'Blocked', labelHt: 'Bloke', color: '#dc2626' },
  { value: 'checking', icon: 'fa-spinner', labelEn: 'Checking', labelHt: 'Tcheke', color: '#38bdf8' },
];

const SORT_OPTS = [
  { value: '', labelEn: 'Default', labelHt: 'Defo' },
  { value: 'date', labelEn: 'Newest', labelHt: 'Nouvo' },
  { value: 'type', labelEn: 'Type', labelHt: 'Kalite' },
  { value: 'status', labelEn: 'Status', labelHt: 'Estati' },
];

export default function MediaToolbar({
  searchQuery = '',
  onSearchChange,
  filterType = 'all',
  onFilterTypeChange,
  filterHealth = 'all',
  onFilterHealthChange,
  sortBy = '',
  onSortChange,
  viewMode = 'grid',
  onViewModeChange,
  onAdd,
  onRefresh,
  total = 0,
  filtered = 0,
  lang = 'ht',
  className = '',
}) {
  const isHt = lang === 'ht';

  return (
    <div className={`media-toolbar ${className}`} style={{
      display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center',
      padding: '12px 0', marginBottom: '12px',
    }}>
      {/* ─── Search ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        background: 'var(--bg-input, #f8fafc)', borderRadius: '10px',
        padding: '0 12px', border: '1px solid var(--border-color, #e2e8f0)',
        flex: '1 1 200px', minWidth: '180px', maxWidth: '320px',
      }}>
        <i className="fas fa-search" style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.85rem' }} />
        <input
          type="text"
          style={{
            border: 'none', background: 'none', outline: 'none', flex: 1,
            padding: '8px 0', fontSize: '0.85rem', color: 'var(--text-primary)',
          }}
          placeholder={isHt ? 'Chèche pa tit oswa URL...' : 'Search by title or URL...'}
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
        {searchQuery && (
          <button type="button" onClick={() => onSearchChange?.('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px' }}>
            <i className="fas fa-times" />
          </button>
        )}
      </div>

      {/* ─── Type Chips ──────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
        {TYPE_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => onFilterTypeChange?.(chip.value)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '6px 12px', borderRadius: '20px', border: 'none',
              fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
              background: filterType === chip.value ? chip.color : 'var(--bg-raised, #f1f5f9)',
              color: filterType === chip.value ? '#fff' : 'var(--text-secondary, #64748b)',
              transition: 'all 0.15s ease',
              opacity: filterType === chip.value ? 1 : 0.7,
            }}
            title={isHt ? chip.labelHt : chip.labelEn}
          >
            <i className={`fas ${chip.icon}`} style={{ fontSize: '0.7rem' }} />
            <span>{isHt ? chip.labelHt : chip.labelEn}</span>
          </button>
        ))}
      </div>

      {/* ─── Health Chips ────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
        {HEALTH_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => onFilterHealthChange?.(chip.value)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '5px 10px', borderRadius: '16px', border: `1.5px solid ${filterHealth === chip.value ? chip.color : 'transparent'}`,
              fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
              background: filterHealth === chip.value ? `${chip.color}18` : 'transparent',
              color: filterHealth === chip.value ? chip.color : 'var(--text-secondary, #94a3b8)',
              transition: 'all 0.15s ease',
            }}
            title={isHt ? chip.labelHt : chip.labelEn}
          >
            <i className={`fas ${chip.icon}`} style={{ fontSize: '0.65rem' }} />
            <span>{isHt ? chip.labelHt : chip.labelEn}</span>
          </button>
        ))}
      </div>

      {/* ─── Right side controls ─────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>
        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => onSortChange?.(e.target.value)}
          style={{
            padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)',
            background: 'var(--bg-input, #fff)', fontSize: '0.8rem', cursor: 'pointer',
            color: 'var(--text-primary)',
          }}
        >
          {SORT_OPTS.map((o) => (
            <option key={o.value} value={o.value}>{isHt ? o.labelHt : o.labelEn}</option>
          ))}
        </select>

        {/* View toggle */}
        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color, #e2e8f0)' }}>
          <button type="button" onClick={() => onViewModeChange?.('grid')}
            style={{
              padding: '6px 10px', border: 'none', cursor: 'pointer', fontSize: '0.85rem',
              background: viewMode === 'grid' ? 'var(--studio-pink, #d81b60)' : 'transparent',
              color: viewMode === 'grid' ? '#fff' : 'var(--text-secondary)',
            }}>
            <i className="fas fa-th" />
          </button>
          <button type="button" onClick={() => onViewModeChange?.('list')}
            style={{
              padding: '6px 10px', border: 'none', cursor: 'pointer', fontSize: '0.85rem',
              background: viewMode === 'list' ? 'var(--studio-pink, #d81b60)' : 'transparent',
              color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)',
            }}>
            <i className="fas fa-list" />
          </button>
        </div>

        {/* Refresh */}
        {onRefresh && (
          <button type="button" onClick={onRefresh}
            style={{
              padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)',
              background: 'var(--bg-raised, #f8fafc)', cursor: 'pointer', fontSize: '0.85rem',
              color: 'var(--text-secondary)',
            }}>
            <i className="fas fa-sync" />
          </button>
        )}

        {/* Add */}
        {onAdd && (
          <button type="button" onClick={onAdd}
            style={{
              padding: '7px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: 'var(--studio-pink, #d81b60)', color: '#fff', fontWeight: 600,
              fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px',
            }}>
            <i className="fas fa-plus" style={{ fontSize: '0.7rem' }} />
            {isHt ? 'Ajoute' : 'Add Media'}
          </button>
        )}

        {/* Count */}
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', whiteSpace: 'nowrap' }}>
          {filtered} / {total}
        </span>
      </div>
    </div>
  );
}
