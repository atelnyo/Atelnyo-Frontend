/**
 * src/components/studio/editor/TalentEditor.jsx
 *
 * EDITOR-FIRST talent creation workspace (replaces TalentFormModal).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { talentService } from '../../../services/api';
import StudioEditorShell from './StudioEditorShell';
import StudioPropertiesPanel, {
  PropertyGroup, PropField, PropInput,
} from './StudioPropertiesPanel';
import { ImageUrlField, MediaUrlField, HelpTip } from '../modals/shared';
import styles from './editor.module.css';

export default function TalentEditor({ onClose, onSuccess, onSaved, lang = 'ht', showToast, user, item }) {
  const isHt = lang === 'ht';
  const isEdit = Boolean(item);

  const [form, setForm] = useState({
    name: item?.name || '',
    role: item?.role || '',
    bio: item?.bio || '',
    skills: Array.isArray(item?.skills) ? item.skills.join(', ') : '',
    location: item?.location || '',
    avatar_url: item?.avatar_url || item?.avatar || '',
    contact_email: item?.contact_email || '',
    contact_url: item?.contact_url || '',
    is_active: item ? item.is_active !== false : true,
  });
  const [errors, setErrors] = useState({});
  const [saveState, setSaveState] = useState('idle');
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [hasSaved, setHasSaved] = useState(isEdit);
  const savedIdRef = useRef(isEdit ? item.id : null);
  const autoSaveTimer = useRef(null);

  const markDirty = useCallback(() => {
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      setDirty(true);
      setSaveState('dirty');
    }
  }, []);

  const handleChange = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
    markDirty();
  }, [errors, markDirty]);

  const validate = useCallback(() => {
    const errs = {};
    if (!form.name.trim()) errs.name = isHt ? 'Non oblije' : 'Name required';
    if (!form.role.trim()) errs.role = isHt ? 'Wòl oblije' : 'Role required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form, isHt]);

  const doSave = useCallback(async (publish = false) => {
    if (!validate()) {
      setSaveState('error');
      return false;
    }
    setSaveState('saving');
    const payload = {
      name: form.name.trim(),
      role: form.role.trim(),
      bio: form.bio.trim() || undefined,
      skills: form.skills ? form.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
      location: form.location.trim() || undefined,
      avatar_url: form.avatar_url.trim() || undefined,
      contact_email: form.contact_email.trim() || undefined,
      contact_url: form.contact_url.trim() || undefined,
      is_active: publish ? true : Boolean(form.is_active),
    };
    try {
      let res;
      if (isEdit && savedIdRef.current) {
        res = await talentService.update(savedIdRef.current, payload);
      } else {
        res = await talentService.create(payload);
        if (res?.data?.id) savedIdRef.current = res.data.id;
        setHasSaved(true);
      }
      dirtyRef.current = false;
      setDirty(false);
      setSaveState('saved');
      onSaved?.();
      showToast?.(isHt ? '✅ Talan sove' : '✅ Talent saved', 'check-circle');
      setTimeout(() => setSaveState('idle'), 1500);
      return true;
    } catch (err) {
      const detail = err?.response?.data?.detail
        || err?.response?.data?.name?.[0]
        || err?.response?.data?.role?.[0]
        || err?.message
        || (isHt ? 'Pa t kapab sove talan an.' : 'Could not save talent.');
      setErrors((e) => ({ ...e, _api: detail }));
      showToast?.(detail, 'circle-exclamation');
      setSaveState('error');
      return false;
    }
  }, [form, isEdit, isHt, onSaved, showToast, validate]);

  const handleSave = useCallback(() => doSave(false), [doSave]);
  const handlePublish = useCallback(async () => {
    const ok = await doSave(true);
    if (ok) {
      onSuccess?.();
      onClose?.();
    }
  }, [doSave, onClose, onSuccess]);

  const validationList = [];
  if (!form.name.trim()) validationList.push({ id: 'name', label: isHt ? 'Non obligatwa' : 'Name required', zone: 'editor' });
  if (!form.role.trim()) validationList.push({ id: 'role', label: isHt ? 'Wòl obligatwa' : 'Role required', zone: 'editor' });

  const editorContent = (
    <div className={styles.editorMain} style={{ padding: 24, maxWidth: 800, margin: '0 auto', width: '100%' }}>
      {errors._api && <div className={styles.apiError} role="alert" style={{ marginBottom: 16 }}>{errors._api}</div>}
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}><i className="fas fa-user" /> {isHt ? 'Enfòmasyon Debaz' : 'Basic Info'}</h3>
        <div style={{ display: 'grid', gap: 16 }}>
          <PropField label={isHt ? 'Non' : 'Name'} required error={errors.name}>
            <PropInput value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder={isHt ? 'Non talan an' : 'Talent name'} />
          </PropField>
          <PropField label={isHt ? 'Wòl' : 'Role'} required error={errors.role}>
            <PropInput value={form.role} onChange={(e) => handleChange('role', e.target.value)} placeholder={isHt ? 'Chantè, Dansè, Aktris...' : 'Singer, Dancer, Actor...'} />
          </PropField>
          <PropField label={isHt ? 'Kote' : 'Location'}>
            <PropInput value={form.location} onChange={(e) => handleChange('location', e.target.value)} placeholder={isHt ? 'Potoprens, Ayiti' : 'Port-au-Prince, Haiti'} />
          </PropField>
          <PropField label={isHt ? 'Biyo' : 'Bio'}>
            <textarea value={form.bio} onChange={(e) => handleChange('bio', e.target.value)} className={styles.textarea} rows={4} placeholder={isHt ? 'Dekri talan an...' : 'Describe the talent...'} maxLength={1000} />
          </PropField>
          <PropField label={isHt ? 'Konpetans (separe ak virgül)' : 'Skills (comma separated)'} hint={isHt ? 'Chante, Danse, Mizik' : 'Singing, Dancing, Music'}>
            <PropInput value={form.skills} onChange={(e) => handleChange('skills', e.target.value)} placeholder={isHt ? 'Chante, Danse, Mizik' : 'Singing, Dancing, Music'} />
          </PropField>
        </div>
      </div>

      <div className={styles.formSection} style={{ marginTop: 24 }}>
        <h3 className={styles.sectionTitle}><i className="fas fa-image" /> {isHt ? 'Foto & Kontak' : 'Photo & Contact'}</h3>
        <div style={{ display: 'grid', gap: 16 }}>
          <ImageUrlField
            label={isHt ? 'URL Avatè' : 'Avatar URL'}
            value={form.avatar_url}
            onChange={(v) => handleChange('avatar_url', v)}
            lang={lang}
            hint={isHt ? 'Foto pwofil talan an (kare pi byen)' : 'Talent profile photo (square works best)'}
          />
          <PropField label={isHt ? 'Imèl Kontak' : 'Contact Email'}>
            <PropInput type="email" value={form.contact_email} onChange={(e) => handleChange('contact_email', e.target.value)} placeholder="email@example.com" />
          </PropField>
          <PropField label={isHt ? 'Sit Web / URL' : 'Website / URL'}>
            <PropInput type="url" value={form.contact_url} onChange={(e) => handleChange('contact_url', e.target.value)} placeholder="https://..." />
          </PropField>
        </div>
      </div>
    </div>
  );

  const propertiesContent = (
    <StudioPropertiesPanel>
      <PropertyGroup title={isHt ? 'Paramèt' : 'Settings'} defaultOpen>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{isHt ? 'Vizibilite' : 'Visibility'}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {form.is_active ? (isHt ? 'Vizib nan Explore' : 'Visible in Explore') : (isHt ? 'Kache' : 'Hidden')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleChange('is_active', !form.is_active)}
            style={{
              width: 44, height: 24, borderRadius: 12, border: 'none',
              background: form.is_active ? 'var(--color-primary, #3b82f6)' : 'var(--border-color, #334155)',
              position: 'relative', cursor: 'pointer'
            }}
          >
            <span style={{
              position: 'absolute', top: 2, left: form.is_active ? 22 : 2,
              width: 20, height: 20, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s'
            }} />
          </button>
        </div>
      </PropertyGroup>
    </StudioPropertiesPanel>
  );

  return (
    <StudioEditorShell
      title={isHt ? 'Editè Talan' : 'Talent Editor'}
      icon="fa-star"
      lang={lang}
      docTitle={form.name || (isHt ? 'Talan san tit' : 'Untitled talent')}
      isNew={!isEdit}
      dirty={dirty}
      saveState={saveState}
      onBack={onClose}
      onSave={handleSave}
      onPublish={handlePublish}
      saveLabel={isHt ? 'Sove' : 'Save'}
      publishLabel={isHt ? 'Publie' : 'Publish'}
      canSave={true}
      validation={validationList}
      editor={editorContent}
      properties={propertiesContent}
    />
  );
}
