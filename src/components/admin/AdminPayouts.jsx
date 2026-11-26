/**
 * AdminPayouts — the staff withdrawal queue.
 *
 * Route: /sheet/admin/payouts (staff-only, gated by RequireRole).
 *
 *   GET  /api/wallet/payouts/queue/?status=&limit=
 *        → rows (oldest pending first) + platform-wide finance totals
 *   POST /api/wallet/payouts/<id>/process/  { action, external_ref }
 *        complete → the creator was paid outside Atelnyo (reference kept)
 *        fail     → the reserved amount returns to the creator's wallet
 *
 * Paying a creator is a manual transfer: the row carries the destination
 * (saved payout account or the details typed with the request) so finance
 * knows where the money must go before it marks the request paid.
 */
import React, { useEffect, useState } from 'react';
import { walletService } from '../../services/api';
import { inlineText } from '../../utils/inlineI18n';

const STATUS_TABS = [
  { value: 'pending', en: 'Pending', ht: 'Annatant' },
  { value: 'processing', en: 'Processing', ht: 'Ap trete' },
  { value: 'completed', en: 'Completed', ht: 'Konplete' },
  { value: 'failed', en: 'Failed', ht: 'Echek' },
];

const STATUS_STYLE = {
  pending: { color: '#b45309', bg: 'rgba(245,158,11,0.14)' },
  processing: { color: '#0369a1', bg: 'rgba(56,189,248,0.14)' },
  completed: { color: '#047857', bg: 'rgba(16,185,129,0.14)' },
  failed: { color: '#b91c1c', bg: 'rgba(239,68,68,0.12)' },
};

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

function fmtAge(value) {
  if (!value) return '';
  const started = new Date(value).getTime();
  if (Number.isNaN(started)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - started) / 60000));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

function destinationOf(payout) {
  return payout?.paypal_email || payout?.account_label || '';
}

function StatCard({ icon, label, value, hint }) {
  return (
    <div className="ad-dash-panel" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
        <i className={`fas ${icon}`} /> {label}
      </div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: 4 }}>{value}</div>
      {hint && <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{hint}</div>}
    </div>
  );
}

