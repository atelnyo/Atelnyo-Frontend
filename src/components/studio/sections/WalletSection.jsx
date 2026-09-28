/**
 * src/components/studio/sections/WalletSection.jsx
 *
 * Wallet section — the creator's financial hub inside Creator Studio.
 *
 * Organized in tabs so every money operation has a clear home:
 *   Balans      — WalletOverview (balance card, stats, quick actions)
 *   Tranzaksyon — TransactionList (full ledger with filters)  *   Kont Peman  — PayoutAccountManager (connect PayPal)
 *   Retrè       — PayoutHistory (withdrawal requests + status)
 *   Tips        — TipsInbox (tips received / sent)
 *   Refund      — marketplace transactions the creator can refund
 *
 * Actions wired here:
 *   • Fund wallet   → DepositModal  (PayPal top-up → wallet balance)
 *   • Withdraw      → WithdrawModal (existing studio modal)
 *   • Request refund→ RefundModal   (buyer/staff on PayPal transactions)
 *
 * Extracted from CreatorStudio.jsx during Etap 2 refactor.
 */
import React, { useCallback, useMemo, useState } from 'react';
import api, { walletService } from '../../../services/api';
import useFetch from '../../../hooks/useFetch';
import { StudioSkeleton, EmptyState, SectionHeader } from '../shared';
import styles from './sections.module.css';
import WalletOverview from '../../wallet/WalletOverview';
import TransactionList from '../../wallet/TransactionList';
import PayoutAccountManager from '../../wallet/PayoutAccountManager';
import PayoutHistory from '../../wallet/PayoutHistory';
import TipsInbox from '../../wallet/TipsInbox';
import DepositModal from '../modals/DepositModal';
import RefundModal from '../modals/RefundModal';
import SendTipModal from '../modals/SendTipModal';

const TABS = [
  { id: 'overview',     icon: 'fa-wallet',             ht: 'Balans',        en: 'Overview' },
  { id: 'transactions', icon: 'fa-clock-rotate-left',  ht: 'Tranzaksyon',   en: 'Transactions' },
  { id: 'accounts',     icon: 'fa-university',         ht: 'Kont Peman',    en: 'Payout Accounts' },
  { id: 'payouts',      icon: 'fa-arrow-up',           ht: 'Retrè',         en: 'Withdrawals' },
  { id: 'tips',         icon: 'fa-hand-holding-heart', ht: 'Tips',          en: 'Tips' },
  { id: 'refunds',      icon: 'fa-rotate-left',        ht: 'Refund',        en: 'Refunds' },
];

