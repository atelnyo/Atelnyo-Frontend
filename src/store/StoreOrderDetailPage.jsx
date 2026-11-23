import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, Navigate, useParams } from 'react-router-dom';
import { storeService } from './storeService';
import { useAuthStore } from './useAuthStore';
import { fulfillmentLabel, storeOrderStatus } from '../components/business/storeOrderStatus';
import { formatDate, money } from './storeFormat';

const STEP_LABELS = ['Order placed', 'Paid', 'Shipped', 'Completed'];
const CLOSED_STATUSES = new Set(['cancelled', 'refunded']);

const addressLines = (address) => {
  if (!address || typeof address !== 'object') return [];
  const name = [address.first_name, address.last_name].filter(Boolean).join(' ');
  const cityLine = [address.city, address.region].filter(Boolean).join(', ');
  const cityZip = [cityLine, address.zip].filter(Boolean).join(' ');
  return [name, address.address1, address.address2, cityZip, address.country].filter(Boolean);
};

// Manual seller tracking and Printify shipments share one list: the shopper
// does not care which pipeline produced the parcel.
const collectShipments = (order) => {
  const shipments = [];
  const manual = order.tracking;
  if (manual && (manual.number || manual.url || manual.carrier)) {
    shipments.push({
      key: 'manual',
      carrier: manual.carrier,
      number: manual.number,
      url: manual.url,
      date: manual.shipped_at,
    });
  }
  const fulfillments = Array.isArray(order.printify_fulfillment) ? order.printify_fulfillment : [];
  fulfillments.forEach((fulfillment, fi) => {
    const rows = Array.isArray(fulfillment?.shipments) ? fulfillment.shipments : [];
    rows.forEach((shipment, si) => {
      if (!shipment || (!shipment.number && !shipment.url && !shipment.carrier)) return;
      shipments.push({
        key: `printify-${fi}-${si}`,
        carrier: shipment.carrier,
        number: shipment.number,
        url: shipment.url,
        date: shipment.delivered_at,
      });
    });
  });
  return shipments;
};

const stepIndex = (order, shipments) => {
  if (CLOSED_STATUSES.has(order.status)) return -1;
  if (order.status === 'completed') return 3;
  if (order.status === 'fulfilled' || shipments.length > 0) return 2;
  if (order.status === 'paid') return 1;
  return 0;
};

