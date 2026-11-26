/**
 * WalletOverview — Enhanced wallet dashboard with balance, stats, quick actions.
 *
 * Shows:
 *   - Balance card (available, pending, total earned, lifetime received)
 *   - "Where your money comes from" — per-source totals from the ledger
 *     (tips, Store sales, subscriptions, contracts, tickets, added funds)
 *   - Stats grid (transactions count, payout accounts, tips received/sent)
 *   - Quick action buttons (Deposit, Withdraw, Manage Payout Accounts)
 */
import React from 'react';
import { inlineText } from '../../utils/inlineI18n';

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

// Ledger sources, in the order a creator thinks about them. A guardrail:
// the wallet only ever shows real ledger totals, never an estimate.
const MONEY_SOURCES = [
  { key: 'tips', icon: 'fa-hand-holding-heart', en: 'Tips', ht: 'Tips' },
  { key: 'sales', icon: 'fa-bag-shopping', en: 'Store sales', ht: 'Vant Store' },
  { key: 'subscriptions', icon: 'fa-crown', en: 'Subscriptions', ht: 'Abònman' },
  { key: 'contracts', icon: 'fa-file-signature', en: 'Contract milestones', ht: 'Etap kontra' },
  { key: 'tickets', icon: 'fa-ticket', en: 'Event tickets', ht: 'Tikè evènman' },
  { key: 'deposits', icon: 'fa-circle-dollar-to-slot', en: 'Funds you added', ht: 'Lajan ou ajoute' },
];

