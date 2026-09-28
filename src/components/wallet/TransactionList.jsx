/**
 * TransactionList — Full transaction history with filters, pagination, sorting.
 *
 * Shows:
 *   - Filter by type (all, payment, withdrawal, deposit, tip, refund, commission)
 *   - Filter by date (today, 7d, 30d, 90d, all)
 *   - Sort by date (newest/oldest)
 *   - Paginated list with type icons, descriptions, amounts, status
 *   - Empty state when no transactions
 */
import React, { useState, useMemo } from 'react';

function fmtCurrency(n) {
  if (n == null) return '—';
  const v = Number(n);
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(); } catch { return '—'; }
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return '—'; }
}

function fmtRelative(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDate(iso);
}

const TX_TYPE_CONFIG = {
  payment: { icon: 'fa-credit-card', color: 'var(--tx-payment, var(--state-success, #10b981))', bg: 'var(--severity-low-bg, rgba(16,185,129,0.08))', labelEn: 'Payment', labelHt: 'Peman' },
  withdrawal: { icon: 'fa-arrow-up', color: 'var(--tx-withdrawal, var(--state-error, #ef4444))', bg: 'var(--severity-high-bg, rgba(239,68,68,0.08))', labelEn: 'Withdrawal', labelHt: 'Retrè' },
  deposit: { icon: 'fa-arrow-down', color: 'var(--tx-deposit, var(--state-info, #38bdf8))', bg: 'var(--state-info-bg, rgba(56,189,248,0.08))', labelEn: 'Deposit', labelHt: 'Depo' },
  tip_sent: { icon: 'fa-paper-plane', color: 'var(--tx-tip-sent, var(--pr-color-orange-500, #f97316))', bg: 'var(--pr-color-orange-500-bg, rgba(249,115,22,0.08))', labelEn: 'Tip Sent', labelHt: 'Tip Voye' },
  tip_received: { icon: 'fa-hand-holding-heart', color: 'var(--tx-tip-received, var(--state-success, #10b981))', bg: 'var(--severity-low-bg, rgba(16,185,129,0.08))', labelEn: 'Tip Received', labelHt: 'Tip Resevwa' },
  refund: { icon: 'fa-undo', color: 'var(--tx-refund, var(--state-warning, #f59e0b))', bg: 'var(--severity-medium-bg, rgba(245,158,11,0.08))', labelEn: 'Refund', labelHt: 'Ranbousman' },
  commission: { icon: 'fa-percentage', color: 'var(--tx-commission, var(--pr-color-violet-500, #8b5cf6))', bg: 'var(--pr-color-violet-500-bg, rgba(139,92,246,0.08))', labelEn: 'Commission', labelHt: 'Komisyon' },
  referral_bonus: { icon: 'fa-gift', color: 'var(--tx-referral, var(--color-primary, #d81b60))', bg: 'var(--color-primary-bg, rgba(216,27,96,0.08))', labelEn: 'Referral Bonus', labelHt: 'Bonis Referans' },
  default: { icon: 'fa-receipt', color: 'var(--text-secondary, #64748b)', bg: 'var(--state-neutral-bg, rgba(100,116,139,0.08))', labelEn: 'Transaction', labelHt: 'Tranzaksyon' },
};

const TX_TYPE_FILTERS = [
  { value: 'all', labelEn: 'All', labelHt: 'Tout' },
  { value: 'payment', labelEn: 'Payments', labelHt: 'Peman' },
  { value: 'withdrawal', labelEn: 'Withdrawals', labelHt: 'Retrè' },
  { value: 'deposit', labelEn: 'Deposits', labelHt: 'Depo' },
  { value: 'tip', labelEn: 'Tips', labelHt: 'Tips' },
  { value: 'refund', labelEn: 'Refunds', labelHt: 'Ranbousman' },
  { value: 'commission', labelEn: 'Commissions', labelHt: 'Komisyon' },
];

const DATE_FILTERS = [
  { value: 'all', labelEn: 'All Time', labelHt: 'Tout tan' },
  { value: 'today', labelEn: 'Today', labelHt: 'Jodi a' },
  { value: '7d', labelEn: '7 Days', labelHt: '7 Jou' },
  { value: '30d', labelEn: '30 Days', labelHt: '30 Jou' },
  { value: '90d', labelEn: '90 Days', labelHt: '90 Jou' },
];

const ITEMS_PER_PAGE = 15;

