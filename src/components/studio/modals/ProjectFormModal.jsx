/**
 * src/components/studio/modals/ProjectFormModal.jsx
 *
 * Modal for adding a portfolio project. POSTs to /api/portfolio/projects/.
 *
 * Extracted from StudioModals.jsx during Etap 3 refactor.
 */
import React, { useState, useCallback } from 'react';
import api, { portfolioService } from '../../../services/api';
import {
  StudioModal, FormField, FormSection, ImageUrlField,
  LoadingOverlay, HelpTip, FieldTip, HELP_COPY,
} from './shared';
import styles from './modals.module.css';
import { inlineText } from '../../../utils/inlineI18n';

export default function ProjectFormModal({ onClose, onSuccess, lang, showToast, item }) {
  const isEdit = Boolean(item);
  const [form, setForm] = useState({
    title: item?.title || '', description: item?.description || '', category: item?.category || '', project_url: item?.project_url || '', cover_url: item?.cover_url || '',
    // Phase 60 — follower-gated content: 'public' or 'followers'.
    visibility: item?.visibility || 'public',
    source_url: item?.source_url || '',
    skills_used: Array.isArray(item?.skills_used) ? item.skills_used.join(', ') : '',
    difficulty: item?.difficulty || 'intermediate',
    completion_date: item?.completion_date || '',
    is_published: item?.is_published ?? true,
  });
  const payload = () => ({
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    category: form.category || undefined,
    project_url: form.project_url.trim() || undefined,
    cover_url: form.cover_url.trim() || undefined,
    visibility: form.visibility || 'public',
    source_url: form.source_url.trim() || undefined,
    skills_used: form.skills_used ? form.skills_used.split(',').map((s) => s.trim()).filter(Boolean) : [],
    difficulty: form.difficulty,
    completion_date: form.completion_date || null,
    is_published: Boolean(form.is_published),
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
  }, [errors]);

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = lang === 'ht' ? 'Tit oblije' : inlineText(lang, 'Title required');
    return errs;
  };

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    try {
if (isEdit) {
        await portfolioService.update(item.id, payload());
      } else {
        await api.post('portfolio/projects/', payload());
      }
      showToast?.(
        isEdit
          ? (lang === 'ht' ? '✅ Pwojè mete ajou!' : inlineText(lang, '✅ Project updated!'))
          : (lang === 'ht' ? '✅ Pwojè ajoute avèk siksè!' : inlineText(lang, '✅ Project added successfully!')),
        'check-circle',
      );
      onSuccess?.(); onClose?.();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.title?.[0]
        || err?.message
        || (lang === 'ht' ? 'Pa t kapab ajoute pwojè a.' : inlineText(lang, 'Could not add project.'));
      setErrors((e) => ({ ...e, _api: detail }));
      showToast?.(detail, 'circle-exclamation');
    } finally { setLoading(false); }
  }, [form, lang, showToast, onSuccess, onClose]);

  return (
    <StudioModal onClose={onClose} icon="fa-briefcase"
      title={lang === 'ht' ? 'Ajoute yon Pwojè' : inlineText(lang, 'Add a Project')}
      subtitle={isEdit
        ? (lang === 'ht' ? 'Modifye pwojè a' : inlineText(lang, 'Edit this project'))
        : (lang === 'ht' ? 'Montre travay ou nan pòtfolyo ou' : inlineText(lang, 'Showcase your work in your portfolio'))}>
      <form onSubmit={handleSubmit} className={styles.form}>
        {errors._api && <div className={styles.apiError} role="alert">{errors._api}</div>}
        {isEdit && (
          <div className={styles.editBanner}>
            <i className="fas fa-pen" aria-hidden="true" /> {lang === 'ht' ? 'Ap modifye' : inlineText(lang, 'Editing')} <strong>{form.title}</strong>
          </div>
        )}
        <LoadingOverlay loading={loading}>
          <FormSection
            icon="fa-info-circle"
            title={lang === 'ht' ? 'Enfòmasyon Pwojè' : inlineText(lang, 'Project Information')}
            hint={lang === 'ht' ? 'Ki travay sa a?' : inlineText(lang, 'What is this work?')}
          >
            <FormField label={lang === 'ht' ? 'Tit' : inlineText(lang, 'Title')} required error={errors.title}>
              <input className={styles.input} value={form.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder={lang === 'ht' ? 'Non pwojè a' : inlineText(lang, 'Project name')}
                maxLength={200} autoFocus />
            </FormField>
            <FormField label={lang === 'ht' ? 'Kategori' : inlineText(lang, 'Category')}>
              <input className={styles.input} value={form.category}
                onChange={(e) => handleChange('category', e.target.value)}
                placeholder={lang === 'ht' ? 'Web, Design, Mizik...' : inlineText(lang, 'Web, Design, Music...')} />
            </FormField>
            <FormField label={lang === 'ht' ? 'Deskripsyon' : inlineText(lang, 'Description')}>
              <textarea className={styles.textarea} value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder={lang === 'ht' ? 'Dekri pwojè a...' : inlineText(lang, 'Describe the project...')}
                rows={4} maxLength={5000} />
            </FormField>
          </FormSection>

          <FormSection
            icon="fa-link"
            title={lang === 'ht' ? 'Lyen & Kouvèti' : inlineText(lang, 'Links & Cover')}
            hint={lang === 'ht' ? 'Kote moun ka wè pwojè a ak kouvèti li.' : inlineText(lang, 'Where people can see the project and its cover.')}
          >
            <FieldTip>
              {lang === 'ht'
                ? 'Ou ka mete yon lyen GitHub, yon sit, oswa yon videyo YouTube/Vimeo/Facebook/TikTok kòm pwojè.'
                : inlineText(lang, 'You can use a GitHub link, a live site, or a YouTube/Vimeo/Facebook/TikTok video as the project.')}
            </FieldTip>
            <FormField label={lang === 'ht' ? 'URL Pwojè' : inlineText(lang, 'Project URL')}
              hint="GitHub, live site, etc.">
              <div className={styles.inputWithHelp}>
                <input className={styles.input} value={form.project_url}
                  onChange={(e) => handleChange('project_url', e.target.value)}
                  placeholder="https://github.com/..." />
                <HelpTip help={{
                  ht: 'Lyen kote moun ka wè pwojè a an vre: yon depo GitHub, yon sit sou entènèt, yon demonstrasyon. Ou ka mete yon videyo YouTube/Vimeo/Facebook/TikTok tou si se sa pwojè a ye — l ap jwe kòm demo sou kard la (hover) ak paj detay la.',
                  en: 'The link where people can see the real project: a GitHub repo, a live site, a demo. You can also paste a YouTube/Vimeo/Facebook/TikTok video if that is the project — it plays as the demo on the card (hover) and the detail page.',
                }} lang={lang} />
              </div>
            </FormField>
            <ImageUrlField
              label={lang === 'ht' ? 'URL Kouvèti' : inlineText(lang, 'Cover URL')}
              value={form.cover_url}
              onChange={(v) => handleChange('cover_url', v)}
              placeholder="https://example.com/project.jpg"
              lang={lang}
              hint={lang === 'ht'
                ? 'Kole yon URL imaj DIREK (.jpg, .png, .webp) — pa yon paj galri.'
                : inlineText(lang, 'Paste a DIRECT image URL (.jpg, .png, .webp) — not a gallery page.')}
              help={HELP_COPY.cover}
            />
          </FormSection>

          <FormSection
            icon="fa-code"
            title={lang === 'ht' ? 'Detay Pwojè' : inlineText(lang, 'Project Details')}
            hint={lang === 'ht' ? 'Lyen sous, konpetans, nivo ak dat.' : inlineText(lang, 'Source link, skills, level and date.')}
          >
            <FormField label={lang === 'ht' ? 'URL Sous (GitHub)' : inlineText(lang, 'Source URL (GitHub)')}>
              <input className={styles.input} value={form.source_url}
                onChange={(e) => handleChange('source_url', e.target.value)}
                placeholder="https://github.com/..." />
            </FormField>
            <FormField label={lang === 'ht' ? 'Konpetans (separe ak virgül)' : inlineText(lang, 'Skills (comma separated)')}>
              <input className={styles.input} value={form.skills_used}
                onChange={(e) => handleChange('skills_used', e.target.value)}
                placeholder={lang === 'ht' ? 'React, Django, Design...' : inlineText(lang, 'React, Django, Design...')} />
            </FormField>
            <FormField label={lang === 'ht' ? 'Nivo' : inlineText(lang, 'Difficulty')}>
              <select className={styles.input} value={form.difficulty}
                onChange={(e) => handleChange('difficulty', e.target.value)}>
                <option value="beginner">{lang === 'ht' ? 'Debitan' : inlineText(lang, 'Beginner')}</option>
                <option value="intermediate">{lang === 'ht' ? 'Mwayen' : inlineText(lang, 'Intermediate')}</option>
                <option value="advanced">{lang === 'ht' ? 'Avanse' : inlineText(lang, 'Advanced')}</option>
                <option value="expert">{lang === 'ht' ? 'Ekspè' : inlineText(lang, 'Expert')}</option>
              </select>
            </FormField>
            <FormField label={lang === 'ht' ? 'Dat finalizasyon' : inlineText(lang, 'Completion date')}>
              <input type="date" className={styles.input} value={form.completion_date}
                onChange={(e) => handleChange('completion_date', e.target.value)} />
            </FormField>
            <label className={styles.toggleRow}>
              <span>
                <strong>{lang === 'ht' ? 'Pibliye' : inlineText(lang, 'Published')}</strong>
                <small>{lang === 'ht'
                  ? 'Si w etenn li, pwojè a kache (bouyon).'
                  : inlineText(lang, 'When off, the project is hidden (draft).')}</small>
              </span>
              <input
                type="checkbox"
                checked={Boolean(form.is_published)}
                onChange={(e) => handleChange('is_published', e.target.checked)}
              />
            </label>
          </FormSection>

          <FormSection
            icon="fa-user-lock"
            title={lang === 'ht' ? 'Piblik' : inlineText(lang, 'Visibility')}
            hint={lang === 'ht' ? 'Ki moun ka wè pwojè sa a?' : inlineText(lang, 'Who can see this project?')}
          >
            <label className={styles.toggleRow}>
              <span>
                <strong>{lang === 'ht' ? 'Abonè sèlman (gratis)' : inlineText(lang, 'Followers only (free)')}</strong>
                <small>{lang === 'ht'
                  ? 'Sèlman ou menm ak moun k ap swiv ou ka wè l.'
                  : inlineText(lang, 'Only you and the people following you can see it.')}</small>
              </span>
              <input
                type="checkbox"
                checked={form.visibility === 'followers'}
                onChange={(e) => handleChange('visibility', e.target.checked ? 'followers' : 'public')}
              />
            </label>
            <label className={styles.toggleRow}>
              <span>
                <strong>{lang === 'ht' ? 'Abonè peyan sèlman' : inlineText(lang, 'Subscribers only (paid)')}</strong>
                <small>{lang === 'ht'
                  ? 'Sèlman abonè peyan yo ka wè l — ou bezwen mete yon pri abònman nan Anviwònman Pwofil.'
                  : inlineText(lang, 'Only paid subscribers can see it — set a subscription price in Profile Settings.')}</small>
              </span>
              <input
                type="checkbox"
                checked={form.visibility === 'subscribers'}
                onChange={(e) => handleChange('visibility', e.target.checked ? 'subscribers' : 'public')}
              />
            </label>
          </FormSection>
        </LoadingOverlay>
        <div className={styles.actions}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            {lang === 'ht' ? 'Anile' : inlineText(lang, 'Cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <><i className="fas fa-spinner fa-spin" /> {lang === 'ht' ? 'Ap sove...' : inlineText(lang, 'Saving...')}</>
            ) : (
              <><i className={`fas ${isEdit ? 'fa-save' : 'fa-plus'}`} /> {isEdit
                ? (lang === 'ht' ? 'Mete ajou' : inlineText(lang, 'Update'))
                : (lang === 'ht' ? 'Ajoute Pwojè' : inlineText(lang, 'Add Project'))}</>
            )}
          </button>
        </div>
      </form>
    </StudioModal>
  );
}
