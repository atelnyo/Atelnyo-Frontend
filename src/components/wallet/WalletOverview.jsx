/**
 * WalletOverview — Enhanced wallet dashboard with balance, stats, quick actions.
 *
 * Shows:
 *   - Balance card (available, pending, total earned, lifetime received)
 *   - Stats grid (transactions count, payout accounts, tips received/sent)
 *   - Quick action buttons (Deposit, Withdraw, Manage Payout Accounts)
 */
import React from 'react';

function fmtCurrency(n) {
  if (n == null || !Number.isFinite(Number(n))) return '$0.00';
  const v = Number(n);
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function fmtCount(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

function StatCard({ icon, label, value, color, subtitle }) {
  return (
    <div className="wlt-stat-card" style={{ '--stat-color': color || 'var(--pink-primary, #d81b60)' }}>
      <div className="wlt-stat-icon">
        <i className={`fas ${icon}`} />
      </div>
      <div className="wlt-stat-body">
        <div className="wlt-stat-value">{value ?? '—'}</div>
        <div className="wlt-stat-label">{label}</div>
        {subtitle && <div className="wlt-stat-sub">{subtitle}</div>}
      </div>
    </div>
  );
}

export default function WalletOverview({
  wallet,
  stats,
  onWithdraw,
  onManagePayouts,
  onViewTransactions,
  lang = 'ht',
  className = '',
}) {
  const isHt = lang === 'ht';

  if (!wallet) {
    return (
      <div className="wlt-overview-empty">
        <i className="fas fa-wallet" />
        <h3>{isHt ? 'Pa gen bous' : 'No wallet data'}</h3>
        <p>{isHt ? 'Ou poko gen yon bous. Kreye yon kont kreyatè pou jwenn aksè.' : 'You don\'t have a wallet yet. Create a creator account to get access.'}</p>
      </div>
    );
  }

  const balance = wallet.balance || 0;
  const pending = wallet.pending_balance || 0;
  const totalEarned = wallet.total_earned || 0;
  const lifetimeReceived = wallet.lifetime_received || totalEarned;

  return (
    <div className={`wlt-overview ${className}`}>
      {/* ─── Balance Card ──────────────────────────────────── */}
      <div className="wlt-balance-card">
        <div className="wlt-balance-header">
          <span className="wlt-balance-label">
            <i className="fas fa-wallet" />
            {isHt ? 'Balans Disponib' : 'Available Balance'}
          </span>
          <div className="wlt-balance-actions">
            {onViewTransactions && (
              <button type="button" className="wlt-balance-btn" onClick={onViewTransactions} title={isHt ? 'Istwa' : 'History'}>
                <i className="fas fa-clock-rotate-left" />
              </button>
            )}
          </div>
        </div>
        <div className="wlt-balance-value">{fmtCurrency(balance)}</div>
        <div className="wlt-balance-details">
          <div className="wlt-balance-detail">
            <span className="wlt-detail-label">{isHt ? 'Annatant' : 'Pending'}</span>
            <span className="wlt-detail-value">{fmtCurrency(pending)}</span>
          </div>
          <div className="wlt-balance-detail">
            <span className="wlt-detail-label">{isHt ? 'Total Touche' : 'Total Earned'}</span>
            <span className="wlt-detail-value">{fmtCurrency(totalEarned)}</span>
          </div>
          <div className="wlt-balance-detail">
            <span className="wlt-detail-label">{isHt ? 'Resevwa' : 'Lifetime'}</span>
            <span className="wlt-detail-value">{fmtCurrency(lifetimeReceived)}</span>
          </div>
        </div>
        <div className="wlt-balance-cta-row">
          {onWithdraw && (
            <button type="button" className="wlt-balance-cta" onClick={onWithdraw} disabled={balance <= 0}>
              <i className="fas fa-arrow-up" />
              {isHt ? 'Retire Lajan' : 'Withdraw'}
            </button>
          )}
          {onManagePayouts && (
            <button type="button" className="wlt-balance-cta wlt-balance-cta-secondary" onClick={onManagePayouts}>
              <i className="fas fa-university" />
              {isHt ? 'Kont Peman' : 'Payout Accounts'}
            </button>
          )}
        </div>
      </div>

      {/* ─── Stats Grid ────────────────────────────────────── */}
      <div className="wlt-stats-grid">
        <StatCard
          icon="fa-receipt"
          label={isHt ? 'Tranzaksyon' : 'Transactions'}
          value={fmtCount(stats?.total_transactions ?? wallet.transaction_count)}
          color="var(--state-info, #38bdf8)"
        />
        <StatCard
          icon="fa-university"
          label={isHt ? 'Kont Peman' : 'Payout Accounts'}
          value={fmtCount(stats?.payout_accounts ?? wallet.payout_accounts_count)}
          color="var(--pr-color-violet-500, #8b5cf6)"
        />
        <StatCard
          icon="fa-arrow-up"
          label={isHt ? 'Retrè' : 'Withdrawals'}
          value={fmtCount(stats?.total_withdrawals ?? wallet.withdrawals_count)}
          color="var(--state-warning, #f59e0b)"
        />
        <StatCard
          icon="fa-hand-holding-heart"
          label={isHt ? 'Tips Resevwa' : 'Tips Received'}
          value={fmtCount(stats?.tips_received ?? wallet.tips_received_count)}
          subtitle={fmtCurrency(stats?.tips_received_amount ?? wallet.tips_received_amount)}
          color="var(--state-success, #10b981)"
        />
        <StatCard
          icon="fa-paper-plane"
          label={isHt ? 'Tips Voye' : 'Tips Sent'}
          value={fmtCount(stats?.tips_sent ?? wallet.tips_sent_count)}
          subtitle={fmtCurrency(stats?.tips_sent_amount ?? wallet.tips_sent_amount)}
          color="var(--pr-color-orange-500, #f97316)"
        />
        <StatCard
          icon="fa-star"
          label={isHt ? 'Kontribisyon' : 'Contributions'}
          value={fmtCount(stats?.referral_commissions)}
          subtitle={fmtCurrency(stats?.referral_earnings)}
          color="var(--color-primary, #d81b60)"
        />
      </div>

      {/* ─── Quick Actions ─────────────────────────────────── */}
      <div className="wlt-quick-actions">
        <button type="button" className="wlt-quick-action" onClick={onWithdraw} disabled={balance <= 0}>
          <i className="fas fa-arrow-up" />
          <span>{isHt ? 'Retrè' : 'Withdraw'}</span>
        </button>
        <button type="button" className="wlt-quick-action" onClick={onManagePayouts}>
          <i className="fas fa-university" />
          <span>{isHt ? 'Kont Peman' : 'Payout Accts'}</span>
        </button>
        <button type="button" className="wlt-quick-action" onClick={onViewTransactions}>
          <i className="fas fa-clock-rotate-left" />
          <span>{isHt ? 'Istwa' : 'History'}</span>
        </button>
      </div>
    </div>
  );
}