export default function TransactionList({
  transactions = [],
  loading = false,
  onRefresh,
  lang = 'ht',
  className = '',
}) {
  const isHt = lang === 'ht';
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [page, setPage] = useState(0);

  // Filter transactions
  const filtered = useMemo(() => {
    let result = Array.isArray(transactions) ? [...transactions] : [];

    // Type filter
    if (typeFilter !== 'all') {
      if (typeFilter === 'tip') {
        result = result.filter((tx) => tx.type === 'tip_sent' || tx.type === 'tip_received');
      } else {
        result = result.filter((tx) => tx.type === typeFilter);
      }
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = Date.now();
      const DAY = 86400000;
      const thresholds = {
        today: now - DAY,
        '7d': now - 7 * DAY,
        '30d': now - 30 * DAY,
        '90d': now - 90 * DAY,
      };
      const threshold = thresholds[dateFilter] || 0;
      result = result.filter((tx) => {
        const t = tx.created_at ? new Date(tx.created_at).getTime() : 0;
        return t >= threshold;
      });
    }

    // Sort
    result.sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sortOrder === 'newest' ? tb - ta : ta - tb;
    });

    return result;
  }, [transactions, typeFilter, dateFilter, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedItems = filtered.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);

  return (
    <div className={`wlt-tx-list ${className}`}>
      {/* Header */}
      <div className="wlt-tx-header">
        <h3 className="wlt-tx-title">
          <i className="fas fa-clock-rotate-left" />
          {isHt ? 'Istwa Tranzaksyon' : 'Transaction History'}
        </h3>
        {onRefresh && (
          <button type="button" className="wlt-refresh-btn" onClick={onRefresh} disabled={loading}>
            <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-rotate'}`} />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="wlt-tx-filters">
        <div className="wlt-filter-group">
          {TX_TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`wlt-filter-chip ${typeFilter === f.value ? 'wlt-filter-active' : ''}`}
              onClick={() => { setTypeFilter(f.value); setPage(0); }}
            >
              {isHt ? f.labelHt : f.labelEn}
            </button>
          ))}
        </div>
        <div className="wlt-filter-row">
          <div className="wlt-filter-group">
            {DATE_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={`wlt-filter-chip ${dateFilter === f.value ? 'wlt-filter-active' : ''}`}
                onClick={() => { setDateFilter(f.value); setPage(0); }}
              >
                {isHt ? f.labelHt : f.labelEn}
              </button>
            ))}
          </div>
          <div className="wlt-sort-group">
            <button
              type="button"
              className={`wlt-sort-btn ${sortOrder === 'newest' ? 'wlt-sort-active' : ''}`}
              onClick={() => { setSortOrder('newest'); setPage(0); }}
            >
              <i className="fas fa-arrow-down-wide-short" />
              {isHt ? 'Rekan' : 'Newest'}
            </button>
            <button
              type="button"
              className={`wlt-sort-btn ${sortOrder === 'oldest' ? 'wlt-sort-active' : ''}`}
              onClick={() => { setSortOrder('oldest'); setPage(0); }}
            >
              <i className="fas fa-arrow-up-short-wide" />
              {isHt ? 'Ansyen' : 'Oldest'}
            </button>
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="wlt-tx-count">
        {filtered.length} {isHt ? 'tranzaksyon' : 'transactions'}
        {filtered.length !== (Array.isArray(transactions) ? transactions.length : 0) && (
          <span className="wlt-tx-filtered">
            {isHt ? 'filtre' : 'filtered'}
          </span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="wlt-loading">
          <i className="fas fa-spinner fa-spin" />
          <span>{isHt ? 'Ap chaje...' : 'Loading...'}</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="wlt-empty">
          <i className="fas fa-receipt" />
          <h4>{isHt ? 'Pa gen tranzaksyon' : 'No transactions'}</h4>
          <p>{isHt ? 'Okenn tranzaksyon pa koresponn ak filtre w yo.' : 'No transactions match your filters.'}</p>
        </div>
      )}

      {/* List */}
      {!loading && paginatedItems.length > 0 && (
        <div className="wlt-tx-items">
          {paginatedItems.map((tx, i) => {
            const type = tx.type || 'default';
            const config = TX_TYPE_CONFIG[type] || TX_TYPE_CONFIG.default;
            const amount = tx.amount || 0;
            const isPositive = amount > 0 && (type === 'payment' || type === 'deposit' || type === 'tip_received' || type === 'commission' || type === 'referral_bonus');
            const isNegative = amount > 0 && (type === 'withdrawal' || type === 'tip_sent');

            return (
                <div key={tx.id || i} className="wlt-tx-item">
                <div className="wlt-tx-icon" style={{ background: config.bg, color: config.color }}>
                  <i className={`fas ${config.icon}`} />
                </div>
                <div className="wlt-tx-body">
                  <div className="wlt-tx-desc">
                    {tx.description || (isHt ? config.labelHt : config.labelEn) || 'Transaction'}
                  </div>
                  <div className="wlt-tx-meta">
                    <span className={`wlt-tx-status wlt-tx-status-${tx.status || 'completed'}`}>
                      <i className={`fas fa-circle`} /> {tx.status || 'completed'}
                    </span>
                    <span className="wlt-tx-date">{fmtRelative(tx.created_at)}</span>
                  </div>
                </div>
                <div className={`wlt-tx-amount ${isPositive ? 'wlt-tx-pos' : isNegative ? 'wlt-tx-neg' : amount > 0 ? 'wlt-tx-pos' : ''}`}>
                  {amount > 0 && !isNegative ? '+' : ''}{fmtCurrency(amount)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="wlt-pagination">
          <button
            type="button"
            className="wlt-page-btn"
            disabled={currentPage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <i className="fas fa-chevron-left" />
          </button>
          <span className="wlt-page-info">
            {currentPage + 1} / {totalPages}
          </span>
          <button
            type="button"
            className="wlt-page-btn"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            <i className="fas fa-chevron-right" />
          </button>
        </div>
      )}
    </div>
  );
}
