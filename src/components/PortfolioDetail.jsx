/**
 * src/components/PortfolioDetail.jsx
 *
 * PortfolioDetail — full INC-style project page for /portfolio/:id.
 * Replaces the simple ProfileItemDetail placeholder with a rich
 * layout featuring project cover hero, creator info, description,
 * stats, and project link CTA.
 *
 * Layout: pfd-page → pfd-sticky-header → pfd-hero → pfd-body
 *   (creator card, project info, description, stats, URL CTA)
 */

import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import useSafeNavigate from '../hooks/useSafeNavigate';
import useSavedItem from '../hooks/useSavedItem';
import SaveHeartButton from './SaveHeartButton';
import { useLocation, useParams } from 'react-router-dom';
import { portfolioService } from '../services/api';
import { translations } from '../data/translations';
import { buildContentUrl, buildContentShareUrl, isLegacyContentUrl } from '../utils/contentUrl';
import { historyBack } from '../utils/history';
import { resolvePortfolioVideo } from '../modules/explore/utils/cardHelpers';
import { resolveVideoSource } from '../modules/explore/utils/videoSource';

/* ─── Constants ────────────────────────────────────────────────── */
function buildOGFallback() {
  try {
    return 'data:image/svg+xml;base64,' + btoa(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">'
      + '<defs><linearGradient id="og-grad" x1="0%" y1="0%" x2="100%" y2="100%">'
      + '<stop offset="0%" stopColor="#d81b60"/><stop offset="100%" stopColor="#8b5cf6"/></linearGradient>'
      + '</defs><rect width="1200" height="630" fill="url(#og-grad)"/>'
      + '<g transform="translate(600,315)">'
      + '<circle r="180" fill="rgba(255,255,255,0.1)"/>'
      + '<path d="M-60-40 L60-40 L0-100 Z M-50-20 L0-60 L50-20 Z M0-40 L0-60" fill="#fff" opacity="0.9"/>'
      + '<text x="0" y="30" textAnchor="middle" fill="#fff" fontFamily="system-ui,sans-serif"'
      + '  fontSize="48" fontWeight="700" opacity="0.95">Atelnyo</text>'
      + '<text x="0" y="70" textAnchor="middle" fill="rgba(255,255,255,0.6)"'
      + '  fontFamily="system-ui,sans-serif" fontSize="20">Atelnyo</text>'
      + '</g></svg>',
    );
  } catch (_) {
    return 'https://images.unsplash.com/photo-1501504905252-473c47e087f8?auto=format&fit=crop&w=1200&q=80';
  }
}
const OG_IMAGE_FALLBACK = buildOGFallback();

function truncateText(text, max = 200) {
  if (typeof text !== 'string' || text.length === 0) return '';
  if (text.length <= max) return text;
  return text.slice(0, max - 3).trimEnd() + '\u2026';
}

function buildOgUrl(id) {
  const origin = (typeof window !== 'undefined' && window.location && window.location.origin)
    || 'https://atelnyo.site';
  return `${origin}/portfolio/${encodeURIComponent(id || '')}`;
}

function formatDate(iso, lang) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(
      lang === 'ht' ? 'fr-HT' : lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US',
      { year: 'numeric', month: 'short', day: 'numeric' },
    );
  } catch (_) { return ''; }
}

