/**
 * src/components/admin/AlgorithmPerformance.jsx
 *
 * Advanced Analytics Dashboard for Algorithm Performance Monitoring.
 * Tracks recommendation quality, engagement metrics, and system health.
 *
 * Features:
 *   - Real-time algorithm metrics (CTR, engagement, diversity)
 *   - Content type performance comparison
 *   - Recommendation accuracy tracking
 *   - System health monitoring
 *   - A/B test results integration
 *   - Trend analysis over time
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';

// ─── Helpers ───────────────────────────────────────────────────────

function formatNumber(n) {
  if (n == null || !Number.isFinite(Number(n))) return '0';
  const v = Number(n);
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toLocaleString();
}

function formatPercent(n) {
  if (n == null || !Number.isFinite(Number(n))) return '0%';
  return `${Number(n).toFixed(2)}%`;
}

function formatLatency(ms) {
  if (ms == null) return '0ms';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function getHealthColor(value, thresholds) {
  if (value >= thresholds.good) return '#10b981';
  if (value >= thresholds.ok) return '#f59e0b';
  return '#ef4444';
}

// ─── Metric Card ───────────────────────────────────────────────────

function MetricCard({ icon, title, value, subtitle, color, trend, format = 'number' }) {
  const displayValue = format === 'percent'
    ? formatPercent(value)
    : format === 'latency'
    ? formatLatency(value)
    : formatNumber(value);

  return (
    <div className="algo-metric-card">
      <div className="algo-metric-icon" style={{ background: `${color}15`, color }}>
        <i className={`fas ${icon}`} />
      </div>
      <div className="algo-metric-content">
        <div className="algo-metric-value">{displayValue}</div>
        <div className="algo-metric-title">{title}</div>
        {subtitle && <div className="algo-metric-subtitle">{subtitle}</div>}
        {trend != null && (
          <div className={`algo-metric-trend ${trend >= 0 ? 'algo-positive' : 'algo-negative'}`}>
            <i className={`fas fa-arrow-${trend >= 0 ? 'up' : 'down'}`} />
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Health Indicator ──────────────────────────────────────────────

function HealthIndicator({ label, status, details }) {
  const colors = {
    healthy: '#10b981',
    warning: '#f59e0b',
    critical: '#ef4444',
    unknown: '#6b7280',
  };

  return (
    <div className="algo-health-item">
      <div className="algo-health-dot" style={{ background: colors[status] || colors.unknown }} />
      <div className="algo-health-content">
        <div className="algo-health-label">{label}</div>
        <div className="algo-health-status" style={{ color: colors[status] || colors.unknown }}>
          {status}
        </div>
        {details && <div className="algo-health-details">{details}</div>}
      </div>
    </div>
  );
}

// ─── Sparkline Chart ───────────────────────────────────────────────

function Sparkline({ data, color = '#d81b60', height = 40, width = 120 }) {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="algo-sparkline">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Performance Gauge ─────────────────────────────────────────────

function PerformanceGauge({ value, max = 100, label, color = '#d81b60' }) {
  const percentage = Math.min(100, (value / max) * 100);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference * 0.75; // 270 degrees

  return (
    <div className="algo-gauge">
      <svg width="150" height="120" viewBox="0 0 150 120">
        {/* Background arc */}
        <circle
          cx="75"
          cy="75"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="12"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeLinecap="round"
          transform="rotate(135, 75, 75)"
        />
        {/* Value arc */}
        <circle
          cx="75"
          cy="75"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={`${circumference * 0.75 - offset} ${circumference * 0.25 + offset}`}
          strokeLinecap="round"
          transform="rotate(135, 75, 75)"
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
        {/* Value text */}
        <text x="75" y="70" textAnchor="middle" className="algo-gauge-value">
          {formatPercent(value)}
        </text>
        <text x="75" y="90" textAnchor="middle" className="algo-gauge-label">
          {label}
        </text>
      </svg>
    </div>
  );
}

// ─── Content Type Table ────────────────────────────────────────────

