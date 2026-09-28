/**
 * src/components/profile/ProfileEmpty.jsx
 *
 * Tier-1 leaf — extracted from CreatorPublicProfile.jsx (stage A-1 refactor).
 *
 * Two modes:
 *   mode='not_found' (default) — the profile really is missing / hidden /
 *       suspended: "Creator not found".
 *   mode='load_error' — the fetch failed for a transient reason (network,
 *       server hiccup, expired-token refresh) so the creator MAY still
 *       exist: "We could not load this page" + a Retry button.
 *
 * Historically both cases rendered the same "This profile does not exist"
 * screen, so a flaky connection made real creators look deleted.
 */

import React from 'react';

export default function NotFoundState({ lang, onBack, onRetry, onCreateProfile, mode = 'not_found' }) {
  if (mode === 'load_error') {
    return (
      <div className="csp-not-found" data-mode="load_error">
        <i className="fas fa-wifi" aria-hidden="true" />
        <h2>{lang === 'ht' ? 'Nou pa ka chaje paj sa a' : 'We could not load this page'}</h2>
        <p>
          {lang === 'ht'
            ? 'Gen yon pwoblèm ak koneksyon an oswa sèvè a. Eseye ankò — kreyatè a ka toujou egziste.'
            : 'Something went wrong loading this profile. Try again — the creator may still exist.'}
        </p>
        <div className="csp-not-found-actions">
          {onRetry && (
            <button type="button" className="csp-btn csp-btn--primary" onClick={onRetry} data-testid="profile-load-retry">
              <i className="fas fa-rotate-right" aria-hidden="true" /> {lang === 'ht' ? 'Eseye ankò' : 'Retry'}
            </button>
          )}
          {onCreateProfile && (
            <button type="button" className="csp-btn csp-btn--primary" onClick={onCreateProfile} data-testid="profile-create">
              <i className="fas fa-plus-circle" aria-hidden="true" /> {lang === 'ht' ? 'Kreye Pwofil Piblik' : 'Create Public Profile'}
            </button>
          )}
          <button type="button" className="csp-btn" onClick={onBack}>
            <i className="fas fa-arrow-left" aria-hidden="true" /> {lang === 'ht' ? 'Retounen' : 'Go Back'}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="csp-not-found" data-mode="not_found">
      <i className="fas fa-user-slash" aria-hidden="true" />
      <h2>{lang === 'ht' ? 'Kreyatè pa jwenn' : 'Creator not found'}</h2>
      <p>{lang === 'ht' ? 'Pwofil sa a pa egziste.' : 'This profile does not exist.'}</p>
      <div className="csp-not-found-actions">
        {onCreateProfile && (
          <button type="button" className="csp-btn csp-btn--primary" onClick={onCreateProfile} data-testid="profile-create">
            <i className="fas fa-plus-circle" aria-hidden="true" /> {lang === 'ht' ? 'Kreye Pwofil Piblik' : 'Create Public Profile'}
          </button>
        )}
        <button type="button" className="csp-btn" onClick={onBack}>
          <i className="fas fa-arrow-left" aria-hidden="true" /> {lang === 'ht' ? 'Retounen' : 'Go Back'}
        </button>
      </div>
    </div>
  );
}
