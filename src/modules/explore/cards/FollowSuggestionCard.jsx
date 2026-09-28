/**
 * src/modules/explore/cards/FollowSuggestionCard.jsx
 *
 * "You May Want to Follow" — creator (account) suggestion card rendered
 * by the HomeFeed ``follow_suggestions`` rail.
 *
 * The backend (CreatorFollowRecommender) blends 8 signals per creator and
 * returns each item with:
 *
 *   identity    — name, username/slug, skills, avatar_url, followers_count
 *   badges      — is_verified / is_featured
 *   _reason     — localized reason chips (why is this creator suggested)
 *   _score      — blended signal total
 *
 * The card shows the avatar, name, reason, skills, follower count and a
 * Follow / Following button (wired to the real /creator-profiles/<slug>/follow/
 * toggle). Clicking the card body opens the creator's public profile
 * (/@username).
 */
import React, { useState } from 'react';
import { creatorProfileService } from '../../../services/api';
import { classNames } from '../utils/cardHelpers';

/** Simple SVG avatar fallback so a missing image never breaks the rail. */
function FollowAvatarFallback({ name, lang }) {
  return (
    <div className="explore-follow-avatar-fallback" aria-hidden="true">
      <i className="fas fa-user" />
    </div>
  );
}

export default function FollowSuggestionCard({
  item,
  t,
  lang = 'ht',
  user,
  showToast,
  onFollowed,
  onOpenProfile,
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [following, setFollowing] = useState(Boolean(item.is_following));
  const [followLoading, setFollowLoading] = useState(false);

  const avatar = item.avatar_url || item.avatar || '';
  const name = item.name || item.username || '';
  const slug = item.slug || item.username;
  const reasons = (item._reason && item._reason[lang]) || item._reason?.en || [];
  const skills = Array.isArray(item.skills) ? item.skills : [];

  const followersLabel =
    item.followers_count > 0
      ? `${item.followers_count.toLocaleString()} `
        + (lang === 'ht' ? 'swiv' : 'followers')
      : '';

  function handleOpen() {
    if (onOpenProfile && slug) onOpenProfile(item);
  }

  async function handleFollow(e) {
    e.stopPropagation();
    if (!user) {
      showToast?.(lang === 'ht' ? 'Konekte pou swiv kreyatè' : 'Log in to follow creators', 'info-circle');
      return;
    }
    if (followLoading) return;
    setFollowLoading(true);
    try {
      const res = await creatorProfileService.follow(slug);
      const isFollowing = res.data?.is_following ?? !following;
      setFollowing(isFollowing);
      showToast?.(
        isFollowing
          ? (lang === 'ht' ? `Ap swiv ${name}` : `Following ${name}`)
          : (lang === 'ht' ? `Retire swivi pou ${name}` : `Unfollowed ${name}`),
        isFollowing ? 'user-check' : 'user-minus',
      );
      onFollowed?.(item.content_id, isFollowing);
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail
          || (lang === 'ht' ? 'Pa t kapab chanje swivi' : 'Could not update follow'),
        'exclamation-circle',
      );
    } finally {
      setFollowLoading(false);
    }
  }

  return (
    <div
      className={classNames('explore-card', 'explore-card-follow', following && 'is-following')}
      onClick={handleOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpen(); } }}
      data-testid="follow-suggestion-card"
      data-creator-id={item.content_id}
    >
      <div className="explore-card-image-wrap explore-follow-avatar-wrap">
        {avatar && !imgFailed ? (
          <img
            className="explore-talent-avatar explore-follow-avatar"
            src={avatar}
            alt={name}
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <FollowAvatarFallback name={name} lang={lang} />
        )}
        {item.is_verified && (
          <span className="explore-follow-verified" title={t.profile_verified || 'Verified'}>
            <i className="fas fa-badge-check" aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="explore-follow-meta">
        <div className="explore-card-title explore-follow-name" title={name}>
          {name}
        </div>
        {followersLabel && (
          <div className="explore-follow-stats">
            <i className="fas fa-users" aria-hidden="true" />
            <span>{followersLabel}</span>
          </div>
        )}
        {reasons.length > 0 && (
          <div className="explore-follow-reason" title={reasons.join(' · ')}>
            <i className="fas fa-lightbulb" aria-hidden="true" />
            <span>{reasons[0]}</span>
          </div>
        )}
        {skills.length > 0 && (
          <div className="explore-talent-skills explore-follow-skills">
            {skills.slice(0, 3).map((s) => (
              <span key={s} className="explore-card-tag explore-card-tag-skill">{s}</span>
            ))}
            {skills.length > 3 && (
              <span className="explore-card-tag explore-card-tag-overflow">+{skills.length - 3}</span>
            )}
          </div>
        )}
      </div>

      <div className="explore-follow-actions">
        <button
          type="button"
          className={classNames('explore-follow-btn', following && 'is-following')}
          onClick={handleFollow}
          disabled={followLoading}
          aria-pressed={following}
          aria-label={
            following
              ? (lang === 'ht' ? `Retire swivi pou ${name}` : `Unfollow ${name}`)
              : (lang === 'ht' ? `Swiv ${name}` : `Follow ${name}`)
          }
        >
          {followLoading ? (
            <i className="fas fa-spinner fa-spin" aria-hidden="true" />
          ) : (
            <i className={`fas ${following ? 'fa-user-check' : 'fa-user-plus'}`} aria-hidden="true" />
          )}
          {following
            ? (t.profile_following || 'Following')
            : (t.profile_follow || 'Follow')}
        </button>
      </div>
    </div>
  );
}
