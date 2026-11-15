/**
 * src/components/studio/editor/CommunityFilesPanel.jsx
 *
 * "Fichye & Kou" tab of the founder workspace — the shared resources
 * of a community in one place:
 *
 *   * Shared files — upload a document (POST media/upload/ then
 *     community-files/?community=<slug>), list, download, delete.
 *   * Linked courses — feature one of the founder's courses inside the
 *     community (community-courses/?community=<slug>), toggle featured,
 *     unlink.
 *
 * Writes are manager-only server-side (SharedFileViewSet /
 * CommunityLinkedCourseViewSet); uploads by plain members are still
 * allowed through the public community page.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import useFetch from '../../../hooks/useFetch';
import api, { communitiesService, courseService } from '../../../services/api';
import ConfirmModal from '../../common/ConfirmModal';
import PanelSkeleton, {
  PanelEmpty, PanelError, PanelHeader, useInitialLoading,
} from './communityPanelUI';
import styles from './communityEditor.module.css';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const asArray = (data) => (Array.isArray(data) ? data : (data?.results || []));

const fmtBytes = (bytes) => {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('read_failed'));
  reader.readAsDataURL(file);
});

export default function CommunityFilesPanel({
  slug,
  lang = 'en',
  showToast,
  canModerate = false,
}) {
  const isHt = lang === 'ht';
  const [busy, setBusy] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null); // { kind, row }
  const [courseId, setCourseId] = useState('');
  const fileInputRef = useRef(null);

  const {
    data: files, loading: loadingFiles, error: filesError, refetch: refetchFiles,
  } = useFetch(
    () => communitiesService.files(slug),
    { defaultValue: [], transform: asArray, deps: [slug] },
  );
  const {
    data: linked, loading: loadingLinked, error: linkedError, refetch: refetchLinked,
  } = useFetch(
    () => communitiesService.linkedCourses(slug),
    { defaultValue: [], transform: asArray, deps: [slug] },
  );
  const { data: myCourses } = useFetch(
    () => courseService.getMyCoursesCI(),
    {
      defaultValue: [],
      transform: (data) => (Array.isArray(data?.courses) ? data.courses : asArray(data)),
    },
  );

  const loading = loadingFiles || loadingLinked;
  const initialLoading = useInitialLoading(loading);
  const refreshAll = () => {
    refetchFiles();
    refetchLinked();
  };

  const availableCourses = useMemo(() => {
    const linkedIds = new Set((linked || []).map((row) => row.course));
    return (myCourses || []).filter((course) => !linkedIds.has(course.id));
  }, [myCourses, linked]);

  const notifyError = useCallback((err, fallback) => {
    showToast?.(
      err?.response?.data?.detail
        || err?.response?.data?.error
        || err?.response?.data?.file_url?.[0]
        || fallback,
      'circle-exclamation',
    );
  }, [showToast]);

  const uploadFile = useCallback(async (file) => {
    if (!file || busy) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      showToast?.(isHt ? 'Fichye a twò gwo (maks 50 MB).' : 'File is too large (50 MB max).', 'circle-exclamation');
      return;
    }
    setBusy(true);
    try {
      const base64 = await readAsDataUrl(file);
      const uploaded = await api.post('media/upload/', {
        file: base64,
        kind: 'document',
        filename: file.name || 'community-file',
      });
      const url = uploaded?.data?.url;
      if (!url) throw new Error('upload_failed');
      await communitiesService.createFile(slug, {
        name: file.name || 'community-file',
        file_url: url,
        size: file.size || 0,
        mime_type: file.type || '',
      });
      refetchFiles();
      showToast?.(isHt ? '✅ Fichye telechaje.' : '✅ File uploaded.', 'check-circle');
    } catch (err) {
      notifyError(err, isHt ? 'Pa t kapab telechaje fichye a.' : 'Could not upload the file.');
    } finally {
      setBusy(false);
    }
  }, [busy, isHt, notifyError, refetchFiles, showToast, slug]);

  const linkCourse = useCallback(async () => {
    if (!courseId || busy) return;
    setBusy(true);
    try {
      await communitiesService.linkCourse(slug, { course: Number(courseId) });
      setCourseId('');
      refetchLinked();
      showToast?.(isHt ? '✅ Kou lye ak kominote a.' : '✅ Course linked to the community.', 'check-circle');
    } catch (err) {
      notifyError(err, isHt ? 'Pa t kapab lye kou a.' : 'Could not link the course.');
    } finally {
      setBusy(false);
    }
  }, [busy, courseId, isHt, notifyError, refetchLinked, showToast, slug]);

  const toggleFeatured = useCallback(async (row) => {
    if (busy) return;
    setBusy(true);
    try {
      await communitiesService.updateLinkedCourse(row.id, { is_featured: !row.is_featured });
      refetchLinked();
    } catch (err) {
      notifyError(err, isHt ? 'Pa t kapab chanje kou a.' : 'Could not update the course.');
    } finally {
      setBusy(false);
    }
  }, [busy, isHt, notifyError, refetchLinked]);

  const confirmRemove = useCallback(async () => {
    const target = removeTarget;
    setRemoveTarget(null);
    if (!target) return;
    setBusy(true);
    try {
      if (target.kind === 'file') {
        await communitiesService.deleteFile(target.row.id);
        refetchFiles();
        showToast?.(isHt ? 'Fichye a efase.' : 'File deleted.', 'trash-can');
      } else {
        await communitiesService.unlinkCourse(target.row.id);
        refetchLinked();
        showToast?.(isHt ? 'Kou a deklye.' : 'Course unlinked.', 'trash-can');
      }
    } catch (err) {
      notifyError(err, isHt ? 'Pa t kapab efase a.' : 'Could not remove it.');
    } finally {
      setBusy(false);
    }
  }, [removeTarget, isHt, notifyError, refetchFiles, refetchLinked, showToast]);

  if (initialLoading) {
    return <PanelSkeleton variant="resources" rows={2} label={isHt ? 'Ap chaje resous yo' : 'Loading resources'} />;
  }

  return (
    <div>
      {/* ── Shared files ─────────────────────────────────────── */}
      <PanelHeader
        icon="fa-folder-open"
        title={isHt ? 'Fichye pataje' : 'Shared files'}
        count={files.length}
        subtitle={isHt
          ? 'Dokiman, gid ak resous pou manm yo. Maks 50 MB pa fichye.'
          : 'Documents, guides and resources for members. 50 MB max per file.'}
        refreshing={loadingFiles}
        onRefresh={refetchFiles}
        refreshLabel={isHt ? 'Rafrechi fichye yo' : 'Refresh files'}
      >
        {canModerate && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.csv,image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFile(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-upload'}`} aria-hidden="true" />
              {busy ? (isHt ? 'Ap travay…' : 'Working…') : (isHt ? 'Telechaje fichye' : 'Upload file')}
            </button>
          </>
        )}
      </PanelHeader>

      {filesError && (
        <PanelError
          message={isHt ? 'Pat kapab chaje fichye yo.' : 'Could not load the shared files.'}
          onRetry={refreshAll}
          retryLabel={isHt ? 'Reyese' : 'Retry'}
        />
      )}

      {files.length === 0 ? (
        <PanelEmpty
          icon="fa-folder-open"
          title={isHt ? 'Poko gen fichye pataje.' : 'No shared files yet.'}
          description={isHt
            ? 'Telechaje yon gid, yon modèl oswa yon dokiman itil pou manm yo.'
            : 'Upload a guide, template or document your members can use.'}
        />
      ) : (
        <div className={styles.list}>
          {files.map((file) => (
            <div key={file.id} className={styles.row}>
              <div className={styles.avatar} aria-hidden="true" style={{ background: '#0ea5e9' }}>
                <i className="fas fa-file" />
              </div>
              <div className={styles.rowBody}>
                <div className={styles.rowName}>{file.name}</div>
                <div className={styles.rowMeta}>
                  {fmtBytes(file.size)}
                  {file.uploaded_by_username ? ` · @${file.uploaded_by_username}` : ''}
                  {` · ⬇ ${file.download_count ?? 0}`}
                </div>
              </div>
              <div className={styles.actions}>
                <a
                  className={styles.downloadLink}
                  href={file.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {isHt ? 'Louvri' : 'Open'}
                </a>
                {canModerate && (
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                    onClick={() => setRemoveTarget({ kind: 'file', row: file })}
                    disabled={busy}
                    title={isHt ? 'Efase fichye a' : 'Delete file'}
                    aria-label={isHt ? `Efase ${file.name}` : `Delete ${file.name}`}
                  >
                    <i className="fas fa-trash-can" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Linked courses ───────────────────────────────────── */}
      <div style={{ marginTop: 24 }}>
        <PanelHeader
          icon="fa-graduation-cap"
          title={isHt ? 'Kou ki lye' : 'Linked courses'}
          count={linked.length}
          subtitle={isHt
            ? 'Kou ou yo ki parèt dirèkteman nan kominote a.'
            : 'Your courses surfaced directly inside the community.'}
          refreshing={loadingLinked}
          onRefresh={refetchLinked}
          refreshLabel={isHt ? 'Rafrechi kou yo' : 'Refresh courses'}
        />
      </div>

      {linkedError && (
        <PanelError
          message={isHt ? 'Pat kapab chaje kou ki lye yo.' : 'Could not load the linked courses.'}
          onRetry={refetchLinked}
          retryLabel={isHt ? 'Reyese' : 'Retry'}
        />
      )}
      {canModerate && (
        <div className={styles.composer} style={{ marginBottom: 12 }}>
          {availableCourses.length === 0 ? (
            <span className={styles.hint} style={{ margin: 0 }}>
              {isHt
                ? 'Tout kou ou deja lye, oswa ou poko gen kou ki pibliye.'
                : 'All your courses are already linked, or you have no published courses yet.'}
            </span>
          ) : (
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{isHt ? 'Chwazi yon kou' : 'Pick a course'}</span>
                <select
                  className={styles.input}
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                >
                  <option value="">{isHt ? 'Chwazi…' : 'Select…'}</option>
                  {availableCourses.map((course) => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
              </label>
              <div className={styles.field} style={{ alignSelf: 'end' }}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={linkCourse}
                  disabled={!courseId || busy}
                >
                  <i className="fas fa-link" aria-hidden="true" />
                  {isHt ? 'Lye kou a' : 'Link course'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {linked.length === 0 ? (
        <PanelEmpty
          icon="fa-graduation-cap"
          title={isHt ? 'Poko gen kou ki lye.' : 'No courses linked yet.'}
          description={isHt
            ? 'Lye yon kou ou pou manm yo ka kòmanse aprann tou dwat.'
            : 'Link one of your courses so members can start learning right away.'}
        />
      ) : (
        <div className={styles.list}>
          {linked.map((row) => (
            <div key={row.id} className={styles.row}>
              <div className={styles.avatar} aria-hidden="true" style={{ background: '#10b981' }}>
                <i className="fas fa-book-open" />
              </div>
              <div className={styles.rowBody}>
                <div className={styles.rowName}>
                  {row.course_title || `#${row.course}`}
                  {row.is_featured && (
                    <span className={`${styles.pill} ${styles.pillOwner}`}>{isHt ? 'An vedèt' : 'Featured'}</span>
                  )}
                </div>
                <div className={styles.rowMeta}>
                  {row.added_by_username ? `@${row.added_by_username}` : ''}
                </div>
              </div>
              {canModerate && (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => toggleFeatured(row)}
                    disabled={busy}
                    title={row.is_featured ? (isHt ? 'Retire nan vedèt' : 'Unfeature') : (isHt ? 'Mete an vedèt' : 'Feature')}
                    aria-label={row.is_featured
                      ? (isHt ? `Retire ${row.course_title} nan vedèt` : `Unfeature ${row.course_title}`)
                      : (isHt ? `Mete ${row.course_title} an vedèt` : `Feature ${row.course_title}`)}
                  >
                    <i className={`fas ${row.is_featured ? 'fa-star' : 'fa-star'}`} aria-hidden="true" style={{ color: row.is_featured ? '#f59e0b' : undefined }} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                    onClick={() => setRemoveTarget({ kind: 'course', row })}
                    disabled={busy}
                    title={isHt ? 'Deklye kou a' : 'Unlink course'}
                    aria-label={isHt ? `Deklye ${row.course_title}` : `Unlink ${row.course_title}`}
                  >
                    <i className="fas fa-link-slash" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {removeTarget && (
        <ConfirmModal
          lang={lang}
          title={removeTarget.kind === 'file'
            ? (isHt ? 'Efase fichye a?' : 'Delete file?')
            : (isHt ? 'Deklye kou a?' : 'Unlink course?')}
          message={removeTarget.kind === 'file'
            ? (isHt
              ? `« ${removeTarget.row.name} » ap disparèt pou tout manm yo.`
              : `"${removeTarget.row.name}" will be removed for all members.`)
            : (isHt
              ? `« ${removeTarget.row.course_title} » p ap parèt nan kominote a ankò. Kou a rete sou platfòm lan.`
              : `"${removeTarget.row.course_title}" will no longer appear in the community. The course itself stays on the platform.`)}
          confirmText={removeTarget.kind === 'file' ? (isHt ? 'Efase' : 'Delete') : (isHt ? 'Deklye' : 'Unlink')}
          cancelText={isHt ? 'Anile' : 'Cancel'}
          onConfirm={confirmRemove}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  );
}
