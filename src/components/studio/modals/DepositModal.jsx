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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { paymentConfigService, walletTopupService } from '../../../services/api';
// Canonical SDK loader (single injected script, deadline included) — this
// module used to keep its own copy, which never gave up on a request that
// was accepted but never answered: the modal stayed on an empty PayPal slot
// with no message and no way to retry.
import { loadPayPalScript } from '../../CheckoutModal';
import { StudioModal, FormField, LoadingOverlay } from './shared';
import styles from './modals.module.css';
import { inlineText } from '../../../utils/inlineI18n';

// Fallback limits when the config endpoint hasn't loaded yet (they are
// admin-configurable server-side via /api/admin/platform-config/).
const DEFAULT_MIN_AMOUNT = 5;
const DEFAULT_MAX_AMOUNT = 10000;

// Quick amounts — the sizes creators actually top up with. Filtered against
// the server-side min/max, so an admin lowering the cap to $20 simply hides
// the bigger chips instead of offering a deposit the server would reject.
const PRESET_AMOUNTS = [10, 25, 50, 100, 250];

/**
 * Boot skeleton — the modal used to look ready before PayPal config and the
 * SDK had answered, so a fast tap on "Continue" left an empty white payment
 * slot with no explanation. This mirrors the real form (label, amount field,
 * quick amounts, payment slot) while the boot runs.
 */
function DepositBootSkeleton({ isHt, lang }) {
  return (
    <div
      className={styles.depositSkeleton}
      role="status"
      aria-busy="true"
      aria-label={isHt ? 'Ap prepare fòm peman an' : inlineText(lang, 'Preparing the payment form')}
    >
      <span className={styles.depositSkeletonLabel} aria-hidden="true" />
      <span className={styles.depositSkeletonField} aria-hidden="true" />
      <div className={styles.depositSkeletonPresets} aria-hidden="true">
        {PRESET_AMOUNTS.map((preset) => (
          <span key={preset} className={styles.depositSkeletonChip} />
        ))}
      </div>
      <span className={`${styles.depositSkeletonField} ${styles.depositSkeletonSlot}`} aria-hidden="true" />
      <span className={styles.depositSkeletonHint} aria-hidden="true" />
    </div>
  );
}

