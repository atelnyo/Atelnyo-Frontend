/**
 * src/components/community/CommunityPosts.jsx
 *
 * /community/:slug/posts — member-authored feed with emoji reactions.
 *
 * Reads { community, lang, t, user, showToast } from the parent
 * <Outlet context> (same contract as the other CommunityDetail tabs)
 * and owns its own list fetch. Reactions update optimistically and
 * roll back on error; posting and deleting patch the local list so
 * the UI never waits on a refetch.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api, { communitiesService } from '../../services/api';
import { t as t4 } from '../../utils/i18n';
import { resolveVideoSource, youtubeThumbnail } from '../../modules/explore/utils/videoSource';

/** First playable video URL inside a post body (YouTube/Vimeo/direct file), or '' — same resolver as Music. */
function firstVideoUrl(text) {
  if (!text || typeof text !== 'string') return '';
  const urls = text.match(/https?:\/\/[^\s)]+/gi) || [];
  for (const u of urls) {
    if (resolveVideoSource(u)) return u;
  }
  return '';
}

/** First non-video http(s) URL in a text, or '' — used for generic link unfurl. */
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

/** In-memory preview cache + in-flight dedup — avoids refetching the same link while typing/scrolling. */
const _previewCache = new Map();
const _previewInflight = new Map();
function fetchLinkPreview(url) {
  if (_previewCache.has(url)) return Promise.resolve(_previewCache.get(url));
  if (_previewInflight.has(url)) return _previewInflight.get(url);
  const p = api.get(`link-preview/?url=${encodeURIComponent(url)}`, { timeout: 15000 })
    .then((r) => {
      const data = r?.data || null;
      // Cache only usable cards (skip detail/error payloads).
      if (data && (data.title || data.description || data.image)) _previewCache.set(url, data);
      return data;
    })
    .catch(() => null)
    .finally(() => { _previewInflight.delete(url); });
  _previewInflight.set(url, p);
  if (_previewCache.size > 200) { const k = _previewCache.keys().next().value; _previewCache.delete(k); }
  return p;
}

/** Generic link preview card (og:title / og:description / og:image via /api/link-preview/).
 * Debounced 500ms so typing a link doesn't fire one request per keystroke. */
function LinkPreviewCard({ url }) {
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
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [url]);
  if (!url) return null;
  if (loading) {
    return (
      <div style={{ marginTop: 8, border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, height: 72, background: 'var(--bg-soft, #f8fafc)' }} data-testid="link-preview-loading" />
    );
  }
  if (!meta || (!meta.title && !meta.description && !meta.image)) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{ marginTop: 8, display: 'flex', gap: 10, border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, overflow: 'hidden', textDecoration: 'none', color: 'inherit', background: 'var(--bg-soft, #fff)' }}
      data-testid="link-preview-card">
      {meta.image && (
        <img src={meta.image} alt="" loading="lazy" style={{ width: 96, height: 72, objectFit: 'cover', flexShrink: 0 }} />
      )}
      <span style={{ padding: '8px 10px 8px 0', minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.6 }}>{meta.domain || (() => { try { return new URL(url).hostname; } catch { return ''; } })()}</span>
        <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta.title || url}</span>
        {meta.description && (
          <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: '0.72rem', opacity: 0.75, lineHeight: 1.4 }}>{meta.description}</span>
        )}
      </span>
      <span style={{ alignSelf: 'center', paddingRight: 10, opacity: 0.5 }} aria-hidden="true"><i className="fas fa-external-link-alt" /></span>
    </a>
  );
}

