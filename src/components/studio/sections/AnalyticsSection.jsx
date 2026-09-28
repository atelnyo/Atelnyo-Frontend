/**
 * src/components/studio/sections/AnalyticsSection.jsx
 *
 * Analytics section — KPIs grid, period selector, revenue bar chart (SVG),
 * engagement scatter chart (SVG), top products table, and audience breakdown.
 *
 * Extracted from CreatorStudio.jsx during Etap 2 refactor.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { analyticsService, courseService } from '../../../services/api';
import { StudioSkeleton, StatCard, SectionHeader, fmtCurrency, fmtCount } from '../shared';
import styles from './sections.module.css';

export default function AnalyticsSection({ lang, t, showToast }) {
  const [summary, setSummary] = useState(null);
  const [learningOverview, setLearningOverview] = useState(null);
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [engagementTrend, setEngagementTrend] = useState([]);
  const [viewTrend, setViewTrend] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [audience, setAudience] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [sumRes, revRes, engRes, viewsRes, prodRes, audRes, learningRes] = await Promise.allSettled([
      analyticsService.summary(),
      analyticsService.revenueTrend(period),
      analyticsService.engagementTrend(period),
      analyticsService.viewTrend(period),
      analyticsService.topProducts(),
      analyticsService.audience(),
      courseService.getCreatorOverview(period),
    ]);
    setSummary(sumRes.status === 'fulfilled' ? sumRes.value.data : null);
    setRevenueTrend(
      revRes.status === 'fulfilled'
        ? (Array.isArray(revRes.value.data) ? revRes.value.data : [])
        : []
    );
    setEngagementTrend(
      engRes.status === 'fulfilled'
        ? (Array.isArray(engRes.value.data) ? engRes.value.data : [])
        : []
    );
    setViewTrend(
      viewsRes.status === 'fulfilled'
        ? (Array.isArray(viewsRes.value.data) ? viewsRes.value.data : [])
        : []
    );
    setTopProducts(
      prodRes.status === 'fulfilled'
        ? (Array.isArray(prodRes.value.data) ? prodRes.value.data : [])
        : []
    );
    setAudience(
      audRes.status === 'fulfilled' ? audRes.value.data : null
    );
    setLearningOverview(
      learningRes.status === 'fulfilled' ? learningRes.value.data : null
    );
    setLoading(false);
  }, [period]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading && !summary) return <StudioSkeleton rows={6} />;

  const kpis = summary ? [
    { key: 'revenue', icon: 'fa-dollar-sign', label: t.studio_revenue || 'Revenue', value: summary.total_revenue, formatter: fmtCurrency, accent: 'emerald' },
    { key: 'orders', icon: 'fa-shopping-cart', label: t.studio_orders || 'Orders', value: summary.total_orders, accent: 'sky' },
    { key: 'products_sold', icon: 'fa-box', label: t.studio_sold || 'Sold', value: summary.total_products_sold, accent: 'violet' },
    { key: 'rating', icon: 'fa-star', label: t.studio_rating || 'Rating', value: summary.avg_rating, formatter: (v) => v != null ? `${Number(v).toFixed(1)} ⭐` : '—', accent: 'amber', subtitle: `${fmtCount(summary.total_reviews)} reviews` },
    { key: 'proposals', icon: 'fa-file-signature', label: t.studio_proposals || 'Proposals', value: summary.proposals_submitted, accent: 'indigo' },
    { key: 'contracts', icon: 'fa-handshake', label: t.studio_contracts || 'Contracts', value: summary.contracts_completed, accent: 'cyan' },
    { key: 'portfolio', icon: 'fa-eye', label: t.studio_views || 'Views', value: summary.portfolio_views, accent: 'pink' },
    { key: 'community', icon: 'fa-users', label: t.studio_members || 'Members', value: summary.community_members, accent: 'teal' },
  ] : [];

  const learningCourses = Array.isArray(learningOverview?.courses)
    ? learningOverview.courses
    : Array.isArray(learningOverview?.course_metrics)
      ? learningOverview.course_metrics
      : [];
  const learningStats = learningOverview ? [
    { key: 'learners', icon: 'fa-user-graduate', label: 'Active learners', value: learningOverview.active_learners ?? learningOverview.total_active_learners ?? learningOverview.total_learners ?? 0, accent: 'sky' },
    { key: 'courses', icon: 'fa-book-open', label: 'Courses tracked', value: learningOverview.total_courses ?? learningOverview.course_count ?? learningCourses.length ?? 0, accent: 'violet' },
    { key: 'completion', icon: 'fa-chart-pie', label: 'Completion rate', value: learningOverview.completion_rate ?? learningOverview.avg_completion_rate ?? 0, formatter: (v) => `${Number(v || 0).toFixed(1)}%`, accent: 'emerald' },
    { key: 'dropoff', icon: 'fa-circle-exclamation', label: 'Signals flagged', value: learningOverview.alert_count ?? learningOverview.review_items ?? learningOverview.issues_count ?? 0, accent: 'amber' },
  ] : [];

  return (
    <div className={styles.section}>
      <SectionHeader
        icon="fa-chart-line"
        title={t.studio_analytics || 'Analytics'}
        lang={lang}
        help={{
          ht: 'KPIs, revni ak angajman ou sou 7, 30 oswa 90 jou. Sèvi ak peryòd la pou wè evolisyon, ak tablo yo pou konprann kisa ki mache.',
          en: 'Your KPIs, revenue and engagement over 7, 30 or 90 days. Use the period selector to watch trends, and the charts to understand what is working.',
        }}
        tip={lang === 'ht'
          ? 'Done yo ap mete ajou chak jou — tcheke peryòd 90 jou pou wè tandans reyèl yo.'
          : 'Data refreshes daily — check the 90-day window for real trends.'}
        action={
          <div className={styles.periodGroup}>
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                className={`${styles.periodBtn} ${period === d ? styles.periodBtnActive : ''}`}
                onClick={() => setPeriod(d)}
              >
                {d}d
              </button>
            ))}
            <button
              type="button"
              className={styles.refreshBtn}
              onClick={fetchAll}
              title="Refresh"
            >
              <i className="fas fa-rotate" />
            </button>
          </div>
        }
      />

      <div className={styles.statGrid}>
        {kpis.map((k) => <StatCard key={k.key} {...k} />)}
      </div>

      {/* Profile Views evolution (30d) — full-width, the flagship metric */}
      {viewTrend.length > 0 && (
        <div className={styles.chartBox} style={{ marginTop: 'var(--sp-4xl)' }}>
          <h3 className={styles.sectionSubtitle}>
            <i className="fas fa-eye" aria-hidden="true" />
            {t.studio_views_trend || 'Profile Views'} ({period}d)
          </h3>
          <svg
            className={styles.chartSvg}
            viewBox={`0 0 ${Math.max(300, viewTrend.length * 30)} 140`}
            preserveAspectRatio="xMidYMid meet"
            aria-label="Profile views chart"
          >
            {viewTrend.map((d, i) => {
              const maxVal = Math.max(...viewTrend.map((x) => x.count || 0), 1);
              const h = Math.max(2, ((d.count || 0) / maxVal) * 110);
              const x = i * Math.max(6, Math.floor(300 / viewTrend.length));
              return (
                <g key={d.date || i}>
                  <rect
                    x={x}
                    y={130 - h}
                    width={Math.max(4, x * 0.6)}
                    height={h}
                    rx={2}
                    fill="var(--violet, #8b5cf6)"
                    opacity={0.7 + ((d.count || 0) / maxVal) * 0.3}
                  >
                    <title>{d.date}: {fmtCount(d.count)} {t.studio_views || 'views'}</title>
                  </rect>
                  {i % 5 === 0 && (
                    <text
                      x={x}
                      y={140}
                      textAnchor="middle"
                      fontSize="8"
                      fill="var(--text-tertiary, #94a3b8)"
                    >
                      {String(d.date || '').slice(5)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <div className={styles.chartLegend}>
            <span>
              <span className={styles.legendDot} style={{ background: 'var(--violet, #8b5cf6)' }} />
              {' '}
              {t.studio_views_total || 'Total views in window'}: {fmtCount(viewTrend.reduce((s, p) => s + (p.count || 0), 0))}
            </span>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className={styles.chartsRow}>
        {revenueTrend.length > 0 && (
          <div className={styles.chartBox}>
            <h3 className={styles.sectionSubtitle}>
              <i className="fas fa-chart-bar" aria-hidden="true" />
              {t.studio_revenue_trend || 'Revenue'} ({period}d)
            </h3>
            <svg
              className={styles.chartSvg}
              viewBox={`0 0 ${Math.max(300, revenueTrend.length * 30)} 140`}
              preserveAspectRatio="xMidYMid meet"
              aria-label="Revenue chart"
            >
              {revenueTrend.map((d, i) => {
                const maxVal = Math.max(...revenueTrend.map((x) => x.revenue || 0), 1);
                const h = Math.max(2, ((d.revenue || 0) / maxVal) * 110);
                const x = i * Math.max(6, Math.floor(300 / revenueTrend.length));
                return (
                  <rect
                    key={d.date || i}
                    x={x}
                    y={130 - h}
                    width={Math.max(4, x * 0.6)}
                    height={h}
                    rx={2}
                    fill="var(--pink-primary, #d81b60)"
                    opacity={0.7 + ((d.revenue || 0) / maxVal) * 0.3}
                  >
                    <title>{d.date}: {fmtCurrency(d.revenue)}</title>
                  </rect>
                );
              })}
            </svg>
          </div>
        )}
        {engagementTrend.length > 0 && (
          <div className={styles.chartBox}>
            <h3 className={styles.sectionSubtitle}>
              <i className="fas fa-chart-line" aria-hidden="true" />
              {t.studio_engagement || 'Engagement'} ({period}d)
            </h3>
            <svg
              className={styles.chartSvg}
              viewBox={`0 0 ${Math.max(300, engagementTrend.length * 30)} 140`}
              preserveAspectRatio="xMidYMid meet"
              aria-label="Engagement chart"
            >
              {engagementTrend.map((d, i) => {
                const maxVal = Math.max(
                  ...engagementTrend.map((x) => Math.max(x.impressions || 0, x.clicks || 0)),
                  1
                );
                const x = (i / Math.max(engagementTrend.length - 1, 1)) * Math.max(300, engagementTrend.length * 30);
                const yI = 130 - ((d.impressions || 0) / maxVal) * 110;
                const yC = 130 - ((d.clicks || 0) / maxVal) * 110;
                return (
                  <g key={d.date || i}>
                    <circle cx={x} cy={yI} r={3} fill="var(--sky, #38bdf8)" opacity={0.8}>
                      <title>Impressions {d.date}: {fmtCount(d.impressions)}</title>
                    </circle>
                    <circle cx={x} cy={yC} r={3} fill="var(--pink-primary, #d81b60)" opacity={0.8}>
                      <title>Clicks {d.date}: {fmtCount(d.clicks)}</title>
                    </circle>
                  </g>
                );
              })}
            </svg>
            <div className={styles.chartLegend}>
              <span>
                <span className={styles.legendDot} style={{ background: 'var(--sky, #38bdf8)' }} />
                {' '}Impressions
              </span>
              <span>
                <span className={styles.legendDot} style={{ background: 'var(--pink-primary, #d81b60)' }} />
                {' '}Clicks
              </span>
            </div>
          </div>
        )}
      </div>

      {learningOverview && (
        <div className={styles.chartBox} style={{ marginTop: 'var(--sp-4xl)' }}>
          <h3 className={styles.sectionSubtitle}>
            <i className="fas fa-graduation-cap" aria-hidden="true" />
            Learning insights
          </h3>
          <div className={styles.statGrid} style={{ marginTop: 16, marginBottom: 16 }}>
            {learningStats.map((item) => (
              <StatCard
                key={item.key}
                icon={item.icon}
                label={item.label}
                value={item.value}
                formatter={item.formatter}
                accent={item.accent}
              />
            ))}
          </div>
          {learningCourses.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Students</th>
                    <th>Completion</th>
                    <th>Signals</th>
                  </tr>
                </thead>
                <tbody>
                  {learningCourses.slice(0, 6).map((course, idx) => {
                    const title = course.title || course.name || `Course ${idx + 1}`;
                    const learners = course.active_learners ?? course.total_learners ?? course.learners ?? 0;
                    const completion = course.completion_rate ?? course.avg_completion_rate ?? course.progress_rate ?? 0;
                    const signalCount = course.alert_count ?? course.issues_count ?? course.flags ?? 0;
                    return (
                      <tr key={course.id || course.slug || `${title}-${idx}`}>
                        <td className={styles.cellName}>{title}</td>
                        <td>{fmtCount(learners)}</td>
                        <td>{Number(completion || 0).toFixed(1)}%</td>
                        <td>{fmtCount(signalCount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Top Products */}
      {topProducts.length > 0 && (
        <div className={styles.chartBox} style={{ marginTop: 'var(--sp-4xl)' }}>
          <h3 className={styles.sectionSubtitle}>
            <i className="fas fa-crown" aria-hidden="true" />
            {t.studio_top_products || 'Top Products'}
          </h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t.studio_product || 'Product'}</th>
                  <th>{t.studio_price || 'Price'}</th>
                  <th>{t.studio_sold || 'Sold'}</th>
                  <th>{t.studio_rating || 'Rating'}</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.id}>
                    <td className={styles.cellName}>{p.title}</td>
                    <td>{fmtCurrency(p.price)}</td>
                    <td>{fmtCount(p.sales_count)}</td>
                    <td>
                      <i className="fas fa-star" style={{ color: 'var(--amber, #f59e0b)', marginRight: 4 }} />
                      {p.avg_rating?.toFixed(1) || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audience */}
      {audience && (
        <div className={styles.chartBox} style={{ marginTop: 'var(--sp-4xl)' }}>
          <h3 className={styles.sectionSubtitle}>
            <i className="fas fa-people-group" aria-hidden="true" />
            {t.studio_audience || 'Your Audience'}
          </h3>
          <div className={styles.audience}>
            <div className={styles.audienceItem}>
              <i className="fas fa-shopping-cart" aria-hidden="true" />
              <strong>{fmtCount(audience.unique_buyers)}</strong>
              <span>{t.studio_buyers || 'Unique buyers'}</span>
            </div>
            <div className={styles.audienceItem}>
              <i className="fas fa-thumbs-up" aria-hidden="true" />
              <strong>{fmtCount(audience.unique_endorsers)}</strong>
              <span>{t.studio_endorsers || 'Endorsers'}</span>
            </div>
            <div className={styles.audienceItem}>
              <i className="fas fa-users" aria-hidden="true" />
              <strong>{fmtCount(audience.community_followers)}</strong>
              <span>{t.studio_followers || 'Community followers'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
