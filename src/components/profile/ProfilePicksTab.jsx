/**
 * src/components/profile/ProfilePicksTab.jsx
 *
 * Tier-2 stem — extracted from CreatorPublicProfile.jsx (stage A-2 refactor).
 *
 * Render the creator's saved Talents + Music picks (the bookmark shelf).
 * Auto-hides when both are empty; shows skeleton during loading.
 *
 * STAGE A-2: zero behavior change. Verbatim copy from monolith.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SkeletonSection } from './ProfileSkeleton';
import ProfileCardImage from './ProfileCardImage';

export default function PicksTab({ picks, loading, lang, onItemClick }) {
  if (loading) return <SkeletonSection />;
  const hasTalents = (picks?.talents?.length || 0) > 0;
  const hasMusic = (picks?.music?.length || 0) > 0;
  if (!hasTalents && !hasMusic) {
    return (
      <div className="csp-empty">
        <i className="fas fa-bookmark" aria-hidden="true" />
        <p>{lang === 'ht' ? "Kreyatè sa a poko sove anyen." : "This creator hasn't saved any picks yet."}</p>
      </div>
    );
  }
  return (
    <div>
      {hasTalents && (
        <div className="csp-card-m3" style={{ marginBottom: 16 }}>
          <div className="csp-card-m3-header">
            <span className="csp-card-m3-icon"><i className="fas fa-star" /></span>
            <span className="csp-card-m3-title">{lang === 'ht' ? 'Talan' : 'Talents'}</span>
          </div>
          <div className="csp-picks-grid">
            {picks.talents.map((row) => {
              const t = row.talent || {};
              return (
                <div key={row.id} className="csp-picks-card" role="button" tabIndex={0}
                  onClick={() => onItemClick('talent', row.id, t)}
                  onKeyDown={(e) => e.key === 'Enter' && onItemClick('talent', row.id, t)}>
                  <div className="csp-picks-card-cover">
                    <ProfileCardImage src={t.avatar_url} alt={t.name || ''} icon="fa-user"
                      imgClassName="" tileClassName="csp-picks-card-cover-fallback"
                      fallback={<span>{(t.name || '?').charAt(0).toUpperCase()}</span>} />
                  </div>
                  <div className="csp-picks-card-body">
                    <div className="csp-picks-card-title">{t.name}</div>
                    {t.role && <div className="csp-picks-card-sub">{t.role}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {hasMusic && (
        <div className="csp-card-m3">
          <div className="csp-card-m3-header">
            <span className="csp-card-m3-icon"><i className="fas fa-music" /></span>
            <span className="csp-card-m3-title">Music</span>
          </div>
          <div className="csp-picks-grid">
            {picks.music.map((row) => {
              const m = row.music || {};
              return (
                <div key={row.id} className="csp-picks-card" role="button" tabIndex={0}
                  onClick={() => onItemClick('music', row.id, m)}
                  onKeyDown={(e) => e.key === 'Enter' && onItemClick('music', row.id, m)}>
                  <div className="csp-picks-card-cover">
                    <ProfileCardImage src={m.cover_url} alt={m.title || ''} icon="fa-music"
                      imgClassName="" tileClassName="csp-picks-card-cover-fallback"
                      fallback={<i className="fas fa-music" />} />
                  </div>
                  <div className="csp-picks-card-body">
                    <div className="csp-picks-card-title">{m.title}</div>
                    {m.artist && <div className="csp-picks-card-sub">{m.artist}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
