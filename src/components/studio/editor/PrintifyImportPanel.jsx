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

export default function PrintifyImportPanel({ isHt, showToast }) {
  const [conn, setConn] = useState(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState(null);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');

  const t = (en, ht) => (isHt ? ht : en);

  const loadConnection = useCallback(async () => {
    try {
      const res = await marketplaceService.printifyConnection();
      setConn(res.data);
    } catch (e) {
      setConn({ connected: false });
    }
  }, []);

  useEffect(() => { loadConnection(); }, [loadConnection]);

  const fail = (err, fallback) => {
    const msg = err?.response?.data?.detail || fallback;
    setError(msg);
    showToast?.(msg, 'circle-exclamation');
  };

  const handleConnect = async () => {
    if (!token.trim()) {
      setError(t('Paste your Printify API token.', 'Kole token API Printify ou a.'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await marketplaceService.printifyConnect(token.trim());
      setConn(res.data);
      setToken('');
    } catch (err) {
      fail(err, t('Could not connect to Printify.', 'Pa t kapab konekte ak Printify.'));
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await marketplaceService.printifyDisconnect();
      setConn({ connected: false });
      setItems(null);
      setSelected([]);
    } catch (err) {
      fail(err, t('Could not disconnect.', 'Pa t kapab dekonekte.'));
    } finally {
      setBusy(false);
    }
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
      const res = await marketplaceService.printifyImport(selected);
      const count = res.data?.imported?.length || 0;
      showToast?.(
        t(`${count} product(s) imported as drafts.`, `${count} pwodwi enpòte kòm bouyon.`),
        'check-circle',
      );
      await handleLoadProducts();
    } catch (err) {
      fail(err, t('Import failed.', 'Enpòtasyon an echwe.'));
    } finally {
      setBusy(false);
    }
  };

  if (conn === null) return null;

  if (!conn.connected) {
    return (
      <div>
        <p className={styles.propsHint}>
          {t(
            'Paste your Printify personal API token. It is stored only for your account and never shown again.',
            'Kole token API pèsonèl Printify ou a. Yo sere li sèlman pou kont ou, epi yo pa janm montre l ankò.',
          )}
        </p>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={t('Printify API token', 'Token API Printify')}
          autoComplete="off"
          aria-label={t('Printify API token', 'Token API Printify')}
        />
        <button type="button" className="btn-primary" onClick={handleConnect} disabled={busy}>
          {t('Connect Printify', 'Konekte Printify')}
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <p className={styles.propsHint}>
        {t('Connected to shop', 'Konekte ak magazen')}: <strong>{conn.shop_title || conn.shop_id}</strong>
      </p>
      <button type="button" onClick={handleLoadProducts} disabled={busy}>
        {t('Load Printify products', 'Chaje pwodwi Printify yo')}
      </button>{' '}
      <button type="button" onClick={handleDisconnect} disabled={busy}>
        {t('Disconnect', 'Dekonekte')}
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
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
