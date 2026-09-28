/**
 * src/components/studio/modals/VerificationModal.jsx
 *
 * KYC (identity verification) modal — live status + submission form.
 *
 * Backs the payout gate: withdrawals require an approved IdentityVerification
 * (PayoutViewSet.perform_create → PermissionDenied). This modal:
 *
 *   • GETs /api/identity/verification/ on open → real status
 *     (approved | pending | rejected | unverified).
 *   • approved  → shows the verified state + KYC benefits.
 *   • pending   → shows "under review" (no re-submit allowed).
 *   • rejected  → shows the rejection reason + re-submit form.
 *   • unverified → shows the KYC benefits + submission form.
 *
 * The form POSTs /api/identity/verification/ (submitIdentity) with the
 * identity fields the serializer accepts; the backend stores the last 4
 * digits of the document number only.
 *
 * Extracted from StudioModals.jsx during Etap 3 refactor; KYC-live since
 * the wallet integration (Etap PayPal).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { walletService } from '../../../services/api';
import { StudioModal, FormField, LoadingOverlay } from './shared';
import styles from './modals.module.css';

const ID_DOCUMENT_TYPES = [
  { value: 'passport', en: 'Passport', ht: 'Paspo' },
  { value: 'national_id', en: 'National ID', ht: 'Kat Idantite' },
  { value: 'driver_license', en: 'Driver License', ht: 'Pèmi Kondwi' },
  { value: 'residence_permit', en: 'Residence Permit', ht: 'Pèmi Rezidans' },
];

export default function VerificationModal({ onClose, lang, showToast, onSuccess }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? (ht || en) : en);

  // status: null=loading | approved | pending | rejected | unverified
  const [status, setStatus] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [form, setForm] = useState({
    full_name: '', date_of_birth: '', nationality: '',
    id_document_type: '', id_document_number: '', id_document_url: '',
    country: '', city: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // ── Load the real verification status ────────────────────────────
  useEffect(() => {
    let cancelled = false;
    walletService.identityStatus()
      .then((resp) => {
        if (cancelled) return;
        const data = resp?.data || {};
        setStatus(data.status || 'unverified');
        setRejectionReason(data.rejection_reason || '');
        // Pre-fill known fields so a rejected user can correct + resubmit.
        if (data.full_name || data.nationality || data.country) {
          setForm((f) => ({
            ...f,
            full_name: data.full_name || f.full_name,
            nationality: data.nationality || f.nationality,
            id_document_type: data.id_document_type || f.id_document_type,
            country: data.country || f.country,
            city: data.city || f.city,
          }));
        }
      })
      .catch(() => { if (!cancelled) setStatus('unverified'); });
    return () => { cancelled = true; };
  }, []);

  const handleChange = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: null, _api: null }));
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    const errs = {};
    if (!form.full_name.trim()) errs.full_name = t('Full name is required.', 'Non konplè obligatwa.');
    if (!form.nationality.trim()) errs.nationality = t('Nationality is required.', 'Nasyonalite obligatwa.');
    if (!form.id_document_type) errs.id_document_type = t('Select a document type.', 'Chwazi yon tip dokiman.');
    if (!form.id_document_number.trim()) errs.id_document_number = t('Document number is required.', 'Nimewo dokiman obligatwa.');
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      const payload = { ...form, date_of_birth: form.date_of_birth || null };
      await walletService.submitIdentity(payload);
      setStatus('pending');
      showToast?.(
        t('✅ Verification submitted — under review!', '✅ Verifikasyon soumèt — ap revize!'),
        'check-circle',
      );
      onSuccess?.();
    } catch (err) {
      const detail = err?.response?.data?.error || err?.response?.data?.detail
        || err?.message
        || t('Could not submit verification.', 'Pa t kapab soumèt verifikasyon an.');
      setErrors((e) => ({ ...e, _api: detail }));
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setSubmitting(false);
    }
  }, [form, t, showToast, onSuccess]);

  return (
    <StudioModal onClose={onClose} icon="fa-shield-alt" wide
      title={t('Creator Verification', 'Verifikasyon Creator')}
      subtitle={t('KYC — know your creator', 'KYC — konnen kreyatè ou')}>
      <div className={styles.verification}>

        {/* ── Status banner ─────────────────────────────────────────── */}
        {status === 'approved' && (
          <div className={styles.verifItem}>
            <i className={`fas fa-check-circle ${styles.verifDone}`} aria-hidden="true" />
            <div>
              <strong>{t('Application Approved', 'Aplikasyon Apwouve')}</strong>
              <p>{t('You are a verified creator on atelnyo.', 'Ou se yon Creator verifye sou atelnyo.')}</p>
            </div>
          </div>
        )}
        {status === 'pending' && (
          <div className={styles.verifItem}>
            <i className={`fas fa-clock ${styles.verifPending}`} aria-hidden="true" />
            <div>
              <strong>{t('Under Review', 'Ap Revize')}</strong>
              <p>{t(
                'Your documents are being reviewed. You will be able to withdraw once approved.',
                'Dokiman ou ap revize. Ou pral ka retire lajan yon fwa apwouve.',
              )}</p>
            </div>
          </div>
        )}
        {status === 'rejected' && rejectionReason && (
          <div className={styles.apiError} role="alert">
            <i className="fas fa-circle-exclamation" aria-hidden="true" />
            <strong>{t('Rejected:', 'Refize:')}</strong> {rejectionReason}
          </div>
        )}

        {/* ── KYC benefits (shown unless approved) ──────────────────── */}
        {status !== 'approved' && (
          <div className={styles.verifItem}>
            <i className="fas fa-unlock-alt" aria-hidden="true" />
            <div>
              <strong>{t('Why KYC matters:', 'Poukisa KYC enpòtan:')}</strong>
              <ul className={styles.verifList}>
                <li>{t('Unlock withdrawals', 'Debloke retrè lajan')}</li>
                <li>{t('Increase sales limits', 'Ogmante limit vant')}</li>
                <li>{t('"Verified" badge on your profile', 'Badge "Verifye" sou pwofil ou')}</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── Submission form (unverified / rejected) ───────────────── */}
        {status === 'unverified' || status === 'rejected' ? (
          <form onSubmit={handleSubmit} className={styles.form}>
            {errors._api && <div className={styles.apiError} role="alert">{errors._api}</div>}
            <LoadingOverlay loading={submitting}>
              <FormField label={t('Full Name', 'Non Konplè')} required error={errors.full_name}>
                <input className={styles.input} value={form.full_name}
                  onChange={(e) => handleChange('full_name', e.target.value)}
                  placeholder={t('Legal name as on your ID', 'Non legal jan li parèt sou ID ou')} />
              </FormField>

              <FormField label={t('Date of Birth', 'Dat Nesans')}>
                <input className={styles.input} type="date" value={form.date_of_birth}
                  onChange={(e) => handleChange('date_of_birth', e.target.value)} />
              </FormField>

              <FormField label={t('Nationality', 'Nasyonalite')} required error={errors.nationality}>
                <input className={styles.input} value={form.nationality}
                  onChange={(e) => handleChange('nationality', e.target.value)}
                  placeholder={t('e.g. Haitian', 'Eg: Ayisyen')} />
              </FormField>

              <FormField label={t('Country of Residence', 'Peyi Rezidans')}>
                <input className={styles.input} value={form.country}
                  onChange={(e) => handleChange('country', e.target.value)}
                  placeholder={t('e.g. Haiti', 'Eg: Ayiti')} />
              </FormField>

              <FormField label={t('City', 'Vil')}>
                <input className={styles.input} value={form.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder={t('e.g. Port-au-Prince', 'Eg: Pòtoprens')} />
              </FormField>

              <FormField label={t('ID Document Type', 'Tip Dokiman ID')} required error={errors.id_document_type}>
                <select className={styles.input} value={form.id_document_type}
                  onChange={(e) => handleChange('id_document_type', e.target.value)}>
                  <option value="">{t('— Select —', '— Chwazi —')}</option>
                  {ID_DOCUMENT_TYPES.map((d) => (
                    <option key={d.value} value={d.value}>{isHt ? d.ht : d.en}</option>
                  ))}
                </select>
              </FormField>

              <FormField label={t('ID Document Number', 'Nimewo Dokiman ID')} required error={errors.id_document_number}
                hint={t('Only the last 4 digits are stored.', 'Sèlman dènye 4 chif yo sove.')}>
                <input className={styles.input} value={form.id_document_number}
                  onChange={(e) => handleChange('id_document_number', e.target.value)}
                  placeholder={t('e.g. 1234', 'Eg: 1234')} maxLength={30} />
              </FormField>

              <FormField label={t('Document URL (optional)', 'URL Dokiman (opsyonèl)')}
                hint={t('Paste a link to your ID photo, or leave empty for now.', 'Kole yon lyen foto ID ou, oswa kite li vid.')}>
                <input className={styles.input} value={form.id_document_url}
                  onChange={(e) => handleChange('id_document_url', e.target.value)}
                  placeholder="https://..." />
              </FormField>
            </LoadingOverlay>

            <div className={styles.actions}>
              <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
                {t('Cancel', 'Anile')}
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? (
                  <><i className="fas fa-spinner fa-spin" /> {t('Submitting...', 'Ap soumèt...')}</>
                ) : (
                  <><i className="fas fa-paper-plane" /> {t('Submit Verification', 'Soumèt Verifikasyon')}</>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className={styles.actions} style={{ borderTop: '1px solid var(--border-color)', paddingTop: 'var(--sp-4xl)' }}>
            <button type="button" className="btn-primary" onClick={onClose}>
              {t('Close', 'Fèmen')}
            </button>
          </div>
        )}
      </div>
    </StudioModal>
  );
}
