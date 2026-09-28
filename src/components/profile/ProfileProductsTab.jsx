/**
 * src/components/profile/ProfileProductsTab.jsx
 *
 * Tier-2 stem — extracted from CreatorPublicProfile.jsx (stage A-2 refactor).
 *
 * Renders the creator's product catalog.
 * Enriched: bilingual empty state, star rating, description snippet.
 */

import React from 'react';
import { SkeletonSection } from './ProfileSkeleton';
import { fmtCount, isNewItem } from './profileUtils';
import { RatingStars } from './ProfileCoursesTab';
import ProfileCatalogCard from './ProfileCatalogCard';

export default function ProductsTab({ products, loading, onItemClick, lang }) {
  if (loading) return <SkeletonSection />;
  if (!products?.length) {
    return (
      <div className="csp-empty">
        <i className="fas fa-cube" aria-hidden="true" />
        <p>
          {lang === 'ht'
            ? 'Kreyatè sa a poko mete pwodwi pou kounye a.'
            : 'No products yet.'}
        </p>
      </div>
    );
  }
  return (
    <div className="csp-card-grid" style={{ marginTop: 4 }}>
      {products.map((product) => (
        <ProfileCatalogCard
          key={product.id}
          title={product.title}
          image={product.image_url}
          description={product.description}
          icon="fa-cube"
          typeLabel={lang === 'ht' ? 'Pwodwi' : 'Product'}
          price={`$${product.price || 0}`}
          freeLabel={lang === 'ht' ? 'Gratis' : 'Free'}
          rating={product.rating}
          isFeatured={!!product.is_featured}
          isNew={isNewItem(product.created_at)}
          isPopular={product.sales_count >= 25}
          badgeLabels={{
            featured: lang === 'ht' ? 'Rekòmande' : 'Featured',
            new: lang === 'ht' ? 'Nouvo' : 'New',
            popular: lang === 'ht' ? 'Popilè' : 'Popular',
          }}
          extra={product.sales_count > 0 ? <span>· {fmtCount(product.sales_count)} {lang === 'ht' ? 'vann' : 'sold'}</span> : null}
          onOpen={() => onItemClick?.('product', product.id, product)}
        />
      ))}
    </div>
  );
}
