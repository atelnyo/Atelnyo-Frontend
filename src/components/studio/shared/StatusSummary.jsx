/**
 * src/components/studio/shared/StatusSummary.jsx
 *
 * Dashboard "what is happening" panel — real business status at a glance.
 * Built on the professional-UX principle: the workspace prioritises
 * WHAT NEEDS ATTENTION / WHAT IS THE STATUS over decoration.
 *
 * Rows (each from a REAL backend source, nothing invented):
 *   • Products  — active / drafts (is_active) / low stock / out of stock
 *                 from marketplace/products/?mine=true (includes drafts)
 *   • Orders    — seller sales: pending / completed from
 *                 marketplace/orders/sales/
 *   • Courses   — published count from /courses/ (saving IS publishing)
 *   • Messages  — conversations with unread_count > 0
 *
 * A row is only rendered when its source responds — a failed API never
 * shows fake zeros. Rows with a studio section are clickable.
 *
 * New — 2026-08.
 */
import React, { useEffect, useState } from 'react';
import api, { courseService, marketplaceService } from '../../../services/api';
import styles from './shared.module.css';

const LOW_STOCK_THRESHOLD = 5;

function toArray(d) {
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.results)) return d.results;
  return [];
}

export default function StatusSummary({ lang = 'ht', onNavigate }) {
  const isHt = lang === 'ht';
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      marketplaceService.list({ mine: true, limit: 100 }),
      api.get('marketplace/orders/sales/', { params: { limit: 100 } }),
      courseService.getAll(),
      api.get('messages/conversations/', { params: { limit: 20 } }),
    ]).then(([productsRes, ordersRes, coursesRes, convsRes]) => {
      if (cancelled) return;

      const products = productsRes.status === 'fulfilled' ? toArray(productsRes.value?.data) : null;
      const orders = ordersRes.status === 'fulfilled' ? toArray(ordersRes.value?.data) : null;
      const courses = coursesRes.status === 'fulfilled' ? toArray(coursesRes.value?.data) : null;
      const conversations = convsRes.status === 'fulfilled' ? toArray(convsRes.value?.data) : null;

      let productsStats = null;
      if (products) {
        const physical = products.filter((p) => p.kind === 'physical');
        productsStats = {
          active: products.filter((p) => p.is_active !== false).length,
          drafts: products.filter((p) => p.is_active === false).length,
          lowStock: physical.filter((p) => p.stock !== null && p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD).length,
          outOfStock: physical.filter((p) => p.stock === 0).length,
        };
      }

      let ordersStats = null;
      if (orders) {
        ordersStats = {
          pending: orders.filter((o) => o.status === 'pending').length,
          completed: orders.filter((o) => o.status === 'completed').length,
          total: orders.length,
        };
      }

      const unread = conversations
        ? conversations.filter((c) => Number(c.unread_count || 0) > 0).length
        : null;

      setData({
        products: productsStats,
        orders: ordersStats,
        courses: courses ? courses.length : null,
        unread,
      });
    });
    return () => { cancelled = true; };
  }, []);

  if (!data) return null;

  // Nothing rendered when no source returned data.
  const hasAny =
    data.products || data.orders || data.courses != null || data.unread != null;
  if (!hasAny) return null;

  return (
    <div className={styles.statusSummary} role="region" aria-label={isHt ? 'Rezime estati' : 'Status summary'}>
      <h3 className={styles.statusTitle}>
        <i className="fas fa-gauge-high" aria-hidden="true" />
        {isHt ? 'Rezime Estati' : 'Status Summary'}
      </h3>

      {data.products && (
        <StatusRow
          icon="fa-cube"
          label={isHt ? 'Pwodwi' : 'Products'}
          onClick={onNavigate ? () => onNavigate('products') : null}
        >
          <StatusChip label={isHt ? 'aktif' : 'active'} count={data.products.active} tone="Emerald" />
          <StatusChip label={isHt ? 'bouyon' : 'drafts'} count={data.products.drafts} tone="Amber" />
          {data.products.lowStock > 0 && (
            <StatusChip label={isHt ? 'stock ba' : 'low stock'} count={data.products.lowStock} tone="Amber" />
          )}
          {data.products.outOfStock > 0 && (
            <StatusChip label={isHt ? 'pa gen stock' : 'out of stock'} count={data.products.outOfStock} tone="Red" />
          )}
        </StatusRow>
      )}

      {data.orders && (
        <StatusRow
          icon="fa-cart-shopping"
          label={isHt ? 'Lòd (vant)' : 'Orders (sales)'}
          onClick={onNavigate ? () => onNavigate('orders') : null}
        >
          <StatusChip label={isHt ? 'annatant' : 'pending'} count={data.orders.pending} tone="Amber" />
          <StatusChip label={isHt ? 'fini' : 'completed'} count={data.orders.completed} tone="Emerald" />
        </StatusRow>
      )}

      {data.courses != null && (
        <StatusRow
          icon="fa-graduation-cap"
          label={isHt ? 'Kou' : 'Courses'}
          onClick={onNavigate ? () => onNavigate('courses') : null}
        >
          <StatusChip label={isHt ? 'pibliye' : 'published'} count={data.courses} tone="Emerald" />
        </StatusRow>
      )}

      {data.unread != null && (
        <StatusRow
          icon="fa-envelope"
          label={isHt ? 'Mesaj' : 'Messages'}
          onClick={onNavigate ? () => onNavigate('messages') : null}
        >
          <StatusChip label={isHt ? 'pa li' : 'unread'} count={data.unread} tone="Blue" />
        </StatusRow>
      )}
    </div>
  );
}

// ─── Presentational bits (module-level so no components are created
//     during render) ───────────────────────────────────────────────────

function StatusChip({ label, count, tone }) {
  return (
    <span className={`${styles.statusChip} ${styles[`statusChip${tone}`]}`}>
      <strong>{count}</strong> {label}
    </span>
  );
}

function StatusRow({ icon, label, onClick, children }) {
  return (
    <button
      type="button"
      className={styles.statusRow}
      onClick={onClick}
      disabled={!onClick}
      aria-label={label}
    >
      <span className={styles.statusRowLabel}>
        <i className={`fas ${icon}`} aria-hidden="true" />
        {label}
      </span>
      <span className={styles.statusChips}>{children}</span>
    </button>
  );
}
