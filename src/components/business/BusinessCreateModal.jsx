/**
 * src/components/business/BusinessCreateModal.jsx
 *
 * Business Profile setup wizard — the first step of the
 * "Creator → Create Business Profile → setup → workspace" flow.
 *
 * Phase Business: a Business Profile starts ACTIVE immediately (no
 * admin approval gate — unlike the curated CompanyProfile page), so
 * the user lands straight in their workspace after creation.
 *
 * Data flow
 * ---------
 *   POST /api/business/profiles/   — create (owner stamped from JWT)
 */
import React, { useState } from 'react';
import { businessProfileService } from '../../services/api';

export default function BusinessCreateModal({ lang = 'ht', t, showToast, onClose, onCreated }) {
  const isHt = lang === 'ht';
  const [form, setForm] = useState({ name: '', tagline: '', logo_url: '', description: '' });
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast?.(t?.business_name_required || (isHt ? 'Non biznis la obligatwa.' : 'Business name is required.'), 'circle-exclamation');
      return;
    }
    setSaving(true);
    try {
      const res = await businessProfileService.create({
        name: form.name.trim(),
        tagline: form.tagline.trim(),
        logo_url: form.logo_url.trim(),
        description: form.description.trim(),
      });
      const profile = res?.data?.data ?? res?.data ?? null;
      showToast?.(t?.business_created || (isHt ? '✅ Business Profile kreye!' : '✅ Business Profile created!'), 'check-circle');
      onCreated?.(profile);
    } catch (err) {
      const detail = err?.response?.data?.detail
        || err?.response?.data?.name?.[0]
        || err?.response?.data?.owner?.[0]
        || (isHt ? 'Pa t kapab kreye Business Profile la.' : 'Could not create the business profile.');
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="biz-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="biz-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t?.business_create || (isHt ? 'Kreye yon Business Profile' : 'Create a Business Profile')}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="biz-modal-header">
          <h3 className="biz-modal-title">
            <i className="fas fa-briefcase" aria-hidden="true" />
            {t?.business_create || (isHt ? 'Kreye yon Business Profile' : 'Create a Business Profile')}
          </h3>
          <button type="button" className="biz-modal-close" onClick={onClose} aria-label={isHt ? 'Fèmen' : 'Close'}>
            <i className="fas fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <p className="biz-modal-hint">
          {t?.business_creator_vs || (isHt
            ? '"Sa kisa biznis mwen opere" — se pa "kiyès mwen ye kòm kreatè."'
            : '"What business I operate" — not "who I am as a creator."')}
        </p>

        <form onSubmit={handleSubmit} className="biz-form" data-testid="business-create-form">
          <div className="biz-form-group">
            <label className="biz-form-label">
              {t?.business_field_name || (isHt ? 'Non biznis / brand' : 'Business / brand name')} *
            </label>
            <input
              type="text"
              className="biz-form-input"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              maxLength={120}
              placeholder={isHt ? 'Egzanp: Kreyatif Studio' : 'e.g. Creative Studio'}
              data-testid="business-create-name"
              required
              autoFocus
            />
          </div>

          <div className="biz-form-group">
            <label className="biz-form-label">
              {t?.business_field_tagline || (isHt ? 'Slogan / tagline' : 'Tagline')}
            </label>
            <input
              type="text"
              className="biz-form-input"
              value={form.tagline}
              onChange={(e) => set('tagline', e.target.value)}
              maxLength={200}
              placeholder={isHt ? 'Yon fraz ki dekri biznis ou' : 'One line that describes your business'}
            />
          </div>

          <div className="biz-form-group">
            <label className="biz-form-label">
              {t?.business_field_logo || (isHt ? 'Logo (URL)' : 'Logo (URL)')}
            </label>
            <input
              type="url"
              className="biz-form-input"
              value={form.logo_url}
              onChange={(e) => set('logo_url', e.target.value)}
              placeholder="https://…/logo.png"
            />
            {form.logo_url && (
              <img src={form.logo_url} alt="logo preview" loading="lazy"
                className="biz-logo-preview" />
            )}
          </div>

          <div className="biz-form-group">
            <label className="biz-form-label">
              {t?.business_field_description || (isHt ? 'Deskripsyon biznis' : 'Business description')}
            </label>
            <textarea
              className="biz-form-input"
              rows={4}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              maxLength={3000}
              placeholder={isHt ? 'Kisa biznis ou fè, pou kisa li egziste...' : 'What your business does, why it exists...'}
            />
          </div>

          <div className="biz-form-actions">
            <button type="button" className="biz-btn biz-btn-ghost" onClick={onClose} disabled={saving}>
              {isHt ? 'Anile' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="biz-btn biz-btn-primary"
              disabled={saving}
              data-testid="business-create-submit"
            >
              <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-rocket'}`} aria-hidden="true" />
              {saving
                ? (isHt ? 'Ap kreye...' : 'Creating...')
                : (t?.business_create || (isHt ? 'Kreye Business Profile' : 'Create Business Profile'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
