import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { storeService } from './storeService';
import { useAuthStore } from './useAuthStore';
import { storeOrderStatus } from '../components/business/storeOrderStatus';
import { formatDate, money } from './storeFormat';

export default function StoreAccountPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  // null = still loading, [] = loaded and empty.
  const [orders, setOrders] = useState(null);
  const [ordersError, setOrdersError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!user) {
      return undefined;
    }
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrders(null);
    setOrdersError(false);
    storeService.listOrders()
      .then((res) => {
        if (cancelled) {
          return;
        }
        const data = res?.data ?? res;
        const rows = Array.isArray(data) ? data : (data?.results || []);
        setOrders(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setOrders([]);
        setOrdersError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, reloadTick]);

  if (!user) {
    return <Navigate to="/store/login?next=%2Faccount" replace />;
  }

  const onSignOut = async () => {
    await logout();
    navigate('/store', { replace: true });
  };

  return (
    <section className="store-account">
      <Helmet>
        <title>Account · Atelnyo Store</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="store-account__head">
        <h1 className="store-title">Account</h1>
        <button type="button" className="store-btn store-btn--ghost" onClick={onSignOut}>
          Sign out
        </button>
      </div>
      <dl>
        <dt>Name</dt>
        <dd>{user.display_name || user.username || '—'}</dd>
        <dt>Email</dt>
        <dd>{user.email || '—'}</dd>
      </dl>

      <h2 className="store-account__section-title">My orders</h2>
      {orders === null && <p className="store-state" role="status">Loading your orders…</p>}
      {ordersError && (
        <p className="store-state store-state--error" role="alert">
          Your orders could not be loaded.{' '}
          <button
            type="button"
            className="store-btn store-btn--ghost"
            onClick={() => setReloadTick((n) => n + 1)}
          >
            Try again
          </button>
        </p>
      )}
      {orders && !ordersError && orders.length === 0 && (
        <p className="store-state">
          No orders yet. <Link to="/store">Browse the Store</Link>.
        </p>
      )}
      {orders && orders.length > 0 && (
        <ul className="store-account__orders">
          {orders.map((order) => {
            const status = storeOrderStatus(order.status, false);
            const items = Array.isArray(order.items) ? order.items : [];
            return (
              <li className="store-account__order" key={order.id}>
                <div className="store-account__order-head">
                  <span>
                    <Link
                      to={`/account/orders/${order.id}`}
                      className="store-account__order-id"
                    >
                      Order #{order.id}
                    </Link>
                    <span className="store-account__order-date">{formatDate(order.created_at)}</span>
                  </span>
                  <span
                    className="store-account__order-status"
                    style={{
                      background: `${status.color}1f`,
                      color: status.color,
                      border: `1px solid ${status.color}55`,
                    }}
                  >
                    {status.label}
                  </span>
                </div>
                <p className="store-account__order-items">
                  {items.map((item) => `${item.product_title || 'Item'} ×${item.quantity}`).join(', ') || '—'}
                  {order.total ? ` · ${money(order.total)}` : ''}
                </p>
                {order.status === 'pending' && (
                  <Link
                    className="store-btn store-btn--ghost"
                    to={`/store/cart?resume_order=${order.id}`}
                    style={{ marginTop: 8, display: 'inline-block' }}
                  >
                    Pay now
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

    </section>
  );
}