export default function WalletSection({ lang, t, showToast, setShowWithdrawModal, user }) {
  const isHt = lang === 'ht';
  const [activeTab, setActiveTab] = useState('overview');

  // ── Data: wallet balance + ledger ────────────────────────────────
  const { data: wallet, loading: walletLoading, refetch: refetchWallet } = useFetch(
    () => walletService.me(),
    { defaultValue: null, deps: [], transform: (d) => d?.data ?? d ?? null },
  );
  const { data: transactions, loading: txLoading, refetch: refetchTransactions } = useFetch(
    () => walletService.transactions({ limit: 100 }),
    { defaultValue: [], deps: [], transform: (d) => (Array.isArray(d) ? d : (d?.results || [])) },
  );

  // ── Data: payout accounts ────────────────────────────────────────
  const { data: accounts, loading: accountsLoading, refetch: refetchAccounts } = useFetch(
    () => walletService.payoutAccounts(),
    { defaultValue: [], deps: [], transform: (d) => (Array.isArray(d) ? d : (d?.results || [])) },
  );

  // ── Data: payout history ─────────────────────────────────────────
  const { data: payouts, loading: payoutsLoading, refetch: refetchPayouts } = useFetch(
    () => walletService.payouts(),
    { defaultValue: [], deps: [], transform: (d) => (Array.isArray(d) ? d : (d?.results || [])) },
  );

  // ── Data: tips ───────────────────────────────────────────────────
  const { data: tipsReceived, loading: tipsReceivedLoading, refetch: refetchReceived } = useFetch(
    () => walletService.tipsReceived({ limit: 50 }),
    { defaultValue: [], deps: [], transform: (d) => (Array.isArray(d) ? d : (d?.results || [])) },
  );
  const { data: tipsSent, loading: tipsSentLoading, refetch: refetchSent } = useFetch(
    () => walletService.tipsSent({ limit: 50 }),
    { defaultValue: [], deps: [], transform: (d) => (Array.isArray(d) ? d : (d?.results || [])) },
  );

  // ── Data: refundable marketplace transactions ────────────────────
  // TransactionViewSet: buyer sees their own payment history. Only
  // PayPal transactions in succeeded/partially_refunded are refundable.
  const { data: marketTxns, loading: txnsLoading, refetch: refetchTxns } = useFetch(
    () => api.get('marketplace/transactions/', { params: { limit: 100 } }),
    { defaultValue: [], deps: [], transform: (d) => (Array.isArray(d) ? d : (d?.results || [])) },
  );

  const refundableTxns = (marketTxns || []).filter(
    (txn) => txn?.gateway === 'paypal' && (txn?.status === 'succeeded' || txn?.status === 'partially_refunded'),
  );

  // ── Modal state ──────────────────────────────────────────────────
  const [showDeposit, setShowDeposit] = useState(false);
  const [refundTxn, setRefundTxn] = useState(null);
  const [sendTipTarget, setSendTipTarget] = useState('');

  const refreshAll = useCallback(() => {
    refetchWallet();
    refetchTransactions();
    refetchAccounts();
    refetchPayouts();
    refetchReceived();
    refetchSent();
    refetchTxns();
  }, [refetchWallet, refetchTransactions, refetchAccounts, refetchPayouts, refetchReceived, refetchSent, refetchTxns]);

  const handlePayoutAccountAdd = useCallback(async (data) => {
    // PayPal OAuth: the account was already created server-side by the
    // callback endpoint — just refresh the list and show a success toast.
    if (data?._refresh) {
      refetchAccounts();
      showToast?.(isHt ? '✅ PayPal konekte!' : '✅ PayPal connected!', 'check-circle');
      return;
    }
    await api.post('wallet/payout-accounts/', data);
    showToast?.(isHt ? '✅ Kont peman ajoute!' : '✅ Payout account added!', 'check-circle');
    refetchAccounts();
  }, [refetchAccounts, showToast, isHt]);

  const handlePayoutAccountUpdate = useCallback(async (id, data) => {
    await api.patch(`wallet/payout-accounts/${id}/`, data);
    showToast?.(isHt ? '✅ Kont peman modifye!' : '✅ Payout account updated!', 'check-circle');
    refetchAccounts();
  }, [refetchAccounts, showToast, isHt]);

  const handlePayoutAccountDelete = useCallback(async (id) => {
    await api.delete(`wallet/payout-accounts/${id}/`);
    showToast?.(isHt ? '🗑️ Kont peman efase' : '🗑️ Payout account deleted', 'trash');
    refetchAccounts();
  }, [refetchAccounts, showToast, isHt]);

  const handleSetDefault = useCallback(async (id) => {
    await api.patch(`wallet/payout-accounts/${id}/`, { is_default: true });
    showToast?.(isHt ? '⭐ Kont defo mete' : '⭐ Default account set', 'star');
    refetchAccounts();
  }, [refetchAccounts, showToast, isHt]);

  // ── Derived stats for WalletOverview ─────────────────────────────
  const stats = useMemo(() => {
    const byType = {};
    (transactions || []).forEach((tx) => {
      byType[tx.tx_type || tx.type] = (byType[tx.tx_type || tx.type] || 0) + 1;
    });
    return {
      total_transactions: (transactions || []).length,
      payout_accounts: (accounts || []).length,
      total_withdrawals: (payouts || []).length,
      tips_received: (tipsReceived || []).length,
      tips_received_amount: (tipsReceived || []).reduce((s, x) => s + Number(x.amount || 0), 0),
      tips_sent: (tipsSent || []).length,
      tips_sent_amount: (tipsSent || []).reduce((s, x) => s + Number(x.amount || 0), 0),
    };
  }, [transactions, accounts, payouts, tipsReceived, tipsSent]);

  const loading = walletLoading || txLoading;

  if (loading) return <StudioSkeleton rows={4} />;

  return (
    <div className={styles.section}>
      <SectionHeader
        icon="fa-wallet"
        title={t.studio_wallet || 'Wallet'}
        lang={lang}
        help={{
          ht: 'Sant finansye ou — balans, tranzaksyon, kont peman (PayPal/bank/mobil), retrè, tips ak rembousman. Tout lajan ou fè sou Atelnyo vin isit la.',
          en: 'Your financial hub — balance, transactions, payout accounts (PayPal/bank/mobile), withdrawals, tips and refunds. Everything you earn on Atelnyo lands here.',
        }}
        tip={lang === 'ht'
          ? 'Ou dwe konekte yon kont peman anvan w ka retire lajan.'
          : 'You must connect a payout account before you can withdraw funds.'}
        action={
          <div className={styles.walletActions}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowDeposit(true)}
              title={isHt ? 'Depoze lajan ak PayPal' : 'Fund with PayPal'}
            >
              <i className="fas fa-circle-dollar-to-slot" aria-hidden="true" />
              {isHt ? 'Depoze' : 'Fund'}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowWithdrawModal(true)}
              disabled={Number(wallet?.balance || 0) <= 0}
              title={isHt ? 'Retire lajan' : 'Withdraw'}
            >
              <i className="fas fa-arrow-up" aria-hidden="true" />
              {isHt ? 'Retire' : 'Withdraw'}
            </button>
          </div>
        }
      />

      {/* ─── Tabs ─────────────────────────────────────────────────── */}
      <div className={styles.walletTabs} role="tablist" aria-label="Wallet sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`${styles.walletTab} ${activeTab === tab.id ? styles.walletTabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <i className={`fas ${tab.icon}`} aria-hidden="true" />
            {isHt ? tab.ht : tab.en}
          </button>
        ))}
      </div>

      <div className={styles.walletTabContent}>
        {activeTab === 'overview' && (
          <WalletOverview
            wallet={wallet}
            stats={stats}
            onWithdraw={() => setShowWithdrawModal(true)}
            onManagePayouts={() => setActiveTab('accounts')}
            onViewTransactions={() => setActiveTab('transactions')}
            lang={lang}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionList
            transactions={transactions}
            loading={txLoading}
            onRefresh={refetchTransactions}
            lang={lang}
          />
        )}

        {activeTab === 'accounts' && (
          <PayoutAccountManager
            accounts={accounts}
            onAdd={handlePayoutAccountAdd}
            onUpdate={handlePayoutAccountUpdate}
            onDelete={handlePayoutAccountDelete}
            onSetDefault={handleSetDefault}
            loading={accountsLoading}
            lang={lang}
          />
        )}

        {activeTab === 'payouts' && (
          <PayoutHistory
            payouts={payouts}
            loading={payoutsLoading}
            onRefresh={refetchPayouts}
            lang={lang}
          />
        )}

        {activeTab === 'tips' && (
          <TipsInbox
            tipsReceived={tipsReceived}
            tipsSent={tipsSent}
            loading={tipsReceivedLoading || tipsSentLoading}
            onRefresh={() => { refetchReceived(); refetchSent(); }}
            lang={lang}
            currentUserId={user?.id}
            showToast={showToast}
          />
        )}

        {activeTab === 'refunds' && (
          <div className={styles.refundPane}>
            <h3 className={styles.sectionSubtitle}>
              <i className="fas fa-rotate-left" aria-hidden="true" />
              {isHt ? 'Peman PayPal Ou Ka Ranbouse' : 'PayPal Payments You Can Refund'}
            </h3>
            {txnsLoading ? (
              <div className={styles.hintRow}><i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap chaje...' : 'Loading...'}</div>
            ) : refundableTxns.length === 0 ? (
              <EmptyState
                icon="fa-rotate-left"
                title={isHt ? 'Pa gen peman refoundable' : 'No refundable payments'}
              />
            ) : (
              <div className={styles.list}>
                {refundableTxns.map((txn) => (
                  <div key={txn.id} className={styles.listItem}>
                    <div className={`${styles.txIcon} ${styles.txPayment}`}>
                      <i className="fab fa-paypal" aria-hidden="true" />
                    </div>
                    <div className={styles.listBody}>
                      <div className={styles.listTitle}>
                        {txn.order ? `Order #${txn.order}` : `#${txn.id}`} · ${Number(txn.amount || 0).toFixed(2)}
                      </div>
                      <div className={styles.listMeta}>
                        <span className={`${styles.badge} ${styles.badgeCompleted}`}>
                          {txn.status}
                        </span>
                        {Number(txn.refunded_amount || 0) > 0 && (
                          <span>· {isHt ? 'Deja ranbouse' : 'Refunded'}: ${Number(txn.refunded_amount).toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setRefundTxn(txn)}
                    >
                      <i className="fas fa-rotate-left" aria-hidden="true" />
                      {isHt ? 'Refund' : 'Refund'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Modals ───────────────────────────────────────────────── */}
      {showDeposit && (
        <DepositModal
          lang={lang}
          showToast={showToast}
          onClose={() => setShowDeposit(false)}
          onSuccess={() => { refetchWallet(); refetchTransactions(); }}
        />
      )}

      {refundTxn && (
        <RefundModal
          txn={refundTxn}
          lang={lang}
          showToast={showToast}
          onClose={() => setRefundTxn(null)}
          onSuccess={() => { refetchTxns(); }}
        />
      )}
    </div>
  );
}
