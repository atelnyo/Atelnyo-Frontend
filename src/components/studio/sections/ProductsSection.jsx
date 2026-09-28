/**
 * src/components/studio/sections/ProductsSection.jsx
 *
 * Products section — lists creator's marketplace products in a table with
 * price, sales count, and status badge. Empty state with CTA.
 *
 * Extracted from CreatorStudio.jsx during Etap 2 refactor.
 * Refactored to use useFetch hook — Etap 5 (2026-07-19).
 */
import React, { useState } from 'react';
import { marketplaceService } from '../../../services/api';
import useFetch from '../../../hooks/useFetch';
import { StudioSkeleton, EmptyState, SectionHeader, fmtCurrency, fmtCount } from '../shared';
import ConfirmModal from '../../common/ConfirmModal';
import styles from './sections.module.css';

export default function ProductsSection({ lang, t, showToast, setShowProductModal, onEdit }) {
  const [confirm, setConfirm] = useState(null);
  const { data: products, loading, refetch } = useFetch(
    () => marketplaceService.list({ limit: 10, mine: true }),
    { defaultValue: [], transform: (d) => (Array.isArray(d?.results || d) ? (d?.results || d) : []) },
  );

  const handleDeleteClick = (item) => {
    setConfirm({
      item,
      title: lang === 'ht' ? 'Efase pwodwi' : 'Delete product',
      message: lang === 'ht' ? `Eske w sèten ou vle efase "${item.title}"?` : `Are you sure you want to delete "${item.title}"?`,
      onConfirm: async () => {
        try {
          await marketplaceService.delete(item.id);
          showToast?.(lang === 'ht' ? '✅ Pwodwi efase!' : '✅ Product deleted!', 'check-circle');
          refetch();
        } catch (err) {
          showToast?.(err?.response?.data?.detail || (lang === 'ht' ? 'Pa t kapab efase.' : 'Could not delete.'), 'circle-exclamation');
        }
        setConfirm(null);
      },
    });
  };

  if (loading) return <StudioSkeleton rows={3} />;

  const isEmpty = products.length === 0;

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
      {isEmpty ? (
        <EmptyState
          icon="fa-cube"
          title={t.studio_no_products || 'No products yet'}
          hint={t.studio_no_products_hint || 'List your first digital product on the marketplace.'}
          ctaLabel={t.studio_create_product || 'Create Product'}
          onCta={() => setShowProductModal(true)}
        />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t.studio_product || 'Product'}</th>
                <th>{t.studio_price || 'Price'}</th>
                <th>{t.studio_sold || 'Sold'}</th>
                <th>{t.studio_status || 'Status'}</th>
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                // The Product serializer exposes ``is_active`` (the real
                // publish flag) — there is no ``status`` field.
                const isLive = p.is_active !== false;
                const kindLabel = {
                  digital: lang === 'ht' ? 'Dijital' : 'Digital',
                  physical: lang === 'ht' ? 'Fizik' : 'Physical',
                  service: lang === 'ht' ? 'Sèvis' : 'Service',
                  subscription: lang === 'ht' ? 'Abònman' : 'Subscription',
                }[p.kind] || p.kind;
                return (
                <tr key={p.id}>
                  <td className={styles.cellName}>
                    {p.title}
                    <span className={styles.cellSub}>
                      <i className="fas fa-cube" aria-hidden="true" /> {kindLabel}
                    </span>
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
                    <button type="button" className={styles.editBtn} onClick={() => onEdit?.(p)}
                      title={lang === 'ht' ? 'Modifye' : 'Edit'}>
                      <i className="fas fa-pen" aria-hidden="true" />
                    </button>
                    <button type="button" className={styles.deleteBtn} onClick={() => handleDeleteClick(p)}
                      title={lang === 'ht' ? 'Efase' : 'Delete'}>
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

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          lang={lang}
          variant="danger"
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
