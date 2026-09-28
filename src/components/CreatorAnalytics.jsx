/**
 * src/components/CreatorAnalytics.jsx
 *
 * Phase 38 — Creator Analytics Dashboard.
 *
 * Personal revenue + engagement dashboard for creators (sellers,
 * freelancers, event hosts, community owners). Backed by
 * GET /api/analytics/summary/ + trend/top_products/audience.
 *
 * Sections:
 *   • KPI cards — revenue, orders, products sold, avg rating,
 *     proposals, contracts, portfolio views, community members
 *   • Revenue trend — 30-day SVG bar chart
 *   • Engagement trend — 30-day SVG line chart
 *   • Top products — best-selling table
 *   • Audience — unique buyers, endorsers, community followers
 *
 * Zero-library charting: lightweight SVG bars/lines, no chart.js
 * dependency. Dark-mode + reduced-motion handled via CSS vars.
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { analyticsService, creatorProfileService } from '../services/api';
import { getUserIdentity } from '../utils/userIdentity';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtCurrency(n) {
  if (n == null || !Number.isFinite(Number(n))) return '$0';
  const v = Number(n);
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function fmtCount(n) {
  if (n == null || !Number.isFinite(Number(n))) return '0';
  return Number(n).toLocaleString();
}

function fmtRating(n) {
  if (n == null) return '—';
  return Number(n).toFixed(1);
}

// ─── KPI card ───────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, accent, formatter, subtitle }) {
  return (
    <article className="ca-card" data-accent={accent || 'default'}>
      <div className="ca-card-icon" aria-hidden="true">
        <i className={`fas ${icon}`} />
      </div>
      <div className="ca-card-body">
        <div className="ca-card-label">{label}</div>
        <div className="ca-card-value">
          {formatter ? formatter(value) : fmtCount(value)}
        </div>
        {subtitle && <div className="ca-card-subtitle">{subtitle}</div>}
      </div>
    </article>
  );
}

// ─── SVG Bar Chart (Revenue trend + Profile Views evolution) ────────────────
// One chart component, parameterized by which series key to read — reuse
// over a near-identical duplicate. Defaults reproduce the original revenue
// behavior exactly; the views chart passes valueKey="count", a violet fill,
// and labelEvery=5 (a 30-point series can't label every bar).

function BarChart({
  data,
  height = 180,
  valueKey = 'revenue',
  color = 'var(--pink-primary, #d81b60)',
  labelEvery = null,
  emptyText = 'No revenue data yet',
  formatValue = null,
}) {
  if (!data || data.length === 0) {
    return <div className="ca-chart-empty">{emptyText}</div>;
  }
  const maxVal = Math.max(...data.map((d) => d[valueKey] || 0), 1);
  const barW = Math.max(6, Math.floor(680 / data.length) - 2);
  const totalW = Math.max(300, data.length * (barW + 2));

  return (
    <svg
      className="ca-chart"
      viewBox={`0 0 ${totalW} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-label={`${valueKey} trend chart`}
      role="img"
    >
      {data.map((d, i) => {
        const val = d[valueKey] || 0;
        const h = Math.max(2, (val / maxVal) * (height - 30));
        const x = i * (barW + 2);
        const y = height - h - 20;
        const showLabel = data.length <= 15 || (labelEvery && i % labelEvery === 0);
        return (
          <g key={d.date || i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={3}
              className="ca-bar"
              fill={color}
              opacity={0.75 + (val / maxVal) * 0.25}
            >
              <title>{d.date}: {formatValue ? formatValue(val) : val}</title>
            </rect>
            {showLabel && (
              <text
                x={x + barW / 2}
                y={height - 4}
                textAnchor="middle"
                className="ca-chart-label"
                fontSize={data.length > 15 ? '8' : '9'}
              >
                {data.length <= 15 ? String(d.date || '').slice(-5) : String(d.date || '').slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── SVG Line Chart (Engagement trend) ──────────────────────────────────────

function LineChart({ data, height = 160 }) {
  if (!data || data.length === 0) {
    return <div className="ca-chart-empty">No engagement data yet</div>;
  }
  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.impressions || 0, d.clicks || 0, d.saves || 0)),
    1,
  );
  const totalW = Math.max(300, data.length * 30);

  function makePath(key) {
    if (data.length < 2) return '';
    const pts = data.map((d, i) => {
      const x = (i / (data.length - 1)) * totalW;
      const y = height - ((d[key] || 0) / maxVal) * (height - 30) - 15;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    });
    return pts.join(' ');
  }

  return (
    <svg
      className="ca-chart"
      viewBox={`0 0 ${totalW} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-label="Engagement trend chart"
      role="img"
    >
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((pct) => (
        <line
          key={pct}
          x1={0} y1={height - (maxVal * pct / maxVal) * (height - 30) - 15}
          x2={totalW} y2={height - (maxVal * pct / maxVal) * (height - 30) - 15}
          stroke="var(--border-color, #eee)"
          strokeDasharray="3,3"
          opacity={0.4}
        />
      ))}
      {/* Impressions line */}
      <path d={makePath('impressions')} fill="none" stroke="var(--sky, #38bdf8)" strokeWidth="2" opacity={0.8} />
      {/* Clicks line */}
      <path d={makePath('clicks')} fill="none" stroke="var(--pink-primary, #d81b60)" strokeWidth="2" opacity={0.9} />
      {/* Saves line */}
      <path d={makePath('saves')} fill="none" stroke="var(--emerald, #10b981)" strokeWidth="2" opacity={0.7} />
    </svg>
  );
}

