/**
 * src/components/studio/CreatorProgression.jsx
 *
 * ═══════════════════════════════════════════════════════════════════════
 * PROMPT 22 — Creator Progression / Levels System
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Visual 12-tier Creator Lifecycle journey from Visitor → Enterprise Creator.
 * Shows: current level, progress to next tier, requirements met/missing,
 * unlocked features, and the full tier ladder.
 *
 * Everything is based on REAL platform data — no fake XP.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { creatorProgressionService } from '../../services/api';

function classNames(...parts) { return parts.filter(Boolean).join(' '); }

export default function CreatorProgression({ lang = 'en', showToast, compact = false }) {
  const isHt = lang === 'ht';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProgression = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await creatorProgressionService.get();
      setData(res.data);
    } catch (err) {
      setError(err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProgression(); }, [fetchProgression]);

  if (loading) {
    return (
      <div className="cprog-loading" role="status" aria-busy="true">
        <i className="fas fa-spinner fa-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="cprog-error" role="alert">
        <i className="fas fa-triangle-exclamation" />
        <span>{isHt ? 'Pa ka chaje pwogresyon' : 'Cannot load progression'}</span>
      </div>
    );
  }

  const { current_tier, next_tier, progress_to_next, requirements_met, requirements_missing, all_tiers } = data;

  return (
    <div className={classNames('cprog-container', compact && 'cprog-compact')}>
      {/* Current Level Badge */}
      <div className="cprog-current" style={{ borderColor: current_tier?.color || '#94a3b8' }}>
        <div className="cprog-current-icon" style={{ background: current_tier?.color || '#94a3b8' }}>
          <i className={`fas ${current_tier?.icon || 'fa-user'}`} aria-hidden="true" />
        </div>
        <div className="cprog-current-info">
          <div className="cprog-current-level">
            {isHt ? 'Nivo' : 'Level'} {current_tier?.level}
          </div>
          <div className="cprog-current-name">
            {isHt ? current_tier?.name_ht : current_tier?.name}
          </div>
          <div className="cprog-current-desc">
            {isHt ? current_tier?.description_ht : current_tier?.description}
          </div>
        </div>
      </div>

      {/* Progress to next tier */}
      {next_tier && (
        <div className="cprog-next">
          <div className="cprog-next-header">
            <span className="cprog-next-label">
              {isHt ? 'Pwochen:' : 'Next:'} {' '}
              <strong style={{ color: next_tier?.color }}>
                {isHt ? next_tier?.name_ht : next_tier?.name}
              </strong>
            </span>
            <span className="cprog-next-pct">{progress_to_next}%</span>
          </div>
          <div className="cprog-bar">
            <div
              className="cprog-bar-fill"
              style={{
                width: `${progress_to_next}%`,
                background: `linear-gradient(90deg, ${current_tier?.color}, ${next_tier?.color})`,
              }}
            />
          </div>

          {/* Requirements */}
          <div className="cprog-reqs">
            {requirements_missing?.length > 0 && (
              <div className="cprog-reqs-missing">
                <span className="cprog-reqs-label">
                  <i className="fas fa-circle-exclamation" style={{ color: '#f59e0b' }} /> {' '}
                  {isHt ? 'Sa ou bezwen fè:' : 'What you need:'}
                </span>
                {requirements_missing.map((req, i) => (
                  <div key={i} className="cprog-req-item cprog-req-missing">
                    <i className="fas fa-circle" style={{ fontSize: '0.35rem' }} /> {req}
                  </div>
                ))}
              </div>
            )}
            {requirements_met?.length > 0 && (
              <div className="cprog-reqs-met">
                <span className="cprog-reqs-label">
                  <i className="fas fa-circle-check" style={{ color: '#10b981' }} /> {' '}
                  {isHt ? 'Fini:' : 'Done:'}
                </span>
                {requirements_met.map((req, i) => (
                  <div key={i} className="cprog-req-item cprog-req-done">
                    <i className="fas fa-check" style={{ color: '#10b981', fontSize: '0.55rem' }} /> {req}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Unlocks */}
          {next_tier?.unlocks?.length > 0 && (
            <div className="cprog-unlocks">
              <span className="cprog-reqs-label">
                <i className="fas fa-unlock" style={{ color: '#8b5cf6' }} /> {' '}
                {isHt ? 'Sa w ap jwenn:' : 'What you\'ll unlock:'}
              </span>
              <div className="cprog-unlocks-list">
                {next_tier.unlocks.map((unlock, i) => (
                  <span key={i} className="cprog-unlock-chip">
                    <i className="fas fa-star" style={{ fontSize: '0.5rem' }} /> {unlock}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tier ladder (compact only shows current + next) */}
      {!compact && all_tiers && (
        <div className="cprog-ladder">
          <h4 className="cprog-ladder-title">
            <i className="fas fa-mountain" aria-hidden="true" /> {' '}
            {isHt ? 'Vwayaj Kreyatè' : 'Creator Journey'}
          </h4>
          <div className="cprog-ladder-list">
            {all_tiers.map((tier) => {
              const isCurrent = tier.level === current_tier?.level;
              const isPast = tier.level < current_tier?.level;
              const isFuture = tier.level > current_tier?.level;
              return (
                <div
                  key={tier.key}
                  className={classNames(
                    'cprog-ladder-tier',
                    isCurrent && 'cprog-ladder-current',
                    isPast && 'cprog-ladder-past',
                    isFuture && 'cprog-ladder-future',
                  )}
                >
                  <div
                    className="cprog-ladder-dot"
                    style={{
                      background: isPast ? '#10b981' : isCurrent ? tier.color : '#e2e8f0',
                      borderColor: isCurrent ? tier.color : 'transparent',
                    }}
                  >
                    {isPast ? <i className="fas fa-check" style={{ color: '#fff', fontSize: '0.5rem' }} /> : null}
                  </div>
                  <div className="cprog-ladder-info">
                    <span className="cprog-ladder-name" style={{ color: isCurrent ? tier.color : undefined }}>
                      {isHt ? tier.name_ht : tier.name}
                    </span>
                    <span className="cprog-ladder-desc">
                      {isHt ? tier.description_ht : tier.description}
                    </span>
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
