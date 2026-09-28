/**
 * src/components/studio/shared/StudioSkeleton.jsx
 *
 * Reusable loading skeleton — animated shimmer placeholder rows.
 * Used while data is being fetched across all studio sections.
 *
 * @param {number} rows — number of skeleton rows to display (default: 4)
 *
 * Extracted from CreatorStudio.jsx during Etap 1 refactor.
 */
import React from 'react';
import styles from './shared.module.css';

export default function StudioSkeleton({ rows = 4 }) {
  return (
    <div className={styles.skeletonList} role="status" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={styles.skeletonRow} aria-hidden="true" />
      ))}
    </div>
  );
}
