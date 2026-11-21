import React from 'react';
import styles from './CourseDetailSkeleton.module.css';

/**
 * CourseDetailSkeleton — shown while CourseDetailRoute fetches the course.
 *
 * It mirrors the real page (hero stage, creator card, content sections) so
 * the page does not collapse to a centered spinner or jump when data lands.
 */
export default function CourseDetailSkeleton({ lang = 'en' }) {
  const label = lang === 'ht'
    ? 'Ap chaje detay kou a…'
    : lang === 'fr'
      ? 'Chargement du cours…'
      : lang === 'es'
        ? 'Cargando el curso…'
        : 'Loading course…';

  return (
    <div
      className={`cd-page ${styles.page}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className={styles.srOnly}>{label}</span>

      <div className={styles.hero} aria-hidden="true">
        <div className={styles.heroGlow} />
        <div className={styles.heroContent}>
          <div className={styles.tags}>
            <span className={`${styles.shimmer} ${styles.tag}`} />
            <span className={`${styles.shimmer} ${styles.tag} ${styles.tagShort}`} />
          </div>
          <span className={`${styles.shimmer} ${styles.title}`} />
          <span className={`${styles.shimmer} ${styles.titleShort}`} />
          <span className={`${styles.shimmer} ${styles.description}`} />
          <div className={styles.meta}>
            <span className={`${styles.shimmer} ${styles.metaPill}`} />
            <span className={`${styles.shimmer} ${styles.metaPill}`} />
            <span className={`${styles.shimmer} ${styles.metaPill}`} />
          </div>
        </div>
      </div>

      <div className={`cd-body ${styles.body}`}>
        <div className="cd-body-inner">
          <div className={styles.creator} aria-hidden="true">
            <span className={`${styles.shimmer} ${styles.avatar}`} />
            <div className={styles.creatorText}>
              <span className={`${styles.shimmer} ${styles.creatorLabel}`} />
              <span className={`${styles.shimmer} ${styles.creatorName}`} />
            </div>
          </div>

          {[0, 1, 2].map((section) => (
            <section key={section} className={styles.section} aria-hidden="true">
              <div className={styles.sectionHead}>
                <span className={`${styles.shimmer} ${styles.sectionIcon}`} />
                <span className={`${styles.shimmer} ${styles.sectionTitle}`} />
              </div>
              <span className={`${styles.shimmer} ${styles.line}`} />
              <span className={`${styles.shimmer} ${styles.line}`} />
              <span className={`${styles.shimmer} ${styles.lineShort}`} />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
