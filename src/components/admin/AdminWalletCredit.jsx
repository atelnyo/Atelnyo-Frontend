/**
 * AdminWalletCredit — staff manual wallet funding.
 *
 * Route: /sheet/admin/wallets (staff-only, gated by RequireRole).
 *
 *   GET  /api/wallet/admin/lookup/?q=<username|email|id>
 *        → user + wallet balance + last 10 ledger rows + pending payouts
 *   POST /api/wallet/deposit/  { user_id, amount, description }
 *        → the new balance (so the panel never guesses)
 *
 * This is the ops path that works without PayPal: credits for testing,
 * support corrections, and refunds while the live PayPal app is not ready.
 * Money added here writes the same immutable WalletTransaction ledger as a
 * PayPal top-up, and the creator sees it on their next balance read.
 */
import React, { useState } from 'react';
import { walletService } from '../../services/api';
import { inlineText } from '../../utils/inlineI18n';

function fmtMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return `$${amount.toFixed(2)}`;
}

function fmtDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export default function AdminWalletCredit({ lang = 'en', showToast, onNavigate }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : inlineText(lang, en));

  const [query, setQuery] = useState('');
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [creditError, setCreditError] = useState('');
  const [crediting, setCrediting] = useState(false);

  const lookup = async (event) => {
    event?.preventDefault?.();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setLookupError('');
    setAccount(null);
    setCreditError('');
    try {
      const res = await walletService.adminLookup(q);
      setAccount(res?.data || null);
    } catch (err) {
      setLookupError(
        err?.response?.data?.detail
        || t('Could not find that user.', 'Pa t kapab jwenn itilizatè sa a.'),
      );
    } finally {
      setLoading(false);
    }
  };

  const credit = async (event) => {
    event.preventDefault();
    if (!account?.user?.id) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setCreditError(t('Enter an amount greater than zero.', 'Antre yon montan ki pi gran pase zewo.'));
      return;
    }
    setCrediting(true);
    setCreditError('');
    try {
      const res = await walletService.adminCredit({
        user_id: account.user.id,
        amount: value,
        description: description.trim() || undefined,
      });
      const data = res?.data || {};
      setAccount((prev) => (
        prev ? { ...prev, wallet: { ...prev.wallet, balance: data.balance } } : prev
      ));
      setAmount('');
      setDescription('');
      showToast?.(
        t(
          `Wallet credited. New balance ${fmtMoney(data.balance)}.`,
          `Bous kredite. Nouvo balans ${fmtMoney(data.balance)}.`,
        ),
        'check-circle',
      );
    } catch (err) {
      setCreditError(
        err?.response?.data?.detail
        || err?.response?.data?.error
        || err?.message
        || t('Could not credit the wallet.', 'Pa t kapab kredite bous la.'),
      );
    } finally {
      setCrediting(false);
    }
  };

  const transactions = Array.isArray(account?.transactions) ? account.transactions : [];

  return (
    <div className="ad-dash-shell">
      <div className="ad-dash-header">
        <div className="ad-dash-header-left">
          <button
            type="button"
            className="ad-dash-back"
            onClick={() => onNavigate?.(-1)}
            aria-label="Back"
          >
            <i className="fas fa-arrow-left" />
          </button>
          <div>
            <h1 className="ad-dash-title">
              <i className="fas fa-wallet" /> {t('Wallet credit', 'Kredite bous')}
            </h1>
            <p className="ad-dash-subtitle">
              {t(
                'Find a creator and add funds to their wallet. Works without PayPal — every credit is written to the same ledger.',
                'Jwenn yon kreyatè epi ajoute lajan nan bous li. Li mache san PayPal — chak kredi ekri nan menm liv la.',
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="ad-dash-body">
        <form className="ad-dash-panel" onSubmit={lookup} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', flexWrap: 'wrap' }}>
            <i className="fas fa-search" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }} />
            <input
              type="search"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setLookupError(''); }}
              placeholder={t('Username, email or user id', 'Non itilizatè, imèl oswa id')}
              style={{ border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.9rem', flex: 1, minWidth: 200 }}
            />
            <button
              type="submit"
              className="ad-dash-btn ad-dash-btn--primary"
              disabled={loading || !query.trim()}
              style={{ whiteSpace: 'nowrap' }}
            >
              {loading
                ? <i className="fas fa-spinner fa-spin" />
                : <i className="fas fa-magnifying-glass" />}{' '}
              {t('Find wallet', 'Jwenn bous')}
            </button>
          </div>
        </form>

        {lookupError && (
          <div className="ad-dash-panel" style={{ padding: '12px 16px', marginBottom: 16, color: '#b91c1c' }}>
            <i className="fas fa-circle-exclamation" /> {lookupError}
          </div>
        )}

        {account && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div className="ad-dash-panel" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                  {t('Creator', 'Kreyatè')}
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 4 }}>
                  {account.user?.username || '—'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                  {account.user?.email || '—'} · #{account.user?.id}
                </div>
              </div>
              <div className="ad-dash-panel" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                  {t('Wallet balance', 'Balans bous')}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: 4 }}>
                  {fmtMoney(account.wallet?.balance)}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                  {t(
                    `${account.pending_payouts || 0} pending withdrawal(s)`,
                    `${account.pending_payouts || 0} retrè annatant`,
                  )}
                </div>
              </div>
            </div>

            <form className="ad-dash-panel" onSubmit={credit} noValidate style={{ marginBottom: 16, padding: 16 }}>
              <h2 style={{ margin: '0 0 12px', fontSize: '0.95rem' }}>
                <i className="fas fa-circle-plus" /> {t('Add funds', 'Ajoute lajan')}
              </h2>
              {creditError && (
                <div style={{ color: '#b91c1c', fontSize: '0.82rem', marginBottom: 10 }}>
                  <i className="fas fa-circle-exclamation" /> {creditError}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {t('Amount (USD)', 'Montan (USD)')}
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(event) => { setAmount(event.target.value); setCreditError(''); }}
                    placeholder="25.00"
                    style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-subtle, rgba(0,0,0,0.12))', background: 'transparent', color: 'var(--text-primary)' }}
                  />
                </label>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {t('Note (shown to the creator)', 'Nòt (kreyatè a wè l)')}
                  <input
                    type="text"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder={t('Support credit', 'Kredi sipò')}
                    style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-subtle, rgba(0,0,0,0.12))', background: 'transparent', color: 'var(--text-primary)' }}
                  />
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button
                  type="submit"
                  className="ad-dash-btn ad-dash-btn--primary"
                  disabled={crediting || !amount}
                >
                  {crediting
                    ? <i className="fas fa-spinner fa-spin" />
                    : <i className="fas fa-circle-plus" />}{' '}
                  {t('Credit wallet', 'Kredite bous')}
                </button>
              </div>
            </form>

            <div className="ad-dash-panel" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '10px 12px' }}>{t('Type', 'Tip')}</th>
                    <th style={{ padding: '10px 12px' }}>{t('Amount', 'Montan')}</th>
                    <th style={{ padding: '10px 12px' }}>{t('Description', 'Deskripsyon')}</th>
                    <th style={{ padding: '10px 12px' }}>{t('Balance after', 'Balans apre')}</th>
                    <th style={{ padding: '10px 12px' }}>{t('Date', 'Dat')}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        {t('No transactions yet.', 'Poko gen tranzaksyon.')}
                      </td>
                    </tr>
                  ) : transactions.map((txn) => (
                    <tr key={txn.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 12px' }}>{txn.tx_type}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{fmtMoney(txn.amount)}</td>
                      <td style={{ padding: '10px 12px' }}>{txn.description || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>{fmtMoney(txn.running_balance)}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{fmtDate(txn.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
