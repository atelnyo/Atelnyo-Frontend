/**
 * PayoutHistory — Past withdrawal requests with status tracking.
 *
 * Shows:
 *   - Payout status (pending, processing, completed, failed, cancelled)
 *   - Amount, date, fee, payout method
 *   - Timeline for each payout
 *   - Status badges with colors
 *   - Empty state when no payouts
 */
import React from 'react';

function fmtCurrency(n) {
  if (n == null) return '—';
  const v = Number(n);
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

const PAYOUT_STATUS = {
  pending: { icon: 'fa-clock', color: 'var(--state-warning, #f59e0b)', bgColor: 'var(--severity-medium-bg, rgba(245,158,11,0.08))', labelEn: 'Pending', labelHt: 'Annatant' },
  processing: { icon: 'fa-spinner', color: 'var(--state-info, #38bdf8)', bgColor: 'var(--state-info-bg, rgba(56,189,248,0.08))', labelEn: 'Processing', labelHt: 'Ap trete' },
  completed: { icon: 'fa-check-circle', color: 'var(--state-success, #10b981)', bgColor: 'var(--severity-low-bg, rgba(16,185,129,0.08))', labelEn: 'Completed', labelHt: 'Konplete' },
  failed: { icon: 'fa-times-circle', color: 'var(--state-error, #ef4444)', bgColor: 'var(--severity-high-bg, rgba(239,68,68,0.08))', labelEn: 'Failed', labelHt: 'Echek' },
  cancelled: { icon: 'fa-ban', color: 'var(--text-secondary, #64748b)', bgColor: 'var(--state-neutral-bg, rgba(100,116,139,0.08))', labelEn: 'Cancelled', labelHt: 'Anile' },
};

export default function PayoutHistory({
  payouts = [],
  loading = false,
  onRefresh,
  lang = 'ht',
  className = '',
}) {
  const isHt = lang === 'ht';

  return (
    <div className={`wlt-payout-history ${className}`}>
      {/* Header */}
      <div className="wlt-payout-hist-header">
        <h3 className="wlt-payout-hist-title">
          <i className="fas fa-arrow-up" />
          {isHt ? 'Istwa Retrè' : 'Withdrawal History'}
        </h3>
        {onRefresh && (
          <button type="button" className="wlt-refresh-btn" onClick={onRefresh} disabled={loading}>
            <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-rotate'}`} />
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="wlt-loading"><i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap chaje...' : 'Loading...'}</div>
      )}

      {/* Empty state */}
      {!loading && (!payouts || payouts.length === 0) && (
        <div className="wlt-empty">
          <i className="fas fa-arrow-up" />
          <h4>{isHt ? 'Pa gen retrè' : 'No withdrawals yet'}</h4>
          <p>{isHt ? 'Lè ou fè yon retrè, li pral parèt isit la.' : 'When you make a withdrawal, it will appear here.'}</p>
        </div>
      )}

      {/* Payout timeline */}
      {!loading && payouts.length > 0 && (
        <div className="wlt-payout-timeline">
          {payouts.map((payout, i) => {
            const status = payout.status || 'pending';
            const statusConfig = PAYOUT_STATUS[status] || PAYOUT_STATUS.pending;

            return (
              <div key={payout.id || i} className="wlt-payout-entry">
                <div className="wlt-payout-entry-line">
                  <div className="wlt-payout-entry-dot" style={{ background: statusConfig.color }} />
                  {i < payouts.length - 1 && <div className="wlt-payout-entry-connector" />}
                </div>
                <div className="wlt-payout-entry-card">
                  <div className="wlt-payout-entry-header">
                    <div className="wlt-payout-entry-amount">
                      {fmtCurrency(payout.amount)}
                    </div>
                    <span className="wlt-payout-entry-status" style={{ background: statusConfig.bgColor, color: statusConfig.color }}>
                      <i className={`fas ${statusConfig.icon}`} />
                      {isHt ? statusConfig.labelHt : statusConfig.labelEn}
                    </span>
                  </div>
                  <div className="wlt-payout-entry-details">
                    {payout.fee > 0 && (
                      <span className="wlt-payout-detail">
                        {isHt ? 'Frè' : 'Fee'}: {fmtCurrency(payout.fee)}
                      </span>
                    )}
                    {payout.net_amount > 0 && (
                      <span className="wlt-payout-detail">
                        {isHt ? 'Nèt' : 'Net'}: {fmtCurrency(payout.net_amount)}
                      </span>
                    )}
                    <span className="wlt-payout-detail">
                      {fmtDateTime(payout.created_at)}
                    </span>
                    {payout.method && (
                      <span className="wlt-payout-detail">
                        {isHt ? 'Metòd' : 'Method'}: {payout.method}
                      </span>
                    )}
                    {payout.processed_at && (
                      <span className="wlt-payout-detail">
                        {isHt ? 'Trete' : 'Processed'}: {fmtDateTime(payout.processed_at)}
                      </span>
                    )}
                  </div>
                  {payout.note && (
                    <div className="wlt-payout-note">
                      <i className="fas fa-comment" /> {payout.note}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
