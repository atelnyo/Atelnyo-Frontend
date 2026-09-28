/**
 * MediaTrustCenter — Creator-facing Trust Center dashboard.
 *
 * Shows aggregate view of:
 *   - Overall Health Score
 *   - Security Score
 *   - Provider Trust Status
 *   - Broken Links Summary
 *   - Privacy & Permission Status
 *   - Recent Security Events
 *   - Validation Success Rate
 *   - Warnings & Recommendations
 *
 * Spec: "Media Hub dwe genyen yon seksyon Trust Center.
 *        Li montre Overall Health, Security Score, Provider Trust,
 *        Broken Links, Privacy Status, Permission Status,
 *        Recent Security Events, Validation Success, Warnings,
 *        Recommendations."
 *
 * Route: rendered inside CreatorStudio or as standalone at /sheet/trust-center
 */
import React, { useEffect, useState, useCallback } from 'react';
import { mediaTrustCenterService } from '../../services/api';
import '../../styles/trust-center.css';
import MediaHelp from './MediaHelp';

function fmtCount(n) { if (n == null) return '0'; return Number(n).toLocaleString(); }

function ScoreRing({ score, label, color, size = 100 }) {
  const radius = (size / 2) - 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="trust-ring-wrapper" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--border-color, rgba(216,27,96,0.1))"
          strokeWidth="5"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="trust-ring-center">
        <span className="trust-ring-score">{score}%</span>
        <span className="trust-ring-label" style={{ color }}>{label}</span>
      </div>
    </div>
  );
}

function StatTile({ icon, label, value, color, subtitle }) {
  return (
    <div className="trust-stat-tile" style={{ '--tile-accent': color || 'var(--color-primary, #d81b60)' }}>
      <div className="trust-stat-icon" style={{ color }}>
        <i className={`fas ${icon}`} />
      </div>
      <div className="trust-stat-body">
        <div className="trust-stat-value">{value != null ? fmtCount(value) : '—'}</div>
        <div className="trust-stat-label">{label}</div>
        {subtitle && <div className="trust-stat-sub">{subtitle}</div>}
      </div>
    </div>
  );
}

function WarningRow({ warning, lang }) {
  const isHt = lang === 'ht';
  const sevColor = warning.severity === 'high' ? 'var(--state-error, #ef4444)' : warning.severity === 'medium' ? 'var(--state-warning, #f59e0b)' : 'var(--state-info, #38bdf8)';
  const sevIcon = warning.severity === 'high' ? 'fa-circle-exclamation' : warning.severity === 'medium' ? 'fa-triangle-exclamation' : 'fa-circle-info';
  return (
    <div className="trust-warning-row" style={{ borderLeftColor: sevColor }}>
      <i className={`fas ${sevIcon}`} style={{ color: sevColor }} />
      <span>{isHt ? warning.message_ht : warning.message_en}</span>
    </div>
  );
}

function RecommendationCard({ rec, lang }) {
  const isHt = lang === 'ht';
  return (
    <div className="trust-rec-card">
      <div className="trust-rec-icon">
        <i className="fas fa-lightbulb" />
      </div>
      <div className="trust-rec-body">
        <p className="trust-rec-text">{isHt ? rec.message_ht : rec.message_en}</p>
        {rec.cta_en && (
          <span className="trust-rec-cta">{isHt ? rec.cta_ht : rec.cta_en} →</span>
        )}
      </div>
    </div>
  );
}

function ProviderTrustBadge({ provider, lang }) {
  const isHt = lang === 'ht';
  const statusColors = {
    healthy: 'var(--state-success, #10b981)',
    degraded: 'var(--state-warning, #f59e0b)',
    unhealthy: 'var(--state-error, #ef4444)',
    unknown: 'var(--text-secondary, #94a3b8)',
  };
  const statusLabels = {
    healthy: { en: 'Healthy', ht: 'An sante' },
    degraded: { en: 'Degraded', ht: 'Degrade' },
    unhealthy: { en: 'Unhealthy', ht: 'Pa an sante' },
    unknown: { en: 'Unknown', ht: 'Enkoni' },
  };
  const s = statusLabels[provider.status] || statusLabels.unknown;
  return (
    <div className="trust-provider-badge">
      <span className="trust-provider-dot" style={{ background: statusColors[provider.status] || '#94a3b8' }} />
      <span className="trust-provider-name">{provider.name}</span>
      <span className="trust-provider-status" style={{ color: statusColors[provider.status] }}>
        {isHt ? s.ht : s.en}
      </span>
      <span className="trust-provider-avail">{provider.availability}%</span>
    </div>
  );
}

