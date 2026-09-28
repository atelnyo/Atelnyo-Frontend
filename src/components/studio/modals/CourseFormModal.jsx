/**
 * src/components/studio/modals/CourseFormModal.jsx
 *
 * Modal for creating a new course. Validates title, description, price.
 * POSTs to /api/courses/.
 *
 * Extracted from StudioModals.jsx during Etap 3 refactor; professionalized
 * with FormSection grouping + the shared ImageUrlField during the Creator
 * Studio creation-UI pass.
 */
import React, { useState, useCallback } from 'react';
import api, { courseService } from '../../../services/api';
import {
  StudioModal, FormField, FormSection, ImageUrlField,
  LoadingOverlay, MediaUrlField, HelpTip, FieldTip, HELP_COPY,
} from './shared';
import { parseHashtags, hashtagsToInput } from '../../../utils/hashtags';
import styles from './modals.module.css';

export default function CourseFormModal({ onClose, onSuccess, lang, showToast, item }) {
  const isEdit = Boolean(item);
  const [form, setForm] = useState({
    title: item?.title || '', description: item?.description || '', price: item?.price ?? '', category: item?.category || '',
    difficulty: item?.difficulty || 'beginner', image_url: item?.image_url || '',
    video_url: item?.video_url || '',
    hashtags: hashtagsToInput(item?.tags),
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
    if (!form.description.trim() || form.description.trim().length < 20) {
      errs.description = lang === 'ht'
        ? 'Deskripsyon an dwe gen 20 karaktè minimòm'
        : 'Description must be at least 20 characters';
    }
    if (form.price && isNaN(Number(form.price))) {
      errs.price = lang === 'ht' ? 'Pri a pa valab' : 'Invalid price';
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
        title: form.title.trim(),
        description: form.description.trim(),
        tags: parseHashtags(form.hashtags),
        price: form.price ? Number(form.price) : 0,
        category: form.category || '',
        difficulty: form.difficulty || 'beginner',
        image_url: form.image_url.trim() || undefined,
        video_url: form.video_url.trim() || undefined,
      };
      if (isEdit) {
        await courseService.update(item.id, payload);
      } else {
        await api.post('courses/', payload);
      }
      showToast?.(
        isEdit
          ? (lang === 'ht' ? '✅ Kou mete ajou!' : '✅ Course updated!')
          : (lang === 'ht' ? '✅ Kou kreye avèk siksè!' : '✅ Course created successfully!'),
        'check-circle',
      );
      onSuccess?.();
      onClose?.();
    } catch (err) {
      const detail = err?.response?.data?.detail
        || err?.response?.data?.title?.[0]
        || err?.message
        || (lang === 'ht' ? 'Pa t kapab kreye kou a.' : 'Could not create course.');
      setErrors((e) => ({ ...e, _api: detail }));
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setLoading(false);
    }
  }, [form, lang, showToast, onSuccess, onClose]);

  return (
    <StudioModal
      onClose={onClose}
      icon="fa-graduation-cap"
      title={lang === 'ht' ? 'Kreye yon Kou' : 'Create a Course'}
      subtitle={isEdit
        ? (lang === 'ht' ? 'Modifye kou a' : 'Edit this course')
        : (lang === 'ht' ? 'Ajoute yon nouvo kou nan platfòm nan' : 'Add a new course to the platform')}
    >
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        {errors._api && <div className={styles.apiError} role="alert">{errors._api}</div>}
        {isEdit && (
          <div className={styles.editBanner}>
            <i className="fas fa-pen" aria-hidden="true" /> {lang === 'ht' ? 'Ap modifye' : 'Editing'} <strong>{form.title}</strong>
          </div>
        )}
        <LoadingOverlay loading={loading}>
          <FormSection
            icon="fa-info-circle"
            title={lang === 'ht' ? 'Enfòmasyon Bazik' : 'Basic Information'}
            hint={lang === 'ht' ? 'Ki sa kou sa a ye?' : 'What is this course about?'}
          >
            <FormField label={lang === 'ht' ? 'Tit' : 'Title'} required error={errors.title}>
              <input
                className={styles.input}
                value={form.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder={lang === 'ht' ? 'Egzanp: Kijan pou kode an Python' : 'e.g. How to code in Python'}
                maxLength={200}
                autoFocus
                aria-invalid={errors.title ? 'true' : 'false'}
              />
            </FormField>
            <FormField label={lang === 'ht' ? 'Deskripsyon' : 'Description'} required error={errors.description}>
              <textarea
                className={styles.textarea}
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder={lang === 'ht' ? 'Dekri sa elèv yo pral aprann, pou kiyès li ye, ak rezilta yo pral jwenn...' : 'Describe what students will learn, who it is for, and the outcome...'}
                rows={5}
                maxLength={5000}
                aria-invalid={errors.description ? 'true' : 'false'}
              />
              <HelpTip help={{
                ht: 'Yon bon deskripsyon: kisa elèv yo apral aprann (materyèl), pou kiyès li ye (debitan, avanse), ak sa yo pral kapab fè apre (rezilta). 20 karaktè minimòm.',
                en: 'A strong description: what students will learn (curriculum), who it is for (beginner, advanced), and what they will be able to do afterward (outcome). 20 characters minimum.',
              }} lang={lang} />
            </FormField>
            <div className={styles.row}>
              <FormField label={lang === 'ht' ? 'Kategori' : 'Category'}>
                <input
                  className={styles.input}
                  value={form.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  placeholder={lang === 'ht' ? 'Teknoloji, Biznis, Atizay...' : 'Technology, Business, Art...'}
                />
              </FormField>
              <FormField label={lang === 'ht' ? 'Nivo' : 'Difficulty'}>
                <select
                  className={styles.input}
                  value={form.difficulty}
                  onChange={(e) => handleChange('difficulty', e.target.value)}
                >
                  <option value="beginner">{lang === 'ht' ? 'Debitan' : 'Beginner'}</option>
                  <option value="intermediate">{lang === 'ht' ? 'Mwayen' : 'Intermediate'}</option>
                  <option value="advanced">{lang === 'ht' ? 'Avanse' : 'Advanced'}</option>
                </select>
              </FormField>
            </div>
          </FormSection>

          <FormSection
            icon="fa-hashtag"
            title={lang === 'ht' ? 'Dekouvèt' : 'Discovery'}
            hint={lang === 'ht' ? 'Ed moun jwenn kou ou — hashtags alimante trending yo.' : 'Help people find your course — hashtags feed trending.'}
          >
            <FormField label={lang === 'ht' ? 'Hashtags' : 'Hashtags'}
              hint={lang === 'ht' ? 'Separe ak espas — #Python #Kreyol' : 'Separate with spaces — #Python #Kreyol'}>
              <div className={styles.inputWithHelp}>
                <input
                  className={styles.input}
                  value={form.hashtags}
                  onChange={(e) => handleChange('hashtags', e.target.value)}
                  placeholder="#Python #Kreyol #Education"
                  maxLength={120}
                />
                <HelpTip help={HELP_COPY.hashtags} lang={lang} />
              </div>
            </FormField>
          </FormSection>

          <FormSection
            icon="fa-tag"
            title={lang === 'ht' ? 'Pri' : 'Pricing'}
            hint={lang === 'ht' ? 'Kite vid si kou a gratis.' : 'Leave empty if the course is free.'}
          >
            <FormField label={lang === 'ht' ? 'Pri ($)' : 'Price ($)'} error={errors.price}>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => handleChange('price', e.target.value)}
                placeholder="0.00"
                aria-invalid={errors.price ? 'true' : 'false'}
              />
            </FormField>
          </FormSection>

          <FormSection
            icon="fa-image"
            title={lang === 'ht' ? 'Kouvèti Kou' : 'Course Cover'}
            hint={lang === 'ht' ? 'Yon bon imaj fè kou ou parèt nan Explore.' : 'A strong image makes your course stand out in Explore.'}
          >
            <FieldTip>
              {lang === 'ht'
                ? 'Preview imaj la parèt anba a — verifye l anvan ou sove.'
                : 'The image preview appears below — verify it before saving.'}
            </FieldTip>
            <ImageUrlField
              label={lang === 'ht' ? 'URL imaj kou' : 'Course Image URL'}
              value={form.image_url}
              onChange={(v) => handleChange('image_url', v)}
              placeholder="https://example.com/image.jpg"
              lang={lang}
              hint={lang === 'ht'
                ? 'Kole yon URL imaj DIRÈK (.jpg, .png, .webp) — pa yon paj galri.'
                : 'Paste a DIRECT image URL (.jpg, .png, .webp) — not a gallery page.'}
              help={HELP_COPY.cover}
            />
            <MediaUrlField
              label={lang === 'ht' ? 'URL videyo prezantasyon' : 'Promo Video URL'}
              value={form.video_url}
              onChange={(v) => handleChange('video_url', v)}
              kind="video"
              lang={lang}
              help={HELP_COPY.video}
              placeholder="https://youtube.com/watch?v=..."
            />
            <FieldTip>
              {lang === 'ht'
                ? 'Videyo a jwe anlè kouvèti a lè moun hover kou a nan Explore — YouTube, Vimeo oswa MP4/WebM dirèk.'
                : 'The video plays over the cover when people hover the course in Explore — YouTube, Vimeo, or direct MP4/WebM.'}
            </FieldTip>
          </FormSection>
        </LoadingOverlay>
        <div className={styles.actions}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            {lang === 'ht' ? 'Anile' : 'Cancel'}
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {lang === 'ht' ? 'Ap sove...' : 'Saving...'}</>
            ) : (
              <><i className={`fas ${isEdit ? 'fa-save' : 'fa-plus'}`} aria-hidden="true" /> {isEdit
                ? (lang === 'ht' ? 'Mete ajou' : 'Update')
                : (lang === 'ht' ? 'Kreye Kou' : 'Create Course')}</>
            )}
          </button>
        </div>
      </form>
    </StudioModal>
  );
}
