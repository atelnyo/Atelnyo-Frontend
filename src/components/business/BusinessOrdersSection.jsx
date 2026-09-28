/**
 * src/components/business/BusinessOrdersSection.jsx
 *
 * Phase 5 — owner-side order management for ONE Business Profile.
 *
 * Lists the business's orders (leads), lets the owner transition the
 * lead status (new → contacted → fulfilled / cancelled), refund PAID
 * orders, and shows the wallet-settled revenue summary.
 *
 * Data flow
 * ---------
 *   GET  /api/business/orders/?profile=<slug>       — my orders
 *   GET  /api/business/orders/revenue/?profile=<slug> — revenue summary
 *   PATCH /api/business/orders/<id>/status/         — lead transition
 *   POST /api/business/orders/<id>/refund/          — refund a paid order
 */
import React, { useEffect, useState } from 'react';
import { businessOrderService } from '../../services/api';

const STATUS_FLOW = ['new', 'contacted', 'fulfilled', 'cancelled'];

export default function BusinessOrdersSection({
  lang = 'ht', t = {}, showToast, profile,
}) {
  const isHt = lang === 'ht';
  const [orders, setOrders] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const statusLabel = (s) => ({
    new: isHt ? 'Nouvo' : 'New',
    contacted: isHt ? 'Kontakte' : 'Contacted',
    fulfilled: isHt ? 'Ranpli' : 'Fulfilled',
    cancelled: isHt ? 'Anile' : 'Cancelled',
  }[s] || s);

  const payLabel = (p) => ({
    unpaid: isHt ? 'Pa peye' : 'Unpaid',
    paid: isHt ? 'Peye' : 'Paid',
    refunded: isHt ? 'Rembouse' : 'Refunded',
  }[p] || p);

  const load = async () => {
    if (!profile?.slug) return;
    setLoading(true);
    try {
      const [ordersRes, revenueRes] = await Promise.all([
        businessOrderService.list(profile.slug),
        businessOrderService.revenue(profile.slug),
      ]);
      const list = Array.isArray(ordersRes?.data) ? ordersRes.data : (ordersRes?.data?.results || []);
      const rev = revenueRes?.data?.data ?? revenueRes?.data ?? null;
      setOrders(list);
      setRevenue(rev);
    } catch {
      setOrders([]);
      setRevenue(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [profile?.slug]);

  const runStatus = async (order, next) => {
    setBusyId(`status_${order.id}`);
    try {
      const res = await businessOrderService.status(order.id, { status: next });
      const data = res?.data?.data ?? res?.data ?? null;
      if (data?.id) {
        setOrders((prev) => prev.map((o) => (o.id === data.id ? data : o)));
      }
      showToast?.(
        isHt ? 'Estati kòmand la mete ajou.' : 'Order status updated.',
        'check-circle',
      );
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail || (isHt ? 'Pa t ka mete ajou estati a.' : 'Could not update status.'),
        'circle-exclamation',
      );
    } finally {
      setBusyId(null);
    }
  };

  const runRefund = async (order) => {
    if (!window.confirm(
      isHt
        ? `Rembouse kòmand #${order.id} (${order.item_name})? Revni a ap retire nan Wallet ou.`
        : `Refund order #${order.id} (${order.item_name})? The revenue will leave your Wallet.`,
    )) return;
    setBusyId(`refund_${order.id}`);
    try {
      const res = await businessOrderService.refund(order.id);
      const data = res?.data?.data ?? res?.data ?? null;
      if (data?.id) {
        setOrders((prev) => prev.map((o) => (o.id === data.id ? data : o)));
      }
      showToast?.(
        isHt ? 'Kòmand la rembouse.' : 'Order refunded.',
        'check-circle',
      );
      await load(); // refresh the revenue summary too
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail || (isHt ? 'Rembousman an pa t mache.' : 'Refund failed.'),
        'circle-exclamation',
      );
    } finally {
      setBusyId(null);
    }
  };

  const money = (n) => Number(n ?? 0).toLocaleString(isHt ? 'fr-HT' : 'en-US', {
    minimumFractionDigits: 2,
  });

  if (loading) {
    return (
      <div className="biz-orders" data-testid="business-orders">
        <div className="biz-catalog-loading">
          <i className="fas fa-spinner fa-pulse" aria-hidden="true" />
        </div>
      </div>
    );
  }

  return (
    <div className="biz-orders" data-testid="business-orders">
      <div className="biz-catalog-header">
        <div>
          <h3 className="biz-catalog-title">
            <i className="fas fa-cart-shopping" aria-hidden="true" />
            {t?.business_orders_title || (isHt ? 'Kòmand & Revni' : 'Orders & Revenue')}
          </h3>
          <p className="biz-catalog-hint">
            {t?.business_orders_hint || (isHt
              ? 'Kòmand sa yo se lead biznis ou yo. Kliyan peye ak balans Wallet yo lè Seller aktive.'
              : 'These orders are your business leads. Customers pay with their Wallet balance when Seller is active.')}
          </p>
        </div>
      </div>

      {/* ─── Revenue summary ─────────────────────────────────────── */}
      {revenue && (
        <div className="biz-revenue-grid" data-testid="business-revenue">
          <div className="biz-revenue-card biz-revenue-primary">
            <span className="biz-revenue-label">
              {t?.business_revenue_total || (isHt ? 'Revni total (peye)' : 'Total revenue (paid)')}
            </span>
            <span className="biz-revenue-value" data-testid="business-revenue-total">
              {money(revenue.total_revenue)} {revenue.currency || 'USD'}
            </span>
          </div>
          <div className="biz-revenue-card">
            <span className="biz-revenue-label">{isHt ? 'Peye' : 'Paid'}</span>
            <span className="biz-revenue-value">{revenue.orders?.paid ?? 0}</span>
          </div>
          <div className="biz-revenue-card">
            <span className="biz-revenue-label">{isHt ? 'Pa peye' : 'Unpaid'}</span>
            <span className="biz-revenue-value">{revenue.orders?.unpaid ?? 0}</span>
          </div>
          <div className="biz-revenue-card">
            <span className="biz-revenue-label">{isHt ? 'Rembouse' : 'Refunded'}</span>
            <span className="biz-revenue-value">{revenue.orders?.refunded ?? 0}</span>
          </div>
        </div>
      )}

      {/* ─── Orders list ─────────────────────────────────────────── */}
      {orders.length === 0 ? (
        <div className="biz-catalog-empty" data-testid="business-orders-empty">
          <i className="fas fa-inbox" aria-hidden="true" />
          <h4>{isHt ? 'Pa gen kòmand ankò' : 'No orders yet'}</h4>
          <p>{isHt
            ? 'Lè yon kliyan kòmande yon atik nan paj piblik ou, li ap parèt isit la.'
            : 'When a customer orders an item on your public page, it will appear here.'}</p>
        </div>
      ) : (
        <div className="biz-orders-list">
          {orders.map((order) => (
            <div className="biz-order-card" key={order.id} data-testid="business-order-item">
              <div className="biz-order-main">
                <div className="biz-order-title-row">
                  <span className="biz-order-name">{order.item_name}</span>
                  <span
                    className="biz-status-pill"
                    style={{
                      background: `${order.payment_status === 'paid' ? '#34d399' : (order.payment_status === 'refunded' ? '#94a3b8' : '#fbbf24')}1f`,
                      color: order.payment_status === 'paid' ? '#34d399' : (order.payment_status === 'refunded' ? '#94a3b8' : '#fbbf24'),
                      border: `1px solid ${order.payment_status === 'paid' ? '#34d399' : (order.payment_status === 'refunded' ? '#94a3b8' : '#fbbf24')}55`,
                    }}
                  >
                    {payLabel(order.payment_status)}
                  </span>
                </div>
                <p className="biz-order-meta">
                  <i className="fas fa-user" aria-hidden="true" /> {order.customer_username}
                  {' · '}<i className="fas fa-cubes" aria-hidden="true" /> {order.quantity}×{' '}
                  {money(order.item_price)} {order.currency}
                  {' · '}<strong>{money(order.total)} {order.currency}</strong>
                  {' · '}
                  <span className={`biz-order-lead biz-order-lead-${order.status}`}>
                    {statusLabel(order.status)}
                  </span>
                </p>
                {order.note && <p className="biz-order-note">“{order.note}”</p>}
              </div>

              <div className="biz-order-actions">
                {order.payment_status === 'paid' && (
                  <button
                    type="button"
                    className="biz-btn biz-btn-danger biz-btn-sm"
                    onClick={() => runRefund(order)}
                    disabled={busyId === `refund_${order.id}`}
                    data-testid="business-order-refund"
                  >
                    <i className={`fas ${busyId === `refund_${order.id}` ? 'fa-spinner fa-spin' : 'fa-rotate-left'}`} aria-hidden="true" />
                    {isHt ? 'Rembouse' : 'Refund'}
                  </button>
                )}
                {STATUS_FLOW.map((next) => (
                  next !== order.status && (
                    <button
                      type="button"
                      key={next}
                      className="biz-btn biz-btn-ghost biz-btn-sm"
                      onClick={() => runStatus(order, next)}
                      disabled={busyId === `status_${order.id}`}
                      data-testid={`business-order-status-${next}`}
                    >
                      {statusLabel(next)}
                    </button>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
