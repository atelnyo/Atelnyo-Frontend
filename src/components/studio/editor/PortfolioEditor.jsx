/**
 * src/components/studio/editor/PortfolioEditor.jsx
 *
 * EDITOR-FIRST portfolio project workspace (replaces ProjectFormModal).
 *
 * A portfolio piece is SHOWCASE content, so the workspace leads with the
 * visual: cover + gallery canvas on the left/center, story + links +
 * skills in the editor, publish state on the right.
 *
 * SAVE vs PUBLISH are real states — the backend PortfolioProject model
 * has ``is_published`` (hidden draft vs public showcase):
 *   • Save draft  → is_published=false (hidden everywhere)
 *   • Publish     → is_published=true  (live in Explore + profile)
 *
 * BACKEND FIELDS covered (PortfolioProjectSerializer — all writable):
 *   title, description, category (free text; the backend CategoryField
 *   auto-creates unknown portfolio labels, so free text never 400s),
 *   cover_url, media_gallery [{url, type, caption}], skills_used[],
 *   project_url, source_url, difficulty, completion_date, visibility
 *   (public/followers/subscribers), is_featured, is_published.
 */
import React, { useCallback, useRef, useState } from 'react';
import { portfolioService } from '../../../services/api';
import StudioEditorShell from './StudioEditorShell';
import StudioPropertiesPanel, {
  PropertyGroup, PropField, PropInput,
} from './StudioPropertiesPanel';
import { ImageUrlField } from '../modals/shared';
import styles from './editor.module.css';

const DIFFICULTY_OPTIONS = [
  { value: 'beginner', ht: 'Debitan', en: 'Beginner' },
  { value: 'intermediate', ht: 'Mwayen', en: 'Intermediate' },
  { value: 'advanced', ht: 'Avanse', en: 'Advanced' },
  { value: 'expert', ht: 'Ekspè', en: 'Expert' },
];

const VISIBILITY_OPTIONS = [
  { value: 'public', icon: 'fa-lock-open', ht: 'Piblik', en: 'Public', hintHt: 'Tout moun ka wè l', hintEn: 'Everyone can see it' },
  { value: 'followers', icon: 'fa-user-check', ht: 'Abonè sèlman (gratis)', en: 'Followers only (free)', hintHt: 'Sèlman ou + moun k ap swiv ou', hintEn: 'Only you + your followers' },
  { value: 'subscribers', icon: 'fa-crown', ht: 'Abonè peyan sèlman', en: 'Paid subscribers only', hintHt: 'Mande pri abònman nan Anviwònman Pwofil', hintEn: 'Requires a subscription price in Profile Settings' },
];

// Extra gallery item type — the backend stores {url, type, caption}.
// Video hosts play as the demo on the card + detail page.
const detectMediaType = (url) => {
  const u = String(url || '');
  if (/(youtube\.com|youtu\.be|vimeo\.com|facebook\.com|fb\.watch|tiktok\.com)/i.test(u)) return 'video';
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u)) return 'video';
  return 'image';
};

