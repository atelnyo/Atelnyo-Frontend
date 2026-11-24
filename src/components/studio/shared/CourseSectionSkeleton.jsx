/**
 * src/components/studio/shared/CourseSectionSkeleton.jsx
 *
 * Loading placeholder that mirrors a real course row — thumbnail, title,
 * status/price meta line, and the row action buttons — instead of the
 * generic shimmer bars. Matching the final layout means the list does not
 * jump when the courses land, which is the whole point of a skeleton.
 *
 * @param {number} rows — number of placeholder rows (default: 3)
 */
import React from 'react';
import styles from './shared.module.css';

export default function CourseSectionSkeleton({ rows = 3 }) {
  return (
    <div className={styles.courseSkeletonList} role="status" aria-busy="true">
      <span className={styles.srOnly}>Loading courses…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={styles.courseSkeletonRow} aria-hidden="true">
          <span className={styles.courseSkeletonThumb} />
          <span className={styles.courseSkeletonBody}>
            <span className={`${styles.courseSkeletonLine} ${styles.courseSkeletonTitle}`} />
            <span className={`${styles.courseSkeletonLine} ${styles.courseSkeletonMeta}`} />
          </span>
          <span className={styles.courseSkeletonActions}>
            <span className={styles.courseSkeletonAction} />
            <span className={styles.courseSkeletonAction} />
            <span className={styles.courseSkeletonAction} />
          </span>
        </div>
      ))}
    </div>
  );
}
