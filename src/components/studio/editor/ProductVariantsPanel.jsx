/**
 * src/components/studio/editor/ProductVariantsPanel.jsx
 *
 * Variant management for the Product Editor — backed by the real
 * ProductVariant model (create/update/delete through the API). The
 * seller adds options like "Black / M" with an optional own price and
 * stock; checkout uses the variant's price/stock when one is selected.
 */
import React, { useState } from 'react';
import styles from './editor.module.css';

export default function ProductVariantsPanel({ lang = 'ht', variants = [], canEdit, onAdd, onUpdate, onRemove }) {
  const isHt = lang === 'ht';
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', price: '', stock: '', sku: '' });
  const [error, setError] = useState('');

  const t = (en, ht) => (isHt ? ht : en);

  const submitAdd = () => {
    if (!draft.name.trim()) {
      setError(isHt ? 'Non variant la oblije.' : 'Variant name is required.');
      return;
    }
    onAdd({
      name: draft.name.trim(),
      sku: draft.sku.trim(),
      price: draft.price !== '' ? Number(draft.price) : null,
      stock: draft.stock !== '' ? Number(draft.stock) : null,
    });
    setDraft({ name: '', price: '', stock: '', sku: '' });
    setAdding(false);
    setError('');
  };

  return (
    <div className={styles.variantsPanel}>
      {!canEdit ? (
        <p className={styles.propsHint}>
          {t(
            'Save the product first, then add variants (size, color, edition…).',
            'Sove pwodwi a anvan, Lè sa a ajoute variants (gwosè, koulè, edisyon…).',
          )}
        </p>
      ) : (
        <>
          {variants.map((v) => (
            <div key={v.id} className={styles.variantRow}>
              <div className={styles.variantRowInfo}>
                <span className={styles.variantRowName}>{v.name}</span>
                <span className={styles.variantRowMeta}>
                  {v.price != null ? `$${Number(v.price).toFixed(2)}` : t('pri pwodwi', 'product price')}
                  {' · '}
                  {v.stock != null ? `${v.stock} ${isHt ? 'an stock' : 'in stock'}` : t('illimite', 'unlimited')}
                  {v.sku ? ` · SKU ${v.sku}` : ''}
                </span>
              </div>
              <div className={styles.variantRowActions}>
                <button
                  type="button"
                  className={styles.variantRowCtrl}
                  onClick={() => onRemove(v.id)}
                  aria-label={t('Delete variant', 'Efase variant')}
                  title={t('Delete', 'Efase')}
                >
                  <i className="fas fa-trash" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}

          {adding ? (
            <div className={styles.variantDraft}>
              <div className={styles.variantDraftGrid}>
                <label className={styles.variantDraftField}>
                  <span>{t('Name', 'Non')} *</span>
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder={isHt ? 'Nwa / M' : 'Black / M'}
                    maxLength={200}
                  />
                </label>
                <label className={styles.variantDraftField}>
                  <span>{t('SKU', 'SKU')}</span>
                  <input
                    value={draft.sku}
                    onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
                    placeholder="SKU-001"
                    maxLength={100}
                  />
                </label>
                <label className={styles.variantDraftField}>
                  <span>{t('Price ($) — vid = pri pwodwi', 'Pri ($) — vid = product price')}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.price}
                    onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                    placeholder="0.00"
                  />
                </label>
                <label className={styles.variantDraftField}>
                  <span>{t('Stock — vid = illimite', 'Stock — empty = unlimited')}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={draft.stock}
                    onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
                    placeholder={isHt ? 'Illimite' : 'Unlimited'}
                  />
                </label>
              </div>
              {error && <span className={styles.propsError} role="alert">{error}</span>}
              <div className={styles.variantDraftActions}>
                <button type="button" className={styles.variantDraftCancel} onClick={() => { setAdding(false); setError(''); }}>
                  {t('Cancel', 'Anile')}
                </button>
                <button type="button" className={styles.variantDraftSave} onClick={submitAdd}>
                  <i className="fas fa-check" aria-hidden="true" /> {t('Add variant', 'Ajoute variant')}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className={styles.variantAdd} onClick={() => setAdding(true)}>
              <i className="fas fa-plus" aria-hidden="true" /> {t('Add variant', 'Ajoute variant')}
            </button>
          )}
        </>
      )}
    </div>
  );
}
