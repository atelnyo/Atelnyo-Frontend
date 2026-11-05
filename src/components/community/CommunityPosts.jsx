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
import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { communitiesService } from '../../services/api';
import { t as t4 } from '../../utils/i18n';

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
  const [reacting, setReacting] = useState({});

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
      const res = await communitiesService.createPost(slug, { content });
      if (res?.data?.id) setPosts((prev) => [res.data, ...prev.filter((p) => p.id !== res.data.id)]);
      setDraft('');
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
          <div className="c-post-composer-row">
            <span className="c-post-composer-hint">
              {t4(lang, 'Manm sèlman ka wè pòs yo.', 'Members only can see posts.', 'Seuls les membres voient les publications.', 'Solo los miembros ven las publicaciones.')}
            </span>
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
          {post.image_url && (
            <img className="c-post-image" src={post.image_url} alt="" loading="lazy" />
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
