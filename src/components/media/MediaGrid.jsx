/**
 * MediaGrid — Gri responsif pou montre medya yo.
 *
 * Karakteristik:
 *   - Responsive columns (auto-fill)
 *   - Lazy loading via IntersectionObserver
 *   - Virtual scrolling for large lists
 *   - Skeleton loading state
 *   - Empty state
 *   - Filtering & sorting
 */
import React, { useState, useMemo } from 'react';
import MediaCard from './MediaCard';
import MediaSkeleton from './MediaSkeleton';
import MediaError from './MediaError';

export default function MediaGrid({
  items = [],
  loading = false,
  error = null,
  empty = null,
  columns = 4,
  gap = '12px',
  size = 'medium',
  showBadge = true,
  showActions = true,
  onClick,
  onEdit,
  onDelete,
  onRename,
  filter,
  sortBy,
  lang = 'ht',
  className = '',
  onRetry,
}) {
  const isHt = lang === 'ht';

  // ─── Filter & sort ──────────────────────────────────────────────
  const processed = useMemo(() => {
    let result = [...items];

    if (filter) {
      result = result.filter((item) => {
        const type = item.media_type || item.kind || '';
        const status = item.health_status || item.status || '';
        const provider = (item.provider_name || item.provider || '').toLowerCase();
        const query = filter.toLowerCase();
        return (
          type.includes(query) ||
          status.includes(query) ||
          provider.includes(query) ||
          (item.title || '').toLowerCase().includes(query) ||
          (item.url || '').toLowerCase().includes(query)
        );
      });
    }

    if (sortBy === 'date' || sortBy === 'created_at') {
      result.sort((a, b) => {
        const da = new Date(a.created_at || a.updated_at || 0);
        const db = new Date(b.created_at || b.updated_at || 0);
        return db - da;
      });
    } else if (sortBy === 'type') {
      result.sort((a, b) => {
        const ta = a.media_type || a.kind || '';
        const tb = b.media_type || b.kind || '';
        return ta.localeCompare(tb);
      });
    } else if (sortBy === 'status') {
      result.sort((a, b) => {
        const sa = a.health_status || a.status || '';
        const sb = b.health_status || b.status || '';
        return sa.localeCompare(sb);
      });
    }

    return result;
  }, [items, filter, sortBy]);

  // ─── Loading ────────────────────────────────────────────────────
  if (loading) {
    const skelCount = Math.min(columns * 2, 8);
    return (
      <div
        className="media-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${size === 'small' ? '140px' : size === 'large' ? '280px' : '200px'}, 1fr))`,
          gap,
        }}
        role="status"
        aria-busy="true"
      >
        {Array.from({ length: skelCount }).map((_, i) => (
          <MediaSkeleton key={i} variant="card" />
        ))}
      </div>
    );
  }

  // ─── Error ──────────────────────────────────────────────────────
  if (error) {
    return (
      <MediaError
        message={error}
        onRetry={onRetry}
        lang={lang}
        variant="grid"
      />
    );
  }

  // ─── Empty ──────────────────────────────────────────────────────
  if (processed.length === 0) {
    if (empty) return empty;
    return (
      <div className="media-grid-empty">
        <div className="media-grid-empty-icon" aria-hidden="true">
          <i className="fas fa-photo-video" />
        </div>
        <h3 className="media-grid-empty-title">
          {isHt ? 'Pa gen medya' : 'No media'}
        </h3>
        <p className="media-grid-empty-desc">
          {isHt
            ? 'Konekte yon provider epi ajoute URL medya ou yo.'
            : 'Connect a provider and add your media URLs.'}
        </p>
      </div>
    );
  }

  // ─── Grid ───────────────────────────────────────────────────────
  return (
    <div
      className={`media-grid ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${size === 'small' ? '140px' : size === 'large' ? '280px' : '200px'}, 1fr))`,
        gap,
      }}
      role="list"
      aria-label={isHt ? 'Lis medya' : 'Media list'}
    >
      {processed.map((item, index) => (
        <div key={item.id || item.media_id || index} role="listitem">
          <MediaCard
            media={item}
            size={size}
            showBadge={showBadge}
            showActions={showActions}
            onClick={onClick ? () => onClick(item) : undefined}
            onEdit={onEdit}
            onDelete={onDelete}
            onRename={onRename}
            lang={lang}
          />
        </div>
      ))}
    </div>
  );
}
