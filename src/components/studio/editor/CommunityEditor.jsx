/**
 * src/components/studio/editor/CommunityEditor.jsx
 */
import React, { useCallback, useRef, useState } from 'react';
import { communitiesService } from '../../../services/api';
import { parseHashtags, hashtagsToInput } from '../../../utils/hashtags';

// Canonical category vocabulary — same slugs as CreateCommunityModal and
// the backend CATEGORY_CHOICES. The backend auto-creates unknown labels,
// so the editor stays on the fixed list to avoid polluting the taxonomy.
// Labels are display names; the API resolves slug or name on write.
const CATEGORY_OPTIONS = [
  { value: 'tech', ht: 'Teknoloji', en: 'Technology' },
  { value: 'art', ht: 'A & Design', en: 'Art & Design' },
  { value: 'music', ht: 'Mizik', en: 'Music' },
  { value: 'education', ht: 'Edikasyon', en: 'Education' },
  { value: 'business', ht: 'Biznis', en: 'Business' },
  { value: 'health', ht: 'Sante', en: 'Health & Wellness' },
  { value: 'gaming', ht: 'Jwèt', en: 'Gaming' },
  { value: 'sports', ht: 'Espò', en: 'Sports' },
  { value: 'food', ht: 'Manje & Kwi', en: 'Food & Cooking' },
  { value: 'travel', ht: 'Vwayaj', en: 'Travel' },
  { value: 'charity', ht: 'Charite', en: 'Charity & Causes' },
  { value: 'other', ht: 'Lòt', en: 'Other' },
];

// The API returns the display name ("Technology"); the select works on
// slugs ("tech"). Match either so edit mode preselects correctly.
const categoryToSlug = (raw) => {
  if (!raw) return 'other';
  const needle = String(raw).trim().toLowerCase();
  const hit = CATEGORY_OPTIONS.find(
    (o) => o.value === needle || o.en.toLowerCase() === needle || o.ht.toLowerCase() === needle,
  );
  return hit ? hit.value : 'other';
};
import StudioEditorShell from './StudioEditorShell';
import StudioPropertiesPanel, { PropertyGroup, PropField, PropInput } from './StudioPropertiesPanel';
import { ImageUrlField } from '../modals/shared';
import styles from './editor.module.css';

