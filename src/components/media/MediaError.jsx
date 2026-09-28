/**
 * MediaError — Kompozan erè medya ak eksplikasyon detaye.
 *
 * Toujou eksplike:
 *   - Ki sa ki rive
 *   - Poukisa li rive
 *   - Ki jan pou rezoud li
 *   - Ki sa itilizatè a dwe fè apre
 *
 * Toujou gen Retry button.
 */
import React from 'react';

// ─── Error config ─────────────────────────────────────────────────────

const ERROR_CONFIG = {
  not_found: {
    icon: 'fa-search',
    titleEn: 'Media not found',
    titleHt: 'Medya pa jwenn',
    whyEn: 'The media you are looking for does not exist or has been removed.',
    whyHt: 'Medya w ap chèche a pa egziste oswa li te retire.',
    fixEn: 'Check that the URL is correct and the file still exists on the provider.',
    fixHt: 'Verifye ke URL la kòrèk epi fichye a toujou egziste sou provider la.',
    whatNextEn: 'You can try a different URL or reconnect your provider.',
    whatNextHt: 'Ou ka eseye yon lòt URL oswa rekonekte provider ou.',
  },
  access_denied: {
    icon: 'fa-lock',
    titleEn: 'Access denied',
    titleHt: 'Aksè refize',
    whyEn: 'You do not have permission to view this media. It may be private or restricted.',
    whyHt: 'Ou pa gen pèmisyon pou wè medya sa a. Li ka prive oswa restrikte.',
    fixEn: 'Contact the media owner or request access if available.',
    fixHt: 'Kontakte pwopriyetè medya a oswa mande aksè si disponib.',
    whatNextEn: 'You can try logging in with a different account.',
    whatNextHt: 'Ou ka eseye konekte ak yon lòt kont.',
  },
  broken: {
    icon: 'fa-unlink',
    titleEn: 'Media is broken',
    titleHt: 'Medya kase',
    whyEn: 'The URL is not accessible. The file may have been moved, deleted, or the provider may be down.',
    whyHt: 'URL la pa aksesib. Fichye a ka te deplase, efase, oswa provider la ka anba.',
    fixEn: 'Upload the file again and get a new URL. Then replace the old URL.',
    fixHt: 'Mete fichye a ankò epi jwenn yon nouvo URL. Apre sa, ranplase ansyen URL la.',
    whatNextEn: 'Click "Replace URL" to update with a working link.',
    whatNextHt: 'Klike "Ranplase URL" pou mete ajou ak yon lyen ki mache.',
  },
  timeout: {
    icon: 'fa-hourglass-end',
    titleEn: 'Connection timeout',
    titleHt: 'Tan ekspire',
    whyEn: 'The server did not respond in time. This could be a temporary network issue.',
    whyHt: 'Sèvè a pa reponn alè. Sa ka yon pwoblèm rezo tanporè.',
    fixEn: 'Wait a moment and try again. If the issue persists, check the provider status.',
    fixHt: 'Tann yon moman epi eseye ankò. Si pwoblèm nan pèsiste, tcheke estati provider la.',
    whatNextEn: 'Click Retry below to try loading again.',
    whatNextHt: 'Klike Retry anba a pou eseye chaje ankò.',
  },
  invalid_url: {
    icon: 'fa-exclamation-circle',
    titleEn: 'Invalid URL',
    titleHt: 'URL pa valid',
    whyEn: 'The URL format is not correct. Please use a full URL starting with https://',
    whyHt: 'Fòma URL la pa kòrèk. Tanpri itilize yon URL konplè ki kòmanse ak https://',
    fixEn: 'Make sure you copied the entire URL including https://',
    fixHt: 'Asire w ou kopi tout URL la ki gen ladan https://',
    whatNextEn: 'Copy the correct URL from your provider and paste it again.',
    whatNextHt: 'Kopi URL kòrèk la nan provider ou epi kole l ankò.',
  },
  unsupported_type: {
    icon: 'fa-file-alt',
    titleEn: 'Unsupported media type',
    titleHt: 'Kalite medya pa sipòte',
    whyEn: 'This file type is not supported. Accepted types: images, videos, audio, PDF, documents.',
    whyHt: 'Kalite fichye sa a pa sipòte. Kalite aksepte: imaj, videyo, odyo, PDF, dokiman.',
    fixEn: 'Convert the file to a supported format (JPEG, PNG, MP4, MP3, PDF).',
    fixHt: 'Konvèti fichye a nan yon fòma sipòte (JPEG, PNG, MP4, MP3, PDF).',
    whatNextEn: 'Upload the file in the correct format and try again.',
    whatNextHt: 'Mete fichye a nan bon fòma epi eseye ankò.',
  },
  rate_limited: {
    icon: 'fa-tachometer-alt',
    titleEn: 'Too many requests',
    titleHt: 'Twòp demann',
    whyEn: 'You have made too many validation requests in a short time. Please wait.',
    whyHt: 'Ou fè twòp demann validasyon nan yon ti tan. Tanpri tann.',
    fixEn: 'Wait a minute before trying again.',
    fixHt: 'Tann yon minit anvan ou eseye ankò.',
    whatNextEn: 'You can try again after a short wait.',
    whatNextHt: 'Ou ka eseye ankò apre yon ti tann.',
  },
  provider_down: {
    icon: 'fa-cloud',
    titleEn: 'Provider unavailable',
    titleHt: 'Provider pa disponib',
    whyEn: 'The media provider (ImgBB, YouTube, etc.) is currently down or unreachable.',
    whyHt: 'Provider medya a (ImgBB, YouTube, eltr.) pa disponib kounye a oswa pa aksesib.',
    fixEn: 'Check the provider\'s status page. This is usually temporary.',
    fixHt: 'Tcheke paj estati provider la. Anjeneral sa se tanporè.',
    whatNextEn: 'Wait a few minutes and try again. Choose a different provider if the issue persists.',
    whatNextHt: 'Tann kèk minit epi eseye ankò. Chwazi yon lòt provider si pwoblèm nan pèsiste.',
  },
  generic: {
    icon: 'fa-exclamation-triangle',
    titleEn: 'Something went wrong',
    titleHt: 'Yon bagay pa mache',
    whyEn: 'An unexpected error occurred while loading this media.',
    whyHt: 'Yon erè inatandi te rive pandan y ap chaje medya sa a.',
    fixEn: 'Try refreshing the page or checking your internet connection.',
    fixHt: 'Eseye rafrechi paj la oswa tcheke koneksyon entènèt ou.',
    whatNextEn: 'If the problem continues, contact support.',
    whatNextHt: 'Si pwoblèm nan kontinye, kontakte sipò.',
  },
};

