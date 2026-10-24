/**
 * src/components/studio/editor/PrintifyImportPanel.jsx
 *
 * Pull-only Printify import. Each seller connects their OWN Printify
 * token; selected Printify products are imported as draft physical
 * products (with image, gallery, and stock). The seller publishes them
 * afterwards from the editor.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { marketplaceService } from '../../../services/api';
import styles from './editor.module.css';

const tr = (isHt, en, ht) => (isHt ? ht : en);

const IMPORT_FIELD_OPTIONS = [
  { key: 'description', en: 'Description', ht: 'Deskripsyon' },
  { key: 'images', en: 'Images & gallery', ht: 'Imaj ak galri' },
  { key: 'stock', en: 'Stock', ht: 'Stock' },
  { key: 'tags', en: 'Tags', ht: 'Tags' },
  { key: 'shipping', en: 'Shipping info', ht: 'Enfòmasyon livrezon' },
];
const ALL_IMPORT_FIELDS = IMPORT_FIELD_OPTIONS.map((o) => o.key);

export default function PrintifyImportPanel({ isHt, showToast, onImported }) {
  const [conn, setConn] = useState(null);
  const [connError, setConnError] = useState('');
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState(null);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const [fields, setFields] = useState(ALL_IMPORT_FIELDS);
  const [imported, setImported] = useState([]);

  const t = (en, ht) => tr(isHt, en, ht);

  const fetchConnection = useCallback(() => marketplaceService.printifyConnection()
    .then((res) => ({ ok: true, data: res.data }))
    .catch((err) => ({
      ok: false,
      message: err?.response?.data?.detail
        || tr(isHt, 'Could not check your Printify connection.', 'Pa t kapab verifye koneksyon Printify ou an.'),
    })), [isHt]);

  const applyResult = (result) => {
    if (result.ok) {
      setConnError('');
      setConn(result.data);
    } else {
      setConnError(result.message);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchConnection().then((result) => { if (!cancelled) applyResult(result); });
    return () => { cancelled = true; };
  }, [fetchConnection]);

  const retry = () => { fetchConnection().then(applyResult); };

  const fail = (err, fallback) => {
    const msg = err?.response?.data?.detail || fallback;
    setError(msg);
    showToast?.(msg, 'circle-exclamation');
  };

  const handleLoadProducts = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await marketplaceService.printifyProducts();
      setItems(res.data?.results || []);
      setSelected([]);
    } catch (err) {
      fail(err, t('Could not load Printify products.', 'Pa t kapab chaje pwodwi Printify yo.'));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleImport = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    setError('');
    try {
      const res = await marketplaceService.printifyImport(selected, fields);
      const list = res.data?.imported || [];
      showToast?.(
        t(`${list.length} product(s) imported as drafts.`, `${list.length} pwodwi enpòte kòm bouyon.`),
        'check-circle',
      );
      setImported(list);
      onImported?.(list);
      await handleLoadProducts();
    } catch (err) {
      fail(err, t('Import failed.', 'Enpòtasyon an echwe.'));
    } finally {
      setBusy(false);
    }
  };

  if (connError) {
    return (
      <div>
        <p role="alert">{connError}</p>
        <button type="button" onClick={retry}>
          {t('Try again', 'Eseye ankò')}
        </button>
      </div>
    );
  }

  if (conn === null) return null;

  if (!conn.connected) {
    return (
      <p className={styles.propsHint}>
        {t(
          'No Printify shop connected. Connect it once in Creator Settings → Printify.',
          'Pa gen magazen Printify konekte. Konekte l yon sèl fwa nan Paramèt Kreyatè → Printify.',
        )}
      </p>
    );
  }

  return (
    <div>
      <p className={styles.propsHint}>
        {t('Connected to shop', 'Konekte ak magazen')}: <strong>{conn.shop_title || conn.shop_id}</strong>
      </p>
      <fieldset style={{ border: 'none', padding: 0, margin: '8px 0' }}>
        <legend className={styles.propsHint}>{t('Import these fields', 'Enpòte chan sa yo')}</legend>
        <p className={styles.propsHint}>{t('Title and price are always imported.', 'Tit ak pri a toujou enpòte.')}</p>
        {IMPORT_FIELD_OPTIONS.map((o) => (
          <label key={o.key} style={{ display: 'block', marginBottom: 4 }}>
            <input
              type="checkbox"
              checked={fields.includes(o.key)}
              onChange={() => setFields((prev) => (prev.includes(o.key) ? prev.filter((k) => k !== o.key) : [...prev, o.key]))}
              disabled={busy}
            />{' '}{t(o.en, o.ht)}
          </label>
        ))}
      </fieldset>

      <button type="button" onClick={handleLoadProducts} disabled={busy}>
        {t('Load Printify products', 'Chaje pwodwi Printify yo')}
      </button>

      {items && items.length === 0 && (
        <p className={styles.propsHint}>{t('No products in this shop.', 'Pa gen pwodwi nan magazen sa a.')}</p>
      )}

      {items && items.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0' }}>
          {items.map((p) => (
            <li key={p.printify_product_id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={selected.includes(p.printify_product_id)}
                onChange={() => toggle(p.printify_product_id)}
                disabled={p.imported || busy}
                aria-label={p.title}
              />
              {p.image_url && (
                <img
                  src={p.image_url}
                  alt=""
                  style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                />
              )}
              <span style={{ flex: 1, minWidth: 0 }}>
                {p.title}
                <span className={styles.propsHint}>
                  {' '}· {p.price} · {p.stock} {t('in stock', 'nan stock')}
                </span>
              </span>
              {p.imported && <span className={styles.propsHint}>{t('Imported', 'Enpòte')}</span>}
            </li>
          ))}
        </ul>
      )}

      {items && items.length > 0 && (
        <button type="button" className="btn-primary" onClick={handleImport} disabled={busy || selected.length === 0}>
          {t(`Import selected (${selected.length})`, `Enpòte chwazi yo (${selected.length})`)}
        </button>
      )}
      {imported.length > 0 && (
        <p className={styles.propsHint}>
          {t('Imported as drafts:', 'Enpòte kòm bouyon:')}{' '}
          {imported.map((p) => p.title).join(', ')}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
