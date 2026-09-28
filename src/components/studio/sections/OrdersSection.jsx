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
  const { data: orders, loading } = useFetch(
    () => api.get('marketplace/orders/sales/', { params: { limit: 50 } }),
    {
      defaultValue: [],
      transform: (d) => (Array.isArray(d?.results || d) ? (d?.results || d) : []),
    },
  );

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
            : 'When a customer buys one of your products, the order appears here with its status.'}
        />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{isHt ? 'Lòd' : 'Order'}</th>
                <th>{isHt ? 'Achtè' : 'Buyer'}</th>
                <th>{isHt ? 'Atik' : 'Items'}</th>
                <th>{isHt ? 'Total' : 'Total'}</th>
                <th>{isHt ? 'Estati' : 'Status'}</th>
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
                      onClick={() => setExpanded(isOpen ? null : o.id)}
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
                          ? `${items.reduce((s, it) => s + (it.quantity || 1), 0)} ${isHt ? 'atik' : 'items'}`
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
                                <span className={styles.orderDetailLabel}>{isHt ? 'Atik yo' : 'Items'}</span>
                                <ul className={styles.orderDetailList}>
                                  {items.length === 0 && <li>{isHt ? 'Pa gen atik' : 'No items'}</li>}
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
                                <span className={styles.orderDetailLabel}>{isHt ? 'Peman' : 'Payment'}</span>
                                <ul className={styles.orderDetailList}>
                                  <li>{isHt ? 'Sou-total' : 'Subtotal'}: <strong>{fmtCurrency(o.subtotal)}</strong></li>
                                  <li>{isHt ? 'Total' : 'Total'}: <strong>{fmtCurrency(o.total)}</strong></li>
                                </ul>
                                {o.shipping_address && (
                                  <>
                                    <span className={styles.orderDetailLabel}>{isHt ? 'Livrezon' : 'Shipping'}</span>
                                    <p className={styles.orderDetailAddr}>{o.shipping_address}</p>
                                  </>
                                )}
                                {o.buyer_note && (
                                  <>
                                    <span className={styles.orderDetailLabel}>{isHt ? 'Nòt achtè' : 'Buyer note'}</span>
                                    <p className={styles.orderDetailAddr}>{o.buyer_note}</p>
                                  </>
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
