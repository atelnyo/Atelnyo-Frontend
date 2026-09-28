/**
 * src/components/creator/SchedulingAnalytics.jsx
 *
 * Content Scheduling Analytics for Creators.
 * Helps creators understand when to post for maximum engagement.
 *
 * Features:
 *   - Best time to post analysis
 *   - Content performance by time of day
 *   - Day-of-week performance comparison
 *   - Scheduled content calendar
 *   - Optimal posting recommendations
 */
import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';

// ─── Helpers ───────────────────────────────────────────────────────

function formatTime(hour) {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:00 ${ampm}`;
}

function getDayName(dayIdx) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return days[dayIdx] || '';
}

function getShortDayName(dayIdx) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days[dayIdx] || '';
}

// ─── Heatmap Component ─────────────────────────────────────────────

function EngagementHeatmap({ data, title }) {
  if (!data || data.length === 0) {
    return (
      <div className="sched-empty">
        <i className="fas fa-calendar" />
        <span>No scheduling data yet</span>
      </div>
    );
  }

  const days = [0, 1, 2, 3, 4, 5, 6];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const maxValue = Math.max(...data.map(d => d.engagement || 0), 1);

  return (
    <div className="sched-heatmap">
      <div className="sched-heatmap-grid">
        {days.map(day => (
          <div key={day} className="sched-heatmap-row">
            <span className="sched-heatmap-day">{getShortDayName(day)}</span>
            {hours.map(hour => {
              const item = data.find(d => d.day === day && d.hour === hour);
              const value = item ? item.engagement : 0;
              const intensity = value / maxValue;
              return (
                <div
                  key={hour}
                  className="sched-heatmap-cell"
                  style={{
                    background: `rgba(216, 27, 96, ${intensity})`,
                  }}
                  title={`${getDayName(day)} ${formatTime(hour)}: ${value} engagement`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="sched-heatmap-hours">
        <span className="sched-heatmap-day" />
        {hours.filter((_, i) => i % 4 === 0).map(hour => (
          <span key={hour} className="sched-heatmap-hour-label">
            {formatTime(hour)}
          </span>
        ))}
      </div>
      <div className="sched-heatmap-legend">
        <span>Low</span>
        <div className="sched-heatmap-scale">
          {[0, 0.25, 0.5, 0.75, 1].map(level => (
            <div
              key={level}
              className="sched-heatmap-scale-cell"
              style={{ background: `rgba(216, 27, 96, ${level})` }}
            />
          ))}
        </div>
        <span>High</span>
      </div>
    </div>
  );
}

// ─── Best Times Card ───────────────────────────────────────────────

function BestTimesCard({ times }) {
  if (!times || times.length === 0) return null;

  return (
    <div className="sched-best-times">
      <h4>
        <i className="fas fa-clock" />
        Best Times to Post
      </h4>
      <div className="sched-times-grid">
        {times.map((item, idx) => (
          <div key={idx} className="sched-time-card">
            <div className="sched-time-rank">#{idx + 1}</div>
            <div className="sched-time-info">
              <div className="sched-time-day">{getDayName(item.day)}</div>
              <div className="sched-time-hour">{formatTime(item.hour)}</div>
            </div>
            <div className="sched-time-score">
              {item.engagement} engagement
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Day Comparison Chart ──────────────────────────────────────────

function DayComparisonChart({ data, height = 150 }) {
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map(d => d.engagement || 0), 1);
  const barWidth = Math.max(40, Math.floor(500 / data.length) - 8);

  return (
    <svg
      className="sched-day-chart"
      viewBox={`0 0 ${data.length * (barWidth + 8)} ${height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {data.map((d, i) => {
        const val = d.engagement || 0;
        const h = Math.max(4, (val / maxVal) * (height - 40));
        const x = i * (barWidth + 8);
        const y = height - h - 20;

        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={h}
              rx={4}
              fill="#d81b60"
              opacity={0.6 + (val / maxVal) * 0.4}
            >
              <title>{getDayName(d.day)}: {val} engagement</title>
            </rect>
            <text
              x={x + barWidth / 2}
              y={height - 4}
              textAnchor="middle"
              className="sched-chart-label"
              fontSize="10"
            >
              {getShortDayName(d.day)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Recommendations ───────────────────────────────────────────────

function PostingRecommendations({ bestTimes, dayData }) {
  if (!bestTimes || bestTimes.length === 0) return null;

  const bestDay = dayData?.reduce((best, d) =>
    (d.engagement || 0) > (best?.engagement || 0) ? d : best
  , null);

  const recommendations = [
    {
      icon: 'fa-calendar-check',
      title: 'Best Day',
      value: bestDay ? getDayName(bestDay.day) : 'N/A',
      description: 'Your audience is most active on this day',
    },
    {
      icon: 'fa-clock',
      title: 'Best Time',
      value: bestTimes[0] ? formatTime(bestTimes[0].hour) : 'N/A',
      description: 'Post around this time for maximum reach',
    },
    {
      icon: 'fa-bullseye',
      title: 'Optimal Window',
      value: bestTimes.length >= 2
        ? `${formatTime(bestTimes[0].hour)} - ${formatTime(bestTimes[1].hour)}`
        : formatTime(bestTimes[0]?.hour || 12),
      description: 'Schedule posts within this window',
    },
  ];

  return (
    <div className="sched-recommendations">
      <h4>
        <i className="fas fa-lightbulb" />
        Posting Recommendations
      </h4>
      <div className="sched-recommendations-grid">
        {recommendations.map((rec, idx) => (
          <div key={idx} className="sched-recommendation-card">
            <div className="sched-rec-icon">
              <i className={`fas ${rec.icon}`} />
            </div>
            <div className="sched-rec-content">
              <div className="sched-rec-title">{rec.title}</div>
              <div className="sched-rec-value">{rec.value}</div>
              <div className="sched-rec-desc">{rec.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────

export default function SchedulingAnalytics({ lang = 'ht', showToast, user }) {
  const [heatmapData, setHeatmapData] = useState([]);
  const [bestTimes, setBestTimes] = useState([]);
  const [dayData, setDayData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    fetchSchedulingData();
  }, [period]);

  const fetchSchedulingData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [heatmapRes, bestTimesRes, dayRes] = await Promise.allSettled([
        api.get('/analytics/scheduling/heatmap/', { params: { days: period } }),
        api.get('/analytics/scheduling/best-times/', { params: { days: period } }),
        api.get('/analytics/scheduling/by-day/', { params: { days: period } }),
      ]);

      setHeatmapData(heatmapRes.status === 'fulfilled' ? (Array.isArray(heatmapRes.value.data) ? heatmapRes.value.data : []) : []);
      setBestTimes(bestTimesRes.status === 'fulfilled' ? (Array.isArray(bestTimesRes.value.data) ? bestTimesRes.value.data : []) : []);
      setDayData(dayRes.status === 'fulfilled' ? (Array.isArray(dayRes.value.data) ? dayRes.value.data : []) : []);
    } catch (err) {
      setError(err.message);
      showToast?.('Failed to load scheduling data', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="sched-loading">
        <i className="fas fa-spinner fa-spin" />
        <span>Loading scheduling analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sched-error">
        <i className="fas fa-exclamation-triangle" />
        <span>{error}</span>
        <button onClick={fetchSchedulingData}>Retry</button>
      </div>
    );
  }

  return (
    <div className="sched-container">
      <div className="sched-header">
        <h2>
          <i className="fas fa-calendar-alt" />
          Scheduling Analytics
        </h2>
        <div className="sched-period-selector">
          <button className={period === 7 ? 'sched-active' : ''} onClick={() => setPeriod(7)}>7 Days</button>
          <button className={period === 30 ? 'sched-active' : ''} onClick={() => setPeriod(30)}>30 Days</button>
          <button className={period === 90 ? 'sched-active' : ''} onClick={() => setPeriod(90)}>90 Days</button>
        </div>
      </div>

      {/* Recommendations */}
      <PostingRecommendations bestTimes={bestTimes} dayData={dayData} />

      {/* Best Times */}
      <BestTimesCard times={bestTimes.slice(0, 5)} />

      {/* Engagement Heatmap */}
      <div className="sched-section">
        <h3>
          <i className="fas fa-fire" />
          Engagement by Time
        </h3>
        <EngagementHeatmap data={heatmapData} />
      </div>

      {/* Day Comparison */}
      <div className="sched-section">
        <h3>
          <i className="fas fa-chart-bar" />
          Performance by Day
        </h3>
        <DayComparisonChart data={dayData} />
      </div>
    </div>
  );
}
