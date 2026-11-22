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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useFetch from '../../../hooks/useFetch';
import api, { communitiesService, courseService } from '../../../services/api';
import ConfirmModal from '../../common/ConfirmModal';
import PanelSkeleton, {
  PanelEmpty, PanelError, PanelHeader, useInitialLoading,
} from './communityPanelUI';
import styles from './communityEditor.module.css';
import { inlineText } from '../../../utils/inlineI18n';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const FILES_PAGE_SIZE = 20;

const asArray = (data) => (Array.isArray(data) ? data : (data?.results || []));

const fmtBytes = (bytes) => {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const fileIcon = (file) => {
  const mime = (file?.mime_type || '').toLowerCase();
  const name = (file?.name || '').toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/.test(name)) return 'fa-file-image';
  if (mime.includes('pdf') || name.endsWith('.pdf')) return 'fa-file-pdf';
  if (mime.includes('zip') || mime.includes('compressed') || /\.(zip|rar|7z|tar|gz)$/.test(name)) return 'fa-file-zipper';
  if (mime.includes('spreadsheet') || mime.includes('excel') || /\.(xls|xlsx|csv)$/.test(name)) return 'fa-file-excel';
  if (mime.includes('presentation') || mime.includes('powerpoint') || /\.(ppt|pptx)$/.test(name)) return 'fa-file-powerpoint';
  if (mime.includes('word') || /\.(doc|docx)$/.test(name)) return 'fa-file-word';
  if (mime.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm)$/.test(name)) return 'fa-file-video';
  if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/.test(name)) return 'fa-file-audio';
  if (mime.startsWith('text/') || /\.(txt|md)$/.test(name)) return 'fa-file-lines';
  return 'fa-file';
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

  const [files, setFiles] = useState([]);
  const [filesTotal, setFilesTotal] = useState(null);
  const [filesPage, setFilesPage] = useState(1);
  const [filesHasMore, setFilesHasMore] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [loadingMoreFiles, setLoadingMoreFiles] = useState(false);
  const [filesError, setFilesError] = useState(null);
  const [filesLoadedOnce, setFilesLoadedOnce] = useState(false);
  const filesReqRef = useRef(0);

  const fetchFilesPage = useCallback(async (pageToLoad, { append = false } = {}) => {
    const requestId = ++filesReqRef.current;
    if (append) setLoadingMoreFiles(true); else setLoadingFiles(true);
    setFilesError(null);
    try {
      const res = await communitiesService.files(slug, { page: pageToLoad, page_size: FILES_PAGE_SIZE });
      if (requestId !== filesReqRef.current) return;
      const data = res?.data;
      const list = asArray(data);
      const count = Array.isArray(data) ? list.length : (typeof data?.count === 'number' ? data.count : null);
      const more = Array.isArray(data)
        ? false
        : (typeof data?.next === 'string' ? Boolean(data.next) : list.length === FILES_PAGE_SIZE);
      setFiles((prev) => (append ? [...prev, ...list] : list));
      setFilesTotal(count);
      setFilesPage(pageToLoad);
      setFilesHasMore(more);
      setFilesLoadedOnce(true);
    } catch (err) {
      if (requestId !== filesReqRef.current) return;
      if (!append) setFiles([]);
      setFilesError(err);
    } finally {
      if (requestId === filesReqRef.current) {
        setLoadingFiles(false);
        setLoadingMoreFiles(false);
      }
    }
  }, [slug]);

  useEffect(() => {
    setFiles([]);
    setFilesTotal(null);
    setFilesPage(1);
    setFilesHasMore(false);
    setFilesLoadedOnce(false);
    fetchFilesPage(1, { append: false });
  }, [slug, fetchFilesPage]);

  const refetchFiles = useCallback(() => {
    fetchFilesPage(1, { append: false });
  }, [fetchFilesPage]);

  const loadMoreFiles = useCallback(() => {
    if (loadingMoreFiles || loadingFiles || !filesHasMore) return;
    fetchFilesPage(filesPage + 1, { append: true });
  }, [fetchFilesPage, filesHasMore, filesPage, loadingFiles, loadingMoreFiles]);

  const [linked, setLinked] = useState([]);
  const [linkedTotal, setLinkedTotal] = useState(null);
  const [linkedPage, setLinkedPage] = useState(1);
  const [linkedHasMore, setLinkedHasMore] = useState(false);
  const [loadingLinked, setLoadingLinked] = useState(true);
  const [loadingMoreLinked, setLoadingMoreLinked] = useState(false);
  const [linkedError, setLinkedError] = useState(null);
  const [linkedLoadedOnce, setLinkedLoadedOnce] = useState(false);
  const linkedReqRef = useRef(0);

  const fetchLinkedPage = useCallback(async (pageToLoad, { append = false } = {}) => {
    const requestId = ++linkedReqRef.current;
    if (append) setLoadingMoreLinked(true); else setLoadingLinked(true);
    setLinkedError(null);
    try {
      const res = await communitiesService.linkedCourses(slug, { page: pageToLoad, page_size: FILES_PAGE_SIZE });
      if (requestId !== linkedReqRef.current) return;
      const data = res?.data;
      const list = asArray(data);
      const count = Array.isArray(data) ? list.length : (typeof data?.count === 'number' ? data.count : null);
      const more = Array.isArray(data)
        ? false
        : (typeof data?.next === 'string' ? Boolean(data.next) : list.length === FILES_PAGE_SIZE);
      setLinked((prev) => (append ? [...prev, ...list] : list));
      setLinkedTotal(count);
      setLinkedPage(pageToLoad);
      setLinkedHasMore(more);
      setLinkedLoadedOnce(true);
    } catch (err) {
      if (requestId !== linkedReqRef.current) return;
      if (!append) setLinked([]);
      setLinkedError(err);
    } finally {
      if (requestId === linkedReqRef.current) {
        setLoadingLinked(false);
        setLoadingMoreLinked(false);
      }
    }
  }, [slug]);

  useEffect(() => {
    setLinked([]);
    setLinkedTotal(null);
    setLinkedPage(1);
    setLinkedHasMore(false);
    setLinkedLoadedOnce(false);
    fetchLinkedPage(1, { append: false });
  }, [slug, fetchLinkedPage]);

  const refetchLinked = useCallback(() => {
    fetchLinkedPage(1, { append: false });
  }, [fetchLinkedPage]);

  const loadMoreLinked = useCallback(() => {
    if (loadingMoreLinked || loadingLinked || !linkedHasMore) return;
    fetchLinkedPage(linkedPage + 1, { append: true });
  }, [fetchLinkedPage, linkedHasMore, linkedPage, loadingLinked, loadingMoreLinked]);

  const { data: myCourses } = useFetch(
    () => courseService.getMyCoursesCI(),
    {
      defaultValue: [],
      transform: (data) => (Array.isArray(data?.courses) ? data.courses : asArray(data)),
    },
  );

  const loading = loadingFiles || loadingLinked;
  const initialLoading = (loadingFiles && !filesLoadedOnce) || (loadingLinked && !linkedLoadedOnce);
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
      showToast?.(isHt ? 'Fichye a twò gwo (maks 50 MB).' : inlineText(lang, 'File is too large (50 MB max).'), 'circle-exclamation');
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
      showToast?.(isHt ? '✅ Fichye telechaje.' : inlineText(lang, '✅ File uploaded.'), 'check-circle');
    } catch (err) {
      notifyError(err, isHt ? 'Pa t kapab telechaje fichye a.' : inlineText(lang, 'Could not upload the file.'));
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
      showToast?.(isHt ? '✅ Kou lye ak kominote a.' : inlineText(lang, '✅ Course linked to the community.'), 'check-circle');
    } catch (err) {
      notifyError(err, isHt ? 'Pa t kapab lye kou a.' : inlineText(lang, 'Could not link the course.'));
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
      notifyError(err, isHt ? 'Pa t kapab chanje kou a.' : inlineText(lang, 'Could not update the course.'));
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
        showToast?.(isHt ? 'Fichye a efase.' : inlineText(lang, 'File deleted.'), 'trash-can');
      } else {
        await communitiesService.unlinkCourse(target.row.id);
        refetchLinked();
        showToast?.(isHt ? 'Kou a deklye.' : inlineText(lang, 'Course unlinked.'), 'trash-can');
      }
    } catch (err) {
      notifyError(err, isHt ? 'Pa t kapab efase a.' : inlineText(lang, 'Could not remove it.'));
    } finally {
      setBusy(false);
    }
  }, [removeTarget, isHt, notifyError, refetchFiles, refetchLinked, showToast]);

  if (initialLoading) {
    return <PanelSkeleton variant="resources" rows={2} label={isHt ? 'Ap chaje resous yo' : inlineText(lang, 'Loading resources')} />;
  }

  return (
    <div>
      {/* ── Shared files ─────────────────────────────────────── */}
      <PanelHeader
        icon="fa-folder-open"
        title={isHt ? 'Fichye pataje' : inlineText(lang, 'Shared files')}
        count={typeof filesTotal === 'number' ? filesTotal : files.length}
        subtitle={isHt
          ? 'Dokiman, gid ak resous pou manm yo. Maks 50 MB pa fichye.'
          : inlineText(lang, 'Documents, guides and resources for members. 50 MB max per file.')}
        refreshing={loadingFiles && filesLoadedOnce}
        onRefresh={refetchFiles}
        refreshLabel={isHt ? 'Rafrechi fichye yo' : inlineText(lang, 'Refresh files')}
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
              {busy ? (isHt ? 'Ap travay…' : inlineText(lang, 'Working…')) : (isHt ? 'Telechaje fichye' : inlineText(lang, 'Upload file'))}
            </button>
          </>
        )}
      </PanelHeader>

      {filesError && (
        <PanelError
          message={isHt ? 'Pat kapab chaje fichye yo.' : inlineText(lang, 'Could not load the shared files.')}
          onRetry={refreshAll}
          retryLabel={isHt ? 'Reyese' : inlineText(lang, 'Retry')}
        />
      )}

      {files.length === 0 ? (
        <PanelEmpty
          icon="fa-folder-open"
          title={isHt ? 'Poko gen fichye pataje.' : inlineText(lang, 'No shared files yet.')}
          description={isHt
            ? 'Telechaje yon gid, yon modèl oswa yon dokiman itil pou manm yo.'
            : inlineText(lang, 'Upload a guide, template or document your members can use.')}
        />
      ) : (
        <>
        <div className={styles.list}>
          {files.map((file) => (
            <div key={file.id} className={styles.row}>
              <div className={styles.avatar} aria-hidden="true" style={{ background: '#0ea5e9' }}>
                <i className={`fas ${fileIcon(file)}`} />
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
                  {isHt ? 'Louvri' : inlineText(lang, 'Open')}
                </a>
                {canModerate && (
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                    onClick={() => setRemoveTarget({ kind: 'file', row: file })}
                    disabled={busy}
                    title={isHt ? 'Efase fichye a' : inlineText(lang, 'Delete file')}
                    aria-label={isHt ? `Efase ${file.name}` : `Delete ${file.name}`}
                  >
                    <i className="fas fa-trash-can" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {filesHasMore && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
            <button
              type="button"
              className={styles.actionButton}
              onClick={loadMoreFiles}
              disabled={loadingMoreFiles}
            >
              {loadingMoreFiles
                ? (isHt ? 'Ap chaje…' : inlineText(lang, 'Loading…'))
                : (isHt ? 'Chaje plis fichye' : inlineText(lang, 'Load more files'))}
            </button>
          </div>
        )}
        </>
      )}

      {/* ── Linked courses ───────────────────────────────────── */}
      <div style={{ marginTop: 24 }}>
        <PanelHeader
          icon="fa-graduation-cap"
          title={isHt ? 'Kou ki lye' : inlineText(lang, 'Linked courses')}
          count={typeof linkedTotal === 'number' ? linkedTotal : linked.length}
          subtitle={isHt
            ? 'Kou ou yo ki parèt dirèkteman nan kominote a.'
            : inlineText(lang, 'Your courses surfaced directly inside the community.')}
          refreshing={loadingLinked && linkedLoadedOnce}
          onRefresh={refetchLinked}
          refreshLabel={isHt ? 'Rafrechi kou yo' : inlineText(lang, 'Refresh courses')}
        />
      </div>

      {linkedError && (
        <PanelError
          message={isHt ? 'Pat kapab chaje kou ki lye yo.' : inlineText(lang, 'Could not load the linked courses.')}
          onRetry={refetchLinked}
          retryLabel={isHt ? 'Reyese' : inlineText(lang, 'Retry')}
        />
      )}
      {canModerate && (
        <div className={styles.composer} style={{ marginBottom: 12 }}>
          {availableCourses.length === 0 ? (
            <span className={styles.hint} style={{ margin: 0 }}>
              {isHt
                ? 'Tout kou ou deja lye, oswa ou poko gen kou ki pibliye.'
                : inlineText(lang, 'All your courses are already linked, or you have no published courses yet.')}
            </span>
          ) : (
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{isHt ? 'Chwazi yon kou' : inlineText(lang, 'Pick a course')}</span>
                <select
                  className={styles.input}
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                >
                  <option value="">{isHt ? 'Chwazi…' : inlineText(lang, 'Select…')}</option>
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
                  {isHt ? 'Lye kou a' : inlineText(lang, 'Link course')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {linked.length === 0 ? (
        <PanelEmpty
          icon="fa-graduation-cap"
          title={isHt ? 'Poko gen kou ki lye.' : inlineText(lang, 'No courses linked yet.')}
          description={isHt
            ? 'Lye yon kou ou pou manm yo ka kòmanse aprann tou dwat.'
            : inlineText(lang, 'Link one of your courses so members can start learning right away.')}
        />
      ) : (
        <>
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
                    <span className={`${styles.pill} ${styles.pillOwner}`}>{isHt ? 'An vedèt' : inlineText(lang, 'Featured')}</span>
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
                    title={row.is_featured ? (isHt ? 'Retire nan vedèt' : inlineText(lang, 'Unfeature')) : (isHt ? 'Mete an vedèt' : inlineText(lang, 'Feature'))}
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
                    title={isHt ? 'Deklye kou a' : inlineText(lang, 'Unlink course')}
                    aria-label={isHt ? `Deklye ${row.course_title}` : `Unlink ${row.course_title}`}
                  >
                    <i className="fas fa-link-slash" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        {linkedHasMore && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
            <button
              type="button"
              className={styles.actionButton}
              onClick={loadMoreLinked}
              disabled={loadingMoreLinked}
            >
              {loadingMoreLinked
                ? (isHt ? 'Ap chaje…' : inlineText(lang, 'Loading…'))
                : (isHt ? 'Chaje plis kou' : inlineText(lang, 'Load more courses'))}
            </button>
          </div>
        )}
        </>
      )}

      {removeTarget && (
        <ConfirmModal
          lang={lang}
          title={removeTarget.kind === 'file'
            ? (isHt ? 'Efase fichye a?' : inlineText(lang, 'Delete file?'))
            : (isHt ? 'Deklye kou a?' : inlineText(lang, 'Unlink course?'))}
          message={removeTarget.kind === 'file'
            ? (isHt
              ? `« ${removeTarget.row.name} » ap disparèt pou tout manm yo.`
              : `"${removeTarget.row.name}" will be removed for all members.`)
            : (isHt
              ? `« ${removeTarget.row.course_title} » p ap parèt nan kominote a ankò. Kou a rete sou platfòm lan.`
              : `"${removeTarget.row.course_title}" will no longer appear in the community. The course itself stays on the platform.`)}
          confirmText={removeTarget.kind === 'file' ? (isHt ? 'Efase' : inlineText(lang, 'Delete')) : (isHt ? 'Deklye' : inlineText(lang, 'Unlink'))}
          cancelText={isHt ? 'Anile' : inlineText(lang, 'Cancel')}
          onConfirm={confirmRemove}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  );
}
