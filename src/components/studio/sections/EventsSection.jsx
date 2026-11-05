/**
 * src/components/studio/sections/EventsSection.jsx
 *
 * Events section — list, create, edit, delete + publish community
 * events from the Creator Studio. Mirrors JobsSection pattern.
 * Uses communityEventsService.list({ created_by: user.id }) so creators
 * only see their own events, including drafts.
 */
import React, { useState, useCallback } from 'react';
import useFetch from '../../../hooks/useFetch';
import { communityEventsService } from '../../../services/api';
import { StudioSkeleton, EmptyState, SectionHeader } from '../shared';
import ConfirmModal from '../../common/ConfirmModal';
import styles from './sections.module.css';

const STATUS_LABEL = {
  draft: 'Draft',
  published: 'Published',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

function formatWhen(ev, lang) {
  if (!ev?.start_time) return '';
  const d = new Date(ev.start_time);
  if (Number.isNaN(d.getTime())) return '';
  const opts = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return d.toLocaleString(lang === 'ht' ? 'fr-HT' : 'en-US', opts);
}

export default function EventsSection({ lang, t, showToast, setShowEventModal, onEdit, user }) {
  const [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const { data: events, loading, refetch, removeLocal } = useFetch(
    () => communityEventsService.list({ created_by: user?.id, limit: 50 }),
    { defaultValue: [], transform: (d) => {
      if (Array.isArray(d)) return d;
      if (d?.results) return d.results;
      return [];
    } },
  );

  const handleDeleteClick = (item) => {
    setConfirm({
      item,
      title: lang === 'ht' ? 'Efase evènman' : 'Delete event',
      message: lang === 'ht'
        ? `Eske w sèten ou vle efase "${item.title}"?`
        : `Are you sure you want to delete "${item.title}"?`,
      onConfirm: () => {
        // Optimistic + non-blocking: the row vanishes instantly AND the
        // dialog closes right away — the DELETE finishes in the
        // background. (Backend cold starts can stall a request 30s+;
        // never trap the user behind a spinner.) A failed delete
        // refetches from the server, which restores the row.
        removeLocal((row) => row.id === item.id);
        setConfirmBusy(false);
        setConfirm(null);
        (async () => {
          try {
            await communityEventsService.delete(item.id);
            showToast?.(lang === 'ht' ? '✅ Evènman efase!' : '✅ Event deleted!', 'check-circle');
          } catch (err) {
            showToast?.(err?.response?.data?.detail || (lang === 'ht' ? 'Pa t kapab efase.' : 'Could not delete.'), 'circle-exclamation');
          }
          refetch();
        })();
      },
    });
  };

  const handlePublish = async (item) => {
    try {
      await communityEventsService.update(item.id, { status: 'published' });
      showToast?.(lang === 'ht' ? 'Evènman pibliye!' : 'Event published!', 'check-circle');
      refetch();
    } catch (err) {
      showToast?.(err?.response?.data?.detail || (lang === 'ht' ? 'Pa t kapab pibliye.' : 'Could not publish.'), 'circle-exclamation');
    }
  };

  // ─── Guest list — organizer sees who is coming ──────────────────────
  // Backend GET community-events/<id>/attendees/ is moderator-only;
  // a 403 simply means "not your event to inspect" → show the message.
  const [expandedAtt, setExpandedAtt] = useState({});
  const [attendees, setAttendees] = useState({});
  const [attLoading, setAttLoading] = useState({});

  const toggleAttendees = useCallback(async (ev) => {
    const next = !expandedAtt[ev.id];
    setExpandedAtt((e) => ({ ...e, [ev.id]: next }));
    if (next && attendees[ev.id] === undefined) {
      setAttLoading((m) => ({ ...m, [ev.id]: true }));
      try {
        const res = await communityEventsService.attendees(ev.id);
        const rows = Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.results) ? res.data.results : []);
        setAttendees((m) => ({ ...m, [ev.id]: rows }));
      } catch (err) {
        setAttendees((m) => ({ ...m, [ev.id]: [] }));
        showToast?.(err?.response?.data?.detail || (lang === 'ht' ? 'Pa t kapab wè envite yo.' : 'Could not load guests.'), 'circle-exclamation');
      } finally {
        setAttLoading((m) => ({ ...m, [ev.id]: false }));
      }
    }
  }, [expandedAtt, attendees, lang, showToast]);

  if (loading && events.length === 0) return <StudioSkeleton rows={3} />;

  const isEmpty = events.length === 0;

  return (
    <div className={styles.section}>
      <SectionHeader
        icon="fa-calendar-check"
        title={lang === 'ht' ? 'Evènman mwen yo' : 'My Events'}
        lang={lang}
        help={{
          ht: 'Evènman kominote ou yo parèt sou paj kominote a. Chwazi yon kominote ak yon dat kòmansman pou pibliye yon evènman.',
          en: 'Your community events appear on the community page. Pick a community and a start time to publish an event.',
        }}
        tip={lang === 'ht'
          ? 'Yon evènman pibliye parèt imedyatman sou paj kominote a — chwazi yon dat nan fiti.'
          : 'A published event shows up immediately on the community page — pick a future start time.'}
        action={
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowEventModal(true)}
          >
            <i className="fas fa-plus" aria-hidden="true" />
            {lang === 'ht' ? 'Kreye Evènman' : 'Create Event'}
          </button>
        }
      />
      {isEmpty ? (
        <EmptyState
          icon="fa-calendar-check"
          title={lang === 'ht' ? 'Poko gen evènman' : 'No events yet'}
          hint={lang === 'ht'
            ? 'Kreye premye evènman ou pou kominote a.'
            : 'Create your first event for the community.'}
          ctaLabel={lang === 'ht' ? 'Kreye Premye Evènman' : 'Create First Event'}
          onCta={() => setShowEventModal(true)}
        />
      ) : (
        <div className={styles.list}>
          {events.map((ev) => {
            const status = ev.status || 'draft';
            return (
              <div key={ev.id} className={styles.listItem}>
                <div className={styles.listIcon} style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>
                  <i className="fas fa-calendar-check" aria-hidden="true" />
                </div>
                <div className={styles.listBody}>
                  <div className={styles.listTitle}>
                    {ev.title}
                    <span
                      className={styles.badge}
                      style={{
                        marginLeft: 8,
                        background: status === 'published'
                          ? 'rgba(16,185,129,0.1)'
                          : status === 'draft' ? 'rgba(245,158,11,0.1)'
                          : 'rgba(100,116,139,0.1)',
                        color: status === 'published' ? '#059669'
                          : status === 'draft' ? '#d97706' : 'var(--color-gray-500)',
                      }}
                    >
                      {STATUS_LABEL[status] || status}
                    </span>
                  </div>
                  <div className={styles.listMeta}>
                    {formatWhen(ev, lang) && <span>📅 {formatWhen(ev, lang)}</span>}
                    {ev.community_name && <span> · {ev.community_name}</span>}
                    {ev.location && <span> · {ev.location}</span>}
                    {ev.is_online && <span> · 🌐 {t.explore_remote || 'Online'}</span>}
                    {ev.is_free === false && ev.price != null && (
                      <span> · ${ev.price} {ev.currency || 'USD'}</span>
                    )}
                  </div>
                  {Array.isArray(ev.tags) && ev.tags.length > 0 && (
                    <div className={styles.tagRow}>
                      {ev.tags.slice(0, 4).map((s) => (
                        <span key={s} className={styles.tag}>#{String(s).replace(/^#/, '')}</span>
                      ))}
                      {ev.tags.length > 4 && (
                        <span className={styles.tag}>+{ev.tags.length - 4}</span>
                      )}
                    </div>
                  )}
                  <div style={{ marginTop: 6 }}>
                    <button
                      type="button"
                      onClick={() => toggleAttendees(ev)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-color, #e5e7eb)', background: 'transparent', borderRadius: 999, padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary, #64748b)', cursor: 'pointer' }}
                      aria-expanded={Boolean(expandedAtt[ev.id])}
                    >
                      <i className="fas fa-users" aria-hidden="true" />
                      {lang === 'ht' ? 'Envite' : 'Guests'}{' '}({ev.attendee_count ?? (attendees[ev.id] || []).length})
                      <i className={`fas fa-chevron-${expandedAtt[ev.id] ? 'up' : 'down'}`} aria-hidden="true" />
                    </button>
                  </div>
                  {expandedAtt[ev.id] && (
                    <div style={{ marginTop: 6, border: '1px solid var(--border-color, #e5e7eb)', borderRadius: 8, padding: 8, fontSize: '0.8rem' }}>
                      {attLoading[ev.id] ? (
                        <span style={{ color: 'var(--text-secondary, #64748b)' }}>
                          <i className="fas fa-spinner fa-spin" aria-hidden="true" /> {lang === 'ht' ? ' Ap chaje…' : ' Loading…'}
                        </span>
                      ) : (attendees[ev.id] || []).length === 0 ? (
                        <span style={{ color: 'var(--text-secondary, #64748b)' }}>
                          {lang === 'ht' ? 'Pokò gen envite konfime.' : 'No confirmed guests yet.'}
                        </span>
                      ) : (
                        (attendees[ev.id] || []).map((a) => (
                          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                            <span style={{ fontWeight: 600 }}>{a.username || `#${a.user}`}</span>
                            <span className={styles.badge} style={{ background: 'rgba(16,185,129,0.1)', color: '#059669' }}>
                              {a.status || 'confirmed'}{a.quantity > 1 ? ` ×${a.quantity}` : ''}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <div className={styles.itemActions}>
                  {status === 'draft' && (
                    <button type="button" className={styles.editBtn} onClick={() => handlePublish(ev)}
                      title={lang === 'ht' ? 'Pibliye' : 'Publish'}>
                      <i className="fas fa-rocket" aria-hidden="true" />
                    </button>
                  )}
                  <button type="button" className={styles.editBtn} onClick={() => onEdit?.(ev)}
                    title={lang === 'ht' ? 'Modifye' : 'Edit'}>
                    <i className="fas fa-pen" aria-hidden="true" />
                  </button>
                  <button type="button" className={styles.deleteBtn} onClick={() => handleDeleteClick(ev)}
                    title={lang === 'ht' ? 'Efase' : 'Delete'}>
                    <i className="fas fa-trash-can" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {confirm && (
        <ConfirmModal
          lang={lang}
          title={confirm.title}
          message={confirm.message}
          confirmText={lang === 'ht' ? 'Efase' : 'Delete'}
          cancelText={lang === 'ht' ? 'Anile' : 'Cancel'}
          loading={confirmBusy}
          onConfirm={confirm.onConfirm}
          onCancel={() => { if (!confirmBusy) setConfirm(null); }}
        />
      )}
    </div>
  );
}
