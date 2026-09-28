/**
 * src/components/studio/editor/CourseTypeModal.jsx
 *
 * Course creation ENTRY — the professional delivery-type chooser shown
 * BEFORE the editor opens. Course creation never starts with a form;
 * it starts with one question: where does learning happen?
 *
 *   [ Teach on Atelnyo ]      → online   (learning inside Atelnyo)
 *   [ Teach elsewhere ]        → external (Atelnyo = discovery layer)
 *
 * Purely presentational — ``onSelect(type)`` hands the choice to the
 * caller, which opens CourseEditor with the chosen delivery type.
 */
import React from 'react';
import styles from './editor.module.css';

export default function CourseTypeModal({ lang = 'ht', onClose, onSelect }) {
  const isHt = lang === 'ht';
  return (
    <div
      className={styles.typeModalBackdrop}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label={isHt ? 'Kreye yon Kou' : 'Create a Course'}
    >
      <div className={styles.typeModal}>
        <header className={styles.typeModalHeader}>
          <span className={styles.typeModalIcon}>
            <i className="fas fa-graduation-cap" aria-hidden="true" />
          </span>
          <div>
            <h2>{isHt ? 'Kreye yon Kou' : 'Create a Course'}</h2>
            <p>
              {isHt
                ? 'Ki kalite kou w ap kreye a?'
                : 'What type of course are you creating?'}
            </p>
          </div>
        </header>

        <div className={styles.typeOptions}>
          <button
            type="button"
            className={`${styles.typeOption} ${styles.typeOptionOnline}`}
            onClick={() => onSelect?.('online')}
          >
            <span className={styles.typeOptionIcon}>
              <i className="fas fa-laptop-code" aria-hidden="true" />
            </span>
            <span className={styles.typeOptionText}>
              <span className={styles.typeOptionTitle}>
                {isHt ? 'Anseye sou Atelnyo' : 'Teach on Atelnyo'}
              </span>
              <span className={styles.typeOptionDesc}>
                {isHt
                  ? 'Kou sou entènèt — elèv yo aprann dirèkteman nan atelnyo.'
                  : 'Online course — students learn directly through atelnyo.'}
              </span>
            </span>
          </button>

          <button
            type="button"
            className={`${styles.typeOption} ${styles.typeOptionExternal}`}
            onClick={() => onSelect?.('external')}
          >
            <span className={styles.typeOptionIcon}>
              <i className="fas fa-globe" aria-hidden="true" />
            </span>
            <span className={styles.typeOptionText}>
              <span className={styles.typeOptionTitle}>
                {isHt ? 'Anseye yon lòt kote' : 'Teach elsewhere'}
              </span>
              <span className={styles.typeOptionDesc}>
                {isHt
                  ? 'Kou ekstèn — sèvi Atelnyo pou òganize ak prezante kou a pandan aprantisaj la fèt sou yon lòt platfòm, kote, oswa enstitisyon.'
                  : 'External / non-online course — use Atelnyo to organize and present the course while learning happens through another platform, location, institution, or system.'}
              </span>
            </span>
          </button>
        </div>

        <button type="button" className={styles.typeModalBack} onClick={onClose}>
          <i className="fas fa-arrow-left" aria-hidden="true" />{' '}
          {isHt ? 'Retounen' : 'Back'}
        </button>
      </div>
    </div>
  );
}
