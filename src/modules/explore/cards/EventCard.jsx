/**
 * src/modules/explore/cards/EventCard.jsx
 *
 * Event card with RSVP/Buy ticket — extracted from Explore.jsx
 */
import React, { useState } from 'react';
import { eventsService } from '../../../services/api';
import { formatEventDate } from '../utils/cardHelpers';
import { useHoverVideoPreview } from '../hooks/useHoverVideoPreview';
import HoverVideoPreview from '../components/HoverVideoPreview';
import SaveCountChip from './SaveCountChip';
import TrendingVelocity from './TrendingVelocity';

/** SVG fallback — calendar-themed gradient, shown when an event has no
    cover (but a trailer that needs an image area to preview over). */
function EventFallback({ title, isHt }) {
  return (
    <div className="explore-card-fallback">
      <svg viewBox="0 0 600 340" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="ev-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#059669" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <rect width="600" height="340" fill="url(#ev-grad)" />
        <g transform="translate(300,150)" opacity="0.2">
          {/* Calendar */}
          <rect x="-55" y="-40" width="110" height="88" rx="10" fill="none" stroke="#059669" strokeWidth="5" />
          <path d="M-55 -10 L55 -10" stroke="#059669" strokeWidth="5" />
          <path d="M-30 -55 L-30 -25 M30 -55 L30 -25" stroke="#059669" strokeWidth="5" strokeLinecap="round" />
          <rect x="-30" y="8" width="22" height="12" rx="3" fill="#f59e0b" opacity="0.7" />
          <rect x="0" y="28" width="30" height="12" rx="3" fill="#059669" opacity="0.6" />
        </g>
        <text x="300" y="270" textAnchor="middle" fill="#059669" opacity="0.5"
              fontFamily="system-ui, -apple-system, sans-serif" fontSize="14" fontWeight="600">
          {title || (isHt ? 'Evènman' : 'Event')}
        </text>
      </svg>
    </div>
  );
}

