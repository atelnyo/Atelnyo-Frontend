/**
 * src/components/creator/AudienceInsights.jsx
 *
 * Audience Insights for Creators.
 * Shows who is viewing and engaging with their content, helping creators
 * understand their audience and tailor their content strategy.
 *
 * Features:
 *   - Audience demographics (location, language, device)
 *   - Audience behavior (when they're active, what they engage with)
 *   - Follower growth trends
 *   - Audience interests
 *   - Best time to post
 */
import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';

// ─── Helpers ───────────────────────────────────────────────────────

function formatNumber(n) {
  if (n == null) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ─── Audience Card ─────────────────────────────────────────────────

function AudienceCard({ icon, title, children }) {
  return (
    <div className="ai-audience-card">
      <div className="ai-card-header">
        <i className={`fas ${icon}`} />
        <h4>{title}</h4>
      </div>
      <div className="ai-card-content">
        {children}
      </div>
    </div>
  );
}

// ─── Demographics Bar ──────────────────────────────────────────────

function DemographicsBar({ data, label }) {
  if (!data || data.length === 0) return null;

  const total = data.reduce((sum, d) => sum + d.count, 0);
  const colors = ['#d81b60', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="ai-demographics">
      <div className="ai-demo-bar">
        {data.map((item, idx) => (
          <div
            key={item.name}
            className="ai-demo-segment"
            style={{
              width: `${(item.count / total) * 100}%`,
              background: colors[idx % colors.length],
            }}
            title={`${item.name}: ${item.count} (${((item.count / total) * 100).toFixed(1)}%)`}
          />
        ))}
      </div>
      <div className="ai-demo-legend">
        {data.slice(0, 5).map((item, idx) => (
          <div key={item.name} className="ai-demo-item">
            <span
              className="ai-demo-dot"
              style={{ background: colors[idx % colors.length] }}
            />
            <span className="ai-demo-name">{item.name}</span>
            <span className="ai-demo-count">{formatNumber(item.count)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Activity Heatmap ──────────────────────────────────────────────

function ActivityHeatmap({ data }) {
  if (!data || data.length === 0) return null;

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const maxValue = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="ai-heatmap">
      <div className="ai-heatmap-grid">
        {days.map((day, dayIdx) => (
          <div key={day} className="ai-heatmap-row">
            <span className="ai-heatmap-day">{day}</span>
            {hours.map(hour => {
              const item = data.find(d => d.day === dayIdx && d.hour === hour);
              const value = item ? item.count : 0;
              const intensity = value / maxValue;
              return (
                <div
                  key={hour}
                  className="ai-heatmap-cell"
                  style={{
                    background: `rgba(216, 27, 96, ${intensity})`,
                  }}
                  title={`${day} ${hour}:00 - ${value} activities`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="ai-heatmap-legend">
        <span>Less</span>
        <div className="ai-heatmap-scale">
          {[0, 0.25, 0.5, 0.75, 1].map(level => (
            <div
              key={level}
              className="ai-heatmap-scale-cell"
              style={{ background: `rgba(216, 27, 96, ${level})` }}
            />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}

// ─── Growth Chart ──────────────────────────────────────────────────

function GrowthChart({ data, height = 150 }) {
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map(d => d.value || 0), 1);
  const totalW = Math.max(300, data.length * 30);

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * totalW;
    const y = height - ((d.value || 0) / maxVal) * (height - 30) - 15;
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');

  const areaPoints = points + ` L${totalW},${height - 15} L0,${height - 15} Z`;

  return (
    <svg
      className="ai-growth-chart"
      viewBox={`0 0 ${totalW} ${height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map(pct => (
        <line
          key={pct}
          x1={0}
          y1={height - (maxVal * pct / maxVal) * (height - 30) - 15}
          x2={totalW}
          y2={height - (maxVal * pct / maxVal) * (height - 30) - 15}
          stroke="#e5e7eb"
          strokeDasharray="3,3"
          opacity={0.5}
        />
      ))}
      {/* Area fill */}
      <path
        d={areaPoints}
        fill="url(#ai-gradient)"
        opacity={0.3}
      />
      {/* Line */}
      <path
        d={points}
        fill="none"
        stroke="#d81b60"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Gradient definition */}
      <defs>
        <linearGradient id="ai-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#d81b60" stopOpacity={0.4} />
          <stop offset="100%" stopColor="#d81b60" stopOpacity={0} />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── Main Component ────────────────────────────────────────────────

export default function AudienceInsights({ lang = 'ht', showToast, user }) {
  const [audience, setAudience] = useState(null);
  const [activity, setActivity] = useState([]);
  const [growth, setGrowth] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    fetchAudienceData();
  }, [period]);

  const fetchAudienceData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [audienceRes, activityRes, growthRes] = await Promise.allSettled([
        api.get('/analytics/audience/', { params: { days: period } }),
        api.get('/analytics/audience/activity/', { params: { days: period } }),
        api.get('/analytics/audience/growth/', { params: { days: period } }),
      ]);

      setAudience(audienceRes.status === 'fulfilled' ? audienceRes.value.data : null);
      setActivity(activityRes.status === 'fulfilled' ? (Array.isArray(activityRes.value.data) ? activityRes.value.data : []) : []);
      setGrowth(growthRes.status === 'fulfilled' ? (Array.isArray(growthRes.value.data) ? growthRes.value.data : []) : []);
    } catch (err) {
      setError(err.message);
      showToast?.('Failed to load audience data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Calculate best time to post
  const bestTimeToPost = useMemo(() => {
    if (!activity || activity.length === 0) return null;

    const hourCounts = {};
    activity.forEach(item => {
      const hour = item.hour;
      hourCounts[hour] = (hourCounts[hour] || 0) + item.count;
    });

    const bestHour = Object.entries(hourCounts)
      .sort(([, a], [, b]) => b - a)[0];

    if (!bestHour) return null;

    const hour = parseInt(bestHour[0]);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;

    return {
      hour,
      display: `${displayHour}:00 ${ampm}`,
      activity: bestHour[1],
    };
  }, [activity]);

  if (loading) {
    return (
      <div className="ai-loading">
        <i className="fas fa-spinner fa-spin" />
        <span>Loading audience insights...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ai-error">
        <i className="fas fa-exclamation-triangle" />
        <span>{error}</span>
        <button onClick={fetchAudienceData}>Retry</button>
      </div>
    );
  }

  return (
    <div className="ai-container">
      <div className="ai-header">
        <h2>
          <i className="fas fa-users" />
          Audience Insights
        </h2>
        <div className="ai-period-selector">
          <button
            className={period === 7 ? 'ai-active' : ''}
            onClick={() => setPeriod(7)}
          >
            7 Days
          </button>
          <button
            className={period === 30 ? 'ai-active' : ''}
            onClick={() => setPeriod(30)}
          >
            30 Days
          </button>
          <button
            className={period === 90 ? 'ai-active' : ''}
            onClick={() => setPeriod(90)}
          >
            90 Days
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="ai-metrics">
        <div className="ai-metric-card">
          <div className="ai-metric-value">{formatNumber(audience?.total_followers || 0)}</div>
          <div className="ai-metric-label">Followers</div>
          <div className="ai-metric-change ai-positive">
            +{formatNumber(audience?.followers_growth || 0)}
          </div>
        </div>
        <div className="ai-metric-card">
          <div className="ai-metric-value">{formatNumber(audience?.total_views || 0)}</div>
          <div className="ai-metric-label">Total Views</div>
        </div>
        <div className="ai-metric-card">
          <div className="ai-metric-value">{formatNumber(audience?.unique_viewers || 0)}</div>
          <div className="ai-metric-label">Unique Viewers</div>
        </div>
        <div className="ai-metric-card">
          <div className="ai-metric-value">
            {bestTimeToPost ? bestTimeToPost.display : 'N/A'}
          </div>
          <div className="ai-metric-label">Best Time to Post</div>
        </div>
      </div>

      {/* Growth Chart */}
      <AudienceCard icon="fa-chart-line" title="Follower Growth">
        <GrowthChart data={growth} />
      </AudienceCard>

      {/* Demographics */}
      <div className="ai-grid">
        <AudienceCard icon="fa-globe" title="Top Locations">
          <DemographicsBar data={audience?.locations || []} />
        </AudienceCard>

        <AudienceCard icon="fa-language" title="Languages">
          <DemographicsBar data={audience?.languages || []} />
        </AudienceCard>

        <AudienceCard icon="fa-mobile-alt" title="Devices">
          <DemographicsBar data={audience?.devices || []} />
        </AudienceCard>

        <AudienceCard icon="fa-heart" title="Interests">
          <DemographicsBar data={audience?.interests || []} />
        </AudienceCard>
      </div>

      {/* Activity Heatmap */}
      <AudienceCard icon="fa-clock" title="When Your Audience is Active">
        <ActivityHeatmap data={activity} />
      </AudienceCard>
    </div>
  );
}