/** Inline poll ballot for a post (single/multiple choice, live bars). */
function PostPoll({ post, lang, user, onVoted, showToast }) {
  const opts = Array.isArray(post.poll_options) ? post.poll_options : [];
  const total = opts.reduce((s, o) => s + (Number(o?.votes) || 0), 0);
  const myVote = Array.isArray(post.poll_user_vote) ? post.poll_user_vote : [];
  const [picked, setPicked] = useState(myVote);
  const [voting, setVoting] = useState(false);
  useEffect(() => { setPicked(Array.isArray(post.poll_user_vote) ? post.poll_user_vote : []); }, [post.id, JSON.stringify(post.poll_user_vote)]);
  if (!post.poll_question || opts.length < 2) return null;
  const expired = post.poll_expires_at ? new Date(post.poll_expires_at) <= new Date() : false;
  const hasVoted = myVote.length > 0;
  const showBars = hasVoted || expired;
  function toggle(i) {
    if (hasVoted || expired || voting) return;
    if (post.poll_allow_multiple) {
      setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i].slice(0, 10)));
    } else {
      setPicked([i]);
    }
  }
  async function submit() {
    if (!user) { showToast?.(t4(lang, 'Konekte pou w vote', 'Sign in to vote', 'Connectez-vous pour voter', 'Inicia sesión para votar'), 'user-lock'); return; }
    if (picked.length === 0 || voting || hasVoted || expired) return;
    setVoting(true);
    try {
      const res = await communitiesService.votePoll(post.id, picked);
      if (res?.data?.id) onVoted?.(res.data);
    } catch (err) {
      showToast?.(err?.response?.data?.detail || t4(lang, 'Nou pa ka vote.', 'Could not vote.', 'Vote impossible.', 'No se pudo votar.'), 'circle-exclamation');
    } finally { setVoting(false); }
  }
  return (
    <div style={{ marginTop: 8, border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, padding: 10, background: 'var(--bg-soft, #fff)' }} data-testid={`post-poll-${post.id}`}>
      <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 8 }}><i className="fas fa-chart-bar" aria-hidden="true" style={{ marginRight: 6 }} />{post.poll_question}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {opts.map((o, i) => {
          const votes = Number(o?.votes) || 0;
          const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
          const active = picked.includes(i);
          if (!showBars) {
            return (
              <button key={i} type="button" onClick={() => toggle(i)} data-testid={`post-poll-opt-${post.id}-${i}`} aria-pressed={active}
                style={{ textAlign: 'left', border: active ? '2px solid #7c3aed' : '1px solid var(--border-color, #cbd5e1)', background: active ? '#f5f3ff' : '#fff', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: '0.82rem' }}>
                {post.poll_allow_multiple ? (active ? '☑ ' : '☐ ') : (active ? '● ' : '○ ')}{o?.text}
              </button>
            );
          }
          return (
            <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: active ? '2px solid #7c3aed' : '1px solid var(--border-color, #e2e8f0)', background: '#fff' }}>
              <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: active ? '#ddd6fe' : '#f1f5f9' }} />
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', padding: '8px 10px', fontSize: '0.82rem', fontWeight: active ? 700 : 400 }}>
                <span>{o?.text}</span><span>{votes} · {pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: '0.75rem', opacity: 0.8 }}>
        <span data-testid={`post-poll-total-${post.id}`}>{total} {t4(lang, 'vòt', 'votes', 'votes', 'votos')}</span>
        {expired && <span>· {t4(lang, 'Sondaj fini', 'Poll ended', 'Sondage terminé', 'Encuesta terminada')}</span>}
        {post.poll_allow_multiple && !expired && !hasVoted && <span>· {t4(lang, 'Chwazi plizyè', 'Multiple choice', 'Choix multiple', 'Opción múltiple')}</span>}
        {!hasVoted && !expired && (
          <button type="button" onClick={submit} disabled={picked.length === 0 || voting} data-testid={`post-poll-vote-${post.id}`}
            style={{ marginLeft: 'auto', borderRadius: 20, padding: '6px 14px', fontWeight: 700, cursor: 'pointer' }}>
            {voting ? '...' : t4(lang, 'Vòte', 'Vote', 'Voter', 'Votar')}
          </button>
        )}
      </div>
    </div>
  );
}

const REACTION_EMOJIS = ['❤️', '👍', '🎉', '😮', '😢'];

function PostSkeleton() {
  return (
    <div className="c-post-card c-post-skeleton" aria-hidden="true">
      <div className="c-post-skeleton-line c-post-skeleton-line--head" />
      <div className="c-post-skeleton-line" />
      <div className="c-post-skeleton-line c-post-skeleton-line--short" />
      <div className="c-post-skeleton-reactions">
        <span className="c-post-skeleton-pill" />
        <span className="c-post-skeleton-pill" />
        <span className="c-post-skeleton-pill" />
      </div>
    </div>
  );
}

function formatPostTime(iso, lang) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleString(lang === 'ht' ? 'fr-HT' : undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch { return ''; }
}

