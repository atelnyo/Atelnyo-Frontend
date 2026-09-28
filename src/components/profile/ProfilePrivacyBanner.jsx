import React from 'react';

/**
 * PrivacyBanner — owner-only toggle for Picks visibility.
 * VERBATIM extraction from CreatorPublicProfile.jsx (post-A-2) for Stage A-3.5.
 * Uses csp-privacy class, with bilingual Kreyol copy.
 *
 * @param {{ isPublic: boolean, lang: string, onToggle: ()=>void, isUpdating: boolean }} props
 */
export default function PrivacyBanner({ isPublic, lang, onToggle, isUpdating }) {
  return (
    <div className={`csp-privacy ${isPublic ? 'csp-privacy--public' : 'csp-privacy--private'}`} role="status">
      <span className="csp-privacy-icon">
        <i className={`fas ${isPublic ? 'fa-globe' : 'fa-lock'}`} aria-hidden="true" />
      </span>
      <span className="csp-privacy-text">
        {lang === 'ht'
          ? (isPublic ? 'Picks ou yo vizib piblik.' : 'Picks ou yo kache — sèlman ou wè yo.')
          : (isPublic ? 'Your Picks are public.' : 'Your Picks are private — only you see them.')}
      </span>
      <button
        type="button"
        className="csp-privacy-btn"
        onClick={onToggle}
        disabled={isUpdating}
        aria-busy={isUpdating}
      >
        {isUpdating
          ? <i className="fas fa-spinner fa-spin" aria-hidden="true" />
          : <i className={`fas ${isPublic ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true" />}{' '}
        {lang === 'ht' ? (isPublic ? 'Kache' : 'Montre') : (isPublic ? 'Hide' : 'Show')}
      </button>
    </div>
  );
}
