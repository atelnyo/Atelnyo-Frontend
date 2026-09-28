/**
 * src/components/creator/ContentPerformance.jsx
 *
 * Content Performance Analytics for Creators.
 * Shows detailed metrics for each piece of content, helping creators
 * understand what performs best and optimize their content strategy.
 *
 * Features:
 *   - Per-content metrics (views, clicks, saves, engagement rate)
 *   - Performance comparison across content types
 *   - Trend analysis (is content improving over time?)
 *   - Best performing content highlights
 *   - Content recommendations based on performance
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

function formatPercent(n) {
  if (n == null) return '0%';
  return `${n.toFixed(1)}%`;
}

function getPerformanceGrade(engagementRate) {
  if (engagementRate >= 10) return { grade: 'A+', color: '#10b981', label: 'Excellent' };
  if (engagementRate >= 7) return { grade: 'A', color: '#22c55e', label: 'Great' };
  if (engagementRate >= 5) return { grade: 'B', color: '#84cc16', label: 'Good' };
  if (engagementRate >= 3) return { grade: 'C', color: '#eab308', label: 'Average' };
  if (engagementRate >= 1) return { grade: 'D', color: '#f97316', label: 'Below Average' };
  return { grade: 'F', color: '#ef4444', label: 'Needs Improvement' };
}

// ─── Content Card ──────────────────────────────────────────────────

function ContentCard({ item, type, onClick }) {
  const engagementRate = item.impressions > 0
    ? ((item.clicks + item.saves) / item.impressions * 100)
    : 0;
  const grade = getPerformanceGrade(engagementRate);

  const typeIcons = {
    course: 'fa-graduation-cap',
    music: 'fa-music',
    talent: 'fa-user',
    product: 'fa-shopping-bag',
    event: 'fa-calendar',
    job: 'fa-briefcase',
    community: 'fa-users',
    portfolio: 'fa-palette',
  };

  return (
    <div className="cp-content-card" onClick={() => onClick?.(item)}>
      <div className="cp-card-header">
        <div className="cp-card-type">
          <i className={`fas ${typeIcons[type] || 'fa-file'}`} />
          <span>{type}</span>
        </div>
        <div className="cp-card-grade" style={{ color: grade.color }}>
          {grade.grade}
        </div>
      </div>

      <div className="cp-card-title">
        {item.title || item.name || `#${item.id}`}
      </div>

      <div className="cp-card-metrics">
        <div className="cp-metric">
          <span className="cp-metric-value">{formatNumber(item.impressions)}</span>
          <span className="cp-metric-label">Views</span>
        </div>
        <div className="cp-metric">
          <span className="cp-metric-value">{formatNumber(item.clicks)}</span>
          <span className="cp-metric-label">Clicks</span>
        </div>
        <div className="cp-metric">
          <span className="cp-metric-value">{formatNumber(item.saves)}</span>
          <span className="cp-metric-label">Saves</span>
        </div>
        <div className="cp-metric">
          <span className="cp-metric-value" style={{ color: grade.color }}>
            {formatPercent(engagementRate)}
          </span>
          <span className="cp-metric-label">Engagement</span>
        </div>
      </div>

      <div className="cp-card-bar">
        <div
          className="cp-card-bar-fill"
          style={{
            width: `${Math.min(100, engagementRate * 10)}%`,
            background: grade.color,
          }}
        />
      </div>
    </div>
  );
}

// ─── Performance Summary ───────────────────────────────────────────

function PerformanceSummary({ data }) {
  const totalImpressions = data.reduce((sum, d) => sum + (d.impressions || 0), 0);
  const totalClicks = data.reduce((sum, d) => sum + (d.clicks || 0), 0);
  const totalSaves = data.reduce((sum, d) => sum + (d.saves || 0), 0);
  const avgEngagement = totalImpressions > 0
    ? ((totalClicks + totalSaves) / totalImpressions * 100)
    : 0;
  const grade = getPerformanceGrade(avgEngagement);

  return (
    <div className="cp-summary">
      <div className="cp-summary-card cp-summary-main">
        <div className="cp-summary-grade" style={{ color: grade.color }}>
          {grade.grade}
        </div>
        <div className="cp-summary-label">{grade.label}</div>
        <div className="cp-summary-subtitle">Overall Performance</div>
      </div>

      <div className="cp-summary-card">
        <div className="cp-summary-value">{formatNumber(totalImpressions)}</div>
        <div className="cp-summary-label">Total Views</div>
      </div>

      <div className="cp-summary-card">
        <div className="cp-summary-value">{formatNumber(totalClicks)}</div>
        <div className="cp-summary-label">Total Clicks</div>
      </div>

      <div className="cp-summary-card">
        <div className="cp-summary-value">{formatNumber(totalSaves)}</div>
        <div className="cp-summary-label">Total Saves</div>
      </div>

      <div className="cp-summary-card">
        <div className="cp-summary-value">{formatPercent(avgEngagement)}</div>
        <div className="cp-summary-label">Avg Engagement</div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────

export default function ContentPerformance({ lang = 'ht', showToast, user }) {
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('engagement');
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    fetchContent();
  }, [filter]);

  const fetchContent = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch analytics for different content types
      const endpoints = [
        'analytics/content/courses/',
        'analytics/content/music/',
        'analytics/content/products/',
        'analytics/content/portfolio/',
      ];

      const results = await Promise.allSettled(
        endpoints.map(url => api.get(url))
      );

      const allContent = [];
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          const type = ['course', 'music', 'product', 'portfolio'][idx];
          const items = Array.isArray(result.value.data) ? result.value.data : [];
          items.forEach(item => {
            allContent.push({ ...item, content_type: type });
          });
        }
      });

      setContent(allContent);
    } catch (err) {
      setError(err.message);
      showToast?.('Failed to load content analytics', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort content
  const filteredContent = useMemo(() => {
    let filtered = content;

    // Apply filter
    if (filter !== 'all') {
      filtered = filtered.filter(item => item.content_type === filter);
    }

    // Apply sort
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'engagement': {
          const rateA = a.impressions > 0 ? (a.clicks + a.saves) / a.impressions : 0;
          const rateB = b.impressions > 0 ? (b.clicks + b.saves) / b.impressions : 0;
          return rateB - rateA;
        }
        case 'views':
          return (b.impressions || 0) - (a.impressions || 0);
        case 'clicks':
          return (b.clicks || 0) - (a.clicks || 0);
        case 'saves':
          return (b.saves || 0) - (a.saves || 0);
        case 'newest':
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        default:
          return 0;
      }
    });
  }, [content, filter, sortBy]);

  // Get top performers
  const topPerformers = useMemo(() => {
    return filteredContent.slice(0, 5);
  }, [filteredContent]);

  // Get content type distribution
  const typeDistribution = useMemo(() => {
    const dist = {};
    content.forEach(item => {
      dist[item.content_type] = (dist[item.content_type] || 0) + 1;
    });
    return dist;
  }, [content]);

  if (loading) {
    return (
      <div className="cp-loading">
        <i className="fas fa-spinner fa-spin" />
        <span>Loading content analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cp-error">
        <i className="fas fa-exclamation-triangle" />
        <span>{error}</span>
        <button onClick={fetchContent}>Retry</button>
      </div>
    );
  }

  return (
    <div className="cp-container">
      <div className="cp-header">
        <h2>
          <i className="fas fa-chart-bar" />
          Content Performance
        </h2>
        <p className="cp-subtitle">
          {lang === 'ht'
            ? 'Analize kijan kontni ou ap fè'
            : 'Analyze how your content is performing'}
        </p>
      </div>

      {/* Performance Summary */}
      <PerformanceSummary data={content} />

      {/* Filters */}
      <div className="cp-filters">
        <div className="cp-filter-group">
          <label>Type:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Content ({content.length})</option>
            <option value="course">Courses ({typeDistribution.course || 0})</option>
            <option value="music">Music ({typeDistribution.music || 0})</option>
            <option value="product">Products ({typeDistribution.product || 0})</option>
            <option value="portfolio">Portfolio ({typeDistribution.portfolio || 0})</option>
          </select>
        </div>

        <div className="cp-filter-group">
          <label>Sort by:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="engagement">Engagement Rate</option>
            <option value="views">Views</option>
            <option value="clicks">Clicks</option>
            <option value="saves">Saves</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {/* Top Performers */}
      {topPerformers.length > 0 && (
        <div className="cp-section">
          <h3>
            <i className="fas fa-trophy" />
            Top Performers
          </h3>
          <div className="cp-top-performers">
            {topPerformers.map((item, idx) => (
              <div key={item.id || idx} className="cp-top-item">
                <span className="cp-top-rank">#{idx + 1}</span>
                <span className="cp-top-title">{item.title || item.name}</span>
                <span className="cp-top-type">{item.content_type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Grid */}
      <div className="cp-section">
        <h3>
          <i className="fas fa-th-large" />
          All Content ({filteredContent.length})
        </h3>
        <div className="cp-content-grid">
          {filteredContent.map((item, idx) => (
            <ContentCard
              key={item.id || idx}
              item={item}
              type={item.content_type}
              onClick={setSelectedItem}
            />
          ))}
        </div>

        {filteredContent.length === 0 && (
          <div className="cp-empty">
            <i className="fas fa-inbox" />
            <p>No content found</p>
          </div>
        )}
      </div>

      {/* Content Detail Modal */}
      {selectedItem && (
        <div className="cp-modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="cp-modal" onClick={(e) => e.stopPropagation()}>
            <button className="cp-modal-close" onClick={() => setSelectedItem(null)}>
              <i className="fas fa-times" />
            </button>
            <h3>{selectedItem.title || selectedItem.name}</h3>
            <div className="cp-modal-content">
              <div className="cp-modal-stats">
                <div className="cp-modal-stat">
                  <span className="cp-modal-stat-value">{formatNumber(selectedItem.impressions)}</span>
                  <span className="cp-modal-stat-label">Views</span>
                </div>
                <div className="cp-modal-stat">
                  <span className="cp-modal-stat-value">{formatNumber(selectedItem.clicks)}</span>
                  <span className="cp-modal-stat-label">Clicks</span>
                </div>
                <div className="cp-modal-stat">
                  <span className="cp-modal-stat-value">{formatNumber(selectedItem.saves)}</span>
                  <span className="cp-modal-stat-label">Saves</span>
                </div>
              </div>
              <div className="cp-modal-recommendations">
                <h4>Recommendations</h4>
                <ul>
                  {selectedItem.impressions < 100 && (
                    <li>Your content needs more visibility. Consider sharing it on social media.</li>
                  )}
                  {selectedItem.clicks / selectedItem.impressions < 0.05 && (
                    <li>Low click-through rate. Try improving your thumbnail or title.</li>
                  )}
                  {selectedItem.saves / selectedItem.impressions < 0.01 && (
                    <li>Low save rate. Add more value to encourage saves.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
