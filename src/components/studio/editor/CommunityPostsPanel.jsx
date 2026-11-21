/**
 * src/components/studio/editor/CommunityPostsPanel.jsx
 *
 * "Pòs" tab of the founder workspace — moderation for the member feed.
 * Members write the posts; managers curate:
 *
 *   * browse the newest posts (pinned first, server ordering)
 *   * search by author or text
 *   * pin / unpin a standout post
 *   * delete spam or off-topic posts (with confirmation)
 *
 * Endpoints:
 *   GET    community-posts/?community=<slug>&page_size=30
 *   PATCH  community-posts/<id>/  { is_pinned }   (manager only)
 *   DELETE community-posts/<id>/                  (author or manager)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api, { communitiesService } from '../../../services/api';
import { resolveVideoSource, youtubeThumbnail } from '../../../modules/explore/utils/videoSource';
import VideoEmbedFrame from '../../media/VideoEmbedFrame';
import ConfirmModal from '../../common/ConfirmModal';
import PanelSkeleton, {
  PanelEmpty, PanelError, PanelHeader,
} from './communityPanelUI';
import { POST_MAX_LENGTH, countPostChars, validatePostDraft } from '../../community/postRules';
import CommentListSkeleton from '../../community/CommentListSkeleton';
import styles from './communityEditor.module.css';

const asArray = (data) => (Array.isArray(data) ? data : (data?.results || []));
const PAGE_SIZE = 30;

function firstVideoUrl(text) {
  if (!text || typeof text !== 'string') return '';
  const urls = text.match(/https?:\/\/[^\s)]+/gi) || [];
  for (const u of urls) {
    if (resolveVideoSource(u)) return u;
  }
  return '';
}

function firstGenericLinkUrl(text) {
  if (!text || typeof text !== 'string') return '';
  const urls = text.match(/https?:\/\/[^\s)]+/gi) || [];
  for (const raw of urls) {
    const u = raw.replace(/[.,;:!?]+$/, '');
    if (!u) continue;
    try {
      const scheme = new URL(u).protocol;
      if (scheme !== 'http:' && scheme !== 'https:') continue;
    } catch { continue; }
    if (resolveVideoSource(u)) continue;
    return u;
  }
  return '';
}

function linkifyText(text) {
  if (!text) return null;
  const parts = String(text).split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) => {
    if (/^https?:\/\//i.test(part)) {
      const clean = part.replace(/[.,;:!?)]+$/, '');
      const trailing = part.slice(clean.length);
      let label = clean;
      try { label = new URL(clean).hostname.replace(/^www\./, '') + (new URL(clean).pathname !== '/' ? new URL(clean).pathname : ''); } catch { /* keep */ }
      if (label.length > 48) label = `${label.slice(0, 45)}…`;
      return (
        <React.Fragment key={i}>
          <a href={clean} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline', wordBreak: 'break-all' }}>
            {label}
          </a>
          {trailing}
        </React.Fragment>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

const _previewCache = new Map();
const _previewInflight = new Map();
function fetchLinkPreview(url) {
  if (_previewCache.has(url)) return Promise.resolve(_previewCache.get(url));
  if (_previewInflight.has(url)) return _previewInflight.get(url);
  const p = api.get(`link-preview/?url=${encodeURIComponent(url)}`, { timeout: 15000 })
    .then((r) => {
      const data = r?.data || null;
      if (data && (data.title || data.description || data.image)) _previewCache.set(url, data);
      return data;
    })
    .catch(() => null)
    .finally(() => { _previewInflight.delete(url); });
  _previewInflight.set(url, p);
  if (_previewCache.size > 200) { const k = _previewCache.keys().next().value; _previewCache.delete(k); }
  return p;
}

function LinkPreviewCard({ url, compact = false }) {
  const [meta, setMeta] = useState(() => (_previewCache.get(url) || null));
  const [loading, setLoading] = useState(() => (!_previewCache.has(url) && Boolean(url)));
  useEffect(() => {
    if (!url) return;
    if (_previewCache.has(url)) { setMeta(_previewCache.get(url)); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      fetchLinkPreview(url)
        .then((data) => { if (!cancelled && data) setMeta(data); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 450);
    return () => { cancelled = true; clearTimeout(t); };
  }, [url]);
  if (!url) return null;
  let domain = '';
  try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { domain = ''; }
  const baseStyle = {
    marginTop: 8, display: 'flex', gap: 10, alignItems: 'center',
    border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 10,
    overflow: 'hidden', textDecoration: 'none', color: 'inherit',
    background: 'var(--bg-soft, #fff)',
  };
  if (loading) {
    return <div style={{ ...baseStyle, height: compact ? 56 : 72, borderStyle: 'dashed' }} aria-hidden="true" />;
  }
  if (!meta || (!meta.title && !meta.description && !meta.image)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ ...baseStyle, padding: '8px 10px', borderStyle: 'dashed' }}>
        <span style={{ width: 34, height: 34, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} aria-hidden="true"><i className="fas fa-link" /></span>
        <span style={{ minWidth: 0, flex: 1 }}>
          {domain && <span style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.4px', opacity: 0.6 }}>{domain}</span>}
          <span style={{ display: 'block', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{url}</span>
        </span>
        <span style={{ opacity: 0.55, paddingRight: 4 }} aria-hidden="true"><i className="fas fa-arrow-up-right-from-square" /></span>
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={baseStyle}>
      {meta.image && <img src={meta.image} alt="" loading="lazy" style={{ width: compact ? 72 : 96, height: compact ? 56 : 72, objectFit: 'cover', flexShrink: 0 }} />}
      <span style={{ padding: meta.image ? '8px 10px 8px 0' : '8px 10px', minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.4px', opacity: 0.6 }}>{meta.domain || domain}</span>
        <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta.title || url}</span>
        {!compact && meta.description && (
          <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: '0.72rem', opacity: 0.75, lineHeight: 1.4 }}>{meta.description}</span>
        )}
      </span>
      <span style={{ opacity: 0.5, paddingRight: 10 }} aria-hidden="true"><i className="fas fa-arrow-up-right-from-square" /></span>
    </a>
  );
}

function VideoTitleLink({ url }) {
  const [meta, setMeta] = useState(() => (_previewCache.get(url) || null));
  useEffect(() => {
    if (!url) return;
    if (_previewCache.has(url)) { setMeta(_previewCache.get(url)); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      fetchLinkPreview(url).then((data) => { if (!cancelled && data) setMeta(data); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [url]);
  if (!url) return null;
  let domain = '';
  try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { domain = ''; }
  const title = meta?.title && meta.title !== meta?.domain ? meta.title : null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none', color: 'inherit' }}>
      <i className="fas fa-play-circle" aria-hidden="true" style={{ color: '#e11d48' }} />
      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title || domain || url}</span>
      {domain && <span style={{ fontWeight: 400, fontSize: '0.7rem', opacity: 0.6 }}>{domain}</span>}
      <i className="fas fa-arrow-up-right-from-square" aria-hidden="true" style={{ fontSize: '0.7rem', opacity: 0.5 }} />
    </a>
  );
}

function PostRichContent({ post, lang }) {
  const text = post?.content || '';
  const vidUrl = post?.video_url || firstVideoUrl(text);
  const video = vidUrl ? resolveVideoSource(vidUrl) : null;
  const img = post?.image_url || (vidUrl ? youtubeThumbnail(vidUrl) : '');
  const link = firstGenericLinkUrl(text);
  return (
    <div>
      <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.5 }}>
        {linkifyText(text)}
      </div>
      {img && <img src={img} alt="" loading="lazy" style={{ width: '100%', maxHeight: 360, objectFit: 'cover', borderRadius: 10, marginTop: 8, display: 'block' }} />}
      {vidUrl && <VideoTitleLink url={vidUrl} />}
      {video && (
        video.kind === 'embed' ? (
          <VideoEmbedFrame
            src={video.src}
            title={lang === 'ht' ? 'Videyo pòs la' : 'Post video'}
            lang={lang}
            style={{ borderRadius: 10, marginTop: 8 }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        ) : (
          <video src={video.src} controls preload="metadata" playsInline poster={img || undefined} style={{ width: '100%', borderRadius: 10, background: '#000', marginTop: 8, display: 'block' }} />
        )
      )}
      {link && <LinkPreviewCard url={link} />}
    </div>
  );
}

const fmtDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export default function CommunityPostsPanel({
  slug,
  lang = 'en',
  showToast,
  canModerate = false,
}) {
  const isHt = lang === 'ht';
  const [query, setQuery] = useState('');
  const [postFilter, setPostFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftImageUrl, setDraftImageUrl] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);
  const fileInputRef = useRef(null);
  const draftRef = useRef(null);
  const [commentsFor, setCommentsFor] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState('');
  const [commentToDelete, setCommentToDelete] = useState(null);
  const commentsForRef = useRef(null);

  const [posts, setPosts] = useState([]);
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
      const res = await communitiesService.posts(slug, { page: pageToLoad, page_size: PAGE_SIZE });
      if (requestId !== requestIdRef.current) return;
      const data = res?.data;
      const list = asArray(data);
      const count = Array.isArray(data) ? list.length : (typeof data?.count === 'number' ? data.count : null);
      const more = Array.isArray(data)
        ? false
        : (typeof data?.next === 'string' ? Boolean(data.next) : list.length === PAGE_SIZE);
      setPosts((prev) => (append ? [...prev, ...list] : list));
      setTotalCount(count);
      setPage(pageToLoad);
      setHasMore(more);
      setLoadedOnce(true);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (!append) setPosts([]);
      setError(err);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [slug]);

  useEffect(() => {
    setPosts([]);
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

  const handlePickImage = useCallback(async (file) => {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      showToast?.(isHt ? 'Tanpri chwazi yon imaj.' : 'Please choose an image file.', 'exclamation-triangle');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast?.(isHt ? 'Imaj la twò gwo (max 8 MB).' : 'Image is too large (max 8 MB).', 'exclamation-triangle');
      return;
    }
    setUploadingImage(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('read_failed'));
        reader.readAsDataURL(file);
      });
      const res = await api.post('media/upload/', { file: base64, kind: 'image', filename: file.name || 'post-image' });
      if (res?.data?.url) {
        setDraftImageUrl(res.data.url);
        showToast?.(isHt ? 'Imaj ajoute.' : 'Image added.', 'image');
      } else {
        showToast?.(isHt ? 'Telechajman imaj echwe.' : 'Image upload failed.', 'circle-exclamation');
      }
    } catch {
      showToast?.(isHt ? 'Telechajman imaj echwe.' : 'Image upload failed.', 'circle-exclamation');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [isHt, showToast]);

  const resetComposer = useCallback(() => {
    setComposerOpen(false);
    setDraft('');
    setDraftImageUrl('');
    setLinkValue('');
    setShowLinkInput(false);
    setShowPoll(false);
    setPollQuestion('');
    setPollOptions(['', '']);
    setPollAllowMultiple(false);
  }, []);

  const publishPost = useCallback(async () => {
    const check = validatePostDraft(draft);
    if (!check.ok || publishing) return;
    const content = check.text;
    const cleanPollOptions = pollOptions.map((o) => o.trim()).filter(Boolean).slice(0, 10);
    if (showPoll && pollQuestion.trim() && cleanPollOptions.length < 2) {
      showToast?.(isHt ? 'Sondaj la bezwen omwen 2 opsyon.' : 'A poll needs at least 2 options.', 'circle-exclamation');
      return;
    }
    setPublishing(true);
    try {
      const autoThumb = !draftImageUrl ? youtubeThumbnail(firstVideoUrl(content)) : '';
      const finalImage = draftImageUrl || autoThumb;
      const payload = finalImage ? { content, image_url: finalImage } : { content };
      if (showPoll && pollQuestion.trim() && cleanPollOptions.length >= 2) {
        payload.poll_question = pollQuestion.trim().slice(0, 300);
        payload.poll_options = cleanPollOptions.map((text) => ({ text, votes: 0 }));
        payload.poll_allow_multiple = pollAllowMultiple;
      }
      await communitiesService.createPost(slug, payload);
      resetComposer();
      showToast?.(isHt ? 'Pòs pibliye!' : 'Post published!', 'check-circle');
      refetch();
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail || (isHt ? 'Pa t kapab pibliye pòs la.' : 'Could not publish the post.'),
        'circle-exclamation',
      );
    } finally {
      setPublishing(false);
    }
  }, [draft, draftImageUrl, isHt, pollAllowMultiple, pollOptions, pollQuestion, publishing, refetch, resetComposer, showPoll, showToast, slug]);

  const draftVideoUrl = useMemo(() => firstVideoUrl(draft), [draft]);
  const draftGenericLink = useMemo(() => firstGenericLinkUrl(draft), [draft]);
  const draftAutoThumb = useMemo(() => (!draftImageUrl ? youtubeThumbnail(draftVideoUrl) : ''), [draftImageUrl, draftVideoUrl]);

  const togglePin = useCallback(async (post) => {
    if (busy) return;
    setBusy(true);
    try {
      await communitiesService.updatePost(post.id, { is_pinned: !post.is_pinned });
      refetch();
      showToast?.(
        post.is_pinned
          ? (isHt ? 'Pòs la dekloure.' : 'Post unpinned.')
          : (isHt ? 'Pòs la kloure anlè.' : 'Post pinned to the top.'),
        'thumbtack',
      );
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail || (isHt ? 'Pa t kapab chanje pòs la.' : 'Could not update the post.'),
        'circle-exclamation',
      );
    } finally {
      setBusy(false);
    }
  }, [busy, isHt, refetch, showToast]);

  const loadComments = useCallback(async (post) => {
    setCommentsFor(post.id);
    commentsForRef.current = post.id;
    setCommentsLoading(true);
    setCommentsError('');
    setComments([]);
    try {
      const res = await communitiesService.comments(post.id);
      if (commentsForRef.current === post.id) {
        setComments(asArray(res?.data));
      }
    } catch (err) {
      if (commentsForRef.current === post.id) {
        setCommentsError(
          err?.response?.data?.detail
            || (isHt ? 'Pa t kapab chaje kòmantè yo.' : 'Could not load the comments.'),
        );
      }
    } finally {
      if (commentsForRef.current === post.id) setCommentsLoading(false);
    }
  }, [isHt]);

  const toggleComments = useCallback((post) => {
    if (commentsFor === post.id) {
      commentsForRef.current = null;
      setCommentsFor(null);
      setComments([]);
      setCommentsError('');
      return;
    }
    loadComments(post);
  }, [commentsFor, loadComments]);

  const confirmDeleteComment = useCallback(async () => {
    const target = commentToDelete;
    setCommentToDelete(null);
    if (!target) return;
    setBusy(true);
    try {
      await communitiesService.deleteComment(target.id);
      setComments((prev) => prev.filter((c) => c.id !== target.id));
      refetch();
      showToast?.(isHt ? 'Kòmantè efase.' : 'Comment deleted.', 'trash-can');
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail || (isHt ? 'Pa t kapab efase kòmantè a.' : 'Could not delete the comment.'),
        'circle-exclamation',
      );
    } finally {
      setBusy(false);
    }
  }, [commentToDelete, isHt, refetch, showToast]);

  const confirmDelete = useCallback(async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    setBusy(true);
    try {
      await communitiesService.deletePost(target.id);
      refetch();
      showToast?.(isHt ? 'Pòs la efase.' : 'Post deleted.', 'trash-can');
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail || (isHt ? 'Pa t kapab efase pòs la.' : 'Could not delete the post.'),
        'circle-exclamation',
      );
    } finally {
      setBusy(false);
    }
  }, [deleteTarget, isHt, refetch, showToast]);

  if (initialLoading) {
    return <PanelSkeleton rows={4} label={isHt ? 'Ap chaje pòs yo' : 'Loading posts'} />;
  }

  const needle = query.trim().toLowerCase();
  const visiblePosts = posts.filter((post) => {
    if (postFilter === 'pinned' && !post.is_pinned) return false;
    if (postFilter === 'poll' && !post.poll_question) return false;
    if (!needle) return true;
    return (post.content || '').toLowerCase().includes(needle)
      || (post.author_username || '').toLowerCase().includes(needle);
  });

  return (
    <div>
      <PanelHeader
        icon="fa-comments"
        title={isHt ? 'Pòs kominote a' : 'Community posts'}
        count={typeof totalCount === 'number' ? totalCount : posts.length}
        subtitle={isHt
          ? 'Ekri, kloure oswa modere pòs yo. Itilize bouton "Ekri yon pòs" pou pibliye dirèkteman.'
          : 'Write, pin, or moderate posts. Use "Write a post" to publish directly.'}
        refreshing={loading && loadedOnce}
        onRefresh={refetch}
        refreshLabel={isHt ? 'Rafrechi pòs yo' : 'Refresh posts'}
      >
        {canModerate && (
          <button
            type="button"
            className={composerOpen ? styles.secondaryBtn : styles.primaryBtn}
            onClick={() => setComposerOpen((v) => !v)}
            aria-expanded={composerOpen}
          >
            <i className={`fas ${composerOpen ? 'fa-xmark' : 'fa-pen-to-square'}`} aria-hidden="true" />
            {composerOpen
              ? (isHt ? 'Fèmen' : 'Close')
              : (isHt ? 'Ekri yon pòs' : 'Write a post')}
          </button>
        )}
      </PanelHeader>

      {composerOpen && canModerate && (
        <div className={styles.composer} style={{ marginBottom: 16 }}>
          <div className={styles.fieldLabel} style={{ marginBottom: 6 }}>
            {isHt ? 'Nouvo piblikasyon' : 'New publication'}
          </div>
          <textarea
            ref={draftRef}
            className={styles.textarea}
            rows={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={isHt
              ? 'Ekri sa w vle pataje… Kole yon lyen YouTube, WhatsApp, Facebook oswa sit wèb, li ap vin klike ak aperçu.'
              : 'Share an update… Paste a YouTube, WhatsApp, Facebook, or website link to make it clickable with a preview.'}
            maxLength={POST_MAX_LENGTH}
            aria-label={isHt ? 'Kontni pòs la' : 'Post content'}
          />

          {draftVideoUrl && (
            <div style={{ marginTop: 8 }}>
              <VideoTitleLink url={draftVideoUrl} />
              {!draftImageUrl && draftAutoThumb && (
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)' }}>
                  <img src={draftAutoThumb} alt="" loading="lazy" style={{ width: 72, height: 44, borderRadius: 6, objectFit: 'cover' }} />
                  <span><i className="fab fa-youtube" aria-hidden="true" /> {isHt ? 'Miniyati videyo a ap itilize kòm imaj pòs la.' : 'Video thumbnail will be used as the post image.'}</span>
                </div>
              )}
            </div>
          )}
          {draftGenericLink && <LinkPreviewCard url={draftGenericLink} compact />}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)' }}>{countPostChars(draft)}/{POST_MAX_LENGTH}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePickImage(f); }}
              />
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage || publishing}
              >
                <i className={`fas ${uploadingImage ? 'fa-spinner fa-spin' : 'fa-image'}`} aria-hidden="true" />
                {uploadingImage ? (isHt ? 'Ap telechaje…' : 'Uploading…') : (isHt ? 'Imaj' : 'Image')}
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setShowLinkInput((v) => !v)}
                aria-expanded={showLinkInput}
              >
                <i className="fas fa-link" aria-hidden="true" /> {isHt ? 'Lyen' : 'Link'}
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setShowPoll((v) => !v)}
                aria-expanded={showPoll}
              >
                <i className="fas fa-chart-bar" aria-hidden="true" /> {isHt ? 'Sondaj' : 'Poll'}
              </button>
            </div>
          </div>

          {showLinkInput && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <input
                type="url"
                className={styles.input}
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                placeholder="https://youtube.com/... oswa https://wa.me/... oswa https://..."
                aria-label={isHt ? 'Kole lyen' : 'Paste link'}
                style={{ flex: '1 1 220px' }}
              />
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={!linkValue.trim()}
                onClick={() => {
                  const u = linkValue.trim();
                  if (!u) return;
                  setDraft((d) => (d && !d.endsWith('\n') ? `${d}\n${u}` : `${d || ''}${u}`));
                  setLinkValue('');
                  setShowLinkInput(false);
                  draftRef.current?.focus();
                }}
              >
                <i className="fas fa-plus" aria-hidden="true" /> {isHt ? 'Ajoute lyen' : 'Add link'}
              </button>
            </div>
          )}

          {showPoll && (
            <div style={{ marginTop: 10, border: '1px dashed var(--border-color, #cbd5e1)', borderRadius: 10, padding: 10 }}>
              <input
                className={styles.input}
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                maxLength={300}
                placeholder={isHt ? 'Kesyon sondaj la...' : 'Poll question...'}
                aria-label={isHt ? 'Kesyon sondaj' : 'Poll question'}
                style={{ marginBottom: 8 }}
              />
              {pollOptions.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input
                    className={styles.input}
                    value={opt}
                    onChange={(e) => setPollOptions((list) => list.map((v, j) => (j === i ? e.target.value : v)))}
                    maxLength={200}
                    placeholder={isHt ? `Opsyon ${i + 1}` : `Option ${i + 1}`}
                  />
                  {pollOptions.length > 2 && (
                    <button type="button" className={styles.iconBtn} onClick={() => setPollOptions((list) => list.filter((_, j) => j !== i))} aria-label={isHt ? 'Retire opsyon' : 'Remove option'}>
                      <i className="fas fa-times" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: '0.8rem' }}>
                {pollOptions.length < 10 && (
                  <button type="button" className={styles.secondaryBtn} onClick={() => setPollOptions((list) => [...list, ''])} style={{ padding: '4px 10px' }}>
                    + {isHt ? 'Ajoute opsyon' : 'Add option'}
                  </button>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={pollAllowMultiple} onChange={(e) => setPollAllowMultiple(e.target.checked)} />
                  {isHt ? 'Plizyè chwa' : 'Multiple choice'}
                </label>
                <button type="button" className={styles.linkBtn} onClick={() => { setShowPoll(false); setPollQuestion(''); setPollOptions(['', '']); setPollAllowMultiple(false); }} style={{ marginLeft: 'auto' }}>
                  {isHt ? 'Retire sondaj' : 'Remove poll'}
                </button>
              </div>
            </div>
          )}

          {draftImageUrl && (
            <div style={{ marginTop: 10, position: 'relative', display: 'inline-block' }}>
              <img src={draftImageUrl} alt="" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 10, objectFit: 'cover', display: 'block' }} />
              <button
                type="button"
                onClick={() => setDraftImageUrl('')}
                aria-label={isHt ? 'Retire imaj' : 'Remove image'}
                style={{ position: 'absolute', top: 6, right: 6, border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer' }}
              >
                <i className="fas fa-times" aria-hidden="true" />
              </button>
            </div>
          )}
          <div className={styles.composerActions} style={{ marginTop: 12, gap: 8 }}>
            <button type="button" className={styles.secondaryBtn} onClick={resetComposer} disabled={publishing}>
              {isHt ? 'Anile' : 'Cancel'}
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={publishPost}
              disabled={publishing || uploadingImage || !draft.trim()}
            >
              <i className={`fas ${publishing ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} aria-hidden="true" />
              {publishing ? (isHt ? 'Ap pibliye…' : 'Publishing…') : (isHt ? 'Pibliye pòs' : 'Publish post')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <PanelError
          message={isHt ? 'Pat kapab chaje pòs yo.' : 'Could not load the posts.'}
          onRetry={refetch}
          retryLabel={isHt ? 'Reyese' : 'Retry'}
        />
      )}

      <div className={styles.searchBox}>
        <i className="fas fa-magnifying-glass" aria-hidden="true" />
        <input
          type="search"
          className={styles.searchInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isHt ? 'Chèche nan pòs yo…' : 'Search posts…'}
          aria-label={isHt ? 'Chèche nan pòs yo' : 'Search posts'}
        />
      </div>

      {posts.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {[
            { id: 'all', label: isHt ? 'Tout' : 'All' },
            { id: 'pinned', label: isHt ? 'Kloure' : 'Pinned' },
            { id: 'poll', label: isHt ? 'Sondaj' : 'Polls' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={postFilter === opt.id ? styles.primaryBtn : styles.secondaryBtn}
              onClick={() => setPostFilter(opt.id)}
              aria-pressed={postFilter === opt.id}
              style={{ padding: '5px 10px', fontSize: '0.75rem' }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {visiblePosts.length === 0 ? (
        <PanelEmpty
          icon={needle || postFilter !== 'all' ? 'fa-magnifying-glass' : 'fa-comments'}
          title={needle || postFilter !== 'all'
            ? (isHt ? 'Pa gen pòs ki koresponn.' : 'No posts match your filters.')
            : (isHt ? 'Poko gen pòs.' : 'No posts yet.')}
          description={needle || postFilter !== 'all'
            ? (isHt ? 'Ajiste rechèch oswa filtè a pou wè lòt pòs.' : 'Adjust your search or filter to see other posts.')
            : (isHt
              ? 'Lè manm yo kòmanse pataje, pòs yo ap parèt isit la pou ou jere.'
              : 'Once members start sharing, their posts show up here for you to manage.')}
        />
      ) : (
        <>
        <div className={styles.list}>
          {visiblePosts.map((post) => (
              <div key={post.id} className={styles.row} style={{ alignItems: 'flex-start' }}>
                <div className={styles.avatar} aria-hidden="true">
                  {(post.author_username || '?').slice(0, 2).toUpperCase()}
                </div>
                <div className={styles.rowBody}>
                  <div className={styles.rowName}>
                    @{post.author_username || 'membre'}
                    {post.is_pinned && (
                      <span className={`${styles.pill} ${styles.pillOwner}`}>
                        <i className="fas fa-thumbtack" aria-hidden="true" />
                        {isHt ? 'Kloure' : 'Pinned'}
                      </span>
                    )}
                    {post.poll_question && (
                      <span className={`${styles.pill} ${styles.pillStaff}`}>
                        {isHt ? 'Sondaj' : 'Poll'}
                      </span>
                    )}
                  </div>
                  <div className={styles.rowMeta}>
                    {fmtDate(post.created_at)}
                    {` · ❤ ${post.reaction_count ?? 0}`}
                    {` · 💬 ${post.comment_count ?? 0}`}
                  </div>
                  <div className={styles.rowContent}>
                    <PostRichContent post={post} lang={lang} />
                  </div>
                  {post.poll_question && (
                    <div className={styles.postPoll} style={{ marginTop: 8, padding: 10, border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 10 }}>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>
                        <i className="fas fa-chart-simple" aria-hidden="true" /> {post.poll_question}
                        {post.poll_allow_multiple ? <span className={styles.pill} style={{ marginLeft: 6 }}>{isHt ? 'Plizyè chwa' : 'Multiple'}</span> : null}
                      </div>
                      {Array.isArray(post.poll_options) && post.poll_options.length > 0 && (
                        <div style={{ display: 'grid', gap: 6 }}>
                          {post.poll_options.map((opt, idx) => {
                            const votes = Number(opt?.votes) || 0;
                            const total = post.poll_options.reduce((s, o) => s + (Number(o?.votes) || 0), 0);
                            const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
                            return (
                              <div key={idx} style={{ position: 'relative', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: 'rgba(37,99,235,0.12)' }} />
                                <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 8px', fontSize: '0.85rem' }}>
                                  <span>{opt?.text ?? ''}</span>
                                  <span style={{ color: 'var(--text-secondary, #64748b)' }}>{votes} · {pct}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => toggleComments(post)}
                    aria-expanded={commentsFor === post.id}
                  >
                    <i className="fas fa-comment-dots" aria-hidden="true" />
                    {isHt ? 'Kòmantè' : 'Comments'}
                    {` (${post.comment_count ?? 0})`}
                  </button>
                </div>
                {canModerate && (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => togglePin(post)}
                      disabled={busy}
                      title={post.is_pinned ? (isHt ? 'Dekloure' : 'Unpin') : (isHt ? 'Kloure' : 'Pin')}
                      aria-label={post.is_pinned
                        ? (isHt ? `Dekloure pòs @${post.author_username}` : `Unpin post by @${post.author_username}`)
                        : (isHt ? `Kloure pòs @${post.author_username}` : `Pin post by @${post.author_username}`)}
                    >
                      <i className={`fas ${post.is_pinned ? 'fa-thumbtack' : 'fa-thumbtack-slash'}`} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                      onClick={() => setDeleteTarget(post)}
                      disabled={busy}
                      title={isHt ? 'Efase pòs la' : 'Delete post'}
                      aria-label={isHt ? `Efase pòs @${post.author_username}` : `Delete post by @${post.author_username}`}
                    >
                      <i className="fas fa-trash-can" aria-hidden="true" />
                    </button>
                  </div>
                )}
                {commentsFor === post.id && (
                  <div className={styles.subPanel}>
                    <div className={styles.subPanelHead}>
                      <span>
                        <i className="fas fa-comment-dots" aria-hidden="true" />{' '}
                        {isHt ? 'Kòmantè' : 'Comments'}
                        {` (${comments.length})`}
                      </span>
                    </div>
                    {commentsLoading ? (
                      <CommentListSkeleton lang={lang} rows={2} />
                    ) : commentsError ? (
                      <div className={styles.subError}>
                        <span>{commentsError}</span>
                        <button type="button" className={styles.linkBtn} onClick={() => loadComments(post)}>
                          {isHt ? 'Reyese' : 'Retry'}
                        </button>
                      </div>
                    ) : comments.length === 0 ? (
                      <div className={styles.subEmpty}>
                        {isHt ? 'Poko gen kòmantè sou pòs sa a.' : 'No comments on this post yet.'}
                      </div>
                    ) : (
                      <div className={styles.subList}>
                        {comments.map((comment) => (
                          <div key={comment.id} className={styles.subRow}>
                            <div
                              className={styles.avatar}
                              style={{ width: 26, height: 26, fontSize: '0.6rem' }}
                              aria-hidden="true"
                            >
                              {(comment.author_username || '?').slice(0, 2).toUpperCase()}
                            </div>
                            <div className={styles.subText}>
                              <div className={styles.rowName}>@{comment.author_username || 'membre'}</div>
                              <div className={styles.subMeta}>{fmtDate(comment.created_at)}</div>
                              <div>{comment.content}</div>
                            </div>
                            {canModerate && (
                              <button
                                type="button"
                                className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                onClick={() => setCommentToDelete(comment)}
                                disabled={busy}
                                title={isHt ? 'Efase kòmantè a' : 'Delete comment'}
                                aria-label={isHt
                                  ? `Efase kòmantè @${comment.author_username}`
                                  : `Delete comment by @${comment.author_username}`}
                              >
                                <i className="fas fa-trash-can" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
          ))}
        </div>
        {!needle && hasMore && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
            <button
              type="button"
              className={styles.actionButton}
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore
                ? (isHt ? 'Ap chaje…' : 'Loading…')
                : (isHt ? 'Chaje plis pòs' : 'Load more posts')}
            </button>
          </div>
        )}
        </>
      )}

      {commentToDelete && (
        <ConfirmModal
          lang={lang}
          title={isHt ? 'Efase kòmantè a?' : 'Delete comment?'}
          message={isHt
            ? `Kòmantè @${commentToDelete.author_username} ap disparèt pou tout moun.`
            : `@${commentToDelete.author_username}'s comment will be removed for everyone.`}
          confirmText={isHt ? 'Efase' : 'Delete'}
          cancelText={isHt ? 'Anile' : 'Cancel'}
          onConfirm={confirmDeleteComment}
          onCancel={() => setCommentToDelete(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          lang={lang}
          title={isHt ? 'Efase pòs la?' : 'Delete post?'}
          message={isHt
            ? `Pòs @${deleteTarget.author_username} ap disparèt pou tout manm yo. Reaksyon ak kòmantè li yo ale tou.`
            : `@${deleteTarget.author_username}'s post will be removed for every member. Its reactions and comments go with it.`}
          confirmText={isHt ? 'Efase' : 'Delete'}
          cancelText={isHt ? 'Anile' : 'Cancel'}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
