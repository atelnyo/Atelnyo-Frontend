/**
 * PayoutAccountManager — Manage payout accounts (PayPal OAuth Connect).
 *
 * Instead of typing a PayPal email, the creator authenticates on PayPal.com
 * and the verified email is captured automatically via OAuth.
 *
 * Features:
 *   - List payout accounts with method icons and labels
 *   - "Connect with PayPal" OAuth button (popup flow)
 *   - Delete account with confirmation
 *   - Set default account
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { walletService } from '../../services/api';

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
  lang = 'ht',
  className = '',
}) {
  const isHt = lang === 'ht';
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
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
        setConnectError(data.message || (isHt ? 'Erè konekte PayPal' : 'PayPal connection failed'));
      }
    }
  }, [onAdd, isHt]);

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

  // ── Open PayPal OAuth popup ────────────────────────────────────────
  const handleConnectPayPal = useCallback(async () => {
    setConnecting(true);
    setConnectError('');
    try {
      const res = await walletService.paypalConnect();
      const authUrl = res?.data?.auth_url;
      if (!authUrl) {
        setConnecting(false);
        setConnectError(isHt
          ? 'Pa resevwa lyen otorizasyon PayPal.'
          : 'No PayPal authorization URL received.');
        return;
      }
      // Open PayPal in a popup (600x700 centered)
      const w = 600, h = 700;
      const left = (window.screen.width - w) / 2;
      const top = (window.screen.height - h) / 2;
      popupRef.current = window.open(
        authUrl,
        'paypal_connect',
        `width=${w},height=${h},left=${left},top=${top},scrollbars=yes`,
      );
    } catch (err) {
      setConnecting(false);
      setConnectError(err?.response?.data?.error || err?.message || (isHt
        ? 'Erè lansman koneksyon PayPal.'
        : 'Failed to start PayPal connection.'));
    }
  }, [isHt]);

  return (
    <div className={`wlt-payout-mgr ${className}`}>
      {/* Header */}
      <div className="wlt-payout-header">
        <h3 className="wlt-payout-title">
          <i className={`fab ${PAYPAL_ICON}`} />
          {isHt ? 'Kont Peman' : 'Payout Accounts'}
        </h3>
      </div>

      {/* Loading */}
      {loading && (
        <div className="wlt-loading"><i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap chaje...' : 'Loading...'}</div>
      )}

      {/* Empty state */}
      {!loading && accounts.length === 0 && (
        <div className="wlt-empty">
          <i className={`fab ${PAYPAL_ICON}`} style={{ fontSize: '2rem', opacity: 0.5 }} />
          <h4>{isHt ? 'Pa gen kont peman' : 'No payout accounts'}</h4>
          <p>{isHt
            ? 'Konekte kont PayPal ou pou retire lajan ou.'
            : 'Connect your PayPal account to withdraw your funds.'}</p>
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
              <><i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap konekte...' : 'Connecting...'}</>
            ) : (
              <><i className={`fab ${PAYPAL_ICON}`} /> {isHt ? 'Konekte ak PayPal' : 'Connect with PayPal'}</>
            )}
          </button>
          {connectError && (
            <div className="wlt-form-error" style={{ marginTop: '0.5rem' }}>{connectError}</div>
          )}
          <p className="wlt-paypal-connect-hint">
            {isHt
              ? 'Ou pral konekte sou paypal.com pou verifye kont ou.'
              : 'You\'ll authenticate on PayPal.com to verify your account.'}
          </p>
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
              {account.label || account.paypal_email || (isHt ? 'Kont' : 'Account')}
              {account.is_default && (
                <span className="wlt-payout-default-badge">{isHt ? 'Defo' : 'Default'}</span>
              )}
            </div>
            <div className="wlt-payout-method">
              PayPal · {account.paypal_email || '—'} · {fmtDate(account.created_at)}
            </div>
          </div>
          <div className="wlt-payout-actions">
            {!account.is_default && (
              <button type="button" className="wlt-payout-icon-btn" onClick={() => onSetDefault?.(account.id)} title={isHt ? 'Defo' : 'Set default'}>
                <i className="fas fa-star" />
              </button>
            )}
            <button type="button" className="wlt-payout-icon-btn wlt-payout-icon-danger" onClick={() => setDeleteConfirm(account.id)} title={isHt ? 'Efase' : 'Delete'}>
              <i className="fas fa-trash" />
            </button>
          </div>
          {/* Delete confirmation */}
          {deleteConfirm === account.id && (
            <div className="wlt-payout-delete-confirm" onClick={(e) => e.stopPropagation()}>
              <span className="wlt-payout-delete-text">{isHt ? 'Sijè ou efase kont sa a?' : 'Delete this account?'}</span>
              <div className="wlt-payout-delete-btns">
                <button type="button" className="wlt-payout-delete-yes" onClick={() => { onDelete?.(account.id); setDeleteConfirm(null); }}>
                  {isHt ? 'Wi' : 'Yes'}
                </button>
                <button type="button" className="wlt-payout-delete-no" onClick={() => setDeleteConfirm(null)}>
                  {isHt ? 'Non' : 'No'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
