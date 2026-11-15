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
import React, { useCallback, useState } from 'react';
import useFetch from '../../../hooks/useFetch';
import { communitiesService } from '../../../services/api';
import ConfirmModal from '../../common/ConfirmModal';
import PanelSkeleton, {
  ExpandableText, PanelEmpty, PanelError, PanelHeader, useInitialLoading,
} from './communityPanelUI';
import styles from './communityEditor.module.css';

const asArray = (data) => (Array.isArray(data) ? data : (data?.results || []));

const fmtDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const PREVIEW_LENGTH = 220;
const EMPTY_FORM = { title: '', content: '', is_pinned: false };

export default function CommunityAnnouncementsPanel({ slug, lang = 'en', showToast }) {
  const isHt = lang === 'ht';
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const {
    data: announcements, loading, error, refetch,
  } = useFetch(
    () => communitiesService.announcements(slug),
    { defaultValue: [], transform: asArray, deps: [slug] },
  );

  const initialLoading = useInitialLoading(loading);

  const resetComposer = () => {
    setForm(EMPTY_FORM);
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
          : (isHt ? '✅ Anons pibliye.' : '✅ Announcement published.'),
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
        count={announcements.length}
        subtitle={isHt
          ? 'Anons parèt sou paj akèy kominote a. Kloure youn pou l rete anlè.'
          : 'Announcements appear on the community home page. Pin one to keep it on top.'}
        refreshing={loading}
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
