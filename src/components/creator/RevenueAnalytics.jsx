/**
 * src/components/creator/RevenueAnalytics.jsx
 *
 * Revenue Analytics Dashboard for Creators.
 * Tracks earnings, transactions, and financial performance.
 *
 * Features:
 *   - Revenue overview (total, monthly, weekly)
 *   - Revenue by content type
 *   - Transaction history
 *   - Revenue trends (charts)
 *   - Payment status tracking
 */
import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';

// ─── Helpers ───────────────────────────────────────────────────────

function formatCurrency(n, currency = 'USD') {
  if (n == null || !Number.isFinite(Number(n))) return '$0';
  const v = Number(n);
  const symbols = { USD: '$', HTG: 'G', EUR: '€', GBP: '£' };
  const symbol = symbols[currency] || '$';
  if (v >= 1000000) return `${symbol}${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${symbol}${(v / 1000).toFixed(1)}K`;
  return `${symbol}${v.toFixed(2)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getStatusColor(status) {
  const colors = {
    succeeded: '#10b981',
    pending: '#f59e0b',
    failed: '#ef4444',
    refunded: '#8b5cf6',
  };
  return colors[status] || '#6b7280';
}

// ─── Revenue Metric Card ───────────────────────────────────────────

function RevenueMetric({ icon, label, value, change, format = 'currency' }) {
  const displayValue = format === 'currency'
    ? formatCurrency(value)
    : value?.toLocaleString() || '0';

  return (
    <div className="rev-metric-card">
      <div className="rev-metric-icon">
        <i className={`fas ${icon}`} />
      </div>
      <div className="rev-metric-content">
        <div className="rev-metric-value">{displayValue}</div>
        <div className="rev-metric-label">{label}</div>
        {change != null && (
          <div className={`rev-metric-change ${change >= 0 ? 'rev-positive' : 'rev-negative'}`}>
            <i className={`fas fa-arrow-${change >= 0 ? 'up' : 'down'}`} />
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Revenue Chart ─────────────────────────────────────────────────

function RevenueChart({ data, height = 200 }) {
  if (!data || data.length === 0) {
    return (
      <div className="rev-chart-empty">
        <i className="fas fa-chart-line" />
        <span>No revenue data yet</span>
      </div>
    );
  }

  const maxVal = Math.max(...data.map(d => d.revenue || 0), 1);
  const barWidth = Math.max(8, Math.floor(600 / data.length) - 4);
  const totalWidth = Math.max(300, data.length * (barWidth + 4));

  return (
    <svg
      className="rev-chart"
      viewBox={`0 0 ${totalWidth} ${height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map(pct => (
        <line
          key={pct}
          x1={0}
          y1={height - (maxVal * pct / maxVal) * (height - 40) - 20}
          x2={totalWidth}
          y2={height - (maxVal * pct / maxVal) * (height - 40) - 20}
          stroke="#e5e7eb"
          strokeDasharray="4,4"
          opacity={0.5}
        />
      ))}
      {/* Bars */}
      {data.map((d, i) => {
        const val = d.revenue || 0;
        const h = Math.max(4, (val / maxVal) * (height - 40));
        const x = i * (barWidth + 4);
        const y = height - h - 20;

        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={h}
              rx={4}
              fill="url(#rev-gradient)"
              opacity={0.8 + (val / maxVal) * 0.2}
            >
              <title>{d.date}: {formatCurrency(val)}</title>
            </rect>
            {data.length <= 15 && (
              <text
                x={x + barWidth / 2}
                y={height - 4}
                textAnchor="middle"
                className="rev-chart-label"
                fontSize={data.length > 10 ? '8' : '9'}
              >
                {String(d.date || '').slice(-5)}
              </text>
            )}
          </g>
        );
      })}
      <defs>
        <linearGradient id="rev-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
          <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── Revenue by Type ───────────────────────────────────────────────