export default function EventCard({ event, t, lang = 'ht', onOpenCheckout, showToast, user, onRSVPSuccess, saveCount = null }) {
  const [rsvping, setRsvping] = useState(false);
  const [rsvped, setRsvped] = useState(event?.has_ticket || false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const isFree = event.is_free || Number(event.price) <= 0;
  const price = Number(event.price || 0);

  // Event trailer — muted hover preview over the cover, same shared
  // hook/overlay as the music + course cards. The image area only
  // renders when there is a cover OR a trailer to show.
  const cover = event.cover_url || '';
  const trailer = event.trailer_url || '';
  const hasCover = Boolean(cover);
  const hasTrailer = Boolean(trailer);
  const { videoSrc, showPreview, bind } = useHoverVideoPreview({ url: trailer });

  async function handleRSVP(e) {
    e.stopPropagation();
    if (!user) {
      showToast?.(t.mwen_signin_required || 'Sign in to RSVP', 'user-lock');
      return;
    }
    if (rsvping || rsvped) return;
    setRsvping(true);
    try {
      await eventsService.ticket(event.id, 1);
      setRsvped(true);
      showToast?.(t.explore_event_rsvped || 'RSVP confirmed!', 'check-circle');
      onRSVPSuccess?.(event.id);
    } catch (err) {
      showToast?.(err?.response?.data?.detail || t.explore_event_rsvp_error || 'Could not RSVP', 'circle-exclamation');
    } finally {
      setRsvping(false);
    }
  }

  async function handleBuyTicket(e) {
    e.stopPropagation();
    if (!user) {
      showToast?.(t.mwen_signin_required || 'Sign in to buy tickets', 'user-lock');
      return;
    }
    if (rsvping || rsvped) return;
    // Paid tickets route through the unified CheckoutModal (PayPal PRIMARY
    // / Stripe SECONDARY). The backend rejects paid tickets via the direct
    // RSVP endpoint (402 Payment required) — the checkout creates a RESERVED
    // ticket that the payment capture/webhook confirms.
    if (onOpenCheckout) {
      onOpenCheckout('event', price, { event_id: event.id, title: event.title });
      return;
    }
    // Fallback (component without checkout wiring): try the direct endpoint.
    setRsvping(true);
    try {
      await eventsService.ticket(event.id, 1);
      setRsvped(true);
      showToast?.(t.explore_event_rsvped || 'Ticket purchased!', 'check-circle');
      onRSVPSuccess?.(event.id);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.status === 402
        ? (t.explore_event_rsvp_error || 'Payment required')
        : (t.explore_event_rsvp_error || 'Could not purchase ticket. Try again.');
      showToast?.(msg, 'circle-exclamation');
    } finally {
      setRsvping(false);
    }
  }

  const isPastEvent = event.is_past;
  const isFull = event.max_attendees && event.attendee_count >= event.max_attendees;

  return (
    <div
      className="explore-card explore-card-event"
      role="button"
      tabIndex={0}
      onClick={() => window.open(`/sheet/community/${event.community_slug || ''}`, '_self')}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); } }}
      onMouseEnter={bind.onMouseEnter}
      onMouseLeave={bind.onMouseLeave}
      data-testid="event-card"
      data-event-id={event.id}
    >
      {(hasCover || hasTrailer) && (
        <div className="explore-card-image-wrap explore-card-image-square">
          {hasCover && !imgFailed ? (
            <img
              className={`explore-card-image ${imgLoaded ? 'explore-card-image--loaded' : ''}`}
              src={cover}
              alt={event.title}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgFailed(true)}
            />
          ) : (
            <EventFallback title={event.title} isHt={lang === 'ht'} />
          )}
          {showPreview && (
            <HoverVideoPreview videoSrc={videoSrc} title={event.title} />
          )}
          {/* Trending Velocity — shows how fast this event is gaining traction */}
          {Number(event?._score?.trending) > 10 && (
            <TrendingVelocity
              score={event._score.trending}
              lang={lang}
              size="sm"
            />
          )}
          {hasTrailer && (
            <div
              className="explore-card-video-badge"
              aria-label={t.explore_event_trailer || 'Trailer'}
              title={t.explore_event_trailer || 'Trailer'}
            >
              <i className="fas fa-video" aria-hidden="true" />
            </div>
          )}
        </div>
      )}
      <div className="explore-event-layout">
        <div className="explore-event-date">
          <span className="explore-event-date-day">
            {event.start_time ? new Date(event.start_time).getDate() : '?'}
          </span>
          <span className="explore-event-date-month">
            {event.start_time
              ? new Date(event.start_time).toLocaleDateString(undefined, { month: 'short' })
              : ''}
          </span>
        </div>
        <div className="explore-event-info">
          <div className="explore-event-title explore-card-title">{event.title}</div>
          <div className="explore-event-meta">
            <span><i className="fas fa-clock" aria-hidden="true" /> {formatEventDate(event.start_time)}</span>
            {event.location && <span className="explore-event-meta-sep">·</span>}
            {event.location && (
              <span><i className="fas fa-map-marker-alt" aria-hidden="true" /> {event.location}</span>
            )}
            {event.is_online && (
              <>
                <span className="explore-event-meta-sep">·</span>
                <span className="explore-event-online">
                  <i className="fas fa-video" aria-hidden="true" /> {t.explore_event_online || 'Online'}
                </span>
              </>
            )}
          </div>
          <div className="explore-event-community">
            <i className="fas fa-users" aria-hidden="true" /> {event.community_name || ''}
          </div>
          <SaveCountChip count={saveCount} t={t} />
        </div>
        <div className="explore-event-action">
          {isFull ? (
            <span className="explore-event-full-pill">{t.explore_event_full || 'Full'}</span>
          ) : isPastEvent ? (
            <span className="explore-event-past-pill">{t.explore_event_past || 'Ended'}</span>
          ) : rsvped ? (
            <span className="explore-event-rsvped-pill">
              <i className="fas fa-check-circle" /> {t.explore_event_rsvped_short || 'Going'}
            </span>
          ) : isFree ? (
            <button
              type="button"
              className="explore-event-rsvp-btn"
              onClick={handleRSVP}
              disabled={rsvping}
              aria-label={t.explore_event_rsvp || 'RSVP'}
            >
              {rsvping
                ? <i className="fas fa-spinner fa-spin" />
                : <><i className="fas fa-check" /> {t.explore_event_rsvp || 'RSVP'}</>}
            </button>
          ) : (
            <button
              type="button"
              className="explore-event-buy-btn"
              onClick={handleBuyTicket}
              aria-label={t.explore_event_buy_ticket || 'Buy Ticket'}
            >
              <i className="fas fa-ticket-alt" /> ${price.toFixed(2)}
            </button>
          )}
          {!isFree && !isPastEvent && !isFull && !rsvped && (
            <div className="explore-event-attendees">
              <i className="fas fa-user" aria-hidden="true" /> {event.attendee_count || 0}
              {event.max_attendees ? ` / ${event.max_attendees}` : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
