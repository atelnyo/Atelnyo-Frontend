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

  const load = useCallback(() => {
    if (!slug) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync skeleton flip on slug change is intentional
    setLoading(true);
    communitiesService.posts(slug)
      .then((r) => {
        if (cancelled) return;
        const data = Array.isArray(r?.data) ? r.data : (r?.data?.results || []);
        setPosts(data);
      })
      .catch(() => { /* silent — empty state covers failure */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => load(), [load]);

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
      const payload = finalImage ? { content, image_url: finalImage } : { content };
      const res = await communitiesService.createPost(slug, payload);
      if (res?.data?.id) setPosts((prev) => [res.data, ...prev.filter((p) => p.id !== res.data.id)]);
      setDraft('');
      setImageUrl('');
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
        <form className="c-post-composer" onSubmit={handlePublish}>
          <textarea
            className="c-post-composer-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={t4(lang, 'Ekri yon bagay pou kominote a...', 'Write something for the community...', 'Écrivez quelque chose pour la communauté...', 'Escribe algo para la comunidad...')}
            aria-label={t4(lang, 'Nouvo pòs', 'New post', 'Nouvelle publication', 'Nueva publicación')}
            data-testid="post-composer-input"
          />
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
          {imageUrl && (
            <div style={{ position: 'relative', marginTop: 8 }}>
              <img src={imageUrl} alt="" loading="lazy" style={{ width: '100%', borderRadius: 8, maxHeight: 220, objectFit: 'cover' }} data-testid="post-composer-preview" />
              <button type="button" onClick={() => setImageUrl('')} aria-label={t4(lang, 'Retire imaj', 'Remove image', 'Retirer', 'Quitar')} data-testid="post-composer-remove-image"
                style={{ position: 'absolute', top: 6, right: 6, border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer' }}>
                <i className="fas fa-times" aria-hidden="true" />
              </button>
            </div>
          )}
          <div className="c-post-composer-row">
            <span className="c-post-composer-hint">
              {t4(lang, 'Manm sèlman ka wè pòs yo.', 'Members only can see posts.', 'Seuls les membres voient les publications.', 'Solo los miembros ven las publicaciones.')}
            </span>
            <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePickImage(f); e.target.value = ''; }} data-testid="post-composer-file" />
            <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploadingImage || publishing} title={t4(lang, 'Ajoute foto nan galri', 'Add photo from gallery', 'Ajouter une photo', 'Añadir foto')} data-testid="post-composer-gallery"
              style={{ border: '1px dashed var(--border-color, #cbd5e1)', background: 'transparent', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
              <i className={`fas ${uploadingImage ? 'fa-spinner fa-spin' : 'fa-images'}`} aria-hidden="true" />
            </button>
            <button
              type="submit"
              className="c-post-composer-btn"
              disabled={publishing || !draft.trim()}
              data-testid="post-composer-submit"
            >
              {publishing
                ? <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                : <><i className="fas fa-paper-plane" aria-hidden="true" /> {t4(lang, 'Pibliye', 'Publish', 'Publier', 'Publicar')}</>}
            </button>
          </div>
        </form>
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
    </div>
  );
}
