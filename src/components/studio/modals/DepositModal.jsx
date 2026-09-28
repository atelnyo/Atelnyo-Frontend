/**
 * src/components/studio/modals/DepositModal.jsx
 *
 * Modal for funding the wallet balance via PayPal (top-up).
 *
 * Flow (webhook-first confirmation, same contract as CheckoutModal):
 *   1. User enters an amount (min $5, max $10000).
 *   2. POST /api/checkout/wallet/deposit/  → server creates a PayPal
 *      CAPTURE order with custom_id=wallet_<id> (authoritative amount).
 *   3. PayPal JS SDK renders Buttons wired to the server-created order;
 *      on approval POST /api/checkout/wallet/capture/ captures it and
 *      credits the wallet balance.
 *   4. The PAYMENT.CAPTURE.COMPLETED webhook is the authoritative
 *      confirmation (idempotent) — duplicate capture can't double-credit.
 *
 * The frontend NEVER determines the amount, holds secrets, or marks a
 * deposit complete without backend confirmation.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { paymentConfigService, walletTopupService } from '../../../services/api';
import { StudioModal, FormField, LoadingOverlay } from './shared';
import styles from './modals.module.css';

// ─── PayPal SDK loader (injected once, capture intent) ─────────────────
let _paypalScriptPromise = null;

function loadPayPalScript(clientId, isSandbox) {
  if (window.paypal && window.paypal.Buttons) {
    return Promise.resolve(window.paypal);
  }
  if (_paypalScriptPromise) return _paypalScriptPromise;
  const base = isSandbox ? 'https://www.sandbox.paypal.com' : 'https://www.paypal.com';
  _paypalScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${base}/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;
    script.async = true;
    script.onload = () => resolve(window.paypal);
    script.onerror = () => {
      _paypalScriptPromise = null;
      reject(new Error('PayPal SDK failed to load'));
    };
    document.body.appendChild(script);
  });
  return _paypalScriptPromise;
}

// Fallback limits when the config endpoint hasn't loaded yet (they are
// admin-configurable server-side via /api/admin/platform-config/).
const DEFAULT_MIN_AMOUNT = 5;
const DEFAULT_MAX_AMOUNT = 10000;

export default function DepositModal({ onClose, onSuccess, lang, showToast }) {
  const isHt = lang === 'ht';
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState({});
  const [ppConfig, setPpConfig] = useState(null);
  const [paypal, setPaypal] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | ready | processing | success | failed
  const [errorMsg, setErrorMsg] = useState('');
  const [depositRef, setDepositRef] = useState(null); // { paypal_order_id, amount }
  const [limits, setLimits] = useState({ min: DEFAULT_MIN_AMOUNT, max: DEFAULT_MAX_AMOUNT });
  const buttonContainerRef = useRef(null);
  const processingRef = useRef(false);

  const t = (en, ht) => (isHt ? (ht || en) : en);

  // ── Boot PayPal config once ──────────────────────────────────────────
  const boot = useCallback(async () => {
    const config = await paymentConfigService.config();
    setPpConfig(config?.data || null);
    // Admin-configurable top-up limits (server-authoritative; fall back to
    // the defaults if the endpoint hasn't shipped them yet).
    if (config?.data) {
      setLimits({
        min: Number(config.data.topup_min) || DEFAULT_MIN_AMOUNT,
        max: Number(config.data.topup_max) || DEFAULT_MAX_AMOUNT,
      });
    }
    if (!config?.data?.configured || !config?.data?.client_id) return;
    try {
      const pp = await loadPayPalScript(config.data.client_id, config.data.sandbox);
      setPaypal(pp);
    } catch (_) {
      setErrorMsg(t('PayPal is not available right now.', 'PayPal poko disponib kounye a.'));
      setPhase('failed');
    }
  }, [isHt]);

  useEffect(() => {
    // boot() sets state after an async network call; the synchronous
    // first-statement setState inside it is the same intentional pattern
    // the rest of the codebase uses (see CheckoutModal.jsx).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAmountChange = useCallback((value) => {
    setAmount(value);
    setErrors((e) => ({ ...e, amount: null, _api: null }));
    setPhase('idle');
    setDepositRef(null);
  }, []);

  // ── Create the deposit server-side (authoritative amount) ──────────
  const handleCreate = useCallback(async () => {
    const num = Number(amount);
    const { min, max } = limits;
    if (!amount || isNaN(num) || num < min) {
      setErrors({ amount: t(`Minimum deposit is $${min}`, `Montan minimòm se $${min}`) });
      return;
    }
    if (num > max) {
      setErrors({ amount: t(`Maximum deposit is $${max}`, `Montan maksimòm se $${max}`) });
      return;
    }
    setPhase('processing');
    setErrorMsg('');
    try {
      const resp = await walletTopupService.deposit(num);
      const data = resp?.data;
      if (!data?.paypal_order_id) throw new Error(t('Could not create the deposit.', 'Pa t kapab kreye depo a.'));
      setDepositRef(data);
      setPhase('ready');
    } catch (err) {
      setPhase('failed');
      setErrorMsg(err?.response?.data?.error || t('Could not create the deposit.', 'Pa t kapab kreye depo a.'));
    }
  }, [amount, limits, isHt, t]);

  // ── Render PayPal buttons once the order exists ────────────────────
  useEffect(() => {
    if (phase !== 'ready' || !paypal || !depositRef?.paypal_order_id) return;
    const container = buttonContainerRef.current;
    if (!container) return;
    if (container.dataset.renderedFor === depositRef.paypal_order_id) return;

    container.innerHTML = '';
    const buttons = paypal.Buttons({
      style: { layout: 'vertical', shape: 'rect', label: 'paypal' },
      createOrder: () => depositRef.paypal_order_id,
      onApprove: async () => {
        if (processingRef.current) return;
        processingRef.current = true;
        setPhase('processing');
        try {
          const capture = await walletTopupService.capture(depositRef.paypal_order_id);
          setPhase('success');
          showToast?.(
            t('✅ Wallet funded successfully!', '✅ Bous ou fin ranpli avèk siksè!'),
            'check-circle',
          );
          onSuccess?.(capture?.data);
        } catch (err) {
          setPhase('failed');
          setErrorMsg(err?.response?.data?.error || t('Payment failed. Please try again.', 'Peman echwe. Tanpri eseye ankò.'));
        } finally {
          processingRef.current = false;
        }
      },
      onCancel: () => setPhase('idle'),
      onError: () => {
        setPhase('failed');
        setErrorMsg(t('Payment failed. Please try again.', 'Peman echwe. Tanpri eseye ankò.'));
      },
    });
    buttons.render(container).then(() => {
      if (container) container.dataset.renderedFor = depositRef.paypal_order_id;
    }).catch(() => {
      setPhase('failed');
      setErrorMsg(t('PayPal is not available right now.', 'PayPal poko disponib kounye a.'));
    });
    return () => { try { container.innerHTML = ''; } catch (_) {} };
  }, [phase, paypal, depositRef, showToast, onSuccess, t]);

  const paypalUnavailable = ppConfig && !ppConfig.configured;

  return (
    <StudioModal
      onClose={onClose}
      icon="fa-circle-dollar-to-slot"
      title={t('Fund Wallet', 'Depoze Lajan')}
      subtitle={t('Add money to your wallet balance via PayPal', 'Ajoute lajan nan bous ou atravè PayPal')}
    >
      <div className={styles.form}>
        {errors._api && <div className={styles.apiError} role="alert">{errors._api}</div>}
        <LoadingOverlay loading={phase === 'processing'}>

          {/* Amount input — only editable before an order is created */}
          <FormField
            label={t('Amount ($)', 'Montan ($)')}
            required
            error={errors.amount}
            hint={t(`Minimum $${limits.min} · Maximum $${limits.max}`, `Minimòm $${limits.min} · Maksimòm $${limits.max}`)}
          >
            <input
              className={styles.input}
              type="number"
              min={limits.min}
              max={limits.max}
              step="1"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="50.00"
              autoFocus
              disabled={depositRef !== null}
            />
          </FormField>

          {phase === 'failed' && errorMsg && (
            <div className={styles.apiError} role="alert">
              <i className="fas fa-circle-exclamation" /> {errorMsg}
            </div>
          )}

          {phase === 'ready' && (
            <div className={styles.depositPaypal}>
              <p className={styles.hint}>
                {t('Complete your payment on PayPal to add funds.', 'Konplete peman ou sou PayPal pou ajoute lajan.')}
              </p>
              {paypalUnavailable ? (
                <div className={styles.apiError} role="alert">
                  {t('PayPal is not available right now.', 'PayPal poko disponib kounye a.')}
                </div>
              ) : (
                <div ref={buttonContainerRef} className={styles.depositButtons} />
              )}
            </div>
          )}

          {phase === 'success' && (
            <div className={styles.depositSuccess}>
              <i className="fas fa-check-circle" />
              <p>{t('Your wallet has been funded!', 'Bous ou fin ranpli!')}</p>
            </div>
          )}
        </LoadingOverlay>

        <div className={styles.actions}>
          {phase !== 'ready' && phase !== 'processing' && phase !== 'success' && (
            <button
              type="button"
              className="btn-primary"
              onClick={handleCreate}
              disabled={phase === 'processing'}
            >
              <i className="fab fa-paypal" aria-hidden="true" />
              {t('Continue with PayPal', 'Kontinye ak PayPal')}
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose} disabled={phase === 'processing'}>
            {t('Close', 'Fèmen')}
          </button>
        </div>
      </div>
    </StudioModal>
  );
}
