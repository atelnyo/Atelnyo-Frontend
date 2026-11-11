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

export default function EventEditor({ onClose, onSuccess, onSaved, lang = 'en', showToast, user, item }) {
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
    status: item?.status || 'draft',
    is_free: item?.is_free ?? true,
    price: item?.price != null ? String(item.price) : '',
    currency: item?.currency || 'USD',
    cover_url: item?.cover_url || '',
    trailer_url: item?.trailer_url || '',
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
    if (form.max_attendees !== '' && (!Number.isInteger(Number(form.max_attendees)) || Number(form.max_attendees) <= 0)) {
      errs.max_attendees = isHt ? 'Kapasite dwe yon nonb antye > 0' : 'Capacity must be a whole number > 0';
    }
    if (form.trailer_url.trim() && !/^https?:\/\//i.test(form.trailer_url.trim())) {
      errs.trailer_url = isHt ? 'URL dwe kòmanse ak http(s)://' : 'URL must start with http(s)://';
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
      max_attendees: form.max_attendees === '' ? null : Math.floor(Number(form.max_attendees)),
      // Save = draft, Publish = live. Staff-only 'completed' is never
      // sent from here (backend 403s it) — completion happens server-side.
      status: publish ? 'published' : (isEdit ? form.status : 'draft'),
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <PropField label={isHt ? 'Zòn lè' : 'Timezone'}>
            <select value={form.timezone} onChange={(e) => handleChange('timezone', e.target.value)} className={styles.select}>
              {['America/Port-au-Prince', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Santo_Domingo', 'Europe/Paris', 'Europe/London', 'Africa/Dakar', 'UTC'].map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </PropField>
          <PropField label={isHt ? 'Kapasite (opsyonèl)' : 'Capacity (optional)'} error={errors.max_attendees}>
            <PropInput type="number" min="1" step="1" value={form.max_attendees} onChange={(e) => handleChange('max_attendees', e.target.value)} placeholder={isHt ? 'San limit' : 'Unlimited'} />
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
        <div style={{ marginTop: 16 }}>
          <PropField label={isHt ? 'Videyo demo (opsyonèl)' : 'Demo video (optional)'} error={errors.trailer_url}>
            <PropInput value={form.trailer_url} onChange={(e) => handleChange('trailer_url', e.target.value)} placeholder="YouTube / Vimeo / MP4..." />
          </PropField>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            {isHt ? 'Lyen YouTube/Vimeo oswa MP4 dirèk — jwe sou kard la ak paj detay la.' : 'YouTube/Vimeo link or direct MP4 — plays on the card and detail page.'}
          </p>
        </div>
      </div>

    </div>
  );

  const [cancelArmed, setCancelArmed] = useState(false);
  const handleCancelEvent = useCallback(async () => {
    if (!cancelArmed) {
      setCancelArmed(true);
      setTimeout(() => setCancelArmed(false), 4000);
      return;
    }
    if (!isEdit || !savedIdRef.current) return;
    setSaveState('saving');
    try {
      await communityEventsService.update(savedIdRef.current, { status: 'cancelled' });
      setForm((f) => ({ ...f, status: 'cancelled' }));
      dirtyRef.current = false; setDirty(false); setSaveState('saved');
      onSaved?.();
      showToast?.(isHt ? 'Evènman anile.' : 'Event cancelled.', 'ban');
      setTimeout(() => setSaveState('idle'), 1500);
    } catch (err) {
      showToast?.(err?.response?.data?.detail || (isHt ? 'Pa t kapab anile.' : 'Could not cancel.'), 'circle-exclamation');
      setSaveState('error');
    } finally {
      setCancelArmed(false);
    }
  }, [cancelArmed, isEdit, isHt, onSaved, showToast]);

  const statusBadge = form.status === 'published'
    ? { label: isHt ? 'Pibliye' : 'Published', color: '#059669', bg: 'rgba(16,185,129,0.1)' }
    : form.status === 'cancelled'
      ? { label: isHt ? 'Anile' : 'Cancelled', color: '#64748b', bg: 'rgba(100,116,139,0.12)' }
      : form.status === 'completed'
        ? { label: isHt ? 'Fini' : 'Completed', color: '#2563eb', bg: 'rgba(37,99,235,0.1)' }
        : { label: isHt ? 'Bouyon' : 'Draft', color: '#d97706', bg: 'rgba(245,158,11,0.1)' };

  const propertiesContent = (
    <StudioPropertiesPanel>
      <PropertyGroup title={isHt ? 'Estati' : 'Status'} defaultOpen>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: statusBadge.color, background: statusBadge.bg, borderRadius: 999, padding: '4px 12px' }}>
            {statusBadge.label}
          </span>
        </div>
        {isEdit && form.status === 'published' && (
          <button
            type="button"
            onClick={handleCancelEvent}
            disabled={saveState === 'saving'}
            style={{ marginTop: 12, border: `1px solid ${cancelArmed ? '#dc2626' : 'var(--border-color, #e5e7eb)'}`, background: cancelArmed ? 'rgba(220,38,38,0.1)' : 'transparent', color: cancelArmed ? '#dc2626' : 'inherit', borderRadius: 8, padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', width: '100%' }}
          >
            <i className="fas fa-ban" aria-hidden="true" style={{ marginRight: 6 }} />
            {cancelArmed
              ? (isHt ? 'Konfime anilasyon?' : 'Confirm cancellation?')
              : (isHt ? 'Anile evènman an' : 'Cancel event')}
          </button>
        )}
        {form.status === 'completed' && (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 8 }}>
            {isHt ? 'Evènman fini (staff sèlman ka make sa).' : 'Completed event (staff only).'}
          </p>
        )}
      </PropertyGroup>
      <PropertyGroup title={isHt ? 'Rezime' : 'Summary'} defaultOpen>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <div>🎟 {form.is_free ? (isHt ? 'Gratis' : 'Free') : `${form.price || 0} ${form.currency}`}</div>
          <div>👥 {form.max_attendees || (isHt ? 'San limit' : 'Unlimited')}</div>
          <div>📍 {form.is_online ? (form.online_url || (isHt ? 'Sou entènèt' : 'Online')) : (form.location || '—')}</div>
        </div>
      </PropertyGroup>
    </StudioPropertiesPanel>
  );

  return (
    <StudioEditorShell
      title={isHt ? 'Editè Evènman' : 'Event Editor'}
      icon="fa-calendar-alt"
      lang={lang}
      docTitle={form.title || (isHt ? 'Evènman san tit' : 'Untitled event')}
      isNew={!isEdit}
      badge={hasSaved ? (
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: statusBadge.color, background: statusBadge.bg, borderRadius: 999, padding: '3px 10px', marginLeft: 8 }}>
          {statusBadge.label}
        </span>
      ) : null}
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
