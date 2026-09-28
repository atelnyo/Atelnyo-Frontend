/**
 * src/components/community/ModerationAnalytics.jsx
 *
 * Moderation Analytics Dashboard for Community Managers.
 *
 * Features:
 *   - Moderation trends over time
 *   - Content health metrics
 *   - Moderator performance
 *   - Response time analytics
 *   - Community health score
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

// ─── Helpers ──────────────────────────────────────────────────────

function formatNumber(num) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num?.toString() || '0';
}

function getHealthColor(score) {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  if (score >= 40) return '#ea580c';
  return '#dc2626';
}

function getHealthLabel(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

// ─── Health Score Card ────────────────────────────────────────────

function HealthScoreCard({ score, lang }) {
  const color = getHealthColor(score);
  const label = getHealthLabel(score);

  return (
    <div className="ma-health-card">
      <div className="ma-health-gauge">
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="50"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={`${(score / 100) * 314} 314`}
            strokeDashoffset="0"
            transform="rotate(-90 60 60)"
          />
          <text x="60" y="55" textAnchor="middle" fontSize="24" fontWeight="bold" fill={color}>
            {score}
          </text>
          <text x="60" y="75" textAnchor="middle" fontSize="12" fill="#6b7280">
            {label}
          </text>
        </svg>
      </div>
      <div className="ma-health-label">
        {lang === 'ht' ? 'Sante Communautaire' : 'Community Health'}
      </div>
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────

function MetricCard({ icon, label, value, change, color, format = 'number' }) {
  const displayValue = format === 'number' ? formatNumber(value) : value;
  const isPositive = change > 0;
  const isNegative = change < 0;

  return (
    <div className="ma-metric-card">
      <div className="ma-metric-icon" style={{ background: `${color}15`, color }}>
        <i className={`fas ${icon}`} />
      </div>
      <div className="ma-metric-content">
        <div className="ma-metric-value">{displayValue}</div>
        <div className="ma-metric-label">{label}</div>
      </div>
      {change !== undefined && (
        <div className={`ma-metric-change ${isPositive ? 'ma-change-positive' : isNegative ? 'ma-change-negative' : ''}`}>
          <i className={`fas fa-arrow-${isPositive ? 'up' : isNegative ? 'down' : 'right'}`} />
          {Math.abs(change)}%
        </div>
      )}
    </div>
  );
}

// ─── Trend Chart ──────────────────────────────────────────────────

function TrendChart({ data, label, color, height = 120 }) {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data.map(d => d.value), 1);
  const width = 300;
  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - (d.value / max) * (height - 20) - 10,
  }));

  const pathD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');

  return (
    <div className="ma-trend-chart">
      <div className="ma-trend-label">{label}</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="ma-trend-svg">
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
        ))}
      </svg>
      <div className="ma-trend-values">
        <span>{data[0]?.label || 'Start'}</span>
        <span>{data[data.length - 1]?.label || 'Now'}</span>
      </div>
    </div>
  );
}

// ─── Moderator Performance ────────────────────────────────────────

function ModeratorPerformance({ moderators, lang }) {
  if (!moderators || moderators.length === 0) return null;

  return (
    <div className="ma-moderators">
      <h4>
        <i className="fas fa-user-shield" />
        {lang === 'ht' ? 'Pèfòmans Modiratè' : 'Moderator Performance'}
      </h4>

      <div className="ma-moderator-list">
        {moderators.map((mod, idx) => (
          <div key={idx} className="ma-moderator-item">
            <div className="ma-moderator-rank">#{idx + 1}</div>
            <div className="ma-moderator-avatar">
              {mod.avatar ? (
                <img src={mod.avatar} alt={mod.username} />
              ) : (
                <span>{mod.username?.charAt(0)?.toUpperCase()}</span>
              )}
            </div>
            <div className="ma-moderator-info">
              <div className="ma-moderator-name">{mod.username}</div>
              <div className="ma-moderator-stats">
                <span>{mod.actions_count || 0} actions</span>
                <span>{mod.avg_response_time || 'N/A'} avg response</span>
              </div>
            </div>
            <div className="ma-moderator-score">
              <div className="ma-score-bar" style={{ width: `${mod.efficiency || 0}%` }} />
              <span>{mod.efficiency || 0}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export default function ModerationAnalytics({ community, lang = 'ht' }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [timeRange, setTimeRange] = useState('7d');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/communities/${community?.id}/moderation/analytics/?range=${timeRange}`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [community?.id, timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="ma-loading">
        <i className="fas fa-spinner fa-spin" />
        <span>{lang === 'ht' ? 'Ap chaje...' : 'Loading...'}</span>
      </div>
    );
  }

  if (!data) return null;

  const { health_score, metrics, trends, moderators, recent_actions } = data;

  return (
    <div className="ma-container">
      <div className="ma-header">
        <h3>
          <i className="fas fa-chart-line" />
          {lang === 'ht' ? 'Analiz Moderasyon' : 'Moderation Analytics'}
        </h3>
        <div className="ma-time-range">
          <button className={timeRange === '24h' ? 'ma-range-active' : ''} onClick={() => setTimeRange('24h')}>24H</button>
          <button className={timeRange === '7d' ? 'ma-range-active' : ''} onClick={() => setTimeRange('7d')}>7D</button>
          <button className={timeRange === '30d' ? 'ma-range-active' : ''} onClick={() => setTimeRange('30d')}>30D</button>
          <button className={timeRange === '90d' ? 'ma-range-active' : ''} onClick={() => setTimeRange('90d')}>90D</button>
        </div>
      </div>

      {/* Health Score */}
      <HealthScoreCard score={health_score || 0} lang={lang} />

      {/* Metrics Grid */}
      <div className="ma-metrics-grid">
        <MetricCard
          icon="fa-flag"
          label={lang === 'ht' ? 'Rapò' : 'Reports'}
          value={metrics?.total_reports || 0}
          change={metrics?.reports_change}
          color="#8b5cf6"
        />
        <MetricCard
          icon="fa-check-circle"
          label={lang === 'ht' ? 'Rezoud' : 'Resolved'}
          value={metrics?.resolved || 0}
          change={metrics?.resolved_change}
          color="#10b981"
        />
        <MetricCard
          icon="fa-clock"
          label={lang === 'ht' ? 'Tan Repons' : 'Response Time'}
          value={metrics?.avg_response_time || '0m'}
          color="#3b82f6"
          format="text"
        />
        <MetricCard
          icon="fa-ban"
          label={lang === 'ht' ? 'Bloke' : 'Bans'}
          value={metrics?.total_bans || 0}
          change={metrics?.bans_change}
          color="#dc2626"
        />
        <MetricCard
          icon="fa-exclamation-triangle"
          label={lang === 'ht' ? 'Avètisman' : 'Warnings'}
          value={metrics?.total_warnings || 0}
          change={metrics?.warnings_change}
          color="#f59e0b"
        />
        <MetricCard
          icon="fa-volume-mute"
          label={lang === 'ht' ? 'Mute' : 'Mutes'}
          value={metrics?.total_mutes || 0}
          color="#6b7280"
        />
      </div>

      {/* Trend Charts */}
      <div className="ma-trends">
        <h4>{lang === 'ht' ? 'Tandan' : 'Trends'}</h4>
        <div className="ma-trends-grid">
          <TrendChart
            data={trends?.reports || []}
            label={lang === 'ht' ? 'Rapò' : 'Reports'}
            color="#8b5cf6"
          />
          <TrendChart
            data={trends?.resolutions || []}
            label={lang === 'ht' ? 'Rezolisyon' : 'Resolutions'}
            color="#10b981"
          />
          <TrendChart
            data={trends?.response_time || []}
            label={lang === 'ht' ? 'Tan Repons' : 'Response Time'}
            color="#3b82f6"
          />
        </div>
      </div>

      {/* Moderator Performance */}
      <ModeratorPerformance moderators={moderators} lang={lang} />

      {/* Recent Actions */}
      {recent_actions && recent_actions.length > 0 && (
        <div className="ma-recent">
          <h4>
            <i className="fas fa-history" />
            {lang === 'ht' ? 'Dènye Aktivite' : 'Recent Activity'}
          </h4>
          <div className="ma-recent-list">
            {recent_actions.slice(0, 10).map((action, idx) => (
              <div key={idx} className="ma-recent-item">
                <div className="ma-recent-icon">
                  <i className={`fas ${
                    action.type === 'resolve' ? 'fa-check' :
                    action.type === 'ban' ? 'fa-ban' :
                    action.type === 'warn' ? 'fa-exclamation' :
                    action.type === 'mute' ? 'fa-volume-mute' :
                    'fa-circle'
                  }`} />
                </div>
                <div className="ma-recent-content">
                  <span className="ma-recent-moderator">{action.moderator}</span>
                  <span className="ma-recent-action">{action.action}</span>
                  <span className="ma-recent-target">{action.target}</span>
                </div>
                <div className="ma-recent-time">{action.time_ago}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
