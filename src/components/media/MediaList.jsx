/**
 * MediaList — Enterprise Media List view (Prompt 23).
 *
 * 10-column row layout per the Atelnyo spec:
 *   [☐] Thumbnail · Name · Provider · Visibility · Health · Module ·
 *       Owner · Reference Count · Date · Actions
 *
 * Why a separate component (vs reusing MediaGrid):
 *   • Grid emphasises visual scan; List emphasises data scan.
 *   • Many media libraries get to 100+ items where a table layout is
 *     significantly faster to act on.
 *   • Each row is independently selectable (used by MediaBulkToolbar).
 *
 * Selection model: parent owns `selectedIds` (Set or array of ids).
 *   • Pass `selectedIds` and `onSelectionChange` for full control.
 *   • If omitted, the row checkbox is rendered but read-only.
 *
 * Actions (per-row kebab menu): Preview · Open · Copy · Inspect ·
 * Replace · Archive · Delete Reference. The actions are passed in as
 * a single `onAction(key, item)` callback to keep prop count flat.
 */
import React, { useMemo } from 'react';
import MediaBadge from './MediaBadge';
import {
  MODULE_LABELS,
  VISIBILITY_LABELS,
  DEFAULT_VISIBILITY,
  moduleLabel,
  visibilityLabel,
} from '../../constants/media';
// ─── Module / visibility labels are sourced from the shared
// constants/media.js. Anything added to the backend's vocabulary
// should also land there first, then import here. ───

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

function fmtCount(n) {
  return n == null ? '—' : Number(n).toLocaleString();
}

