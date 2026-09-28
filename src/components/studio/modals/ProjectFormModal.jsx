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

export default function ProjectFormModal({ onClose, onSuccess, lang, showToast, item }) {
  const isEdit = Boolean(item);
  const [form, setForm] = useState({
    title: item?.title || '', description: item?.description || '', category: item?.category || '', project_url: item?.project_url || '', cover_url: item?.cover_url || '',
    // Phase 60 — follower-gated content: 'public' or 'followers'.
    visibility: item?.visibility || 'public',
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
    return errs;
  };

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    try {
if (isEdit) {
        await portfolioService.update(item.id, {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          category: form.category || undefined,
          project_url: form.project_url.trim() || undefined,
          cover_url: form.cover_url.trim() || undefined,
          visibility: form.visibility || 'public',
        });
      } else {
        await api.post('portfolio/projects/', {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          category: form.category || undefined,
          project_url: form.project_url.trim() || undefined,
          cover_url: form.cover_url.trim() || undefined,
          visibility: form.visibility || 'public',
        });
      }
      showToast?.(
        isEdit
          ? (lang === 'ht' ? '✅ Pwojè mete ajou!' : '✅ Project updated!')
          : (lang === 'ht' ? '✅ Pwojè ajoute avèk siksè!' : '✅ Project added successfully!'),
        'check-circle',
      );
      onSuccess?.(); onClose?.();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.title?.[0]
        || err?.message
        || (lang === 'ht' ? 'Pa t kapab ajoute pwojè a.' : 'Could not add project.');
      setErrors((e) => ({ ...e, _api: detail }));
      showToast?.(detail, 'circle-exclamation');
    } finally { setLoading(false); }
  }, [form, lang, showToast, onSuccess, onClose]);

  return (
    <StudioModal onClose={onClose} icon="fa-briefcase"
      title={lang === 'ht' ? 'Ajoute yon Pwojè' : 'Add a Project'}
      subtitle={isEdit
        ? (lang === 'ht' ? 'Modifye pwojè a' : 'Edit this project')
        : (lang === 'ht' ? 'Montre travay ou nan pòtfolyo ou' : 'Showcase your work in your portfolio')}>
      <form onSubmit={handleSubmit} className={styles.form}>
        {errors._api && <div className={styles.apiError} role="alert">{errors._api}</div>}
        {isEdit && (
          <div className={styles.editBanner}>
            <i className="fas fa-pen" aria-hidden="true" /> {lang === 'ht' ? 'Ap modifye' : 'Editing'} <strong>{form.title}</strong>
          </div>
        )}
        <LoadingOverlay loading={loading}>
          <FormSection
            icon="fa-info-circle"
            title={lang === 'ht' ? 'Enfòmasyon Pwojè' : 'Project Information'}
            hint={lang === 'ht' ? 'Ki travay sa a?' : 'What is this work?'}
          >
            <FormField label={lang === 'ht' ? 'Tit' : 'Title'} required error={errors.title}>
              <input className={styles.input} value={form.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder={lang === 'ht' ? 'Non pwojè a' : 'Project name'}
                maxLength={200} autoFocus />
            </FormField>
            <FormField label={lang === 'ht' ? 'Kategori' : 'Category'}>
              <input className={styles.input} value={form.category}
                onChange={(e) => handleChange('category', e.target.value)}
                placeholder={lang === 'ht' ? 'Web, Design, Mizik...' : 'Web, Design, Music...'} />
            </FormField>
            <FormField label={lang === 'ht' ? 'Deskripsyon' : 'Description'}>
              <textarea className={styles.textarea} value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder={lang === 'ht' ? 'Dekri pwojè a...' : 'Describe the project...'}
                rows={4} maxLength={5000} />
            </FormField>
          </FormSection>

          <FormSection
            icon="fa-link"
            title={lang === 'ht' ? 'Lyen & Kouvèti' : 'Links & Cover'}
            hint={lang === 'ht' ? 'Kote moun ka wè pwojè a ak kouvèti li.' : 'Where people can see the project and its cover.'}
          >
            <FieldTip>
              {lang === 'ht'
                ? 'Ou ka mete yon lyen GitHub, yon sit, oswa yon videyo YouTube/Vimeo/Facebook/TikTok kòm pwojè.'
                : 'You can use a GitHub link, a live site, or a YouTube/Vimeo/Facebook/TikTok video as the project.'}
            </FieldTip>
            <FormField label={lang === 'ht' ? 'URL Pwojè' : 'Project URL'}
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
              label={lang === 'ht' ? 'URL Kouvèti' : 'Cover URL'}
              value={form.cover_url}
              onChange={(v) => handleChange('cover_url', v)}
              placeholder="https://example.com/project.jpg"
              lang={lang}
              hint={lang === 'ht'
                ? 'Kole yon URL imaj DIREK (.jpg, .png, .webp) — pa yon paj galri.'
                : 'Paste a DIRECT image URL (.jpg, .png, .webp) — not a gallery page.'}
              help={HELP_COPY.cover}
            />
          </FormSection>

          <FormSection
            icon="fa-user-lock"
            title={lang === 'ht' ? 'Piblik' : 'Visibility'}
            hint={lang === 'ht' ? 'Ki moun ka wè pwojè sa a?' : 'Who can see this project?'}
          >
            <label className={styles.toggleRow}>
              <span>
                <strong>{lang === 'ht' ? 'Abonè sèlman (gratis)' : 'Followers only (free)'}</strong>
                <small>{lang === 'ht'
                  ? 'Sèlman ou menm ak moun k ap swiv ou ka wè l.'
                  : 'Only you and the people following you can see it.'}</small>
              </span>
              <input
                type="checkbox"
                checked={form.visibility === 'followers'}
                onChange={(e) => handleChange('visibility', e.target.checked ? 'followers' : 'public')}
              />
            </label>
            <label className={styles.toggleRow}>
              <span>
                <strong>{lang === 'ht' ? 'Abonè peyan sèlman' : 'Subscribers only (paid)'}</strong>
                <small>{lang === 'ht'
                  ? 'Sèlman abonè peyan yo ka wè l — ou bezwen mete yon pri abònman nan Anviwònman Pwofil.'
                  : 'Only paid subscribers can see it — set a subscription price in Profile Settings.'}</small>
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
            {lang === 'ht' ? 'Anile' : 'Cancel'}
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <><i className="fas fa-spinner fa-spin" /> {lang === 'ht' ? 'Ap sove...' : 'Saving...'}</>
            ) : (
              <><i className={`fas ${isEdit ? 'fa-save' : 'fa-plus'}`} /> {isEdit
                ? (lang === 'ht' ? 'Mete ajou' : 'Update')
                : (lang === 'ht' ? 'Ajoute Pwojè' : 'Add Project')}</>
            )}
          </button>
        </div>
      </form>
    </StudioModal>
  );
}
