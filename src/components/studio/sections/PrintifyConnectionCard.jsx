/**
 * src/components/studio/sections/PrintifyConnectionCard.jsx
 *
 * Printify is connected ONCE here (Creator Settings). The token is saved
 * server-side for the seller's account, so the product editor only needs
 * to read that saved connection — the seller never pastes it per product.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { marketplaceService } from '../../../services/api';
import styles from './sections.module.css';

const tr = (isHt, en, ht) => (isHt ? ht : en);

export default function PrintifyConnectionCard({ isHt, showToast }) {
  const [conn, setConn] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const fetchConnection = useCallback(() => marketplaceService.printifyConnection()
    .then((res) => ({ ok: true, data: res.data }))
    .catch((err) => ({
      ok: false,
      message: err?.response?.data?.detail
        || tr(isHt, 'Could not check your Printify connection.', 'Pa t kapab verifye koneksyon Printify ou an.'),
    })), [isHt]);

  const applyResult = (result) => {
    if (result.ok) {
      setLoadError('');
      setConn(result.data);
    } else {
      setLoadError(result.message);
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

  const handleConnect = async () => {
    if (!token.trim()) {
      setError(tr(isHt, 'Paste your Printify API token.', 'Kole token API Printify ou a.'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await marketplaceService.printifyConnect(token.trim());
      setConn(res.data);
      setToken('');
      showToast?.(tr(isHt, 'Printify connected.', 'Printify konekte.'), 'check-circle');
    } catch (err) {
      fail(err, tr(isHt, 'Could not connect to Printify.', 'Pa t kapab konekte ak Printify.'));
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    setError('');
    try {
      await marketplaceService.printifyDisconnect();
      setConn({ connected: false });
    } catch (err) {
      fail(err, tr(isHt, 'Could not disconnect.', 'Pa t kapab dekonekte.'));
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (loadError) {
    body = (
      <>
        <p role="alert" className={styles.printifyError}>{loadError}</p>
        <button type="button" className={styles.secondaryBtn} onClick={retry} disabled={busy}>
          {tr(isHt, 'Try again', 'Eseye ankò')}
        </button>
      </>
    );
  } else if (conn === null) {
    body = <p className={styles.printifyText}>{tr(isHt, 'Loading…', 'Chajman…')}</p>;
  } else if (conn.connected) {
    body = (
      <>
        <p className={styles.printifyText}>
          {tr(isHt, 'Connected to shop', 'Konekte ak magazen')}: <strong>{conn.shop_title || conn.shop_id}</strong>
        </p>
        <button type="button" className={styles.secondaryBtn} onClick={handleDisconnect} disabled={busy}>
          {tr(isHt, 'Disconnect', 'Dekonekte')}
        </button>
      </>
    );
  } else {
    body = (
      <>
        <p className={styles.printifyText}>
          {tr(
            isHt,
            'Paste your Printify personal API token once. It is stored only for your account and never shown again.',
            'Kole token API pèsonèl Printify ou a yon sèl fwa. Yo sere li sèlman pou kont ou, epi yo pa janm montre l ankò.',
          )}
        </p>
        <div className={styles.printifyRow}>
          <input
            className={styles.formInput}
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={tr(isHt, 'Printify API token', 'Token API Printify')}
            autoComplete="off"
            aria-label={tr(isHt, 'Printify API token', 'Token API Printify')}
          />
          <button type="button" className="btn-primary" onClick={handleConnect} disabled={busy}>
            {tr(isHt, 'Connect Printify', 'Konekte Printify')}
          </button>
        </div>
      </>
    );
  }

  return (
    <section className={styles.printifyCard} aria-labelledby="printify-connection-title">
      <h3 id="printify-connection-title" className={styles.sectionSubtitle}>Printify</h3>
      {body}
      {error && <p role="alert" className={styles.printifyError}>{error}</p>}
    </section>
  );
}