function categoryAccent(cat) {
  switch ((cat || '').toLowerCase()) {
    case 'web':      return { bg: 'rgba(96,165,250,0.15)', color: '#60a5fa', icon: 'fa-globe' };
    case 'design':   return { bg: 'rgba(244,114,182,0.15)', color: '#f472b6', icon: 'fa-palette' };
    case 'mobile':   return { bg: 'rgba(52,211,153,0.15)', color: '#34d399', icon: 'fa-mobile-screen' };
    case 'music':    return { bg: 'rgba(251,146,60,0.15)', color: '#fb923c', icon: 'fa-music' };
    case 'art':      return { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa', icon: 'fa-paintbrush' };
    case 'writing':  return { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', icon: 'fa-feather' };
    default:         return { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', icon: 'fa-briefcase' };
  }
}

/* ─── Inline style helpers ─────────────────────────────────────── */
const S = {
  flexCol: { display: 'flex', flexDirection: 'column' },
  flexRow: { display: 'flex', alignItems: 'center' },
  gap4:  { gap: 4 },
  gap6:  { gap: 6 },
  gap8:  { gap: 8 },
  gap10: { gap: 10 },
  gap12: { gap: 12 },
  gap16: { gap: 16 },
};

/* ─── SVG Fallback for project cover image ─────────────────────── */
function PortfolioFallback({ title }) {
  return (
    <div className="pd-hero-fallback">
      <svg viewBox="0 0 800 450" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
        style={{ width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="pfd-fb-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#d81b60" stopOpacity="0.06" />
          </linearGradient>
        </defs>
        <rect width="800" height="450" fill="url(#pfd-fb-grad)" />
        <g transform="translate(400,190)" opacity="0.15">
          <circle cx="0" cy="-30" r="30" fill="none" stroke="#8b5cf6" strokeWidth="2.5" />
          <path d="M-22 10 L0-20 L22 10" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="-10" y="10" width="20" height="22" rx="4" fill="#8b5cf6" />
          <rect x="-30" y="40" width="60" height="6" rx="3" fill="#d81b60" opacity="0.5" />
          <rect x="-20" y="52" width="40" height="4" rx="2" fill="#d81b60" opacity="0.3" />
        </g>
        <text x="400" y="310" textAnchor="middle" fill="#8b5cf6" opacity="0.4"
          fontFamily="system-ui, -apple-system, sans-serif" fontSize="16" fontWeight="600">
          {title || 'Portfolio Project'}
        </text>
      </svg>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════ */
export default function PortfolioDetail({ lang = 'ht', project: propProject, onBack, contentId, showToast, user }) {
  // ``id`` is the URL segment: the ``{id}`` from the canonical
  // ``/{id}@{user}/portfolio`` key (contentId) or the legacy
  // ``/portfolio/:id`` param — both accept pk-or-slug.
  const { id: urlId } = useParams();
  const location = useLocation();
  const navigate = useSafeNavigate();
  const id = contentId ?? urlId;
  const t = (translations && translations[lang]) || translations.ht || {};

  const [project, setProject] = useState(propProject || null);
  const [loading, setLoading] = useState(!propProject);
  const [errCode, setErrCode] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const cancelledRef = useRef(false);

  // Accept any non-empty segment — integer pk or slug string. The
  // canonical /{slug}@{user}/portfolio URL carries the slug; the
  // backend SlugOrPkLookupMixin resolves both, so we pass the raw
  // segment straight through (same pattern as MusicSheet/JobSheet).
  const idValid = typeof id === 'string' && id.length > 0;

  /* ─── Fetch project (only when no propProject provided) ──────── */
  useEffect(() => {
    if (propProject) {
      setLoading(false);
      setErrCode(null);
      return;
    }
    cancelledRef.current = false;
    if (!idValid) {
      setLoading(false);
      setErrCode('not_found');
      return;
    }
    setLoading(true);
    setErrCode(null);
    portfolioService.get(id)
      .then((res) => {
        if (cancelledRef.current) return;
        setProject(res?.data || null);
      })
      .catch((err) => {
        if (cancelledRef.current) return;
        const status = err?.response?.status;
        setErrCode(status === 404 ? 'not_found' : 'load_error');
      })
      .finally(() => {
        if (!cancelledRef.current) setLoading(false);
      });
    return () => { cancelledRef.current = true; };
  }, [id, idValid, propProject]);

  /* ─── Canonical URL upgrade: legacy /portfolio/:id deep-links
       redirect (replace) to /{id}@{user}/portfolio once loaded. ── */
  useEffect(() => {
    if (!project?.id) return;
    if (!isLegacyContentUrl('portfolio', location.pathname)) return;
    navigate(buildContentUrl('portfolio', project), { replace: true });
  }, [project?.id, location.pathname, navigate]);

  /* ─── Scroll-aware sticky header ────────────────────────────── */
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  /* ─── Track view ────────────────────────────────────────────── */
  useEffect(() => {
    if (project?.id) {
      portfolioService.view(project.id).catch(() => {});
    }
  }, [project?.id]);

  // ─── Content Intelligence SEO data ─────────────────────────────
  const [ciSeo, setCiSeo] = useState(null);
  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    portfolioService.getSEO(project.id)
      .then((res) => {
        if (!cancelled && res?.data?.status === 'ready') setCiSeo(res.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [project?.id]);

  /* ─── Meta tags ─────────────────────────────────────────────── */
  const fallbackTitle = lang === 'ht' ? 'Pwojè · Atelnyo' : 'Portfolio · Atelnyo';
  let pageTitle = fallbackTitle;
  if (project?.title) {
    pageTitle = `${project.title} · Atelnyo Portfolio`;
  }
  const descriptionForMeta = truncateText(project?.description);
  const ogUrl = buildOgUrl(id);
  // (og:locale is owned by App.jsx's global <Helmet> — see Helmet below.)

  const handleBack = () => {
    if (onBack) return onBack();
    // Opened from a public profile / Explore card (no onBack prop): go
    // back in history instead of dumping the user on Explore. Falls back
    // to '/' only when there is no prior entry (direct deep-link). Uses
    // history.state.idx — history.length is unreliable on fresh tabs.
    return historyBack(navigate);
  };

  /* ─── Share: copy the canonical /{id}@{user}/portfolio deep-link ── */
  // ─── Save heart (generic SavedItem endpoint) ───────────────────
  const { isSaved, saveCount, saveBusy, handleToggleSave } = useSavedItem(
    'portfolio', project?.id, { user, showToast, t },
  );

  const handleShare = async () => {
    if (!project?.id) return;
    const url = buildContentShareUrl('portfolio', project);
    if (navigator.share) {
      try {
        await navigator.share({ title: project.title || 'Portfolio', url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast?.(t.share_link_copied || (lang === 'ht' ? 'Lyen kopye!' : 'Link copied!'), 'check-circle');
    } catch {
      // Clipboard not available — nothing else to do.
    }
  };

  /* ─── Render ────────────────────────────────────────────────── */
  return (
    <>
      <Helmet>
        <title>{ciSeo?.title || pageTitle}</title>
        <meta property="og:type" content="website" />
        <meta property="og:url" content={ogUrl} />
        <meta property="og:site_name" content="Atelnyo" />
        <meta property="og:title" content={ciSeo?.og_title || pageTitle} />
        <meta property="og:description" content={ciSeo?.og_description || descriptionForMeta} />
        <meta property="og:image" content={ciSeo?.og_image || project?.cover_url || OG_IMAGE_FALLBACK} />
        {/* og:locale lives in App.jsx's global <Helmet> (market-aware) —
            a second one here duplicated the tag. */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ciSeo?.title || pageTitle} />
        <meta name="twitter:description" content={ciSeo?.description || descriptionForMeta} />
        <meta name="twitter:image" content={ciSeo?.og_image || project?.cover_url || OG_IMAGE_FALLBACK} />
      </Helmet>

      <div className="pd-page" data-detail-sheet data-testid="portfolio-detail-sheet" data-project-id={typeof id === 'string' ? id : ''} data-lang={lang}>

        {/* ─── Sticky Header ─────────────────────────────────────── */}
        <header className={`pd-sticky-header${scrolled ? ' pd-sticky-header--scrolled' : ''}`}>
          <div className="pd-sticky-header-inner">
            <button type="button" className="pd-header-back" onClick={handleBack}
              aria-label={lang === 'ht' ? 'Retounen' : 'Back'}>
              <i className="fas fa-arrow-left" aria-hidden="true" />
            </button>
            <span className={`pd-header-title${scrolled ? ' pd-header-title--visible' : ''}`}>
              {project?.title || (lang === 'ht' ? 'Pwojè' : 'Project')}
            </span>
            <div className="pd-header-actions">
              <SaveHeartButton
                className="cd-header-action-btn"
                savedColor="var(--pd-primary, #2563eb)"
                isSaved={isSaved}
                saveBusy={saveBusy}
                saveCount={saveCount}
                onToggle={handleToggleSave}
                t={t}
              />
              <button
                type="button"
                onClick={handleShare}
                disabled={!project}
                aria-label={t.share_portfolio || 'Share'}
                title={t.share_portfolio || 'Share'}
                className="cd-header-action-btn"
              >
                <i className="fas fa-share-alt" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        {/* ─── Hero ───────────────────────────────────────────────── */}
        <section className="pd-hero">
          {loading ? (
            <div className="pd-hero-skeleton" />
          ) : errCode ? (
            <div className="pd-hero-fallback">
              <div className="pd-hero-fallback-grad" style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #d81b60 50%, #f472b6 100%)',
              }} />
            </div>
          ) : project?.cover_url && !imgFailed ? (
            <img
              className={`pd-hero-img ${!loading ? 'pd-hero-img--loaded' : ''}`}
              src={project.cover_url}
              alt={project.title}
              onError={() => setImgFailed(true)}
            />
          ) : (
            <PortfolioFallback title={project?.title} />
          )}

          {/* ─── Hero Gradient Overlay ────────────────────────────── */}            <div className="pd-hero-overlay" />

          {/* ─── Hero Content ─────────────────────────────────────── */}
          <div className="pd-hero-content pd-hero-content--loaded">
            {loading ? (
              <div style={{ ...S.flexCol, alignItems: 'center', gap: 14, padding: '30px 0', color: 'rgba(255,255,255,0.7)' }}
                role="status" aria-live="polite">
                <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem' }} aria-hidden="true" />
                <span style={{ fontSize: '0.9rem' }}>
                  {lang === 'ht' ? 'Ap chaje pwojè a...' : 'Loading project...'}
                </span>
              </div>
            ) : errCode === 'not_found' ? (
              <EmptyHero icon="fa-circle-question" msg={lang === 'ht' ? 'Pwojè a pa jwenn.' : 'Project not found.'} />
            ) : errCode === 'load_error' ? (
              <EmptyHero icon="fa-triangle-exclamation" msg={lang === 'ht' ? 'Nou pa t kapab chaje pwojè a.' : 'Could not load project.'} />
            ) : project ? (
              <HeroContent project={project} t={t} lang={lang} />
            ) : (
              <EmptyHero icon="fa-circle-question" msg="Not found." />
            )}
          </div>
        </section>

        {/* ─── Body ────────────────────────────────────────────────── */}
        {project && !loading && !errCode && (
          <div className="pd-body">
            <div className="pd-body-inner">

              {/* ─── Creator Card ────────────────────────────────────── */}
              <CreatorCard project={project} lang={lang} />

              {/* ─── Project Info ────────────────────────────────────── */}
              <section className="pd-section">
                <h2 className="pd-section-title">
                  <i className="fas fa-info-circle" aria-hidden="true" />
                  {lang === 'ht' ? 'Enfòmasyon Pwojè' : 'Project Info'}
                </h2>
                <InfoGrid project={project} lang={lang} t={t} />
              </section>

              {/* ─── Description ────────────────────────────────────── */}
              {project.description && (
                <section className="pd-section">
                  <h2 className="pd-section-title">
                    <i className="fas fa-align-left" aria-hidden="true" />
                    {lang === 'ht' ? 'Deskripsyon' : 'Description'}
                  </h2>
                  <p className="pd-text" style={{ whiteSpace: 'pre-wrap' }}>{project.description}</p>
                </section>
              )}

              {/* ─── Stats ──────────────────────────────────────────── */}
              <section className="pd-section">
                <h2 className="pd-section-title">
                  <i className="fas fa-chart-simple" aria-hidden="true" />
                  {lang === 'ht' ? 'Estadistik' : 'Statistics'}
                </h2>
                <div className="pd-stats-grid">
                  <StatTile icon="fa-eye" label={lang === 'ht' ? 'Vizit' : 'Views'}
                    value={project.views != null ? String(project.views) : '0'} />
                  <StatTile icon="fa-calendar" label={lang === 'ht' ? 'Kreye' : 'Created'}
                    value={formatDate(project.created_at, lang)} />
                  {project.updated_at && (
                    <StatTile icon="fa-clock" label={lang === 'ht' ? 'Dènye Mizajou' : 'Updated'}
                      value={formatDate(project.updated_at, lang)} />
                  )}
                  {project.category && (
                    <StatTile icon="fa-tag" label={lang === 'ht' ? 'Kategori' : 'Category'}
                      value={project.category} />
                  )}
                </div>
              </section>

              {/* ─── Demo Video ────────────────────────────────────── */}
              {(() => {
                const videoUrl = resolvePortfolioVideo(project);
                if (!videoUrl) return null;
                const demo = resolveVideoSource(videoUrl);
                if (!demo) return null;
                return (
                  <section className="pd-section">
                    <h2 className="pd-section-title">
                      <i className="fas fa-video" aria-hidden="true" />
                      {lang === 'ht' ? 'Videyo Demo' : 'Demo Video'}
                    </h2>
                    {demo.kind === 'embed' ? (
                      <div style={{
                        position: 'relative', paddingBottom: '56.25%', height: 0,
                        overflow: 'hidden', borderRadius: 12, background: '#000',
                      }}>
                        <iframe
                          src={demo.src}
                          title={project.title || 'Demo video'}
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <video
                        src={demo.src}
                        controls
                        preload="metadata"
                        playsInline
                        poster={project.cover_url || undefined}
                        style={{ width: '100%', maxHeight: '70vh', borderRadius: 12, background: '#000', display: 'block' }}
                      >
                        {lang === 'ht'
                          ? 'Navigatè w pa sipòte lekti videyo.'
                          : 'Your browser does not support video playback.'}
                      </video>
                    )}
                  </section>
                );
              })()}

              {/* ─── Project URL CTA ─────────────────────────────────── */}
              {project.project_url && (
                <div className="pd-price-card">
                  <div className="pd-price-card-header">
                    <div className="pd-price-card-info">
                      <span className="pd-price-label">
                        <i className="fas fa-link" style={{ marginRight: 6 }} />
                        {lang === 'ht' ? 'Lyen Pwojè' : 'Project Link'}
                      </span>
                      <span className="pd-url-display" style={{
                        fontSize: '0.8rem', color: 'var(--pd-text-secondary, #64748b)',
                        wordBreak: 'break-all', maxWidth: '100%',
                      }}>
                        {project.project_url}
                      </span>
                    </div>
                    <a
                      href={project.project_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pd-cta-btn"
                    >
                      <i className="fas fa-external-link-alt" aria-hidden="true" />
                      {lang === 'ht' ? 'Vizite Pwojè' : 'Visit Project'}
                    </a>
                  </div>
                  <p className="pd-price-disclaimer">
                    <i className="fas fa-shield-alt" style={{ marginRight: 4, opacity: 0.5 }} />
                    {lang === 'ht'
                      ? 'Ou pral kite Atelnyo pou w ale sou yon sit ekstèn.'
                      : 'You will leave Atelnyo to visit an external site.'}
                  </p>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
   HERO CONTENT — category badge + title + creator
   ══════════════════════════════════════════════════════════════════ */
function HeroContent({ project, t, lang }) {
  const accent = categoryAccent(project.category);
  const initial = (project.created_by_username || '?')[0].toUpperCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      {/* ─── Tags ──────────────────────────────────────────────── */}
      <div className="pd-hero-tags" style={{ justifyContent: 'center' }}>
        {project.category && (
          <span className="pd-tag" style={{
            background: accent.bg, color: accent.color,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}>
            <i className={`fas ${accent.icon}`} style={{ fontSize: '0.65rem', marginRight: 4 }} />
            {project.category}
          </span>
        )}          <span className="pd-tag" style={{
            background: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}>
            <i className="fas fa-file-alt" style={{ fontSize: '0.65rem', marginRight: 4 }} />
            {lang === 'ht' ? 'Pwojè' : 'Project'}
          </span>
      </div>

      {/* ─── Title ────────────────────────────────────────────────── */}
      <h1 className="pd-hero-title" style={{ fontSize: '1.8rem', margin: '10px 0 6px' }}>
        {project.title}
      </h1>

      {/* ─── Creator ──────────────────────────────────────────────── */}
      {project.created_by_username && (
        <div className="pd-hero-creator" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          marginTop: 6, padding: '4px 16px 4px 4px',
          borderRadius: 50, background: 'rgba(255,255,255,0.12)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '0.75rem', color: '#fff',
          }}>
            {initial}
          </div>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem' }}>
            {lang === 'ht' ? 'Pa' : 'By'} <strong>{project.created_by_username}</strong>
          </span>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   CREATOR CARD — creator info card
   ══════════════════════════════════════════════════════════════════ */
function CreatorCard({ project, lang }) {
  const initial = (project.created_by_username || '?')[0].toUpperCase();

  return (
    <div className="pd-seller-card">
      <div className="pd-seller-avatar">
        {initial}
      </div>
      <div className="pd-seller-info">
        <span className="pd-seller-label">
          {lang === 'ht' ? 'Kreyatè' : 'Creator'}
        </span>
        <span className="pd-seller-name">
          {project.created_by_username || (lang === 'ht' ? 'Endikap' : 'Unknown')}
        </span>
      </div>
      {project.views > 0 && (
        <span className="pd-seller-badge">
          <i className="fas fa-eye" style={{ fontSize: '0.6rem', marginRight: 4 }} />
          {project.views} {lang === 'ht' ? 'vizit' : 'views'}
        </span>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   INFO GRID — category, created date, updated date
   ══════════════════════════════════════════════════════════════════ */
function InfoGrid({ project, lang, t }) {
  const accent = categoryAccent(project.category);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
      <InfoTile
        icon={`fas ${accent.icon}`}
        label={lang === 'ht' ? 'Kategori' : 'Category'}
        value={project.category || '—'}
        iconColor={accent.color}
      />
      <InfoTile
        icon="fas fa-calendar-plus"
        label={lang === 'ht' ? 'Kreye' : 'Created'}
        value={formatDate(project.created_at, lang) || '—'}
      />
      {project.updated_at && (
        <InfoTile
          icon="fas fa-clock"
          label={lang === 'ht' ? 'Mizajou' : 'Updated'}
          value={formatDate(project.updated_at, lang)}
        />
      )}
      <InfoTile
        icon="fas fa-eye"
        label={lang === 'ht' ? 'Vizit' : 'Views'}
        value={project.views != null ? String(project.views) : '0'}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   INFO TILE — grid cell
   ══════════════════════════════════════════════════════════════════ */
function InfoTile({ icon, label, value, iconColor }) {
  return (                <div className="pd-info-tile">
      <div className="pd-info-tile-header">
        <i className={icon} style={{ fontSize: '0.7rem', opacity: 0.6, color: iconColor }} />
        {label}
      </div>
      <span className="pd-info-tile-value">{value}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   STAT TILE — stats grid cell
   ══════════════════════════════════════════════════════════════════ */
function StatTile({ icon, label, value }) {
  return (
    <div className="pd-stat-tile">
      <div className="pd-stat-tile-icon">
        <i className={`fas ${icon}`} />
      </div>
      <div className="pd-stat-tile-body">
        <span className="pd-stat-tile-value">{value}</span>
        <span className="pd-stat-tile-label">{label}</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   EMPTY HERO — for error states
   ══════════════════════════════════════════════════════════════════ */
function EmptyHero({ icon, msg }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      padding: '30px 0', color: 'rgba(255,255,255,0.6)',
    }}>
      <i className={`fas ${icon}`} style={{ fontSize: '2rem', opacity: 0.3 }} aria-hidden="true" />
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{msg}</p>
    </div>
  );
}
