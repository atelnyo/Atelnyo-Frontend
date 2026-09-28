/**
 * src/components/studio/sections/LevelsBadgesSection.jsx
 *
 * Levels + Badges section for Creator Studio.
 */
import React, { useEffect, useState } from 'react';
import {
  creatorLevelsApi,
  creatorBadgesApi,
  creatorUserBadgesApi,
} from '../../../services/creatorService';

const s = {
  section: {
    background: 'transparent',
    padding: '1.5rem',
  },
  title: {
    fontSize: '1.1rem',
    fontWeight: 700,
    marginBottom: '1rem',
    color: 'var(--text-main, #1a1a1a)',
  },
  levelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    borderRadius: '12px',
    background: 'var(--card-bg, #fff)',
    border: '1px solid var(--border-color, #e0e0e0)',
    marginBottom: '8px',
  },
  levelIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--pink-light, #fce4ec)',
    color: 'var(--pink-primary, #d81b60)',
    fontSize: '1rem',
  },
  levelLabel: {
    fontWeight: 700,
    fontSize: '0.95rem',
  },
  levelDesc: {
    fontSize: '0.78rem',
    color: 'var(--text-secondary, #666)',
  },
  badgeGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginTop: '10px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '20px',
    background: 'var(--card-bg, #fff)',
    border: '1px solid var(--border-color, #e0e0e0)',
    fontSize: '0.82rem',
    fontWeight: 600,
  },
  badgeIcon: {
    fontSize: '0.9rem',
  },
  empty: {
    color: 'var(--text-secondary, #666)',
    fontSize: '0.85rem',
  },
};

export default function LevelsBadgesSection({ user, lang = 'en', t }) {
  const [levels, setLevels] = useState([]);
  const [badges, setBadges] = useState([]);
  const [myBadges, setMyBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      creatorLevelsApi.list(),
      creatorBadgesApi.list(),
      user ? creatorUserBadgesApi.list() : Promise.resolve({ status: 'fulfilled', value: { data: [] } }),
    ]).then(([lvlRes, badgeRes, myRes]) => {
      if (cancelled) return;
      setLevels(lvlRes.status === 'fulfilled' ? (lvlRes.value.data.results || lvlRes.value.data || []) : []);
      setBadges(badgeRes.status === 'fulfilled' ? (badgeRes.value.data.results || badgeRes.value.data || []) : []);
      setMyBadges(myRes.status === 'fulfilled' ? (myRes.value.data.results || myRes.value.data || []) : []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user]);

  if (loading) {
    return (
      <div style={s.section}>
        <div style={s.title}>Levels & Badges</div>
        <div style={{ color: 'var(--text-secondary, #666)' }}>Loading...</div>
      </div>
    );
  }

  const myBadgeIds = new Set(myBadges.map(b => b.badge?.key || b.badge));

  return (
    <div style={s.section}>
      <div style={s.title}>{t?.levels_badges_title || 'Levels & Badges'}</div>

      <div style={{ marginBottom: '1.2rem' }}>
        {(levels.results || levels).map((level) => (
          <div key={level.key || level.id} style={s.levelRow}>
            <div style={{ ...s.levelIcon, background: level.color ? `${level.color}22` : undefined, color: level.color || undefined }}>
              <i className={`fas ${level.icon || 'fa-circle'}`} />
            </div>
            <div>
              <div style={s.levelLabel}>{level.label}</div>
              {level.description && <div style={s.levelDesc}>{level.description}</div>}
            </div>
          </div>
        ))}
      </div>

      <div>
        <div style={{ ...s.title, fontSize: '0.95rem', marginBottom: '0.5rem' }}>
          {t?.my_badges_title || 'My Badges'}
        </div>
        {(badges.results || badges).length === 0 ? (
          <div style={s.empty}>No badges yet.</div>
        ) : (
          <div style={s.badgeGrid}>
            {(badges.results || badges).map((badge) => {
              const earned = myBadgeIds.has(badge.key);
              return (
                <div
                  key={badge.key || badge.id}
                  style={{
                    ...s.badge,
                    opacity: earned ? 1 : 0.5,
                    borderColor: earned ? (badge.color || 'var(--pink-primary)') : undefined,
                  }}
                  title={badge.description}
                >
                  <i className={`fas ${badge.icon || 'fa-certificate'}`} style={{ color: badge.color || 'inherit' }} />
                  <span>{badge.label}</span>
                  {earned && <i className="fas fa-check" style={{ color: '#4caf50', fontSize: '0.7rem' }} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
