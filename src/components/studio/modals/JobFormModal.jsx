/**
 * src/components/studio/modals/JobFormModal.jsx
 *
 * Modal for creating/editing a job post. POST/PATCH to /api/jobs/.
 * Mirrors TalentFormModal pattern.
 */
import React, { useState, useCallback } from 'react';
import { jobService } from '../../../services/api';
import { StudioModal, FormField, LoadingOverlay, HelpTip, MediaUrlField, HELP_COPY } from './shared';
import styles from './modals.module.css';

export default function JobFormModal({ onClose, onSuccess, lang, showToast, job }) {
  const isEdit = Boolean(job);
  const [form, setForm] = useState({
    title: job?.title || '',
    description: job?.description || '',
    budget_type: job?.budget_type || 'fixed',
    budget_min: job?.budget_min != null ? String(job.budget_min) : '',
    budget_max: job?.budget_max != null ? String(job.budget_max) : '',
    currency: job?.currency || 'USD',
    cover_url: job?.cover_url || '',
    skills_required: Array.isArray(job?.skills_required) ? job.skills_required.join(', ') : '',
    is_remote: job?.is_remote ?? false,
    location: job?.location || '',
    visibility: job?.visibility || 'public',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
  }, [errors]);

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = lang === 'ht' ? 'Tit oblije' : 'Title required';
    if (!form.description.trim()) errs.description = lang === 'ht' ? 'Deskripsyon oblije' : 'Description required';
    const min = Number(form.budget_min);
    const max = Number(form.budget_max);
    if (!Number.isFinite(min) || min < 0) errs.budget_min = lang === 'ht' ? 'Budjè min envalid' : 'Invalid min budget';
    if (!Number.isFinite(max) || max < 0) errs.budget_max = lang === 'ht' ? 'Budjè max envalid' : 'Invalid max budget';
    if (Number.isFinite(min) && Number.isFinite(max) && max < min) {
      errs.budget_max = lang === 'ht' ? 'Max dwe >= min' : 'Max must be >= min';
    }
    return errs;
  };

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      budget_type: form.budget_type,
      budget_min: Number(form.budget_min),
      budget_max: Number(form.budget_max),
      currency: form.currency.trim() || 'USD',
      cover_url: form.cover_url.trim(),
      skills_required: form.skills_required ? form.skills_required.split(',').map((s) => s.trim()).filter(Boolean) : [],
      is_remote: Boolean(form.is_remote),
      location: form.location.trim() || '',
      visibility: form.visibility,
    };

    try {
      if (isEdit) {
        await jobService.update(job.id, payload);
      } else {
        await jobService.create(payload);
      }
      showToast?.(
        isEdit
          ? (lang === 'ht' ? '✅ Travay mete ajou!' : '✅ Job updated!')
          : (lang === 'ht' ? '✅ Travay kreye!' : '✅ Job created!'),
        'check-circle',
      );
      onSuccess?.(); onClose?.();
    } catch (err) {
      const detail = err?.response?.data?.detail
        || err?.response?.data?.title?.[0]
        || err?.response?.data?.budget_max?.[0]
        || err?.message
        || (lang === 'ht' ? 'Pa t kapab sove travay la.' : 'Could not save job.');
      setErrors((e) => ({ ...e, _api: detail }));
      showToast?.(detail, 'circle-exclamation');
    } finally { setLoading(false); }
  }, [form, isEdit, job, lang, showToast, onSuccess, onClose]);

  return (
    <StudioModal onClose={onClose} icon="fa-briefcase" wide
      title={isEdit
        ? (lang === 'ht' ? 'Modifye Travay' : 'Edit Job')
        : (lang === 'ht' ? 'Kreye Travay' : 'Create Job')}
      subtitle={lang === 'ht'
        ? 'Pibliye yon travay pou Explore'
        : 'Publish a job to the Explore catalog'}>
      <form onSubmit={handleSubmit} className={styles.form}>
        {errors._api && <div className={styles.apiError} role="alert">{errors._api}</div>}
        <LoadingOverlay loading={loading}>
          <FormField label={lang === 'ht' ? 'Tit' : 'Title'} required error={errors.title}>
            <input className={styles.input} value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder={lang === 'ht' ? 'Antre tit travay la' : 'Enter job title'}
              maxLength={200} autoFocus />
          </FormField>
          <FormField label={lang === 'ht' ? 'Deskripsyon' : 'Description'} required error={errors.description}>
            <textarea className={styles.textarea} value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder={lang === 'ht' ? 'Dekri travay la...' : 'Describe the job...'}
              rows={4} maxLength={3000} />
          </FormField>
          <MediaUrlField
            label={lang === 'ht' ? 'Imaj Kouvèti' : 'Cover Image'}
            value={form.cover_url}
            onChange={(v) => handleChange('cover_url', v)}
            kind="image"
            lang={lang}
            hint={lang === 'ht' ? 'Opsyonèl — yon kouvèti fè travay ou parèt pi byen' : 'Optional — a cover makes your job stand out'}
            help={HELP_COPY.cover}
            placeholder="https://example.com/cover.jpg"
          />
          <div className={styles.row}>
            <FormField label={lang === 'ht' ? 'Kalite Budjè' : 'Budget Type'}>
              <select className={styles.input} value={form.budget_type}
                onChange={(e) => handleChange('budget_type', e.target.value)}>
                <option value="fixed">{lang === 'ht' ? 'Fiks' : 'Fixed price'}</option>
                <option value="hourly">{lang === 'ht' ? 'Pa èdtan' : 'Hourly'}</option>
              </select>
            </FormField>
            <FormField label={lang === 'ht' ? 'Deviz' : 'Currency'}>
              <input className={styles.input} value={form.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                maxLength={3} placeholder="USD" />
            </FormField>
          </div>
          <div className={styles.row}>
            <FormField label={lang === 'ht' ? 'Budjè Min' : 'Budget Min'} required error={errors.budget_min}>
              <input className={styles.input} type="number" min="0" step="0.01"
                value={form.budget_min}
                onChange={(e) => handleChange('budget_min', e.target.value)}
                placeholder="100" />
            </FormField>
            <FormField label={lang === 'ht' ? 'Budjè Max' : 'Budget Max'} required error={errors.budget_max}>
              <input className={styles.input} type="number" min="0" step="0.01"
                value={form.budget_max}
                onChange={(e) => handleChange('budget_max', e.target.value)}
                placeholder="300" />
            </FormField>
          </div>
          <FormField label={lang === 'ht' ? 'Konpetans nesesè (separe ak virgül)' : 'Required skills (comma separated)'}
            hint={lang === 'ht' ? 'Egzanp: React, Python, Dizayn' : 'e.g. React, Python, Design'}>
            <div className={styles.inputWithHelp}>
              <input className={styles.input} value={form.skills_required}
                onChange={(e) => handleChange('skills_required', e.target.value)}
                placeholder="React, Python, Design" />
              <HelpTip help={{
                ht: 'Konpetans ki nesesè pou travay la. Yo parèt sou kard la pou moun ki kalifye ka jwenn travay ou fasilman. Separe yo ak virgül.',
                en: 'The skills required for the job. They appear on the card so qualified people can find your job easily. Separate them with commas.',
              }} lang={lang} />
            </div>
          </FormField>
          <div className={styles.row}>
            <FormField label={lang === 'ht' ? 'Kote' : 'Location'}>
              <input className={styles.input} value={form.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder={lang === 'ht' ? 'Potoprens, Ayiti' : 'Port-au-Prince, Haiti'} />
            </FormField>
            <FormField label={lang === 'ht' ? 'Vizibilite' : 'Visibility'}>
              <select className={styles.input} value={form.visibility}
                onChange={(e) => handleChange('visibility', e.target.value)}>
                <option value="public">{lang === 'ht' ? 'Piblik' : 'Public'}</option>
                <option value="community">{lang === 'ht' ? 'Kominote' : 'Community'}</option>
              </select>
            </FormField>
          </div>
          <div className={styles.toggleRow}>
            <span className={styles.toggleLabel}>
              {lang === 'ht' ? 'Travay a distans' : 'Remote job'}
            </span>
            <button
              type="button"
              className={`${styles.toggle} ${form.is_remote ? styles.toggleOn : ''}`}
              onClick={() => handleChange('is_remote', !form.is_remote)}
              role="switch"
              aria-checked={form.is_remote}
              aria-label={lang === 'ht' ? 'Travay a distans' : 'Remote job'}
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
                : (lang === 'ht' ? 'Kreye Travay' : 'Create Job')}</>
            )}
          </button>
        </div>
      </form>
    </StudioModal>
  );
}
