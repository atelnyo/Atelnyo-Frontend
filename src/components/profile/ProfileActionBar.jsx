import React from 'react';

/**
 * ActionBar — M3 buttons, all real actions.
 * VERBATIM extraction from CreatorPublicProfile.jsx (post-A-2) for Stage A-3.5.
 * Follow/share/copyLink work via the parent's handlers; message/hire/collab
 * open the REAL contact modal (ProfileContactModal) wired to the backend
 * send-message / hire / collaborate endpoints — previously they toasted
 * a placeholder message while the API existed but was never called.
 *
 * The Affiliate + Campaigns buttons are gated on REAL data passed from the
 * parent (affiliateActive = creator has an active affiliate program,
 * campaignsEnabled = creator has active campaigns). The old
 * `profile.affiliate_enabled` / `profile.campaigns_enabled` gates were dead
 * code — those fields never exist in the API payload, so the buttons could
 * never render.
 *
 * @param {{
 *   profile: any, lang: string, isOwner: boolean, isFollowing: boolean,
 *   onFollow: ()=>void, onShare: ()=>void, onCopyLink: ()=>void,
 *   copied: boolean, followLoading: boolean, showToast: Function,
 *   onMessage: (presetSubject?:string)=>void, onHire: ()=>void,
 *   onCollab: ()=>void, onTip: ()=>void, onBook: ()=>void,
 *   onSubscribe: ()=>void, subscriptionsEnabled: boolean,
 *   isSubscribed: boolean,
 *   affiliateActive: boolean, campaignsEnabled: boolean,
 * }} props
 */
export default function ActionBar({
  profile, lang, isOwner, isFollowing,
  onFollow, onShare, onCopyLink, copied, followLoading, showToast, t,
  onMessage, onHire, onCollab, onTip, onBook, onSubscribe,
  subscriptionsEnabled = false, isSubscribed = false,
  affiliateActive = false, campaignsEnabled = false,
}) {
  return (
    <div className="csp-actions" role="group" aria-label="Creator actions">
      <button
        type="button"
        className={`csp-btn ${isFollowing ? 'csp-btn--primary csp-following' : 'csp-btn--primary'}`}
        onClick={onFollow}
        disabled={followLoading || isOwner}
        aria-disabled={followLoading || isOwner}
        title={isOwner ? (t.profile_own_profile || 'Own profile') : undefined}
      >
        {followLoading ? (
          <i className="fas fa-spinner fa-spin" aria-hidden="true" />
        ) : (
          <i className={`fas ${isFollowing ? 'fa-user-check' : 'fa-user-plus'}`} aria-hidden="true" />
        )}
        {isFollowing
          ? (t.profile_following || 'Following')
          : (t.profile_follow || 'Follow')}
      </button>

      <button
        type="button"
        className="csp-btn csp-btn--secondary"
        title={t.profile_message_title || 'Message'}
        onClick={() => onMessage?.()}
      >
        <i className="fas fa-envelope" aria-hidden="true" />
        {t.profile_message_title || 'Message'}
      </button>

      <button
        type="button"
        className="csp-btn csp-btn--ghost"
        onClick={onShare}
        title={t.profile_share || 'Share'}
      >
        <i className="fas fa-share-alt" aria-hidden="true" />
        {t.profile_share || 'Share'}
      </button>

      <button
        type="button"
        className="csp-btn csp-btn--ghost csp-btn--icon"
        onClick={onCopyLink}
        title={t.profile_copy_link || 'Copy link'}
        aria-label={t.profile_copy_link || 'Copy link'}
      >
        <i className={`fas ${copied ? 'fa-check' : 'fa-link'}`} aria-hidden="true" />
      </button>

      <div className="csp-actions-divider" aria-hidden="true" />

      <button
        type="button"
        className="csp-btn csp-btn--ghost"
        title={t.profile_hire || 'Hire'}
        onClick={() => onHire?.()}
      >
        <i className="fas fa-briefcase" aria-hidden="true" />
        {t.profile_hire || 'Hire'}
      </button>

      <button
        type="button"
        className="csp-btn csp-btn--ghost"
        title={t.profile_collaborate || 'Collaborate'}
        onClick={() => onCollab?.()}
      >
        <i className="fas fa-handshake" aria-hidden="true" />
        {t.profile_collab_short || 'Collab'}
      </button>

      <button
        type="button"
        className="csp-btn csp-btn--ghost"
        title={t.profile_tip || 'Tip'}
        onClick={() => onTip?.()}
      >
        <i className="fas fa-hand-holding-heart" aria-hidden="true" />
        {t.profile_tip || 'Tip'}
      </button>

      {subscriptionsEnabled && !isOwner && (
        <button
          type="button"
          className={`csp-btn ${isSubscribed ? 'csp-btn--primary csp-following' : 'csp-btn--primary'}`}
          title={isSubscribed
            ? (t.profile_subscribed || 'Subscribed')
            : (t.profile_subscribe || 'Subscribe')}
          onClick={() => onSubscribe?.()}
        >
          <i className={`fas ${isSubscribed ? 'fa-star' : 'fa-star'}`} aria-hidden="true" />
          {isSubscribed
            ? (t.profile_subscribed || 'Subscribed')
            : (t.profile_subscribe || 'Subscribe')}
        </button>
      )}

      <button
        type="button"
        className="csp-btn csp-btn--ghost"
        title={t.profile_book || 'Book'}
        onClick={() => onBook?.()}
      >
        <i className="fas fa-calendar-check" aria-hidden="true" />
        {t.profile_book || 'Book'}
      </button>

      {/* Real-data-gated buttons: the parent passes affiliateActive (from
          /affiliate-status/) and campaignsEnabled (from active campaigns),
          so these only render when the creator actually has those features. */}
      {affiliateActive && (
        <button
          type="button"
          className="csp-btn csp-btn--ghost"
          title={t.profile_affiliate_offers || 'Affiliate'}
          onClick={() => onMessage?.(lang === 'ht' ? 'Demann Afilyasyon' : 'Affiliate inquiry')}
        >
          <i className="fas fa-hand-holding-usd" aria-hidden="true" />
          {t.profile_affiliate_short || 'Affiliate'}
        </button>
      )}

      {campaignsEnabled && (
        <button
          type="button"
          className="csp-btn csp-btn--ghost"
          title={t.profile_campaigns || 'Campaigns'}
          onClick={() => onMessage?.(lang === 'ht' ? 'Demann Kanpay' : 'Campaign inquiry')}
        >
          <i className="fas fa-bullhorn" aria-hidden="true" />
          {t.profile_campaigns || 'Campaigns'}
        </button>
      )}

      <button
        type="button"
        className="csp-btn csp-btn--ghost csp-btn--icon"
        title={t.profile_more || 'More'}
        onClick={() => showToast?.(t.profile_more_options || 'More options', 'info-circle')}
      >
        <i className="fas fa-ellipsis-h" aria-hidden="true" />
      </button>
    </div>
  );
}