function resolveErrorConfig(errorKey, statusCode, errorMessage) {
  if (errorKey && ERROR_CONFIG[errorKey]) return ERROR_CONFIG[errorKey];
  if (statusCode === 403 || statusCode === 401) return ERROR_CONFIG.access_denied;
  if (statusCode === 404) return ERROR_CONFIG.not_found;
  if (statusCode === 410) return ERROR_CONFIG.broken;
  if (statusCode === 429) return ERROR_CONFIG.rate_limited;
  if (statusCode === 503) return ERROR_CONFIG.provider_down;
  if (errorMessage && errorMessage.includes('timeout')) return ERROR_CONFIG.timeout;
  if (errorMessage && errorMessage.includes('invalid')) return ERROR_CONFIG.invalid_url;
  return ERROR_CONFIG.generic;
}

export default function MediaError({
  errorKey,
  statusCode,
  message,
  onRetry,
  lang = 'ht',
  variant = 'inline',
  className = '',
}) {
  const isHt = lang === 'ht';
  const config = resolveErrorConfig(errorKey, statusCode, message);

  const title = isHt ? config.titleHt : config.titleEn;
  const why = isHt ? config.whyHt : config.whyEn;
  const fix = isHt ? config.fixHt : config.fixEn;
  const whatNext = isHt ? config.whatNextHt : config.whatNextEn;

  if (variant === 'inline') {
    return (
      <div className={`media-error media-error-inline ${className}`} role="alert">
        <div className="media-error-inline-icon">
          <i className={`fas ${config.icon}`} aria-hidden="true" />
        </div>
        <div className="media-error-inline-body">
          <strong className="media-error-inline-title">{title}</strong>
          {message && <p className="media-error-inline-msg">{message}</p>}
          {onRetry && (
            <button type="button" className="media-error-retry" onClick={onRetry}>
              <i className="fas fa-redo" aria-hidden="true" />
              {isHt ? 'Eseye ankò' : 'Retry'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`media-error media-error-full ${className}`} role="alert">
      <div className="media-error-icon">
        <i className={`fas ${config.icon}`} aria-hidden="true" />
      </div>
      <h3 className="media-error-title">{title}</h3>
      {message && <p className="media-error-message">{message}</p>}

      <div className="media-error-details">
        <div className="media-error-detail">
          <span className="media-error-detail-label">
            <i className="fas fa-question-circle" aria-hidden="true" />
            {isHt ? 'Kisa ki rive?' : 'What happened?'}
          </span>
          <p className="media-error-detail-text">{why}</p>
        </div>
        <div className="media-error-detail">
          <span className="media-error-detail-label">
            <i className="fas fa-wrench" aria-hidden="true" />
            {isHt ? 'Kijan pou rezoud?' : 'How to fix it?'}
          </span>
          <p className="media-error-detail-text">{fix}</p>
        </div>
        <div className="media-error-detail">
          <span className="media-error-detail-label">
            <i className="fas fa-arrow-right" aria-hidden="true" />
            {isHt ? 'Kisa pou w fè apre?' : 'What to do next?'}
          </span>
          <p className="media-error-detail-text">{whatNext}</p>
        </div>
      </div>

      {onRetry && (
        <button type="button" className="btn-primary media-error-retry-btn" onClick={onRetry}>
          <i className="fas fa-redo" aria-hidden="true" />
          {isHt ? 'Eseye ankò' : 'Retry'}
        </button>
      )}
    </div>
  );
}
