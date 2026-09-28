/**
 * MediaSkeleton — Plas-holdè pandan chajman.
 *
 * Variant:
 *   - card: Kat lajè fiks ak animasyon shimmer
 *   - row: Ranje pou lis
 *   - thumbnail: Ti thumbnail sèlman
 *   - detail: Gwo skeleton pou paj detay
 */
import React from 'react';

export default function MediaSkeleton({ variant = 'card', count = 1, className = '' }) {
  if (count > 1) {
    return (
      <div className="media-skeleton-group" role="status" aria-busy="true">
        {Array.from({ length: count }).map((_, i) => (
          <MediaSkeleton key={i} variant={variant} />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`media-skeleton media-skeleton--${variant} ${className}`}
      aria-hidden="true"
    >
      {variant === 'card' && (
        <div className="media-skeleton-card">
          <div className="media-skeleton-thumb" />
          <div className="media-skeleton-body">
            <div className="media-skeleton-line" style={{ width: '70%' }} />
            <div className="media-skeleton-line" style={{ width: '40%' }} />
            <div className="media-skeleton-line" style={{ width: '50%' }} />
          </div>
        </div>
      )}
      {variant === 'row' && (
        <div className="media-skeleton-row">
          <div className="media-skeleton-thumb media-skeleton-thumb-row" />
          <div className="media-skeleton-body">
            <div className="media-skeleton-line" style={{ width: '60%' }} />
            <div className="media-skeleton-line" style={{ width: '30%' }} />
          </div>
        </div>
      )}
      {variant === 'thumbnail' && (
        <div className="media-skeleton-thumbnail">
          <div className="media-skeleton-thumb" style={{ width: '100%', paddingBottom: '75%' }} />
        </div>
      )}
      {variant === 'detail' && (
        <div className="media-skeleton-detail">
          <div className="media-skeleton-thumb" style={{ width: '100%', aspectRatio: '16/9' }} />
          <div className="media-skeleton-body" style={{ padding: '16px 0' }}>
            <div className="media-skeleton-line" style={{ width: '80%', height: '20px' }} />
            <div className="media-skeleton-line" style={{ width: '50%', height: '14px' }} />
            <div className="media-skeleton-line" style={{ width: '100%', height: '14px' }} />
            <div className="media-skeleton-line" style={{ width: '90%', height: '14px' }} />
            <div className="media-skeleton-line" style={{ width: '60%', height: '14px' }} />
          </div>
        </div>
      )}
    </div>
  );
}