export default function MediaTrustCenter({ lang = 'ht', showToast, compact = false }) {
  const isHt = lang === 'ht';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mediaTrustCenterService.summary();
      setData(res.data);
    } catch {
      showToast?.(
        isHt ? 'Pa kapab chaje Trust Center.' : 'Failed to load Trust Center.',
        'exclamation-triangle',
      );
    } finally {
      setLoading(false);
    }
  }, [isHt, showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="trust-loading">
        <i className="fas fa-spinner fa-spin" />
        <span>{isHt ? 'Ap chaje Trust Center...' : 'Loading Trust Center...'}</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="trust-empty">
        <i className="fas fa-shield-halved" />
        <h3>{isHt ? 'Trust Center pa disponib' : 'Trust Center unavailable'}</h3>
        <button type="button" className="btn-secondary" onClick={fetchData}>
          <i className="fas fa-sync" /> {isHt ? 'Eseye ankò' : 'Retry'}
        </button>
      </div>
    );
  }

  const oh = data.overall_health || {};
  const us = data.user_summary || {};
  const broken = data.broken_links || {};
  const perms = data.permissions || {};
  const warnings = data.warnings || [];
  const recs = data.recommendations || [];
  const providers = data.provider_trust || [];
  const events = data.recent_security_events || [];

  return (
    <div className={`trust-center ${compact ? 'trust-compact' : ''}`}>
      {/* Header */}
      <div className="trust-header">
        <div className="trust-header-left">
          <h2 className="trust-title">
            <i className="fas fa-shield-halved" /> {isHt ? 'Sant Konfyans Medya' : 'Media Trust Center'}
          </h2>
          <p className="trust-subtitle">
            {isHt
              ? 'Siveyans sante, sekirite, ak konfyans tout medya ou yo.'
              : 'Health, security, and trust overview for all your media.'}
          </p>
        </div>
        <div className="trust-header-actions">
          <button type="button" className="btn-secondary" onClick={fetchData}>
            <i className="fas fa-sync" /> {isHt ? 'Rafrechi' : 'Refresh'}
          </button>
          <MediaHelp context="library" lang={lang} />
        </div>
      </div>

      {/* Score Rings Row */}
      <div className="trust-scores-row">
        <ScoreRing
          score={oh.overall_score || 0}
          label={isHt ? 'Sante Jeneral' : 'Overall Health'}
          color={oh.color || 'var(--text-secondary, #94a3b8)'}
          size={100}
        />
        <div className="trust-scores-meta">
          <div className="trust-status-badge" style={{ background: `var(--state-neutral-bg, rgba(148,163,184,0.09))`, color: oh.color }}>
            <i className="fas fa-circle" style={{ fontSize: 8 }} />{' '}
            {isHt
              ? (oh.label === 'Excellent' ? 'Ekselan' : oh.label === 'Good' ? 'Bon' : oh.label === 'Attention Needed' ? 'Atansyon' : oh.label === 'Risk Detected' ? 'Risk' : oh.label === 'High Risk' ? 'Risk Segondè' : oh.label)
              : oh.label}
          </div>
          <span className="trust-meta-line">
            <i className="fas fa-cloud" /> {oh.total_providers || 0} {isHt ? 'provider' : 'providers'}{' — '}
            {oh.healthy_providers || 0} {isHt ? 'an sante' : 'healthy'}
          </span>
          {oh.avg_response_time_ms && (
            <span className="trust-meta-line">
              <i className="fas fa-clock" /> {oh.avg_response_time_ms}ms {isHt ? 'mwayèn' : 'avg'}
            </span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      {!compact && (
        <div className="trust-stats-grid">
          <StatTile icon="fa-database" label={isHt ? 'Total Medya' : 'Total Media'} value={us.total_media} color="var(--state-info, #38bdf8)" />
          <StatTile icon="fa-check-circle" label={isHt ? 'An Sante' : 'Healthy'} value={us.healthy} color="var(--state-success, #10b981)" />
          <StatTile icon="fa-link-slash" label={isHt ? 'Kase' : 'Broken'} value={us.broken} color="var(--state-error, #ef4444)" />
          <StatTile icon="fa-pen-to-square" label={isHt ? 'Bouyon' : 'Drafts'} value={us.drafts} color="var(--state-warning, #f59e0b)" />
          <StatTile icon="fa-percent" label={isHt ? 'Validasyon' : 'Validation'} value={`${us.validation_success_rate}%`} color="var(--pr-color-violet-500, #8b5cf6)" />
          <StatTile icon="fa-users" label={isHt ? 'Piblik' : 'Public'} value={perms.public} color="var(--state-success, #10b981)" subtitle={`${perms.restricted || 0} ${isHt ? 'restriksyon' : 'restricted'}`} />
        </div>
      )}

      {/* Broken Links Summary */}
      {broken.total > 0 && (
        <div className="trust-section">
          <h3 className="trust-section-title">
            <i className="fas fa-link-slash" style={{ color: 'var(--state-error, #ef4444)' }} />{' '}
            {isHt ? 'Lyen Kase' : 'Broken Links'}{' '}
            <span className="trust-badge trust-badge-danger">{broken.total}</span>
          </h3>
          <div className="trust-progress">
            <div className="trust-progress-track">
              <div
                className="trust-progress-fill trust-progress-danger"
                style={{ width: `${broken.pct}%` }}
              />
            </div>
            <span className="trust-progress-label">{broken.pct}% {isHt ? 'kase' : 'broken'}</span>
          </div>
        </div>
      )}

      {/* Provider Trust */}
      {providers.length > 0 && (
        <div className="trust-section">
          <h3 className="trust-section-title">
            <i className="fas fa-cloud" />{' '}
            {isHt ? 'Konfyans Provider' : 'Provider Trust'}
          </h3>
          <div className="trust-provider-list">
            {providers.map((p) => (
              <ProviderTrustBadge key={p.key} provider={p} lang={lang} />
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="trust-section">
          <h3 className="trust-section-title">
            <i className="fas fa-triangle-exclamation" style={{ color: 'var(--state-warning, #f59e0b)' }} />{' '}
            {isHt ? 'Avètisman' : 'Warnings'}{' '}
            <span className="trust-badge trust-badge-warn">{warnings.length}</span>
          </h3>
          <div className="trust-warning-list">
            {warnings.map((w, i) => (
              <WarningRow key={i} warning={w} lang={lang} />
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recs.length > 0 && (
        <div className="trust-section">
          <h3 className="trust-section-title">
            <i className="fas fa-lightbulb" style={{ color: 'var(--pr-color-violet-500, #8b5cf6)' }} />{' '}
            {isHt ? 'Rekomandasyon' : 'Recommendations'}
          </h3>
          <div className="trust-rec-list">
            {recs.map((r, i) => (
              <RecommendationCard key={i} rec={r} lang={lang} />
            ))}
          </div>
        </div>
      )}

      {/* Recent Security Events */}
      {events.length > 0 && (
        <div className="trust-section">
          <h3 className="trust-section-title">
            <i className="fas fa-shield-alt" />{' '}
            {isHt ? 'Evènman Sekirite Resan' : 'Recent Security Events'}
          </h3>
          <div className="trust-events-list">
            {events.map((e, i) => (
              <div key={i} className="trust-event-row">
                <span className="trust-event-status">
                  {e.health === 'broken' ? '🔴' : e.health === 'blocked' ? '🚫' : '⚠️'}
                </span>
                <span className="trust-event-url" title={e.url}>{e.url?.slice(0, 50)}</span>
                <span className="trust-event-date">
                  {e.at ? new Date(e.at).toLocaleDateString() : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Clear State */}
      {warnings.length === 0 && broken.total === 0 && (
        <div className="trust-all-clear">
          <i className="fas fa-check-circle" style={{ color: 'var(--state-success, #10b981)', fontSize: '2rem' }} />
          <p>{isHt ? 'Tout medya ou yo an sante! 🎉' : 'All your media is healthy! 🎉'}</p>
        </div>
      )}
    </div>
  );
}
