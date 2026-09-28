import React, { useState, useEffect } from 'react';
import { fmtCount, fmtDate } from './profileUtils';

/**
 * PremiumHero — cinematic cover + ringed avatar + identity bar.
 * VERBATIM extraction from CreatorPublicProfile.jsx (post-A-2) for Stage A-3.5.
 * Includes all 5 badges (verified/premium/featured/level/category), meta row with country/languages/joined/trust_score.
 *
 * @param {{ profile: any, lang: string }} props
 */
export default function PremiumHero({ profile, lang, followersCount }) {
  const [coverError, setCoverError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  // Reset avatarError lè avatar_url chanje (pou nouvo imaj ka reload)
  // Reset coverError lè cover_url chanje tou
  useEffect(() => setAvatarError(false), [profile.avatar_url]);
  useEffect(() => setCoverError(false), [profile.cover_url]);
  const hasCover = profile.cover_url?.trim() && !coverError;
  const avatarInitial = profile.avatar_initial
    || profile.display_name?.[0]?.toUpperCase()
    || profile.username?.[0]?.toUpperCase()
    || 'C';

  return (
    <section className="csp-hero" aria-label="Creator hero">
      {hasCover ? (
        <img
          className="csp-hero-cover"
          src={profile.cover_url}
          alt=""
          loading="eager"
          onError={() => setCoverError(true)}
        />
      ) : (
        <div className="csp-hero-cover-fallback" aria-hidden="true">
          <i className="fas fa-camera" />
        </div>
      )}
      <div className="csp-hero-overlay" aria-hidden="true" />

      <div className="csp-identity-bar">
        <div className="csp-avatar-ring">
          <div className="csp-avatar-inner">
            {profile.avatar_url && !avatarError ? (
              <img
                className="csp-avatar-img"
                src={profile.avatar_url}
                alt={profile.display_name || profile.username}
                loading="eager"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <span className="csp-avatar-initial" aria-hidden="true">
                {avatarInitial}
              </span>
            )}
          </div>
        </div>

        <div className="csp-identity-info">
          <div className="csp-identity-name-row">
            <h1 className="csp-identity-name">
              {profile.display_name || `@${profile.username}`}
            </h1>
            {/* Atelnyo verified seal — prestige medal: a bold white check
                (√) wrapped in a gold laurel wreath, on a blue-gradient
                disc. Reads as a certified/credentialed status, unique to
                Atelnyo (gold = the rose-center identity colour). */}
            {profile.is_verified && (
              <span className="csp-verified-seal"
                title={lang === 'ht' ? 'Creator verifye' : 'Verified creator'}
                aria-label={lang === 'ht' ? 'Creator verifye' : 'Verified creator'}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <defs>
                    {/* Frosted-glass disc — translucent emerald so the cover
                        shows through softly (iOS/Apple glass look). */}
                    <linearGradient id="csp-glass-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(52,211,153,0.92)" />
                      <stop offset="48%" stopColor="rgba(16,185,129,0.78)" />
                      <stop offset="100%" stopColor="rgba(6,95,70,0.94)" />
                    </linearGradient>
                    {/* Top-left light sheen for the glass reflection. */}
                    <linearGradient id="csp-glass-shine" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </linearGradient>
                  </defs>
                  {/* Glass disc + crisp edge highlight */}
                  <circle cx="12" cy="12" r="11.4" fill="url(#csp-glass-grad)" />
                  <circle cx="12" cy="12" r="11.1" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.6" />
                  {/* Curved light reflection across the top half */}
                  <path d="M2.9 9.4 A 10.2 10.2 0 0 1 12 2.4 A 10.2 10.2 0 0 1 21.1 9.4"
                    fill="none" stroke="url(#csp-glass-shine)" strokeWidth="2.6"
                    strokeLinecap="round" opacity="0.85" />
                  {/* Small specular glint bottom-right */}
                  <circle cx="16.4" cy="16.2" r="1.5" fill="rgba(255,255,255,0.35)" />
                  {/* Thin gold identity ring (Atelnyo rose-center gold) */}
                  <circle cx="12" cy="12" r="8.9" fill="none" stroke="#ffd54f" strokeWidth="0.9" opacity="0.9" />
                  {/* Floating white check (√) with a soft dark underlay */}
                  <path d="M7.6 12.5 L10.9 15.8 L16.6 8.6" fill="none"
                    stroke="rgba(0,0,0,0.18)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M7.6 12.5 L10.9 15.8 L16.6 8.6" fill="none"
                    stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
          </div>
          <div className="csp-identity-username">@{profile.username}</div>

          {/* Follower count — right under the handle, Instagram-style,
              where visitors look for social proof. */}
          {followersCount != null && (
            <div className="csp-identity-followers">
              <i className="fas fa-users" aria-hidden="true" />
              <strong>{fmtCount(followersCount)}</strong>
              <span>{lang === 'ht' ? 'abonnés' : 'followers'}</span>
            </div>
          )}

          {/* Badges — the verified seal lives next to the name above
              (Facebook-style); this row holds the remaining statuses. */}
          <div className="csp-badges">
            {profile.is_premium && (
              <span className="csp-badge csp-badge--premium">
                <i className="fas fa-crown" aria-hidden="true" /> Premium
              </span>
            )}
            {profile.is_featured && (
              <span className="csp-badge csp-badge--featured">
                <i className="fas fa-star" aria-hidden="true" /> Featured
              </span>
            )}
            {profile.is_partner && (
              <span className="csp-badge csp-badge--partner">
                <i className="fas fa-handshake" aria-hidden="true" /> Partner
              </span>
            )}
            {profile.is_enterprise && (
              <span className="csp-badge csp-badge--enterprise">
                <i className="fas fa-building" aria-hidden="true" /> Enterprise
              </span>
            )}
            {/* Level badge. The CreatorLevel with key='verified' is skipped:
                it duplicates the is_verified badge above (it has zero
                thresholds, so every creator would show a second "Verified"
                chip even when not actually verified). Real levels
                (professional/expert/master/…) still render. */}
            {profile.level && profile.level.key !== 'verified' && (
              <span className="csp-badge csp-badge--level" style={profile.level.color ? { background: profile.level.color } : undefined}>
                <i className={`fas ${profile.level.icon || 'fa-trophy'}`} aria-hidden="true" /> {profile.level.label || profile.level.key}
              </span>
            )}
            {(profile.badges || []).slice(0, 4).map((badge) => (
              <span key={badge.key} className="csp-badge csp-badge--custom" style={badge.color ? { background: badge.color } : undefined} title={badge.description}>
                <i className={`fas ${badge.icon || 'fa-certificate'}`} aria-hidden="true" /> {badge.label}
              </span>
            ))}
          </div>

          {/* Meta row */}
          <div className="csp-identity-meta">
            {profile.country && (
              <span className="csp-identity-meta-item">
                <i className="fas fa-map-marker-alt" aria-hidden="true" />
                {profile.city ? `${profile.city}, ` : ''}{profile.country}
              </span>
            )}
            {profile.languages?.length > 0 && (
              <span className="csp-identity-meta-item">
                <i className="fas fa-language" aria-hidden="true" />
                {profile.languages.join(' · ')}
              </span>
            )}
            {profile.created_at && (
              <span className="csp-identity-meta-item">
                <i className="fas fa-calendar" aria-hidden="true" />
                {lang === 'ht' ? 'Depi' : 'Since'} {fmtDate(profile.created_at, lang)}
              </span>
            )}
            {profile.trust_score != null && (
              <span className="csp-identity-meta-item">
                <i className="fas fa-shield-alt" aria-hidden="true" />
                Score: {profile.trust_score}/100
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
