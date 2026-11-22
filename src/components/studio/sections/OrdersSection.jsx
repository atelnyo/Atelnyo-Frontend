/**
 * src/components/studio/sections/OrdersSection.jsx
 *
 * Orders (sales) — the seller's REAL marketplace orders from
 * GET /api/marketplace/orders/sales/ (OrderViewSet.sales — orders whose
 * items belong to this seller). No fake data: each row is a live order
 * with its real status, buyer, items, and total.
 *
 * This is the operational side of the Product Studio — the Status
 * Summary dashboard counts orders, this section lets the seller see and
 * act on them. (Order status transitions are enforced by the backend;
 * the section is read-only here.)
 *
 * Extracted into the sections/ convention — 2026-08.
 */
import React, { useState } from 'react';
import api from '../../../services/api';
import useFetch from '../../../hooks/useFetch';
import { StudioSkeleton, EmptyState, SectionHeader, fmtDate, fmtCurrency } from '../shared';
import styles from './sections.module.css';
import { inlineText } from '../../../utils/inlineI18n';

// Order STATUS_CHOICES from the backend Order model.
const STATUS_META = {
  pending:    { cls: 'badgeDraft',    icon: 'fa-clock',      label: { en: 'Pending',    ht: 'Annatant' } },
  paid:       { cls: 'badgeActive',   icon: 'fa-circle-check', label: { en: 'Paid',    ht: 'Peye' } },
  fulfilled:  { cls: 'badgeActive',   icon: 'fa-truck-fast', label: { en: 'Fulfilled', ht: 'Livré' } },
  completed:  { cls: 'badgePublished', icon: 'fa-check-double', label: { en: 'Completed', ht: 'Fini' } },
  cancelled:  { cls: 'badgeArchived', icon: 'fa-ban',        label: { en: 'Cancelled', ht: 'Anile' } },
  refunded:   { cls: 'badgeRejected', icon: 'fa-rotate-left', label: { en: 'Refunded', ht: 'Rembouse' } },
};

function statusMeta(status) {
  return STATUS_META[status] || { cls: 'badgeArchived', icon: 'fa-circle', label: { en: status, ht: status } };
}

