/**
 * AdminPendingOrders — unpaid Store orders with a manual cancel action.
 *
 * Route: /sheet/admin/pending-orders (staff-only, gated by RequireRole).
 *
 *   GET  /api/admin/pending-orders/?page=&search=&min_age_minutes=
 *   POST /api/admin/pending-orders/<id>/cancel/  { notify: true }
 *
 * Cancelling restores the stock checkout reserved, fails the pending
 * provider transaction and emails the buyer an expiry notice — the same
 * behaviour as the scheduled `cancel_abandoned_orders` sweep.
 */
import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { inlineText } from '../../utils/inlineI18n';

const PAGE_SIZE = 20;
const AGE_FILTERS = [
  { value: '', label: 'Any age' },
  { value: '60', label: 'Older than 1h' },
  { value: '360', label: 'Older than 6h' },
  { value: '1440', label: 'Older than 24h' },
];

function fmtMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return `$${amount.toFixed(2)}`;
}

function fmtAge(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value < 60) return `${Math.floor(value)}m`;
  if (value < 1440) return `${Math.floor(value / 60)}h`;
  const days = Math.floor(value / 1440);
  const hours = Math.floor((value % 1440) / 60);
  return `${days}d ${hours}h`;
}

function fmtDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export default function AdminPendingOrders({ lang = 'en', showToast, onNavigate }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : inlineText(lang, en));

  const [orders, setOrders] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [draftSearch, setDraftSearch] = useState('');
  const [draftAge, setDraftAge] = useState('');
  const [filters, setFilters] = useState({ search: '', minAge: '' });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = { page };
    if (filters.search) params.search = filters.search;
    if (filters.minAge) params.min_age_minutes = filters.minAge;
    api.get('admin/pending-orders/', { params })
      .then((res) => {
        if (cancelled) return;
        const data = res?.data ?? {};
        setOrders(Array.isArray(data) ? data : data.results || []);
        setCount(Array.isArray(data) ? data.length : data.count || 0);
      })
      .catch(() => {
        if (cancelled) return;
        showToast?.(
          t('Could not load pending orders.', 'Pa t kapab chaje kòmand annatant yo.'),
          'exclamation-triangle',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // `t`/`showToast` are intentionally not dependencies: only the query
    // and the interface language should trigger a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters, lang, reloadTick]);

  const applyFilters = (event) => {
    event.preventDefault();
    setPage(1);
    setFilters({ search: draftSearch.trim(), minAge: draftAge });
  };

  const cancelOrder = async (order) => {
    const label = `#${order.id}`;
    const confirmed = window.confirm(
      isHt
        ? `Anile kòmand ${label}? Stock la ap retounen epi achtè a ap resevwa yon imèl.`
        : `Cancel order ${label}? Stock will be restored and the buyer will be emailed.`,
    );
    if (!confirmed) return;

    setBusyId(order.id);
    try {
      const res = await api.post(`admin/pending-orders/${order.id}/cancel/`, {
        notify: true,
      });
      const emailed = res?.data?.email_sent;
      showToast?.(
        isHt
          ? `Kòmand ${label} anile.${emailed ? ' Imèl voye.' : ''}`
          : `Order ${label} cancelled.${emailed ? ' Buyer emailed.' : ''}`,
        'check-circle',
      );
      if (orders.length === 1 && page > 1) {
        setPage((prev) => Math.max(1, prev - 1));
      } else {
        setOrders((prev) => prev.filter((row) => row.id !== order.id));
        setCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      showToast?.(
        detail || t('Could not cancel the order.', 'Pa t kapab anile kòmand lan.'),
        'exclamation-triangle',
      );
    } finally {
      setBusyId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

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
              <i className="fas fa-hourglass-half" />{' '}
              {t('Pending orders', 'Kòmand annatant')}
            </h1>
            <p className="ad-dash-subtitle">
              {t(
                'Unpaid Store orders. Cancel one manually to release its stock.',
                'Kòmand Store ki poko peye. Anile yon sèl manyèlman pou lage stock li.',
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
        <form className="ad-dash-panel" onSubmit={applyFilters} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', flexWrap: 'wrap' }}>
            <i className="fas fa-search" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }} />
            <input
              type="search"
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder={t('Order id, buyer or email...', 'ID kòmand, achtè oswa imèl...')}
              style={{ border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.9rem', flex: 1, minWidth: 180 }}
            />
            <select
              value={draftAge}
              onChange={(event) => setDraftAge(event.target.value)}
              style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.85rem' }}
            >
              {AGE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {isHt
                    ? { '': 'Tout laj', '60': 'Plis pase 1è', '360': 'Plis pase 6è', '1440': 'Plis pase 24è' }[option.value]
                    : inlineText(lang, option.label)}
                </option>
              ))}
            </select>
            <button type="submit" className="ad-dash-btn ad-dash-btn--primary" style={{ whiteSpace: 'nowrap' }}>
              <i className="fas fa-filter" /> {t('Filter', 'Filtre')}
            </button>
          </div>
        </form>

        <div className="ad-dash-panel" style={{ marginBottom: 12, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {t(
              `${count} unpaid order${count === 1 ? '' : 's'}`,
              `${count} kòmand ki poko peye`,
            )}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
            {t('Oldest first', 'Pi ansyen an premye')}
          </span>
        </div>

        {loading ? (
          <div className="ad-dash-panel" style={{ padding: 40, textAlign: 'center' }}>
            <i className="fas fa-spinner fa-spin" /> {t('Loading...', 'Chaje...')}
          </div>
        ) : orders.length === 0 ? (
          <div className="ad-dash-panel ad-dash-panel-empty" style={{ padding: 40, textAlign: 'center' }}>
            <i className="fas fa-check-circle" style={{ fontSize: '1.6rem', opacity: 0.35 }} />
            <p>{t('No unpaid pending orders.', 'Pa gen kòmand annatant ki poko peye.')}</p>
          </div>
        ) : (
          <div className="ad-dash-panel" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '10px 12px' }}>{t('Order', 'Kòmand')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('Buyer', 'Achtè')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('Items', 'Atik')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('Total', 'Total')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('Age', 'Laj')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('Payment', 'Peman')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('Auto-cancel', 'Anilasyon otomatik')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('Actions', 'Aksyon')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} style={{ borderTop: '1px solid var(--border-subtle)', verticalAlign: 'top' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                      <a href={`/account/orders/${order.id}`} target="_blank" rel="noopener noreferrer">
                        #{order.id}
                      </a>
                      <div style={{ fontWeight: 400, color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                        {fmtDate(order.created_at)}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div>{order.buyer_email || '—'}</div>
                      {order.buyer_name && (
                        <div style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                          {order.buyer_name}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', maxWidth: 260 }}>
                      {(order.items || []).map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                      {!order.items?.length && '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{fmtMoney(order.total)}</td>
                    <td style={{ padding: '10px 12px' }}>{fmtAge(order.age_minutes)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {order.last_payment_status
                        ? (
                          <span style={{ fontSize: '0.75rem', padding: '1px 6px', borderRadius: 99, background: 'var(--bg-highlight, rgba(0,0,0,0.05))' }}>
                            {order.last_payment_status}
                          </span>
                        )
                        : t('no attempt', 'pa gen tantativ')}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                      {fmtDate(order.auto_cancel_at)}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <button
                        type="button"
                        onClick={() => cancelOrder(order)}
                        disabled={busyId === order.id}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid rgba(239,68,68,0.35)',
                          background: 'rgba(239,68,68,0.06)',
                          color: '#ef4444',
                          cursor: busyId === order.id ? 'wait' : 'pointer',
                          fontSize: '0.78rem',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <i className={`fas ${busyId === order.id ? 'fa-spinner fa-spin' : 'fa-ban'}`} />{' '}
                        {t('Cancel', 'Anile')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <button
              type="button"
              className="ad-dash-btn"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || loading}
            >
              <i className="fas fa-chevron-left" /> {t('Previous', 'Anvan')}
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              className="ad-dash-btn"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages || loading}
            >
              {t('Next', 'Apre')} <i className="fas fa-chevron-right" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
