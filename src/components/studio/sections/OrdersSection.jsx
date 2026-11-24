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

// The order stores the recipient as a JSON object; render it as readable
// lines (a raw object cannot be a React child and hides the address).
function addressLines(address) {
  if (!address || typeof address !== 'object') return [];
  const name = [address.first_name, address.last_name].filter(Boolean).join(' ');
  const cityLine = [address.city, address.region].filter(Boolean).join(', ');
  const cityZip = [cityLine, address.zip].filter(Boolean).join(' ');
  const contact = [address.email, address.phone].filter(Boolean).join(' · ');
  return [name, address.address1, address.address2, cityZip, address.country, contact]
    .filter(Boolean);
}

export default function OrdersSection({ lang, t }) {
  const isHt = lang === 'ht';
  const [expanded, setExpanded] = useState(null);
  // Manual tracking form — sellers shipping from their own stock have no
  // Printify submission to pull tracking from, so they enter it here.
  const [trackingForm, setTrackingForm] = useState({ carrier: '', number: '', url: '' });
  const [trackingBusy, setTrackingBusy] = useState(false);
  // Submission id currently being replayed (Printify rejection recovery).
  const [retryingSubmission, setRetryingSubmission] = useState(null);
  const [trackingNotice, setTrackingNotice] = useState(null);
  // Order-scoped thread with the buyer (the other direction of the same
  // conversation the buyer's order page opens).
  const [buyerMessageOpen, setBuyerMessageOpen] = useState(null);
  const [buyerMessage, setBuyerMessage] = useState('');
  const [buyerMessageBusy, setBuyerMessageBusy] = useState(false);
  const [buyerMessageNotice, setBuyerMessageNotice] = useState(null);
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
    setBuyerMessageOpen(null);
    setBuyerMessage('');
    setBuyerMessageNotice(null);
    const tracking = order.tracking || {};
    setTrackingForm({
      carrier: tracking.carrier || '',
      number: tracking.number || '',
      url: tracking.url || '',
    });
  };

  // A paid order whose Printify submission was rejected is stuck: the
  // submit job is done and nothing re-enqueues it. The seller fixes the
  // mapping/token and replays it from here.
  const retrySubmission = async (order, fulfillment) => {
    if (!fulfillment?.submission_id) return;
    setRetryingSubmission(fulfillment.submission_id);
    setTrackingNotice(null);
    try {
      const { data } = await api.post(
        `marketplace/printify/submissions/${fulfillment.submission_id}/retry/`,
      );
      const accepted = data.status === 'submitted';
      updateLocal((row) => row.id === order.id, {
        printify_fulfillment: (order.printify_fulfillment || []).map((row) => (
          row.submission_id === fulfillment.submission_id
            ? { ...row, submission_status: data.status, issue: data.issue, retryable: !accepted }
            : row
        )),
      });
      setTrackingNotice({
        orderId: order.id,
        kind: accepted ? 'ok' : 'error',
        text: accepted
          ? (isHt ? 'Soumisyon an pase — atik la nan pwodiksyon.' : inlineText(lang, 'Submission accepted — the item is in production.'))
          : String(data.issue || (isHt ? 'Soumisyon an rete bloke.' : inlineText(lang, 'The submission is still blocked.'))),
      });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setTrackingNotice({
        orderId: order.id,
        kind: 'error',
        text: String(detail || (isHt ? 'Pa t ka eseye ankò.' : inlineText(lang, 'Could not retry the submission.'))),
      });
    } finally {
      setRetryingSubmission(null);
    }
  };

  // A blocked Printify submission often needs an answer only the buyer has
  // (missing phone, wrong address). The buyer can already message the seller;
  // this is the other direction of the same order-scoped thread.
  const sendBuyerMessage = async (order) => {
    const body = buyerMessage.trim();
    if (!body) return;
    setBuyerMessageBusy(true);
    setBuyerMessageNotice(null);
    try {
      await api.post(`marketplace/orders/${order.id}/contact-buyer/`, { body });
      setBuyerMessage('');
      setBuyerMessageOpen(null);
      setBuyerMessageNotice({
        orderId: order.id,
        kind: 'ok',
        text: isHt ? 'Mesaj voye — repons lan ap parèt nan Mesaj.' : inlineText(lang, 'Message sent — the reply lands in Messages.'),
      });
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.body;
      setBuyerMessageNotice({
        orderId: order.id,
        kind: 'error',
        text: String(detail || (isHt ? 'Pa t ka voye mesaj la.' : inlineText(lang, 'Could not send the message.'))),
      });
    } finally {
      setBuyerMessageBusy(false);
    }
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
                                    <p className={styles.orderDetailAddr}>
                                      {addressLines(o.shipping_address).map((line, index) => (
                                        <React.Fragment key={`${index}-${line}`}>{line}<br /></React.Fragment>
                                      ))}
                                    </p>
                                  </>
                                )}
                                {o.buyer_note && (
                                  <>
                                    <span className={styles.orderDetailLabel}>{isHt ? 'Nòt achtè' : inlineText(lang, 'Buyer note')}</span>
                                    <p className={styles.orderDetailAddr}>{o.buyer_note}</p>
                                  </>
                                )}
                                {o.buyer && (
                                  <>
                                    <span className={styles.orderDetailLabel}>
                                      {isHt ? 'Mesaj bay achtè a' : inlineText(lang, 'Message the buyer')}
                                    </span>
                                    {buyerMessageOpen === o.id ? (
                                      <>
                                        <textarea
                                          className={styles.formInput}
                                          rows={3}
                                          maxLength={4000}
                                          value={buyerMessage}
                                          onChange={(e) => setBuyerMessage(e.target.value)}
                                          placeholder={isHt ? 'Ekri achtè a sou kòmand sa a…' : inlineText(lang, 'Ask the buyer about this order…')}
                                          aria-label={isHt ? 'Mesaj pou achtè a' : inlineText(lang, 'Message to the buyer')}
                                        />
                                        <div className={styles.printifyRow}>
                                          <button
                                            type="button"
                                            className={styles.secondaryBtn}
                                            onClick={() => sendBuyerMessage(o)}
                                            disabled={buyerMessageBusy || !buyerMessage.trim()}
                                          >
                                            {buyerMessageBusy ? '…' : (isHt ? 'Voye mesaj' : inlineText(lang, 'Send message'))}
                                          </button>
                                          <button
                                            type="button"
                                            className={styles.secondaryBtn}
                                            onClick={() => {
                                              setBuyerMessageOpen(null);
                                              setBuyerMessage('');
                                              setBuyerMessageNotice(null);
                                            }}
                                          >
                                            {isHt ? 'Anile' : inlineText(lang, 'Cancel')}
                                          </button>
                                        </div>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        className={styles.secondaryBtn}
                                        onClick={() => setBuyerMessageOpen(o.id)}
                                      >
                                        {isHt ? 'Kontakte achtè a' : inlineText(lang, 'Message the buyer')}
                                      </button>
                                    )}
                                    {buyerMessageNotice?.orderId === o.id && (
                                      <p
                                        className={buyerMessageNotice.kind === 'error' ? styles.printifyError : styles.printifyText}
                                        role={buyerMessageNotice.kind === 'error' ? 'alert' : 'status'}
                                      >
                                        {buyerMessageNotice.text}
                                      </p>
                                    )}
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
                                        {fulfillment.retryable && fulfillment.submission_id && (
                                          <button
                                            type="button"
                                            className={styles.secondaryBtn}
                                            onClick={() => retrySubmission(o, fulfillment)}
                                            disabled={retryingSubmission === fulfillment.submission_id}
                                          >
                                            {retryingSubmission === fulfillment.submission_id
                                              ? '…'
                                              : (isHt ? 'Eseye ankò' : inlineText(lang, 'Retry'))}
                                          </button>
                                        )}
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