export default function StoreOrderDetailPage() {
  const { orderId } = useParams();
  const user = useAuthStore((s) => s.user);
  const [order, setOrder] = useState(null);
  // 'not_found' | 'failed' — null while loading and after a successful load.
  const [error, setError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!user) {
      return undefined;
    }
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrder(null);
    setError(null);
    storeService.getOrder(orderId)
      .then((res) => {
        if (cancelled) {
          return;
        }
        setOrder(res?.data ?? res);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        setError(err?.response?.status === 404 ? 'not_found' : 'failed');
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, user, reloadTick]);

  if (!user) {
    return (
      <Navigate
        to={`/store/login?next=${encodeURIComponent(`/account/orders/${orderId}`)}`}
        replace
      />
    );
  }

  const status = order ? storeOrderStatus(order.status, false) : null;
  const items = Array.isArray(order?.items) ? order.items : [];
  const shipments = order ? collectShipments(order) : [];
  const currentStep = order ? stepIndex(order, shipments) : 0;
  const fulfillments = Array.isArray(order?.printify_fulfillment) ? order.printify_fulfillment : [];
  const lines = addressLines(order?.shipping_address);
  const hasPhysical = items.some((item) => item.product_kind !== 'digital');

  return (
    <section className="store-order">
      <Helmet>
        <title>Order #{orderId} · Atelnyo Store</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <p className="store-order__back"><Link to="/account">← Back to account</Link></p>

      <div className="store-order__head">
        <h1 className="store-title store-order__title">Order #{orderId}</h1>
        {order && (
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
        )}
      </div>
      {order && <p className="store-order__date">Placed {formatDate(order.created_at)}</p>}

      {!order && error === 'not_found' && (
        <p className="store-state" role="alert">
          This order was not found on your account. <Link to="/account">See your orders</Link>.
        </p>
      )}
      {!order && error === 'failed' && (
        <p className="store-state store-state--error" role="alert">
          Your order could not be loaded.{' '}
          <button
            type="button"
            className="store-btn store-btn--ghost"
            onClick={() => setReloadTick((n) => n + 1)}
          >
            Try again
          </button>
        </p>
      )}
      {!order && !error && <p className="store-state" role="status">Loading your order…</p>}

      {order && (
        <>
          {currentStep === -1 ? (
            <p className="store-order__cancelled" role="status">
              This order is {status.label.toLowerCase()}. Contact support if you need help with it.
            </p>
          ) : (
            <ol className="store-order__steps" aria-label="Order progress">
              {STEP_LABELS.map((label, index) => {
                const state = index < currentStep ? 'done' : index === currentStep ? 'current' : 'todo';
                return (
                  <li
                    key={label}
                    className={`store-order__step is-${state}`}
                    aria-current={index === currentStep ? 'step' : undefined}
                  >
                    <span className="store-order__step-dot" aria-hidden="true">
                      {index < currentStep ? '✓' : index + 1}
                    </span>
                    <span>{label}</span>
                  </li>
                );
              })}
            </ol>
          )}

          <section className="store-order__card">
            <h2>Items</h2>
            <ul className="store-order__items">
              {items.map((item) => (
                <li key={item.id}>
                  <div className="store-order__item-main">
                    <span className="store-order__item-title">{item.product_title || 'Item'}</span>
                    {item.variant_name && (
                      <span className="store-order__muted">{item.variant_name}</span>
                    )}
                    <span className="store-order__muted">
                      Qty {item.quantity} · {money(item.unit_price)} each
                    </span>
                    {item.product_kind === 'digital' && !item.download_url && (
                      <span className="store-order__muted">
                        Download available once payment is confirmed.
                      </span>
                    )}
                  </div>
                  <div className="store-order__item-side">
                    <strong>{money(Number(item.unit_price) * Number(item.quantity))}</strong>
                    {item.download_url && (
                      <a
                        className="store-btn"
                        href={item.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Download
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="store-order__card">
            <h2>Summary</h2>
            <dl className="store-order__totals">
              <dt>Subtotal</dt>
              <dd>{money(order.subtotal)}</dd>
              {Number(order.shipping_total) > 0 && (
                <>
                  <dt>Shipping</dt>
                  <dd>{money(order.shipping_total)}</dd>
                </>
              )}
              <dt>Total</dt>
              <dd>{money(order.total)}</dd>
            </dl>
          </section>

          {lines.length > 0 && (
            <section className="store-order__card">
              <h2>Shipping address</h2>
              <address className="store-order__address">
                {lines.map((line, index) => (
                  <span key={`${index}-${line}`}>{line}<br /></span>
                ))}
              </address>
            </section>
          )}

          {(shipments.length > 0 || hasPhysical) && (
            <section className="store-order__card">
              <h2>Tracking</h2>
              {shipments.length > 0 ? (
                <ul className="store-order__shipments">
                  {shipments.map((shipment) => (
                    <li key={shipment.key}>
                      <strong>{shipment.carrier || 'Shipment'}</strong>
                      {shipment.number && (
                        <span className="store-order__mono">{shipment.number}</span>
                      )}
                      {shipment.date && (
                        <span className="store-order__muted">{formatDate(shipment.date)}</span>
                      )}
                      {shipment.url && (
                        <a href={shipment.url} target="_blank" rel="noopener noreferrer">
                          Track package
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="store-order__hint">
                  Tracking appears here as soon as the seller ships your order.
                </p>
              )}
              {fulfillments.length > 0 && (
                <ul className="store-order__fulfillment">
                  {fulfillments.map((fulfillment, index) => (
                    <li key={`${fulfillment.status}-${index}`} className="store-order__muted">
                      {fulfillmentLabel(fulfillment.status, false)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {order.buyer_note && (
            <section className="store-order__card">
              <h2>Your note</h2>
              <p className="store-order__hint">{order.buyer_note}</p>
            </section>
          )}

          <p className="store-order__hint">
            Need help with this order? <Link to="/contact">Contact support</Link>.
          </p>
        </>
      )}
    </section>
  );
}
