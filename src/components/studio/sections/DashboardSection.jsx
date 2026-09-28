/**
 * src/components/studio/sections/DashboardSection.jsx
 *
 * Dashboard section — the main landing view for creators. Composed of:
 *   - WelcomeHeader (personalized greeting)
 *   - WelcomeBanner (new creator onboarding)
 *   - QuickActions (one-click create)
 *   - StatusSummary (real per-area business status — products, orders,
 *     courses, messages)
 *   - KPI stat grid (revenue, orders, students, rating, views, followers)
 *   - Mini revenue trend chart
 *   - Creator Economy row (Progression + Goals + Daily Center)
 *
 * Extracted from CreatorStudio.jsx during Etap 2 refactor.
 */
import React, { useEffect, useState } from 'react';
import api, {
  analyticsService,
} from '../../../services/api';
import DailyCreatorCenter from '../DailyCreatorCenter';
import CreatorProgression from '../CreatorProgression';
import CreatorGoals from '../CreatorGoals';
import CourseOverview from './CourseOverview';
import {
  StatCard,
  StudioSkeleton,
  WelcomeHeader,
  QuickActions,
  StatusSummary,
  fmtCurrency,
  fmtCount,
} from '../shared';
import styles from './sections.module.css';

export default function DashboardSection({
  lang,
  t,
  showToast,
  setShowCourseModal,
  setShowProductModal,
  setShowProjectModal,
  setActiveSection,
  user,
  profileData,
}) {
  const [summary, setSummary] = useState(null);
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      analyticsService.summary(),
      analyticsService.revenueTrend(7),
    ]).then(([sumRes, revRes]) => {
      if (cancelled) return;
      setSummary(sumRes.status === 'fulfilled' ? sumRes.value.data : null);
      setRevenueTrend(
        revRes.status === 'fulfilled'
          ? (Array.isArray(revRes.value.data) ? revRes.value.data : [])
          : []
      );
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <StudioSkeleton rows={6} />;

  const stats = [
    { key: 'revenue', icon: 'fa-dollar-sign', label: t.studio_revenue || 'Revenue', value: summary?.total_revenue, formatter: fmtCurrency, accent: 'emerald' },
    { key: 'orders', icon: 'fa-shopping-cart', label: t.studio_orders || 'Orders', value: summary?.total_orders, accent: 'sky' },
    { key: 'students', icon: 'fa-user-graduate', label: t.studio_students || 'Students', value: summary?.total_products_sold, accent: 'violet' },
    { key: 'rating', icon: 'fa-star', label: t.studio_rating || 'Avg Rating', value: summary?.avg_rating, formatter: (v) => v != null ? `${Number(v).toFixed(1)} ⭐` : '—', accent: 'amber', subtitle: `${fmtCount(summary?.total_reviews)} ${t.studio_reviews || 'reviews'}` },
    { key: 'views', icon: 'fa-eye', label: t.studio_views || 'Portfolio Views', value: summary?.portfolio_views, accent: 'pink' },
    { key: 'followers', icon: 'fa-users', label: t.studio_followers || 'Community', value: summary?.community_members, accent: 'teal' },
  ];

  const isNewCreator = summary && !summary.total_revenue && !summary.total_orders;

  return (
    <div className={`${styles.section} studio-dashboard`}>
      {/* Welcome Header */}
      <WelcomeHeader lang={lang} user={user || {}} summary={summary} avatarUrl={profileData?.avatar_url || null} />

      {/* Welcome banner for new creators */}
      {isNewCreator && (
        <div className={styles.welcomeBanner}>
          <i className="fas fa-rocket" aria-hidden="true" />
          <div>
            <strong>
              {t.studio_welcome || 'Welcome to your Studio!'}
            </strong>
            <p>
              {t.studio_welcome_hint || 'Start creating content — your dashboard will populate with insights as you grow.'}
            </p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <QuickActions
        lang={lang}
        setActiveSection={setActiveSection}
        setShowCourseModal={setShowCourseModal}
        setShowProductModal={setShowProductModal}
        setShowProjectModal={setShowProjectModal}
        showToast={showToast}
      />

      {/* Course Overview — course metrics + top performers */}
      <CourseOverview lang={lang} onNavigate={setActiveSection} />

      {/* Real business status — what needs attention (self-fetching) */}
      <StatusSummary lang={lang} onNavigate={setActiveSection} />

      <h2 className={styles.sectionTitle}>
        <i className="fas fa-gauge-high" aria-hidden="true" />
        {t.studio_overview || 'Overview'}
      </h2>

      <div className={styles.statGrid}>
        {stats.map((s) => <StatCard key={s.key} {...s} />)}
      </div>

      {/* Mini revenue trend */}
      {revenueTrend.length > 0 && (
        <div className={styles.miniChart}>
          <h3 className={styles.sectionSubtitle}>
            <i className="fas fa-chart-bar" aria-hidden="true" />
            {t.studio_revenue_trend || 'Revenue (7 days)'}
          </h3>
          <div className={styles.miniBars}>
            {revenueTrend.map((d, i) => {
              const maxVal = Math.max(...revenueTrend.map((x) => x.revenue || 0), 1);
              const h = Math.max(4, ((d.revenue || 0) / maxVal) * 80);
              return (
                <div
                  key={d.date || i}
                  className={styles.miniBarWrap}
                  title={`${d.date}: ${fmtCurrency(d.revenue)}`}
                >
                  <div className={styles.miniBar} style={{ height: h }} />
                  <span className={styles.miniBarLabel}>
                    {String(d.date || '').slice(-5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Creator Economy: Progression + Goals + Daily Center */}
      <div className={styles.ceRow}>
        <div className={styles.ceLeft}>
          <CreatorProgression lang={lang} showToast={showToast} compact />
          <CreatorGoals lang={lang} showToast={showToast} />
        </div>
        <div>
          <DailyCreatorCenter lang={lang} showToast={showToast} apiGet={api.get} />
        </div>
      </div>
    </div>
  );
}
