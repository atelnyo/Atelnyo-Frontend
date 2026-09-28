/**
 * src/components/profile/ProfilePortfolioTab.jsx
 *
 * Tier-2 stem — extracted from CreatorPublicProfile.jsx (stage A-2 refactor).
 *
 * Renders the creator's portfolio projects.
 * Enriched: bilingual empty state, category chip, description snippet.
 */

import React from 'react';
import { SkeletonSection } from './ProfileSkeleton';
import { fmtCount } from './profileUtils';
import ProfileCatalogCard from './ProfileCatalogCard';

export default function PortfolioTab({ portfolio, loading, onItemClick, lang }) {
  if (loading) return <SkeletonSection />;
  if (!portfolio?.length) {
    return (
      <div className="csp-empty">
        <i className="fas fa-briefcase" aria-hidden="true" />
        <p>
          {lang === 'ht'
            ? 'Kreyatè sa a poko pibliye pwojè pòtfolyo pou kounye a.'
            : 'No portfolio projects yet.'}
        </p>
      </div>
    );
  }
  return (
    <div className="csp-card-grid" style={{ marginTop: 4 }}>
      {portfolio.map((project) => (
        <ProfileCatalogCard
          key={project.id}
          title={project.title}
          image={project.image_url}
          description={project.description}
          icon="fa-briefcase"
          typeLabel={lang === 'ht' ? 'Pòtfolyo' : 'Portfolio'}
          rating={project.rating}
          extra={<>{project.category && <span className="csp-catalog-card-chip">{project.category}</span>}{project.views > 0 && <span>· {fmtCount(project.views)} {lang === 'ht' ? 'vizit' : 'views'}</span>}</>}
          onOpen={() => onItemClick?.('portfolio', project.id, project)}
        />
      ))}
    </div>
  );
}
