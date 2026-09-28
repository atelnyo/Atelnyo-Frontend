/**
 * src/components/business/BusinessSettingsSection.jsx
 *
 * Business identity settings — the owner edits their Business Profile
 * from inside the workspace. Slug stays stable on rename (backend
 * SluggedTitleMixin contract); status is NOT editable here (it changes
 * only via the workspace's deactivate/activate actions).
 *
 * Data flow
 * ---------
 *   PATCH /api/business/profiles/<id>/   — owner edit
 */
import React, { useState } from 'react';
import { businessProfileService } from '../../services/api';
import { BUSINESS_DAYS, businessDayLabel } from '../../utils/businessHours';

export default function BusinessSettingsSection({ lang = 'ht', t, showToast, profile, onSaved }) {
  const isHt = lang === 'ht';

  // Phase 9 — public contact & information fields.
  const DAYS = BUSINESS_DAYS;

  const [form, setForm] = useState({
    name: profile?.name || '',
    tagline: profile?.tagline || '',
    logo_url: profile?.logo_url || '',
    cover_url: profile?.cover_url || '',
    description: profile?.description || '',
    location: profile?.location || '',
    contact_email: profile?.contact_email || '',
    phone: profile?.phone || '',
    website_url: profile?.website_url || '',
    hours: { ...(profile?.hours || {}) },
  });
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setHours = (day, value) => setForm((prev) => ({
    ...prev,
    hours: { ...(prev.hours || {}), [day]: value },
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast?.(t?.business_name_required || (isHt ? 'Non biznis la obligatwa.' : 'Business name is required.'), 'circle-exclamation');
      return;
    }
    setSaving(true);
    try {
      // Phase 9 — clean the hours dict (drop empty entries) before
      // sending; the backend prunes + validates as well.
      const hours = Object.fromEntries(
        Object.entries(form.hours || {})
          .filter(([, v]) => (v || '').trim() !== '')
          .map(([k, v]) => [k, v.trim()]),
      );
      const res = await businessProfileService.update(profile.id, {
        name: form.name.trim(),
        tagline: form.tagline.trim(),
        logo_url: form.logo_url.trim(),
        cover_url: form.cover_url.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        contact_email: form.contact_email.trim(),
        phone: form.phone.trim(),
        website_url: form.website_url.trim(),
        hours,
      });
      const updated = res?.data?.data ?? res?.data ?? null;
      showToast?.(t?.business_saved || (isHt ? '✅ Business Profile mete ajou!' : '✅ Business Profile updated!'), 'check-circle');
      onSaved?.(updated);
    } catch (err) {
      const detail = err?.response?.data?.detail
        || err?.response?.data?.name?.[0]
        || (isHt ? 'Pa t kapab sove Business Profile la.' : 'Could not save the business profile.');
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="biz-form" data-testid="business-settings-form">
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
          data-testid="business-settings-name"
          required
        />
        <p className="biz-form-hint">
          {t?.business_slug_hint || (isHt
            ? 'Slug la fiks apre kreyasyon — chanje non an pa chanje URL la.'
            : 'The slug is fixed after creation — renaming never breaks the URL.')}
        </p>
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

      <div className="biz-form-row">
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
            <img src={form.logo_url} alt="logo preview" loading="lazy" className="biz-logo-preview" />
          )}
        </div>
        <div className="biz-form-group">
          <label className="biz-form-label">
            {t?.business_field_cover || (isHt ? 'Kouvèti (URL)' : 'Cover (URL)')}
          </label>
          <input
            type="url"
            className="biz-form-input"
            value={form.cover_url}
            onChange={(e) => set('cover_url', e.target.value)}
            placeholder="https://…/cover.png"
          />
        </div>
      </div>

      <div className="biz-form-group">
        <label className="biz-form-label">
          {t?.business_field_description || (isHt ? 'Deskripsyon biznis' : 'Business description')}
        </label>
        <textarea
          className="biz-form-input"
          rows={5}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          maxLength={3000}
          placeholder={isHt ? 'Kisa biznis ou fè, pou kisa li egziste...' : 'What your business does, why it exists...'}
        />
      </div>

      {/* ─── Public contact & information (Phase 9) ───────────── */}
      <fieldset className="biz-form-fieldset" data-testid="business-settings-contact">
        <legend className="biz-form-fieldset-title">
          <i className="fas fa-address-card" aria-hidden="true" />
          {t?.business_section_contact_info || (isHt
            ? 'Enfòmasyon kontak piblik'
            : 'Public contact & information')}
        </legend>
        <p className="biz-form-hint">
          {t?.business_contact_info_hint || (isHt
            ? 'Enfòmasyon sa yo ap parèt sou paj piblik biznis ou — se biznis la, pa enfòmasyon pèsonèl kont ou.'
            : 'This info appears on your public business page — it is the business\'s, never your account\'s personal data.')}
        </p>

        <div className="biz-form-group">
          <label className="biz-form-label" htmlFor="biz-settings-location">
            {t?.business_field_location || (isHt ? 'Kote / zòn sèvis' : 'Location / service area')}
          </label>
          <input
            id="biz-settings-location"
            type="text"
            className="biz-form-input"
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
            maxLength={120}
            placeholder={isHt ? 'Egzanp: Pòtoprens, HT' : 'e.g. Port-au-Prince, HT'}
            data-testid="business-settings-location"
          />
        </div>

        <div className="biz-form-row">
          <div className="biz-form-group">
            <label className="biz-form-label" htmlFor="biz-settings-email">
              {t?.business_field_contact_email || (isHt ? 'Imèl kontak' : 'Contact email')}
            </label>
            <input
              id="biz-settings-email"
              type="email"
              className="biz-form-input"
              value={form.contact_email}
              onChange={(e) => set('contact_email', e.target.value)}
              placeholder="hello@brand.test"
              data-testid="business-settings-email"
            />
          </div>
          <div className="biz-form-group">
            <label className="biz-form-label" htmlFor="biz-settings-phone">
              {t?.business_field_phone || (isHt ? 'Telefòn' : 'Phone')}
            </label>
            <input
              id="biz-settings-phone"
              type="tel"
              className="biz-form-input"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              maxLength={40}
              placeholder="+509 …"
              data-testid="business-settings-phone"
            />
          </div>
        </div>

        <div className="biz-form-group">
          <label className="biz-form-label" htmlFor="biz-settings-website">
            {t?.business_field_website || (isHt ? 'Sit wèb' : 'Website')}
          </label>
          <input
            id="biz-settings-website"
            type="url"
            className="biz-form-input"
            value={form.website_url}
            onChange={(e) => set('website_url', e.target.value)}
            placeholder="https://brand.test"
            data-testid="business-settings-website"
          />
        </div>

        {/* ─── Operating hours editor ─────────────────────── */}
        <div className="biz-form-group">
          <span className="biz-form-label">
            {t?.business_field_hours || (isHt ? 'Èdtan operasyon' : 'Operating hours')}
          </span>
          <div className="biz-hours-editor" data-testid="business-settings-hours">
            {DAYS.map((day) => (
              <div className="biz-hours-row" key={day}>
                <label className="biz-hours-day" htmlFor={`biz-hours-${day}`}>
                  {businessDayLabel(day, lang)}
                </label>
                <input
                  id={`biz-hours-${day}`}
                  type="text"
                  className="biz-form-input"
                  value={form.hours?.[day] || ''}
                  onChange={(e) => setHours(day, e.target.value)}
                  maxLength={40}
                  placeholder={isHt ? 'Fèmen' : 'Closed'}
                  data-testid={`business-settings-hours-${day}`}
                />
              </div>
            ))}
          </div>
        </div>
      </fieldset>

      <div className="biz-form-actions">
        <button
          type="submit"
          className="biz-btn biz-btn-primary"
          disabled={saving}
          data-testid="business-settings-submit"
        >
          <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`} aria-hidden="true" />
          {saving
            ? (isHt ? 'Ap sove...' : 'Saving...')
            : (t?.business_save || (isHt ? 'Sove' : 'Save'))}
        </button>
      </div>
    </form>
  );
}
