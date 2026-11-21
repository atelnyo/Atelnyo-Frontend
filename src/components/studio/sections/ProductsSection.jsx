/**
 * src/components/studio/sections/ProductsSection.jsx
 *
 * Products section — lists creator's marketplace products in a table with
 * price, sales count, and status badge. Empty state with CTA.
 *
 * Extracted from CreatorStudio.jsx during Etap 2 refactor.
 * Refactored to use useFetch hook — Etap 5 (2026-07-19).
 *
 * Management layer: instant local search + status filters, and an
 * optimistic publish/unpublish toggle that never blocks the table.
 */
import React, { useMemo, useState } from 'react';
import { marketplaceService } from '../../../services/api';
import useFetch from '../../../hooks/useFetch';
import { EmptyState, SectionHeader, fmtCurrency, fmtCount } from '../shared';
import ConfirmModal from '../../common/ConfirmModal';
import styles from './sections.module.css';

const STATUS_FILTERS = ['all', 'published', 'draft'];

// Accent-insensitive, case-insensitive matching so "cafe" finds "Café".
function normalise(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Table-shaped skeleton: same columns as the real product table so the
// layout does not jump when the request resolves.
function ProductsTableSkeleton({ lang, t }) {
  return (
    <div className={styles.tableWrap} aria-busy="true">
      <span className={styles.srOnly} role="status">
        {lang === 'ht' ? 'Ap chaje pwodwi yo…' : 'Loading products…'}
      </span>
      <table className={styles.table} aria-hidden="true">
        <thead>
          <tr>
            <th aria-hidden="true"></th>
            <th>{t.studio_product || 'Product'}</th>
            <th>{t.studio_price || 'Price'}</th>
            <th>{t.studio_sold || 'Sold'}</th>
            <th>{t.studio_status || 'Status'}</th>
            <th aria-label="Actions"></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 4 }).map((_, idx) => (
            <tr key={idx} className={styles.skeletonTableRow}>
              <td />
              <td><span className={`${styles.skeletonCell} ${styles.skeletonCellName}`} /></td>
              <td><span className={`${styles.skeletonCell} ${styles.skeletonCellPrice}`} /></td>
              <td><span className={`${styles.skeletonCell} ${styles.skeletonCellSold}`} /></td>
              <td><span className={`${styles.skeletonCell} ${styles.skeletonCellStatus}`} /></td>
              <td><span className={`${styles.skeletonCell} ${styles.skeletonCellActions}`} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductThumb({ product }) {
  const [failed, setFailed] = useState(false);
  if (!product.image_url || failed) {
    return (
      <span className={styles.productThumbFallback} aria-hidden="true">
        <i className="fas fa-cube" />
      </span>
    );
  }
  return (
    <img
      className={styles.productThumb}
      src={product.image_url}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export default function ProductsSection({ lang, t, showToast, setShowProductModal, onEdit }) {
  const [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState(null); // { key, dir } — null keeps server order
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  // Owner's management list (not the public catalog): a high limit so a
  // freshly imported draft is always on the first page — with limit: 10
  // new imports beyond the first page were invisible until a full reload.
  const {
    data: products = [], loading, error, refetch, removeLocal, updateLocal,
    hasMore, loadingMore, loadMore, loadMoreError,
  } = useFetch(
    (signal, page) => marketplaceService.list({ page, page_size: 100, mine: true }, signal),
    { defaultValue: [], transform: (d) => (Array.isArray(d?.results || d) ? (d?.results || d) : []) },
  );

  const filteredProducts = useMemo(() => {
    const needle = normalise(query);
    return products.filter((p) => {
      const isLive = p.is_active !== false;
      if (statusFilter === 'published' && !isLive) return false;
      if (statusFilter === 'draft' && isLive) return false;
      if (!needle) return true;
      const category = typeof p.category === 'string' ? p.category : p.category?.name;
      return normalise([p.title, p.kind, category].filter(Boolean).join(' ')).includes(needle);
    });
  }, [products, query, statusFilter]);

  // Sorting is applied after filtering so a search keeps its own ordering
  // and the header arrows describe exactly what is on screen.
  const visibleProducts = useMemo(() => {
    if (!sort) return filteredProducts;
    const direction = sort.dir === 'asc' ? 1 : -1;
    const valueOf = (p) => {
      switch (sort.key) {
        case 'title': return String(p.title || '');
        case 'price': return Number(p.price) || 0;
        case 'sales_count': return Number(p.sales_count) || 0;
        case 'status': return p.is_active === false ? 0 : 1;
        default: return 0;
      }
    };
    return [...filteredProducts].sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      const cmp = typeof av === 'string'
        ? av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' })
        : av - bv;
      const tied = cmp === 0
        ? String(a.title || '').localeCompare(String(b.title || ''), undefined, { numeric: true, sensitivity: 'base' })
        : cmp;
      return tied * direction;
    });
  }, [filteredProducts, sort]);

  const handleSort = (key) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null; // third click restores the server's original order
    });
  };

  const ariaSort = (key) => {
    if (sort?.key !== key) return 'none';
    return sort.dir === 'asc' ? 'ascending' : 'descending';
  };

  const sortIcon = (key) => {
    if (sort?.key !== key) return 'fa-sort';
    return sort.dir === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  };

  const sortTitle = (label) => (lang === 'ht' ? `Triye pa ${label}` : `Sort by ${label}`);

  // Selection is by id and survives filtering: the bulk bar reports every
  // selected product, while "select all" only touches what is on screen.
  const selectedProducts = products.filter((p) => selectedIds.has(p.id));
  const selectedLiveCount = selectedProducts.filter((p) => p.is_active !== false).length;
  const selectedDraftCount = selectedProducts.length - selectedLiveCount;
  const allVisibleSelected = visibleProducts.length > 0
    && visibleProducts.every((p) => selectedIds.has(p.id));
  const someVisibleSelected = visibleProducts.some((p) => selectedIds.has(p.id));

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleProducts.forEach((p) => next.delete(p.id));
      else visibleProducts.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const handleBulkActive = async (nextActive) => {
    const targets = products.filter(
      (p) => selectedIds.has(p.id) && ((p.is_active !== false) !== nextActive),
    );
    if (targets.length === 0) return;

    const targetIds = new Set(targets.map((p) => p.id));
    setBulkBusy(true);
    // One optimistic patch covers every target, then the server confirms.
    updateLocal((row) => targetIds.has(row.id), { is_active: nextActive });

    // Small batches: a 100-product catalog must not fire 100 PATCHes at once.
    const results = [];
    for (let i = 0; i < targets.length; i += 5) {
      const batch = targets.slice(i, i + 5);
      const settled = await Promise.allSettled(
        batch.map((p) => marketplaceService.update(p.id, { is_active: nextActive })),
      );
      results.push(...settled);
    }

    const failedIds = new Set();
    results.forEach((result, index) => {
      if (result.status === 'rejected') failedIds.add(targets[index].id);
    });
    if (failedIds.size > 0) {
      updateLocal((row) => failedIds.has(row.id), { is_active: !nextActive });
    }

    const updatedCount = targets.length - failedIds.size;
    if (failedIds.size === 0) {
      showToast?.(
        lang === 'ht'
          ? `✅ ${updatedCount} pwodwi ${nextActive ? 'pibliye' : 'kache'}.`
          : `✅ ${updatedCount} ${updatedCount === 1 ? 'product' : 'products'} ${nextActive ? 'published' : 'hidden'}.`,
        'check-circle',
      );
    } else if (updatedCount === 0) {
      showToast?.(
        lang === 'ht'
          ? `Pa t kapab mete ${failedIds.size} pwodwi ajou.`
          : `Could not update ${failedIds.size} ${failedIds.size === 1 ? 'product' : 'products'}.`,
        'circle-exclamation',
      );
    } else {
      showToast?.(
        lang === 'ht'
          ? `${updatedCount} mete ajou, ${failedIds.size} echwe. Eseye ankò.`
          : `${updatedCount} updated, ${failedIds.size} failed. Try again.`,
        'circle-exclamation',
      );
    }

    // Keep failed rows selected so the creator can retry just those.
    setSelectedIds(failedIds);
    setBulkBusy(false);
    refetch();
  };

  const handleBulkDeleteClick = () => {
    const targets = selectedProducts;
    if (targets.length === 0) return;
    const count = targets.length;
    const quoted = targets.slice(0, 3).map((p) => `"${p.title}"`).join(', ');
    const rest = count > 3
      ? (lang === 'ht' ? ` ak ${count - 3} lòt` : ` and ${count - 3} more`)
      : '';

    setConfirm({
      title: lang === 'ht'
        ? `Efase ${count} ${count === 1 ? 'pwodwi' : 'pwodwi'}`
        : `Delete ${count} ${count === 1 ? 'product' : 'products'}`,
      message: lang === 'ht'
        ? `Sa ap efase nèt ${quoted}${rest}. Sa pa ka defèt.`
        : `This permanently deletes ${quoted}${rest}. This cannot be undone.`,
      confirmText: lang === 'ht' ? `Efase ${count}` : `Delete ${count}`,
      onConfirm: () => {
        const ids = new Set(targets.map((p) => p.id));
        removeLocal((row) => ids.has(row.id));
        setSelectedIds(new Set());
        setConfirmBusy(false);
        setConfirm(null);
        (async () => {
          const failedIds = new Set();
          for (let i = 0; i < targets.length; i += 5) {
            const batch = targets.slice(i, i + 5);
            const settled = await Promise.allSettled(
              batch.map((p) => marketplaceService.delete(p.id)),
            );
            settled.forEach((result, index) => {
              if (result.status === 'rejected') failedIds.add(batch[index].id);
            });
          }

          const deletedCount = count - failedIds.size;
          if (failedIds.size === 0) {
            showToast?.(
              lang === 'ht'
                ? `✅ ${deletedCount} pwodwi efase.`
                : `✅ ${deletedCount} ${deletedCount === 1 ? 'product' : 'products'} deleted.`,
              'check-circle',
            );
          } else if (deletedCount === 0) {
            showToast?.(
              lang === 'ht'
                ? `Pa t kapab efase ${failedIds.size} pwodwi.`
                : `Could not delete ${failedIds.size} ${failedIds.size === 1 ? 'product' : 'products'}.`,
              'circle-exclamation',
            );
          } else {
            showToast?.(
              lang === 'ht'
                ? `${deletedCount} efase, ${failedIds.size} echwe. Eseye ankò.`
                : `${deletedCount} deleted, ${failedIds.size} failed. Try again.`,
              'circle-exclamation',
            );
          }

          // Failed rows are restored by the refetch and stay selected.
          setSelectedIds(failedIds);
          refetch();
        })();
      },
    });
  };

  const hasFilters = query.trim() !== '' || statusFilter !== 'all';
  const clearFilters = () => {
    setQuery('');
    setStatusFilter('all');
  };

  const handleToggleActive = async (product) => {
    const nextActive = product.is_active === false;
    setTogglingId(product.id);
    // Optimistic: flip the badge/button now, reconcile via refetch.
    updateLocal((row) => row.id === product.id, { is_active: nextActive });
    try {
      await marketplaceService.update(product.id, { is_active: nextActive });
      showToast?.(
        nextActive
          ? (lang === 'ht' ? '✅ Pwodwi pibliye!' : '✅ Product is now published!')
          : (lang === 'ht' ? '🙈 Pwodwi kache.' : '🙈 Product hidden.'),
        'eye',
      );
      refetch();
    } catch (err) {
      // The server kept the old value — put the row back.
      updateLocal((row) => row.id === product.id, { is_active: product.is_active !== false });
      showToast?.(
        err?.response?.data?.detail
          || (lang === 'ht' ? 'Pa t kapab chanje estati a.' : 'Could not change the product status.'),
        'circle-exclamation',
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteClick = (item) => {
    setConfirm({
      item,
      title: lang === 'ht' ? 'Efase pwodwi' : 'Delete product',
      message: lang === 'ht' ? `Eske w sèten ou vle efase "${item.title}"?` : `Are you sure you want to delete "${item.title}"?`,
      onConfirm: () => {
        // Optimistic + non-blocking: the row vanishes instantly AND the
        // dialog closes right away — the DELETE finishes in the
        // background. (Backend cold starts can stall a request 30s+;
        // never trap the user behind a spinner.) A failed delete
        // refetches from the server, which restores the row.
        removeLocal((row) => row.id === item.id);
        setSelectedIds((prev) => {
          if (!prev.has(item.id)) return prev;
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        setConfirmBusy(false);
        setConfirm(null);
        (async () => {
          try {
            await marketplaceService.delete(item.id);
            showToast?.(lang === 'ht' ? '✅ Pwodwi efase!' : '✅ Product deleted!', 'check-circle');
          } catch (err) {
            showToast?.(err?.response?.data?.detail || (lang === 'ht' ? 'Pa t kapab efase.' : 'Could not delete.'), 'circle-exclamation');
          }
          refetch();
        })();
      },
    });
  };

  const isEmpty = products.length === 0;
  const showSkeleton = loading && isEmpty;
  const showError = Boolean(error) && isEmpty && !loading;
  const resultLabel = lang === 'ht'
    ? `${filteredProducts.length} sou ${products.length} pwodwi`
    : `${filteredProducts.length} of ${products.length} products`;

  return (
    <div className={styles.section}>
      <SectionHeader
        icon="fa-cube"
        title={t.studio_my_products || 'My Products'}
        lang={lang}
        help={{
          ht: 'Pwodwi dijital yo (ekip, dosye, abònman...) parèt nan Marketplace a. Ou jere pri, sòt, ak estati yo isit la.',
          en: 'Digital products (kits, files, subscriptions…) appear in the Marketplace. Manage their price, sales, and status here.',
        }}
        action={
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowProductModal(true)}
          >
            <i className="fas fa-plus" aria-hidden="true" />
            {t.studio_new_product || 'New Product'}
          </button>
        }
      />
      {showSkeleton ? (
        <ProductsTableSkeleton lang={lang} t={t} />
      ) : showError ? (
        <div className={styles.loadError} role="alert">
          <i className="fas fa-circle-exclamation" aria-hidden="true" />
          <p>{lang === 'ht' ? 'Pa t kapab chaje pwodwi yo.' : 'Products could not be loaded.'}</p>
          <button type="button" className={styles.loadMoreBtn} onClick={refetch}>
            {lang === 'ht' ? 'Eseye ankò' : 'Try again'}
          </button>
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon="fa-cube"
          title={t.studio_no_products || 'No products yet'}
          hint={t.studio_no_products_hint || 'List your first digital product on the marketplace.'}
          ctaLabel={t.studio_create_product || 'Create Product'}
          onCta={() => setShowProductModal(true)}
        />
      ) : (
        <>
          <div className={styles.productToolbar}>
            <label className={styles.productSearch}>
              <i className="fas fa-magnifying-glass" aria-hidden="true" />
              <span className={styles.srOnly}>
                {lang === 'ht' ? 'Chèche pwodwi' : 'Search products'}
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={lang === 'ht' ? 'Chèche pa non, tip…' : 'Search by name, type…'}
                autoComplete="off"
              />
            </label>
            <div
              className={styles.productFilters}
              role="group"
              aria-label={lang === 'ht' ? 'Filtre pa estati' : 'Filter products by status'}
            >
              {STATUS_FILTERS.map((value) => {
                const label = {
                  all: lang === 'ht' ? 'Tout' : 'All',
                  published: lang === 'ht' ? 'Pibliye' : 'Published',
                  draft: lang === 'ht' ? 'Bouyon' : 'Drafts',
                }[value];
                return (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.productFilter} ${statusFilter === value ? styles.productFilterActive : ''}`}
                    aria-pressed={statusFilter === value}
                    onClick={() => setStatusFilter(value)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <span className={styles.productCount} aria-live="polite">
              {resultLabel}
            </span>
          </div>

          {selectedProducts.length > 0 && (
            <div className={styles.bulkBar} role="region" aria-label={lang === 'ht' ? 'Aksyon an blòk' : 'Bulk actions'}>
              <span className={styles.bulkCount} aria-live="polite">
                {lang === 'ht' ? `${selectedProducts.length} chwazi` : `${selectedProducts.length} selected`}
              </span>
              <div className={styles.bulkActions}>
                <button
                  type="button"
                  className={`${styles.bulkBtn} ${styles.bulkBtnPrimary}`}
                  onClick={() => handleBulkActive(true)}
                  disabled={bulkBusy || selectedDraftCount === 0}
                >
                  {bulkBusy
                    ? (lang === 'ht' ? 'Ap mete ajou…' : 'Updating…')
                    : (lang === 'ht' ? 'Pibliye chwazi yo' : 'Publish selected')}
                </button>
                <button
                  type="button"
                  className={styles.bulkBtn}
                  onClick={() => handleBulkActive(false)}
                  disabled={bulkBusy || selectedLiveCount === 0}
                >
                  {bulkBusy
                    ? (lang === 'ht' ? 'Ap mete ajou…' : 'Updating…')
                    : (lang === 'ht' ? 'Kache chwazi yo' : 'Unpublish selected')}
                </button>
                <button
                  type="button"
                  className={`${styles.bulkBtn} ${styles.bulkBtnDanger}`}
                  onClick={handleBulkDeleteClick}
                  disabled={bulkBusy}
                >
                  {lang === 'ht' ? 'Efase chwazi yo' : 'Delete selected'}
                </button>
              </div>
              <button
                type="button"
                className={styles.bulkClear}
                onClick={() => setSelectedIds(new Set())}
                disabled={bulkBusy}
              >
                {lang === 'ht' ? 'Retire seleksyon' : 'Clear selection'}
              </button>
            </div>
          )}

          {filteredProducts.length === 0 ? (
            <div className={styles.tableWrap}>
              <div className={styles.filterEmpty} role="status">
                <i className="fas fa-magnifying-glass" aria-hidden="true" />
                <p>{lang === 'ht' ? 'Pa gen pwodwi ki matche ak filtè yo.' : 'No products match your filters.'}</p>
                <button type="button" className={styles.clearFilters} onClick={clearFilters}>
                  {lang === 'ht' ? 'Retire filtè yo' : 'Clear filters'}
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col" className={styles.selectCell}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        ref={(el) => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected; }}
                        onChange={toggleSelectAll}
                        disabled={bulkBusy}
                        aria-label={allVisibleSelected ? 'Deselect all shown' : 'Select all shown'}
                      />
                    </th>
                    <th scope="col" aria-sort={ariaSort('title')}>
                      <button type="button" className={`${styles.sortButton} ${sort?.key === 'title' ? styles.sortButtonActive : ''}`}
                        onClick={() => handleSort('title')} title={sortTitle(t.studio_product || 'Product')}>
                        {t.studio_product || 'Product'}
                        <i className={`fas ${sortIcon('title')}`} aria-hidden="true" />
                      </button>
                    </th>
                    <th scope="col" aria-sort={ariaSort('price')}>
                      <button type="button" className={`${styles.sortButton} ${sort?.key === 'price' ? styles.sortButtonActive : ''}`}
                        onClick={() => handleSort('price')} title={sortTitle(t.studio_price || 'Price')}>
                        {t.studio_price || 'Price'}
                        <i className={`fas ${sortIcon('price')}`} aria-hidden="true" />
                      </button>
                    </th>
                    <th scope="col" aria-sort={ariaSort('sales_count')}>
                      <button type="button" className={`${styles.sortButton} ${sort?.key === 'sales_count' ? styles.sortButtonActive : ''}`}
                        onClick={() => handleSort('sales_count')} title={sortTitle(t.studio_sold || 'Sold')}>
                        {t.studio_sold || 'Sold'}
                        <i className={`fas ${sortIcon('sales_count')}`} aria-hidden="true" />
                      </button>
                    </th>
                    <th scope="col" aria-sort={ariaSort('status')}>
                      <button type="button" className={`${styles.sortButton} ${sort?.key === 'status' ? styles.sortButtonActive : ''}`}
                        onClick={() => handleSort('status')} title={sortTitle(t.studio_status || 'Status')}>
                        {t.studio_status || 'Status'}
                        <i className={`fas ${sortIcon('status')}`} aria-hidden="true" />
                      </button>
                    </th>
                    <th scope="col" aria-label="Actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.map((p) => {
                    // The Product serializer exposes ``is_active`` (the real
                    // publish flag) — there is no ``status`` field.
                    const isLive = p.is_active !== false;
                    const isToggling = togglingId === p.id;
                    const kindLabel = {
                      digital: lang === 'ht' ? 'Dijital' : 'Digital',
                      physical: lang === 'ht' ? 'Fizik' : 'Physical',
                      service: lang === 'ht' ? 'Sèvis' : 'Service',
                      subscription: lang === 'ht' ? 'Abònman' : 'Subscription',
                    }[p.kind] || p.kind;
                    return (
                      <tr key={p.id}>
                        <td className={styles.selectCell}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(p.id)}
                            onChange={() => toggleSelect(p.id)}
                            disabled={bulkBusy}
                            aria-label={`${selectedIds.has(p.id) ? (lang === 'ht' ? 'Dekoleksyone' : 'Deselect') : (lang === 'ht' ? 'Seleksyone' : 'Select')} ${p.title}`}
                          />
                        </td>
                        <td className={styles.cellName}>
                          <div className={styles.productIdentity}>
                            <ProductThumb product={p} />
                            <div className={styles.productBody}>
                              {isLive && p.slug ? (
                                <a
                                  className={styles.productTitleLink}
                                  href={`/store/products/${encodeURIComponent(p.slug)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={lang === 'ht' ? 'Wè nan Store' : 'View in Store'}
                                >
                                  {p.title}
                                </a>
                              ) : (
                                <span className={styles.productTitleText}>{p.title}</span>
                              )}
                              <span className={styles.cellSub}>
                                <i className="fas fa-cube" aria-hidden="true" /> {kindLabel}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>{fmtCurrency(p.price)}</td>
                        <td>{fmtCount(p.sales_count || 0)}</td>
                        <td>
                          <span className={`${styles.badge} ${isLive ? styles.badgePublished : styles.badgeDraft}`}>
                            <i className={`fas ${isLive ? 'fa-eye' : 'fa-eye-slash'}`} aria-hidden="true" />
                            {isLive ? (lang === 'ht' ? 'Pibliye' : 'Published') : (lang === 'ht' ? 'Bouyon' : 'Draft')}
                          </span>
                        </td>
                        <td className={styles.cellActions}>
                          <button
                            type="button"
                            className={styles.editBtn}
                            onClick={() => handleToggleActive(p)}
                            disabled={isToggling}
                            aria-busy={isToggling}
                            title={isLive
                              ? (lang === 'ht' ? 'Depibliye' : 'Unpublish')
                              : (lang === 'ht' ? 'Pibliye' : 'Publish')}
                            aria-label={`${isLive
                              ? (lang === 'ht' ? 'Depibliye' : 'Unpublish')
                              : (lang === 'ht' ? 'Pibliye' : 'Publish')} ${p.title}`}
                          >
                            <i className={`fas ${isLive ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className={styles.editBtn}
                            onClick={() => onEdit?.(p)}
                            title={lang === 'ht' ? 'Modifye' : 'Edit'}
                            aria-label={`${lang === 'ht' ? 'Modifye' : 'Edit'} ${p.title}`}
                          >
                            <i className="fas fa-pen" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className={styles.deleteBtn}
                            onClick={() => handleDeleteClick(p)}
                            title={lang === 'ht' ? 'Efase' : 'Delete'}
                            aria-label={`${lang === 'ht' ? 'Efase' : 'Delete'} ${p.title}`}
                          >
                            <i className="fas fa-trash-can" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {hasMore && (
            <div className={styles.loadMoreRow}>
              {loadMoreError && (
                <span className={styles.loadMoreError} role="alert">
                  {lang === 'ht' ? 'Pa t kapab chaje plis.' : 'Could not load more.'}
                </span>
              )}
              <button
                type="button"
                className={styles.loadMoreBtn}
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore
                  ? (lang === 'ht' ? 'Ap chaje…' : 'Loading…')
                  : (loadMoreError
                    ? (lang === 'ht' ? 'Eseye ankò' : 'Try again')
                    : (lang === 'ht' ? 'Chaje plis' : 'Load more'))}
              </button>
            </div>
          )}

          {hasFilters && filteredProducts.length > 0 && (
            <p className={styles.filterHint}>
              {lang === 'ht'
                ? 'Filtè aktif — efase yo pou wè tout pwodwi yo.'
                : 'Filters are active — clear them to see every product.'}
            </p>
          )}
        </>
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          lang={lang}
          variant="danger"
          confirmText={confirm.confirmText}
          loading={confirmBusy}
          onConfirm={confirm.onConfirm}
          onCancel={() => { if (!confirmBusy) setConfirm(null); }}
        />
      )}
    </div>
  );
}