function ContentTypeTable({ data }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="algo-table-wrap">
      <table className="algo-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Items</th>
            <th>Avg Score</th>
            <th>CTR</th>
            <th>Engagement</th>
            <th>Trend</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={row.type || idx}>
              <td className="algo-type-cell">
                <span className="algo-type-badge">{row.type}</span>
              </td>
              <td>{formatNumber(row.count)}</td>
              <td>{row.avg_score?.toFixed(1) || '-'}</td>
              <td>{formatPercent(row.ctr)}</td>
              <td>{formatPercent(row.engagement_rate)}</td>
              <td>
                <Sparkline data={row.trend || []} color={row.trend_slope > 0 ? '#10b981' : '#ef4444'} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Real-time Feed ────────────────────────────────────────────────

function RealtimeFeed({ events }) {
  if (!events || events.length === 0) return null;

  return (
    <div className="algo-realtime-feed">
      {events.slice(0, 10).map((event, idx) => (
        <div key={idx} className="algo-event-item">
          <div className="algo-event-icon">
            <i className={`fas ${event.icon || 'fa-circle'}`} style={{ color: event.color || '#6b7280' }} />
          </div>
          <div className="algo-event-content">
            <span className="algo-event-message">{event.message}</span>
            <span className="algo-event-time">{event.time}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────

export default function AlgorithmPerformance({ lang = 'ht', showToast }) {
  const [metrics, setMetrics] = useState(null);
  const [contentTypeData, setContentTypeData] = useState([]);
  const [healthStatus, setHealthStatus] = useState([]);
  const [realtimeEvents, setRealtimeEvents] = useState([]);
  const [trendData, setTrendData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('24h');
  const [refreshInterval, setRefreshInterval] = useState(null);

  // Fetch algorithm metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const [metricsRes, contentRes, healthRes, eventsRes, trendRes] = await Promise.allSettled([
        api.get('/analytics/algorithm/metrics/', { params: { period } }),
        api.get('/analytics/algorithm/content-types/'),
        api.get('/analytics/algorithm/health/'),
        api.get('/analytics/algorithm/realtime/', { params: { limit: 20 } }),
        api.get('/analytics/algorithm/trends/', { params: { period } }),
      ]);

      if (metricsRes.status === 'fulfilled') setMetrics(metricsRes.value.data);
      if (contentRes.status === 'fulfilled') setContentTypeData(Array.isArray(contentRes.value.data) ? contentRes.value.data : []);
      if (healthRes.status === 'fulfilled') setHealthStatus(Array.isArray(healthRes.value.data) ? healthRes.value.data : []);
      if (eventsRes.status === 'fulfilled') setRealtimeEvents(Array.isArray(eventsRes.value.data) ? eventsRes.value.data : []);
      if (trendRes.status === 'fulfilled') setTrendData(trendRes.value.data || {});
    } catch (err) {
      setError(err.message);
    }
  }, [period]);

  // Initial fetch
  useEffect(() => {
    setLoading(true);
    fetchMetrics().finally(() => setLoading(false));
  }, [fetchMetrics]);

  // Auto-refresh for real-time data
  useEffect(() => {
    const interval = setInterval(() => {
      api.get('/analytics/algorithm/realtime/', { params: { limit: 20 } })
        .then(res => setRealtimeEvents(Array.isArray(res.data) ? res.data : []))
        .catch(() => {});
    }, 30000); // Refresh every 30 seconds

    setRefreshInterval(interval);
    return () => clearInterval(interval);
  }, []);

  // Calculate derived metrics
  const derivedMetrics = useMemo(() => {
    if (!metrics) return null;

    return {
      overallCTR: metrics.total_clicks && metrics.total_impressions
        ? (metrics.total_clicks / metrics.total_impressions) * 100
        : 0,
      engagementRate: metrics.total_engagements && metrics.total_impressions
        ? (metrics.total_engagements / metrics.total_impressions) * 100
        : 0,
      diversityScore: metrics.diversity_score || 0,
      satisfactionScore: metrics.satisfaction_score || 0,
      avgLatency: metrics.avg_latency_ms || 0,
      p95Latency: metrics.p95_latency_ms || 0,
    };
  }, [metrics]);

  if (loading) {
    return (
      <div className="algo-loading">
        <i className="fas fa-spinner fa-spin" />
        <span>Loading algorithm metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="algo-error">
        <i className="fas fa-exclamation-triangle" />
        <span>{error}</span>
        <button onClick={fetchMetrics}>Retry</button>
      </div>
    );
  }

  return (
    <div className="algo-container">
      <div className="algo-header">
        <h2>
          <i className="fas fa-brain" />
          Algorithm Performance Dashboard
        </h2>
        <div className="algo-controls">
          <div className="algo-period-selector">
            <button className={period === '1h' ? 'algo-active' : ''} onClick={() => setPeriod('1h')}>1H</button>
            <button className={period === '24h' ? 'algo-active' : ''} onClick={() => setPeriod('24h')}>24H</button>
            <button className={period === '7d' ? 'algo-active' : ''} onClick={() => setPeriod('7d')}>7D</button>
            <button className={period === '30d' ? 'algo-active' : ''} onClick={() => setPeriod('30d')}>30D</button>
          </div>
          <button className="algo-refresh-btn" onClick={fetchMetrics}>
            <i className="fas fa-sync-alt" />
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      {derivedMetrics && (
        <div className="algo-metrics-grid">
          <MetricCard
            icon="fa-mouse-pointer"
            title="Overall CTR"
            value={derivedMetrics.overallCTR}
            format="percent"
            color="#d81b60"
            trend={metrics?.ctr_trend}
          />
          <MetricCard
            icon="fa-heart"
            title="Engagement Rate"
            value={derivedMetrics.engagementRate}
            format="percent"
            color="#8b5cf6"
            trend={metrics?.engagement_trend}
          />
          <MetricCard
            icon="fa-shuffle"
            title="Diversity Score"
            value={derivedMetrics.diversityScore}
            format="percent"
            color="#06b6d4"
          />
          <MetricCard
            icon="fa-face-smile"
            title="Satisfaction Score"
            value={derivedMetrics.satisfactionScore}
            format="percent"
            color="#10b981"
          />
          <MetricCard
            icon="fa-bolt"
            title="Avg Latency"
            value={derivedMetrics.avgLatency}
            format="latency"
            color="#f59e0b"
          />
          <MetricCard
            icon="fa-stopwatch"
            title="P95 Latency"
            value={derivedMetrics.p95Latency}
            format="latency"
            color="#ef4444"
          />
        </div>
      )}

      {/* Performance Gauges */}
      <div className="algo-section">
        <h3>
          <i className="fas fa-gauge-high" />
          Performance Gauges
        </h3>
        <div className="algo-gauges">
          <PerformanceGauge
            value={derivedMetrics?.overallCTR || 0}
            label="CTR"
            color="#d81b60"
          />
          <PerformanceGauge
            value={derivedMetrics?.engagementRate || 0}
            label="Engagement"
            color="#8b5cf6"
          />
          <PerformanceGauge
            value={derivedMetrics?.diversityScore || 0}
            label="Diversity"
            color="#06b6d4"
          />
          <PerformanceGauge
            value={derivedMetrics?.satisfactionScore || 0}
            label="Satisfaction"
            color="#10b981"
          />
        </div>
      </div>

      {/* System Health */}
      <div className="algo-section">
        <h3>
          <i className="fas fa-heartbeat" />
          System Health
        </h3>
        <div className="algo-health-grid">
          {healthStatus.map((item, idx) => (
            <HealthIndicator
              key={idx}
              label={item.label}
              status={item.status}
              details={item.details}
            />
          ))}
        </div>
      </div>

      {/* Content Type Performance */}
      <div className="algo-section">
        <h3>
          <i className="fas fa-chart-bar" />
          Content Type Performance
        </h3>
        <ContentTypeTable data={contentTypeData} />
      </div>

      {/* Real-time Events */}
      <div className="algo-section">
        <h3>
          <i className="fas fa-stream" />
          Real-time Activity
          <span className="algo-live-badge">LIVE</span>
        </h3>
        <RealtimeFeed events={realtimeEvents} />
      </div>
    </div>
  );
}
