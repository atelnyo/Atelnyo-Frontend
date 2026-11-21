import React from 'react';
import styles from './HomePageSkeleton.module.css';

const CARDS = Array.from({ length: 8 }, (_, index) => index);

/**
 * Full-page skeleton for the initial Explore/home chunk.
 *
 * The old Suspense fallback was a 40vh spinner, so the (outside-boundary)
 * footer entered the viewport while the page itself had not mounted. This
 * skeleton mirrors the real Explore layout and reserves viewport height.
 */
export default function HomePageSkeleton({ lang = 'en' }) {
  const label = lang === 'ht'
    ? 'Chajman paj akèy la…'
    : lang === 'fr'
      ? 'Chargement de la page d’accueil…'
      : lang === 'es'
        ? 'Cargando la página de inicio…'
        : 'Loading the home page…';

  return (
    <section
      className={styles.root}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className={styles.srOnly}>{label}</span>
      <div className={styles.visual} aria-hidden="true">
        <div className={styles.hero}>
          <span className={`${styles.shimmer} ${styles.kicker}`} />
          <span className={`${styles.shimmer} ${styles.title}`} />
          <span className={`${styles.shimmer} ${styles.titleShort}`} />
          <span className={`${styles.shimmer} ${styles.desc}`} />
        </div>

        <div className={styles.searchRow}>
          <span className={`${styles.shimmer} ${styles.search}`} />
          <span className={`${styles.shimmer} ${styles.chip}`} />
          <span className={`${styles.shimmer} ${styles.chip}`} />
          <span className={`${styles.shimmer} ${styles.chip}`} />
        </div>

        <div className={styles.filters}>
          {Array.from({ length: 7 }, (_, index) => (
            <span key={index} className={`${styles.shimmer} ${styles.filter}`} />
          ))}
        </div>

        {[0, 1].map((section) => (
          <section key={section} className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={`${styles.shimmer} ${styles.sectionIcon}`} />
              <span className={`${styles.shimmer} ${styles.sectionTitle}`} />
            </div>
            <div className={styles.grid}>
              {CARDS.map((card) => (
                <article key={`${section}-${card}`} className={styles.card}>
                  <span className={`${styles.shimmer} ${styles.media}`} />
                  <span className={`${styles.shimmer} ${styles.cardLine}`} />
                  <span className={`${styles.shimmer} ${styles.cardLineShort}`} />
                  <span className={`${styles.shimmer} ${styles.cardLineMeta}`} />
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
