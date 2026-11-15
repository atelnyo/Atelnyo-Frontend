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
import React, { useCallback, useRef, useState } from 'react';
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
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const PREVIEW_LENGTH = 260;

export default function CommunityPostsPanel({
  slug,
  lang = 'en',
  showToast,
  canModerate = false,
}) {
  const isHt = lang === 'ht';
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [commentsFor, setCommentsFor] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState('');
  const [commentToDelete, setCommentToDelete] = useState(null);
  const commentsForRef = useRef(null);

  const {
    data: posts, loading, error, refetch,
  } = useFetch(
    () => communitiesService.posts(slug, { page_size: 30 }),
    { defaultValue: [], transform: asArray, deps: [slug] },
  );

  const initialLoading = useInitialLoading(loading);

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
  const visiblePosts = needle
    ? posts.filter((post) => (
      (post.content || '').toLowerCase().includes(needle)
      || (post.author_username || '').toLowerCase().includes(needle)
    ))
    : posts;

  return (
    <div>
      <PanelHeader
        icon="fa-comments"
        title={isHt ? 'Pòs manm yo' : 'Member posts'}
        count={posts.length}
        subtitle={isHt
          ? 'Manm yo ekri pòs yo. Ou ka kloure bon pòs yo epi efase sa ki pa nan sijè a.'
          : 'Members write the posts. Pin the good ones and remove anything off-topic.'}
        refreshing={loading}
        onRefresh={refetch}
        refreshLabel={isHt ? 'Rafrechi pòs yo' : 'Refresh posts'}
      />

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

      {visiblePosts.length === 0 ? (
        <PanelEmpty
          icon={needle ? 'fa-magnifying-glass' : 'fa-comments'}
          title={needle
            ? (isHt ? 'Pa gen pòs ki koresponn.' : 'No posts match your search.')
            : (isHt ? 'Poko gen pòs.' : 'No posts yet.')}
          description={needle
            ? undefined
            : (isHt
              ? 'Lè manm yo kòmanse pataje, pòs yo ap parèt isit la pou ou jere.'
              : 'Once members start sharing, their posts show up here for you to manage.')}
        />
      ) : (
        <div className={styles.list}>
          {visiblePosts.map((post) => {
            const content = post.content || '';
            return (
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
                  <ExpandableText
                    text={content}
                    limit={PREVIEW_LENGTH}
                    lang={lang}
                    className={styles.rowContent}
                  />
                  {post.image_url && (
                    <a
                      className={styles.postImageLink}
                      href={post.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img className={styles.postImage} src={post.image_url} alt="" loading="lazy" />
                    </a>
                  )}
                  {post.poll_question && (
                    <div className={styles.postPoll}>
                      <i className="fas fa-chart-simple" aria-hidden="true" /> {post.poll_question}
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
                      <div className={styles.subEmpty}>
                        <i className="fas fa-spinner fa-spin" aria-hidden="true" />{' '}
                        {isHt ? 'Ap chaje kòmantè yo…' : 'Loading comments…'}
                      </div>
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
            );
          })}
        </div>
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