export default function DepositModal({ onClose, onSuccess, lang, showToast, currentBalance }) {
  const isHt = lang === 'ht';
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState({});
  const [ppConfig, setPpConfig] = useState(null);
  const [paypal, setPaypal] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | ready | processing | success | failed
  // The modal is NOT usable until config + SDK settle: showing a live amount
  // field before then is what produced the blank PayPal slot.
  const [booting, setBooting] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [depositRef, setDepositRef] = useState(null); // { paypal_order_id, amount }
  // Balance the server reports after a capture — the success card shows the
  // real number instead of a claim we did not verify.
  const [newBalance, setNewBalance] = useState(null);
  const [limits, setLimits] = useState({ min: DEFAULT_MIN_AMOUNT, max: DEFAULT_MAX_AMOUNT });
  const buttonContainerRef = useRef(null);
  const processingRef = useRef(false);

  const t = (en, ht) => (isHt ? (ht || en) : inlineText(lang, en));

  // ── Boot PayPal config once ──────────────────────────────────────────
  const boot = useCallback(async () => {
    try {
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
      const pp = await loadPayPalScript(config.data.client_id, config.data.sandbox);
      setPaypal(pp);
    } catch (err) {
      setErrorMsg(err?.code === 'timeout'
        ? t('PayPal took too long to load. Check your connection and try again.', 'PayPal pran twòp tan pou chaje. Verifye koneksyon w epi eseye ankò.')
        : t('PayPal is not available right now.', 'PayPal poko disponib kounye a.'));
      setPhase('failed');
    } finally {
      // Every outcome — ready, unconfigured, failed — reveals the real form;
      // the skeleton only covers the boot itself.
      setBooting(false);
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

  // Quick amounts the server-side limits actually allow.
  const presetAmounts = useMemo(
    () => PRESET_AMOUNTS.filter((preset) => preset >= limits.min && preset <= limits.max),
    [limits],
  );

  const selectPreset = useCallback((preset) => {
    handleAmountChange(String(preset));
  }, [handleAmountChange]);

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

  // showToast is not memoized by the parent, so keep the latest one in a ref.
  const showToastRef = useRef(showToast);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  // Capture + credit, shared by the PayPal approval and the manual
  // "I already paid" retry. POST /checkout/wallet/capture/ is idempotent per
  // PayPal capture id (it even recovers an already-captured order), so
  // running it twice can never credit the wallet twice.
  const finishCapture = useCallback(async (orderId) => {
    setPhase('processing');
    setErrorMsg('');
    try {
      const capture = await walletTopupService.capture(orderId);
      if (capture?.data?.credited === false) {
        // The provider took the money but the ledger credit did not apply —
        // never tell the creator the wallet is funded.
        setPhase('failed');
        setErrorMsg(capture?.data?.error || t(
          'PayPal took the payment but the wallet was not credited. Contact support with the reference.',
          'PayPal pran peman an men bous la pa resevwa lajan an. Kontakte sipò ak referans lan.',
        ));
        return;
      }
      setNewBalance(capture?.data?.balance ?? null);
      setPhase('success');
      showToastRef.current?.(
        t('✅ Wallet funded successfully!', '✅ Bous ou fin ranpli avèk siksè!'),
        'check-circle',
      );
      onSuccess?.(capture?.data);
    } catch (err) {
      setPhase('failed');
      setErrorMsg(err?.response?.data?.error || t('Payment failed. Please try again.', 'Peman echwe. Tanpri eseye ankò.'));
    }
  }, [onSuccess, t]);

  // The PayPal Buttons effect must not depend on finishCapture ("t" changes
  // identity every render, which would re-mount the buttons) — keep the
  // latest callback in a ref, the same pattern used for showToast above.
  const finishCaptureRef = useRef(finishCapture);
  useEffect(() => { finishCaptureRef.current = finishCapture; }, [finishCapture]);

  // Retry after an approval whose capture never came back (closed tab,
  // dropped network). Safe by design: the endpoint is idempotent.
  const checkPayment = useCallback(() => {
    if (!depositRef?.paypal_order_id) return;
    finishCapture(depositRef.paypal_order_id);
  }, [depositRef, finishCapture]);

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
        try {
          await finishCaptureRef.current?.(depositRef.paypal_order_id);
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
  }, [phase, paypal, depositRef, onSuccess, t]);

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
          {booting ? (
            <DepositBootSkeleton isHt={isHt} lang={lang} />
          ) : (
            <>
              {/* Amount input — only editable before an order is created */}
              <FormField
                label={t('Amount ($)', 'Montan ($)')}
                required
                error={errors.amount}
                hint={t(`Minimum $${limits.min} · Maximum $${limits.max}`, `Minimòm $${limits.min} · Maksimòm $${limits.max}`)}
              >
                <div className={styles.depositAmountRow}>
                  <span className={styles.depositCurrency} aria-hidden="true">$</span>
                  <input
                    className={styles.depositAmountInput}
                    type="number"
                    inputMode="decimal"
                    min={limits.min}
                    max={limits.max}
                    step="1"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    placeholder="50.00"
                    autoFocus
                    disabled={depositRef !== null}
                  />
                </div>
              </FormField>

              {/* Quick amounts live OUTSIDE the field label — buttons inside a
                  <label> steal the label's activation from the input. */}
              {presetAmounts.length > 0 && (
                <div
                  className={styles.depositPresets}
                  role="group"
                  aria-label={t('Quick amounts', 'Montan rapid')}
                >
                  {presetAmounts.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`${styles.depositPreset} ${
                        Number(amount) === preset ? styles.depositPresetActive : ''
                      }`}
                      aria-pressed={Number(amount) === preset}
                      onClick={() => selectPreset(preset)}
                      disabled={depositRef !== null}
                    >
                      ${preset}
                    </button>
                  ))}
                </div>
              )}

              {Number.isFinite(Number(currentBalance)) && (
                <p className={styles.depositBalance}>
                  <i className="fas fa-wallet" aria-hidden="true" />
                  {t('Current balance', 'Balans kounye a')}:{' '}
                  <strong>${Number(currentBalance).toFixed(2)}</strong>
                </p>
              )}

              {/* Say it up front instead of letting the creator tap a
                  Continue button that cannot work. */}
              {paypalUnavailable && (
                <div className={styles.apiError} role="alert">
                  <i className="fas fa-circle-exclamation" aria-hidden="true" />{' '}
                  {t('PayPal is not available right now.', 'PayPal poko disponib kounye a.')}
                </div>
              )}

              {phase === 'failed' && errorMsg && (
                <div className={styles.apiError} role="alert">
                  <i className="fas fa-circle-exclamation" aria-hidden="true" /> {errorMsg}
                </div>
              )}

              {/* An approval whose capture never came back is recoverable:
                  ask the server to check the order instead of paying twice. */}
              {phase === 'failed' && depositRef?.paypal_order_id && (
                <button
                  type="button"
                  className={styles.depositRetryBtn}
                  onClick={checkPayment}
                >
                  <i className="fas fa-rotate-right" aria-hidden="true" />
                  {t('I already paid — check again', 'Mwen deja peye — tcheke ankò')}
                </button>
              )}

              {phase === 'ready' && (
                <div className={styles.depositPaypal}>
                  <div className={styles.depositSummary}>
                    <span className={styles.depositSummaryLabel}>
                      {t('You are adding', 'Ou ap ajoute')}
                    </span>
                    <strong className={styles.depositSummaryAmount}>
                      ${(Number(amount) || 0).toFixed(2)}
                    </strong>
                  </div>
                  <p className={styles.hint}>
                    {t('Complete your payment on PayPal to add funds.', 'Konplete peman ou sou PayPal pou ajoute lajan.')}
                  </p>
                  {paypalUnavailable ? (
                    <div className={styles.apiError} role="alert">
                      {t('PayPal is not available right now.', 'PayPal poko disponib kounye a.')}
                    </div>
                  ) : paypal ? (
                    <div ref={buttonContainerRef} className={styles.depositButtons} />
                  ) : (
                    // SDK still arriving: real skeleton, not an empty slot.
                    <div
                      className={styles.depositButtonsLoading}
                      role="status"
                      aria-busy="true"
                      aria-label={t('Loading PayPal', 'Ap chaje PayPal')}
                    >
                      <span className={styles.depositButtonGhost} aria-hidden="true" />
                      <span className={styles.depositButtonGhost} aria-hidden="true" />
                    </div>
                  )}
                </div>
              )}

              {phase === 'success' && (
                <div className={styles.depositSuccess}>
                  <span className={styles.depositSuccessIcon}>
                    <i className="fas fa-check-circle" aria-hidden="true" />
                  </span>
                  <p className={styles.depositSuccessTitle}>
                    {t('Your wallet has been funded!', 'Bous ou fin ranpli!')}
                  </p>
                  <span className={styles.depositSuccessAmount}>
                    +${(Number(amount) || 0).toFixed(2)}
                  </span>
                  {newBalance != null && (
                    <span className={styles.depositSuccessBalance}>
                      {t('New balance', 'Nouvo balans')}: ${Number(newBalance).toFixed(2)}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </LoadingOverlay>

        <div className={styles.actions}>
          {!paypalUnavailable && phase !== 'ready' && phase !== 'processing' && phase !== 'success' && (
            <button
              type="button"
              className="btn-primary"
              onClick={handleCreate}
              disabled={booting || phase === 'processing'}
            >
              <i
                className={booting ? 'fas fa-spinner fa-spin' : 'fab fa-paypal'}
                aria-hidden="true"
              />
              {booting
                ? t('Preparing PayPal…', 'Ap prepare PayPal…')
                : t('Continue with PayPal', 'Kontinye ak PayPal')}
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
