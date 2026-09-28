/**
 * src/components/ProfileItemDetail.jsx
 *
 * Simple detail page placeholder for profile-linked items (courses,
 * marketplace products, portfolio projects, events) that don't yet
 * have their own dedicated page. Prevents blank/404 pages when
 * users click on cards in the Creator Public Profile.
 *
 * When a dedicated page component is built, replace the route in
 * App.jsx — no need to touch this file.
 */

import React, { useEffect, useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import useSavedItem from '../hooks/useSavedItem';
import SaveHeartButton from './SaveHeartButton';
import { buildContentUrl, buildContentShareUrl, isLegacyContentUrl } from '../utils/contentUrl';
import { resolveVideoSource } from '../modules/explore/utils/videoSource';

const ITEM_LABELS = {
  course: { ht: 'Kou', en: 'Course' },
  product: { ht: 'Pwodwi', en: 'Product' },
  portfolio: { ht: 'Pòtfolyo', en: 'Portfolio' },
  event: { ht: 'Evènman', en: 'Event' },
};

export default function ProfileItemDetail({ lang = 'ht', type, contentId, user, showToast }) {
  // ``id`` is the URL segment: the ``{id}`` from the canonical
  // ``/{id}@{user}/{type}`` key (contentId) or the legacy
  // ``/sheet/{type}/:id`` param.
  const { id: urlId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const id = contentId ?? urlId;
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const t = ITEM_LABELS[type] || ITEM_LABELS.course;
  const label = t[lang] || t.en;

  // Canonical URL upgrade: legacy /sheet/{type}/:id deep-links
  // redirect (replace) to /{id}@{user}/{type} once the payload loads.
  useEffect(() => {
    if (!item?.id) return;
    if (!isLegacyContentUrl(type, location.pathname)) return;
    navigate(buildContentUrl(type, item), { replace: true });
  }, [item?.id, type, location.pathname, navigate]);

  // ─── Save heart (generic SavedItem endpoint) ───────────────────
  const { isSaved, saveCount, saveBusy, handleToggleSave } = useSavedItem(
    type, item?.id, { user, showToast, t: undefined },
  );

  // ─── Share: copy the canonical /{slug}@{user}/{type} deep-link ──
  const handleShare = async () => {
    if (!item?.id) return;
    const url = buildContentShareUrl(type, item);
    if (navigator.share) {
      try {
        await navigator.share({ title: item?.title || item?.name || label, url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard not available — nothing else to do.
    }
  };

  useEffect(() => {
    if (!id) { setError(true); setLoading(false); return; }
    // Map type → API endpoint
    const endpointMap = {
      course: `courses/${id}/`,
      product: `marketplace/products/${id}/`,
      portfolio: `portfolio/projects/${id}/`,
      event: `community-events/${id}/`,
    };
    const endpoint = `/${endpointMap[type] || endpointMap.course}`;
    api.get(endpoint)
      .then(res => { setItem(res.data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [id, type]);

  if (loading) {
    return (
      <div className="sheet-page">
        <div className="sheet-page-header">
          <button type="button" className="sheet-back-btn" onClick={() => navigate(-1)}>
            <i className="fas fa-arrow-left" /> {lang === 'ht' ? 'Retounen' : 'Back'}
          </button>
          <span className="sheet-page-title">{label}</span>
        </div>
        <div className="sheet-page-body" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-spinner fa-pulse fa-2x" style={{ color: 'var(--pink-primary)' }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sheet-page">
        <div className="sheet-page-header">
          <button type="button" className="sheet-back-btn" onClick={() => navigate(-1)}>
            <i className="fas fa-arrow-left" /> {lang === 'ht' ? 'Retounen' : 'Back'}
          </button>
          <span className="sheet-page-title">{label}</span>
        </div>
        <div className="sheet-page-body" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-exclamation-triangle" style={{ fontSize: '3rem', color: 'var(--text-secondary)', marginBottom: 20, display: 'block' }} />
          <h2>{label} {lang === 'ht' ? 'pa jwenn' : 'not found'}</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{lang === 'ht' ? 'ID:' : 'ID:'} {id}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sheet-page">
      <div className="sheet-page-header">
        <button type="button" className="sheet-back-btn" onClick={() => navigate(-1)}>
          <i className="fas fa-arrow-left" /> {lang === 'ht' ? 'Retounen' : 'Back'}
        </button>
        <h2 className="sheet-page-title">{item?.title || item?.name || `${label} #${id}`}</h2>
        <SaveHeartButton
          className="sheet-share-btn"
          savedColor="var(--pink-primary, #2563eb)"
          isSaved={isSaved}
          saveBusy={saveBusy}
          saveCount={saveCount}
          onToggle={handleToggleSave}
          disabled={!item?.id}
          t={{
            mwen_save: lang === 'ht' ? 'Anrejistre' : 'Save',
            mwen_unsave: lang === 'ht' ? 'Retire' : 'Remove',
          }}
        />
        <button type="button" className="sheet-share-btn" onClick={handleShare}
          style={{ marginLeft: 0 }}
          aria-label={lang === 'ht' ? 'Pataje' : 'Share'}
          title={lang === 'ht' ? 'Pataje' : 'Share'}>
          <i className="fas fa-share-alt" aria-hidden="true" />
        </button>
      </div>
      <div className="sheet-page-body" style={{ padding: '20px' }}>
        <div className="csp-card-m3">
          {(() => {
            const img = type === 'event' ? (item?.cover_url || item?.image_url) : item?.image_url;
            if (!img) return null;
            return (
              <img src={img} alt={item.title || item.name || ''}
                style={{ width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 12, marginBottom: 16 }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            );
          })()}
          {/* Event trailer — same resolver/embed pattern as the sheets. */}
          {type === 'event' && item?.trailer_url && (() => {
            const trailer = resolveVideoSource(item.trailer_url);
            if (!trailer) return null;
            return (
              <div style={{ marginBottom: 16 }}>
                {trailer.kind === 'embed' ? (
                  <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 12, background: '#000' }}>
                    <iframe
                      src={trailer.src}
                      title={item.title || 'Event trailer'}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <video
                    src={trailer.src}
                    controls
                    preload="metadata"
                    playsInline
                    poster={item.cover_url || undefined}
                    style={{ width: '100%', maxHeight: '60vh', borderRadius: 12, background: '#000', display: 'block' }}
                  />
                )}
              </div>
            );
          })()}
          <h2 style={{ marginBottom: 8 }}>{item?.title || item?.name || `${label} #${id}`}</h2>
          {item?.description && (
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {item.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