function MoneySources({ breakdown, lang = 'en' }) {
  const isHt = lang === 'ht';
  const data = breakdown || {};
  const rows = MONEY_SOURCES.map((source) => ({
    ...source,
    amount: Number(data[source.key] || 0),
  }));
  const anyMoney = rows.some((row) => row.amount > 0);
  const withdrawn = Number(data.withdrawn || 0);

  return (
    <section className="wlt-sources" aria-label={isHt ? 'Kote lajan ou soti' : inlineText(lang, 'Where your money comes from')}>
      <div className="wlt-sources-head">
        <h3 className="wlt-sources-title">
          <i className="fas fa-arrow-down-wide-short" />
          {isHt ? 'Kote lajan ou soti' : inlineText(lang, 'Where your money comes from')}
        </h3>
        <span className="wlt-sources-total">
          {isHt ? 'Total touche' : inlineText(lang, 'Total earned')}: {fmtCurrency(data.total_earned)}
        </span>
      </div>

      {!anyMoney ? (
        <p className="wlt-sources-empty">
          {isHt
            ? 'Poko gen lajan ki antre. Tips, vant Store, abònman ak kontra ap parèt isit la.'
            : inlineText(lang, 'Nothing has come in yet. Tips, Store sales, subscriptions and contracts will show up here.')}
        </p>
      ) : (
        <div className="wlt-sources-grid">
          {rows.map((row) => (
            <div
              key={row.key}
              className={`wlt-source-row ${row.amount > 0 ? '' : 'wlt-source-row-empty'}`}
            >
              <i className={`fas ${row.icon}`} aria-hidden="true" />
              <span className="wlt-source-label">{isHt ? row.ht : inlineText(lang, row.en)}</span>
              <span className="wlt-source-amount">{fmtCurrency(row.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {withdrawn > 0 && (
        <p className="wlt-sources-out">
          <i className="fas fa-arrow-up" aria-hidden="true" />
          {isHt ? 'Deja retire' : inlineText(lang, 'Already withdrawn')}: {fmtCurrency(withdrawn)}
        </p>
      )}
    </section>
  );
}

export default function WalletOverview({
  wallet,
  stats,
  onWithdraw,
  onManagePayouts,
  onViewTransactions,
  lang = 'en',
  className = '',
}) {
  const isHt = lang === 'ht';

  if (!wallet) {
    return (
      <div className="wlt-overview-empty">
        <i className="fas fa-wallet" />
        <h3>{isHt ? 'Bous ap ouvri...' : inlineText(lang, 'Opening wallet...')}</h3>
        <p>{isHt ? 'Bous ou ap kreye otomatikman. Rete sou paj sa a yon ti moman.' : inlineText(lang, 'Your wallet is created automatically. Stay on this page a moment.')}</p>
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
            {isHt ? 'Balans Disponib' : inlineText(lang, 'Available Balance')}
          </span>
          <div className="wlt-balance-actions">
            {onViewTransactions && (
              <button type="button" className="wlt-balance-btn" onClick={onViewTransactions} title={isHt ? 'Istwa' : inlineText(lang, 'History')}>
                <i className="fas fa-clock-rotate-left" />
              </button>
            )}
          </div>
        </div>
        <div className="wlt-balance-value">{fmtCurrency(balance)}</div>
        <div className="wlt-balance-details">
          <div className="wlt-balance-detail">
            <span className="wlt-detail-label">{isHt ? 'Annatant' : inlineText(lang, 'Pending')}</span>
            <span className="wlt-detail-value">{fmtCurrency(pending)}</span>
          </div>
          <div className="wlt-balance-detail">
            <span className="wlt-detail-label">{isHt ? 'Total Touche' : inlineText(lang, 'Total Earned')}</span>
            <span className="wlt-detail-value">{fmtCurrency(totalEarned)}</span>
          </div>
          <div className="wlt-balance-detail">
            <span className="wlt-detail-label">{isHt ? 'Resevwa' : inlineText(lang, 'Lifetime')}</span>
            <span className="wlt-detail-value">{fmtCurrency(lifetimeReceived)}</span>
          </div>
        </div>
        <div className="wlt-balance-cta-row">
          {onWithdraw && (
            <button type="button" className="wlt-balance-cta" onClick={onWithdraw} disabled={balance <= 0}>
              <i className="fas fa-arrow-up" />
              {isHt ? 'Retire Lajan' : inlineText(lang, 'Withdraw')}
            </button>
          )}
          {onManagePayouts && (
            <button type="button" className="wlt-balance-cta wlt-balance-cta-secondary" onClick={onManagePayouts}>
              <i className="fas fa-university" />
              {isHt ? 'Kont Peman' : inlineText(lang, 'Payout Accounts')}
            </button>
          )}
        </div>
      </div>

      {/* ─── Money Sources (how the balance got here) ────────── */}
      <MoneySources breakdown={wallet.earnings_breakdown} lang={lang} />

      {/* ─── Stats Grid ────────────────────────────────────── */}
      <div className="wlt-stats-grid">
        <StatCard
          icon="fa-receipt"
          label={isHt ? 'Tranzaksyon' : inlineText(lang, 'Transactions')}
          value={fmtCount(stats?.total_transactions ?? wallet.transaction_count)}
          color="var(--state-info, #38bdf8)"
        />
        <StatCard
          icon="fa-university"
          label={isHt ? 'Kont Peman' : inlineText(lang, 'Payout Accounts')}
          value={fmtCount(stats?.payout_accounts ?? wallet.payout_accounts_count)}
          color="var(--pr-color-violet-500, #8b5cf6)"
        />
        <StatCard
          icon="fa-arrow-up"
          label={isHt ? 'Retrè' : inlineText(lang, 'Withdrawals')}
          value={fmtCount(stats?.total_withdrawals ?? wallet.withdrawals_count)}
          color="var(--state-warning, #f59e0b)"
        />
        <StatCard
          icon="fa-hand-holding-heart"
          label={isHt ? 'Tips Resevwa' : inlineText(lang, 'Tips Received')}
          value={fmtCount(stats?.tips_received ?? wallet.tips_received_count)}
          subtitle={fmtCurrency(stats?.tips_received_amount ?? wallet.tips_received_amount)}
          color="var(--state-success, #10b981)"
        />
        <StatCard
          icon="fa-paper-plane"
          label={isHt ? 'Tips Voye' : inlineText(lang, 'Tips Sent')}
          value={fmtCount(stats?.tips_sent ?? wallet.tips_sent_count)}
          subtitle={fmtCurrency(stats?.tips_sent_amount ?? wallet.tips_sent_amount)}
          color="var(--pr-color-orange-500, #f97316)"
        />
        <StatCard
          icon="fa-star"
          label={isHt ? 'Kontribisyon' : inlineText(lang, 'Contributions')}
          value={fmtCount(stats?.referral_commissions)}
          subtitle={fmtCurrency(stats?.referral_earnings)}
          color="var(--color-primary, #d81b60)"
        />
      </div>

      {/* ─── Quick Actions ─────────────────────────────────── */}
      <div className="wlt-quick-actions">
        <button type="button" className="wlt-quick-action" onClick={onWithdraw} disabled={balance <= 0}>
          <i className="fas fa-arrow-up" />
          <span>{isHt ? 'Retrè' : inlineText(lang, 'Withdraw')}</span>
        </button>
        <button type="button" className="wlt-quick-action" onClick={onManagePayouts}>
          <i className="fas fa-university" />
          <span>{isHt ? 'Kont Peman' : inlineText(lang, 'Payout Accts')}</span>
        </button>
        <button type="button" className="wlt-quick-action" onClick={onViewTransactions}>
          <i className="fas fa-clock-rotate-left" />
          <span>{isHt ? 'Istwa' : inlineText(lang, 'History')}</span>
        </button>
      </div>
    </div>
  );
}
