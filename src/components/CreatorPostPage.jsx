/**
 * src/components/CreatorPostPage.jsx
 *
 * Public single-post page — ``/c/{username}/post/{slug}``.
 *
 * This is the canonical URL the docs/sitemap declare (see
 * ``public_entity/adapters/post.py``) and the destination of the feed's
 * ``newest_post`` / ``trending_post`` cards. The post list itself lives on
 * the creator profile, so the page always offers a way back to it.
 */
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { creatorProfileService } from '../services/api';

function formatDate(value, lang) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(lang === 'ht' ? 'fr-HT' : undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default function CreatorPostPage({ lang = 'en' }) {
  const { username = '', slug = '' } = useParams();
  const isHt = lang === 'ht';
  const [post, setPost] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | missing | error

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    creatorProfileService.getPost(username, slug)
      .then((res) => {
        if (cancelled) return;
        const payload = res?.data?.data ?? res?.data ?? null;
        if (!payload?.slug) {
          setState('missing');
          return;
        }
        setPost(payload);
        setState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setState(err?.response?.status === 404 ? 'missing' : 'error');
      });
    return () => { cancelled = true; };
  }, [username, slug]);

  const backToProfile = (
    <Link to={`/c/${encodeURIComponent(username)}`} className="creator-post-back">
      <i className="fas fa-arrow-left" aria-hidden="true" />
      {isHt ? `Pwofil @${username}` : `@${username}'s profile`}
    </Link>
  );

  if (state === 'loading') {
    return (
      <div className="creator-post-page" aria-busy="true">
        <div className="creator-post-skeleton">
          <div className="explore-skel-line explore-skel-line--title" />
          <div className="explore-skel-line explore-skel-line--sub" />
          <div className="explore-skel-line explore-skel-line--sub" />
        </div>
      </div>
    );
  }

  if (state === 'missing' || state === 'error') {
    return (
      <div className="creator-post-page">
        {backToProfile}
        <h1 className="creator-post-title">
          {state === 'missing'
            ? (isHt ? 'Pòs sa a pa egziste' : 'This post does not exist')
            : (isHt ? 'Nou pa t ka chaje pòs la' : 'Could not load the post')}
        </h1>
        <p className="creator-post-meta">
          {state === 'missing'
            ? (isHt ? 'Li ka siprime, oswa lyen an pa bon.' : 'It may have been deleted, or the link is wrong.')
            : (isHt ? 'Eseye ankò nan yon ti moman.' : 'Please try again in a moment.')}
        </p>
      </div>
    );
  }

  return (
    <article className="creator-post-page">
      {backToProfile}
      <header className="creator-post-header">
        <h1 className="creator-post-title">
          {isHt ? 'Pòs' : 'Post'}
        </h1>
        <p className="creator-post-meta">
          <Link to={`/c/${encodeURIComponent(username)}`} className="creator-post-author">
            <i className="fas fa-at" aria-hidden="true" /> {post.author_username || username}
          </Link>
          {post.created_at && (
            <span className="creator-post-date"> · {formatDate(post.created_at, lang)}</span>
          )}
        </p>
      </header>

      {post.image_url && (
        <img
          className="creator-post-image"
          src={post.image_url}
          alt=""
          loading="lazy"
        />
      )}

      <div className="creator-post-body">{post.body}</div>

      <footer className="creator-post-footer">
        {backToProfile}
      </footer>
    </article>
  );
}
