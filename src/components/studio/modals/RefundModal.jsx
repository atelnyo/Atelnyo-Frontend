/**
 * src/components/studio/modals/RefundModal.jsx
 *
 * Modal for requesting a refund on a PayPal transaction (buyer or staff).
 *
 * Flow:
 *   1. Receives a marketplace Transaction (from the wallet refund list).
 *   2. User picks a full or partial refund amount (defaults to the full
 *      remaining balance).
 *   3. POST /api/checkout/paypal/refund/ — the backend validates ownership
 *      + remaining amount, calls PayPal's refund API, and records the
 *      refunded amount on the transaction (idempotent, partial-refund aware).
 *
 * Only PayPal transactions in 'succeeded' / 'partially_refunded' status
 * are refundable — the list UI already filters for that.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { checkoutService } from '../../../services/api';
import { StudioModal, FormField, LoadingOverlay } from './shared';
import styles from './modals.module.css';

export default function RefundModal({ txn, onClose, onSuccess, lang, showToast }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? (ht || en) : en);

  const total = useMemo(() => Number(txn?.amount || 0), [txn]);
  const refundedSoFar = useMemo(() => Number(txn?.refunded_amount || 0), [txn]);
  const remaining = useMemo(() => Math.max(0, Math.round((total - refundedSoFar) * 100) / 100), [total, refundedSoFar]);

  const [amount, setAmount] = useState(remaining > 0 ? String(remaining) : '');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = useCallback((field, value) => {
    if (field === 'amount') setAmount(value);
    else setReason(value);
    setErrors((e) => ({ ...e, [field]: null, _api: null }));
  }, []);

  const validate = () => {
    const errs = {};
    const num = Number(amount);
    if (!amount || isNaN(num) || num <= 0) {
      errs.amount = t('Enter a valid refund amount.', 'Antre yon montan refund valid.');
    } else if (num > remaining + 0.001) {
      errs.amount = t(`Cannot exceed the remaining $${remaining.toFixed(2)}.`, `Pa ka depase $${remaining.toFixed(2)} ki rete a.`);
    }
    return errs;
  };

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    try {
      const num = Number(amount);
      const isFull = Math.abs(num - remaining) < 0.001;
      const payload = { transaction_id: txn.id };
      if (!isFull) payload.amount = num;
      if (reason?.trim()) payload.reason = reason.trim();

      const resp = await checkoutService.refundPaypal(txn.id, isFull ? undefined : num);
      const data = resp?.data;
      showToast?.(
        t('✅ Refund processed successfully!', '✅ Refund trete avèk siksè!'),
        'check-circle',
      );
      onSuccess?.(data);
      onClose?.();
    } catch (err) {
      const detail = err?.response?.data?.error || err?.message
        || t('Could not process the refund.', 'Pa t kapab trete refund la.');
      setErrors((e) => ({ ...e, _api: detail }));
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setLoading(false);
    }
  }, [amount, reason, remaining, txn, validate, showToast, onSuccess, onClose, t]);

  const isFullyRefunded = remaining <= 0;
  const methodLabel = txn?.gateway === 'paypal' ? 'PayPal' : (txn?.gateway || '—');

  return (
    <StudioModal
      onClose={onClose}
      icon="fa-rotate-left"
      title={t('Request Refund', 'Mande Refund')}
      subtitle={t('Refund a payment back to the buyer', 'Ranbouse yon peman bay achteur la')}
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        {errors._api && <div className={styles.apiError} role="alert">{errors._api}</div>}

        {/* Transaction summary */}
        <div className={styles.refundSummary}>
          <div className={styles.refundSummaryRow}>
            <span>{t('Transaction', 'Tranzaksyon')}:</span>
            <strong>#{txn?.id}</strong>
          </div>
          <div className={styles.refundSummaryRow}>
            <span>{t('Method', 'Metòd')}:</span>
            <strong>{methodLabel}</strong>
          </div>
          <div className={styles.refundSummaryRow}>
            <span>{t('Paid', 'Peye')}:</span>
            <strong>${total.toFixed(2)}</strong>
          </div>
          {refundedSoFar > 0 && (
            <div className={styles.refundSummaryRow}>
              <span>{t('Refunded so far', 'Deja ranbouse')}:</span>
              <strong>${refundedSoFar.toFixed(2)}</strong>
            </div>
          )}
          <div className={styles.refundSummaryRow}>
            <span>{t('Refundable', 'Rete pou ranbouse')}:</span>
            <strong>${remaining.toFixed(2)}</strong>
          </div>
        </div>

        {isFullyRefunded ? (
          <div className={styles.apiError} role="alert">
            {t('This transaction is already fully refunded.', 'Tranzaksyon sa a deja ranbouse nèt.')}
          </div>
        ) : (
          <LoadingOverlay loading={loading}>
            <FormField
              label={t('Refund Amount ($)', 'Montan Refund ($)')}
              required
              error={errors.amount}
              hint={t(`Leave as $${remaining.toFixed(2)} for a full refund`, `Kite $${remaining.toFixed(2)} pou yon refund total`)}
            >
              <input
                className={styles.input}
                type="number"
                min="0.01"
                max={remaining}
                step="0.01"
                value={amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                placeholder={remaining.toFixed(2)}
                autoFocus
              />
            </FormField>

            <FormField label={t('Reason (optional)', 'Rezon (opsyonèl)')}>
              <textarea
                className={styles.textarea}
                value={reason}
                onChange={(e) => handleChange('reason', e.target.value)}
                placeholder={t('Why are you refunding this?', 'Poukisa w ap ranbouse sa?')}
                rows={2}
                maxLength={300}
              />
            </FormField>
          </LoadingOverlay>
        )}

        <div className={styles.actions}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            {t('Cancel', 'Anile')}
          </button>
          {!isFullyRefunded && (
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <><i className="fas fa-spinner fa-spin" /> {t('Processing...', 'Ap trete...')}</>
              ) : (
                <><i className="fas fa-rotate-left" /> {t('Confirm Refund', 'Konfime Refund')}</>
              )}
            </button>
          )}
        </div>
      </form>
    </StudioModal>
  );
}
