/**
 * src/components/studio/modals/ProductFormModal.jsx
 *
 * Modal for creating a marketplace product. POSTs to /api/marketplace/products/.
 *
 * Extracted from StudioModals.jsx during Etap 3 refactor.
 */
import React, { useState, useCallback } from 'react';
import api, { marketplaceService } from '../../../services/api';
import {
  StudioModal, FormField, FormSection, ImageUrlField,
  LoadingOverlay, HelpTip, FieldTip, HELP_COPY,
} from './shared';
import { parseHashtags, hashtagsToInput } from '../../../utils/hashtags';
import styles from './modals.module.css';

export default function ProductFormModal({ onClose, onSuccess, lang, showToast, item }) {
  const isEdit = Boolean(item);
  const [form, setForm] = useState({
    title: item?.title || '', description: item?.description || '', price: item?.price ?? '', category: item?.category || '',
    image_url: item?.image_url || '', kind: item?.kind || 'digital',
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
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) {
      errs.price = lang === 'ht' ? 'Pri valab oblije' : 'A valid price is required';
    }
    return errs;
  };

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    try {
if (isEdit) {
        await marketplaceService.update(item.id, {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          tags: parseHashtags(form.hashtags),
          price: Number(form.price),
          category: form.category || undefined,
          image_url: form.image_url.trim() || undefined,
          kind: form.kind || 'digital',
        });
      } else {
        await api.post('marketplace/products/', {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          tags: parseHashtags(form.hashtags),
          price: Number(form.price),
          category: form.category || undefined,
          image_url: form.image_url.trim() || undefined,
          kind: form.kind || 'digital',
        });
      }
      showToast?.(
        isEdit
          ? (lang === 'ht' ? '✅ Pwodwi mete ajou!' : '✅ Product updated!')
          : (lang === 'ht' ? '✅ Pwodwi kreye avèk siksè!' : '✅ Product created successfully!'),
        'check-circle',
      );
      onSuccess?.(); onClose?.();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.title?.[0]
        || err?.message
        || (lang === 'ht' ? 'Pa t kapab kreye pwodwi a.' : 'Could not create product.');
      setErrors((e) => ({ ...e, _api: detail }));
      showToast?.(detail, 'circle-exclamation');
    } finally { setLoading(false); }
  }, [form, lang, showToast, onSuccess, onClose]);

  return (
    <StudioModal onClose={onClose} icon="fa-cube"
      title={lang === 'ht' ? 'Kreye yon Pwodwi' : 'Create a Product'}
      subtitle={isEdit
        ? (lang === 'ht' ? 'Modifye pwodwi a' : 'Edit this product')
        : (lang === 'ht' ? 'Vann yon pwodwi dijital sou Marketplace a' : 'Sell a digital product on the Marketplace')}>
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
            title={lang === 'ht' ? 'Enfòmasyon Pwodwi' : 'Product Information'}
            hint={lang === 'ht' ? 'Sa w ap vann lan?' : 'What are you selling?'}
          >
            <FormField label={lang === 'ht' ? 'Tit' : 'Title'} required error={errors.title}>
              <input className={styles.input} value={form.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder={lang === 'ht' ? 'Antre non pwodwi a' : 'Enter product name'}
                maxLength={200} autoFocus />
            </FormField>
            <div className={styles.row}>
              <FormField label={lang === 'ht' ? 'Pri ($)' : 'Price ($)'} required error={errors.price}>
                <input className={styles.input} type="number" min="0.50" step="0.50"
                  value={form.price} onChange={(e) => handleChange('price', e.target.value)}
                  placeholder="9.99" />
              </FormField>
              <FormField label={lang === 'ht' ? 'Kalite' : 'Type'}>
                <select className={styles.input} value={form.kind}
                  onChange={(e) => handleChange('kind', e.target.value)}>
                  <option value="digital">{lang === 'ht' ? 'Dijital' : 'Digital'}</option>
                  <option value="physical">{lang === 'ht' ? 'Fizik' : 'Physical'}</option>
                  <option value="service">{lang === 'ht' ? 'Sèvis' : 'Service'}</option>
                </select>
              </FormField>
            </div>
            <FormField label={lang === 'ht' ? 'Kategori' : 'Category'}>
              <input className={styles.input} value={form.category}
                onChange={(e) => handleChange('category', e.target.value)}
                placeholder={lang === 'ht' ? 'Modèl, Liv, Mizik...' : 'Template, Book, Music...'} />
            </FormField>
          </FormSection>

          <FormSection
            icon="fa-file-lines"
            title={lang === 'ht' ? 'Deskripsyon' : 'Description'}
            hint={lang === 'ht' ? 'Eksplike sa achtè a pral resevwa.' : 'Explain what the buyer receives.'}
          >
            <FormField label={lang === 'ht' ? 'Deskripsyon' : 'Description'}>
              <textarea className={styles.textarea} value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder={lang === 'ht' ? 'Dekri pwodwi a...' : 'Describe the product...'}
                rows={4} maxLength={5000} />
            </FormField>
            <FormField label={lang === 'ht' ? 'Hashtags' : 'Hashtags'}
              hint={lang === 'ht' ? 'Separe ak espas — #Kreyol #Art' : 'Separate with spaces — #Kreyol #Art'}>
              <div className={styles.inputWithHelp}>
                <input className={styles.input} value={form.hashtags}
                  onChange={(e) => handleChange('hashtags', e.target.value)}
                  placeholder="#Kreyol #Art #Fashion" maxLength={120} />
                <HelpTip help={HELP_COPY.hashtags} lang={lang} />
              </div>
            </FormField>
          </FormSection>

          <FormSection
            icon="fa-image"
            title={lang === 'ht' ? 'Imaj Pwodwi' : 'Product Image'}
            hint={lang === 'ht' ? 'Yon bon foto fè pwodwi a parèt nan Explore.' : 'A strong photo makes the product stand out in Explore.'}
          >
            <FieldTip>
              {lang === 'ht'
                ? 'Yon foto klè sou yon fon senp vann pi byen.'
                : 'A clear photo on a simple background sells better.'}
            </FieldTip>
            <ImageUrlField
              label={lang === 'ht' ? 'URL Imaj' : 'Image URL'}
              value={form.image_url}
              onChange={(v) => handleChange('image_url', v)}
              placeholder="https://example.com/product.jpg"
              lang={lang}
              hint={lang === 'ht'
                ? 'Kole yon URL imaj DIREK (.jpg, .png, .webp) — pa yon paj galri.'
                : 'Paste a DIRECT image URL (.jpg, .png, .webp) — not a gallery page.'}
              help={HELP_COPY.cover}
            />
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
                : (lang === 'ht' ? 'Kreye Pwodwi' : 'Create Product')}</>
            )}
          </button>
        </div>
      </form>
    </StudioModal>
  );
}
