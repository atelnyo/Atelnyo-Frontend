/**
 * src/components/business/BusinessAnalyticsSection.jsx
 *
 * Business Analytics — the workspace dashboard tab.
 *
 * Built entirely on the EXISTING orders/revenue data (no new tables):
 * every aggregate is computed server-side by
 * ``GET /api/business/orders/analytics/?profile=<slug>`` (owner-only)
 * from the wallet-settled orders. Zero chart libraries — the monthly
 * revenue view is a lightweight CSS bar chart that matches the biz
 * design tokens (dark-mode + reduced-motion friendly).
 *
 * Data flow
 * ---------
 *   GET /api/business/orders/analytics/?profile=<slug> — owner dashboard
 *
 * Sections:
 *   • KPI cards — total revenue, paid orders, units sold, customers,
 *     avg order value
 *   • Revenue by month — CSS bar chart (one bar per currency bucket;
 *     mixed-currency shops show a bar per currency, no implicit FX)
 *   • Top selling items — ranked by revenue (snapshot names)
 *   • Order funnel — lead + payment status counts
 */
import React, { useEffect, useState } from 'react';
import { businessOrderService } from '../../services/api';

const MONTH_LABELS = {
  ht: ['Jan', 'Fev', 'Mas', 'Avr', 'Me', 'Jin', 'Jiy', 'Out', 'Sep', 'Okt', 'Nov', 'Des'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

const STATUS_FLOW_LABEL = {
  new: { ht: 'Nouvo', en: 'New' },
  contacted: { ht: 'Kontakte', en: 'Contacted' },
  fulfilled: { ht: 'Ranpli', en: 'Fulfilled' },
  cancelled: { ht: 'Anile', en: 'Cancelled' },
};

const PAY_LABEL = {
  unpaid: { ht: 'Pa peye', en: 'Unpaid' },
  paid: { ht: 'Peye', en: 'Paid' },
  refunded: { ht: 'Rembouse', en: 'Refunded' },
};

function money(n, lang) {
  return Number(n ?? 0).toLocaleString(lang === 'ht' ? 'fr-HT' : 'en-US', {
    minimumFractionDigits: 2,
  });
}

function monthShort(monthStr, isHt) {
  // monthStr = 'YYYY-MM'
  const m = Number(String(monthStr || '').split('-')[1]);
  if (!m || m < 1 || m > 12) return String(monthStr || '').slice(5);
  return (MONTH_LABELS[isHt ? 'ht' : 'en'][m - 1]);
}

export default function BusinessAnalyticsSection({
  lang = 'ht', t = {}, showToast, profile,
}) {
  const isHt = lang === 'ht';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!profile?.slug) return;
    setLoading(true);
    try {
      const res = await businessOrderService.analytics(profile.slug);
      const body = res?.data?.data ?? res?.data ?? null;
      setData(body && typeof body === 'object' ? body : null);
    } catch {
      setData(null);
      showToast?.(
        isHt ? 'Pa t ka chaje analitik yo.' : 'Could not load analytics.',
        'circle-exclamation',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // load() resets the loading shape synchronously on entry — the
    // same intentional pattern as the rest of the codebase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [profile?.slug]);

  if (loading) {
    return (
      <div className="biz-analytics" data-testid="business-analytics">
        <div className="biz-catalog-loading">
          <i className="fas fa-spinner fa-pulse" aria-hidden="true" />
        </div>
      </div>
    );
  }

  const months = data?.revenue_by_month || [];
  const topItems = data?.top_items || [];
  const maxMonth = Math.max(...months.map((m) => Number(m.revenue) || 0), 1);
  const maxItem = Math.max(...topItems.map((t) => Number(t.revenue) || 0), 1);

  const kpis = [
    {
      icon: 'fa-sack-dollar',
      label: t?.business_analytics_revenue || (isHt ? 'Revni total' : 'Total revenue'),
      value: `${money(data?.total_revenue, lang)} ${data?.currency || 'USD'}`,
      accent: '#34d399',
    },
    {
      icon: 'fa-cart-shopping',
      label: t?.business_analytics_orders_paid || (isHt ? 'Kòmand peye' : 'Paid orders'),
      value: String(data?.total_paid_orders ?? 0),
      accent: '#38bdf8',
    },
    {
      icon: 'fa-boxes-stacked',
      label: t?.business_analytics_units || (isHt ? 'Inite vann' : 'Units sold'),
      value: String(data?.total_units_sold ?? 0),
      accent: '#a78bfa',
    },
    {
      icon: 'fa-users',
      label: t?.business_analytics_customers || (isHt ? 'Kliyan' : 'Customers'),
      value: String(data?.customers ?? 0),
      accent: '#fbbf24',
    },
    {
      icon: 'fa-receipt',
      label: t?.business_analytics_avg_order || (isHt ? 'Valè mwayèn kòmand' : 'Avg order value'),
      value: `${money(data?.avg_order_value, lang)} ${data?.currency || 'USD'}`,
      accent: '#f472b6',
    },
  ];

  return (
    <div className="biz-analytics" data-testid="business-analytics">
      <div className="biz-catalog-header">
        <div>
          <h3 className="biz-catalog-title">
            <i className="fas fa-chart-pie" aria-hidden="true" />
            {t?.business_section_analytics || (isHt ? 'Analitik' : 'Analytics')}
          </h3>
          <p className="biz-catalog-hint">
            {t?.business_analytics_hint || (isHt
              ? 'Kliyan, revni pa mwa, ak atik ki pi vann — baze sou kòmand ki peye yo.'
              : 'Customers, monthly revenue, and top items — built from your paid orders.')}
          </p>
        </div>
      </div>

      {/* ─── KPI cards ─────────────────────────────────────────────── */}
      <div className="biz-revenue-grid biz-analytics-kpis" data-testid="business-analytics-kpis">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="biz-revenue-card"
            style={{ borderTop: `3px solid ${k.accent}` }}
          >
            <span className="biz-analytics-kpi-icon" style={{ color: k.accent }}>
              <i className={`fas ${k.icon}`} aria-hidden="true" />
            </span>
            <span className="biz-revenue-label">{k.label}</span>
            <span className="biz-revenue-value biz-analytics-kpi-value">{k.value}</span>
          </div>
        ))}
      </div>

      {/* ─── Revenue by month (CSS bar chart) ──────────────────────── */}
      <div className="biz-ws-card biz-analytics-chart-card">
        <h3 className="biz-ws-card-title">
          <i className="fas fa-chart-column" aria-hidden="true" />
          {t?.business_analytics_monthly || (isHt ? 'Revni pa mwa' : 'Revenue by month')}
        </h3>
        {months.length === 0 ? (
          <div className="biz-analytics-empty">
            <i className="fas fa-chart-simple" aria-hidden="true" />
            <p>{t?.business_analytics_empty || (isHt
              ? 'Pokò gen revni peye pou montre.' : 'No paid revenue to show yet.')}</p>
          </div>
        ) : (
          <>
            <div className="biz-analytics-chart" role="img"
              aria-label={t?.business_analytics_monthly || 'Revenue by month'}>
              {months.map((m, i) => {
                const h = Math.max(6, (Number(m.revenue) || 0) / maxMonth * 100);
                return (
                  <div
                    className="biz-analytics-bar-col"
                    key={`${m.month || i}-${m.currency}`}
                    title={`${m.month} · ${money(m.revenue, lang)} ${m.currency} · ${m.orders} ${isHt ? 'kòmand' : 'orders'}`}
                  >
                    <div className="biz-analytics-bar" style={{ height: `${h}%` }} />
                    <span className="biz-analytics-bar-label">{monthShort(m.month, isHt)}</span>
                    <span className="biz-analytics-bar-currency">{m.currency}</span>
                  </div>
                );
              })}
            </div>
            <div className="biz-analytics-chart-total">
              {isHt ? 'Total' : 'Total'}: {money(data?.total_revenue, lang)} {data?.currency || 'USD'}
            </div>
          </>
        )}
      </div>

      {/* ─── Top selling items ─────────────────────────────────────── */}
      <div className="biz-ws-card">
        <h3 className="biz-ws-card-title">
          <i className="fas fa-crown" aria-hidden="true" />
          {t?.business_analytics_top_items || (isHt ? 'Atik ki pi vann' : 'Top selling items')}
        </h3>
        {topItems.length === 0 ? (
          <div className="biz-analytics-empty">
            <i className="fas fa-box-open" aria-hidden="true" />
            <p>{t?.business_analytics_empty || (isHt
              ? 'Pokò gen atik peye.' : 'No paid items yet.')}</p>
          </div>
        ) : (
          <div className="biz-analytics-top-list" data-testid="business-analytics-top">
            {topItems.map((item, i) => {
              const w = Math.max(8, (Number(item.revenue) || 0) / maxItem * 100);
              return (
                <div className="biz-analytics-top-row" key={item.item_name}>
                  <span className="biz-analytics-top-rank">{i + 1}</span>
                  <div className="biz-analytics-top-body">
                    <div className="biz-analytics-top-head">
                      <span className="biz-analytics-top-name">{item.item_name}</span>
                      <span className="biz-analytics-top-revenue">
                        {money(item.revenue, lang)} {data?.currency || 'USD'}
                      </span>
                    </div>
                    <div className="biz-analytics-top-bar-track">
                      <div className="biz-analytics-top-bar" style={{ width: `${w}%` }} />
                    </div>
                    <div className="biz-analytics-top-meta">
                      {item.units} {isHt ? 'inite' : 'units'} · {item.orders} {isHt ? 'kòmand' : 'orders'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Order funnel ──────────────────────────────────────────── */}
      <div className="biz-ws-card">
        <h3 className="biz-ws-card-title">
          <i className="fas fa-filter" aria-hidden="true" />
          {t?.business_analytics_funnel || (isHt ? 'Antòn kòmand' : 'Order funnel')}
        </h3>
        <div className="biz-analytics-funnel">
          {Object.entries(data?.orders_by_status || {}).map(([key, count]) => (
            <div className="biz-analytics-funnel-chip" key={key}>
              <span className="biz-analytics-funnel-count">{count}</span>
              {STATUS_FLOW_LABEL[key]?.[isHt ? 'ht' : 'en'] || key}
            </div>
          ))}
          <span className="biz-analytics-funnel-sep" aria-hidden="true" />
          {Object.entries(data?.orders_by_payment || {}).map(([key, count]) => (
            <div
              className={`biz-analytics-funnel-chip biz-analytics-pay-${key}`}
              key={key}
            >
              <span className="biz-analytics-funnel-count">{count}</span>
              {PAY_LABEL[key]?.[isHt ? 'ht' : 'en'] || key}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
