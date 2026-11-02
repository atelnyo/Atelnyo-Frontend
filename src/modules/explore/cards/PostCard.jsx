/**
 * src/modules/explore/cards/PostCard.jsx
 *
 * Creator post card — the text-first card the feed's ``newest_post`` /
 * ``trending_post`` rails render. Posts are always public and have no
 * standalone route yet, so the card opens the author's profile where the
 * post list lives (``/c/{username}``).
 */
import React, { useState } from 'react';
import ContentFeedbackMenu from '../../../components/shared/ContentFeedbackMenu';

function PostFallback({ label }) {
  return (
    <div className="explore-card-fallback">
      <svg viewBox="0 0 600 340" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="post-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d81b60" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <rect width="600" height="340" fill="url(#post-grad)" />
        <g transform="translate(300,150)" opacity="0.22" fill="#d81b60">
          <rect x="-90" y="-40" width="180" height="16" rx="8" />
          <rect x="-90" y="-10" width="150" height="12" rx="6" />
          <rect x="-90" y="16" width="170" height="12" rx="6" />
        </g>
        <text
          x="300" y="285" textAnchor="middle" fill="#d81b60" opacity="0.5"
          fontFamily="system-ui, -apple-system, sans-serif" fontSize="14" fontWeight="600"
        >
          {label || 'Post'}
        </text>
      </svg>
    </div>
  );
}

export default function PostCard({ post, onOpen, t }) {
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const body = post.body || post.description || post.title || '';
  const author = post.author_username || post.creator_name || '';
  const image = post.image_url || post.thumbnail_url;
  const open = () => onOpen?.(post);

  return (
    <div
      className="explore-card explore-card-post"
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
    >
      <div className="explore-card-image-wrap">
        {image && !imgFailed ? (
          <img
            className={`explore-card-image ${imgLoaded ? 'explore-card-image--loaded' : ''}`}
            src={image}
            alt=""
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <PostFallback label={author} />
        )}
        <div className="explore-card-badge explore-card-badge-post" aria-hidden="true">
          <i className="fas fa-pen-nib" />
        </div>
      </div>
      <div className="explore-card-body">
        <div className="explore-card-subtitle explore-card-post-body">{body}</div>
        <div className="explore-card-meta">
          {author && (
            <span className="explore-card-tag">
              <i className="fas fa-at" aria-hidden="true" /> {author}
            </span>
          )}
          <ContentFeedbackMenu contentType="post" contentId={post.id} />
          <span className="explore-card-cta" aria-hidden="true" style={{ marginLeft: 'auto' }}>
            <i className="fas fa-arrow-right" />
          </span>
        </div>
      </div>
    </div>
  );
}
