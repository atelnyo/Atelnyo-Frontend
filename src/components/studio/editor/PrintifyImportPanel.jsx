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
  { key: 'variants', en: 'Variants (sizes & colors)', ht: 'Variant (gwosè ak koulè)' },
  { key: 'stock', en: 'Stock', ht: 'Stock' },
  { key: 'tags', en: 'Tags', ht: 'Tags' },
  { key: 'shipping', en: 'Shipping info', ht: 'Enfòmasyon livrezon' },
];
const ALL_IMPORT_FIELDS = IMPORT_FIELD_OPTIONS.map((o) => o.key);

export default function PrintifyImportPanel({ isHt, showToast, onImported, onClose }) {
  const [conn, setConn] = useState(null);
  const [connLoading, setConnLoading] = useState(true);
  const [connError, setConnError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [items, setItems] = useState(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const [fields, setFields] = useState(ALL_IMPORT_FIELDS);
  const [imported, setImported] = useState([]);
  const [importWasComplete, setImportWasComplete] = useState(true);
  const [webhookBusy, setWebhookBusy] = useState(false);
  const [webhookResult, setWebhookResult] = useState(null);

  const t = (en, ht) => tr(isHt, en, ht);

  const fetchConnection = useCallback(() => marketplaceService.printifyConnection()
    .then((res) => ({ ok: true, data: res.data }))
    .catch((err) => ({
      ok: false,
      message: err?.response?.data?.detail
        || tr(isHt, 'Could not check your Printify connection.', 'Pa t kapab verifye koneksyon Printify ou an.'),
    })), [isHt]);

  const applyResult = (result) => {
    setConnLoading(false);
    if (result.ok) {
      setConnError('');
      setConn(result.data);
    } else {
      setConnError(result.message);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchConnection().then((result) => {
      if (!cancelled) {
        applyResult(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fetchConnection]);

  const retry = () => {
    setConnLoading(true);
    fetchConnection().then(applyResult);
  };

  const fail = (err, fallback) => {
    const msg = err?.response?.data?.detail || fallback;
    setError(msg);
    showToast?.(msg, 'circle-exclamation');
  };

  const handleLoadProducts = async () => {
    setBusy(true);
    setLoadingProducts(true);
    setError('');
    try {
      const res = await marketplaceService.printifyProducts();
      setItems(res.data?.results || []);
      setSelected([]);
    } catch (err) {
      fail(err, t('Could not load Printify products.', 'Pa t kapab chaje pwodwi Printify yo.'));
    } finally {
      setBusy(false);
      setLoadingProducts(false);
    }
  };

  const handleSetupWebhooks = async () => {
    setWebhookBusy(true);
    setError('');
    try {
      const res = await marketplaceService.printifySetupWebhooks();
      setWebhookResult(res.data);
      showToast?.(t('Order status and tracking hooks are configured.', 'Webhook estati kòmand ak swivi yo konfigire.'), 'check-circle');
    } catch (err) {
      fail(err, t('Could not configure Printify tracking.', 'Pa t kapab konfigire swivi Printify.'));
    } finally {
      setWebhookBusy(false);
    }
  };

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const visibleItems = (items || []).filter((product) => (
    product.title.toLowerCase().includes(query.trim().toLowerCase())
  ));

  const handleImport = async () => {
    if (selected.length === 0) {
      return;
    }
    const selectedIds = [...selected];
    setBusy(true);
    setError('');
    try {
      const res = await marketplaceService.printifyImport(selected, fields);
      const list = res.data?.imported || [];
      showToast?.(
        t(`${list.length} product(s) imported.`, `${list.length} pwodwi enpòte.`),
        'check-circle',
      );
      setImported(list);
      setImportWasComplete(list.length === selectedIds.length);
      setSelected([]);
      if (list.length === selectedIds.length) {
        setItems((current) => current?.map((product) => (
          selectedIds.includes(product.printify_product_id)
            ? { ...product, imported: true }
            : product
        )));
      }
      onImported?.(list);
    } catch (err) {
      fail(err, t('Import failed.', 'Enpòtasyon an echwe.'));
    } finally {
      setBusy(false);
    }
  };

  if (connError) {
    return (
      <div className={styles.printifyPanel}>
        <p role="alert" className={styles.printifyError}>{connError}</p>
        <button type="button" className={styles.printifySecondaryButton} onClick={retry} disabled={connLoading}>
          {connLoading ? t('Checking…', 'Ap verifye…') : t('Try again', 'Eseye ankò')}
        </button>
      </div>
    );
  }

  if (conn === null) {
    return (
      <p className={styles.printifyStatus} role="status">
        {t('Checking your Printify connection…', 'Ap verifye koneksyon Printify ou a…')}
      </p>
    );
  }

  if (!conn.connected) {
    return (
      <p className={styles.printifyNotice}>
        {t(
          'No Printify shop connected. Connect it once in Creator Settings → Printify.',
          'Pa gen magazen Printify konekte. Konekte l yon sèl fwa nan Paramèt Kreyatè → Printify.',
        )}
      </p>
    );
  }

  return (
    <div className={styles.printifyPanel}>
      <p className={styles.printifyConnection}>
        <i className="fas fa-circle-check" aria-hidden="true" />
        <span>
          {t('Connected to', 'Konekte ak')}{' '}
          <strong>{conn.shop_title || conn.shop_id}</strong>
        </span>
      </p>
      <p className={styles.propsHint}>
        {t('Choose products to import as physical products. New imports are saved as drafts.', 'Chwazi pwodwi pou enpòte kòm pwodwi fizik. Nouvo enpòtasyon yo sove kòm bouyon.')}
      </p>
      <fieldset className={styles.printifyFields} disabled={busy || webhookBusy}>
        <legend>{t('Optional product details', 'Detay pwodwi opsyonèl')}</legend>
        <p className={styles.propsHint}>{t('Title and price are always imported.', 'Tit ak pri a toujou enpòte.')}</p>
        <div className={styles.printifyFieldOptions}>
          {IMPORT_FIELD_OPTIONS.map((o) => (
            <label key={o.key} className={styles.printifyFieldOption}>
              <input
                type="checkbox"
                checked={fields.includes(o.key)}
                onChange={() => setFields((prev) => (prev.includes(o.key) ? prev.filter((k) => k !== o.key) : [...prev, o.key]))}
              />
              <span>{t(o.en, o.ht)}</span>
            </label>
          ))}
        </div>
        {fields.includes('shipping') && (
          <p className={styles.printifyFieldNote}>
            {t('Shipping details are fetched for each selected product and may take longer.', 'Yo chèche detay livrezon pou chak pwodwi ou chwazi; sa ka pran plis tan.')}
          </p>
        )}
      </fieldset>

      <div className={styles.printifyProductsHeader}>
        <div>
          <h4>{t('Your Printify products', 'Pwodwi Printify ou yo')}</h4>
          {items && <span className={styles.propsHint}>{items.length} {t('products', 'pwodwi')}</span>}
        </div>
        <button type="button" className={styles.printifySecondaryButton} onClick={handleLoadProducts} disabled={busy || webhookBusy}>
          {loadingProducts
            ? t('Loading…', 'Ap chaje…')
            : items ? t('Refresh', 'Actualize') : t('Load products', 'Chaje pwodwi yo')}
        </button>
      </div>
      {loadingProducts && (
        <p className={styles.printifyStatus} role="status">{t('Loading your shop products…', 'Ap chaje pwodwi magazen ou a…')}</p>
      )}

      {items && items.length === 0 && (
        <p className={styles.printifyNotice}>{t('No products in this shop.', 'Pa gen pwodwi nan magazen sa a.')}</p>
      )}

      {items && items.length > 0 && (
        <input
          className={styles.printifySearch}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('Find a product', 'Chèche yon pwodwi')}
          aria-label={t('Find a Printify product', 'Chèche yon pwodwi Printify')}
        />
      )}

      {items && items.length > 0 && visibleItems.length === 0 && (
        <p className={styles.printifyNotice}>{t('No products match your search.', 'Pa gen pwodwi ki koresponn ak rechèch la.')}</p>
      )}

      {items && visibleItems.length > 0 && (
        <ul className={styles.printifyProductList}>
          {visibleItems.map((p) => (
            <li key={p.printify_product_id} className={styles.printifyProduct}>
              <input
                type="checkbox"
                checked={selected.includes(p.printify_product_id)}
                onChange={() => toggle(p.printify_product_id)}
                disabled={p.imported || busy}
                aria-label={p.title}
              />
              {p.image_url
                ? (
                  <img
                    src={p.image_url}
                    alt=""
                    className={styles.printifyProductImage}
                  />
                )
                : <span className={styles.printifyImagePlaceholder} aria-hidden="true"><i className="fas fa-image" /></span>}
              <span className={styles.printifyProductInfo}>
                <strong>{p.title}</strong>
                <span>{p.price} · {p.stock} {t('in stock', 'nan stock')}</span>
              </span>
              {p.imported && <span className={styles.printifyImported}>{t('Imported', 'Enpòte')}</span>}
            </li>
          ))}
        </ul>
      )}

      {items?.length > 0 && (
        <button type="button" className="btn-primary" onClick={handleImport} disabled={busy || webhookBusy || selected.length === 0}>
          {busy && !loadingProducts
            ? t('Importing…', 'Ap enpòte…')
            : webhookBusy
              ? t('Please wait…', 'Tann…')
              : t(`Import selected (${selected.length})`, `Enpòte chwazi yo (${selected.length})`)}
        </button>
      )}
      {imported.length > 0 && (
        <div className={styles.printifyImportResult} role="status">
          <p>
            {t('Import complete:', 'Enpòtasyon fini:')}{' '}
            {imported.map((p) => p.title).join(', ')}
          </p>
          {!importWasComplete && (
            <p className={styles.propsHint}>
              {t('Refresh the list to verify imported product statuses.', 'Actualize lis la pou verifye estati pwodwi ki enpòte yo.')}
            </p>
          )}
          {onClose && (
            <button type="button" className={styles.printifySecondaryButton} onClick={onClose}>
              {t('Close and view my products', 'Fèmen epi wè pwodwi m yo')}
            </button>
          )}
        </div>
      )}

      {error && <p role="alert" className={styles.printifyError}>{error}</p>}

      <details className={styles.printifyTracking}>
        <summary>{t('Order tracking setup (optional)', 'Konfigirasyon swivi kòmand (opsyonèl)')}</summary>
        <p className={styles.propsHint}>
          {t('This is not required to import products. Configure PRINTIFY_WEBHOOK_SECRET on the server and use the same secret in Printify webhook settings before continuing.', 'Sa pa nesesè pou enpòte pwodwi. Konfigire PRINTIFY_WEBHOOK_SECRET sou sèvè a epi itilize menm sekrè a nan paramèt webhook Printify anvan ou kontinye.')}
        </p>
        <button type="button" className={styles.printifySecondaryButton} onClick={handleSetupWebhooks} disabled={busy || webhookBusy}>
          {webhookBusy ? t('Configuring tracking…', 'Ap konfigire swivi…') : t('Configure order tracking', 'Konfigire swivi kòmand')}
        </button>
        {webhookResult?.configured && (
          <p className={styles.printifyStatus} role="status">
            {t('Tracking hooks configured for this shop.', 'Webhook swivi yo konfigire pou magazen sa a.')}
          </p>
        )}
      </details>
    </div>
  );
}