export default function MediaList({
  items = [],
  loading = false,
  error = null,
  empty = null,
  selectedIds,
  onSelectionChange,
  onAction,         // (key, item) => void
  onClick,          // (item) => void  (row click)
  sortBy = 'date',
  sortDir = 'desc',
  onSortChange,     // (key) => void   single-key sort toggle
  lang = 'ht',
  className = '',
}) {
  const isHt = lang === 'ht';
  const selectionEnabled = Boolean(onSelectionChange);
  const selectedSet = useMemo(() => {
    if (!selectedIds) return new Set();
    return selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
  }, [selectedIds]);

  // ─── Sort ────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const arr = [...items];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let av;
      let bv;
      switch (sortBy) {
        case 'name':
          av = (a.title || a.name || '').toLowerCase();
          bv = (b.title || b.name || '').toLowerCase();
          return av.localeCompare(bv) * dir;
        case 'provider':
          av = (a.provider_name || a.provider || '').toLowerCase();
          bv = (b.provider_name || b.provider || '').toLowerCase();
          return av.localeCompare(bv) * dir;
        case 'visibility':
          av = a.visibility || '';
          bv = b.visibility || '';
          return av.localeCompare(bv) * dir;
        case 'health':
          av = a.health_status || a.status || '';
          bv = b.health_status || b.status || '';
          return av.localeCompare(bv) * dir;
        case 'references':
          av = a.reference_count ?? a.usage_count ?? 0;
          bv = b.reference_count ?? b.usage_count ?? 0;
          return (av - bv) * dir;
        case 'owner':
          av = (a.owner_username || a.owner || '').toLowerCase();
          bv = (b.owner_username || b.owner || '').toLowerCase();
          return av.localeCompare(bv) * dir;
        case 'module':
          av = a.module || '';
          bv = b.module || '';
          return av.localeCompare(bv) * dir;
        case 'date':
        default:
          av = new Date(a.updated_at || a.created_at || 0).getTime();
          bv = new Date(b.updated_at || b.created_at || 0).getTime();
          return (av - bv) * dir;
      }
    });
    return arr;
  }, [items, sortBy, sortDir]);

  // ─── Loading ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`media-list media-list--loading ${className}`} role="status" aria-busy="true">
        <div className="media-list-table">
          <div className="media-list-header" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="media-list-row media-list-row-skeleton">
              <span className="media-list-skel" style={{ width: '40%' }} />
              <span className="media-list-skel" style={{ width: '20%' }} />
              <span className="media-list-skel" style={{ width: '15%' }} />
              <span className="media-list-skel" style={{ width: '12%' }} />
              <span className="media-list-skel" style={{ width: '10%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Error ───────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={`media-list media-list--error ${className}`}>
        <div className="media-list-empty">
          <i className="fas fa-exclamation-triangle" aria-hidden="true" />
          <h3>{isHt ? 'Erè' : 'Error'}</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // ─── Empty ───────────────────────────────────────────────────────
  if (sorted.length === 0) {
    if (empty) return empty;
    return (
      <div className={`media-list media-list--empty ${className}`}>
        <div className="media-list-empty">
          <i className="fas fa-photo-video" aria-hidden="true" />
          <h3>{isHt ? 'Pa gen medya' : 'No media yet'}</h3>
          <p>
            {isHt
              ? 'Konekte yon provider epi ajoute URL medya ou yo pou wè yo nan liste sa a.'
              : 'Connect a media provider and add your media URLs to see them here.'}
          </p>
        </div>
      </div>
    );
  }

  const toggleRow = (item) => {
    if (!selectionEnabled) return;
    const id = item.id || item.media_id;
    if (id == null) return;
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange?.([...next]);
  };

  const toggleAll = () => {
    if (!selectionEnabled) return;
    const allSelected = sorted.every((it) => selectedSet.has(it.id || it.media_id));
    if (allSelected) {
      onSelectionChange?.([]);
    } else {
      onSelectionChange?.(sorted.map((it) => it.id || it.media_id).filter((x) => x != null));
    }
  };

  const allSelected = sorted.length > 0 && sorted.every((it) => selectedSet.has(it.id || it.media_id));

  // Columns: select · thumb · name · provider · visibility · health · module · owner · references · date · actions
  const headers = [
    { key: 'name',        icon: 'fa-font',         en: 'Name',          ht: 'Non' },
    { key: 'provider',    icon: 'fa-cloud',        en: 'Provider',      ht: 'Provider' },
    { key: 'visibility',  icon: 'fa-eye',          en: 'Visibility',    ht: 'Vizibilite' },
    { key: 'health',      icon: 'fa-heartbeat',    en: 'Health',        ht: 'Sante' },
    { key: 'module',      icon: 'fa-cubes',        en: 'Module',        ht: 'Modil' },
    { key: 'owner',       icon: 'fa-user',         en: 'Owner',         ht: 'Pwopriyetè' },
    { key: 'references',  icon: 'fa-link',         en: 'References',    ht: 'Referans' },
    { key: 'date',        icon: 'fa-calendar',     en: 'Date',          ht: 'Dat' },
  ];

  const sortKey = (key) => {
    onSortChange?.(key);
  };

  return (
    <div className={`media-list ${className}`}>
      <div className="media-list-table" role="table" aria-label={isHt ? 'Lis medya' : 'Media list'}>
        {/* ─── Header row ─────────────────────────────── */}
        <div className="media-list-row media-list-header-row" role="row">
          {selectionEnabled && (
            <div className="media-list-cell media-list-cell-select" role="columnheader">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label={isHt ? 'Chwazi tout' : 'Select all'}
              />
            </div>
          )}
          <div className="media-list-cell media-list-cell-thumb" role="columnheader" aria-hidden="true" />
          {headers.map((h) => {
            const isActive = sortBy === h.key;
            return (
              <div
                key={h.key}
                className={`media-list-cell media-list-cell-${h.key} media-list-col-sortable ${isActive ? 'media-list-col-active' : ''}`}
                role="columnheader"
                onClick={() => sortKey(h.key)}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sortKey(h.key); } }}
              >
                <i className={`fas ${h.icon}`} aria-hidden="true" />
                <span>{isHt ? h.ht : h.en}</span>
                {isActive && (
                  <i className={`fas fa-sort-${sortDir === 'asc' ? 'up' : 'down'} media-list-sort-indicator`} aria-hidden="true" />
                )}
              </div>
            );
          })}
          <div className="media-list-cell media-list-cell-actions" role="columnheader" aria-hidden="true" />
        </div>

        {/* ─── Body rows ─────────────────────────────── */}
        {sorted.map((item) => {
          const id = item.id || item.media_id;
          const isRowSelected = selectedSet.has(id);
          const mediaType = item.media_type || item.kind || '';
          const vis = VISIBILITY_LABELS[item.visibility || DEFAULT_VISIBILITY] || VISIBILITY_LABELS[DEFAULT_VISIBILITY];
          const mod = MODULE_LABELS[item.module] || MODULE_LABELS.other;
          return (
            <div
              key={id}
              className={`media-list-row ${isRowSelected ? 'media-list-row-selected' : ''}`}
              role="row"
              onClick={() => onClick?.(item)}
              data-media-type={mediaType}
            >
              {selectionEnabled && (
                <div className="media-list-cell media-list-cell-select" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isRowSelected}
                    onChange={() => toggleRow(item)}
                    aria-label={isHt ? 'Chwazi' : 'Select'}
                  />
                </div>
              )}

              {/* Thumbnail */}
              <div className="media-list-cell media-list-cell-thumb" aria-hidden="true">
                {mediaType === 'image' && item.thumbnail_url ? (
                  <img src={item.thumbnail_url} alt="" loading="lazy" className="media-list-thumb" />
                ) : (
                  <div className="media-list-thumb media-list-thumb-fallback">
                    <i className={`fas ${mediaType === 'video' ? 'fa-video' : mediaType === 'audio' ? 'fa-music' : mediaType === 'document' ? 'fa-file-alt' : 'fa-image'}`} aria-hidden="true" />
                  </div>
                )}
                {item.is_favorite && <i className="fas fa-star media-list-fav" aria-hidden="true" />}
              </div>

              <div className="media-list-cell media-list-cell-name" role="cell">
                {item.title || item.name || item.url || (isHt ? 'San tit' : 'Untitled')}
              </div>

              <div className="media-list-cell media-list-cell-provider" role="cell">
                <i className="fas fa-cloud" aria-hidden="true" />
                {item.provider_name || item.provider || '—'}
              </div>

              <div className="media-list-cell media-list-cell-visibility" role="cell">
                <span className="media-list-vis-chip" style={{ color: vis.color, background: vis.bg }}>
                  <i className={`fas ${vis.icon}`} aria-hidden="true" />
                  {isHt ? vis.ht : vis.en}
                </span>
              </div>

              <div className="media-list-cell media-list-cell-health" role="cell">
                <MediaBadge status={item.health_status || item.status || 'unknown'} lang={lang} />
              </div>

              <div className="media-list-cell media-list-cell-module" role="cell">
                {isHt ? mod.ht : mod.en}
              </div>

              <div className="media-list-cell media-list-cell-owner" role="cell">
                {item.owner_username || item.owner || '—'}
              </div>

              <div className="media-list-cell media-list-cell-references" role="cell">
                {fmtCount(item.reference_count ?? item.usage_count)}
              </div>

              <div className="media-list-cell media-list-cell-date" role="cell">
                {fmtDate(item.updated_at || item.created_at)}
              </div>

              <div className="media-list-cell media-list-cell-actions" role="cell" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="media-list-row-action"
                  onClick={() => onAction?.('preview', item)}
                  title={isHt ? 'Aperçu' : 'Preview'}
                  aria-label={isHt ? 'Aperçu' : 'Preview'}
                >
                  <i className="fas fa-eye" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="media-list-row-action"
                  onClick={() => onAction?.('inspect', item)}
                  title={isHt ? 'Enspekte' : 'Inspect'}
                  aria-label={isHt ? 'Enspekte' : 'Inspect'}
                >
                  <i className="fas fa-search-plus" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="media-list-row-action media-list-row-action-more"
                  onClick={() => onAction?.('menu', item)}
                  title={isHt ? 'Plis' : 'More'}
                  aria-label={isHt ? 'Plis' : 'More'}
                  aria-haspopup="true"
                >
                  <i className="fas fa-ellipsis-v" aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
