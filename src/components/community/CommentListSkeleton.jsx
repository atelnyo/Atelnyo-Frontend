import React from 'react';
import styles from './CommentListSkeleton.module.css';

/**
 * CommentListSkeleton — one accessible loading state for comment threads.
 * Decorative rows are hidden from assistive tech; the wrapper announces the
 * localized loading message once.
 */
export default function CommentListSkeleton({ lang = 'en', rows = 3 }) {
  const label = lang === 'ht'
    ? 'Ap chaje kòmantè yo…'
    : lang === 'fr'
      ? 'Chargement des commentaires…'
      : lang === 'es'
        ? 'Cargando comentarios…'
        : 'Loading comments…';

  return (
    <div
      className={styles.root}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={styles.row} aria-hidden="true">
          <span className={`${styles.shimmer} ${styles.avatar}`} />
          <span className={styles.body}>
            <span className={`${styles.shimmer} ${styles.name}`} />
            <span className={`${styles.shimmer} ${styles.line}`} />
            <span className={`${styles.shimmer} ${styles.lineShort}`} />
          </span>
        </div>
      ))}
    </div>
  );
}