export default function PortfolioEditor({ onClose, onSuccess, onSaved, lang = 'en', showToast, user, item }) {
  const isHt = lang === 'ht';
  const isEdit = Boolean(item);

  const [form, setForm] = useState({
    title: item?.title || '',
    description: item?.description || '',
    category: item?.category || '',
    cover_url: item?.cover_url || '',
    media_gallery: Array.isArray(item?.media_gallery)
      ? item.media_gallery.map((g) => ({
        url: g?.url || '',
        caption: g?.caption || '',
        type: g?.type || detectMediaType(g?.url),
      }))
      : [],
    skills_used: Array.isArray(item?.skills_used) ? item.skills_used.join(', ') : '',
    project_url: item?.project_url || '',
    source_url: item?.source_url || '',
    difficulty: item?.difficulty || 'intermediate',
    completion_date: item?.completion_date || '',
    visibility: item?.visibility || 'public',
    is_featured: item?.is_featured ?? false,
    is_published: item?.is_published ?? true,
  });
  const [errors, setErrors] = useState({});
  const [saveState, setSaveState] = useState('idle');
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const savedIdRef = useRef(isEdit ? item.id : null);
  const [hasSaved, setHasSaved] = useState(isEdit);
  const [previewOpen, setPreviewOpen] = useState(false);

  const markDirty = useCallback(() => {
    if (!dirtyRef.current) { dirtyRef.current = true; setDirty(true); setSaveState('dirty'); }
  }, []);

  const handleChange = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
    markDirty();
  }, [errors, markDirty]);

  const handleGalleryChange = useCallback((index, field, value) => {
    setForm((f) => {
      const next = (f.media_gallery || []).map((g, i) => (
        i === index ? { ...g, [field]: value, ...(field === 'url' ? { type: detectMediaType(value) } : {}) } : g
      ));
      return { ...f, media_gallery: next };
    });
    markDirty();
  }, [markDirty]);

  const addGalleryItem = useCallback(() => {
    setForm((f) => ({ ...f, media_gallery: [...(f.media_gallery || []), { url: '', caption: '', type: 'image' }] }));
    markDirty();
  }, [markDirty]);

  const removeGalleryItem = useCallback((index) => {
    setForm((f) => ({ ...f, media_gallery: (f.media_gallery || []).filter((_, i) => i !== index) }));
    markDirty();
  }, [markDirty]);

  const validate = useCallback(() => {
    const errs = {};
    if (!form.title.trim()) errs.title = isHt ? 'Tit oblije' : 'Title required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form, isHt]);

  const buildPayload = useCallback((publish) => ({
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    category: form.category.trim() || undefined,
    cover_url: form.cover_url.trim() || undefined,
    media_gallery: (form.media_gallery || [])
      .map((g) => ({ url: String(g.url || '').trim(), caption: String(g.caption || '').trim(), type: g.type || detectMediaType(g.url) }))
      .filter((g) => g.url),
    skills_used: form.skills_used ? form.skills_used.split(',').map((s) => s.trim()).filter(Boolean) : [],
    project_url: form.project_url.trim() || undefined,
    source_url: form.source_url.trim() || undefined,
    difficulty: form.difficulty,
    completion_date: form.completion_date || null,
    visibility: form.visibility,
    is_featured: Boolean(form.is_featured),
    // Save = draft, Publish = live. Editing keeps the showcase state
    // unless the creator explicitly publishes.
    is_published: publish ? true : (isEdit ? form.is_published : false),
  }), [form, isEdit]);

  const doSave = useCallback(async (publish = false) => {
    if (!validate()) { setSaveState('error'); return false; }
    setSaveState('saving');
    try {
      let res;
      if (isEdit && savedIdRef.current) {
        res = await portfolioService.update(savedIdRef.current, buildPayload(publish));
      } else {
        res = await portfolioService.create(buildPayload(publish));
        const data = res?.data?.data || res?.data;
        if (data?.id) { savedIdRef.current = data.id; setHasSaved(true); }
      }
      dirtyRef.current = false; setDirty(false); setSaveState('saved');
      onSaved?.();
      showToast?.(isHt ? '✅ Pwojè sove' : '✅ Project saved', 'check-circle');
      setTimeout(() => setSaveState('idle'), 1500);
      return true;
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.title?.[0] || err?.message || (isHt ? 'Pa t kapab sove' : 'Could not save');
      setErrors((e) => ({ ...e, _api: detail }));
      showToast?.(detail, 'circle-exclamation');
      setSaveState('error');
      return false;
    }
  }, [form, isEdit, isHt, onSaved, showToast, validate, buildPayload]);

  const handleSave = useCallback(() => doSave(false), [doSave]);
  const handlePublish = useCallback(async () => { const ok = await doSave(true); if (ok) { onSuccess?.(); onClose?.(); } }, [doSave, onClose, onSuccess]);
  const handlePreview = useCallback(() => setPreviewOpen(true), []);

  const statusBadge = form.is_published
    ? { label: isHt ? 'Pibliye' : 'Published', color: '#059669', bg: 'rgba(16,185,129,0.1)' }
    : { label: isHt ? 'Bouyon' : 'Draft', color: '#d97706', bg: 'rgba(245,158,11,0.1)' };

  const validationList = [];
  if (!form.title.trim()) validationList.push({ id: 'title', label: isHt ? 'Tit obligatwa' : 'Title required', zone: 'editor' });

  const skills = form.skills_used ? form.skills_used.split(',').map((s) => s.trim()).filter(Boolean) : [];

  const editorContent = (
    <div className={styles.editorMain} style={{ padding: 24, maxWidth: 900, margin: '0 auto', width: '100%' }}>
      {errors._api && <div className={styles.apiError} role="alert" style={{ marginBottom: 16 }}>{errors._api}</div>}
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}><i className="fas fa-palette" /> {isHt ? 'Pwojè a' : 'The Piece'}</h3>
        <div style={{ display: 'grid', gap: 16 }}>
          <PropField label={isHt ? 'Tit' : 'Title'} required error={errors.title}>
            <PropInput value={form.title} onChange={(e) => handleChange('title', e.target.value)} placeholder={isHt ? 'Non pwojè a' : 'Project name'} />
          </PropField>
          <PropField label={isHt ? 'Deskripsyon' : 'Description'}>
            <textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)} className={styles.textarea} rows={5} placeholder={isHt ? 'Rakonte istwa pwojè a...' : 'Tell the story of the piece...'} />
          </PropField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <PropField label={isHt ? 'Kategori' : 'Category'}>
              <PropInput value={form.category} onChange={(e) => handleChange('category', e.target.value)} placeholder={isHt ? 'Web, Design, Mizik...' : 'Web, Design, Music...'} />
            </PropField>
            <PropField label={isHt ? 'Nivo' : 'Difficulty'}>
              <select value={form.difficulty} onChange={(e) => handleChange('difficulty', e.target.value)} className={styles.select}>
                {DIFFICULTY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{isHt ? o.ht : o.en}</option>
                ))}
              </select>
            </PropField>
          </div>
          <PropField label={isHt ? 'Konpetans (separe ak vigil)' : 'Skills (comma separated)'}>
            <PropInput value={form.skills_used} onChange={(e) => handleChange('skills_used', e.target.value)} placeholder={isHt ? 'React, Django, Design...' : 'React, Django, Design...'} />
          </PropField>
          <PropField label={isHt ? 'Dat finalizasyon' : 'Completion date'}>
            <input type="date" value={form.completion_date} onChange={(e) => handleChange('completion_date', e.target.value)} className={styles.input} />
          </PropField>
        </div>
      </div>

      <div className={styles.formSection} style={{ marginTop: 24 }}>
        <h3 className={styles.sectionTitle}><i className="fas fa-image" /> {isHt ? 'Vizyèl' : 'Visuals'}</h3>
        <div style={{ display: 'grid', gap: 16 }}>
          <ImageUrlField label={isHt ? 'URL Kouvèti' : 'Cover URL'} value={form.cover_url} onChange={(v) => handleChange('cover_url', v)} lang={lang} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 8 }}>
              {isHt ? 'Galri medya' : 'Media gallery'}{' '}
              <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
                {isHt ? '(imaj + videyo demo)' : '(images + demo videos)'}
              </span>
            </div>
            {(form.media_gallery || []).map((g, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <PropInput value={g.url} onChange={(e) => handleGalleryChange(i, 'url', e.target.value)} placeholder="https://..." />
                <PropInput value={g.caption} onChange={(e) => handleGalleryChange(i, 'caption', e.target.value)} placeholder={isHt ? 'Lejand (opsyonèl)' : 'Caption (optional)'} />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <i className={g.type === 'video' ? 'fas fa-video' : 'fas fa-image'} aria-hidden="true" />
                  </span>
                  <button type="button" onClick={() => removeGalleryItem(i)} aria-label={isHt ? 'Retire medya' : 'Remove media'}
                    style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <i className="fas fa-trash-can" aria-hidden="true" />
                  </button>
                </span>
              </div>
            ))}
            <button type="button" onClick={addGalleryItem}
              style={{ border: '1px dashed var(--border-color, #cbd5e1)', background: 'transparent', borderRadius: 8, padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', width: '100%' }}>
              <i className="fas fa-plus" aria-hidden="true" /> {isHt ? 'Ajoute medya' : 'Add media'}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.formSection} style={{ marginTop: 24 }}>
        <h3 className={styles.sectionTitle}><i className="fas fa-link" /> {isHt ? 'Lyen' : 'Links'}</h3>
        <div style={{ display: 'grid', gap: 16 }}>
          <PropField label={isHt ? 'URL Pwojè (demo/sit)' : 'Project URL (demo/site)'}>
            <PropInput value={form.project_url} onChange={(e) => handleChange('project_url', e.target.value)} placeholder="https://..." />
          </PropField>
          <PropField label={isHt ? 'URL Sous (GitHub)' : 'Source URL (GitHub)'}>
            <PropInput value={form.source_url} onChange={(e) => handleChange('source_url', e.target.value)} placeholder="https://github.com/..." />
          </PropField>
        </div>
      </div>
    </div>
  );

  const propertiesContent = (
    <StudioPropertiesPanel>
      <PropertyGroup title={isHt ? 'Piblikasyon' : 'Publishing'} defaultOpen>
        <PropField label={isHt ? 'Estati' : 'Status'}>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: statusBadge.color, background: statusBadge.bg, borderRadius: 999, padding: '4px 12px' }}>
              {statusBadge.label}
            </span>
          </div>
        </PropField>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{isHt ? 'Mete an vedèt' : 'Featured'}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{isHt ? 'Parèt an premye' : 'Shows first'}</div>
          </div>
          <button type="button" onClick={() => handleChange('is_featured', !form.is_featured)}
            aria-pressed={Boolean(form.is_featured)} aria-label={isHt ? 'Mete an vedèt' : 'Feature this project'}
            style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: form.is_featured ? 'var(--color-primary)' : 'var(--border-color)', position: 'relative', cursor: 'pointer' }}>
            <span style={{ position: 'absolute', top: 2, left: form.is_featured ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </button>
        </div>
      </PropertyGroup>
      <PropertyGroup title={isHt ? 'Vizibilite' : 'Visibility'} defaultOpen>
        {VISIBILITY_OPTIONS.map((o) => (
          <label key={o.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', cursor: 'pointer' }}>
            <input type="radio" name="pf-visibility" value={o.value} checked={form.visibility === o.value}
              onChange={(e) => handleChange('visibility', e.target.value)} style={{ marginTop: 4 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                <i className={'fas ' + o.icon} aria-hidden="true" style={{ marginRight: 6, opacity: 0.6 }} />
                {isHt ? o.ht : o.en}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{isHt ? o.hintHt : o.hintEn}</div>
            </div>
          </label>
        ))}
      </PropertyGroup>
    </StudioPropertiesPanel>
  );

  const previewProject = {
    title: form.title || (isHt ? 'Pwojè san tit' : 'Untitled project'),
    description: form.description,
    category: form.category,
    cover_url: form.cover_url,
    media_gallery: (form.media_gallery || []).filter((g) => g.url),
    skills_used: skills,
    project_url: form.project_url,
    source_url: form.source_url,
    difficulty: form.difficulty,
    completion_date: form.completion_date,
    is_featured: form.is_featured,
  };

  return (
    <>
      <StudioEditorShell
        title={isHt ? 'Editè Pòtfolyo' : 'Portfolio Editor'}
        icon="fa-palette"
        lang={lang}
        docTitle={form.title || (isHt ? 'Pwojè san tit' : 'Untitled project')}
        isNew={!isEdit}
        badge={hasSaved ? (
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: statusBadge.color, background: statusBadge.bg, borderRadius: 999, padding: '3px 10px', marginLeft: 8 }}>
            {statusBadge.label}
          </span>
        ) : null}
        dirty={dirty}
        saveState={saveState}
        onBack={onClose}
        onPreview={handlePreview}
        onSave={handleSave}
        saveLabel={hasSaved ? (isHt ? 'Sove' : 'Save') : (isHt ? 'Kreye Bouyon' : 'Create Draft')}
        canSave
        onPublish={handlePublish}
        publishLabel={isHt ? 'Pibliye' : 'Publish'}
        validation={validationList}
        editor={editorContent}
        properties={propertiesContent}
      />

      {previewOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.72)', zIndex: 3000, overflowY: 'auto' }} role="dialog" aria-modal="true" aria-label={isHt ? 'Preview pwojè' : 'Project preview'}>
          <div style={{ position: 'relative', maxWidth: 720, margin: '4vh auto', background: 'var(--bg-default, #0f172a)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-color, #1e293b)' }}>
            <button type="button" onClick={() => setPreviewOpen(false)}
              style={{ position: 'absolute', top: 12, right: 12, zIndex: 1, border: 'none', borderRadius: 999, width: 38, height: 38, background: 'rgba(15,23,42,0.72)', color: '#fff', fontSize: 16, cursor: 'pointer' }}
              aria-label={isHt ? 'Fèmen preview' : 'Close preview'}>
              <i className="fas fa-xmark" aria-hidden="true" />
            </button>
            {previewProject.cover_url ? (
              <img src={previewProject.cover_url} alt="" style={{ width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(236,72,153,0.15))', color: '#8b5cf6' }}>
                <i className="fas fa-palette" style={{ fontSize: 40 }} aria-hidden="true" />
              </div>
            )}
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {previewProject.is_featured && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#b45309', background: 'rgba(245,158,11,0.15)', borderRadius: 999, padding: '3px 10px' }}>
                    {'⭐ '}{isHt ? 'Vedèt' : 'Featured'}
                  </span>
                )}
                {previewProject.category && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7c3aed', background: 'rgba(139,92,246,0.12)', borderRadius: 999, padding: '3px 10px' }}>
                    {previewProject.category}
                  </span>
                )}
                {previewProject.difficulty && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 999, padding: '3px 10px' }}>
                    {previewProject.difficulty}
                  </span>
                )}
              </div>
              <h2 style={{ margin: '0 0 8px', fontSize: '1.35rem' }}>{previewProject.title}</h2>
              {previewProject.description && (
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{previewProject.description}</p>
              )}
              {previewProject.skills_used.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  {previewProject.skills_used.map((s) => (
                    <span key={s} style={{ fontSize: '0.75rem', background: 'rgba(59,130,246,0.12)', color: '#2563eb', borderRadius: 999, padding: '3px 10px' }}>#{s}</span>
                  ))}
                </div>
              )}
              {(previewProject.media_gallery || []).length > 0 && (
                <p style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <i className="fas fa-photo-video" aria-hidden="true" style={{ marginRight: 6 }} />
                  {(previewProject.media_gallery || []).length}{isHt ? ' medya nan galri' : ' media in gallery'}
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                {previewProject.project_url && (
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff', background: '#7c3aed', borderRadius: 8, padding: '8px 16px' }}>
                    <i className="fas fa-arrow-up-right-from-square" aria-hidden="true" style={{ marginRight: 6 }} />
                    {isHt ? 'Wè pwojè a' : 'View project'}
                  </span>
                )}
                {previewProject.source_url && (
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 16px' }}>
                    <i className="fab fa-github" aria-hidden="true" style={{ marginRight: 6 }} />
                    {isHt ? 'Kòd sous' : 'Source code'}
                  </span>
                )}
              </div>
              <p style={{ marginTop: 16, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {isHt ? 'Preview sèlman — lyen yo pa klike isit la.' : 'Preview only — links are not clickable here.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