// ─── Top Products table ─────────────────────────────────────────────────────

function TopProducts({ products }) {
  if (!products || products.length === 0) {
    return <div className="ca-empty">No products sold yet</div>;
  }
  return (
    <div className="ca-table-wrap">
      <table className="ca-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Price</th>
            <th>Sold</th>
            <th>Rating</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td className="ca-table-cell-name">{p.title}</td>
              <td>{fmtCurrency(p.price)}</td>
              <td>{fmtCount(p.sales_count)}</td>
              <td>
                <i className="fas fa-star" style={{ color: 'var(--amber, #f59e0b)', marginRight: 4 }} />
                {fmtRating(p.avg_rating)} ({p.review_count})
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Profile clicks (click_breakdown from /creator-profiles/<slug>/analytics/) ─

const CLICK_ICONS = {
  follow: 'fa-user-plus', share: 'fa-share-alt', copy_link: 'fa-link',
  message: 'fa-envelope', hire: 'fa-briefcase', collab: 'fa-handshake',
  course: 'fa-graduation-cap', product: 'fa-cube', portfolio: 'fa-briefcase',
  talent: 'fa-user-tie', music: 'fa-music', community: 'fa-users', job: 'fa-briefcase',
};

const TAB_LABELS = {
  dashboard: 'Dashboard', picks: 'Picks', courses: 'Courses', products: 'Products',
  portfolio: 'Portfolio', reviews: 'Reviews', about: 'About',
};

function humanizeClickKey(key) {
  if (key.startsWith('tab_')) {
    const tab = key.slice(4);
    return `${TAB_LABELS[tab] || tab} tab`;
  }
  const map = {
    follow: 'Follow', share: 'Share', copy_link: 'Copy link', message: 'Message',
    hire: 'Hire', collab: 'Collaborate', course: 'Course card', product: 'Product card',
    portfolio: 'Portfolio card', talent: 'Talent card', music: 'Music card',
    community: 'Community card', job: 'Job card', unknown: 'Other',
  };
  return map[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function clickIcon(key) {
  if (key.startsWith('tab_')) return 'fa-layer-group';
  return CLICK_ICONS[key] || 'fa-mouse-pointer';
}

function ClickBreakdown({ data }) {
  if (!data || !data.click_breakdown) return null;
  const entries = Object.entries(data.click_breakdown)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  const max = Math.max(...entries.map(([, c]) => c), 1);
  const total = data.total_clicks ?? entries.reduce((s, [, c]) => s + c, 0);

  return (
    <div className="ca-clicks">
      <div className="ca-clicks-total">
        <i className="fas fa-mouse-pointer" aria-hidden="true" />
        <strong>{fmtCount(total)}</strong>
        <span>total profile clicks</span>
      </div>
      <ul className="ca-clicks-list">
        {entries.map(([key, count]) => (
          <li key={key} className="ca-clicks-item">
            <i className={`fas ${clickIcon(key)} ca-clicks-item-icon`} aria-hidden="true" />
            <span className="ca-clicks-item-label">{humanizeClickKey(key)}</span>
            <span className="ca-clicks-item-bar">
              <span
                className="ca-clicks-item-fill"
                style={{ width: `${Math.max(4, (count / max) * 100)}%` }}
              />
            </span>
            <strong className="ca-clicks-item-count">{fmtCount(count)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Audience section ────────────────────────────────────────────────────────

function Audience({ audience }) {
  if (!audience) return null;
  return (
    <div className="ca-audience">
      <div className="ca-audience-item">
        <i className="fas fa-shopping-cart" />
        <strong>{fmtCount(audience.unique_buyers)}</strong>
        <span>Unique buyers</span>
      </div>
      <div className="ca-audience-item">
        <i className="fas fa-thumbs-up" />
        <strong>{fmtCount(audience.unique_endorsers)}</strong>
        <span>Endorsers</span>
      </div>
      <div className="ca-audience-item">
        <i className="fas fa-users" />
        <strong>{fmtCount(audience.community_followers)}</strong>
        <span>Community followers</span>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function CreatorAnalytics({ lang, showToast, user }) {
  const [summary, setSummary] = useState(null);
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [engagementTrend, setEngagementTrend] = useState([]);
  const [viewTrend, setViewTrend] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [audience, setAudience] = useState(null);
  const [clickData, setClickData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState(30);

  // Owner-scoped click breakdown lives on /creator-profiles/<slug>/analytics/
  // (public-profile action clicks tracked via /track-click/). Resolve the
  // owner's profile key from the logged-in user; absent → section hidden.
  const ownSlug = getUserIdentity(user).creatorLookupKey;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, revRes, engRes, viewsRes, prodRes, audRes, clickRes] = await Promise.allSettled([
        analyticsService.summary(),
        analyticsService.revenueTrend(period),
        analyticsService.engagementTrend(period),
        analyticsService.viewTrend(period),
        analyticsService.topProducts(),
        analyticsService.audience(),
        ownSlug ? creatorProfileService.analytics(ownSlug) : Promise.resolve(null),
      ]);
      setSummary(sumRes.status === 'fulfilled' ? sumRes.value.data : null);
      setRevenueTrend(revRes.status === 'fulfilled' ? (Array.isArray(revRes.value.data) ? revRes.value.data : []) : []);
      setEngagementTrend(engRes.status === 'fulfilled' ? (Array.isArray(engRes.value.data) ? engRes.value.data : []) : []);
      setViewTrend(viewsRes.status === 'fulfilled' ? (Array.isArray(viewsRes.value.data) ? viewsRes.value.data : []) : []);
      setTopProducts(prodRes.status === 'fulfilled' ? (Array.isArray(prodRes.value.data) ? prodRes.value.data : []) : []);
      setAudience(audRes.status === 'fulfilled' ? audRes.value.data : null);
      setClickData(clickRes.status === 'fulfilled' ? clickRes.value.data : null);
    } catch (err) {
      setError(err?.message || 'Failed to load analytics');
      showToast?.('Could not load analytics', 'circle-exclamation');
    } finally {
      setLoading(false);
    }
  }, [period, showToast, ownSlug]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const KPIS = useMemo(() => {
    if (!summary) return [];
    return [
      { key: 'revenue', icon: 'fa-dollar-sign', label: 'Total Revenue', value: summary.total_revenue, formatter: fmtCurrency, accent: 'emerald' },
      { key: 'orders', icon: 'fa-shopping-cart', label: 'Orders', value: summary.total_orders, accent: 'sky' },
      { key: 'products_sold', icon: 'fa-box', label: 'Products Sold', value: summary.total_products_sold, accent: 'violet' },
      { key: 'rating', icon: 'fa-star', label: 'Avg Rating', value: summary.avg_rating, formatter: (v) => `${fmtRating(v)} ⭐`, accent: 'amber', subtitle: `${summary.total_reviews} reviews` },
      { key: 'proposals', icon: 'fa-file-signature', label: 'Proposals', value: summary.proposals_submitted, accent: 'indigo', subtitle: `${summary.proposals_accepted} accepted` },
      { key: 'contracts', icon: 'fa-handshake', label: 'Contracts Done', value: summary.contracts_completed, accent: 'cyan' },
      { key: 'portfolio', icon: 'fa-eye', label: 'Portfolio Views', value: summary.portfolio_views, accent: 'pink' },
      { key: 'community', icon: 'fa-users', label: 'Community Members', value: summary.community_members, accent: 'teal' },
      { key: 'impressions', icon: 'fa-chart-simple', label: 'Impressions', value: summary.total_impressions, accent: 'slate' },
    ];
  }, [summary]);

  if (loading) {
    return (
      <div className="ca-loading">
        <i className="fas fa-spinner fa-spin" />
        <span>Loading analytics...</span>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="ca-error" role="alert">
        <i className="fas fa-triangle-exclamation" />
        <h3>Could not load analytics</h3>
        <p>{error}</p>
        <button type="button" className="ca-retry-btn" onClick={fetchAll}>
          <i className="fas fa-rotate-left" /> Retry
        </button>
      </div>
    );
  }

  const isNewCreator = summary && summary.total_revenue === 0
    && summary.total_orders === 0
    && summary.proposals_submitted === 0
    && summary.community_members === 0;

  return (
    <div className="creator-analytics">
      {/* Header */}
      <header className="ca-header">
        <div className="ca-header-title">
          <h1>
            <i className="fas fa-chart-pie" aria-hidden="true" />
            {' '}Creator Analytics
          </h1>
          <p>Your revenue, engagement, and growth — all in one place.</p>
        </div>
        <div className="ca-header-actions">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              className={`ca-period-btn ${period === d ? 'active' : ''}`}
              onClick={() => setPeriod(d)}
            >
              {d}d
            </button>
          ))}
          <button type="button" className="ca-refresh-btn" onClick={fetchAll} title="Refresh">
            <i className="fas fa-rotate" />
          </button>
        </div>
      </header>

      {/* New creator welcome */}
      {isNewCreator && (
        <div className="ca-welcome">
          <i className="fas fa-rocket" />
          <strong>Welcome, creator!</strong>
          <p>Start selling products, hosting events, or building communities — your analytics will populate here as you grow.</p>
        </div>
      )}

      {/* KPI Cards */}
      <section className="ca-section">
        <h2 className="ca-section-title">
          <i className="fas fa-gauge-high" /> Overview
        </h2>
        <div className="ca-kpi-grid">
          {KPIS.map((kpi) => (
            <KpiCard key={kpi.key} {...kpi} />
          ))}
        </div>
      </section>

      {/* Charts row */}
      <div className="ca-charts-row">
        <section className="ca-section ca-section-half">
          <h2 className="ca-section-title">
            <i className="fas fa-chart-bar" /> Revenue ({period}d)
          </h2>
        <div className="ca-chart-container">
          <BarChart data={revenueTrend} height={180} formatValue={fmtCurrency} />
        </div>
        </section>
        <section className="ca-section ca-section-half">
          <h2 className="ca-section-title">
            <i className="fas fa-chart-line" /> Engagement ({period}d)
          </h2>
          <div className="ca-chart-container">
            <LineChart data={engagementTrend} height={160} />
          </div>
          <div className="ca-chart-legend">
            <span className="ca-legend-dot" style={{ background: 'var(--sky, #38bdf8)' }} /> Impressions
            <span className="ca-legend-dot" style={{ background: 'var(--pink-primary, #d81b60)' }} /> Clicks
            <span className="ca-legend-dot" style={{ background: 'var(--emerald, #10b981)' }} /> Saves
          </div>
        </section>
      </div>

      {/* Profile Views evolution (same series as the studio AnalyticsSection) */}
      <section className="ca-section">
        <h2 className="ca-section-title">
          <i className="fas fa-eye" /> Profile Views ({period}d)
        </h2>
        <div className="ca-chart-container">
          <BarChart
            data={viewTrend}
            height={180}
            valueKey="count"
            color="var(--violet, #8b5cf6)"
            labelEvery={5}
            emptyText="No profile views yet"
            formatValue={fmtCount}
          />
        </div>
        <div className="ca-chart-legend">
          <span className="ca-legend-dot" style={{ background: 'var(--violet, #8b5cf6)' }} />
          {' '}Total views in window: {fmtCount(viewTrend.reduce((s, p) => s + (p.count || 0), 0))}
        </div>
      </section>

      {/* Profile clicks — button/tab breakdown from the public profile.
          Hidden until there is at least one recorded click. */}
      {clickData && (clickData.total_clicks || 0) > 0 && (
        <section className="ca-section">
          <h2 className="ca-section-title">
            <i className="fas fa-mouse-pointer" /> Profile Clicks
          </h2>
          <p className="ca-clicks-note">
            Clicks on your public profile (follow, share, tabs, catalog cards…).
            Best-effort, session-scoped analytics.
          </p>
          <ClickBreakdown data={clickData} />
        </section>
      )}

      {/* Top Products */}
      <section className="ca-section">
        <h2 className="ca-section-title">
          <i className="fas fa-crown" /> Top Products
        </h2>
        <TopProducts products={topProducts} />
      </section>

      {/* Audience */}
      {audience && (
        <section className="ca-section">
          <h2 className="ca-section-title">
            <i className="fas fa-people-group" /> Your Audience
          </h2>
          <Audience audience={audience} />
        </section>
      )}
    </div>
  );
}
