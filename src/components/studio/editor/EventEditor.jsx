/**
 * src/components/studio/editor/EventEditor.jsx
 */
import React, { useCallback, useRef, useState } from 'react';
import useFetch from '../../../hooks/useFetch';
import { communityEventsService, communitiesService } from '../../../services/api';
import { parseHashtags, hashtagsToInput } from '../../../utils/hashtags';
import StudioEditorShell from './StudioEditorShell';
import StudioPropertiesPanel, { PropertyGroup, PropField, PropInput } from './StudioPropertiesPanel';
import { ImageUrlField } from '../modals/shared';
import styles from './editor.module.css';

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventEditor({ onClose, onSuccess, onSaved, lang = 'ht', showToast, user, item }) {
  const isHt = lang === 'ht';
  const isEdit = Boolean(item);

  const [form, setForm] = useState({
    title: item?.title || '',
    description: item?.description || '',
    hashtags: hashtagsToInput(item?.tags),
    community: item?.community ?? '',
    start_time: toLocalInput(item?.start_time),
    end_time: toLocalInput(item?.end_time),
    timezone: item?.timezone || 'America/Port-au-Prince',
    location: item?.location || '',
    is_online: item?.is_online ?? false,
    online_url: item?.online_url || '',
    max_attendees: item?.max_attendees != null ? String(item.max_attendees) : '',
    is_free: item?.is_free ?? true,
    price: item?.price != null ? String(item.price) : '',
    currency: item?.currency || 'USD',
    cover_url: item?.cover_url || '',
    trailer_url: item?.trailer_url || '',
    visibility: item?.visibility || 'public',
  });
  const [errors, setErrors] = useState({});
  const [saveState, setSaveState] = useState('idle');
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [hasSaved, setHasSaved] = useState(isEdit);
  const savedIdRef = useRef(isEdit ? item.id : null);

  const { data: communities } = useFetch(
    () => communitiesService.list({ limit: 50 }),
    { defaultValue: [], transform: (d) => Array.isArray(d) ? d : (d?.results || []) },
  );

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
    if (!form.community) errs.community = isHt ? 'Chwazi kominote' : 'Pick a community';
    if (!form.start_time) errs.start_time = isHt ? 'Kòmansman oblije' : 'Start required';
    if (!form.end_time) errs.end_time = isHt ? 'Fen oblije' : 'End required';
    if (form.start_time && form.end_time && new Date(form.end_time) <= new Date(form.start_time)) {
      errs.end_time = isHt ? 'Fen dwe apre kòmansman' : 'End must be after start';
    }
    if (!form.is_free) {
      if (form.price === '' || !Number.isFinite(Number(form.price)) || Number(form.price) <= 0) {
        errs.price = isHt ? 'Pri obligatwa' : 'Price required';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form, isHt]);

  const doSave = useCallback(async (publish = false) => {
    if (!validate()) { setSaveState('error'); return false; }
    setSaveState('saving');
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      tags: parseHashtags(form.hashtags),
      community: form.community,
      start_time: form.start_time ? new Date(form.start_time).toISOString() : null,
      end_time: form.end_time ? new Date(form.end_time).toISOString() : null,
      timezone: form.timezone,
      location: form.location.trim() || '',
      is_online: Boolean(form.is_online),
      online_url: form.online_url.trim() || '',
      max_attendees: form.max_attendees === '' ? null : Number(form.max_attendees),
      is_free: Boolean(form.is_free),
      price: form.is_free ? '0.00' : String(Number(form.price) || 0),
      currency: form.currency,
      cover_url: form.cover_url.trim() || '',
      trailer_url: form.trailer_url.trim() || '',
    };
    try {
      let res;
      if (isEdit && savedIdRef.current) res = await communityEventsService.update(savedIdRef.current, payload);
      else { res = await communityEventsService.create(payload); if (res?.data?.id) savedIdRef.current = res.data.id; setHasSaved(true); }
      dirtyRef.current = false; setDirty(false); setSaveState('saved');
      onSaved?.();
      showToast?.(isHt ? '✅ Evènman sove' : '✅ Event saved', 'check-circle');
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
  if (!form.community) validationList.push({ id: 'community', label: isHt ? 'Kominote obligatwa' : 'Community required', zone: 'editor' });
  if (!form.start_time) validationList.push({ id: 'start_time', label: isHt ? 'Kòmansman obligatwa' : 'Start required', zone: 'editor' });
  if (!form.end_time) validationList.push({ id: 'end_time', label: isHt ? 'Fen obligatwa' : 'End required', zone: 'editor' });

  const editorContent = (
    <div className={styles.editorMain} style={{ padding: 24, maxWidth: 900, margin: '0 auto', width: '100%' }}>
      {errors._api && <div className={styles.apiError} role="alert" style={{ marginBottom: 16 }}>{errors._api}</div>}
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}><i className="fas fa-calendar-alt" /> {isHt ? 'Enfòmasyon Evènman' : 'Event Info'}</h3>
        <div style={{ display: 'grid', gap: 16 }}>
          <PropField label={isHt ? 'Tit' : 'Title'} required error={errors.title}>
            <PropInput value={form.title} onChange={(e) => handleChange('title', e.target.value)} />
          </PropField>
          <PropField label={isHt ? 'Kominote' : 'Community'} required error={errors.community}>
            <select value={form.community} onChange={(e) => handleChange('community', e.target.value)} className={styles.select}>
              <option value="">{isHt ? '-- Chwazi --' : '-- Select --'}</option>
              {(communities || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </PropField>
          <PropField label={isHt ? 'Deskripsyon' : 'Description'}>
            <textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)} className={styles.textarea} rows={5} />
          </PropField>
          <PropField label={isHt ? 'Hashtags' : 'Hashtags'}>
            <PropInput value={form.hashtags} onChange={(e) => handleChange('hashtags', e.target.value)} placeholder="#evènman #konser" />
          </PropField>
        </div>
      </div>
      <div className={styles.formSection} style={{ marginTop: 24 }}>
        <h3 className={styles.sectionTitle}><i className="fas fa-clock" /> {isHt ? 'Dat & Lè' : 'Date & Time'}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <PropField label={isHt ? 'Kòmanse' : 'Start'} required error={errors.start_time}>
            <input type="datetime-local" value={form.start_time} onChange={(e) => handleChange('start_time', e.target.value)} className={styles.input} />
          </PropField>
          <PropField label={isHt ? 'Fini' : 'End'} required error={errors.end_time}>
            <input type="datetime-local" value={form.end_time} onChange={(e) => handleChange('end_time', e.target.value)} className={styles.input} />
          </PropField>
        </div>
      </div>
      <div className={styles.formSection} style={{ marginTop: 24 }}>
        <h3 className={styles.sectionTitle}><i className="fas fa-map-marker-alt" /> {isHt ? 'Kote' : 'Location'}</h3>
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.is_online} onChange={(e) => handleChange('is_online', e.target.checked)} />
            <span>{isHt ? 'Evènman sou entènèt' : 'Online event'}</span>
          </div>
          {form.is_online ? (
            <PropField label={isHt ? 'URL sou entènèt' : 'Online URL'}>
              <PropInput value={form.online_url} onChange={(e) => handleChange('online_url', e.target.value)} />
            </PropField>
          ) : (
            <PropField label={isHt ? 'Adrès' : 'Address'}>
              <PropInput value={form.location} onChange={(e) => handleChange('location', e.target.value)} />
            </PropField>
          )}
        </div>
      </div>
      <div className={styles.formSection} style={{ marginTop: 24 }}>
        <h3 className={styles.sectionTitle}><i className="fas fa-ticket-alt" /> {isHt ? 'Tikè' : 'Tickets'}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <input type="checkbox" checked={form.is_free} onChange={(e) => handleChange('is_free', e.target.checked)} />
          <span>{isHt ? 'Gratis' : 'Free'}</span>
        </div>
        {!form.is_free && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <PropField label={isHt ? 'Pri' : 'Price'} error={errors.price}>
              <PropInput type="number" value={form.price} onChange={(e) => handleChange('price', e.target.value)} />
            </PropField>
            <PropField label={isHt ? 'Lajan' : 'Currency'}>
              <PropInput value={form.currency} onChange={(e) => handleChange('currency', e.target.value)} />
            </PropField>
          </div>
        )}
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

  const propertiesContent = <StudioPropertiesPanel><PropertyGroup title={isHt ? 'Paramèt' : 'Settings'} defaultOpen><div style={{ fontSize: '0.875rem' }}>{isHt ? 'Evènman' : 'Event'}</div></PropertyGroup></StudioPropertiesPanel>;

  return (
    <StudioEditorShell
      title={isHt ? 'Editè Evènman' : 'Event Editor'}
      icon="fa-calendar-alt"
      lang={lang}
      docTitle={form.title || (isHt ? 'Evènman san tit' : 'Untitled event')}
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
