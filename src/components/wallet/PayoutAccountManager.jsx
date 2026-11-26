/**
 * PayoutAccountManager — Manage payout accounts (PayPal OAuth Connect).
 *
 * Instead of typing a PayPal email, the creator authenticates on PayPal.com
 * and the verified email is captured automatically via OAuth.
 *
 * Features:
 *   - List payout accounts with method icons and labels
 *   - "Connect with PayPal" OAuth button — the window is opened only once
 *     the auth URL is known, so a slow/failed request can never leave the
 *     creator staring at an about:blank tab
 *   - Manual PayPal email fallback — PayPal OAuth only works once the
 *     PayPal app has "Log in with PayPal" enabled and this exact Return
 *     URL registered; until then a payout account is still just an email
 *   - Delete account with confirmation
 *   - Set default account
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { walletService } from '../../services/api';
import { inlineText } from '../../utils/inlineI18n';

const PAYPAL_ICON = 'fa-paypal';

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(); } catch { return '—'; }
}

export default function PayoutAccountManager({
  accounts = [],
  onAdd,
  onUpdate,
  onDelete,
  onSetDefault,
  loading = false,
  lang = 'en',
  className = '',
}) {
  const isHt = lang === 'ht';
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  // Held only when the browser refused the popup, so the creator still has
  // a one-click way to reach PayPal instead of a dead end.
  const [authUrl, setAuthUrl] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualError, setManualError] = useState('');
  const [savingManual, setSavingManual] = useState(false);
  const popupRef = useRef(null);

  // ── Listen for postMessage from PayPal OAuth popup ─────────────────
  const handleMessage = useCallback((event) => {
    const data = event.data;
    if (data?.type === 'paypal_connect_result') {
      setConnecting(false);
      popupRef.current = null;
      if (data.success) {
        setConnectError('');
        // Refresh accounts list by triggering onAdd (which re-fetches)
        onAdd?.({ _refresh: true, method: 'paypal', paypal_email: data.message });
      } else {
        setConnectError(data.message || (isHt ? 'Erè konekte PayPal' : inlineText(lang, 'PayPal connection failed')));
      }
    }
  }, [onAdd, isHt, lang]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // ── Close popup on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    };
  }, []);

  // ── Stop "Connecting…" when the popup closes without a result ──────
  // PayPal shows its own error page when the app's Return URL is not
  // registered or "Log in with PayPal" is not enabled, and never redirects
  // back. The popup just sits there, then closes — leaving the button
  // spinning forever with no explanation.
  useEffect(() => {
    if (!connecting) return undefined;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const popup = popupRef.current;
      const abandoned = popup && popup.closed;
      const timedOut = Date.now() - startedAt > 5 * 60 * 1000;
      if (!abandoned && !timedOut) return;
      clearInterval(timer);
      setConnecting(false);
      if (abandoned) popupRef.current = null;
      setConnectError((current) => current || (isHt
        ? 'Fenèt PayPal la fèmen san repons. Eseye ankò, oswa antre imèl PayPal ou anba a.'
        : inlineText(lang, 'The PayPal window closed without a result. Try again, or enter your PayPal email below.')));
    }, 800);
    return () => clearInterval(timer);
  }, [connecting, isHt, lang]);

  // ── Manual fallback: save a PayPal email as the payout account ──────
  const handleManualSubmit = useCallback(async (event) => {
    event.preventDefault();
    const email = manualEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setManualError(isHt
        ? 'Antre yon imèl PayPal valid.'
        : inlineText(lang, 'Enter a valid PayPal email.'));
      return;
    }
    setManualError('');
    setSavingManual(true);
    try {
      await onAdd?.({
        method: 'paypal',
        label: `PayPal (${email})`,
        paypal_email: email,
        is_default: accounts.length === 0,
      });
      setManualEmail('');
    } catch (err) {
      setManualError(
        err?.response?.data?.error
        || err?.response?.data?.detail
        || err?.message
        || (isHt ? 'Pa t ka anrejistre imèl la.' : inlineText(lang, 'Could not save that PayPal email.')),
      );
    } finally {
      setSavingManual(false);
    }
  }, [manualEmail, onAdd, accounts.length, isHt, lang]);

  // ── Start PayPal OAuth ─────────────────────────────────────────────
  // The auth URL is fetched FIRST. Pre-opening an empty window made every
  // slow or rejected request look like a broken page: PayPal answers in
  // seconds when its app config is wrong, but the request still has to
  // travel to the API, and the creator was left on about:blank with no
  // message until it returned.
  const handleConnectPayPal = useCallback(async () => {
    setConnecting(true);
    setConnectError('');
    setAuthUrl('');

    try {
      const res = await walletService.paypalConnect();
      const url = res?.data?.auth_url;
      if (!url) {
        setConnecting(false);
        setConnectError(isHt
          ? 'Pa resevwa lyen otorizasyon PayPal.'
          : inlineText(lang, 'No PayPal authorization URL received.'));
        return;
      }

      const w = 600, h = 700;
      const left = (window.screen.width - w) / 2;
      const top = (window.screen.height - h) / 2;
      const popup = window.open(
        url,
        'paypal_connect',
        `width=${w},height=${h},left=${left},top=${top},scrollbars=yes`,
      );
      if (!popup) {
        // Popup blocked (common after an await). Keep the URL on screen so
        // the next click is a direct user gesture the browser allows.
        setAuthUrl(url);
        setConnecting(false);
        setConnectError(isHt
          ? 'Fenèt PayPal la bloke. Klike "Ouvri PayPal" anba a pou kontinye.'
          : inlineText(lang, 'The PayPal window was blocked. Click "Open PayPal" below to continue.'));
        return;
      }
      popupRef.current = popup;
    } catch (err) {
      setConnecting(false);
      setConnectError(err?.response?.data?.error || err?.message || (isHt
        ? 'Erè lansman koneksyon PayPal.'
        : inlineText(lang, 'Failed to start PayPal connection.')));
    }
  }, [isHt, lang]);

  return (
    <div className={`wlt-payout-mgr ${className}`}>
      {/* Header */}
      <div className="wlt-payout-header">
        <h3 className="wlt-payout-title">
          <i className={`fab ${PAYPAL_ICON}`} />
          {isHt ? 'Kont Peman' : inlineText(lang, 'Payout Accounts')}
        </h3>
      </div>

      {/* Loading */}
      {loading && (
        <div className="wlt-loading"><i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap chaje...' : inlineText(lang, 'Loading...')}</div>
      )}

      {/* Empty state */}
      {!loading && accounts.length === 0 && (
        <div className="wlt-empty">
          <i className={`fab ${PAYPAL_ICON}`} style={{ fontSize: '2rem', opacity: 0.5 }} />
          <h4>{isHt ? 'Pa gen kont peman' : inlineText(lang, 'No payout accounts')}</h4>
          <p>{isHt
            ? 'Konekte kont PayPal ou pou retire lajan ou.'
            : inlineText(lang, 'Connect your PayPal account to withdraw your funds.')}</p>
        </div>
      )}

      {/* Connect with PayPal button */}
      {!loading && (
        <div className="wlt-payout-connect">
          <button
            type="button"
            className="btn-primary wlt-paypal-connect-btn"
            onClick={handleConnectPayPal}
            disabled={connecting}
          >
            {connecting ? (
              <><i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap konekte...' : inlineText(lang, 'Connecting...')}</>
            ) : (
              <><i className={`fab ${PAYPAL_ICON}`} /> {isHt ? 'Konekte ak PayPal' : inlineText(lang, 'Connect with PayPal')}</>
            )}
          </button>
          {connectError && (
            <div className="wlt-form-error" style={{ marginTop: '0.5rem' }}>{connectError}</div>
          )}
          {authUrl && (
            <a
              className="btn-secondary wlt-paypal-connect-btn"
              style={{ marginTop: '0.5rem' }}
              href={authUrl}
              target="_blank"
              rel="noreferrer"
            >
              <i className={`fab ${PAYPAL_ICON}`} /> {isHt ? 'Ouvri PayPal' : inlineText(lang, 'Open PayPal')}
            </a>
          )}
          <p className="wlt-paypal-connect-hint">
            {isHt
              ? 'Ou pral konekte sou paypal.com pou verifye kont ou.'
              : inlineText(lang, 'You\'ll authenticate on PayPal.com to verify your account.')}
          </p>
        </div>
      )}

      {/* Manual fallback — PayPal OAuth needs "Log in with PayPal" enabled
          and this exact Return URL registered on the PayPal app. Until that
          is done the popup dead-ends on PayPal, so let the creator connect
          the payout email directly and withdraw anyway. */}
      {!loading && (
        <div className="wlt-payout-form">
          <h4 className="wlt-form-title">
            <i className="fas fa-keyboard" /> {isHt ? 'Pa ka konekte? Antre imèl PayPal ou' : inlineText(lang, 'Can\u2019t connect? Enter your PayPal email')}
          </h4>
          <form onSubmit={handleManualSubmit} noValidate>
            <div className="wlt-form-field">
              <label className="wlt-form-label" htmlFor="wlt-paypal-email">
                {isHt ? 'Imèl PayPal' : inlineText(lang, 'PayPal email')}
              </label>
              <input
                id="wlt-paypal-email"
                className="wlt-form-input"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={manualEmail}
                onChange={(e) => { setManualEmail(e.target.value); setManualError(''); }}
              />
            </div>
            {manualError && <div className="wlt-form-error">{manualError}</div>}
            <button type="submit" className="btn-secondary" disabled={savingManual || !manualEmail.trim()}>
              {savingManual
                ? <><i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap anrejistre...' : inlineText(lang, 'Saving...')}</>
                : <><i className="fas fa-plus" /> {isHt ? 'Ajoute kont PayPal' : inlineText(lang, 'Add PayPal account')}</>}
            </button>
          </form>
        </div>
      )}

      {/* Accounts list */}
      {accounts.map((account) => (
        <div key={account.id} className={`wlt-payout-card ${account.is_default ? 'wlt-payout-default' : ''}`}>
          <div className="wlt-payout-icon">
            <i className={`fab ${PAYPAL_ICON}`} />
          </div>
          <div className="wlt-payout-body">
            <div className="wlt-payout-label">
              {account.label || account.paypal_email || (isHt ? 'Kont' : inlineText(lang, 'Account'))}
              {account.is_default && (
                <span className="wlt-payout-default-badge">{isHt ? 'Defo' : inlineText(lang, 'Default')}</span>
              )}
            </div>
            <div className="wlt-payout-method">
              PayPal · {account.paypal_email || '—'} · {fmtDate(account.created_at)}
            </div>
          </div>
          <div className="wlt-payout-actions">
            {!account.is_default && (
              <button type="button" className="wlt-payout-icon-btn" onClick={() => onSetDefault?.(account.id)} title={isHt ? 'Defo' : inlineText(lang, 'Set default')}>
                <i className="fas fa-star" />
              </button>
            )}
            <button type="button" className="wlt-payout-icon-btn wlt-payout-icon-danger" onClick={() => setDeleteConfirm(account.id)} title={isHt ? 'Efase' : inlineText(lang, 'Delete')}>
              <i className="fas fa-trash" />
            </button>
          </div>
          {/* Delete confirmation */}
          {deleteConfirm === account.id && (
            <div className="wlt-payout-delete-confirm" onClick={(e) => e.stopPropagation()}>
              <span className="wlt-payout-delete-text">{isHt ? 'Sijè ou efase kont sa a?' : inlineText(lang, 'Delete this account?')}</span>
              <div className="wlt-payout-delete-btns">
                <button type="button" className="wlt-payout-delete-yes" onClick={() => { onDelete?.(account.id); setDeleteConfirm(null); }}>
                  {isHt ? 'Wi' : inlineText(lang, 'Yes')}
                </button>
                <button type="button" className="wlt-payout-delete-no" onClick={() => setDeleteConfirm(null)}>
                  {isHt ? 'Non' : inlineText(lang, 'No')}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
