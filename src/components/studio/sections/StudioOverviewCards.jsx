/**
 * src/components/studio/sections/StudioOverviewCards.jsx
 *
 * The workspace at a glance, from ONE request.
 *
 * The dashboard needs counts across eight content types, the seller order
 * funnel and the wallet balance. Asking every list endpoint for that meant
 * a fan-out of eight large list responses just to read `.length`, and one
 * failing endpoint left a hole. ``GET /api/studio/overview/`` aggregates
 * the same numbers server-side; this strip renders them with the states
 * the Studio already owns:
 *
 *   loading → ``StudioSkeleton variant="stats"`` (KPI-shaped, no reflow)
 *   failure → ``LoadError`` with a retry, never a fake zero
 *   success → four KPI cards
 *
 * The pure helpers are exported so the "published" aggregation is unit
 * tested without rendering.
 */
import React from 'react';
import { useStudioOverview } from '../studioOverview';
import {
  LoadError, StatCard, StudioSkeleton, fmtCount, fmtCurrency,
} from '../shared';
import styles from './sections.module.css';

// Types whose `published` count belongs in the "published content" KPI.
const PUBLISHED_KEYS = [
  'courses', 'products', 'music', 'talents', 'portfolio', 'jobs', 'events',
];

export function publishedTotal(content) {
  return PUBLISHED_KEYS.reduce(
    (sum, key) => sum + (content?.[key]?.published || 0), 0,
  );
}

export function draftTotal(content) {
  return PUBLISHED_KEYS.reduce(
    (sum, key) => sum + (content?.[key]?.draft || 0), 0,
  );
}

export default function StudioOverviewCards({ lang = 'en', t = {} }) {
  const isHt = lang === 'ht';
  const { data, loading, error, refresh } = useStudioOverview(true);

  if (loading && !data) {
    return (
      <StudioSkeleton
        rows={4}
        variant="stats"
        label={isHt ? 'Ap chaje apèsi workspace lan' : 'Loading the workspace overview'}
      />
    );
  }

  if (error && !data) {
    return (
      <LoadError
        lang={lang}
        title={isHt
          ? 'Pa t kapab chaje apèsi workspace lan'
          : 'Could not load the workspace overview'}
        error={error}
        onRetry={refresh}
      />
    );
  }

  if (!data) return null;

  const content = data.content || {};
  const orders = data.commerce?.orders || {};
  const wallet = data.wallet || {};
  const published = publishedTotal(content);
  const drafts = draftTotal(content);

  const cards = [
    {
      key: 'published',
      icon: 'fa-layer-group',
      label: t.studio_published_content || (isHt ? 'Kontni pibliye' : 'Published content'),
      value: published,
      accent: 'violet',
      subtitle: `${fmtCount(drafts)} ${isHt ? 'bouyon' : 'drafts'}`,
    },
    {
      key: 'pending_orders',
      icon: 'fa-hourglass-half',
      label: t.studio_pending_orders || (isHt ? 'Lòd annatant' : 'Pending orders'),
      value: orders.pending || 0,
      accent: 'amber',
      subtitle: `${fmtCount(orders.total || 0)} ${isHt ? 'lòd an total' : 'orders in total'}`,
    },
    {
      key: 'revenue',
      icon: 'fa-dollar-sign',
      label: t.studio_revenue || (isHt ? 'Revni' : 'Revenue'),
      value: data.commerce?.revenue?.gross,
      formatter: fmtCurrency,
      accent: 'emerald',
      subtitle: isHt ? 'Lòd peye sèlman' : 'Paid orders only',
    },
    {
      key: 'wallet',
      icon: 'fa-wallet',
      label: t.studio_wallet || (isHt ? 'Bous' : 'Wallet'),
      value: wallet.balance,
      formatter: fmtCurrency,
      accent: 'sky',
      subtitle: wallet.is_frozen
        ? (isHt ? '⚠ Bous jele' : '⚠ Wallet frozen')
        : (isHt ? 'Disponib kounye a' : 'Available now'),
    },
  ];

  return (
    <div className={styles.statGrid}>
      {cards.map(({ key, ...card }) => <StatCard key={key} {...card} />)}
    </div>
  );
}
