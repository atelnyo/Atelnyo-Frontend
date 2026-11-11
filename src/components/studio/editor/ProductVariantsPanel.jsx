/**
 * src/components/studio/editor/ProductVariantsPanel.jsx
 *
 * Variant management for the Product Editor — backed by the real
 * ProductVariant model (create/update/delete through the API). The
 * seller adds options like "Black / M" with an optional own price and
 * stock; checkout uses the variant's price/stock when one is selected.
 *
 * Bulk delete: checkboxes on each row + a "delete selected" bar that
 * removes everything in ONE backend request (bulk-delete endpoint),
 * so cleaning up imported Printify variants is fast and never hits
 * the per-request throttle.
 *
 * Printify stock: POD has no numeric count — ``is_printify`` variants
 * show "Available (Printify)" when the provider reports them available
 * (stock null = unbounded) and "Unavailable on Printify" when the
 * provider reports them unavailable (stock 0).
 */
import React, { useEffect, useState } from 'react';
import ConfirmModal from '../../common/ConfirmModal';
import styles from './editor.module.css';

export default function ProductVariantsPanel({ lang = 'en', variants = [], canEdit, onAdd, onUpdate, onRemove, onRemoveMany }) {
  const isHt = lang === 'ht';
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', price: '', stock: '', sku: '' });
  const [error, setError] = useState('');
  const [selected, setSelected] = useState([]);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const t = (en, ht) => (isHt ? ht : en);

  // Drop ids that are gone (after a delete + reload) so the count
  // never references stale rows.
  const liveIds = new Set(variants.map((v) => v.id));
  useEffect(() => {
    setSelected((prev) => prev.filter((id) => liveIds.has(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variants]);

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    setSelected((prev) => (prev.length === variants.length ? [] : variants.map((v) => v.id)));
  };

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

  const stockLabel = (v) => {
    if (v.is_printify) {
      if (v.stock == null) return t('Available (Printify)', 'Disponib (Printify)');
      return t('Unavailable on Printify', 'Pa disponib sou Printify');
    }
    if (v.stock != null) return `${v.stock} ${isHt ? 'an stock' : 'in stock'}`;
    return t('unlimited', 'illimite');
  };

  const submitBulkDelete = async () => {
    if (selected.length === 0 || !onRemoveMany) return;
    setBulkBusy(true);
    try {
      await onRemoveMany(selected);
      setSelected([]);
      setConfirmBulk(false);
    } finally {
      setBulkBusy(false);
    }
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
          {variants.length > 1 && onRemoveMany && (
            <div className={styles.variantBulkBar}>
              <label className={styles.variantSelectAll}>
                <input
                  type="checkbox"
                  className={styles.variantCheck}
                  checked={selected.length === variants.length}
                  onChange={toggleSelectAll}
                  aria-label={t('Select all variants', 'Chwazi tout variants yo')}
                />
                {t('All', 'Tout')}
              </label>
              <span className={styles.variantBulkCount}>
                {selected.length === 0
                  ? t('Select variants to delete several at once.', 'Chwazi variants pou efase plizyè ansanm.')
                  : t(`${selected.length} selected`, `${selected.length} chwazi`)}
              </span>
              <button
                type="button"
                className={styles.variantBulkDelete}
                disabled={selected.length === 0}
                onClick={() => setConfirmBulk(true)}
              >
                <i className="fas fa-trash" aria-hidden="true" />
                {t('Delete selected', 'Efase seleksyon yo')}
              </button>
            </div>
          )}

          {variants.map((v) => (
            <div key={v.id} className={styles.variantRow}>
              {variants.length > 1 && onRemoveMany && (
                <input
                  type="checkbox"
                  className={styles.variantCheck}
                  checked={selected.includes(v.id)}
                  onChange={() => toggleSelect(v.id)}
                  aria-label={t(`Select variant ${v.name}`, `Chwazi variant ${v.name}`)}
                />
              )}
              <div className={styles.variantRowInfo}>
                <span className={styles.variantRowName}>{v.name}</span>
                <span className={styles.variantRowMeta}>
                  {v.price != null ? `$${Number(v.price).toFixed(2)}` : t('pri pwodwi', 'product price')}
                  {' · '}
                  {stockLabel(v)}
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

          {confirmBulk && (
            <ConfirmModal
              lang={lang}
              variant="danger"
              title={t('Delete selected variants?', 'Efase variants chwazi yo?')}
              message={t(
                `${selected.length} variant(s) will be permanently deleted. This cannot be undone.`,
                `${selected.length} variant(s) pral efase pou tout tan. Sa pa ka defèt.`,
              )}
              loading={bulkBusy}
              onConfirm={submitBulkDelete}
              onCancel={() => { if (!bulkBusy) setConfirmBulk(false); }}
            />
          )}
        </>
      )}
    </div>
  );
}
