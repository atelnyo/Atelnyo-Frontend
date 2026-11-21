/**
 * src/components/studio/editor/CommunityAnnouncementsPanel.jsx
 *
 * "Anons" tab of the founder workspace — the founder's broadcast tool.
 * Founders write an announcement, optionally pin it to the top of the
 * community home, edit a published one, and delete stale ones. Pinned
 * rows sort first (server-side ordering: -is_pinned, -created_at).
 *
 * Endpoints (flat route, scoped by ?community=<slug>):
 *   GET/POST  community-announcements/
 *   PATCH     community-announcements/<id>/   (pin/unpin, edit)
 *   DELETE    community-announcements/<id>/
 * Writes are manager-only — enforced server-side in the viewset.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { communitiesService } from '../../../services/api';
import ConfirmModal from '../../common/ConfirmModal';
import PanelSkeleton, {
  ExpandableText, PanelEmpty, PanelError, PanelHeader,
} from './communityPanelUI';
import styles from './communityEditor.module.css';

const asArray = (data) => (Array.isArray(data) ? data : (data?.results || []));
const PAGE_SIZE = 20;

const fmtDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const PREVIEW_LENGTH = 220;
const EMPTY_FORM = { title: '', content: '', is_pinned: false };

const ANNOUNCEMENT_TEMPLATES = [
  {
    id: 'welcome',
    icon: 'fa-hand-sparkles',
    label: { en: 'Welcome', ht: 'Byenvini' },
    title: { en: 'Welcome to our community!', ht: 'Byenvini nan kominote nou an!' },
    content: {
      en: 'We are glad to have you here.\n\n• Introduce yourself in the feed\n• Read the community rules\n• Explore upcoming events and shared resources\n\nIf you have questions, reach out to a moderator.',
      ht: 'Nou kontan wè ou la.\n\n• Prezante tèt ou nan fil la\n• Li règ kominote a\n• Dekouvri evènman ak resous nou pataje\n\nSi w gen kesyon, pale ak yon moderatè.',
    },
    is_pinned: true,
  },
  {
    id: 'weekly',
    icon: 'fa-calendar-week',
    label: { en: 'Weekly update', ht: 'Mizajou chak semèn' },
    title: { en: 'Weekly update', ht: 'Mizajou semèn sa a' },
    content: {
      en: 'Here is what is happening this week:\n\n• Highlights:\n• Upcoming events:\n• What members should do next:',
      ht: 'Men sa k ap pase semèn sa a:\n\n• Pwen enpòtan:\n• Evènman k ap vini:\n• Sa manm yo ka fè kounye a:',
    },
    is_pinned: false,
  },
  {
    id: 'event',
    icon: 'fa-calendar-day',
    label: { en: 'Event reminder', ht: 'Rapèl evènman' },
    title: { en: 'Event reminder', ht: 'Rapèl evènman' },
    content: {
      en: 'Join us for our upcoming event.\n\n• Date & time:\n• Where / link:\n• What to bring or prepare:',
      ht: 'Vin patisipe nan evènman nou an.\n\n• Dat ak lè:\n• Kote / lyen:\n• Sa pou w pote oswa prepare:',
    },
    is_pinned: false,
  },
  {
    id: 'rules',
    icon: 'fa-shield-halved',
    label: { en: 'Rules reminder', ht: 'Rapèl règ' },
    title: { en: 'Community guidelines reminder', ht: 'Rapèl sou règ kominote a' },
    content: {
      en: 'Please keep our community safe and helpful:\n\n• Be respectful\n• Stay on topic\n• No spam or harmful content\n\nPosts or comments that break the rules may be removed.',
      ht: 'Tanpri ede nou kenbe kominote a an sekirite epi itil:\n\n• Respekte tout moun\n• Rete nan sijè a\n• Pa voye spam oswa kontni ki ka fè mal\n\nPòs oswa kòmantè ki vyole règ yo ka efase.',
    },
    is_pinned: true,
  },
];

export default function CommunityAnnouncementsPanel({ slug, lang = 'en', showToast }) {
  const isHt = lang === 'ht';
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);  const [announcements, setAnnouncements] = useState([]);
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
      const res = await communitiesService.announcements(slug, { page: pageToLoad, page_size: PAGE_SIZE });
      if (requestId !== requestIdRef.current) return;
      const data = res?.data;
      const list = asArray(data);
      const count = Array.isArray(data) ? list.length : (typeof data?.count === 'number' ? data.count : null);
      const more = Array.isArray(data)
        ? false
        : (typeof data?.next === 'string' ? Boolean(data.next) : list.length === PAGE_SIZE);
      setAnnouncements((prev) => (append ? [...prev, ...list] : list));
      setTotalCount(count);
      setPage(pageToLoad);
      setHasMore(more);
      setLoadedOnce(true);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (!append) setAnnouncements([]);
      setError(err);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [slug]);

  useEffect(() => {
    setAnnouncements([]);
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

  const resetComposer = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const applyTemplate = (tpl) => {
    const key = isHt ? 'ht' : 'en';
    setForm({
      title: tpl.title[key] || tpl.title.en || '',
      content: tpl.content[key] || tpl.content.en || '',
      is_pinned: Boolean(tpl.is_pinned),
    });
    setEditingId(null);
  };

  const startEdit = (announcement) => {
    setEditingId(announcement.id);
    setForm({
      title: announcement.title || '',
      content: announcement.content || '',
      is_pinned: Boolean(announcement.is_pinned),
    });
  };

  const save = useCallback(async () => {
    const title = form.title.trim();
    const content = form.content.trim();
    if (!title || !content) {
      showToast?.(isHt ? 'Tit ak kontni obligatwa.' : 'Title and content are required.', 'circle-exclamation');
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        await communitiesService.updateAnnouncement(editingId, {
          title,
          content,
          is_pinned: Boolean(form.is_pinned),
        });
      } else {
        await communitiesService.createAnnouncement(slug, {
          title,
          content,
          is_pinned: Boolean(form.is_pinned),
        });
      }
      resetComposer();
      refetch();
      showToast?.(
        editingId
          ? (isHt ? '✅ Anons lan mete ajou.' : '✅ Announcement updated.')
          : (isHt ? '✅ Anons pibliye — manm yo notifye.' : '✅ Announcement published — members notified.'),
        'check-circle',
      );
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail || (isHt ? 'Pa t kapab sove anons lan.' : 'Could not save the announcement.'),
        'circle-exclamation',
      );
    } finally {
      setBusy(false);
    }
  }, [form, editingId, isHt, refetch, showToast, slug]);

  const togglePin = useCallback(async (announcement) => {
    if (busy) return;
    setBusy(true);
    try {
      await communitiesService.updateAnnouncement(announcement.id, { is_pinned: !announcement.is_pinned });
      refetch();
      showToast?.(
        announcement.is_pinned
          ? (isHt ? 'Anons lan dekloure.' : 'Announcement unpinned.')
          : (isHt ? 'Anons lan kloure anlè.' : 'Announcement pinned to the top.'),
        'thumbtack',
      );
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail || (isHt ? 'Pa t kapab chanje kloure a.' : 'Could not change the pin.'),
        'circle-exclamation',
      );
    } finally {
      setBusy(false);
    }
  }, [busy, isHt, refetch, showToast]);

  const confirmDelete = useCallback(async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    setBusy(true);
    try {
      await communitiesService.deleteAnnouncement(target.id);
      if (editingId === target.id) resetComposer();
      refetch();
      showToast?.(isHt ? 'Anons lan efase.' : 'Announcement deleted.', 'trash-can');
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail || (isHt ? 'Pa t kapab efase anons lan.' : 'Could not delete the announcement.'),
        'circle-exclamation',
      );
    } finally {
      setBusy(false);
    }
  }, [deleteTarget, editingId, isHt, refetch, showToast]);

  if (initialLoading) {
    return <PanelSkeleton variant="form" label={isHt ? 'Ap chaje anons yo' : 'Loading announcements'} />;
  }

  return (
    <div>
      <PanelHeader
        icon="fa-bullhorn"
        title={isHt ? 'Anons kominote a' : 'Community announcements'}
        count={typeof totalCount === 'number' ? totalCount : announcements.length}
        subtitle={isHt
          ? 'Anons parèt sou paj akèy kominote a. Kloure youn pou l rete anlè.'
          : 'Announcements appear on the community home page. Pin one to keep it on top.'}
        refreshing={loading && loadedOnce}
        onRefresh={refetch}
        refreshLabel={isHt ? 'Rafrechi anons yo' : 'Refresh announcements'}
      />

      {error && (
        <PanelError
          message={isHt ? 'Pat kapab chaje anons yo.' : 'Could not load announcements.'}
          onRetry={refetch}
          retryLabel={isHt ? 'Reyese' : 'Retry'}
        />
      )}

      {/* ── Composer / editor ────────────────────────────────── */}
      <div className={styles.composer}>
        <div className={styles.composerHead}>
          <span>
            {editingId
              ? (isHt ? 'Modifye anons lan' : 'Edit announcement')
              : (isHt ? 'Nouvo anons' : 'New announcement')}
          </span>
          {editingId && (
            <button
              type="button"
              className={styles.iconBtn}
              onClick={resetComposer}
              title={isHt ? 'Anile modifikasyon' : 'Cancel edit'}
              aria-label={isHt ? 'Anile modifikasyon' : 'Cancel edit'}
            >
              <i className="fas fa-xmark" aria-hidden="true" />
            </button>
          )}
        </div>
        {!editingId && (
          <div style={{ marginBottom: 10 }}>
            <div className={styles.fieldLabel} style={{ marginBottom: 6 }}>
              {isHt ? 'Modèl rapid' : 'Quick templates'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ANNOUNCEMENT_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => applyTemplate(tpl)}
                  title={isHt ? 'Ranpli fòm lan ak modèl sa a' : 'Fill the form with this template'}
                >
                  <i className={`fas ${tpl.icon}`} aria-hidden="true" />
                  {isHt ? tpl.label.ht : tpl.label.en}
                </button>
              ))}
            </div>
          </div>
        )}
        <input
          type="text"
          className={styles.input}
          value={form.title}
          maxLength={200}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder={isHt ? 'Tit anons lan' : 'Announcement title'}
          aria-label={isHt ? 'Tit anons lan' : 'Announcement title'}
        />
        <textarea
          className={styles.textarea}
          rows={3}
          value={form.content}
          maxLength={10000}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          placeholder={isHt ? 'Kisa manm yo bezwen konnen?' : 'What do members need to know?'}
          aria-label={isHt ? 'Kontni anons lan' : 'Announcement content'}
        />
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={form.is_pinned}
            onChange={(e) => setForm((f) => ({ ...f, is_pinned: e.target.checked }))}
          />
          {isHt ? 'Kloure anlè paj kominote a' : 'Pin to the top of the community page'}
        </label>
        <div className={styles.composerActions}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={save}
            disabled={busy || !form.title.trim() || !form.content.trim()}
          >
            <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} aria-hidden="true" />
            {editingId
              ? (isHt ? 'Sove chanjman yo' : 'Save changes')
              : (isHt ? 'Pibliye anons' : 'Publish announcement')}
          </button>
        </div>
      </div>

      {/* ── List ─────────────────────────────────────────────── */}
      {announcements.length === 0 ? (
        <PanelEmpty
          icon="fa-bullhorn"
          title={isHt ? 'Poko gen anons.' : 'No announcements yet.'}
          description={isHt
            ? 'Ekri premye a anwo a — manm yo pral wè l sou paj kominote a.'
            : 'Write the first one above — members will see it on the community page.'}
        />
      ) : (
        <>
        <div className={styles.list}>
          {announcements.map((a) => {
            const content = a.content || '';
            const truncated = content.length > PREVIEW_LENGTH;
            const isEditing = editingId === a.id;
            return (
              <div
                key={a.id}
                className={styles.row}
                style={{
                  alignItems: 'flex-start',
                  borderColor: isEditing ? 'var(--color-primary, #3b82f6)' : undefined,
                }}
              >
                <div className={styles.avatar} aria-hidden="true" style={{ background: a.is_pinned ? '#f59e0b' : undefined }}>
                  <i className="fas fa-bullhorn" />
                </div>
                <div className={styles.rowBody}>
                  <div className={styles.rowName}>
                    {a.is_pinned && <i className="fas fa-thumbtack" style={{ color: '#f59e0b' }} aria-hidden="true" />}
                    {a.title}
                    {isEditing && <span className={`${styles.pill} ${styles.pillStaff}`}>{isHt ? 'Ap modifye' : 'Editing'}</span>}
                  </div>
                  <div className={styles.rowMeta}>
                    {a.created_by_username ? `@${a.created_by_username}` : ''}
                    {a.created_at ? `${a.created_by_username ? ' · ' : ''}${fmtDate(a.created_at)}` : ''}
                  </div>
                  <ExpandableText
                    text={content}
                    limit={PREVIEW_LENGTH}
                    lang={lang}
                    className={styles.rowContent}
                  />
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => startEdit(a)}
                    disabled={busy}
                    title={isHt ? 'Modifye' : 'Edit'}
                    aria-label={isHt ? `Modifye ${a.title}` : `Edit ${a.title}`}
                  >
                    <i className="fas fa-pen" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => togglePin(a)}
                    disabled={busy}
                    title={a.is_pinned ? (isHt ? 'Dekloure' : 'Unpin') : (isHt ? 'Kloure' : 'Pin')}
                    aria-label={a.is_pinned ? (isHt ? 'Dekloure anons lan' : 'Unpin announcement') : (isHt ? 'Kloure anons lan' : 'Pin announcement')}
                  >
                    <i className={`fas ${a.is_pinned ? 'fa-thumbtack' : 'fa-thumbtack-slash'}`} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                    onClick={() => setDeleteTarget(a)}
                    disabled={busy}
                    title={isHt ? 'Efase' : 'Delete'}
                    aria-label={isHt ? 'Efase anons lan' : 'Delete announcement'}
                  >
                    <i className="fas fa-trash-can" aria-hidden="true" />
                  </button>
                </div>
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
                : (isHt ? 'Chaje plis anons' : 'Load more announcements')}
            </button>
          </div>
        )}
        </>
      )}

      {deleteTarget && (
        <ConfirmModal
          lang={lang}
          title={isHt ? 'Efase anons lan?' : 'Delete announcement?'}
          message={isHt
            ? `« ${deleteTarget.title} » ap disparèt nèt pou tout manm yo. Aksyon sa a pa ka defèt.`
            : `"${deleteTarget.title}" will be removed for all members. This cannot be undone.`}
          confirmText={isHt ? 'Efase' : 'Delete'}
          cancelText={isHt ? 'Anile' : 'Cancel'}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
