/**
 * src/components/studio/modals/TalentFormModal.jsx
 *
 * Modal for creating/editing a talent. POST/PATCH to /api/explore/talents/.
 * Mirrors MusicUploadModal pattern.
 */
import React, { useState, useCallback } from 'react';
import { talentService } from '../../../services/api';
import { StudioModal, FormField, LoadingOverlay, HelpTip, MediaUrlField } from './shared';
import styles from './modals.module.css';

export default function TalentFormModal({ onClose, onSuccess, lang, showToast, talent }) {
  const isEdit = Boolean(talent);
  const [form, setForm] = useState({
    name: talent?.name || '',
    role: talent?.role || '',
    bio: talent?.bio || '',
    skills: Array.isArray(talent?.skills) ? talent.skills.join(', ') : '',
    location: talent?.location || '',
    avatar_url: talent?.avatar_url || talent?.avatar || '',
    contact_email: talent?.contact_email || '',
    contact_url: talent?.contact_url || '',
    // Default True on create so a brand-new talent is live immediately;
    // on edit we preserve the stored visibility.
    is_active: talent ? talent.is_active !== false : true,
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
  }, [errors]);

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = lang === 'ht' ? 'Non oblije' : 'Name required';
    if (!form.role.trim()) errs.role = lang === 'ht' ? 'Wòl oblije' : 'Role required';
    return errs;
  };

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);

    const payload = {
      name: form.name.trim(),
      role: form.role.trim(),
      bio: form.bio.trim() || undefined,
      skills: form.skills ? form.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
      location: form.location.trim() || undefined,
      avatar_url: form.avatar_url.trim() || undefined,
      contact_email: form.contact_email.trim() || undefined,
      contact_url: form.contact_url.trim() || undefined,
      is_active: Boolean(form.is_active),
    };

    try {
      if (isEdit) {
        await talentService.update(talent.id, payload);
      } else {
        await talentService.create(payload);
      }
      showToast?.(
        isEdit
          ? (lang === 'ht' ? '✅ Talan mete ajou!' : '✅ Talent updated!')
          : (lang === 'ht' ? '✅ Talan kreye!' : '✅ Talent created!'),
        'check-circle',
      );
      onSuccess?.(); onClose?.();
    } catch (err) {
      const detail = err?.response?.data?.detail
        || err?.response?.data?.name?.[0]
        || err?.response?.data?.role?.[0]
        || err?.message
        || (lang === 'ht' ? 'Pa t kapab sove talan an.' : 'Could not save talent.');
      setErrors((e) => ({ ...e, _api: detail }));
      showToast?.(detail, 'circle-exclamation');
    } finally { setLoading(false); }
  }, [form, isEdit, talent, lang, showToast, onSuccess, onClose]);

  return (
    <StudioModal onClose={onClose} icon="fa-star" wide
      title={isEdit
        ? (lang === 'ht' ? 'Modifye Talan' : 'Edit Talent')
        : (lang === 'ht' ? 'Kreye Talan' : 'Create Talent')}
      subtitle={lang === 'ht'
        ? 'Ajoute yon talan pou Explore'
        : 'Add a talent to the Explore catalog'}>
      <form onSubmit={handleSubmit} className={styles.form}>
        {errors._api && <div className={styles.apiError} role="alert">{errors._api}</div>}
        <LoadingOverlay loading={loading}>
          <FormField label={lang === 'ht' ? 'Non' : 'Name'} required error={errors.name}>
            <input className={styles.input} value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder={lang === 'ht' ? 'Antre non talan an' : 'Enter talent name'}
              maxLength={120} autoFocus />
          </FormField>
          <div className={styles.row}>
            <FormField label={lang === 'ht' ? 'Wòl' : 'Role'} required error={errors.role}>
              <input className={styles.input} value={form.role}
                onChange={(e) => handleChange('role', e.target.value)}
                placeholder={lang === 'ht' ? 'Chantè, Dansè...' : 'Singer, Dancer...'} />
            </FormField>
            <FormField label={lang === 'ht' ? 'Kote' : 'Location'}>
              <input className={styles.input} value={form.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder={lang === 'ht' ? 'Potoprens, Ayiti' : 'Port-au-Prince, Haiti'} />
            </FormField>
          </div>
          <FormField label={lang === 'ht' ? 'Biyo' : 'Bio'}>
            <textarea className={styles.textarea} value={form.bio}
              onChange={(e) => handleChange('bio', e.target.value)}
              placeholder={lang === 'ht' ? 'Dekri talan an...' : 'Describe the talent...'}
              rows={3} maxLength={1000} />
          </FormField>
          <FormField label={lang === 'ht' ? 'Konpetans (separe ak virgül)' : 'Skills (comma separated)'}
            hint={lang === 'ht' ? 'Egzanp: Chante, Danse, Mizik' : 'e.g. Singing, Dancing, Music'}>
            <div className={styles.inputWithHelp}>
              <input className={styles.input} value={form.skills}
                onChange={(e) => handleChange('skills', e.target.value)}
                placeholder={lang === 'ht' ? 'Chante, Danse, Mizik' : 'Singing, Dancing, Music'} />
              <HelpTip help={{
                ht: 'Konpetans yo parèt kòm ti etikèt sou kard talan an. Separe yo ak virgül pou plizyè konpetans. Egzanp: Chante, Konpozisyon, Gita.',
                en: 'Skills render as small chips on the talent card. Separate multiple ones with commas. e.g. Singing, Songwriting, Guitar.',
              }} lang={lang} />
            </div>
          </FormField>
          <MediaUrlField
            label={lang === 'ht' ? 'URL Avatè' : 'Avatar URL'}
            value={form.avatar_url}
            onChange={(v) => handleChange('avatar_url', v)}
            kind="image"
            lang={lang}
            hint={lang === 'ht' ? 'URL imaj avatè a' : 'Avatar image URL'}
            help={{
              ht: 'Kole yon URL imaj DIRÈK (.jpg, .png, .webp) — foto pwofil talan an. Yon foto kare (1:1) parèt pi byen sou kard la. Preview la ap parèt anba a pou w konfime li bon.',
              en: 'Paste a DIRECT image URL (.jpg, .png, .webp) — the talent profile photo. A square (1:1) photo renders best on the card. The live preview below lets you confirm it before saving.',
            }}
            placeholder="https://example.com/avatar.jpg"
          />
          <div className={styles.row}>
            <FormField label={lang === 'ht' ? 'Imèl Kontak' : 'Contact Email'}>
              <input className={styles.input} value={form.contact_email}
                onChange={(e) => handleChange('contact_email', e.target.value)}
                placeholder="email@example.com" type="email" />
            </FormField>
            <FormField label={lang === 'ht' ? 'Sit Web / URL' : 'Website / URL'}>
              <input className={styles.input} value={form.contact_url}
                onChange={(e) => handleChange('contact_url', e.target.value)}
                placeholder="https://..." type="url" />
            </FormField>
          </div>
          <div className={styles.toggleRow}>
            <span className={styles.toggleLabel}>
              {lang === 'ht' ? 'Vizibilite' : 'Visibility'}
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary, #888)', fontWeight: 400 }}>
                {form.is_active
                  ? (lang === 'ht' ? 'Vizib nan Explore' : 'Visible in Explore')
                  : (lang === 'ht' ? 'Kache (pa vizib)' : 'Hidden (not visible)')}
              </span>
            </span>
            <button
              type="button"
              className={`${styles.toggle} ${form.is_active ? styles.toggleOn : ''}`}
              onClick={() => handleChange('is_active', !form.is_active)}
              role="switch"
              aria-checked={form.is_active}
              aria-label={lang === 'ht' ? 'Vizibilite talan an' : 'Talent visibility'}
            >
              <span className={styles.toggleKnob} />
            </button>
          </div>
        </LoadingOverlay>
        <div className={styles.actions}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            {lang === 'ht' ? 'Anile' : 'Cancel'}
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <><i className="fas fa-spinner fa-spin" /> {lang === 'ht' ? 'Ap sove...' : 'Saving...'}</>
            ) : (
              <><i className="fas fa-save" /> {isEdit
                ? (lang === 'ht' ? 'Mete ajou' : 'Update')
                : (lang === 'ht' ? 'Kreye Talan' : 'Create Talent')}</>
            )}
          </button>
        </div>
      </form>
    </StudioModal>
  );
}
