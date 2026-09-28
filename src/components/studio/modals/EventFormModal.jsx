/**
 * src/components/studio/modals/EventFormModal.jsx
 *
 * Modal for creating/editing a community event. POST/PATCH to
 * /api/community-events/. Mirrors JobFormModal pattern + includes the
 * #hashtags field so events feed the trending hashtag engine.
 */
import React, { useState, useCallback } from 'react';
import useFetch from '../../../hooks/useFetch';
import { communityEventsService, communitiesService } from '../../../services/api';
import { StudioModal, FormField, LoadingOverlay, MediaUrlField, HelpTip, HELP_COPY } from './shared';
import { parseHashtags, hashtagsToInput } from '../../../utils/hashtags';
import styles from './modals.module.css';

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventFormModal({ onClose, onSuccess, lang, showToast, event }) {
  const isEdit = Boolean(event);
  const [form, setForm] = useState({
    title: event?.title || '',
    description: event?.description || '',
    hashtags: hashtagsToInput(event?.tags),
    community: event?.community ?? '',
    start_time: toLocalInput(event?.start_time),
    end_time: toLocalInput(event?.end_time),
    timezone: event?.timezone || 'America/Port-au-Prince',
    location: event?.location || '',
    is_online: event?.is_online ?? false,
    online_url: event?.online_url || '',
    max_attendees: event?.max_attendees != null ? String(event.max_attendees) : '',
    is_free: event?.is_free ?? true,
    price: event?.price != null ? String(event.price) : '',
    currency: event?.currency || 'USD',
    cover_url: event?.cover_url || '',
    trailer_url: event?.trailer_url || '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const { data: communities, loading: loadingCommunities } = useFetch(
    () => communitiesService.list({ limit: 50 }),
    { defaultValue: [], transform: (d) => {
      if (Array.isArray(d)) return d;
      if (d?.results) return d.results;
      return [];
    } },
  );

  const handleChange = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
  }, [errors]);

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = lang === 'ht' ? 'Tit oblije' : 'Title required';
    if (!form.community) errs.community = lang === 'ht' ? 'Chwazi yon kominote' : 'Pick a community';
    if (!form.start_time) errs.start_time = lang === 'ht' ? 'Dat kòmansman oblije' : 'Start time required';
    if (!form.end_time) errs.end_time = lang === 'ht' ? 'Dat fen oblije' : 'End time required';
    if (form.start_time && form.end_time && new Date(form.end_time) <= new Date(form.start_time)) {
      errs.end_time = lang === 'ht' ? 'Fen dwe apre kòmansman' : 'End must be after start';
    }
    if (!form.is_free) {
      if (form.price === '' || !Number.isFinite(Number(form.price)) || Number(form.price) <= 0) {
        errs.price = lang === 'ht' ? 'Pri oblije (pou evènman peye)' : 'Price required for paid events';
      }
    }
    return errs;
  };

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      tags: parseHashtags(form.hashtags),
      community: form.community,
      start_time: new Date(form.start_time).toISOString(),
      end_time: new Date(form.end_time).toISOString(),
      timezone: form.timezone.trim() || 'America/Port-au-Prince',
      location: form.location.trim(),
      is_online: Boolean(form.is_online),
      online_url: form.online_url.trim(),
      max_attendees: form.max_attendees !== '' ? Number(form.max_attendees) : null,
      is_free: Boolean(form.is_free),
      price: form.is_free ? 0 : Number(form.price || 0),
      currency: form.currency.trim() || 'USD',
      cover_url: form.cover_url.trim(),
      trailer_url: form.trailer_url.trim(),
    };

    try {
      if (isEdit) {
        await communityEventsService.update(event.id, payload);
      } else {
        await communityEventsService.create(payload);
      }
      showToast?.(
        isEdit
          ? (lang === 'ht' ? '✅ Evènman mete ajou!' : '✅ Event updated!')
          : (lang === 'ht' ? '✅ Evènman kreye!' : '✅ Event created!'),
        'check-circle',
      );
      onSuccess?.(); onClose?.();
    } catch (err) {
      const detail = err?.response?.data?.detail
        || err?.response?.data?.title?.[0]
        || err?.response?.data?.start_time?.[0]
        || err?.response?.data?.community?.[0]
        || err?.message
        || (lang === 'ht' ? 'Pa t kapab sove evènman an.' : 'Could not save event.');
      setErrors((e) => ({ ...e, _api: detail }));
      showToast?.(detail, 'circle-exclamation');
    } finally { setLoading(false); }
  }, [form, isEdit, event, lang, showToast, onSuccess, onClose]);

  return (
    <StudioModal onClose={onClose} icon="fa-calendar-check" wide
      title={isEdit
        ? (lang === 'ht' ? 'Modifye Evènman' : 'Edit Event')
        : (lang === 'ht' ? 'Kreye Evènman' : 'Create Event')}
      subtitle={lang === 'ht'
        ? 'Pibliye yon evènman nan yon kominote'
        : 'Publish an event in a community'}>
      <form onSubmit={handleSubmit} className={styles.form}>
        {errors._api && <div className={styles.apiError} role="alert">{errors._api}</div>}
        <LoadingOverlay loading={loading}>
          <FormField label={lang === 'ht' ? 'Tit' : 'Title'} required error={errors.title}>
            <input className={styles.input} value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder={lang === 'ht' ? 'Antre tit evènman an' : 'Enter event title'}
              maxLength={200} autoFocus />
          </FormField>
          <FormField label={lang === 'ht' ? 'Kominote' : 'Community'} required error={errors.community}
            hint={!loadingCommunities && communities.length === 0
              ? (lang === 'ht'
                ? 'Ou poko gen kominote — kreye yon kominote anvan ou pibliye yon evènman.'
                : 'No communities yet — create a community before publishing an event.')
              : undefined}>
            <select className={styles.input} value={form.community}
              onChange={(e) => handleChange('community', e.target.value)}
              disabled={loadingCommunities || communities.length === 0}>
              <option value="">
                {lang === 'ht' ? 'Chwazi yon kominote...' : 'Select a community...'}
              </option>
              {communities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label={lang === 'ht' ? 'Deskripsyon' : 'Description'}>
            <textarea className={styles.textarea} value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder={lang === 'ht' ? 'Dekri evènman an...' : 'Describe the event...'}
              rows={4} maxLength={3000} />
          </FormField>
          <FormField label={lang === 'ht' ? 'Hashtags' : 'Hashtags'}
            hint={lang === 'ht' ? 'Separe ak espas — #Atelnyo #Kreyol (alimante trending)' : 'Separate with spaces — #Atelnyo #Kreyol (feeds trending)'}>
            <div className={styles.inputWithHelp}>
              <input className={styles.input} value={form.hashtags}
                onChange={(e) => handleChange('hashtags', e.target.value)}
                placeholder="#Atelnyo #Kreyol #Education" maxLength={120} />
              <HelpTip help={HELP_COPY.hashtags} lang={lang} />
            </div>
          </FormField>
          <div className={styles.row}>
            <FormField label={lang === 'ht' ? 'Kòmansman' : 'Starts'} required error={errors.start_time}>
              <input className={styles.input} type="datetime-local" value={form.start_time}
                onChange={(e) => handleChange('start_time', e.target.value)} />
            </FormField>
            <FormField label={lang === 'ht' ? 'Fen' : 'Ends'} required error={errors.end_time}>
              <input className={styles.input} type="datetime-local" value={form.end_time}
                onChange={(e) => handleChange('end_time', e.target.value)} />
            </FormField>
          </div>
          <div className={styles.row}>
            <FormField label={lang === 'ht' ? 'Kote' : 'Location'}>
              <input className={styles.input} value={form.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder={lang === 'ht' ? 'Potoprens, Ayiti' : 'Port-au-Prince, Haiti'} />
            </FormField>
            <FormField label={lang === 'ht' ? 'Fuseau' : 'Timezone'}>
              <input className={styles.input} value={form.timezone}
                onChange={(e) => handleChange('timezone', e.target.value)}
                maxLength={64} />
            </FormField>
          </div>
          <div className={styles.toggleRow}>
            <span className={styles.toggleLabel}>
              {lang === 'ht' ? 'Evènman an liy' : 'Online event'}
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary, #888)', fontWeight: 400 }}>
                {lang === 'ht' ? 'Moun kapab patisipe a distans' : 'People can join remotely'}
              </span>
            </span>
            <button
              type="button"
              className={`${styles.toggle} ${form.is_online ? styles.toggleOn : ''}`}
              onClick={() => handleChange('is_online', !form.is_online)}
              role="switch"
              aria-checked={form.is_online}
              aria-label={lang === 'ht' ? 'Evènman an liy' : 'Online event'}
            >
              <span className={styles.toggleKnob} />
            </button>
          </div>
          {form.is_online && (
            <FormField label={lang === 'ht' ? 'Liy evènman (URL)' : 'Online event URL'}>
              <div className={styles.inputWithHelp}>
                <input className={styles.input} value={form.online_url}
                  onChange={(e) => handleChange('online_url', e.target.value)}
                  placeholder="https://meet.google.com/..." />
                <HelpTip help={{
                  ht: 'Lyen patisipasyon an (Google Meet, Zoom, YouTube Live, elatriye). Patisipan yo pral wè l sou paj evènman an. Li ka yon lyen videyo YouTube tou.',
                  en: 'The join link (Google Meet, Zoom, YouTube Live, etc.). Attendees will see it on the event page. It can also be a YouTube video link.',
                }} lang={lang} />
              </div>
            </FormField>
          )}
          <div className={styles.row}>
            <FormField label={lang === 'ht' ? 'Maks patisipan' : 'Max attendees'}>
              <input className={styles.input} type="number" min="0"
                value={form.max_attendees}
                onChange={(e) => handleChange('max_attendees', e.target.value)}
                placeholder={lang === 'ht' ? 'San limit' : 'Unlimited'} />
            </FormField>
            <MediaUrlField
              label={lang === 'ht' ? 'URL kouvèti' : 'Cover URL'}
              value={form.cover_url}
              onChange={(v) => handleChange('cover_url', v)}
              kind="auto"
              lang={lang}
              help={HELP_COPY.cover}
              placeholder="https://example.com/cover.jpg"
            />
          </div>
          <MediaUrlField
            label={lang === 'ht' ? 'URL trailer' : 'Trailer URL'}
            value={form.trailer_url}
            onChange={(v) => handleChange('trailer_url', v)}
            kind="video"
            lang={lang}
            help={HELP_COPY.video}
            placeholder="https://youtube.com/watch?v=..."
          />
          <div className={styles.toggleRow}>
            <span className={styles.toggleLabel}>
              {lang === 'ht' ? 'Gratis' : 'Free event'}
            </span>
            <button
              type="button"
              className={`${styles.toggle} ${form.is_free ? styles.toggleOn : ''}`}
              onClick={() => handleChange('is_free', !form.is_free)}
              role="switch"
              aria-checked={form.is_free}
              aria-label={lang === 'ht' ? 'Gratis' : 'Free event'}
            >
              <span className={styles.toggleKnob} />
            </button>
          </div>
          {!form.is_free && (
            <div className={styles.row}>
              <FormField label={lang === 'ht' ? 'Pri ($)' : 'Price ($)'} required error={errors.price}>
                <input className={styles.input} type="number" min="0.01" step="0.01"
                  value={form.price}
                  onChange={(e) => handleChange('price', e.target.value)}
                  placeholder="10" />
              </FormField>
              <FormField label={lang === 'ht' ? 'Deviz' : 'Currency'}>
                <input className={styles.input} value={form.currency}
                  onChange={(e) => handleChange('currency', e.target.value)}
                  maxLength={3} placeholder="USD" />
              </FormField>
            </div>
          )}
        </LoadingOverlay>
        <div className={styles.actions}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            {lang === 'ht' ? 'Anile' : 'Cancel'}
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <><i className="fas fa-spinner fa-spin" /> {lang === 'ht' ? 'Ap sove...' : 'Saving...'}</>
            ) : (
              <><i className="fas fa-save" /> {isEdit
                ? (lang === 'ht' ? 'Mete ajou' : 'Update')
                : (lang === 'ht' ? 'Kreye Evènman' : 'Create Event')}</>
            )}
          </button>
        </div>
      </form>
    </StudioModal>
  );
}