export default function CommunityPosts() {
  const { community, lang = 'ht', user, showToast } = useOutletContext();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef(null);
  const draftInputRef = useRef(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkValue, setLinkValue] = useState('');

  function focusDraft() { try { draftInputRef.current?.focus(); } catch { /* noop */ } }
  function appendLinkToDraft(raw) {
    const u = (raw || '').trim();
    if (!u) return;
    const clean = u.replace(/^[^h]+(?=https?:)/, '');
    setDraft((d) => (d && !d.endsWith('\n') ? `${d}\n${clean}` : `${d || ''}${clean}`));
    setLinkValue('');
    setShowLinkInput(false);
    focusDraft();
  }

  // ── Poll composer state ──────────────────────────────────
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);

  function resetPollCreator() {
    setShowPollCreator(false);
    setPollQuestion('');
    setPollOptions(['', '']);
    setPollAllowMultiple(false);
  }

  function pollPayload() {
    const q = pollQuestion.trim();
    if (!showPollCreator || !q) return {};
    const opts = pollOptions.map((o) => o.trim()).filter(Boolean).slice(0, 10);
    if (opts.length < 2) return { __invalid: true };
    return {
      poll_question: q.slice(0, 300),
      poll_options: opts.map((text) => ({ text, votes: 0 })),
      poll_allow_multiple: pollAllowMultiple,
    };
  }

  async function handlePickImage(file) {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      showToast?.(t4(lang, 'Chwazi yon fichye imaj.', 'Please select an image file.', 'Choisissez une image.', 'Elige una imagen.'), 'exclamation-triangle');
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
      if (res?.data?.url) setImageUrl(res.data.url);
    } catch {
      showToast?.(t4(lang, 'Erè nan telechaje imaj.', 'Image upload failed.', 'Échec du téléversement.', 'Falló la subida.'), 'circle-exclamation');
    } finally {
      setUploadingImage(false);
    }
  }
  const [reacting, setReacting] = useState({});
  const [openComments, setOpenComments] = useState({});
  const [commentLists, setCommentLists] = useState({});
  const [commentsLoading, setCommentsLoading] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [sendingComment, setSendingComment] = useState({});

  const slug = community?.slug;
  const isMember = Boolean(community?.is_member);
  const myRole = community?.current_user_role;
  const canModerate = ['owner', 'admin', 'moderator'].includes(myRole);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Debounce search typing 400ms so one request per query, not per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(() => {
    if (!slug) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync skeleton flip on slug change is intentional
    setLoading(true);
    setPage(1);
    communitiesService.posts(slug, { page: 1, ...(search ? { search } : {}) })
      .then((r) => {
        if (cancelled) return;
        const data = Array.isArray(r?.data) ? r.data : (r?.data?.results || []);
        const count = Array.isArray(r?.data) ? r.data.length : (r?.data?.count ?? data.length);
        const next = Array.isArray(r?.data) ? null : (r?.data?.next || null);
        setPosts(data);
        setTotalCount(count);
        // next URL from DRF, or heuristic: full page => probably more.
        setHasMore(Boolean(next) || data.length >= 20);
      })
      .catch(() => { /* silent — empty state covers failure */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => load(), [load]);
  useEffect(() => { if (slug) load(); }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const r = await communitiesService.posts(slug, { page: nextPage, ...(search ? { search } : {}) });
      const data = Array.isArray(r?.data) ? r.data : (r?.data?.results || []);
      const next = Array.isArray(r?.data) ? null : (r?.data?.next || null);
      if (data.length === 0) { setHasMore(false); return; }
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...data.filter((p) => !seen.has(p.id))];
      });
      setPage(nextPage);
      setHasMore(Boolean(next) || data.length >= 20);
    } catch { /* silent — button stays so user can retry */ }
    finally { setLoadingMore(false); }
  }

  async function handlePublish(e) {
    e?.preventDefault?.();
    const content = draft.trim();
    if (!content || publishing) return;
    if (!user) {
      showToast?.(t4(lang, 'Konekte pou w pibliye', 'Sign in to publish', 'Connectez-vous pour publier', 'Inicia sesión para publicar'), 'user-lock');
      return;
    }
    setPublishing(true);
    try {
      // Same as Music: a YouTube link already carries artwork — reuse its
      // thumbnail when the user didn't attach a photo from the gallery.
      const autoThumb = !imageUrl ? youtubeThumbnail(firstVideoUrl(content)) : '';
      const finalImage = imageUrl || autoThumb;
      const base = finalImage ? { content, image_url: finalImage } : { content };
      const poll = pollPayload();
      if (poll.__invalid) {
        showToast?.(t4(lang, 'Sondaj bezwen yon kesyon + omwen 2 opsyon.', 'A poll needs a question + at least 2 options.', 'Un sondage exige une question + 2 options.', 'Una encuesta necesita pregunta + 2 opciones.'), 'circle-exclamation');
        setPublishing(false);
        return;
      }
      const payload = { ...base, ...poll };
      const res = await communitiesService.createPost(slug, payload);
      if (res?.data?.id) {
        // Backend order is pinned-first then newest: insert the new post
        // right after the pinned block so epengle posts never move.
        setPosts((prev) => {
          const rest = prev.filter((p) => p.id !== res.data.id);
          const idx = rest.findIndex((p) => !p.is_pinned);
          if (res.data.is_pinned || idx === -1) return [res.data, ...rest];
          return [...rest.slice(0, idx), res.data, ...rest.slice(idx)];
        });
        setTotalCount((c) => c + 1);
      }
      setDraft('');
      setImageUrl('');
      resetPollCreator();
      showToast?.(t4(lang, 'Pòs pibliye!', 'Post published!', 'Publication réussie !', '¡Publicación exitosa!'), 'check-circle');
    } catch (err) {
      showToast?.(err?.response?.data?.detail || t4(lang, 'Nou pa ka pibliye.', 'Could not publish.', 'Publication impossible.', 'No se pudo publicar.'), 'circle-exclamation');
    } finally {
      setPublishing(false);
    }
  }

  async function handleReact(post, emoji) {
    if (reacting[post.id]) return;
    if (!user) {
      showToast?.(t4(lang, 'Konekte pou w reyaji', 'Sign in to react', 'Connectez-vous pour réagir', 'Inicia sesión para reaccionar'), 'user-lock');
      return;
    }
    const prev = posts;
    const had = post.my_reaction === emoji;
    // Optimistic toggle: same emoji removes, different one swaps.
    const nextReactions = { ...(post.reactions || {}) };
    if (post.my_reaction) {
      nextReactions[post.my_reaction] = Math.max(0, (nextReactions[post.my_reaction] || 1) - 1);
      if (nextReactions[post.my_reaction] === 0) delete nextReactions[post.my_reaction];
    }
    // Same emoji → count drops by 1; swap → count unchanged; fresh → +1.
    const nextCount = Math.max(0, (post.reaction_count || 0) + (had ? -1 : (post.my_reaction ? 0 : 1)));
    setPosts((list) => list.map((p) => (p.id === post.id
      ? { ...p, my_reaction: had ? null : emoji, reactions: nextReactions, reaction_count: Math.max(0, nextCount) }
      : p)));
    setReacting((m) => ({ ...m, [post.id]: true }));
    try {
      const res = await communitiesService.reactToPost(post.id, emoji);
      if (res?.data?.id) {
        setPosts((list) => list.map((p) => (p.id === post.id ? res.data : p)));
      }
    } catch (err) {
      setPosts(prev); // roll back the optimistic flip
      showToast?.(err?.response?.data?.detail || t4(lang, 'Nou pa ka reyaji.', 'Could not react.', 'Réaction impossible.', 'No se pudo reaccionar.'), 'circle-exclamation');
    } finally {
      setReacting((m) => ({ ...m, [post.id]: false }));
    }
  }

  async function handleDelete(post) {
    if (!window.confirm(t4(lang, 'Efase pòs sa a?', 'Delete this post?', 'Supprimer cette publication ?', '¿Eliminar esta publicación?'))) return;
    const prev = posts;
    setPosts((list) => list.filter((p) => p.id !== post.id));
    try {
      await communitiesService.deletePost(post.id);
      showToast?.(t4(lang, 'Pòs efase.', 'Post deleted.', 'Publication supprimée.', 'Publicación eliminada.'), 'trash');
    } catch (err) {
      setPosts(prev);
      showToast?.(err?.response?.data?.detail || t4(lang, 'Pa t kapab efase.', 'Could not delete.', 'Suppression impossible.', 'No se pudo eliminar.'), 'circle-exclamation');
    }
  }

  function canDelete(post) {
    if (!user) return false;
    if (canModerate) return true;
    return user.id === post.author || user.username === post.author_username;
  }

  function canDeleteComment(comment) {
    if (!user) return false;
    if (canModerate) return true;
    return user.id === comment.author || user.username === comment.author_username;
  }

  function toggleComments(post) {
    const willOpen = !openComments[post.id];
    setOpenComments((m) => ({ ...m, [post.id]: willOpen }));
    if (willOpen && commentLists[post.id] === undefined && !commentsLoading[post.id]) {
      setCommentsLoading((m) => ({ ...m, [post.id]: true }));
      communitiesService.postComments(post.id)
        .then((r) => {
          const data = Array.isArray(r?.data) ? r.data : (r?.data?.results || []);
          setCommentLists((m) => ({ ...m, [post.id]: data }));
        })
        .catch(() => { setCommentLists((m) => ({ ...m, [post.id]: [] })); })
        .finally(() => { setCommentsLoading((m) => ({ ...m, [post.id]: false })); });
    }
  }

  async function handleSendComment(post) {
    const content = (commentDrafts[post.id] || '').trim();
    if (!content || sendingComment[post.id]) return;
    if (!user) {
      showToast?.(t4(lang, 'Konekte pou w kòmante', 'Sign in to comment', 'Connectez-vous pour commenter', 'Inicia sesión para comentar'), 'user-lock');
      return;
    }
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId, content, author: user.id, author_username: user.username,
      created_at: new Date().toISOString(),
    };
    setCommentLists((m) => ({ ...m, [post.id]: [...(m[post.id] || []), optimistic] }));
    setCommentDrafts((m) => ({ ...m, [post.id]: '' }));
    setSendingComment((m) => ({ ...m, [post.id]: true }));
    try {
      const res = await communitiesService.createComment(post.id, content);
      if (res?.data?.id) {
        setCommentLists((m) => ({
          ...m,
          [post.id]: (m[post.id] || []).map((c) => (c.id === tempId ? res.data : c)),
        }));
      }
      setPosts((list) => list.map((p) => (p.id === post.id
        ? { ...p, comment_count: (p.comment_count || 0) + 1 }
        : p)));
    } catch (err) {
      setCommentLists((m) => ({
        ...m, [post.id]: (m[post.id] || []).filter((c) => c.id !== tempId),
      }));
      showToast?.(err?.response?.data?.detail || t4(lang, 'Nou pa ka kòmante.', 'Could not comment.', 'Commentaire impossible.', 'No se pudo comentar.'), 'circle-exclamation');
    } finally {
      setSendingComment((m) => ({ ...m, [post.id]: false }));
    }
  }

  async function handleDeleteComment(post, comment) {
    if (String(comment.id).startsWith('temp-')) return;
    const prev = commentLists[post.id] || [];
    setCommentLists((m) => ({
      ...m, [post.id]: prev.filter((c) => c.id !== comment.id),
    }));
    try {
      await communitiesService.deleteComment(comment.id);
      setPosts((list) => list.map((p) => (p.id === post.id
        ? { ...p, comment_count: Math.max(0, (p.comment_count || 1) - 1) }
        : p)));
    } catch (err) {
      setCommentLists((m) => ({ ...m, [post.id]: prev }));
      showToast?.(err?.response?.data?.detail || t4(lang, 'Pa t kapab efase.', 'Could not delete.', 'Suppression impossible.', 'No se pudo eliminar.'), 'circle-exclamation');
    }
  }

  if (loading) {
    return (
      <div className="c-list c-list--gap12" data-testid="posts-skeleton">
        <PostSkeleton />
        <PostSkeleton />
        <PostSkeleton />
      </div>
    );
  }

  return (
    <div className="c-list c-list--gap12">
      {isMember && (
        <form className="c-post-composer c-post-composer--nice" onSubmit={handlePublish}
          style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 12, padding: 12, background: 'var(--bg-soft, #fff)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#2d1b69,#d81b60)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
              {((user?.username || '?')[0] || '?').toUpperCase()}
            </span>
            <textarea
              ref={draftInputRef}
              className="c-post-composer-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={t4(lang, 'Kisa w ap panse? Ekri tèks, kole link, oswa ajoute foto/videyo...', 'What\'s on your mind? Write text, paste a link, or add photo/video...', 'À quoi pensez-vous ? Écrivez, collez un lien ou ajoutez photo/vidéo...', '¿Qué piensas? Escribe, pega un enlace o añade foto/video...')}
              aria-label={t4(lang, 'Nouvo pòs', 'New post', 'Nouvelle publication', 'Nueva publicación')}
              data-testid="post-composer-input"
              style={{ flex: 1, border: 'none', outline: 'none', resize: 'vertical', background: 'transparent' }}
            />
          </div>
          {(() => {
            if (imageUrl) return null;
            const vUrl = firstVideoUrl(draft);
            const thumb = vUrl ? youtubeThumbnail(vUrl) : '';
            if (!thumb) return null;
            return (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', opacity: 0.85 }} data-testid="post-composer-video-thumb">
                <img src={thumb} alt="" loading="lazy" style={{ width: 72, height: 48, borderRadius: 6, objectFit: 'cover' }} />
                <span><i className="fab fa-youtube" aria-hidden="true" style={{ marginRight: 4 }} />{t4(lang, 'Imaj videyo a ap sèvi kòm foto pòs la.', 'Video thumbnail will be used as the post image.', 'La miniature servira d\u2019image.', 'La miniatura se usará como imagen.')}</span>
              </div>
            );
          })()}
          {(() => {
            const link = firstGenericLinkUrl(draft);
            if (!link) return null;
            return <LinkPreviewCard url={link} />;
          })()}
          {imageUrl && (
            <div style={{ position: 'relative', marginTop: 8 }}>
              <img src={imageUrl} alt="" loading="lazy" style={{ width: '100%', borderRadius: 8, maxHeight: 220, objectFit: 'cover' }} data-testid="post-composer-preview" />
              <button type="button" onClick={() => setImageUrl('')} aria-label={t4(lang, 'Retire imaj', 'Remove image', 'Retirer', 'Quitar')} data-testid="post-composer-remove-image"
                style={{ position: 'absolute', top: 6, right: 6, border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer' }}>
                <i className="fas fa-times" aria-hidden="true" />
              </button>
            </div>
          )}
          {showPollCreator && (
            <div style={{ marginTop: 8, border: '1px dashed var(--border-color, #cbd5e1)', borderRadius: 8, padding: 10 }} data-testid="post-composer-poll-creator">
              <input
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                maxLength={300}
                placeholder={t4(lang, 'Kesyon sondaj la...', 'Poll question...', 'Question du sondage...', 'Pregunta de la encuesta...')}
                aria-label={t4(lang, 'Kesyon sondaj', 'Poll question', 'Question', 'Pregunta')}
                data-testid="post-composer-poll-question"
                style={{ width: '100%', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}
              />
              {pollOptions.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input
                    value={opt}
                    onChange={(e) => setPollOptions((list) => list.map((v, j) => (j === i ? e.target.value : v)))}
                    maxLength={200}
                    placeholder={t4(lang, `Opsyon ${i + 1}`, `Option ${i + 1}`, `Option ${i + 1}`, `Opción ${i + 1}`)}
                    data-testid={`post-composer-poll-opt-${i}`}
                    style={{ flex: 1, border: '1px solid var(--border-color, #cbd5e1)', borderRadius: 8, padding: '6px 10px' }}
                  />
                  {pollOptions.length > 2 && (
                    <button type="button" onClick={() => setPollOptions((list) => list.filter((_, j) => j !== i))} data-testid={`post-composer-poll-del-${i}`} aria-label="Remove"
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><i className="fas fa-times" aria-hidden="true" /></button>
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, fontSize: '0.78rem', flexWrap: 'wrap' }}>
                {pollOptions.length < 10 && (
                  <button type="button" onClick={() => setPollOptions((list) => [...list, ''])} data-testid="post-composer-poll-add"
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#7c3aed', fontWeight: 700 }}>
                    + {t4(lang, 'Ajoute opsyon', 'Add option', 'Ajouter', 'Añadir')}
                  </button>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={pollAllowMultiple} onChange={(e) => setPollAllowMultiple(e.target.checked)} data-testid="post-composer-poll-multi" />
                  {t4(lang, 'Plizyè chwa', 'Multiple choice', 'Choix multiple', 'Opción múltiple')}
                </label>
                <button type="button" onClick={resetPollCreator} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.7 }}>
                  {t4(lang, 'Retire sondaj', 'Remove poll', 'Retirer', 'Quitar')}
                </button>
              </div>
            </div>
          )}
          {showLinkInput && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }} data-testid="post-composer-link-row">
              <input
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); appendLinkToDraft(linkValue); } }}
                placeholder="https://..."
                inputMode="url"
                aria-label={t4(lang, 'Kole link', 'Paste link', 'Coller le lien', 'Pegar enlace')}
                data-testid="post-composer-link-input"
                style={{ flex: 1, border: '1px solid var(--border-color, #cbd5e1)', borderRadius: 8, padding: '8px 10px' }}
              />
              <button type="button" onClick={() => appendLinkToDraft(linkValue)} disabled={!linkValue.trim()} data-testid="post-composer-link-add"
                style={{ borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>
                {t4(lang, 'Ajoute', 'Add', 'Ajouter', 'Añadir')}
              </button>
            </div>
          )}
          <div className="c-post-composer-row" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label={t4(lang, 'Tip kontni', 'Content type', 'Type de contenu', 'Tipo de contenido')}>
              <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploadingImage || publishing} title={t4(lang, 'Foto', 'Photo', 'Photo', 'Foto')} data-testid="post-composer-gallery"
                style={{ border: imageUrl ? '1px solid #16a34a' : '1px solid var(--border-color, #cbd5e1)', background: imageUrl ? '#f0fdf4' : 'transparent', borderRadius: 20, padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem' }}>
                <i className={`fas ${uploadingImage ? 'fa-spinner fa-spin' : 'fa-images'}`} aria-hidden="true" /> {t4(lang, 'Foto', 'Photo', 'Photo', 'Foto')}
              </button>
              <button type="button" onClick={() => { focusDraft(); showToast?.(t4(lang, 'Kole link YouTube/Vimeo dirèkteman nan tèks la.', 'Paste a YouTube/Vimeo link directly in the text.', 'Collez un lien YouTube/Vimeo dans le texte.', 'Pega un enlace de YouTube/Vimeo en el texto.'), 'info'); }} title="Video" data-testid="post-composer-video-btn"
                style={{ border: firstVideoUrl(draft) ? '1px solid #7c3aed' : '1px solid var(--border-color, #cbd5e1)', background: firstVideoUrl(draft) ? '#f5f3ff' : 'transparent', borderRadius: 20, padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem' }}>
                <i className="fas fa-video" aria-hidden="true" /> Video
              </button>
              <button type="button" onClick={() => setShowLinkInput((v) => !v)} title="Link" data-testid="post-composer-link-btn" aria-expanded={showLinkInput}
                style={{ border: firstGenericLinkUrl(draft) ? '1px solid #0284c7' : '1px solid var(--border-color, #cbd5e1)', background: firstGenericLinkUrl(draft) ? '#f0f9ff' : 'transparent', borderRadius: 20, padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem' }}>
                <i className="fas fa-link" aria-hidden="true" /> Link
              </button>
              <button type="button" onClick={() => setShowPollCreator((v) => !v)} title={t4(lang, 'Sondaj', 'Poll', 'Sondage', 'Encuesta')} data-testid="post-composer-poll-btn" aria-expanded={showPollCreator}
                style={{ border: showPollCreator ? '1px solid #7c3aed' : '1px solid var(--border-color, #cbd5e1)', background: showPollCreator ? '#f5f3ff' : 'transparent', borderRadius: 20, padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem' }}>
                <i className="fas fa-chart-bar" aria-hidden="true" /> {t4(lang, 'Sondaj', 'Poll', 'Sondage', 'Encuesta')}
              </button>
            </span>
            <span className="c-post-composer-hint" style={{ marginLeft: 'auto', fontSize: '0.72rem', opacity: 0.65 }}>
              {t4(lang, 'Manm sèlman ka wè pòs yo.', 'Members only can see posts.', 'Seuls les membres voient les publications.', 'Solo los miembros ven las publicaciones.')}
            </span>
            <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePickImage(f); e.target.value = ''; }} data-testid="post-composer-file" />
            <button
              type="submit"
              className="c-post-composer-btn"
              disabled={publishing || !draft.trim()}
              data-testid="post-composer-submit"
              style={{ borderRadius: 20, padding: '8px 16px', fontWeight: 700 }}
            >
              {publishing
                ? <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                : <><i className="fas fa-paper-plane" aria-hidden="true" /> {t4(lang, 'Voye', 'Send', 'Envoyer', 'Enviar')}</>}
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <i className="fas fa-search" aria-hidden="true" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t4(lang, 'Chache yon pòs... (tèks oswa @user)', 'Search posts... (text or @user)', 'Rechercher... (texte ou @user)', 'Buscar... (texto o @usuario)')}
            aria-label={t4(lang, 'Chache pòs', 'Search posts', 'Rechercher', 'Buscar')}
            data-testid="posts-search-input"
            style={{ width: '100%', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: 20, padding: '8px 32px 8px 32px' }}
          />
          {searchInput && (
            <button type="button" onClick={() => setSearchInput('')} aria-label="Clear" data-testid="posts-search-clear"
              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.6 }}>
              <i className="fas fa-times" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {search && (
        <p style={{ fontSize: '0.78rem', opacity: 0.7 }} data-testid="posts-search-status">
          {t4(lang, `Rezilta pou "${search}" — ${totalCount}`, `Results for "${search}" — ${totalCount}`, `Résultats pour "${search}" — ${totalCount}`, `Resultados para "${search}" — ${totalCount}`)}
        </p>
      )}

      {posts.length === 0 ? (
        <div className="c-state">
          <i className="fas fa-comments c-state-icon" aria-hidden="true" />
          <p className="c-state-text">
            {isMember
              ? t4(lang, 'Pa gen pòs ankò — se premye moun ki pibliye!', 'No posts yet — be the first to publish!', 'Aucune publication — soyez le premier !', '¡Sin publicaciones — sé el primero!')
              : t4(lang, 'Pa gen pòs ankò.', 'No posts yet.', 'Aucune publication.', 'Sin publicaciones.')}
          </p>
          {!isMember && (
            <p className="c-state-text">
              {t4(lang, 'Antre nan kominote a pou w patisipe.', 'Join the community to take part.', 'Rejoignez la communauté pour participer.', 'Únete a la comunidad para participar.')}
            </p>
          )}
        </div>
      ) : posts.map((post) => (
        <article key={post.id} className={`c-post-card${post.is_pinned ? ' c-post-card--pinned' : ''}`} data-testid={`community-post-${post.id}`}>
          <div className="c-post-header">
            <span className="c-post-avatar" aria-hidden="true">
              {(post.author_username || '?')[0].toUpperCase()}
            </span>
            <div className="c-post-meta">
              <span className="c-title c-title--xs">@{post.author_username}</span>
              <span className="c-post-time">{formatPostTime(post.created_at, lang)}</span>
            </div>
            {post.is_pinned && (
              <span className="c-post-pinned" title={t4(lang, 'Epinglé pa moderatè', 'Pinned by moderators', 'Épinglé par les modérateurs', 'Fijado por moderadores')}>
                <i className="fas fa-thumbtack" aria-hidden="true" />
              </span>
            )}
            {canDelete(post) && (
              <button
                type="button"
                className="c-post-delete"
                onClick={() => handleDelete(post)}
                title={t4(lang, 'Efase', 'Delete', 'Supprimer', 'Eliminar')}
                aria-label={t4(lang, 'Efase pòs', 'Delete post', 'Supprimer', 'Eliminar')}
                data-testid={`post-delete-${post.id}`}
              >
                <i className="fas fa-trash" aria-hidden="true" />
              </button>
            )}
          </div>
          <p className="c-post-content">{post.content}</p>
          {(() => {
            const vidUrl = post.video_url || firstVideoUrl(post.content);
            const video = vidUrl ? resolveVideoSource(vidUrl) : null;
            // Same as Music: YouTube link carries its own thumbnail when
            // the author didn't attach a photo.
            const img = post.image_url || (vidUrl ? youtubeThumbnail(vidUrl) : '');
            const link = firstGenericLinkUrl(post.content);
            return (
              <>
                {img && <img className="c-post-image" src={img} alt="" loading="lazy" />}
                {video && (
                  video.kind === 'embed' ? (
                    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 8, background: '#000', marginTop: 8 }}>
                      <iframe src={video.src} title="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
                    </div>
                  ) : (
                    <video src={video.src} controls preload="metadata" playsInline poster={img || undefined} style={{ width: '100%', borderRadius: 8, background: '#000', marginTop: 8, display: 'block' }} />
                  )
                )}
                {link && <LinkPreviewCard url={link} />}
                {post.poll_question && (
                  <PostPoll post={post} lang={lang} user={user} showToast={showToast}
                    onVoted={(updated) => setPosts((list) => list.map((p) => (p.id === updated.id ? updated : p)))} />
                )}
              </>
            );
          })()}
          <div className="c-post-foot">
            <button
              type="button"
              className={`c-comment-toggle${openComments[post.id] ? ' c-comment-toggle--open' : ''}`}
              onClick={() => toggleComments(post)}
              aria-expanded={Boolean(openComments[post.id])}
              data-testid={`post-comments-toggle-${post.id}`}
            >
              <i className="fas fa-comment" aria-hidden="true" /> {post.comment_count || 0} {t4(lang, 'kòmantè', 'comments', 'commentaires', 'comentarios')}
            </button>
          </div>
          {openComments[post.id] && (
            <div className="c-comments" data-testid={`post-comments-${post.id}`}>
              {commentsLoading[post.id] ? (
                <div className="c-comments-loading">
                  <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                </div>
              ) : (commentLists[post.id] || []).length === 0 ? (
                <p className="c-comments-empty">
                  {t4(lang, 'Pa gen kòmantè ankò — kòmanse diskisyon an!', 'No comments yet — start the discussion!', 'Aucun commentaire — lancez la discussion !', '¡Sin comentarios — inicia la discusión!')}
                </p>
              ) : (commentLists[post.id] || []).map((comment) => (
                <div key={comment.id} className="c-comment">
                  <span className="c-comment-avatar" aria-hidden="true">
                    {(comment.author_username || '?')[0].toUpperCase()}
                  </span>
                  <div className="c-comment-body">
                    <span className="c-comment-author">@{comment.author_username}</span>
                    <span className="c-comment-text">{comment.content}</span>
                  </div>
                  {canDeleteComment(comment) && (
                    <button
                      type="button"
                      className="c-comment-delete"
                      onClick={() => handleDeleteComment(post, comment)}
                      title={t4(lang, 'Efase', 'Delete', 'Supprimer', 'Eliminar')}
                      aria-label={t4(lang, 'Efase kòmantè', 'Delete comment', 'Supprimer', 'Eliminar')}
                      data-testid={`comment-delete-${comment.id}`}
                    >
                      <i className="fas fa-trash" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
              {isMember && (
                <div className="c-comment-form">
                  <input
                    className="c-comment-input"
                    value={commentDrafts[post.id] || ''}
                    onChange={(e) => setCommentDrafts((m) => ({ ...m, [post.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSendComment(post); }}
                    maxLength={1000}
                    placeholder={t4(lang, 'Ekri yon kòmantè...', 'Write a comment...', 'Écrivez un commentaire...', 'Escribe un comentario...')}
                    aria-label={t4(lang, 'Nouvo kòmantè', 'New comment', 'Nouveau commentaire', 'Nuevo comentario')}
                    data-testid={`comment-input-${post.id}`}
                  />
                  <button
                    type="button"
                    className="c-comment-send"
                    onClick={() => handleSendComment(post)}
                    disabled={sendingComment[post.id] || !(commentDrafts[post.id] || '').trim()}
                    aria-label={t4(lang, 'Voye kòmantè', 'Send comment', 'Envoyer', 'Enviar')}
                    data-testid={`comment-send-${post.id}`}
                  >
                    {sendingComment[post.id]
                      ? <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                      : <i className="fas fa-paper-plane" aria-hidden="true" />}
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="c-post-reactions" role="group" aria-label={t4(lang, 'Reyaksyon', 'Reactions', 'Réactions', 'Reacciones')}>
            {REACTION_EMOJIS.map((emoji) => {
              const count = post.reactions?.[emoji] || 0;
              const active = post.my_reaction === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  className={`c-react-btn${active ? ' c-react-btn--active' : ''}`}
                  onClick={() => handleReact(post, emoji)}
                  disabled={Boolean(reacting[post.id])}
                  aria-pressed={active}
                  aria-label={`${emoji} ${count}`}
                  data-testid={`post-react-${post.id}-${emoji}`}
                >
                  <span aria-hidden="true">{emoji}</span>
                  {count > 0 && <span className="c-react-count">{count}</span>}
                </button>
              );
            })}
          </div>
        </article>
      ))}
      {hasMore && posts.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            data-testid="posts-load-more"
            style={{ border: '1px solid var(--border-color, #cbd5e1)', borderRadius: 20, padding: '8px 20px', cursor: 'pointer', background: '#fff', fontWeight: 600 }}
          >
            {loadingMore
              ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> ...</>
              : <>{t4(lang, `Chaje plis (${posts.length}/${totalCount || '?'})`, `Load more (${posts.length}/${totalCount || '?'})`, `Charger plus (${posts.length}/${totalCount || '?'})`, `Cargar más (${posts.length}/${totalCount || '?'})`)}</>}
          </button>
        </div>
      )}
    </div>
  );
}