export default function AdminPayouts({ lang = 'en', showToast, onNavigate }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : inlineText(lang, en));

  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [action, setAction] = useState(null); // { payout, mode: 'complete' | 'fail' }
  const [externalRef, setExternalRef] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    walletService.payoutQueue({ status, limit: 50 })
      .then((res) => {
        if (cancelled) return;
        const data = res?.data ?? {};
        setRows(Array.isArray(data.results) ? data.results : []);
        setStats(data.stats || null);
        setHasMore(Boolean(data.has_more));
      })
      .catch(() => {
        if (cancelled) return;
        setRows([]);
        showToast?.(
          t('Could not load the payout queue.', 'Pa t kapab chaje fil peman an.'),
          'exclamation-triangle',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // `t`/`showToast` are not dependencies: only the tab and the language
    // should trigger a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, reloadTick, lang]);

  const openAction = (payout, mode) => {
    setAction({ payout, mode });
    setExternalRef('');
  };

  const submitAction = async () => {
    if (!action) return;
    const { payout, mode } = action;
    setBusyId(payout.id);
    try {
      await walletService.processPayout(
        payout.id,
        mode === 'complete'
          ? { action: 'complete', external_ref: externalRef.trim() }
          : { action: 'fail' },
      );
      showToast?.(
        mode === 'complete'
          ? t(`Payout #${payout.id} marked paid.`, `Payout #${payout.id} make kòm peye.`)
          : t(
            `Payout #${payout.id} failed — the funds went back to the creator.`,
            `Payout #${payout.id} echwe — lajan an retounen bay kreyatè a.`,
          ),
        'check-circle',
      );
      setAction(null);
      setExternalRef('');
      setReloadTick((prev) => prev + 1);
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail
          || t('Could not update the payout.', 'Pa t kapab mete peman an ajou.'),
        'exclamation-triangle',
      );
    } finally {
      setBusyId(null);
    }
  };

  const pendingHint = stats?.oldest_pending_at
    ? t(
      `Oldest waiting ${fmtAge(stats.oldest_pending_at)}`,
      `Pi ansyen ap tann ${fmtAge(stats.oldest_pending_at)}`,
    )
    : t('Nothing waiting', 'Anyen pa tann');

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
              <i className="fas fa-money-bill-transfer" />{' '}
              {t('Payout queue', 'Fil peman')}
            </h1>
            <p className="ad-dash-subtitle">
              {t(
                'Withdrawals waiting to be paid. Send the money to the destination, then mark the request paid.',
                'Retrè ki tann pou peye. Voye lajan an nan destinasyon an, epi make demann lan kòm peye.',
              )}
            </p>
          </div>
        </div>
        <div className="ad-dash-header-right">
          <button
            type="button"
            className="ad-dash-refresh"
            onClick={() => setReloadTick((prev) => prev + 1)}
            title={t('Refresh', 'Rafrechi')}
          >
            <i className="fas fa-sync" />
          </button>
        </div>
      </div>

      <div className="ad-dash-body">
        {stats && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <StatCard
              icon="fa-hourglass-half"
              label={t('Pending', 'Annatant')}
              value={fmtMoney(stats.pending_amount)}
              hint={`${stats.pending_count} · ${pendingHint}`}
            />
            <StatCard
              icon="fa-check-circle"
              label={t('Paid (30 days)', 'Peye (30 jou)')}
              value={fmtMoney(stats.completed_30d_amount)}
              hint={t(`${stats.completed_30d_count} withdrawals`, `${stats.completed_30d_count} retrè`)}
            />
            <StatCard
              icon="fa-rotate-left"
              label={t('Failed', 'Echwe')}
              value={fmtMoney(stats.failed_amount)}
              hint={t(`${stats.failed_count} refunded`, `${stats.failed_count} ranbouse`)}
            />
          </div>
        )}

        <div
          role="tablist"
          aria-label={t('Payout status', 'Estati peman')}
          style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}
        >
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={status === tab.value}
              className={`ad-dash-btn ${status === tab.value ? 'ad-dash-btn--primary' : ''}`}
              onClick={() => setStatus(tab.value)}
            >
              {isHt ? tab.ht : inlineText(lang, tab.en)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="ad-dash-panel" style={{ padding: 40, textAlign: 'center' }}>
            <i className="fas fa-spinner fa-spin" /> {t('Loading...', 'Chaje...')}
          </div>
        ) : rows.length === 0 ? (
          <div className="ad-dash-panel ad-dash-panel-empty" style={{ padding: 40, textAlign: 'center' }}>
            <i className="fas fa-check-circle" style={{ fontSize: '1.6rem', opacity: 0.35 }} />
            <p>{t('Nothing in this queue.', 'Anyen nan fil sa a.')}</p>
          </div>
        ) : (
          <div className="ad-dash-panel" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '10px 12px' }}>{t('Request', 'Demann')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('Creator', 'Kreyatè')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('Amount', 'Montan')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('Destination', 'Destinasyon')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('Requested', 'Mande')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('Status', 'Estati')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('Actions', 'Aksyon')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((payout) => {
                  const badge = STATUS_STYLE[payout.status] || STATUS_STYLE.pending;
                  const open = payout.status === 'pending' || payout.status === 'processing';
                  return (
                    <tr key={payout.id} style={{ borderTop: '1px solid var(--border-subtle)', verticalAlign: 'top' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>#{payout.id}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div>{payout.wallet_user || '—'}</div>
                        {payout.wallet_email && (
                          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>{payout.wallet_email}</div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{fmtMoney(payout.amount)}</td>
                      <td style={{ padding: '10px 12px', maxWidth: 260 }}>
                        <div>{destinationOf(payout) || t('no saved account', 'pa gen kont anrejistre')}</div>
                        {payout.payout_details && (
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', wordBreak: 'break-word' }}>
                            {payout.payout_details}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                        {fmtDate(payout.requested_at)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 99, color: badge.color, background: badge.bg, whiteSpace: 'nowrap' }}>
                          {payout.status}
                        </span>
                        {payout.external_ref && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                            {payout.external_ref}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {open ? (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => openAction(payout, 'complete')}
                              disabled={busyId === payout.id}
                              style={{
                                padding: '6px 10px',
                                borderRadius: 6,
                                border: '1px solid rgba(16,185,129,0.35)',
                                background: 'rgba(16,185,129,0.08)',
                                color: '#047857',
                                cursor: busyId === payout.id ? 'wait' : 'pointer',
                                fontSize: '0.78rem',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <i className="fas fa-check" /> {t('Mark paid', 'Make peye')}
                            </button>
                            <button
                              type="button"
                              onClick={() => openAction(payout, 'fail')}
                              disabled={busyId === payout.id}
                              style={{
                                padding: '6px 10px',
                                borderRadius: 6,
                                border: '1px solid rgba(239,68,68,0.35)',
                                background: 'rgba(239,68,68,0.06)',
                                color: '#ef4444',
                                cursor: busyId === payout.id ? 'wait' : 'pointer',
                                fontSize: '0.78rem',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <i className="fas fa-ban" /> {t('Mark failed', 'Make echwe')}
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                            {fmtDate(payout.processed_at)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {hasMore && (
          <p style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
            {t('Showing the first 50 rows. Pick a status tab to narrow the list.', 'Premye 50 liy yo. Chwazi yon tab estati pou wè mwens.')}
          </p>
        )}
      </div>

      {action && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: 16,
          }}
        >
          <div className="ad-dash-panel" style={{ width: '100%', maxWidth: 430, padding: 20 }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '1rem' }}>
              {action.mode === 'complete'
                ? t('Mark payout paid', 'Make peman an kòm peye')
                : t('Mark payout failed', 'Make peman an kòm echwe')}
            </h2>
            <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              #{action.payout.id} · {fmtMoney(action.payout.amount)} · {action.payout.wallet_user}
              <br />
              {action.mode === 'complete'
                ? t(
                  'Send the money to the destination first, then paste the provider reference so the books match.',
                  'Voye lajan an nan destinasyon an anvan, epi kole referans peman an pou liv yo matche.',
                )
                : t(
                  'The reserved amount goes straight back to the creator’s wallet.',
                  'Montan ki rezève a retounen nan bous kreyatè a.',
                )}
            </p>
            <div style={{ fontSize: '0.82rem', marginBottom: 12 }}>
              <div>
                {t('Destination', 'Destinasyon')}:{' '}
                <strong>{destinationOf(action.payout) || '—'}</strong>
              </div>
              {action.payout.payout_details && (
                <div style={{ color: 'var(--text-secondary)' }}>{action.payout.payout_details}</div>
              )}
            </div>
            {action.mode === 'complete' && (
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
                {t('Provider reference (PayPal transaction id)', 'Referans peman (id tranzaksyon PayPal)')}
                <input
                  type="text"
                  value={externalRef}
                  onChange={(event) => setExternalRef(event.target.value)}
                  placeholder="PAY-..."
                  style={{
                    width: '100%',
                    marginTop: 4,
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                  }}
                />
              </label>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="ad-dash-btn"
                onClick={() => setAction(null)}
                disabled={busyId != null}
              >
                {t('Cancel', 'Anile')}
              </button>
              <button
                type="button"
                className="ad-dash-btn ad-dash-btn--primary"
                onClick={submitAction}
                disabled={busyId != null}
              >
                {busyId != null
                  ? <i className="fas fa-spinner fa-spin" />
                  : <i className={`fas ${action.mode === 'complete' ? 'fa-check' : 'fa-ban'}`} />}{' '}
                {action.mode === 'complete' ? t('Confirm paid', 'Konfime peye') : t('Confirm failed', 'Konfime echwe')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
