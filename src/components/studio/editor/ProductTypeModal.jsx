/**
 * src/components/studio/editor/ProductTypeModal.jsx
 *
 * Product creation ENTRY — the professional "what are you selling?"
 * chooser shown BEFORE the editor opens. Product creation never starts
 * with a form; it starts with one question: what kind of product is it?
 *
 *   [ Digital product ]  → downloadable file / resource / access
 *   [ Physical product ] → shipped item (inventory + shipping)
 *   [ Service ]          → a service offering (booking / instructions)
 *
 * Purely presentational — ``onSelect(kind)`` hands the choice to the
 * caller, which opens ProductEditor with the chosen ``kind``.
 *
 * Only kinds the backend actually supports (Product.KIND_CHOICES and
 * the existing checkout/fulfillment paths) are offered: digital,
 * physical, service. No fake product types.
 */
import React from 'react';
import styles from './editor.module.css';

const KINDS = [
  {
    id: 'digital',
    icon: 'fa-file-arrow-down',
    title: { en: 'Digital product', ht: 'Pwodwi dijital' },
    desc: {
      en: 'A downloadable file, resource, or access — delivered instantly after purchase.',
      ht: 'Yon fichye, resous, oswa aksè ki telechaje — livre imedyatman apre acha.',
    },
  },
  {
    id: 'physical',
    icon: 'fa-box-open',
    title: { en: 'Physical product', ht: 'Pwodwi fizik' },
    desc: {
      en: 'A tangible item that ships — with inventory and delivery tracking.',
      ht: 'Yon atik fizik ki voye — ak stock ak swivi livrezon.',
    },
  },
  {
    id: 'service',
    icon: 'fa-hand-sparkles',
    title: { en: 'Service', ht: 'Sèvis' },
    desc: {
      en: 'A service offering — consulting, coaching, custom work, bookings.',
      ht: 'Yon ofr sèvis — konsiltasyon, kowach, travay sou komann, rezèvasyon.',
    },
  },
];

export default function ProductTypeModal({ lang = 'ht', onClose, onSelect }) {
  const isHt = lang === 'ht';
  return (
    <div
      className={styles.typeModalBackdrop}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label={isHt ? 'Kreye yon Pwodwi' : 'Create a Product'}
    >
      <div className={styles.typeModal}>
        <header className={styles.typeModalHeader}>
          <span className={styles.typeModalIcon}>
            <i className="fas fa-cube" aria-hidden="true" />
          </span>
          <div>
            <h2>{isHt ? 'Kreye yon Pwodwi' : 'Create a Product'}</h2>
            <p>
              {isHt
                ? 'Kisa w ap vann lan?'
                : 'What are you selling?'}
            </p>
          </div>
        </header>

        <div className={styles.typeOptions}>
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className={styles.typeOption}
              onClick={() => onSelect?.(k.id)}
            >
              <span className={`${styles.typeOptionIcon} ${styles[`typeOption${k.id.charAt(0).toUpperCase()}${k.id.slice(1)}`]}`}>
                <i className={`fas ${k.icon}`} aria-hidden="true" />
              </span>
              <span className={styles.typeOptionText}>
                <span className={styles.typeOptionTitle}>
                  {isHt ? k.title.ht : k.title.en}
                </span>
                <span className={styles.typeOptionDesc}>
                  {isHt ? k.desc.ht : k.desc.en}
                </span>
              </span>
            </button>
          ))}
        </div>

        <button type="button" className={styles.typeModalBack} onClick={onClose}>
          <i className="fas fa-arrow-left" aria-hidden="true" />{' '}
          {isHt ? 'Retounen' : 'Back'}
        </button>
      </div>
    </div>
  );
}
