/**
 * src/components/studio/editor/CommunityEditor.jsx
 */
import React, { useCallback, useRef, useState } from 'react';
import { communitiesService } from '../../../services/api';
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
    category: item?.category || '',
    join_mode: item?.join_mode || 'public',
    avatar_url: item?.avatar_url || '',
    banner_url: item?.banner_url || '',
    location: item?.location || '',
    visibility: item?.visibility || 'public',
  });
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

  const doSave = useCallback(async (publish = false) => {
    if (!validate()) { setSaveState('error'); return false; }
    setSaveState('saving');
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category.trim() || undefined,
      join_mode: form.join_mode,
      avatar_url: form.avatar_url.trim() || undefined,
      banner_url: form.banner_url.trim() || undefined,
      location: form.location.trim() || undefined,
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
            <PropInput value={form.category} onChange={(e) => handleChange('category', e.target.value)} placeholder={isHt ? 'Technology, Art, Music...' : 'Technology, Art, Music...'} />
          </PropField>
          <PropField label={isHt ? 'Kote' : 'Location'}>
            <PropInput value={form.location} onChange={(e) => handleChange('location', e.target.value)} placeholder={isHt ? 'Ayiti, Online...' : 'Haiti, Online...'} />
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

      <div className={styles.formSection} style={{ marginTop: 24 }}>
        <h3 className={styles.sectionTitle}><i className="fas fa-user-lock" /> {isHt ? 'Vizibilite' : 'Visibility'}</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 12 }}>{isHt ? 'Ki moun ka wè sa a?' : 'Who can see this?'}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, border: '1px solid var(--border-color)', borderRadius: 8, cursor: 'pointer' }}>
            <input type="radio" name="visibility" value="followers" checked={(form.visibility || 'public') === 'followers'} onChange={(e) => handleChange('visibility', e.target.value)} style={{ marginTop: 4 }} />
            <div>
              <div style={{ fontWeight: 600 }}>{isHt ? 'Swivè sèlman (gratis)' : 'Followers only (free)'}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{isHt ? 'Sèlman ou menm ak moun k ap swiv ou ka wè l.' : 'Only you and the people following you can see it.'}</div>
            </div>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, border: '1px solid var(--border-color)', borderRadius: 8, cursor: 'pointer' }}>
            <input type="radio" name="visibility" value="subscribers" checked={(form.visibility || 'public') === 'subscribers'} onChange={(e) => handleChange('visibility', e.target.value)} style={{ marginTop: 4 }} />
            <div>
              <div style={{ fontWeight: 600 }}>{isHt ? 'Abonè peyan sèlman' : 'Subscribers only (paid)'}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{isHt ? 'Sèlman abonè peyan yo ka wè l — mete pri abònman nan Anviwònman Pwofil.' : 'Only paid subscribers can see it — set a subscription price in Profile Settings.'}</div>
            </div>
          </label>
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
      publishLabel={isHt ? 'Kreye' : 'Create'}
      canSave={true}
      validation={validationList}
      editor={editorContent}
      properties={propertiesContent}
    />
  );
}
