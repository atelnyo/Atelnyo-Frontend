/**
 * MediaAnalyticsDashboard — Per-creator media analytics.
 *
 * Shows: Total Media, Images, Videos, Documents, Audio,
 * Healthy, Broken, Most Used, Least Used, Unused,
 * Top Provider, Validation Success Rate, Broken Rate,
 * Average Response Time, Storage Distribution, Media Growth
 */
import React, { useEffect, useState, useCallback } from 'react';
import { mediaEnterpriseService } from '../../services/api';
import MediaHelp from './MediaHelp';

function fmtCount(n) { if (n == null) return '0'; return Number(n).toLocaleString(); }

function StatCard({ icon, label, value, color, subtitle }) {
  return (        <div className="analytics-stat-card" style={{ '--stat-color': color || 'var(--color-primary, #d81b60)' }}>
      <div className="analytics-stat-icon"><i className={`fas ${icon}`} /></div>
      <div className="analytics-stat-body">
        <div className="analytics-stat-value">{value ?? '—'}</div>
        <div className="analytics-stat-label">{label}</div>
        {subtitle && <div className="analytics-stat-sub">{subtitle}</div>}
      </div>
    </div>
  );
}

function ProgressBar({ value, max, label, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="analytics-progress">
      <div className="analytics-progress-label">
        <span>{label}</span>
        <span>{fmtCount(value)}</span>
      </div>
      <div className="analytics-progress-track">
        <div className="analytics-progress-fill" style={{ width: `${pct}%`, background: color || 'var(--color-primary, #d81b60)' }} />
      </div>
    </div>
  );
}

