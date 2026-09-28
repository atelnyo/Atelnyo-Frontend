/**
 * BusinessKYCForm.jsx — Business Identity Verification Form.
 *
 * Allows business owners to submit KYC documents for verification.
 * Admin can approve/reject through the admin panel.
 */
import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const BUSINESS_TYPES = [
  { value: 'sole_proprietorship', labelHt: 'Propriyete Pèsonèl', labelEn: 'Sole Proprietorship' },
  { value: 'llc', labelHt: 'LLC', labelEn: 'LLC' },
  { value: 'corporation', labelHt: 'Korporasyon', labelEn: 'Corporation' },
  { value: 'partnership', labelHt: 'Patenè', labelEn: 'Partnership' },
  { value: 'nonprofit', labelHt: 'Non-Profit', labelEn: 'Non-Profit' },
  { value: 'other', labelHt: 'Lòt', labelEn: 'Other' },
];

export default function BusinessKYCForm({ businessId, lang = 'ht', onStatusChange }) {
  const t = (ht, en) => lang === 'ht' ? ht : en;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    legal_business_name: '',
    registration_number: '',
    tax_id: '',
    business_type: '',
    address_line1: '',
    city: '',
    country: '',
    owner_legal_name: '',
    owner_id_type: '',
    owner_id_number_last4: '',
    registration_document_url: '',
    tax_document_url: '',
    accepted_terms: false,
  });

  useEffect(() => {
    if (!businessId) return;
    setLoading(true);
    api.get(`business/kyc/${businessId}/`)
      .then(res => {
        setStatus(res.data);
        if (res.data.kyc) {
          setForm(prev => ({
            ...prev,
            legal_business_name: res.data.kyc.legal_business_name || '',
            business_type: res.data.kyc.business_type || '',
            city: res.data.kyc.address?.city || '',
            country: res.data.kyc.address?.country || '',
            accepted_terms: res.data.kyc.accepted_terms || false,
          }));
        }
      })
      .catch(() => setStatus({ status: 'not_submitted' }))
      .finally(() => setLoading(false));
  }, [businessId]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.legal_business_name || !form.registration_number || !form.business_type) {
      setError(t('Tanpri ranpli tout chan obligatwa', 'Please fill all required fields'));
      return;
    }
    if (!form.accepted_terms) {
      setError(t('Ou dwe aksepte kondisyon yo', 'You must accept the terms'));
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`business/kyc/${businessId}/`, form);
      setStatus({ status: 'documents_submitted' });
      onStatusChange?.('documents_submitted');
    } catch (err) {
      setError(err.response?.data?.error || t('Erè nan soumèt', 'Error submitting'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: 24, color: 'var(--pink-primary)' }} />
      </div>
    );
  }

  // Show status if already submitted
  if (status?.status && status.status !== 'not_submitted') {
    const statusConfig = {
      documents_submitted: { icon: 'fa-clock', color: '#f59e0b', labelHt: 'Dokiman voye', labelEn: 'Documents submitted' },
      under_review: { icon: 'fa-search', color: '#3b82f6', labelHt: 'Ap revize', labelEn: 'Under review' },
      verified: { icon: 'fa-check-circle', color: '#22c55e', labelHt: 'Verifye', labelEn: 'Verified' },
      rejected: { icon: 'fa-times-circle', color: '#ef4444', labelHt: 'Rejte', labelEn: 'Rejected' },
    };
    const config = statusConfig[status.status] || statusConfig.documents_submitted;

    return (
      <div style={{
        padding: 24,
        borderRadius: 12,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        textAlign: 'center',
      }}>
        <i className={`fas ${config.icon}`} style={{ fontSize: 48, color: config.color, marginBottom: 16 }} />
        <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>
          {lang === 'ht' ? config.labelHt : config.labelEn}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          {status.status === 'verified'
            ? t('Biznis ou verifye kounye a!', 'Your business is now verified!')
            : t('Dokiman ou yo ap tann revizyon.', 'Your documents are pending review.')}
        </p>
        {status.status === 'rejected' && status.review?.rejection_reason && (
          <div style={{
            padding: 12,
            borderRadius: 8,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            marginBottom: 16,
          }}>
            <strong style={{ color: '#ef4444' }}>{t('Rezon Rejè:', 'Rejection Reason:')}</strong>
            <p style={{ margin: '4px 0 0', fontSize: 13 }}>{status.review.rejection_reason}</p>
          </div>
        )}
      </div>
    );
  }

  // KYC Form
  return (
    <form onSubmit={handleSubmit} style={{
      padding: 24,
      borderRadius: 12,
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
    }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
        <i className="fas fa-shield-halved" style={{ marginRight: 8, color: '#3b82f6' }} />
        {t('Verifikasyon Idantite Biznis', 'Business Identity Verification')}
      </h3>

      {error && (
        <div style={{
          padding: 12,
          borderRadius: 8,
          background: '#fef2f2',
          border: '1px solid #fecaca',
          marginBottom: 16,
          color: '#ef4444',
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Legal Business Name */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
          {t('Non Legal Biznis', 'Legal Business Name')} *
        </label>
        <input
          type="text"
          value={form.legal_business_name}
          onChange={(e) => handleChange('legal_business_name', e.target.value)}
          required
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            fontSize: 14,
          }}
        />
      </div>

      {/* Registration Number */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
          {t('Nimewo Enskripsyon', 'Registration Number')} *
        </label>
        <input
          type="text"
          value={form.registration_number}
          onChange={(e) => handleChange('registration_number', e.target.value)}
          required
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            fontSize: 14,
          }}
        />
      </div>

      {/* Tax ID */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
          {t('Nimewo Fiskal', 'Tax ID')}
        </label>
        <input
          type="text"
          value={form.tax_id}
          onChange={(e) => handleChange('tax_id', e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            fontSize: 14,
          }}
        />
      </div>

      {/* Business Type */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
          {t('Type Biznis', 'Business Type')} *
        </label>
        <select
          value={form.business_type}
          onChange={(e) => handleChange('business_type', e.target.value)}
          required
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            fontSize: 14,
            background: 'var(--bg-primary)',
          }}
        >
          <option value="">{t('Chwazi...', 'Select...')}</option>
          {BUSINESS_TYPES.map(bt => (
            <option key={bt.value} value={bt.value}>
              {lang === 'ht' ? bt.labelHt : bt.labelEn}
            </option>
          ))}
        </select>
      </div>

      {/* Address */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            {t('Vil', 'City')}
          </label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => handleChange('city', e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--border-color)',
              fontSize: 14,
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            {t('Peyi', 'Country')}
          </label>
          <input
            type="text"
            value={form.country}
            onChange={(e) => handleChange('country', e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--border-color)',
              fontSize: 14,
            }}
          />
        </div>
      </div>

      {/* Owner Info */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
          {t('Non Legal Pwopriyetè', 'Owner Legal Name')}
        </label>
        <input
          type="text"
          value={form.owner_legal_name}
          onChange={(e) => handleChange('owner_legal_name', e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            fontSize: 14,
          }}
        />
      </div>

      {/* Terms */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.accepted_terms}
            onChange={(e) => handleChange('accepted_terms', e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          <span style={{ fontSize: 13 }}>
            {t('Mwen aksepte kondisyon yo epi mwen konfime enfòmasyon an verite', 'I accept the terms and confirm the information is true')}
          </span>
        </label>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: 8,
          border: 'none',
          background: submitting ? '#94a3b8' : '#3b82f6',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          cursor: submitting ? 'not-allowed' : 'pointer',
        }}
      >
        {submitting ? (
          <><i className="fas fa-spinner fa-spin" /> {t('Ap voye...', 'Submitting...')}</>
        ) : (
          <><i className="fas fa-paper-plane" /> {t('Voye pou Verifikasyon', 'Submit for Verification')}</>
        )}
      </button>
    </form>
  );
}