export default function CommunityEditor({ onClose, onSuccess, onSaved, lang = 'ht', showToast, user, item }) {
  const isHt = lang === 'ht';
  const isEdit = Boolean(item);

  const [form, setForm] = useState({
    name: item?.name || '',
    description: item?.description || '',
    category: categoryToSlug(item?.category),
    hashtags: hashtagsToInput(item?.tags),
    join_mode: item?.join_mode || 'public',
    avatar_url: item?.avatar_url || '',
    banner_url: item?.banner_url || '',
    // House rules — ordered [{title, description}]. The backend replaces
    // the whole list on save (POST .../rules/), so the editor owns the
    // full list and syncs it after the community itself is saved.
    rules: Array.isArray(item?.rules)
      ? [...item.rules].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((r) => ({ title: r.title || '', description: r.description || '' }))
      : [],
  });
  const [newRule, setNewRule] = useState({ title: '', description: '' });
  const [errors, setErrors] = useState({});
  const [saveState, setSaveState] = useState('idle');
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const savedIdRef = useRef(isEdit ? (item.slug || item.id) : null);

  const markDirty = useCallback(() => {
    if (!dirtyRef.current) { dirtyRef.current = true; setDirty(true); setSaveState('dirty'); }
  }, []);

  const handleChange = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
    markDirty();
  }, [errors, markDirty]);

  const validate = useCallback(() => {
    const errs = {};
    if (!form.name.trim()) errs.name = isHt ? 'Non obligatwa' : 'Name required';
    if (form.name.trim().length < 3) errs.name = isHt ? 'Omwen 3 karaktè' : 'At least 3 characters';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form, isHt]);

  const handleRuleChange = useCallback((index, field, value) => {
    setForm((f) => ({
      ...f,
      rules: (f.rules || []).map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    }));
    markDirty();
  }, [markDirty]);

  const addRule = useCallback(() => {
    if (!newRule.title.trim()) return;
    setForm((f) => ({
      ...f,
      rules: [...(f.rules || []), { title: newRule.title.trim(), description: newRule.description.trim() }],
    }));
    setNewRule({ title: '', description: '' });
    markDirty();
  }, [newRule, markDirty]);

  const removeRule = useCallback((index) => {
    setForm((f) => ({ ...f, rules: (f.rules || []).filter((_, i) => i !== index) }));
    markDirty();
  }, [markDirty]);

  const moveRule = useCallback((index, delta) => {
    setForm((f) => {
      const next = [...(f.rules || [])];
      const target = index + delta;
      if (target < 0 || target >= next.length) return f;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...f, rules: next };
    });
    markDirty();
  }, [markDirty]);

  const doSave = useCallback(async (publish = false) => {
    if (!validate()) { setSaveState('error'); return false; }
    setSaveState('saving');
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category || 'other',
      tags: parseHashtags(form.hashtags),
      join_mode: form.join_mode,
      avatar_url: form.avatar_url.trim() || undefined,
      banner_url: form.banner_url.trim() || undefined,
    };
    try {
      let res;
      if (isEdit && savedIdRef.current) {
        res = await communitiesService.update(savedIdRef.current, payload);
      } else {
        res = await communitiesService.create(payload);
        const data = res?.data?.data || res?.data;
        if (data?.slug || data?.id) savedIdRef.current = data.slug || data.id;
      }
      dirtyRef.current = false; setDirty(false); setSaveState('saved');
      onSaved?.();
      // Sync house rules (replace-all). Skipped only for a brand-new
      // community with no rules — avoids a pointless extra call.
      const hadRules = isEdit && Array.isArray(item?.rules) && item.rules.length > 0;
      if (form.rules.length > 0 || hadRules) {
        const slugForRules = isEdit ? (item?.slug || item?.id) : savedIdRef.current;
        try {
          await communitiesService.saveRules(slugForRules, form.rules.map((r) => ({
            title: r.title.trim(),
            description: (r.description || '').trim(),
          })).filter((r) => r.title));
        } catch (ruleErr) {
          showToast?.(ruleErr?.response?.data?.detail || (isHt ? 'Kominote sove, men règleman yo pa sove.' : 'Community saved, but rules were not saved.'), 'circle-exclamation');
        }
      }
      showToast?.(isHt ? '✅ Kominote sove' : '✅ Community saved', 'check-circle');
      setTimeout(() => setSaveState('idle'), 1500);
      return true;
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.name?.[0] || err?.message || (isHt ? 'Pa t kapab sove' : 'Could not save');
      setErrors((e) => ({ ...e, _api: detail }));
      showToast?.(detail, 'circle-exclamation');
      setSaveState('error');
      return false;
    }
  }, [form, isEdit, isHt, onSaved, showToast, validate]);

  const handleSave = useCallback(() => doSave(false), [doSave]);
  const handlePublish = useCallback(async () => { const ok = await doSave(true); if (ok) { onSuccess?.(); onClose?.(); } }, [doSave, onClose, onSuccess]);

  const validationList = [];
  if (!form.name.trim()) validationList.push({ id: 'name', label: isHt ? 'Non obligatwa' : 'Name required', zone: 'editor' });

  const editorContent = (
    <div className={styles.editorMain} style={{ padding: 24, maxWidth: 800, margin: '0 auto', width: '100%' }}>
      {errors._api && <div className={styles.apiError} role="alert" style={{ marginBottom: 16 }}>{errors._api}</div>}
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}><i className="fas fa-users" /> {isHt ? 'Enfòmasyon Kominote' : 'Community Info'}</h3>
        <div style={{ display: 'grid', gap: 16 }}>
          <PropField label={isHt ? 'Non Kominote' : 'Community Name'} required error={errors.name}>
            <PropInput value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder={isHt ? 'Non kominote a' : 'Community name'} />
          </PropField>
          <PropField label={isHt ? 'Deskripsyon' : 'Description'}>
            <textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)} className={styles.textarea} rows={4} placeholder={isHt ? 'Dekri kominote a...' : 'Describe the community...'} />
          </PropField>
          <PropField label={isHt ? 'Kategori' : 'Category'}>
            <select value={form.category} onChange={(e) => handleChange('category', e.target.value)} className={styles.select}>
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{isHt ? o.ht : o.en}</option>
              ))}
            </select>
          </PropField>
          <PropField label={isHt ? 'Hashtags' : 'Hashtags'}>
            <PropInput value={form.hashtags} onChange={(e) => handleChange('hashtags', e.target.value)} placeholder="#teknoloji #ayiti" />
          </PropField>
        </div>
      </div>
      <div className={styles.formSection} style={{ marginTop: 24 }}>
        <h3 className={styles.sectionTitle}><i className="fas fa-image" /> {isHt ? 'Imaj' : 'Images'}</h3>
        <div style={{ display: 'grid', gap: 16 }}>
          <ImageUrlField label={isHt ? 'URL Avatè' : 'Avatar URL'} value={form.avatar_url} onChange={(v) => handleChange('avatar_url', v)} lang={lang} />
          <ImageUrlField label={isHt ? 'URL Banner' : 'Banner URL'} value={form.banner_url} onChange={(v) => handleChange('banner_url', v)} lang={lang} />
        </div>
      </div>

    </div>
  );

  const propertiesContent = (
    <StudioPropertiesPanel>
      <PropertyGroup title={isHt ? 'Paramèt' : 'Settings'} defaultOpen>
        <PropField label={isHt ? 'Fason antre' : 'Join Mode'}>
          <select value={form.join_mode} onChange={(e) => handleChange('join_mode', e.target.value)} className={styles.select}>
            <option value="public">{isHt ? 'Piblik' : 'Public'}</option>
            <option value="approval">{isHt ? 'Bezwen apwobasyon' : 'Requires approval'}</option>
            <option value="invite">{isHt ? 'Envitasyon sèlman' : 'Invite only'}</option>
          </select>
        </PropField>
      </PropertyGroup>
      <PropertyGroup title={isHt ? 'Règleman' : 'House rules'} defaultOpen>
        {(form.rules || []).map((r, i) => (
          <div key={i} style={{ border: '1px solid var(--border-color, #e5e7eb)', borderRadius: 8, padding: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: '0.78rem', minWidth: 20 }}>{i + 1}.</span>
              <span style={{ flex: 1 }} />
              <button type="button" onClick={() => moveRule(i, -1)} disabled={i === 0} aria-label={isHt ? 'Monte' : 'Move up'}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', opacity: i === 0 ? 0.3 : 1 }}>
                <i className="fas fa-chevron-up" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => moveRule(i, 1)} disabled={i === (form.rules || []).length - 1} aria-label={isHt ? 'Desann' : 'Move down'}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', opacity: i === (form.rules || []).length - 1 ? 0.3 : 1 }}>
                <i className="fas fa-chevron-down" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => removeRule(i)} aria-label={isHt ? 'Retire règ' : 'Remove rule'}
                style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer' }}>
                <i className="fas fa-trash-can" aria-hidden="true" />
              </button>
            </div>
            <PropInput value={r.title} onChange={(e) => handleRuleChange(i, 'title', e.target.value)} placeholder={isHt ? 'Tit règ la' : 'Rule title'} />
            <div style={{ marginTop: 6 }}>
              <PropInput value={r.description} onChange={(e) => handleRuleChange(i, 'description', e.target.value)} placeholder={isHt ? 'Detay (opsyonèl)' : 'Detail (optional)'} />
            </div>
          </div>
        ))}
        <PropInput value={newRule.title} onChange={(e) => setNewRule((nr) => ({ ...nr, title: e.target.value }))} placeholder={isHt ? 'Nouvo règ...' : 'New rule...'} />
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <PropInput value={newRule.description} onChange={(e) => setNewRule((nr) => ({ ...nr, description: e.target.value }))} placeholder={isHt ? 'Detay (opsyonèl)' : 'Detail (optional)'} />
          <button type="button" onClick={addRule} disabled={!newRule.title.trim()}
            style={{ border: '1px solid var(--border-color, #cbd5e1)', background: 'transparent', borderRadius: 8, padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <i className="fas fa-plus" aria-hidden="true" /> {isHt ? 'Ajoute' : 'Add'}
          </button>
        </div>
      </PropertyGroup>
    </StudioPropertiesPanel>
  );

  return (
    <StudioEditorShell
      title={isHt ? 'Editè Kominote' : 'Community Editor'}
      icon="fa-users"
      lang={lang}
      docTitle={form.name || (isHt ? 'Kominote san tit' : 'Untitled community')}
      isNew={!isEdit}
      dirty={dirty}
      saveState={saveState}
      onBack={onClose}
      onSave={handleSave}
      onPublish={handlePublish}
      saveLabel={isHt ? 'Sove' : 'Save'}
      publishLabel={isHt ? 'Pibliye' : 'Publish'}
      canSave={true}
      validation={validationList}
      editor={editorContent}
      properties={propertiesContent}
    />
  );
}
