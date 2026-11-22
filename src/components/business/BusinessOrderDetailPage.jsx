/**
 * BusinessOrderDetailPage — one Store (marketplace) order, buyer-only.
 *
 * Route: /business/orders/mine/:orderId  (auth-gated in App.jsx)
 * Data:  GET /api/marketplace/orders/<id>/  (OrderViewSet.retrieve)
 *
 * Shows the payment status, line items (with the signed digital download
 * link when the server grants one), the delivery address and the Printify
 * shipment tracking the buyer is allowed to see. The list page links here
 * for EVERY order — including ones with no tracking yet, which used to
 * disappear from the buyer's surface entirely.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { historyBack } from '../../utils/history';
import { marketplaceService } from '../../services/api';
import { inlineText } from '../../utils/inlineI18n';
import { fulfillmentLabel, storeOrderStatus } from './storeOrderStatus';
import '../../styles/business.css';

function money(n, lang) {
  return Number(n ?? 0).toLocaleString(lang === 'ht' ? 'fr-HT' : 'en-US', {
    minimumFractionDigits: 2,
  });
}

function dateLabel(value, lang) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(lang === 'ht' ? 'fr-HT' : 'en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  });
}

function addressLines(address) {
  if (!address || typeof address !== 'object') return [];
  const name = [address.first_name, address.last_name].filter(Boolean).join(' ');
  return [
    name,
    address.address1,
    address.address2,
    [address.city, address.region, address.zip].filter(Boolean).join(', '),
    address.country,
  ].filter(Boolean);
}

export default function BusinessOrderDetailPage({ lang = 'en' }) {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const isHt = lang === 'ht';
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setOrder(null);
    setError('');
    marketplaceService.myOrder(orderId)
      .then(({ data }) => {
        if (!cancelled) setOrder(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.status === 404
          ? (isHt ? 'Kòmand sa a pa egziste oswa li pa pou ou.' : inlineText(lang, 'This order does not exist or is not yours.'))
          : (isHt ? 'Pa t ka chaje kòmand lan. Eseye ankò.' : inlineText(lang, 'Could not load this order. Try again.')));
      });
    return () => {
      cancelled = true;
    };
    // lang/isHt only shape the error copy, never the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const goBack = () => historyBack(navigate);
  const status = order ? storeOrderStatus(order.status, isHt) : null;
  const items = Array.isArray(order?.items) ? order.items : [];
  const fulfillment = Array.isArray(order?.printify_fulfillment) ? order.printify_fulfillment : [];
  const shipping = addressLines(order?.shipping_address);
  const paid = ['paid', 'fulfilled', 'completed'].includes(order?.status);

  const openDownload = (item) => {
    if (!item?.download_url) return;
    window.open(item.download_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="biz-hub biz-my-orders" data-testid="business-order-detail">
      <div className="biz-hub-hero">
        <div className="biz-hub-badge"><i className="fas fa-receipt" aria-hidden="true" /></div>
        <h1 className="biz-hub-title">
          {isHt ? 'Kòmand' : inlineText(lang, 'Order')} #{orderId}
        </h1>
        <button
          type="button"
          className="biz-btn biz-btn-ghost biz-hub-create-cta"
          onClick={goBack}
          data-testid="business-order-detail-back"
        >
          <i className="fas fa-arrow-left" aria-hidden="true" />
          {isHt ? 'Retounen' : inlineText(lang, 'Back')}
        </button>
      </div>

      {error ? (
        <div className="biz-hub-empty" role="alert" data-testid="business-order-detail-error">
          <i className="fas fa-circle-exclamation" aria-hidden="true" />
          <h3>{error}</h3>
        </div>
      ) : order === null ? (
        <div className="biz-hub-loading">
          <i className="fas fa-spinner fa-pulse fa-2x" aria-hidden="true" />
        </div>
      ) : (
        <div className="biz-orders-list" style={{ maxWidth: 720, margin: '0 auto' }}>
          {/* ── Payment status ─────────────────────────────────── */}
          <div className="biz-order-card">
            <div className="biz-order-main">
              <div className="biz-order-title-row">
                <span className="biz-order-name">
                  {isHt ? 'Estati peman' : inlineText(lang, 'Payment status')}
                </span>
                <span
                  className="biz-status-pill"
                  data-testid="business-order-detail-status"
                  style={{
                    background: `${status.color}1f`,
                    color: status.color,
                    border: `1px solid ${status.color}55`,
                  }}
                >
                  {status.label}
                </span>
              </div>
              <p className="biz-order-meta">
                <i className="fas fa-calendar" aria-hidden="true" /> {dateLabel(order.created_at, lang)}
                {' · '}<i className="fas fa-coins" aria-hidden="true" />{' '}
                <strong>{money(order.total, lang)} USD</strong>
              </p>
            </div>
          </div>

          {/* ── Line items ─────────────────────────────────────── */}
          <div className="biz-order-card">
            <div className="biz-order-main">
              <h3 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fas fa-bag-shopping" aria-hidden="true" />
                {isHt ? 'Atik' : inlineText(lang, 'Items')}
              </h3>
              {items.map((item) => (
                <div
                  key={`item-${item.id}`}
                  style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', gap: 12, padding: '8px 0',
                    borderBottom: '1px solid rgba(148,163,184,0.18)',
                  }}
                >
                  <div>
                    <span className="biz-order-name">
                      {item.product_title || (isHt ? 'Atik' : inlineText(lang, 'Item'))}
                      {item.variant_name ? ` · ${item.variant_name}` : ''}
                    </span>
                    <p className="biz-order-meta">
                      {item.quantity}× {money(item.unit_price, lang)} USD
                      {item.product_kind === 'digital' && (
                        <>{' · '}<i className="fas fa-file-arrow-down" aria-hidden="true" />{' '}
                          {isHt ? 'Dijital' : inlineText(lang, 'Digital')}</>
                      )}
                    </p>
                  </div>
                  {item.download_url && (
                    <button
                      type="button"
                      className="biz-btn biz-btn-primary biz-btn-sm"
                      onClick={() => openDownload(item)}
                      data-testid="business-order-detail-download"
                    >
                      <i className="fas fa-download" aria-hidden="true" />
                      {isHt ? 'Telechaje' : inlineText(lang, 'Download')}
                    </button>
                  )}
                </div>
              ))}
              <p className="biz-order-meta" style={{ marginTop: 10 }}>
                {isHt ? 'Sou-total' : inlineText(lang, 'Subtotal')}: {money(order.subtotal, lang)} USD
                {' · '}{isHt ? 'Livrezon' : inlineText(lang, 'Shipping')}: {money(order.shipping_total, lang)} USD
                {' · '}<strong>{isHt ? 'Total' : inlineText(lang, 'Total')}: {money(order.total, lang)} USD</strong>
              </p>
            </div>
          </div>

          {/* ── Delivery address ───────────────────────────────── */}
          {shipping.length > 0 && (
            <div className="biz-order-card">
              <div className="biz-order-main">
                <h3 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="fas fa-location-dot" aria-hidden="true" />
                  {isHt ? 'Adrès livrezon' : inlineText(lang, 'Delivery address')}
                </h3>
                {shipping.map((line, index) => (
                  <p className="biz-order-meta" key={`address-${index}`}>{line}</p>
                ))}
                {order.shipping_method && (
                  <p className="biz-order-meta">
                    <i className="fas fa-truck" aria-hidden="true" /> {order.shipping_method}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Delivery tracking ──────────────────────────────── */}
          <div className="biz-order-card">
            <div className="biz-order-main">
              <h3 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fas fa-truck-fast" aria-hidden="true" />
                {isHt ? 'Swivi livrezon' : inlineText(lang, 'Delivery tracking')}
              </h3>
              {order.tracking && (
                <p className="biz-order-meta" data-testid="business-order-detail-manual-tracking">
                  <i className="fas fa-truck-fast" aria-hidden="true" />{' '}
                  {order.tracking.carrier || (isHt ? 'Transpòtè' : inlineText(lang, 'Carrier'))}{' '}
                  {order.tracking.url?.startsWith('https://') ? (
                    <a href={order.tracking.url} target="_blank" rel="noreferrer">
                      {order.tracking.number}
                    </a>
                  ) : order.tracking.number}
                  {order.tracking.shipped_at && (
                    <>{' · '}{isHt ? 'Voye' : inlineText(lang, 'Shipped')} {dateLabel(order.tracking.shipped_at, lang)}</>
                  )}
                </p>
              )}
              {fulfillment.length === 0 && !order.tracking ? (
                <p className="biz-order-meta" data-testid="business-order-detail-no-tracking">
                  {paid
                    ? (isHt
                      ? 'Peman konfime — vandè a ap prepare livrezon an. Nimewo swivi a ap parèt isit la lè li disponib.'
                      : inlineText(lang, 'Payment confirmed — the seller is preparing delivery. Tracking appears here once available.'))
                    : (isHt
                      ? 'Swivi livrezon ap parèt isit la apre peman an konfime.'
                      : inlineText(lang, 'Delivery tracking will appear here once payment is confirmed.'))}
                </p>
              ) : fulfillment.map((entry, index) => {
                const shipments = Array.isArray(entry.shipments) ? entry.shipments : [];
                return (
                  <div key={`fulfillment-${index}`} style={{ marginBottom: 10 }}>
                    <p className="biz-order-meta">
                      <i className="fas fa-box" aria-hidden="true" /> {fulfillmentLabel(entry.status, isHt)}
                    </p>
                    {shipments.length === 0 ? (
                      <p className="biz-order-meta" style={{ opacity: 0.75 }}>
                        {isHt ? 'Pa gen nimewo swivi ankò.' : inlineText(lang, 'No tracking number yet.')}
                      </p>
                    ) : shipments.map((shipment, shipmentIndex) => (
                      <p className="biz-order-meta" key={`shipment-${index}-${shipmentIndex}`}>
                        <i className="fas fa-truck-fast" aria-hidden="true" />{' '}
                        {shipment.carrier || (isHt ? 'Transpò' : inlineText(lang, 'Carrier'))}{' '}
                        {shipment.url?.startsWith('https://') ? (
                          <a href={shipment.url} target="_blank" rel="noreferrer">
                            {shipment.number || (isHt ? 'Swiv livrezon' : inlineText(lang, 'Track shipment'))}
                          </a>
                        ) : (shipment.number || '')}
                        {shipment.delivered_at && (
                          <>{' · '}{isHt ? 'Livre' : inlineText(lang, 'Delivered')}</>
                        )}
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
