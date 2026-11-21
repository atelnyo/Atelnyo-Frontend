/**
 * src/components/studio/editor/CommunityEventsPanel.jsx
 *
 * "Evènman" tab of the founder workspace. The founder plans events
 * without leaving the community editor:
 *
 *   * list the community's events, including drafts (moderators are
 *     allowed to see drafts — see CommunityEventViewSet.get_queryset)
 *   * create / edit an event inline (title, description, schedule,
 *     place or online link, capacity, price)
 *   * publish a draft, or delete an event (with confirmation)
 *
 * Endpoints: /api/community-events/ (community is sent as the numeric
 * id on create — same contract as EventFormModal).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { communityEventsService } from '../../../services/api';
import ConfirmModal from '../../common/ConfirmModal';
import PanelSkeleton, {
  ExpandableText, PanelEmpty, PanelError, PanelHeader,
} from './communityPanelUI';
import styles from './communityEditor.module.css';

const asArray = (data) => (Array.isArray(data) ? data : (data?.results || []));
const PAGE_SIZE = 20;

const STATUS_LABELS = {
  draft: { ht: 'Bouyon', en: 'Draft' },
  published: { ht: 'Pibliye', en: 'Published' },
  cancelled: { ht: 'Anile', en: 'Cancelled' },
  completed: { ht: 'Fini', en: 'Completed' },
};

const EMPTY_FORM = {
  title: '',
  description: '',
  start_time: '',
  end_time: '',
  location: '',
  is_online: false,
  online_url: '',
  max_attendees: '',
  is_free: true,
  price: '',
};

const EVENT_TEMPLATES = [
  {
    id: 'meetup',
    icon: 'fa-users',
    label: { en: 'Meetup', ht: 'Rankont' },
    title: { en: 'Community meetup', ht: 'Rankont kominote a' },
    description: {
      en: 'Come meet other members, share ideas, and connect.\n\nAgenda:\n• Welcome & introductions\n• Discussion / activity\n• Next steps',
      ht: 'Vin rankontre lòt manm yo, pataje lide, epi konekte.\n\nPwogram:\n• Byenvini ak prezantasyon\n• Diskisyon / aktivite\n• Pwochen etap',
    },
    is_online: false,
    is_free: true,
  },
  {
    id: 'workshop',
    icon: 'fa-chalkboard-user',
    label: { en: 'Workshop', ht: 'Atelye' },
    title: { en: 'Hands-on workshop', ht: 'Atelye pratik' },
    description: {
      en: 'A practical session where members learn by doing.\n\nWhat we will cover:\n• \n• \n\nWho should join:',
      ht: 'Yon sesyon pratik kote manm yo aprann pandan y ap fè.\n\nSa nou pral kouvri:\n• \n• \n\nKiyès ki ta dwe patisipe:',
    },
    is_online: false,
    is_free: true,
  },
  {
    id: 'qa',
    icon: 'fa-circle-question',
    label: { en: 'Live Q&A', ht: 'Kesyon-repons' },
    title: { en: 'Live Q&A session', ht: 'Sesyon kesyon-repons an dirèk' },
    description: {
      en: 'Bring your questions and get answers live.\n\nTopics:\n• \n\nHow to participate:',
      ht: 'Pote kesyon ou yo epi jwenn repons an dirèk.\n\nSijè:\n• \n\nKijan pou patisipe:',
    },
    is_online: true,
    is_free: true,
  },
];

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtWhen(iso, lang) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(lang === 'ht' ? 'fr-HT' : 'en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function CommunityEventsPanel({
  slug,
  communityId,
  lang = 'en',
  showToast,
  canModerate = true,
}) {
  const isHt = lang === 'ht';
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [attendeesFor, setAttendeesFor] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [attendeesError, setAttendeesError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  // Guards against a slow response for a previous event overwriting the
  // guest list of the event the founder is now looking at.
  const attendeesForRef = useRef(null);

  const [events, setEvents] = useState([]);
  const [totalCount, setTotalCount] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const requestIdRef = useRef(0);

  const fetchPage = useCallback(async (pageToLoad, { append = false } = {}) => {
    const requestId = ++requestIdRef.current;
    if (append) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const res = await communityEventsService.list({
        community: slug,
        page: pageToLoad,
        page_size: PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      if (requestId !== requestIdRef.current) return;
      const data = res?.data;
      const list = asArray(data);
      const count = Array.isArray(data) ? list.length : (typeof data?.count === 'number' ? data.count : null);
      const more = Array.isArray(data)
        ? false
        : (typeof data?.next === 'string' ? Boolean(data.next) : list.length === PAGE_SIZE);
      setEvents((prev) => (append ? [...prev, ...list] : list));
      setTotalCount(count);
      setPage(pageToLoad);
      setHasMore(more);
      setLoadedOnce(true);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (!append) setEvents([]);
      setError(err);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [slug]);

  useEffect(() => {
    setEvents([]);
    setTotalCount(null);
    setPage(1);
    setHasMore(false);
    setLoadedOnce(false);
    fetchPage(1, { append: false });
  }, [slug, fetchPage]);

  const refetch = useCallback(() => {
    fetchPage(1, { append: false });
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loadingMore || loading || !hasMore) return;
    fetchPage(page + 1, { append: true });
  }, [fetchPage, hasMore, loading, loadingMore, page]);

  const initialLoading = loading && !loadedOnce;

  const change = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setComposerOpen(true);
  };

  const applyEventTemplate = (tpl) => {
    const key = isHt ? 'ht' : 'en';
    setEditingId(null);
    setForm((f) => ({
      ...EMPTY_FORM,
      title: tpl.title[key] || tpl.title.en || '',
      description: tpl.description[key] || tpl.description.en || '',
      is_online: Boolean(tpl.is_online),
      is_free: tpl.is_free !== false,
      start_time: f.start_time || '',
      end_time: f.end_time || '',
    }));
  };

  const openEdit = (ev) => {
    setEditingId(ev.id);
    setForm({
      title: ev.title || '',
      description: ev.description || '',
      start_time: toLocalInput(ev.start_time),
      end_time: toLocalInput(ev.end_time),
      location: ev.location || '',
      is_online: Boolean(ev.is_online),
      online_url: ev.online_url || '',
      max_attendees: ev.max_attendees != null ? String(ev.max_attendees) : '',
      is_free: ev.is_free ?? true,
      price: ev.price != null && Number(ev.price) > 0 ? String(ev.price) : '',
    });
    setComposerOpen(true);
  };

  const cancelComposer = () => {
    setComposerOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const submit = useCallback(async () => {
    if (!form.title.trim()) {
      showToast?.(isHt ? 'Tit evènman an obligatwa.' : 'Event title is required.', 'circle-exclamation');
      return;
    }
    if (!form.start_time || !form.end_time) {
      showToast?.(isHt ? 'Dat kòmansman ak fen obligatwa.' : 'Start and end times are required.', 'circle-exclamation');
      return;
    }
    if (new Date(form.end_time) <= new Date(form.start_time)) {
      showToast?.(isHt ? 'Fen an dwe apre kòmansman.' : 'End must be after start.', 'circle-exclamation');
      return;
    }
    if (!form.is_free && !(Number(form.price) > 0)) {
      showToast?.(isHt ? 'Mete yon pri pou evènman peye.' : 'Set a price for a paid event.', 'circle-exclamation');
      return;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      start_time: new Date(form.start_time).toISOString(),
      end_time: new Date(form.end_time).toISOString(),
      timezone: 'America/Port-au-Prince',
      location: form.location.trim(),
      is_online: Boolean(form.is_online),
      online_url: form.online_url.trim(),
      max_attendees: form.max_attendees !== '' ? Number(form.max_attendees) : null,
      is_free: Boolean(form.is_free),
      price: form.is_free ? 0 : Number(form.price || 0),
      currency: 'USD',
    };
    if (!editingId) payload.community = communityId;

    setBusy(true);
    try {
      if (editingId) {
        await communityEventsService.update(editingId, payload);
      } else {
        await communityEventsService.create(payload);
      }
      showToast?.(
        editingId
          ? (isHt ? '✅ Evènman mete ajou.' : '✅ Event updated.')
          : (isHt ? '✅ Evènman kreye (bouyon).' : '✅ Event created (draft).'),
        'check-circle',
      );
      cancelComposer();
      refetch();
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail
          || err?.response?.data?.start_time?.[0]
          || err?.response?.data?.community?.[0]
          || (isHt ? 'Pa t kapab sove evènman an.' : 'Could not save the event.'),
        'circle-exclamation',
      );
    } finally {
      setBusy(false);
    }
  }, [form, editingId, communityId, isHt, showToast, refetch]);

  const publish = useCallback(async (ev) => {
    setBusy(true);
    try {
      await communityEventsService.update(ev.id, { status: 'published' });
      showToast?.(isHt ? 'Evènman pibliye!' : 'Event published!', 'check-circle');
      refetch();
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail || (isHt ? 'Pa t kapab pibliye.' : 'Could not publish.'),
        'circle-exclamation',
      );
    } finally {
      setBusy(false);
    }
  }, [isHt, showToast, refetch]);

  const loadAttendees = useCallback(async (ev) => {
    setAttendeesFor(ev.id);
    attendeesForRef.current = ev.id;
    setAttendeesLoading(true);
    setAttendeesError('');
    setAttendees([]);
    try {
      const res = await communityEventsService.attendees(ev.id);
      if (attendeesForRef.current === ev.id) {
        setAttendees(asArray(res?.data));
      }
    } catch (err) {
      if (attendeesForRef.current === ev.id) {
        setAttendeesError(
          err?.response?.data?.detail
            || (isHt ? 'Pa t kapab chaje lis envite yo.' : 'Could not load the guest list.'),
        );
      }
    } finally {
      if (attendeesForRef.current === ev.id) setAttendeesLoading(false);
    }
  }, [isHt]);

  const toggleAttendees = useCallback((ev) => {
    if (attendeesFor === ev.id) {
      attendeesForRef.current = null;
      setAttendeesFor(null);
      setAttendees([]);
      setAttendeesError('');
      return;
    }
    loadAttendees(ev);
  }, [attendeesFor, loadAttendees]);

  const cancelEvent = useCallback(async () => {
    const target = cancelTarget;
    setCancelTarget(null);
    if (!target) return;
    setBusy(true);
    try {
      await communityEventsService.cancel(target.id);
      showToast?.(
        isHt ? 'Evènman anile. Manm yo pa ka enskri ankò.' : 'Event cancelled. Members can no longer register.',
        'circle-check',
      );
      refetch();
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail || (isHt ? 'Pa t kapab anile evènman an.' : 'Could not cancel the event.'),
        'circle-exclamation',
      );
    } finally {
      setBusy(false);
    }
  }, [cancelTarget, isHt, showToast, refetch]);

  const confirmDelete = useCallback(async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    setBusy(true);
    try {
      await communityEventsService.delete(target.id);
      refetch();
      showToast?.(isHt ? 'Evènman efase.' : 'Event deleted.', 'trash-can');
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail || (isHt ? 'Pa t kapab efase.' : 'Could not delete.'),
        'circle-exclamation',
      );
    } finally {
      setBusy(false);
    }
  }, [deleteTarget, isHt, refetch, showToast]);

  if (initialLoading) {
    return <PanelSkeleton rows={3} label={isHt ? 'Ap chaje evènman yo' : 'Loading events'} />;
  }

  const visibleEvents = statusFilter === 'all'
    ? events
    : events.filter((ev) => (ev.status || 'draft') === statusFilter);
  const filterOptions = [
    { id: 'all', label: isHt ? 'Tout' : 'All' },
    { id: 'draft', label: isHt ? 'Bouyon' : 'Draft' },
    { id: 'published', label: isHt ? 'Pibliye' : 'Published' },
    { id: 'cancelled', label: isHt ? 'Anile' : 'Cancelled' },
    { id: 'completed', label: isHt ? 'Fini' : 'Completed' },
  ];

  return (
    <div>
      <PanelHeader
        icon="fa-calendar-days"
        title={isHt ? 'Evènman kominote a' : 'Community events'}
        count={typeof totalCount === 'number' ? totalCount : events.length}
        subtitle={isHt
          ? 'Evènman pibliye yo parèt sou paj kominote a. Bouyon rete prive jiskaske ou pibliye yo.'
          : 'Published events appear on the community page. Drafts stay private until you publish them.'}
        refreshing={loading && loadedOnce}
        onRefresh={refetch}
        refreshLabel={isHt ? 'Rafrechi evènman yo' : 'Refresh events'}
      >
        {canModerate && !composerOpen && (
          <button type="button" className={styles.primaryBtn} onClick={openCreate}>
            <i className="fas fa-plus" aria-hidden="true" />
            {isHt ? 'Kreye evènman' : 'Create event'}
          </button>
        )}
      </PanelHeader>

      {error && (
        <PanelError
          message={isHt ? 'Pat kapab chaje evènman yo.' : 'Could not load the events.'}
          onRetry={refetch}
          retryLabel={isHt ? 'Reyese' : 'Retry'}
        />
      )}

      {events.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {filterOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={statusFilter === opt.id ? styles.primaryBtn : styles.secondaryBtn}
              onClick={() => setStatusFilter(opt.id)}
              aria-pressed={statusFilter === opt.id}
              style={{ padding: '5px 10px', fontSize: '0.75rem' }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {composerOpen && (
        <div className={styles.composer}>
          {!editingId && (
            <div style={{ marginBottom: 10 }}>
              <div className={styles.fieldLabel} style={{ marginBottom: 6 }}>
                {isHt ? 'Modèl rapid' : 'Quick templates'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {EVENT_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => applyEventTemplate(tpl)}
                    title={isHt ? 'Ranpli fòm lan ak modèl sa a' : 'Fill the form with this template'}
                  >
                    <i className={`fas ${tpl.icon}`} aria-hidden="true" />
                    {isHt ? tpl.label.ht : tpl.label.en}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className={styles.formGrid}>
            <label className={styles.field} style={{ gridColumn: '1 / -1' }}>
              <span className={styles.fieldLabel}>{isHt ? 'Tit' : 'Title'}</span>
              <input
                type="text"
                className={styles.input}
                value={form.title}
                maxLength={200}
                onChange={(e) => change('title', e.target.value)}
                placeholder={isHt ? 'Non evènman an' : 'Event name'}
              />
            </label>
            <label className={styles.field} style={{ gridColumn: '1 / -1' }}>
              <span className={styles.fieldLabel}>{isHt ? 'Deskripsyon' : 'Description'}</span>
              <textarea
                className={styles.textarea}
                rows={2}
                value={form.description}
                maxLength={3000}
                onChange={(e) => change('description', e.target.value)}
                placeholder={isHt ? 'Sa k ap pase nan evènman an?' : 'What happens at this event?'}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{isHt ? 'Kòmansman' : 'Starts'}</span>
              <input
                type="datetime-local"
                className={styles.input}
                value={form.start_time}
                onChange={(e) => change('start_time', e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{isHt ? 'Fen' : 'Ends'}</span>
              <input
                type="datetime-local"
                className={styles.input}
                value={form.end_time}
                onChange={(e) => change('end_time', e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{isHt ? 'Kote' : 'Location'}</span>
              <input
                type="text"
                className={styles.input}
                value={form.location}
                onChange={(e) => change('location', e.target.value)}
                placeholder={isHt ? 'Potoprens, Ayiti' : 'Port-au-Prince, Haiti'}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{isHt ? 'Maks patisipan' : 'Max attendees'}</span>
              <input
                type="number"
                min="0"
                className={styles.input}
                value={form.max_attendees}
                onChange={(e) => change('max_attendees', e.target.value)}
                placeholder={isHt ? 'San limit' : 'Unlimited'}
              />
            </label>
          </div>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={form.is_online}
              onChange={(e) => change('is_online', e.target.checked)}
            />
            {isHt ? 'Evènman an liy' : 'Online event'}
          </label>
          {form.is_online && (
            <input
              type="url"
              className={styles.input}
              value={form.online_url}
              onChange={(e) => change('online_url', e.target.value)}
              placeholder="https://meet.google.com/..."
              aria-label={isHt ? 'Lyen evènman an liy' : 'Online event URL'}
            />
          )}

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={form.is_free}
              onChange={(e) => change('is_free', e.target.checked)}
            />
            {isHt ? 'Evènman gratis' : 'Free event'}
          </label>
          {!form.is_free && (
            <label className={styles.field} style={{ maxWidth: 200 }}>
              <span className={styles.fieldLabel}>{isHt ? 'Pri (USD)' : 'Price (USD)'}</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                className={styles.input}
                value={form.price}
                onChange={(e) => change('price', e.target.value)}
                placeholder="10"
              />
            </label>
          )}

          <div className={styles.composerActions} style={{ gap: 8 }}>
            <button type="button" className={styles.secondaryBtn} onClick={cancelComposer} disabled={busy}>
              {isHt ? 'Anile' : 'Cancel'}
            </button>
            <button type="button" className={styles.primaryBtn} onClick={submit} disabled={busy}>
              <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-save'}`} aria-hidden="true" />
              {editingId ? (isHt ? 'Mete ajou' : 'Update event') : (isHt ? 'Kreye evènman' : 'Create event')}
            </button>
          </div>
        </div>
      )}

      {visibleEvents.length === 0 ? (
        <PanelEmpty
          icon={events.length === 0 ? 'fa-calendar-plus' : 'fa-filter'}
          title={events.length === 0
            ? (isHt ? 'Poko gen evènman.' : 'No events yet.')
            : (isHt ? 'Pa gen evènman pou filtè sa a.' : 'No events match this filter.')}
          description={events.length === 0
            ? (isHt
              ? 'Planifye yon rankont, yon atelye oswa yon fèt pou rasanble manm yo.'
              : 'Plan a meetup, workshop or celebration to gather your members.')
            : (isHt ? 'Chanje filtè a pou wè lòt evènman.' : 'Change the filter to see other events.')}
          action={events.length === 0 && canModerate ? (
            <button type="button" className={styles.secondaryBtn} onClick={openCreate}>
              <i className="fas fa-plus" aria-hidden="true" />
              {isHt ? 'Kreye premye evènman an' : 'Create your first event'}
            </button>
          ) : undefined}
        />
      ) : (
        <>
        <div className={styles.list}>
          {visibleEvents.map((ev) => {
            const status = ev.status || 'draft';
            const label = STATUS_LABELS[status] || STATUS_LABELS.draft;
            return (
              <div key={ev.id} className={styles.row}>
                <div className={styles.avatar} aria-hidden="true" style={{ background: '#a855f7' }}>
                  <i className="fas fa-calendar-day" />
                </div>
                <div className={styles.rowBody}>
                  <div className={styles.rowName}>
                    {ev.title}
                    <span className={`${styles.pill} ${status === 'published' ? styles.pillStaff : ''} ${status === 'cancelled' ? styles.pillMuted : ''}`}>
                      {isHt ? label.ht : label.en}
                    </span>
                  </div>
                  <div className={styles.rowMeta}>
                    {fmtWhen(ev.start_time, lang)}
                    {ev.location ? ` · ${ev.location}` : ''}
                    {ev.is_online ? ` · 🌐 ${isHt ? 'An liy' : 'Online'}` : ''}
                    {ev.is_free === false && ev.price != null ? ` · $${ev.price} ${ev.currency || 'USD'}` : ''}
                    {` · 👥 ${ev.attendee_count ?? 0}${ev.max_attendees ? ` / ${ev.max_attendees}` : ''}`}
                  </div>
                  {ev.description && (
                    <ExpandableText
                      text={ev.description}
                      limit={220}
                      lang={lang}
                      className={styles.rowContent}
                    />
                  )}
                </div>
                {canModerate && (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => toggleAttendees(ev)}
                      disabled={busy}
                      aria-expanded={attendeesFor === ev.id}
                      title={isHt ? 'Lis envite yo' : 'Guest list'}
                      aria-label={isHt ? `Wè envite ${ev.title}` : `View attendees for ${ev.title}`}
                    >
                      <i className="fas fa-user-group" aria-hidden="true" />
                    </button>
                    {status === 'published' && (
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                        onClick={() => setCancelTarget(ev)}
                        disabled={busy}
                        title={isHt ? 'Anile evènman an' : 'Cancel event'}
                        aria-label={isHt ? `Anile ${ev.title}` : `Cancel ${ev.title}`}
                      >
                        <i className="fas fa-ban" aria-hidden="true" />
                      </button>
                    )}
                    {status === 'draft' && (
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => publish(ev)}
                        disabled={busy}
                        title={isHt ? 'Pibliye' : 'Publish'}
                        aria-label={isHt ? `Pibliye ${ev.title}` : `Publish ${ev.title}`}
                      >
                        <i className="fas fa-rocket" aria-hidden="true" />
                      </button>
                    )}
                    {(status === 'draft' || status === 'published') && (
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => openEdit(ev)}
                        disabled={busy}
                        title={isHt ? 'Modifye' : 'Edit'}
                        aria-label={isHt ? `Modifye ${ev.title}` : `Edit ${ev.title}`}
                      >
                        <i className="fas fa-pen" aria-hidden="true" />
                      </button>
                    )}
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                      onClick={() => setDeleteTarget(ev)}
                      disabled={busy}
                      title={isHt ? 'Efase' : 'Delete'}
                      aria-label={isHt ? `Efase ${ev.title}` : `Delete ${ev.title}`}
                    >
                      <i className="fas fa-trash-can" aria-hidden="true" />
                    </button>
                  </div>
                )}
                {attendeesFor === ev.id && (
                  <div className={styles.subPanel}>
                    <div className={styles.subPanelHead}>
                      <span>
                        <i className="fas fa-user-group" aria-hidden="true" />{' '}
                        {isHt ? 'Envite' : 'Attendees'}
                        {` (${attendees.length})`}
                      </span>
                      {attendees.length > 0 && (
                        <span>
                          {attendees.reduce((sum, t) => sum + (Number(t.quantity) || 1), 0)}
                          {isHt ? ' plas' : ' seats'}
                        </span>
                      )}
                    </div>
                    {attendeesLoading ? (
                      <div className={styles.subEmpty}>
                        <i className="fas fa-spinner fa-spin" aria-hidden="true" />{' '}
                        {isHt ? 'Ap chaje envite yo…' : 'Loading attendees…'}
                      </div>
                    ) : attendeesError ? (
                      <div className={styles.subError}>
                        <span>{attendeesError}</span>
                        <button type="button" className={styles.linkBtn} onClick={() => loadAttendees(ev)}>
                          {isHt ? 'Reyese' : 'Retry'}
                        </button>
                      </div>
                    ) : attendees.length === 0 ? (
                      <div className={styles.subEmpty}>
                        {isHt
                          ? 'Poko gen moun ki enskri nan evènman sa a.'
                          : 'No one has registered for this event yet.'}
                      </div>
                    ) : (
                      <div className={styles.subList}>
                        {attendees.map((ticket) => (
                          <div key={ticket.id} className={styles.subRow}>
                            <div
                              className={styles.avatar}
                              style={{ width: 28, height: 28, fontSize: '0.64rem' }}
                              aria-hidden="true"
                            >
                              {(ticket.username || '?').slice(0, 2).toUpperCase()}
                            </div>
                            <div className={styles.subText}>
                              <div className={styles.rowName}>
                                @{ticket.username || 'membre'}
                                <span className={`${styles.pill} ${ticket.status === 'confirmed' ? styles.pillStaff : styles.pillOwner}`}>
                                  {ticket.status === 'confirmed'
                                    ? (isHt ? 'Konfime' : 'Confirmed')
                                    : (isHt ? 'Rezève' : 'Reserved')}
                                </span>
                              </div>
                              <div className={styles.subMeta}>
                                {`${ticket.quantity || 1} ${isHt ? 'plas' : 'seat(s)'}`}
                                {Number(ticket.price_paid) > 0 && ` · $${ticket.price_paid} ${ticket.currency || 'USD'}`}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {hasMore && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
            <button
              type="button"
              className={styles.actionButton}
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore
                ? (isHt ? 'Ap chaje…' : 'Loading…')
                : (isHt ? 'Chaje plis evènman' : 'Load more events')}
            </button>
          </div>
        )}
        </>
      )}

      {cancelTarget && (
        <ConfirmModal
          lang={lang}
          title={isHt ? 'Anile evènman an?' : 'Cancel event?'}
          message={isHt
            ? `« ${cancelTarget.title} » ap rete vizib, men manm yo p ap ka enskri ankò e tikè ki deja konfime yo ap rete sou dosye.`
            : `"${cancelTarget.title}" stays visible, but members can no longer register and already confirmed tickets remain on record.`}
          confirmText={isHt ? 'Anile evènman an' : 'Cancel event'}
          cancelText={isHt ? 'Kenbe l' : 'Keep it'}
          onConfirm={cancelEvent}
          onCancel={() => setCancelTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          lang={lang}
          title={isHt ? 'Efase evènman an?' : 'Delete event?'}
          message={isHt
            ? `« ${deleteTarget.title} » ap disparèt pou manm yo. Tikè ak envitasyon ki gen rapò ak li p ap valab ankò.`
            : `"${deleteTarget.title}" will be removed for members. Related tickets and RSVPs will no longer be valid.`}
          confirmText={isHt ? 'Efase' : 'Delete'}
          cancelText={isHt ? 'Anile' : 'Cancel'}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