export default function OrdersSection({ lang, t }) {
  const isHt = lang === 'ht';
  const [expanded, setExpanded] = useState(null);
  // Manual tracking form — sellers shipping from their own stock have no
  // Printify submission to pull tracking from, so they enter it here.
  const [trackingForm, setTrackingForm] = useState({ carrier: '', number: '', url: '' });
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [trackingNotice, setTrackingNotice] = useState(null);
  const { data: orders, loading, updateLocal } = useFetch(
    () => api.get('marketplace/orders/sales/', { params: { limit: 50 } }),
    {
      defaultValue: [],
      transform: (d) => (Array.isArray(d?.results || d) ? (d?.results || d) : []),
    },
  );

  const openRow = (order) => {
    const next = expanded === order.id ? null : order.id;
    setExpanded(next);
    setTrackingNotice(null);
    const tracking = order.tracking || {};
    setTrackingForm({
      carrier: tracking.carrier || '',
      number: tracking.number || '',
      url: tracking.url || '',
    });
  };

  const saveTracking = async (order) => {
    if (!trackingForm.number.trim()) {
      setTrackingNotice({
        orderId: order.id,
        kind: 'error',
        text: isHt ? 'Antre nimewo swivi a.' : inlineText(lang, 'Enter the tracking number.'),
      });
      return;
    }
    setTrackingBusy(true);
    setTrackingNotice(null);
    try {
      const { data } = await api.post(`marketplace/orders/${order.id}/tracking/`, {
        carrier: trackingForm.carrier.trim(),
        number: trackingForm.number.trim(),
        url: trackingForm.url.trim(),
      });
      updateLocal((row) => row.id === order.id, {
        tracking: data.tracking,
        status: data.status,
      });
      setTrackingNotice({
        orderId: order.id,
        kind: 'ok',
        text: isHt ? 'Swivi anrejistre — achtè a wè l.' : inlineText(lang, 'Tracking saved — the buyer can see it now.'),
      });
    } catch (err) {
      const body = err?.response?.data || {};
      const detail = body.detail || body.number || body.url;
      setTrackingNotice({
        orderId: order.id,
        kind: 'error',
        text: String(detail || (isHt ? 'Pa t ka anrejistre swivi a.' : inlineText(lang, 'Could not save the tracking.'))),
      });
    } finally {
      setTrackingBusy(false);
    }
  };

  if (loading) return <StudioSkeleton rows={4} />;

  return (
    <div className={styles.section}>
      <SectionHeader
        icon="fa-cart-shopping"
        title={t.studio_orders || 'Orders'}
        lang={lang}
        help={{
          ht: 'Lòd achtè yo pase pou pwodwi ou yo sou Marketplace a — estati, achtè, atik, ak total yo se done reyèl soti nan sistèm lòd la.',
          en: 'Orders customers placed for your Marketplace products — status, buyer, items, and totals are real data from the order system.',
        }}
      />
      {orders.length === 0 ? (
        <EmptyState
          icon="fa-cart-shopping"
          title={t.studio_no_orders || 'No orders yet'}
          hint={isHt
            ? 'Lè yon achtè achte yon pwodwi ou, lòd la ap parèt isit la ak estati li.'
            : inlineText(lang, 'When a customer buys one of your products, the order appears here with its status.')}
        />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{isHt ? 'Lòd' : inlineText(lang, 'Order')}</th>
                <th>{isHt ? 'Achtè' : inlineText(lang, 'Buyer')}</th>
                <th>{isHt ? 'Atik' : inlineText(lang, 'Items')}</th>
                <th>{isHt ? 'Total' : inlineText(lang, 'Total')}</th>
                <th>{isHt ? 'Estati' : inlineText(lang, 'Status')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const meta = statusMeta(o.status);
                const items = Array.isArray(o.items) ? o.items : [];
                const isOpen = expanded === o.id;
                return (
                  <React.Fragment key={o.id}>
                    <tr
                      className={styles.orderRow}
                      onClick={() => openRow(o)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className={styles.cellName}>
                        #{o.id}
                        <span className={styles.cellSub}>
                          <i className="fas fa-calendar" aria-hidden="true" /> {fmtDate(o.created_at)}
                        </span>
                      </td>
                      <td>{o.buyer_username || o.buyer || '—'}</td>
                      <td className={styles.cellName}>
                        {items.length > 0
                          ? `${items.reduce((s, it) => s + (it.quantity || 1), 0)} ${isHt ? 'atik' : inlineText(lang, 'items')}`
                          : '—'}
                        <span className={styles.cellSub}>
                          {items.slice(0, 2).map((it) => it.product_title).filter(Boolean).join(', ') || ' '}
                        </span>
                      </td>
                      <td>{fmtCurrency(o.total != null ? o.total : o.subtotal)}</td>
                      <td>
                        <span className={`${styles.badge} ${styles[meta.cls]}`}>
                          <i className={`fas ${meta.icon}`} aria-hidden="true" />
                          {isHt ? meta.label.ht : meta.label.en}
                        </span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className={styles.orderDetailRow}>
                        <td colSpan={5}>
                          <div className={styles.orderDetail}>
                            <div className={styles.orderDetailGrid}>
                              <div>
                                <span className={styles.orderDetailLabel}>{isHt ? 'Atik yo' : inlineText(lang, 'Items')}</span>
                                <ul className={styles.orderDetailList}>
                                  {items.length === 0 && <li>{isHt ? 'Pa gen atik' : inlineText(lang, 'No items')}</li>}
                                  {items.map((it, i) => (
                                    <li key={i}>
                                      <strong>{it.product_title || `#${it.product}`}</strong>
                                      <span>
                                        ×{it.quantity || 1} · {fmtCurrency(it.unit_price)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <span className={styles.orderDetailLabel}>{isHt ? 'Peman' : inlineText(lang, 'Payment')}</span>
                                <ul className={styles.orderDetailList}>
                                  <li>{isHt ? 'Sou-total' : inlineText(lang, 'Subtotal')}: <strong>{fmtCurrency(o.subtotal)}</strong></li>
                                  <li>{isHt ? 'Total' : inlineText(lang, 'Total')}: <strong>{fmtCurrency(o.total)}</strong></li>
                                </ul>
                                {o.shipping_address && (
                                  <>
                                    <span className={styles.orderDetailLabel}>{isHt ? 'Livrezon' : inlineText(lang, 'Shipping')}</span>
                                    <p className={styles.orderDetailAddr}>{o.shipping_address}</p>
                                  </>
                                )}
                                {o.buyer_note && (
                                  <>
                                    <span className={styles.orderDetailLabel}>{isHt ? 'Nòt achtè' : inlineText(lang, 'Buyer note')}</span>
                                    <p className={styles.orderDetailAddr}>{o.buyer_note}</p>
                                  </>
                                )}
                                {Array.isArray(o.printify_fulfillment) && o.printify_fulfillment.length > 0 && (
                                  <>
                                    <span className={styles.orderDetailLabel}>{isHt ? 'Fulfillment Printify' : inlineText(lang, 'Printify fulfillment')}</span>
                                    {o.printify_fulfillment.map((fulfillment) => (
                                      <div key={`${fulfillment.submission_status || 'customer'}-${fulfillment.status || 'pending'}-${(fulfillment.shipments || []).map((shipment) => shipment.number || shipment.url || 'shipment').join(',')}`}>
                                        <p className={styles.orderDetailAddr}>
                                          {fulfillment.status || fulfillment.submission_status || (isHt ? 'Ap tann mizajou' : inlineText(lang, 'Awaiting update'))}
                                        </p>
                                        {fulfillment.issue && <p className={styles.orderDetailAddr} role="alert">{fulfillment.issue}</p>}
                                        {(fulfillment.shipments || []).map((shipment) => (
                                          <p className={styles.orderDetailAddr} key={shipment.number || shipment.url || shipment.carrier}>
                                            {shipment.carrier || (isHt ? 'Transpò' : inlineText(lang, 'Carrier'))}{' '}
                                            {shipment.url?.startsWith('https://')
                                              ? <a href={shipment.url} target="_blank" rel="noreferrer">{shipment.number || (isHt ? 'Swiv' : inlineText(lang, 'Track'))}</a>
                                              : shipment.number}
                                          </p>
                                        ))}
                                      </div>
                                    ))}
                                  </>
                                )}
                                <span className={styles.orderDetailLabel}>
                                  {isHt ? 'Swivi livrezon (manyèl)' : inlineText(lang, 'Delivery tracking (manual)')}
                                </span>
                                {o.tracking && (
                                  <p className={styles.orderDetailAddr}>
                                    {o.tracking.carrier || (isHt ? 'Transpò' : inlineText(lang, 'Carrier'))}{' '}
                                    {o.tracking.url?.startsWith('https://')
                                      ? <a href={o.tracking.url} target="_blank" rel="noreferrer">{o.tracking.number}</a>
                                      : o.tracking.number}
                                  </p>
                                )}
                                <div className={styles.printifyRow}>
                                  <input
                                    className={styles.formInput}
                                    placeholder={isHt ? 'Transpòtè (USPS, DHL…)' : inlineText(lang, 'Carrier (USPS, DHL…)')}
                                    value={trackingForm.carrier}
                                    onChange={(e) => setTrackingForm((f) => ({ ...f, carrier: e.target.value }))}
                                    aria-label={isHt ? 'Transpòtè' : inlineText(lang, 'Carrier')}
                                  />
                                  <input
                                    className={styles.formInput}
                                    placeholder={isHt ? 'Nimewo swivi' : inlineText(lang, 'Tracking number')}
                                    value={trackingForm.number}
                                    onChange={(e) => setTrackingForm((f) => ({ ...f, number: e.target.value }))}
                                    aria-label={isHt ? 'Nimewo swivi' : inlineText(lang, 'Tracking number')}
                                  />
                                  <input
                                    className={styles.formInput}
                                    placeholder="https://…"
                                    value={trackingForm.url}
                                    onChange={(e) => setTrackingForm((f) => ({ ...f, url: e.target.value }))}
                                    aria-label={isHt ? 'Lyen swivi' : inlineText(lang, 'Tracking URL')}
                                  />
                                  <button
                                    type="button"
                                    className={styles.secondaryBtn}
                                    onClick={() => saveTracking(o)}
                                    disabled={trackingBusy}
                                  >
                                    {trackingBusy ? '…' : (isHt ? 'Anrejistre swivi' : inlineText(lang, 'Save tracking'))}
                                  </button>
                                </div>
                                {trackingNotice?.orderId === o.id && (
                                  <p
                                    className={trackingNotice.kind === 'error' ? styles.printifyError : styles.printifyText}
                                    role={trackingNotice.kind === 'error' ? 'alert' : 'status'}
                                  >
                                    {trackingNotice.text}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