export default function MediaAnalyticsDashboard({ lang = 'ht' }) {
  const isHt = lang === 'ht';
  const [summary, setSummary] = useState(null);
  const [healthSummary, setHealthSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [refRes, healthRes] = await Promise.allSettled([
      mediaEnterpriseService.referenceSummary(),
      mediaEnterpriseService.healthSummary(),
    ]);
    if (refRes.status === 'fulfilled') setSummary(refRes.value.data || null);
    if (healthRes.status === 'fulfilled') setHealthSummary(healthRes.value.data || null);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="analytics-loading">
        <i className="fas fa-spinner fa-spin" />
        <span>{isHt ? 'Ap chaje analitik...' : 'Loading analytics...'}</span>
      </div>
    );
  }

  const ref = summary || {};
  const health = healthSummary || {};
  const byStatus = ref.by_status || {};
  const totalUrls = ref.total_urls || 0;
  const totalUsages = ref.total_usages || 0;
  const healthyCount = byStatus.healthy || 0;
  const brokenCount = byStatus.broken || 0;
  const archivedCount = byStatus.archived || 0;
  const checkingCount = byStatus.checking || 0;
  const unknownCount = byStatus.unknown || 0;
  const healthRate = ref.health_rate ?? (totalUrls > 0 ? Math.round((healthyCount / totalUrls) * 100) : 0);

  return (
    <div className="analytics-dashboard">
      <div className="analytics-header">
        <h2 className="studio-section-title" style={{ margin: 0 }}>
          <i className="fas fa-chart-pie" />
          {isHt ? 'Analitik Medya' : 'Media Analytics'}
        </h2>
        <div className="analytics-header-actions">
          <button type="button" className="btn-secondary" onClick={fetchData}>
            <i className="fas fa-rotate" /> {isHt ? 'Rafrechi' : 'Refresh'}
          </button>
          <MediaHelp context="library" lang={lang} />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="analytics-stats-grid">
        <StatCard icon="fa-database" label={isHt ? 'Total URL' : 'Total URLs'} value={fmtCount(totalUrls)} color="var(--state-info, #38bdf8)" subtitle={`${fmtCount(totalUsages)} ${isHt ? 'itilizasyon' : 'usages'}`} />
        <StatCard icon="fa-check-circle" label={isHt ? 'An sante' : 'Healthy'} value={fmtCount(healthyCount)} color="var(--state-success, #10b981)" subtitle={`${healthRate}% ${isHt ? 'sante' : 'health rate'}`} />
        <StatCard icon="fa-times-circle" label={isHt ? 'Kase' : 'Broken'} value={fmtCount(brokenCount)} color="var(--state-error, #ef4444)" />
        <StatCard icon="fa-hourglass-half" label={isHt ? 'Ap tcheke' : 'Checking'} value={fmtCount(checkingCount)} color="var(--state-warning, #f59e0b)" />
        <StatCard icon="fa-archive" label={isHt ? 'Achive' : 'Archived'} value={fmtCount(archivedCount)} color="var(--text-secondary, #64748b)" />
        <StatCard icon="fa-question-circle" label={isHt ? 'Enkoni' : 'Unknown'} value={fmtCount(unknownCount)} color="var(--text-secondary, #94a3b8)" />
        <StatCard icon="fa-link" label={isHt ? 'Modil ak medya' : 'Modules w/ media'} value={fmtCount(ref.modules_with_usage || 0)} color="var(--pr-color-violet-500, #8b5cf6)" />
        <StatCard icon="fa-star" label={isHt ? 'Sante mwayèn' : 'Avg Health'} value={health.average_score != null ? `${health.average_score}%` : '—'} color="var(--state-warning, #f59e0b)" />
      </div>

      {/* Health Distribution */}
      {health && health.by_label && Object.keys(health.by_label).length > 0 && (
        <div className="analytics-section">
          <h3 className="analytics-section-title">
            <i className="fas fa-heartbeat" /> {isHt ? 'Distribisyon sante' : 'Health Distribution'}
          </h3>
          <div className="analytics-progress-list">
            {health.excellent > 0 && <ProgressBar value={health.excellent} max={totalUrls} label={isHt ? 'Ekselan' : 'Excellent'} color="var(--state-success, #10b981)" />}
            {health.good > 0 && <ProgressBar value={health.good} max={totalUrls} label={isHt ? 'Bon' : 'Good'} color="var(--state-info, #38bdf8)" />}
            {health.fair > 0 && <ProgressBar value={health.fair} max={totalUrls} label={isHt ? 'Mwayen' : 'Fair'} color="var(--state-warning, #f59e0b)" />}
            {health.poor > 0 && <ProgressBar value={health.poor} max={totalUrls} label={isHt ? 'Fèb' : 'Poor'} color="var(--pr-color-orange-500, #f97316)" />}
            {health.critical > 0 && <ProgressBar value={health.critical} max={totalUrls} label={isHt ? 'Kritik' : 'Critical'} color="var(--state-error, #ef4444)" />}
          </div>
        </div>
      )}

      {/* Breakdown by status */}
      {totalUrls > 0 && (
        <div className="analytics-section">
          <h3 className="analytics-section-title">
            <i className="fas fa-list" /> {isHt ? 'Estati' : 'Status Breakdown'}
          </h3>
          <div className="analytics-progress-list">
            <ProgressBar value={healthyCount} max={totalUrls} label={isHt ? 'An sante' : 'Healthy'} color="var(--state-success, #10b981)" />
            <ProgressBar value={brokenCount} max={totalUrls} label={isHt ? 'Kase' : 'Broken'} color="var(--state-error, #ef4444)" />
            <ProgressBar value={checkingCount} max={totalUrls} label={isHt ? 'Ap tcheke' : 'Checking'} color="var(--state-warning, #f59e0b)" />
            <ProgressBar value={archivedCount} max={totalUrls} label={isHt ? 'Achive' : 'Archived'} color="var(--text-secondary, #64748b)" />
            <ProgressBar value={unknownCount} max={totalUrls} label={isHt ? 'Enkoni' : 'Unknown'} color="var(--text-secondary, #94a3b8)" />
          </div>
        </div>
      )}

      {totalUrls === 0 && (
        <div className="analytics-empty">
          <i className="fas fa-chart-pie" />
          <h3>{isHt ? 'Pa gen done analitik' : 'No analytics data'}</h3>
          <p>{isHt ? 'Kòmanse ajoute medya pou wè estatistik ou yo parèt isit la.' : 'Start adding media to see your analytics here.'}</p>
        </div>
      )}
    </div>
  );
}
