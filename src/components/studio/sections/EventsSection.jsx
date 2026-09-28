/**
 * src/components/studio/sections/EventsSection.jsx
 *
 * Events section — list, create, edit, delete + publish community
 * events from the Creator Studio. Mirrors JobsSection pattern.
 * Uses communityEventsService.list({ created_by: user.id }) so creators
 * only see their own events, including drafts.
 */
import React, { useState } from 'react';
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
  const { data: events, loading, refetch } = useFetch(
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
      onConfirm: async () => {
        try {
          await communityEventsService.delete(item.id);
          showToast?.(lang === 'ht' ? '✅ Evènman efase!' : '✅ Event deleted!', 'check-circle');
          refetch();
        } catch (err) {
          showToast?.(err?.response?.data?.detail || (lang === 'ht' ? 'Pa t kapab efase.' : 'Could not delete.'), 'circle-exclamation');
        }
        setConfirm(null);
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

  if (loading) return <StudioSkeleton rows={3} />;

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
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
