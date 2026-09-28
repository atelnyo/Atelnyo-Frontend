/**
 * src/components/ActivityTimeline.jsx
 *
 * Phase 30 — Unified Activity Timeline.
 *
 * Renders the cross-module activity feed from GET /api/activity/feed/
 * with cursor pagination (infinite scroll). Events are grouped by date
 * (Today, Yesterday, This Week, Earlier) with type-specific icons.
 *
 * Event-type icon mapping covers all 11 ecosystem pillars:
 *   Work:  job_posted, proposal_sent, contract_started, milestone_approved
 *   Create: project_published, endorsement_received
 *   Learn: course_enrolled, course_completed
 *   Community: community_joined, event_created
 *   Marketplace: review_received, order_placed
 *   Social: story_created
 *   Wallet: revenue_earned, payout_requested
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { activityFeedService } from '../services/api';

// ─── Event type → icon + label mapping ─────────────────────────────────

const EVENT_META = {
  job_posted:             { icon: 'fa-briefcase',       label_ht: 'Travay pibliye',         label_en: 'Job posted' },
  proposal_sent:          { icon: 'fa-file-signature',  label_ht: 'Pwopozisyon voye',       label_en: 'Proposal sent' },
  proposal_submitted:     { icon: 'fa-file-signature',  label_ht: 'Pwopozisyon resevwa',    label_en: 'Proposal received' },
  contract_started:       { icon: 'fa-handshake',       label_ht: 'Kontra kòmanse',          label_en: 'Contract started' },
  milestone_completed:    { icon: 'fa-check-circle',    label_ht: 'Mileston fini',           label_en: 'Milestone completed' },
  milestone_approved:     { icon: 'fa-thumbs-up',       label_ht: 'Mileston apwouve',        label_en: 'Milestone approved' },
  project_published:      { icon: 'fa-palette',         label_ht: 'Pwojè pibliye',           label_en: 'Project published' },
  endorsement_received:   { icon: 'fa-medal',           label_ht: 'Andòsman resevwa',        label_en: 'Endorsement received' },
  credential_verified:    { icon: 'fa-certificate',     label_ht: 'Sètifika verifye',        label_en: 'Credential verified' },
  course_enrolled:        { icon: 'fa-graduation-cap',  label_ht: 'Enskri nan kou',          label_en: 'Enrolled in course' },
  course_completed:       { icon: 'fa-trophy',          label_ht: 'Kou fini',                label_en: 'Course completed' },
  community_joined:       { icon: 'fa-users',           label_ht: 'Antre nan kominote',      label_en: 'Joined community' },
  event_created:          { icon: 'fa-calendar-plus',   label_ht: 'Evènman kreye',           label_en: 'Event created' },
  // Moderation notices — private timeline events for the targeted
  // member only (is_public=False on the backend).
  community_member_banned:   { icon: 'fa-ban',           label_ht: 'Ou te ban nan kominote',   label_en: 'You were banned from a community' },
  community_member_unbanned: { icon: 'fa-unlock',        label_ht: 'Ban ou te leve',           label_en: 'Your ban was lifted' },
  community_member_muted:    { icon: 'fa-volume-xmark',  label_ht: 'Ou te mute nan kominote',  label_en: 'You were muted in a community' },
  community_member_unmuted:  { icon: 'fa-volume-high',   label_ht: 'Ou pa mute ankò',          label_en: 'You were unmuted' },
  review_received:        { icon: 'fa-star',            label_ht: 'Revizyon resevwa',        label_en: 'Review received' },
  order_placed:           { icon: 'fa-shopping-cart',   label_ht: 'Kòmann pase',             label_en: 'Order placed' },
  story_created:          { icon: 'fa-circle',          label_ht: 'Nouvo istwa',             label_en: 'New story' },
  tip_received:           { icon: 'fa-heart',           label_ht: 'Tip resevwa',             label_en: 'Tip received' },
  tip_sent:               { icon: 'fa-paper-plane',     label_ht: 'Tip voye',                label_en: 'Tip sent' },
  revenue_earned:         { icon: 'fa-coins',           label_ht: 'Revni touche',            label_en: 'Revenue earned' },
  payout_requested:       { icon: 'fa-money-bill-transfer', label_ht: 'Peman mande',       label_en: 'Payout requested' },
  message_sent:           { icon: 'fa-envelope',        label_ht: 'Mesaj voye',              label_en: 'Message sent' },
  // DM surface: an inbound message from the public-profile contact
  // modal (goes to the creator → Studio messages) and a reply (goes to
  // ANY recipient → the /sheet/messages inbox).
  profile_message:        { icon: 'fa-envelope',        label_ht: 'Nouvo mesaj',             label_en: 'New message' },
  message_received:       { icon: 'fa-reply',           label_ht: 'Nouvo repons',            label_en: 'New reply' },
  // Phase 59 — profile invitations the creator can accept / reject.
  profile_hire_request:   { icon: 'fa-briefcase',       label_ht: 'Demann anboche',          label_en: 'Hire request' },
  profile_collab_request: { icon: 'fa-handshake',       label_ht: 'Demann kolaborasyon',     label_en: 'Collab request' },
  profile_service_booking:{ icon: 'fa-calendar-check',  label_ht: 'Rezèvasyon sèvis',        label_en: 'Service booking' },
  // The requester's side of a decision (created by respond/).
  profile_request_accepted: { icon: 'fa-check-circle',  label_ht: 'Demann aksepte',          label_en: 'Request accepted' },
  profile_request_rejected: { icon: 'fa-xmark-circle',  label_ht: 'Demann rejte',            label_en: 'Request rejected' },
  // Phase 60 — follow + follower-publish notifications.
  new_follower:           { icon: 'fa-user-plus',       label_ht: 'Nouvo abonè',             label_en: 'New follower' },
  new_subscriber:         { icon: 'fa-star',            label_ht: 'Nouvo abonè peyan',       label_en: 'New paid subscriber' },
  subscription_renewed:   { icon: 'fa-rotate',          label_ht: 'Abònman renouvle',        label_en: 'Subscription renewed' },
  new_content:            { icon: 'fa-bolt',            label_ht: 'Nouvo konten',            label_en: 'New content' },
  live_room_joined:       { icon: 'fa-video',           label_ht: 'Antre nan live',          label_en: 'Joined live room' },
  product_listed:         { icon: 'fa-tag',             label_ht: 'Pwodui pibliye',          label_en: 'Product listed' },
  announcement_posted:    { icon: 'fa-bullhorn',        label_ht: 'Anons pibliye',           label_en: 'Announcement posted' },
  ticket_purchased:       { icon: 'fa-ticket',          label_ht: 'Tikè achte',              label_en: 'Ticket purchased' },
  profile_updated:        { icon: 'fa-user-pen',        label_ht: 'Pwofil ajou',             label_en: 'Profile updated' },
  affiliate_approved:     { icon: 'fa-user-check',      label_ht: 'Aplikasyon apwouve',      label_en: 'Affiliate approved' },
  affiliate_rejected:     { icon: 'fa-user-xmark',      label_ht: 'Aplikasyon rejte',        label_en: 'Affiliate rejected' },
  // Business branch (Phase 5/6) — order + seller events
  order_received:         { icon: 'fa-cart-plus',       label_ht: 'Kòmand resevwa',          label_en: 'Order received' },
  order_paid:             { icon: 'fa-wallet',          label_ht: 'Kòmand peye',             label_en: 'Order paid' },
  order_refunded:         { icon: 'fa-rotate-left',     label_ht: 'Kòmand rembouse',         label_en: 'Order refunded' },
  order_status_updated:   { icon: 'fa-arrows-rotate',   label_ht: 'Estati kòmand ajou',      label_en: 'Order status updated' },
  order_cancelled:        { icon: 'fa-xmark',           label_ht: 'Kòmand anile',            label_en: 'Order cancelled' },
  order_reviewed:         { icon: 'fa-star',            label_ht: 'Nouvo revizyon',           label_en: 'New review' },
  inquiry_received:       { icon: 'fa-envelope',        label_ht: 'Nouvo demann',            label_en: 'New inquiry' },
  inquiry_replied:        { icon: 'fa-reply',           label_ht: 'Biznis reponn',           label_en: 'Business replied' },
  seller_activated:       { icon: 'fa-circle-play',     label_ht: 'Seller aktive',           label_en: 'Seller activated' },
  seller_deactivated:     { icon: 'fa-circle-pause',    label_ht: 'Seller dezaktive',        label_en: 'Seller deactivated' },
  seller_suspended:       { icon: 'fa-circle-stop',     label_ht: 'Seller sispann',          label_en: 'Seller suspended' },
  seller_unsuspended:     { icon: 'fa-circle-play',     label_ht: 'Seller re-aktive',        label_en: 'Seller unsuspended' },
  // Fallback
  default:                { icon: 'fa-bell',            label_ht: 'Aktivite',                label_en: 'Activity' },
};

const NOTIFICATION_ROUTES = {
  job_posted:             (d) => d?.job_id ? `/sheet/explore/job?id=${d.job_id}` : null,
  proposal_submitted:     (d) => d?.job_id ? `/sheet/explore/job?id=${d.job_id}` : null,
  proposal_sent:          (d) => d?.job_id ? `/sheet/explore/job?id=${d.job_id}` : null,
  project_published:      (d) => d?.project_id ? `/portfolio/${d.project_id}` : null,
  course_enrolled:        (d) => d?.course_id ? `/sheet/course/${d.course_id}` : null,
  course_completed:       (d) => d?.course_id ? `/sheet/course/${d.course_id}` : null,
  community_joined:       (d) => d?.community_slug ? `/sheet/community/${d.community_slug}` : null,
  // Moderation notices deep-link to the community, but banned members
  // cannot view it — the backend blocks the fetch and the UI shows the
  // generic error, so only the unbanned/unmuted variants link through.
  community_member_banned:   () => null,
  community_member_unbanned: (d) => d?.community_slug ? `/sheet/community/${d.community_slug}` : null,
  community_member_muted:    (d) => d?.community_slug ? `/sheet/community/${d.community_slug}` : null,
  community_member_unmuted:  (d) => d?.community_slug ? `/sheet/community/${d.community_slug}` : null,
  event_created:          (d) => d?.community_slug ? `/sheet/community/${d.community_slug}` : (d?.event_id ? `/sheet/event/${d.event_id}` : null),
  review_received:        (d) => d?.product_id ? `/marketplace/${d.product_id}` : null,
  order_placed:           (d) => d?.product_id ? `/marketplace/${d.product_id}` : null,
  tip_received:           () => '/sheet/wallet',
  tip_sent:               () => '/sheet/wallet',
  // A message to the creator opens the Studio inbox; a REPLY opens the
  // universal /sheet/messages inbox (the recipient may not be a
  // creator, so they have no Studio messages tab).
  profile_message:        () => '/sheet/studio?section=messages',
  message_received:       () => '/sheet/messages',
  // An accepted invitation opens the auto-created thread.
  profile_request_accepted: () => '/sheet/messages',
  // A new follower/subscriber → their profile; a publish by a followed
  // creator → the exact content (reuses the inner route for the type).
  new_follower:           (d) => (d?.follower_username ? `/c/${d.follower_username}` : null),
  new_subscriber:         (d) => (d?.subscriber_username ? `/c/${d.subscriber_username}` : null),
  subscription_renewed:   (d) => (d?.subscriber_username ? `/c/${d.subscriber_username}` : null),
  new_content:            (d) => {
    const inner = NOTIFICATION_ROUTES[d?.content_type];
    if (inner) { const r = inner(d || {}); if (r) return r; }
    return (d?.creator_username ? `/c/${d.creator_username}` : null);
  },
  affiliate_approved:     () => '/sheet/referral',
  affiliate_rejected:     () => '/sheet/referral',
  // Business branch — owner events open the workspace of the shop,
  // customer events open their My Orders tracker.
  order_received:         (d) => (d?.business_slug ? `/business/${d.business_slug}/workspace` : null),
  order_paid:             (d) => (d?.business_slug ? `/business/${d.business_slug}/workspace` : null),
  order_cancelled:        (d) => (d?.business_slug ? `/business/${d.business_slug}/workspace` : null),
  order_status_updated:   () => '/business/orders/mine',
  order_refunded:         () => '/business/orders/mine',
  // A review is addressed to the OWNER — open their workspace.
  order_reviewed:         (d) => (d?.business_slug ? `/business/${d.business_slug}/workspace` : null),
  // An inquiry goes to the OWNER (workspace) or the CUSTOMER (public
  // page, where the contact modal's "My inquiries" shows the reply).
  inquiry_received:       (d) => (d?.business_slug ? `/business/${d.business_slug}/workspace` : null),
  inquiry_replied:        (d) => (d?.business_slug ? `/business/${d.business_slug}` : null),
  seller_activated:       (d) => (d?.business_slug ? `/business/${d.business_slug}/workspace` : null),
  seller_deactivated:     (d) => (d?.business_slug ? `/business/${d.business_slug}/workspace` : null),
  seller_suspended:       (d) => (d?.business_slug ? `/business/${d.business_slug}/workspace` : null),
  seller_unsuspended:     (d) => (d?.business_slug ? `/business/${d.business_slug}/workspace` : null),
};

function getEventRoute(event) {
  const builder = NOTIFICATION_ROUTES[event?.event_type];
  if (!builder) return null;
  try {
    return builder(event?.data || {});
  } catch {
    return null;
  }
}

export { getEventRoute, NOTIFICATION_ROUTES };

function getEventMeta(eventType, lang) {
  const meta = EVENT_META[eventType] || EVENT_META.default;
  return {
    icon: meta.icon,
    label: lang === 'ht' ? meta.label_ht : meta.label_en,
  };
}

// ─── Date grouping ──────────────────────────────────────────────────────

function getDateGroup(isoString) {
  const now = new Date();
  const then = new Date(isoString);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  if (then >= today) return 'today';
  if (then >= yesterday) return 'yesterday';
  if (then >= weekAgo) return 'week';
  return 'earlier';
}

const DATE_LABELS = {
  today:     { ht: 'Jodi a',     en: 'Today' },
  yesterday: { ht: 'Yè',         en: 'Yesterday' },
  week:      { ht: 'Semèn sa a', en: 'This Week' },
  earlier:   { ht: 'Pi bonè',    en: 'Earlier' },
};

// ─── Time ago helper ────────────────────────────────────────────────────

function formatTimeAgo(isoString, lang) {
  if (!isoString) return '';
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return lang === 'ht' ? 'kounye a' : 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return lang === 'ht' ? `${diffMin}m de sa` : `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return lang === 'ht' ? `${diffHr}è de sa` : `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return lang === 'ht' ? `${diffDay}j de sa` : `${diffDay}d ago`;
  return new Date(isoString).toLocaleDateString();
}

// ─── Skeleton placeholder ───────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div className="act-feed-skeleton" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="act-feed-skel-row">
          <div className="act-feed-skel-dot" />
          <div className="act-feed-skel-text">
            <div className="act-feed-skel-line act-feed-skel-line--title" />
            <div className="act-feed-skel-line act-feed-skel-line--sub" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────

function FeedEmpty({ lang, t }) {
  return (
    <div className="act-feed-empty" role="status">
      <i className="fas fa-bell-slash" aria-hidden="true" />
      <h3>{t?.activity_feed_empty_title || (lang === 'ht' ? 'Pa gen aktivite toujou' : 'No activity yet')}</h3>
      <p>{t?.activity_feed_empty_hint || (lang === 'ht'
        ? 'Aktivite w yo ap parèt isit la lè w kòmanse itilize platfòm nan.'
        : 'Your activity will appear here as you use the platform.')}
      </p>
    </div>
  );
}

// ─── Single event row ───────────────────────────────────────────────────

// Profile invitations the creator can accept / reject (Phase 59).
const PROFILE_REQUEST_TYPES = [
  'profile_hire_request',
  'profile_collab_request',
  'profile_service_booking',
];

function EventRow({ event, lang, t, onMarkRead, onNavigate, onAcceptProposal, onRejectProposal, onAcceptRequest, onRejectRequest }) {
  const meta = getEventMeta(event.event_type, lang);
  const data = event.data || {};
  const actor = event.actor;
  const actorInitial = actor?.username?.charAt(0)?.toUpperCase() || '?';

  let description = '';
  if (data.job_title) description = data.job_title;
  else if (data.course_title) description = data.course_title;
  else if (data.community_name) description = data.community_name;
  else if (data.skill_name) description = `${data.skill_name} · ${data.endorser_name || ''}`;
  else if (data.event_title) description = data.event_title;
  else if (data.product_name) description = data.product_name;
  else if (data.project_title) description = data.project_title;
  else if (data.idea) description = data.idea;
  else if (data.service_name) description = data.service_name;
  else if (data.title) description = data.title;
  else if (data.follower_username) description = `@${data.follower_username}`;
  else if (data.amount && data.subscriber_username) description = `${data.subscriber_username} · $${data.amount}`;
  else if (data.subscriber_username) description = `@${data.subscriber_username}`;
  else if (data.item_name) description = `${data.business_name ? `${data.business_name} · ` : ''}${data.item_name}`;
  // Messaging events carry the visitor's subject + body preview.
  else if (data.subject && data.subject !== '(no subject)') description = data.subject;
  else if (data.body_preview) description = data.body_preview;

  const isProposal = event.event_type === 'proposal_submitted' || event.event_type === 'proposal_sent';
  const isProfileRequest = PROFILE_REQUEST_TYPES.includes(event.event_type);
  // Pending = the creator hasn't answered yet (status is '' or 'pending').
  const responded = event.status === 'accepted' || event.status === 'rejected';
  const showDecisionActions = (isProposal || isProfileRequest) && !responded;

  return (
    <div
      role="button"
      tabIndex={0}
      className={`act-feed-event${event.read ? '' : ' act-feed-event--unread'}`}
      onClick={() => {
        onMarkRead?.(event.id);
        // Pending decisions stay in place (the buttons act on the row);
        // everything else navigates like normal.
        if (!showDecisionActions) {
          const route = getEventRoute(event);
          if (route) onNavigate?.(route);
        }
      }}
      onKeyDown={(e) => {
        // Enter / Space trigger the same action as a click (a11y parity
        // for the div-as-button row).
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.currentTarget.click();
        }
      }}
    >
      <div className="act-feed-event-dot">
        <i className={`fas ${meta.icon}`} aria-hidden="true" />
      </div>
      <div className="act-feed-event-line" aria-hidden="true" />
      <div className="act-feed-event-body">
        <div className="act-feed-event-header">
          <span className="act-feed-event-type">{meta.label}</span>
          <span className="act-feed-event-time">{formatTimeAgo(event.created_at, lang)}</span>
        </div>
        {description && (
          <div className="act-feed-event-desc">{description}</div>
        )}
        {actor && (
          <div className="act-feed-event-actor">
            <div className="act-feed-event-actor-avatar">
              {actor.avatar ? (
                <img src={actor.avatar} alt="" />
              ) : (
                <span>{actorInitial}</span>
              )}
            </div>
            <span>@{actor.username}</span>
          </div>
        )}
        {(isProposal || isProfileRequest) && !responded && (
          <div className="notif-proposal-actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="notif-proposal-btn notif-proposal-btn--accept"
              onClick={(e) => {
                e.stopPropagation();
                if (isProposal) onAcceptProposal?.(event);
                else onAcceptRequest?.(event);
              }}
            >
              <i className="fas fa-check" aria-hidden="true" /> {lang === 'ht' ? 'Aksepte' : 'Accept'}
            </button>
            <button
              type="button"
              className="notif-proposal-btn notif-proposal-btn--reject"
              onClick={(e) => {
                e.stopPropagation();
                if (isProposal) onRejectProposal?.(event);
                else onRejectRequest?.(event);
              }}
            >
              <i className="fas fa-xmark" aria-hidden="true" /> {lang === 'ht' ? 'Rejte' : 'Reject'}
            </button>
          </div>
        )}
        {isProfileRequest && responded && (
          <div className={`notif-proposal-status notif-proposal-status--${event.status}`}>
            <i className={`fas ${event.status === 'accepted' ? 'fa-check-circle' : 'fa-xmark-circle'}`} aria-hidden="true" />
            {event.status === 'accepted'
              ? (lang === 'ht' ? 'Aksepte' : 'Accepted')
              : (lang === 'ht' ? 'Rejte' : 'Rejected')}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────

export function ActivityTimeline({ lang = 'ht', userId, t, onMarkRead, onMarkAllRead, onNavigate, onAcceptProposal, onRejectProposal, onAcceptRequest, onRejectRequest, refreshToken, showMarkAllRead = false }) {
  const [events, setEvents] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  // Bumped by the error-state Retry button to re-run the initial load.
  const [retryKey, setRetryKey] = useState(0);
  const sentinelRef = useRef(null);

  const markEventRead = useCallback(async (eventId) => {
    try {
      await activityFeedService.markRead(eventId);
      setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, read: true } : e)));
      onMarkRead?.(eventId);
    } catch {
      // best-effort
    }
  }, [onMarkRead]);

  const markAllRead = useCallback(async () => {
    try {
      await activityFeedService.markAllRead();
      setEvents((prev) => prev.map((e) => ({ ...e, read: true })));
      onMarkAllRead?.();
    } catch {
      // best-effort
    }
  }, [onMarkAllRead]);

  // Initial load — refreshToken bumps re-fetch the list (e.g. a new
  // real-time notification arrived while the dropdown was open).
  useEffect(() => {
    let cancelled = false;
    // Intentional synchronous reset so refreshToken changes show the
    // skeleton again — matches the fetch-effect pattern across App.jsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingInitial(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    activityFeedService.list(userId)
      .then((res) => {
        if (cancelled) return;
        setEvents(res?.data?.events || []);
        setNextCursor(res?.data?.next_cursor || null);
        setHasMore(Boolean(res?.data?.next_cursor));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || (t?.activity_feed_load_error || 'Could not load activity feed.'));
      })
      .finally(() => {
        if (!cancelled) setLoadingInitial(false);
      });
    return () => { cancelled = true; };
  }, [userId, refreshToken, retryKey]);

  // Load more (triggered by sentinel IntersectionObserver)
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    activityFeedService.list(userId, nextCursor)
      .then((res) => {
        setEvents((prev) => [...prev, ...(res?.data?.events || [])]);
        setNextCursor(res?.data?.next_cursor || null);
        setHasMore(Boolean(res?.data?.next_cursor));
      })
      .catch(() => { /* silent — don't break the existing feed on page 2 fail */ })
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, nextCursor, userId]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  // Group events by date
  const groups = React.useMemo(() => {
    const map = {};
    for (const e of events) {
      const grp = getDateGroup(e.created_at);
      if (!map[grp]) map[grp] = [];
      map[grp].push(e);
    }
    return map;
  }, [events]);

  const groupOrder = ['today', 'yesterday', 'week', 'earlier'];

  if (loadingInitial) {
    return <FeedSkeleton />;
  }

  if (error && events.length === 0) {
    return (
      <div className="act-feed-empty" role="status">
        <i className="fas fa-circle-exclamation" aria-hidden="true" />
        <h3>{t?.activity_feed_load_error || (lang === 'ht' ? 'Pa kapab chaje aktivite' : 'Could not load activity')}</h3>
        <p>{error}</p>
        <button
          type="button"
          className="notif-page-mark-all"
          onClick={() => setRetryKey((k) => k + 1)}
        >
          <i className="fas fa-rotate-right" aria-hidden="true" /> {lang === 'ht' ? 'Eseye ankò' : 'Retry'}
        </button>
      </div>
    );
  }

  if (!loadingInitial && events.length === 0) {
    return <FeedEmpty lang={lang} t={t} />;
  }

  const unreadCount = events.filter((e) => !e.read).length;

  return (
    <div className="act-feed">
      {/* Phase 58 — Mark-all-read toolbar (opt-in via showMarkAllRead,
          used by the full-screen NotificationsPage). Hidden while the
          user has nothing unread so the header stays uncluttered. */}
      {showMarkAllRead && unreadCount > 0 && (
        <div className="notif-page-toolbar">
          <span className="notif-page-unread-count">
            <i className="fas fa-circle" aria-hidden="true" style={{ fontSize: 8, color: 'var(--color-primary, #d81b60)', marginRight: 6 }} />
            {unreadCount} {lang === 'ht' ? 'nouvo' : 'new'}
          </span>
          <button
            type="button"
            className="notif-page-mark-all"
            onClick={markAllRead}
          >
            <i className="fas fa-check-double" aria-hidden="true" /> {lang === 'ht' ? 'Make tout li li' : 'Mark all read'}
          </button>
        </div>
      )}
      {groupOrder.map((grp) => {
        const items = groups[grp];
        if (!items || items.length === 0) return null;
        const dateLabel = DATE_LABELS[grp];
        return (
          <div key={grp} className="act-feed-group">
            <div className="act-feed-group-label">
              {lang === 'ht' ? dateLabel.ht : dateLabel.en}
            </div>
            {items.map((e) => (
              <EventRow key={e.id} event={e} lang={lang} t={t} onMarkRead={markEventRead} onNavigate={onNavigate} onAcceptProposal={onAcceptProposal} onRejectProposal={onRejectProposal} onAcceptRequest={onAcceptRequest} onRejectRequest={onRejectRequest} />
            ))}
          </div>
        );
      })}

      {/* Sentinel for infinite scroll */}
      {hasMore && (
        <div ref={sentinelRef} className="act-feed-sentinel" aria-hidden="true">
          {loadingMore && (
            <div className="act-feed-loading-more">
              <i className="fas fa-spinner fa-spin" />
              <span>{t?.activity_feed_loading_more || (lang === 'ht' ? 'Ap chaje...' : 'Loading...')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ActivityTimeline;
