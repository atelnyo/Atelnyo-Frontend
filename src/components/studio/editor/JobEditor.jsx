/**
 * src/components/studio/editor/JobEditor.jsx
 */
import React, { useCallback, useRef, useState } from 'react';
import useFetch from '../../../hooks/useFetch';
import { jobService, communitiesService } from '../../../services/api';

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
import StudioEditorShell from './StudioEditorShell';
import StudioPropertiesPanel, { PropertyGroup, PropField, PropInput } from './StudioPropertiesPanel';
import { ImageUrlField } from '../modals/shared';
import styles from './editor.module.css';

export default function JobEditor({ onClose, onSuccess, onSaved, lang = 'en', showToast, user, item }) {
  const isHt = lang === 'ht';
  const isEdit = Boolean(item);

  const [form, setForm] = useState({
    title: item?.title || '',
    description: item?.description || '',
    budget_type: item?.budget_type || 'fixed',
    budget_min: item?.budget_min != null ? String(item.budget_min) : '',
    budget_max: item?.budget_max != null ? String(item.budget_max) : '',
    currency: item?.currency || 'USD',
    // Hiring capacity: 1 = classic single hire, N > 1 = each accepted
    // proposal gets its own contract (own milestones, own escrow).
    positions: item?.positions != null ? String(item.positions) : '1',
    cover_url: item?.cover_url || '',
    skills_required: Array.isArray(item?.skills_required) ? item.skills_required.join(', ') : '',
    is_remote: item?.is_remote ?? false,
    location: item?.location || '',
    visibility: item?.visibility || 'public',
    community: item?.community ?? '',
    expires_at: toLocalInput(item?.expires_at),
  });
  const { data: communities } = useFetch(
    () => communitiesService.list({ limit: 50 }),
    { defaultValue: [], transform: (d) => (Array.isArray(d) ? d : (d?.results || [])) },
  );
  const [errors, setErrors] = useState({});
  const [saveState, setSaveState] = useState('idle');
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [hasSaved, setHasSaved] = useState(isEdit);
  const savedIdRef = useRef(isEdit ? item.id : null);

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
    if (!form.title.trim()) errs.title = isHt ? 'Tit oblije' : 'Title required';
    if (!form.description.trim()) errs.description = isHt ? 'Deskripsyon oblije' : 'Description required';
    const min = Number(form.budget_min);
    const max = Number(form.budget_max);
    if (!Number.isFinite(min) || min < 0) errs.budget_min = isHt ? 'Envalid' : 'Invalid';
    if (!Number.isFinite(max) || max < 0) errs.budget_max = isHt ? 'Envalid' : 'Invalid';
    if (Number.isFinite(min) && Number.isFinite(max) && max < min) errs.budget_max = isHt ? 'Max dwe >= min' : 'Max must be >= min';
    const pos = Number(form.positions);
    if (!Number.isInteger(pos) || pos < 1) errs.positions = isHt ? 'Omwen 1' : 'At least 1';
    if (form.visibility === 'community' && !form.community) errs.community = isHt ? 'Chwazi kominote a' : 'Pick the community';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form, isHt]);

  const doSave = useCallback(async (publish = false) => {
    if (!validate()) { setSaveState('error'); return false; }
    setSaveState('saving');
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      budget_type: form.budget_type,
      budget_min: Number(form.budget_min),
      budget_max: Number(form.budget_max),
      currency: form.currency.trim() || 'USD',
      positions: Math.max(1, Math.floor(Number(form.positions) || 1)),
      cover_url: form.cover_url.trim() || '',
      skills_required: form.skills_required ? form.skills_required.split(',').map((s) => s.trim()).filter(Boolean) : [],
      is_remote: Boolean(form.is_remote),
      location: form.location.trim() || '',
      visibility: publish ? 'public' : form.visibility,
      community: form.visibility === 'community' && form.community ? Number(form.community) : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    };
    try {
      let res;
      if (isEdit && savedIdRef.current) res = await jobService.update(savedIdRef.current, payload);
      else { res = await jobService.create(payload); if (res?.data?.id) savedIdRef.current = res.data.id; setHasSaved(true); }
      dirtyRef.current = false; setDirty(false); setSaveState('saved');
      onSaved?.();
      showToast?.(isHt ? '✅ Travay sove' : '✅ Job saved', 'check-circle');
      setTimeout(() => setSaveState('idle'), 1500);
      return true;
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.title?.[0] || err?.message || (isHt ? 'Pa t kapab sove' : 'Could not save');
      setErrors((e) => ({ ...e, _api: detail }));
      showToast?.(detail, 'circle-exclamation');
      setSaveState('error');
      return false;
    }
  }, [form, isEdit, isHt, onSaved, showToast, validate]);

  const handleSave = useCallback(() => doSave(false), [doSave]);
  const handlePublish = useCallback(async () => { const ok = await doSave(true); if (ok) { onSuccess?.(); onClose?.(); } }, [doSave, onClose, onSuccess]);

  const validationList = [];
  if (!form.title.trim()) validationList.push({ id: 'title', label: isHt ? 'Tit obligatwa' : 'Title required', zone: 'editor' });
  if (!form.description.trim()) validationList.push({ id: 'description', label: isHt ? 'Deskripsyon obligatwa' : 'Description required', zone: 'editor' });

  const editorContent = (
    <div className={styles.editorMain} style={{ padding: 24, maxWidth: 900, margin: '0 auto', width: '100%' }}>
      {errors._api && <div className={styles.apiError} role="alert" style={{ marginBottom: 16 }}>{errors._api}</div>}
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}><i className="fas fa-briefcase" /> {isHt ? 'Enfòmasyon Travay' : 'Job Info'}</h3>
        <div style={{ display: 'grid', gap: 16 }}>
          <PropField label={isHt ? 'Tit' : 'Title'} required error={errors.title}>
            <PropInput value={form.title} onChange={(e) => handleChange('title', e.target.value)} placeholder={isHt ? 'Tit travay la' : 'Job title'} />
          </PropField>
          <PropField label={isHt ? 'Deskripsyon' : 'Description'} required error={errors.description}>
            <textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)} className={styles.textarea} rows={6} placeholder={isHt ? 'Dekri travay la...' : 'Describe the job...'} />
          </PropField>
          <PropField label={isHt ? 'Konpetans obligatwa (separe ak virgül)' : 'Required Skills (comma separated)'}>
            <PropInput value={form.skills_required} onChange={(e) => handleChange('skills_required', e.target.value)} placeholder={isHt ? 'Design, React, Django' : 'Design, React, Django'} />
          </PropField>
        </div>
      </div>
      <div className={styles.formSection} style={{ marginTop: 24 }}>
        <h3 className={styles.sectionTitle}><i className="fas fa-dollar-sign" /> {isHt ? 'Bidjè' : 'Budget'}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <PropField label={isHt ? 'Tip' : 'Type'}>
            <select value={form.budget_type} onChange={(e) => handleChange('budget_type', e.target.value)} className={styles.select}>
              {/* Backend BUDGET_TYPE_CHOICES = fixed/hourly only — any other
                  value 400s on save. Kept in sync with the serializer. */}
              <option value="fixed">Fixed</option>
              <option value="hourly">Hourly</option>
            </select>
          </PropField>
          <PropField label={isHt ? 'Min' : 'Min'} required error={errors.budget_min}>
            <PropInput type="number" value={form.budget_min} onChange={(e) => handleChange('budget_min', e.target.value)} />
          </PropField>
          <PropField label={isHt ? 'Max' : 'Max'} required error={errors.budget_max}>
            <PropInput type="number" value={form.budget_max} onChange={(e) => handleChange('budget_max', e.target.value)} />
          </PropField>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <PropField label={isHt ? 'Lajan' : 'Currency'}>
            <PropInput value={form.currency} onChange={(e) => handleChange('currency', e.target.value)} />
          </PropField>
          <PropField label={isHt ? 'Kote' : 'Location'}>
            <PropInput value={form.location} onChange={(e) => handleChange('location', e.target.value)} placeholder={isHt ? 'Vide si remote' : 'Leave empty if remote'} />
          </PropField>
        </div>
      </div>
      <div className={styles.formSection} style={{ marginTop: 24 }}>
        <h3 className={styles.sectionTitle}><i className="fas fa-users" /> {isHt ? 'Anbochaj' : 'Hiring'}</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          {isHt
            ? 'Konbyen freelancer ou ka anboche sou travay sa a? 1 = anboch klasik. Plis pase 1 = chak òf aksepte gen pwòp kontra, milestone ak escrow pa l.'
            : 'How many freelancers can you hire on this job? 1 = classic single hire. More than 1 = each accepted offer gets its own contract, milestones and escrow.'}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
          <PropField label={isHt ? 'Kantite plas' : 'Openings'} required error={errors.positions}>
            <PropInput type="number" min="1" step="1" value={form.positions} onChange={(e) => handleChange('positions', e.target.value)} />
          </PropField>
        </div>
      </div>
      <div className={styles.formSection} style={{ marginTop: 24 }}>
        <h3 className={styles.sectionTitle}><i className="fas fa-image" /> {isHt ? 'Kouvèti' : 'Cover'}</h3>
        <ImageUrlField label={isHt ? 'URL Imaj Kouvèti' : 'Cover Image URL'} value={form.cover_url} onChange={(v) => handleChange('cover_url', v)} lang={lang} />
      </div>

      <div className={styles.formSection} style={{ marginTop: 24 }}>
        <h3 className={styles.sectionTitle}><i className="fas fa-user-lock" /> {isHt ? 'Vizibilite' : 'Visibility'}</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 12 }}>{isHt ? 'Ki moun ka wè sa a?' : 'Who can see this?'}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, border: '1px solid var(--border-color)', borderRadius: 8, cursor: 'pointer' }}>
            <input type="radio" name="visibility" value="public" checked={(form.visibility || 'public') === 'public'} onChange={(e) => handleChange('visibility', e.target.value)} style={{ marginTop: 4 }} />
            <div>
              <div style={{ fontWeight: 600 }}>{isHt ? 'Piblik' : 'Public'}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{isHt ? 'Tout moun ka wè l' : 'Everyone can see it'}</div>
            </div>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, border: '1px solid var(--border-color)', borderRadius: 8, cursor: 'pointer' }}>
            <input type="radio" name="visibility" value="community" checked={form.visibility === 'community'} onChange={(e) => handleChange('visibility', e.target.value)} style={{ marginTop: 4 }} />
            <div>
              <div style={{ fontWeight: 600 }}>{isHt ? 'Kominote sèlman' : 'Community only'}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{isHt ? 'Sèlman manb kominote a ka wè l' : 'Only members of the community can see it'}</div>
            </div>
          </label>
        </div>
        {form.visibility === 'community' && (
          <div style={{ marginTop: 12 }}>
            <PropField label={isHt ? 'Kominote' : 'Community'} required error={errors.community}>
              <select value={form.community} onChange={(e) => handleChange('community', e.target.value)} className={styles.select}>
                <option value="">{isHt ? '-- Chwazi --' : '-- Select --'}</option>
                {(communities || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </PropField>
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <PropField label={isHt ? 'Ekspire (opsyonèl)' : 'Expires (optional)'}>
            <input type="datetime-local" value={form.expires_at} onChange={(e) => handleChange('expires_at', e.target.value)} className={styles.input} />
          </PropField>
        </div>
      </div>
    </div>
  );

  const propertiesContent = (
    <StudioPropertiesPanel>
      <PropertyGroup title={isHt ? 'Paramèt' : 'Settings'} defaultOpen>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
          <div><div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{isHt ? 'Travay aleka' : 'Remote'}</div></div>
          <button type="button" onClick={() => handleChange('is_remote', !form.is_remote)} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: form.is_remote ? 'var(--color-primary)' : 'var(--border-color)', position: 'relative', cursor: 'pointer' }}>
            <span style={{ position: 'absolute', top: 2, left: form.is_remote ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </button>
        </div>
      </PropertyGroup>
    </StudioPropertiesPanel>
  );

  return (
    <StudioEditorShell
      title={isHt ? 'Editè Travay' : 'Job Editor'}
      icon="fa-briefcase"
      lang={lang}
      docTitle={form.title || (isHt ? 'Travay san tit' : 'Untitled job')}
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
