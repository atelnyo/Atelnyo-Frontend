/**
 * src/components/profile/ProfileTikTokTab.jsx
 *
 * Tier-2 stem — public profile "tiktok" section (plan C.6, spec 🖼️).
 *
 * Contract (same as ProfilePortfolioTab & friends):
 *   - loading → SkeletonSection
 *   - empty (no PUBLIC published posts) → bilingual empty state → the
 *     section auto-hides via the standard null/empty contract upstream
 *   - grid: 3 cols desktop / 2 tablet / 1 mobile · 9:16 tiles
 *   - thumbnails come from the backend's cached TikTok oEmbed
 *     (server-side ≥1h TTL — never fetched per render client-side)
 *   - click → open the post on TikTok (spec default: no inline embed)
 *
 * Data source: GET /api/creator-profiles/{username}/tiktok-posts/
 * (privacy-filtered server-side: published + PUBLIC_TO_EVERYONE only).
 */
import React from 'react';
import { SkeletonSection } from './ProfileSkeleton';
import ProfileCatalogCard from './ProfileCatalogCard';

export default function TikTokTab({ posts, loading, lang }) {
  if (loading) return <SkeletonSection />;
  if (!posts?.length) {
    return (
      <div className="csp-empty">
        <i className="fab fa-tiktok" aria-hidden="true" />
        <p>
          {lang === 'ht'
            ? 'Kreyatè sa a poko pataje videyo TikTok piblik.'
            : lang === 'fr'
              ? 'Aucune vidéo TikTok publique pour le moment.'
              : lang === 'es'
                ? 'Aún no hay videos públicos de TikTok.'
                : 'No public TikTok videos yet.'}
        </p>
      </div>
    );
  }
  return (
    <div className="csp-card-grid" style={{ marginTop: 4 }}>
      {posts.map((post) => {
        const thumb = post.embed && post.embed.thumbnail_url;
        const label = post.title || (
          lang === 'ht' ? 'Gade sou TikTok'
            : lang === 'fr' ? 'Voir sur TikTok'
              : lang === 'es' ? 'Ver en TikTok' : 'Watch on TikTok'
        );
        return (
          <a
            key={post.id}
            href={post.tiktok_url}
            target="_blank"
            rel="noopener noreferrer"
            className="csp-tiktok-tile"
            style={{
              position: 'relative',
              display: 'block',
              aspectRatio: '9 / 16',
              borderRadius: 14,
              overflow: 'hidden',
              background: thumb
                ? `center / cover no-repeat url(${thumb})`
                : 'linear-gradient(135deg, #25f4ee33 0%, #111 55%, #fe2c5533 100%)',
            }}
            aria-label={label}
          >
            <span
              style={{
                position: 'absolute',
                inset: 'auto 0 0 0',
                padding: '18px 10px 10px',
                fontSize: 12,
                color: '#fff',
                background: 'linear-gradient(transparent, rgba(0,0,0,.72))',
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <i className="fab fa-tiktok" aria-hidden="true" style={{ marginRight: 6 }} />
              {label}
            </span>
          </a>
        );
      })}
    </div>
  );
}
