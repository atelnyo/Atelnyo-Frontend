/**
 * src/components/studio/modals/WithdrawModal.jsx
 *
 * Modal for withdrawing funds. POSTs to /api/wallet/payouts/.
 *
 * KYC GATE: the backend blocks withdrawals for unverified users
 * (PayoutViewSet.perform_create → PermissionDenied 403). This modal
 * checks GET /api/identity/verification/ up front and shows a clear
 * gate — with a button that opens the VerificationModal (KYC form) —
 * instead of letting the user fill the whole form and hit a 403.
 *
 * The creator first connects a payout account (PayPal) in
 * the wallet section; this modal lets them pick one of those accounts and
 * request a withdrawal to it.
 *
 * Extracted from StudioModals.jsx during Etap 3 refactor.
 */
import React, { useState, useCallback, useEffect } from 'react';
import api from '../../../services/api';
import { walletService } from '../../../services/api';
import { StudioModal, FormField, LoadingOverlay } from './shared';
import styles from './modals.module.css';

const METHOD_LABELS = {
  paypal: { en: 'PayPal', ht: 'PayPal' },
};

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(); } catch { return '—'; }
}

export default function WithdrawModal({ onClose, onSuccess, lang, showToast, onOpenVerification }) {
  const [form, setForm] = useState({
    amount: '', payout_account: '', method: 'paypal', account_details: '', notes: '',
  });
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // ── KYC gate: the backend rejects payouts for unverified users (403).
  // Check status up front so the user sees WHY + how to fix, not a generic
  // API error after filling the form.
  const [kycStatus, setKycStatus] = useState(null); // null=loading | unverified | pending | approved | rejected
  const [kycLoading, setKycLoading] = useState(true);

  // Load the creator's connected payout accounts (bank/PayPal/mobile/crypto).
  useEffect(() => {
    let cancelled = false;
    walletService.payoutAccounts()
      .then((resp) => {
        if (cancelled) return;
        const list = Array.isArray(resp?.data) ? resp.data : (resp?.data?.results || []);
        setAccounts(list);
        // Pre-select the default account (or the first one).
        const defaultAccount = list.find((a) => a.is_default) || list[0];
        if (defaultAccount) {
          setForm((f) => ({ ...f, payout_account: String(defaultAccount.id), method: defaultAccount.method || 'bank' }));
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAccountsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ── KYC status check (fire-and-forget; failure falls through to the
  // form so a broken status endpoint never blocks a verified user).
  useEffect(() => {
    let cancelled = false;
    walletService.identityStatus()
      .then((resp) => {
        if (cancelled) return;
        const status = resp?.data?.status || 'unverified';
        setKycStatus(status);
      })
      .catch(() => { if (!cancelled) setKycStatus('approved'); })
      .finally(() => { if (!cancelled) setKycLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const kycBlocked = kycStatus && kycStatus !== 'approved' && !kycLoading;

  const handleChange = useCallback((field, value) => {
    setForm((f) => {
      const next = { ...f, [field]: value };
      // Selecting a connected account fills the method automatically.
      if (field === 'payout_account') {
        const acc = accounts.find((a) => String(a.id) === String(value));
        if (acc) next.method = acc.method || 'bank';
      }
      return next;
    });
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
  }, [accounts, errors]);

  const validate = () => {
    const errs = {};
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) < 5) {
      errs.amount = lang === 'ht' ? 'Montan minimòm se $5' : 'Minimum amount is $5';
    }
    if (Number(form.amount) > Number((accounts.find((a) => String(a.id) === String(form.payout_account)))?.limit ?? Infinity)) {
      // No hard limit on payout accounts today — kept as a safety valve.
    }
    // A connected account OR manual details are required.
    if (!form.payout_account && !form.account_details.trim()) {
      errs.account_details = lang === 'ht' ? 'Chwazi yon kont oswa antre detay kont' : 'Choose an account or enter account details';
    }
    return errs;
  };

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    try {
      const payload = {
        amount: Number(form.amount),
        method: form.method,
        notes: form.notes.trim() || undefined,
      };
      // Preferred path: the connected payout account id.
      if (form.payout_account) {
        payload.payout_account = Number(form.payout_account);
      } else {
        payload.account_details = form.account_details.trim();
      }
      await api.post('wallet/payouts/', payload);
      showToast?.(
        lang === 'ht' ? '✅ Demann retrè soumèt avèk siksè!' : '✅ Withdrawal request submitted!',
        'check-circle',
      );
      onSuccess?.(); onClose?.();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.amount?.[0]
        || err?.message
        || (lang === 'ht' ? 'Pa t kapab soumèt retrè a.' : 'Could not submit withdrawal.');
      setErrors((e) => ({ ...e, _api: detail }));
      showToast?.(detail, 'circle-exclamation');
    } finally { setLoading(false); }
  }, [form, lang, showToast, onSuccess, onClose, accounts]);

  const selectedAccount = accounts.find((a) => String(a.id) === String(form.payout_account));

  return (
    <StudioModal onClose={onClose} icon="fa-arrow-up"
      title={lang === 'ht' ? 'Retrè lajan' : 'Withdraw Funds'}
      subtitle={lang === 'ht' ? 'Retire lajan nan bous ou' : 'Withdraw money from your wallet'}>

      {/* ── KYC gate — unverified / pending / rejected ──────────────── */}
      {kycBlocked && (
        <div className={styles.kycGate}>
          <div className={styles.kycGateIcon}>
            {kycStatus === 'pending'
              ? <i className="fas fa-clock" aria-hidden="true" />
              : <i className="fas fa-user-shield" aria-hidden="true" />}
          </div>
          {kycStatus === 'pending' && (
            <>
              <h4 className={styles.kycGateTitle}>
                {lang === 'ht' ? 'Verifikasyon ap trete' : 'Verification in progress'}
              </h4>
              <p className={styles.kycGateText}>
                {lang === 'ht'
                  ? 'Idantite ou ap revize. Yon fwa apwouve, ou ka retire lajan.'
                  : 'Your identity is under review. Once approved, you can withdraw funds.'}
              </p>
            </>
          )}
          {kycStatus === 'rejected' && (
            <>
              <h4 className={styles.kycGateTitle}>
                {lang === 'ht' ? 'Verifikasyon refize' : 'Verification rejected'}
              </h4>
              <p className={styles.kycGateText}>
                {lang === 'ht'
                  ? 'Verifikasyon ou te refize. Re-soumèt enfòmasyon ou yo pou ou ka retire lajan.'
                  : 'Your verification was rejected. Re-submit your details to unlock withdrawals.'}
              </p>
            </>
          )}
          {(kycStatus === 'unverified' || kycStatus === 'expired') && (
            <>
              <h4 className={styles.kycGateTitle}>
                {lang === 'ht' ? 'KYC obligatwa pou retrè' : 'KYC required to withdraw'}
              </h4>
              <p className={styles.kycGateText}>
                {lang === 'ht'
                  ? 'Pou retire lajan ou bezwen verifye idantite ou an premye (KYC).'
                  : 'You need to verify your identity (KYC) before withdrawing funds.'}
              </p>
            </>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              if (onOpenVerification) { onOpenVerification(); return; }
              onClose?.();
            }}
          >
            <i className="fas fa-user-shield" aria-hidden="true" />
            {lang === 'ht' ? 'Verifye Idantite' : 'Verify Identity'}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {lang === 'ht' ? 'Fèmen' : 'Close'}
          </button>
        </div>
      )}

      {/* ── Withdrawal form (approved users only) ────────────────────── */}
      {!kycBlocked && (
      <form onSubmit={handleSubmit} className={styles.form}>
        {errors._api && <div className={styles.apiError} role="alert">{errors._api}</div>}
        <LoadingOverlay loading={loading}>
          <FormField label={lang === 'ht' ? 'Montan ($)' : 'Amount ($)'} required error={errors.amount}>
            <input className={styles.input} type="number" min="5" step="1"
              value={form.amount} onChange={(e) => handleChange('amount', e.target.value)}
              placeholder="50.00" autoFocus />
          </FormField>

          {/* Connected payout account picker — primary path */}
          <FormField
            label={lang === 'ht' ? 'Kont Peman' : 'Payout Account'}
            hint={lang === 'ht' ? 'Chwazi yon kont ou konekte (bank, PayPal...) oswa antre detay' : 'Pick an account you connected, or enter details below'}
          >
            {accountsLoading ? (
              <div className={styles.hint}><i className="fas fa-spinner fa-spin" /> {lang === 'ht' ? 'Ap chaje kont yo...' : 'Loading accounts...'}</div>
            ) : accounts.length > 0 ? (
              <select className={styles.input} value={form.payout_account}
                onChange={(e) => handleChange('payout_account', e.target.value)}>
                <option value="">{lang === 'ht' ? '— Chwazi yon kont —' : '— Select an account —'}</option>
                {accounts.map((acc) => {
                  const label = METHOD_LABELS[acc.method]?.en || acc.method;
                  return (
                    <option key={acc.id} value={String(acc.id)}>
                      {acc.label || label} · {acc.method} {acc.is_default ? '· ⭐' : ''}
                    </option>
                  );
                })}
              </select>
            ) : (
              <div className={styles.hint}>
                {lang === 'ht'
                  ? 'Pa gen kont konekte. Antre detay anba a oswa ale nan "Kont Peman" pou konekte yon kont PayPal/bank.'
                  : 'No connected accounts. Enter details below, or use "Payout Accounts" to connect PayPal/bank.'}
              </div>
            )}
          </FormField>

          {selectedAccount && (
            <div className={styles.refundSummary}>
              <div className={styles.refundSummaryRow}>
                <span>{lang === 'ht' ? 'Kont' : 'Account'}:</span>
                <strong>{selectedAccount.label || METHOD_LABELS[selectedAccount.method]?.en || selectedAccount.method}</strong>
              </div>
              <div className={styles.refundSummaryRow}>
                <span>{lang === 'ht' ? 'Metòd' : 'Method'}:</span>
                <strong>{METHOD_LABELS[selectedAccount.method]?.en || selectedAccount.method}</strong>
              </div>
              <div className={styles.refundSummaryRow}>
                <span>{lang === 'ht' ? 'Konekte' : 'Added'}:</span>
                <strong>{fmtDate(selectedAccount.created_at)}</strong>
              </div>
            </div>
          )}

          {/* Manual fallback — only when no account is selected */}
          {!form.payout_account && (
            <>
              <FormField label={lang === 'ht' ? 'Metòd Peman' : 'Payment Method'}>
                <select className={styles.input} value={form.method}
                  onChange={(e) => handleChange('method', e.target.value)}>
                  <option value="bank">{lang === 'ht' ? 'Bank' : 'Bank Transfer'}</option>
                  <option value="paypal">PayPal</option>
                  <option value="mobile_money">{lang === 'ht' ? 'Lajan Mobil' : 'Mobile Money'}</option>
                  <option value="crypto">Cryptocurrency</option>
                </select>
              </FormField>
              <FormField label={lang === 'ht' ? 'Detay Kont' : 'Account Details'} error={errors.account_details}
                hint={lang === 'ht' ? 'Non bank, nimewo kont, oswa imèl PayPal' : 'Bank name, account number, or PayPal email'}>
                <textarea className={styles.textarea} value={form.account_details}
                  onChange={(e) => handleChange('account_details', e.target.value)}
                  placeholder={lang === 'ht' ? 'Bank: ... Nimewo: ...' : 'Bank: ... Account: ...'}
                  rows={2} />
              </FormField>
            </>
          )}

          <FormField label={lang === 'ht' ? 'Nòt (opsyonèl)' : 'Notes (optional)'}>
            <input className={styles.input} value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder={lang === 'ht' ? 'Nòt pou admin...' : 'Note for admin...'}
              maxLength={500} />
          </FormField>
        </LoadingOverlay>
        <div className={styles.actions}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            {lang === 'ht' ? 'Anile' : 'Cancel'}
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <><i className="fas fa-spinner fa-spin" /> {lang === 'ht' ? 'Ap trete...' : 'Processing...'}</>
            ) : (
              <><i className="fas fa-paper-plane" /> {lang === 'ht' ? 'Soumèt Retrè' : 'Submit Withdrawal'}</>
            )}
          </button>
        </div>
      </form>
      )}
    </StudioModal>
  );
}