function RevenueByType({ data }) {
  if (!data || data.length === 0) {
    return <div className="rev-empty">No revenue data by type</div>;
  }

  const total = data.reduce((sum, d) => sum + (d.revenue || 0), 0);
  const colors = ['#d81b60', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];

  return (
    <div className="rev-by-type">
      <div className="rev-type-bar">
        {data.map((item, idx) => (
          <div
            key={item.type}
            className="rev-type-segment"
            style={{
              width: `${total > 0 ? (item.revenue / total) * 100 : 0}%`,
              background: colors[idx % colors.length],
            }}
            title={`${item.type}: ${formatCurrency(item.revenue)}`}
          />
        ))}
      </div>
      <div className="rev-type-legend">
        {data.map((item, idx) => (
          <div key={item.type} className="rev-type-item">
            <span className="rev-type-dot" style={{ background: colors[idx % colors.length] }} />
            <span className="rev-type-name">{item.type}</span>
            <span className="rev-type-value">{formatCurrency(item.revenue)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Transaction Table ─────────────────────────────────────────────

function TransactionTable({ transactions }) {
  if (!transactions || transactions.length === 0) {
    return <div className="rev-empty">No transactions yet</div>;
  }

  return (
    <div className="rev-table-wrap">
      <table className="rev-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {transactions.slice(0, 10).map((tx, idx) => (
            <tr key={tx.id || idx}>
              <td>{formatDate(tx.created_at)}</td>
              <td>{tx.description || tx.item_title || 'Transaction'}</td>
              <td>{tx.type || tx.source || '-'}</td>
              <td className="rev-amount">{formatCurrency(tx.amount)}</td>
              <td>
                <span
                  className="rev-status"
                  style={{ color: getStatusColor(tx.status) }}
                >
                  {tx.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────

export default function RevenueAnalytics({ lang = 'ht', showToast, user }) {
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [byType, setByType] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    fetchRevenueData();
  }, [period]);

  const fetchRevenueData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [summaryRes, trendRes, typeRes, txRes] = await Promise.allSettled([
        api.get('/analytics/summary/'),
        api.get('/analytics/trend/revenue/', { params: { days: period } }),
        api.get('/analytics/revenue/by-type/', { params: { days: period } }),
        api.get('/analytics/transactions/', { params: { limit: 20 } }),
      ]);

      setSummary(summaryRes.status === 'fulfilled' ? summaryRes.value.data : null);
      setTrend(trendRes.status === 'fulfilled' ? (Array.isArray(trendRes.value.data) ? trendRes.value.data : []) : []);
      setByType(typeRes.status === 'fulfilled' ? (Array.isArray(typeRes.value.data) ? typeRes.value.data : []) : []);
      setTransactions(txRes.status === 'fulfilled' ? (Array.isArray(txRes.value.data) ? txRes.value.data : []) : []);
    } catch (err) {
      setError(err.message);
      showToast?.('Failed to load revenue data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!summary) return null;

    const monthlyRevenue = trend.slice(-30).reduce((sum, d) => sum + (d.revenue || 0), 0);
    const weeklyRevenue = trend.slice(-7).reduce((sum, d) => sum + (d.revenue || 0), 0);
    const avgOrderValue = summary.total_orders > 0
      ? summary.total_revenue / summary.total_orders
      : 0;

    return {
      total: summary.total_revenue || 0,
      monthly: monthlyRevenue,
      weekly: weeklyRevenue,
      avgOrder: avgOrderValue,
      orders: summary.total_orders || 0,
      pending: transactions.filter(tx => tx.status === 'pending').reduce((sum, tx) => sum + (tx.amount || 0), 0),
    };
  }, [summary, trend, transactions]);

  if (loading) {
    return (
      <div className="rev-loading">
        <i className="fas fa-spinner fa-spin" />
        <span>Loading revenue analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rev-error">
        <i className="fas fa-exclamation-triangle" />
        <span>{error}</span>
        <button onClick={fetchRevenueData}>Retry</button>
      </div>
    );
  }

  return (
    <div className="rev-container">
      <div className="rev-header">
        <h2>
          <i className="fas fa-dollar-sign" />
          Revenue Analytics
        </h2>
        <div className="rev-period-selector">
          <button className={period === 7 ? 'rev-active' : ''} onClick={() => setPeriod(7)}>7 Days</button>
          <button className={period === 30 ? 'rev-active' : ''} onClick={() => setPeriod(30)}>30 Days</button>
          <button className={period === 90 ? 'rev-active' : ''} onClick={() => setPeriod(90)}>90 Days</button>
        </div>
      </div>

      {/* Key Metrics */}
      {metrics && (
        <div className="rev-metrics">
          <RevenueMetric icon="fa-dollar-sign" label="Total Revenue" value={metrics.total} />
          <RevenueMetric icon="fa-calendar-month" label="This Month" value={metrics.monthly} />
          <RevenueMetric icon="fa-calendar-week" label="This Week" value={metrics.weekly} />
          <RevenueMetric icon="fa-receipt" label="Avg Order" value={metrics.avgOrder} />
          <RevenueMetric icon="fa-shopping-cart" label="Total Orders" value={metrics.orders} format="number" />
          <RevenueMetric icon="fa-clock" label="Pending" value={metrics.pending} />
        </div>
      )}

      {/* Revenue Trend */}
      <div className="rev-section">
        <h3>
          <i className="fas fa-chart-line" />
          Revenue Trend
        </h3>
        <RevenueChart data={trend} />
      </div>

      {/* Revenue by Type */}
      <div className="rev-section">
        <h3>
          <i className="fas fa-chart-pie" />
          Revenue by Type
        </h3>
        <RevenueByType data={byType} />
      </div>

      {/* Recent Transactions */}
      <div className="rev-section">
        <h3>
          <i className="fas fa-list" />
          Recent Transactions
        </h3>
        <TransactionTable transactions={transactions} />
      </div>
    </div>
  );
}
