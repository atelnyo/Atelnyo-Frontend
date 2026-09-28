/**
 * src/components/SpotlightDetail.jsx
 *
 * Phase 49 §11.4 — Spotlight deep-link page (INC-style pwofil biznis).
 *
 * Kounye a Spotlight la sanble ak yon INC (Incorporated) — pwofil
 * konpanyi/talan konplè ak tout enfòmasyon kreyatè a.
 *
 * Layout: cd-page → cd-hero → cd-body (creator-card, description,
 * creator bio, info grid, skills, social links, demo CTA, contact).
 *
 * All OG / Twitter Card meta tags preserved for rich sharing previews.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import useSafeNavigate from '../hooks/useSafeNavigate';
import useSavedItem from '../hooks/useSavedItem';
import SaveHeartButton from './SaveHeartButton';
import { useLocation, useParams } from 'react-router-dom';
import { spotlightService, creatorProfileService } from '../services/api';
import { translations } from '../data/translations';
import { buildContentUrl, isLegacyContentUrl } from '../utils/contentUrl';
import { BASE_URL } from '../seo/seoConfig';
import { ogImageForLang } from './profile/profileConstants';

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

function truncateDescription(desc) {
  if (typeof desc !== 'string' || desc.length === 0) return '';
  if (desc.length <= 200) return desc;
  return desc.slice(0, 197).trimEnd() + '\u2026';
}

function buildOgUrl(idParam) {
  const origin = (typeof window !== 'undefined' && window.location && window.location.origin)
    || 'https://atelnyo.site';
  return `${origin}/sheet/spotlight/${encodeURIComponent(idParam || '')}`;
}

function resolveCategoryLabel(cat, t, lang) {
  const FALLBACK_BY_LANG = {
    ht: { talent: 'Talan', commerce: 'Mache', course: 'Kou', other: 'Lòt' },
    fr: { talent: 'Talent', commerce: 'Marché', course: 'Cours', other: 'Autre' },
    es: { talent: 'Talento', commerce: 'Mercado', course: 'Curso', other: 'Otro' },
    en: { talent: 'Talent', commerce: 'Commerce', course: 'Course', other: 'Other' },
  };
  const dynamic =
    (cat === 'talent'   && (t?.explore_spotlight_cat_talent))
    || (cat === 'commerce' && (t?.explore_spotlight_cat_commerce))
    || (cat === 'course'   && (t?.explore_spotlight_cat_course))
    || (cat === 'other'    && (t?.explore_spotlight_cat_other));
  if (typeof dynamic === 'string' && dynamic.length > 0) return dynamic;
  const fb = FALLBACK_BY_LANG[lang] || FALLBACK_BY_LANG.en;
  return fb[cat] || fb.other;
}

function formatDate(iso, lang) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(
      lang === 'ht' ? 'fr-HT' : lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US',
      { year: 'numeric', month: 'short', day: 'numeric' },
    );
  } catch (_) {
    return '';
  }
}

function categoryColor(cat) {
  switch (cat) {
    case 'talent': return { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa', icon: 'fa-star' };
    case 'commerce': return { bg: 'rgba(52,211,153,0.15)', color: '#34d399', icon: 'fa-store' };
    case 'course': return { bg: 'rgba(96,165,250,0.15)', color: '#60a5fa', icon: 'fa-graduation-cap' };
    default: return { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', icon: 'fa-lightbulb' };
  }
}

const CATEGORY_CFG = {
  talent:   { bg: 'linear-gradient(135deg, #7c3aed22, #f59e0b18)', border: '#7c3aed44', pill: '#7c3aed', icon: 'fa-star' },
  commerce: { bg: 'linear-gradient(135deg, #05966922, #34d39918)', border: '#05966944', pill: '#059669', icon: 'fa-store' },
  course:   { bg: 'linear-gradient(135deg, #2563eb22, #60a5fa18)', border: '#2563eb44', pill: '#2563eb', icon: 'fa-graduation-cap' },
  other:    { bg: 'linear-gradient(135deg, #d81b6022, #f59e0b18)', border: '#d81b6044', pill: '#d81b60', icon: 'fa-lightbulb' },
};

/* ─── Inline style helpers ──────────────────────────────────────── */
const S = {
  flexCol: { display: 'flex', flexDirection: 'column' } ,
  flexRow: { display: 'flex', alignItems: 'center' } ,
  gap4: { gap: 4 } ,
  gap6: { gap: 6 } ,
  gap8: { gap: 8 } ,
  gap10: { gap: 10 } ,
  gap12: { gap: 12 } ,
  gap16: { gap: 16 } ,
  gap20: { gap: 20 } ,
};

export default function SpotlightDetail({ lang = 'ht', contentId, user, showToast }) {
  // ``id`` is the URL segment: the ``{id}`` from the canonical
  // ``/{id}@{user}/spotlight`` key (contentId), or the legacy
  // ``/sheet/spotlight/:id`` param — both accept pk-or-slug.
  const { id: urlId } = useParams();
  const location = useLocation();
  const navigate = useSafeNavigate();
  const id = contentId ?? urlId;
  const t = (translations && translations[lang]) || translations.ht || {};

  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errCode, setErrCode] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [creatorProfile, setCreatorProfile] = useState(null);
  const [creatorLoading, setCreatorLoading] = useState(false);
  const [relatedSpotlights, setRelatedSpotlights] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const cancelledRef = useRef(false);

  // Accept any non-empty segment — integer pk or slug string. The
  // canonical /{slug}@{user}/spotlight URL carries the slug; the
  // backend SlugOrPkLookupMixin resolves both, so we pass the raw
  // segment straight through (same pattern as MusicSheet/JobSheet).
  const idValid = typeof id === 'string' && id.length > 0;

  // ─── Fetch spotlight ──────────────────────────────────────────────
  useEffect(() => {
    cancelledRef.current = false;
    if (!idValid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      setErrCode('not_found');
      return;
    }
    setLoading(true);
    setErrCode(null);
    spotlightService.retrieve(id)
      .then((res) => {
        if (cancelledRef.current) return;
        setPayload(res?.data || null);
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
  }, [id, idValid]);

  // ─── Canonical URL upgrade: legacy /sheet/spotlight/:id deep-links
  //     redirect (replace) to /{id}@{user}/spotlight once loaded. ────
  useEffect(() => {
    if (!payload?.id) return;
    if (!isLegacyContentUrl('spotlight', location.pathname)) return;
    navigate(buildContentUrl('spotlight', payload), { replace: true });
  }, [payload?.id, location.pathname, navigate]);

  // ─── Content Intelligence SEO data ─────────────────────────────
  const [ciSeo, setCiSeo] = useState(null);
  useEffect(() => {
    if (!payload?.id) return;
    let cancelled = false;
    spotlightService.getSEO(payload.id)
      .then((res) => {
        if (!cancelled && res?.data?.status === 'ready') setCiSeo(res.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [payload?.id]);

  // ─── Fetch creator profile when spotlight loads ──────────────────
  useEffect(() => {
    if (!payload?.creator_slug) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCreatorLoading(true);
    creatorProfileService.get(payload.creator_slug)
      .then((res) => {
        if (cancelledRef.current) return;
        setCreatorProfile(res?.data || null);
      })
      .catch(() => {
        // Creator profile may not exist — that's OK
      })
      .finally(() => {
        if (!cancelledRef.current) setCreatorLoading(false);
      });
  }, [payload?.creator_slug]);

  // ─── Fetch related spotlights ───────────────────────────────────
  useEffect(() => {
    if (!payload?.id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRelatedLoading(true);
    spotlightService.related(payload.id)
      .then((res) => {
        if (cancelledRef.current) return;
        setRelatedSpotlights(Array.isArray(res?.data) ? res.data : []);
      })
      .catch(() => {
        setRelatedSpotlights([]);
      })
      .finally(() => {
        if (!cancelledRef.current) setRelatedLoading(false);
      });
  }, [payload?.id]);

  // ─── Scroll-aware sticky header ──────────────────────────────────
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // ─── Meta tags ───────────────────────────────────────────────────
  const fallbackTitle =
    t.spotlight_detail_meta_default_title
    || (lang === 'ht' ? 'Spotlight · Atelnyo' : 'Spotlight · Atelnyo');
  let pageTitle = fallbackTitle;
  if (payload && typeof payload.invention_title === 'string' && payload.invention_title.length > 0) {
    const tmpl = t.spotlight_detail_meta_title_template || '{title} · Spotlight · Atelnyo';
    pageTitle = tmpl.replace('{title}', payload.invention_title);
  }
  const descriptionForMeta = truncateDescription(payload?.invention_description);
  // Canonical OG URL prefers the /{id}@{user}/spotlight deep-link once
  // the payload loads (that's the URL share recipients receive); the
  // legacy /sheet/spotlight/:id shape remains the pre-load fallback.
  const ogUrl = payload?.id ? buildContentUrl('spotlight', payload) : buildOgUrl(id);
  // Self-canonical: this page owns its <link rel="canonical"> — the
  // global App.jsx Helmet deliberately does NOT emit one (SEO refactor:
  // one owner per page to avoid duplicate canonicals).
  const canonicalUrl = `${BASE_URL}${ogUrl}`;
  // (og:locale is owned by App.jsx's global <Helmet> — see Helmet below.)

  const handleBack = () => navigate('/');

  const handleFollow = async () => {
    if (!payload?.username) return;
    try {
      await creatorProfileService.follow(payload.username);
      // Optimistic update
      setCreatorProfile((prev) => ({
        ...prev,
        follower_count: (prev?.follower_count || 0) + 1,
        is_following: true,
      }));
    } catch {
      // Silently fail — follow is best-effort
    }
  };

  /* ─── Save heart (generic SavedItem endpoint) ─────────────────── */
  const { isSaved, saveCount, saveBusy, handleToggleSave } = useSavedItem(
    'spotlight', payload?.id, { user, showToast, t },
  );

  const handleShare = async () => {
    // Share the CRAWLER-AWARE URL (/sheet/spotlight/<pk>/og/) once the
    // integer pk is known: the backend serves prerendered OG HTML there
    // (see spotlight_og_view), so a shared link unfurls with real
    // metadata in FB/WhatsApp/etc. — crawlers never run this page's JS
    // Helmet. Browsers are bounced into the SPA by the endpoint's
    // 0-second meta-refresh (and its og:url/canonical point back at
    // this deep-link). Before the payload loads there is no pk (the OG
    // path binds <int:pk> only), so fall back to the current URL.
    const ogUrl = payload?.id
      ? `${window.location.origin}/sheet/spotlight/${payload.id}/og/`
      : window.location.href;
    if (shareBusy) return;
    setShareBusy(true);
    let copied = false;
    try {
      if (navigator.share) {
        try {
          await navigator.share({
            title: payload?.invention_title || 'Spotlight',
            text: payload?.invention_description?.slice(0, 120) || '',
            url: ogUrl,
          });
          return;
        } catch {
          // User cancelled or share failed — fall through to clipboard
        }
      }
      await navigator.clipboard.writeText(ogUrl);
      copied = true;
    } catch {
      // Clipboard not available — nothing to do
    } finally {
      setShareBusy(false);
    }
    // Toast AFTER the clipboard try — a toast failure must never be
    // mistaken for a clipboard failure (same icon arg as the Business
    // share handler for visual consistency).
    if (copied && showToast) {
      showToast(
        t.spotlight_share_copied || (lang === 'ht' ? 'Lyen kopye!' : 'Link copied!'),
        'check-circle',
      );
    }
  };

  return (
    <>
      <Helmet>
        <title>{ciSeo?.title || pageTitle}</title>
        <meta property="og:type" content="article" />
        <meta property="og:url" content={canonicalUrl} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:site_name" content="Atelnyo" />
        <meta property="og:title" content={ciSeo?.og_title || pageTitle} />
        <meta property="og:description" content={ciSeo?.og_description || descriptionForMeta} />
        <meta property="og:image" content={ciSeo?.og_image || ogImageForLang(lang)} />
        {/* og:locale lives in App.jsx's global <Helmet> (market-aware) —
            a second one here duplicated the tag. */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ciSeo?.title || pageTitle} />
        <meta name="twitter:description" content={ciSeo?.description || descriptionForMeta} />
        <meta name="twitter:image" content={ciSeo?.og_image || ogImageForLang(lang)} />
      </Helmet>

      <div className="cd-page" data-detail-sheet data-spotlight-page data-testid="spotlight-detail-sheet"
        data-spotlight-id={typeof id === 'string' ? id : ''} data-lang={lang}>

        {/* ─── Sticky Header ────────────────────────────────────── */}
        <header className={`cd-sticky-header${scrolled ? ' cd-sticky-header--scrolled' : ''}`}>
          <div className="cd-sticky-header-inner">
            <button type="button" className="cd-header-back" onClick={handleBack}
              aria-label={t.spotlight_detail_back || (lang === 'ht' ? 'Retounen' : 'Back')}
              data-testid="spotlight-detail-back-btn">
              <i className="fas fa-arrow-left" aria-hidden="true" />
            </button>
            <span className={`cd-header-title${scrolled ? ' cd-header-title--visible' : ''}`}>
              {payload?.invention_title || (t.spotlight_detail_invention_label || 'Spotlight')}
            </span>
            <div className="cd-header-actions">
              <SaveHeartButton
                className="cd-header-action-btn"
                isSaved={isSaved}
                saveBusy={saveBusy}
                saveCount={saveCount}
                onToggle={handleToggleSave}
                t={t}
              />
              <button type="button" className="cd-header-action-btn" onClick={handleShare}
                disabled={shareBusy}
                aria-label={t.share_spotlight || (lang === 'ht' ? 'Pataje' : 'Share')}
                title={t.share_spotlight || (lang === 'ht' ? 'Pataje' : 'Share')}
                data-testid="spotlight-detail-share-btn">
                <i className="fas fa-share-alt" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        {/* ─── Hero — gradient fallback ─────────────────────────── */}
        <section className="cd-hero">
          <div className="cd-hero-fallback">
            <div className="cd-hero-fallback-grad" style={{
              background: 'linear-gradient(135deg, #d81b60 0%, #7c3aed 50%, #2563eb 100%)',
            }} />
          </div>

          <div className="cd-hero-content cd-hero-content--loaded">
            {loading ? (
              <div style={{ ...S.flexCol, alignItems: 'center', gap: 16, padding: '20px 0', color: 'rgba(255,255,255,0.7)' }}
                role="status" aria-live="polite" data-testid="spotlight-detail-loading">
                {/* Skeleton ring */}
                <div style={{
                  width: 120, height: 120, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.08)',
                  border: '3px solid rgba(255,255,255,0.12)',
                  animation: 'pulse 2s infinite ease-in-out',
                }} />
                {/* Skeleton lines */}
                <div style={{ ...S.flexCol, alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 160, height: 14, borderRadius: 6,
                    background: 'rgba(255,255,255,0.10)',
                    animation: 'pulse 2s infinite ease-in-out',
                  }} />
                  <div style={{
                    width: 100, height: 10, borderRadius: 5,
                    background: 'rgba(255,255,255,0.07)',
                    animation: 'pulse 2s infinite ease-in-out 0.3s',
                  }} />
                </div>
                <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>
                  {t.spotlight_detail_loading || (lang === 'ht' ? 'Ap chache envansyon an...' : 'Loading...')}
                </span>
              </div>
            ) : errCode === 'not_found' ? (
              <HeroEmptyMessage
                icon="fa-circle-question"
                msg={t.spotlight_detail_not_found || (lang === 'ht' ? 'Envansyon an pa jwenn.' : 'Invention not found.')}
              />
            ) : errCode === 'load_error' ? (
              <HeroEmptyMessage
                icon="fa-triangle-exclamation"
                msg={t.spotlight_detail_load_error || (lang === 'ht' ? 'Nou pa t kapab chaje envansyon an.' : 'Could not load.')}
              />
            ) : payload ? (
              <HeroContent payload={payload} creatorProfile={creatorProfile} creatorLoading={creatorLoading} t={t} lang={lang} resolveCategoryLabel={resolveCategoryLabel} />
            ) : (
              <HeroEmptyMessage
                icon="fa-circle-question"
                msg={t.spotlight_detail_not_found || 'Not found.'}
              />
            )}
          </div>
        </section>

        {/* ─── Body — INC-style biznis/konpanyi pwofil ──────────── */}
        {payload && !loading && !errCode && (
          <div className="cd-body">
            <div className="cd-body-inner">
              {/* ─── Creator Card ───────────────────────────── */}
              <CreatorCardSection
                payload={payload}
                creatorProfile={creatorProfile}
                creatorLoading={creatorLoading}
                t={t}
                lang={lang}
                resolveCategoryLabel={resolveCategoryLabel}
              />

              {/* ─── Invention Description ──────────────────── */}
              {payload.invention_description && (
                <section className="cd-section">
                  <h2 className="cd-section-title">
                    <i className="fas fa-info-circle" aria-hidden="true" />
                    {t.spotlight_detail_invention_label || (lang === 'ht' ? 'Envansyon an' : 'The Invention')}
                  </h2>
                  <p className="cd-text" style={{ whiteSpace: 'pre-wrap' }}>{payload.invention_description}</p>
                </section>
              )}

              {/* ─── Creator Bio (from profile) ──────────────── */}
              {creatorProfile?.bio && (
                <section className="cd-section">
                  <h2 className="cd-section-title">
                    <i className="fas fa-user" aria-hidden="true" />
                    {lang === 'ht' ? 'Apwopo Kreyatè a' : 'About the Creator'}
                  </h2>
                  <p className="cd-text">{creatorProfile.bio}</p>
                </section>
              )}

              {/* ─── Creator Info Grid (kote, lang, website) ── */}
              {(creatorProfile?.country || creatorProfile?.city || creatorProfile?.languages?.length > 0 || creatorProfile?.website_url) && (
                <section className="cd-section">
                  <h2 className="cd-section-title">
                    <i className="fas fa-building" aria-hidden="true" />
                    {lang === 'ht' ? 'Enfòmasyon' : 'Information'}
                  </h2>
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16,
                  }}>
                    {(creatorProfile.country || creatorProfile.city) && (
                      <InfoTile
                        icon="fa-map-marker-alt"
                        label={lang === 'ht' ? 'Kote' : 'Location'}
                        value={[creatorProfile.city, creatorProfile.country].filter(Boolean).join(', ')}
                      />
                    )}
                    {Array.isArray(creatorProfile.languages) && creatorProfile.languages.length > 0 && (
                      <InfoTile
                        icon="fa-language"
                        label={lang === 'ht' ? 'Lang' : 'Languages'}
                        value={creatorProfile.languages.join(', ')}
                      />
                    )}
                    {creatorProfile.website_url && (
                      <InfoTile
                        icon="fa-globe"
                        label={lang === 'ht' ? 'Sit web' : 'Website'}
                        value={creatorProfile.website_url.replace(/^https?:\/\//, '')}
                        isLink
                        href={creatorProfile.website_url}
                      />
                    )}
                    {payload.created_at && (
                      <InfoTile
                        icon="fa-calendar"
                        label={lang === 'ht' ? 'Kreye' : 'Created'}
                        value={formatDate(payload.created_at, lang)}
                      />
                    )}
                    {creatorProfile?.profile_completeness != null && (
                      <InfoTile
                        icon="fa-chart-line"
                        label={lang === 'ht' ? 'Konplete' : 'Completeness'}
                        value={`${Math.round(creatorProfile.profile_completeness)}%`}
                      />
                    )}
                  </div>
                </section>
              )}

              {/* ─── Skills (from profile) ──────────────────────── */}
              {Array.isArray(creatorProfile?.skills) && creatorProfile.skills.length > 0 && (
                <section className="cd-section">
                  <h2 className="cd-section-title">
                    <i className="fas fa-cogs" aria-hidden="true" />
                    {lang === 'ht' ? 'Konpetans' : 'Skills'}
                  </h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {creatorProfile.skills.map((s) => (
                      <span key={s} style={{
                        display: 'inline-block', padding: '6px 16px', borderRadius: 50,
                        background: 'var(--cd-primary-light, #dbeafe)',
                        color: 'var(--cd-primary, #2563eb)',
                        fontSize: '0.85rem', fontWeight: 600,
                        transition: 'all 0.2s ease',
                        cursor: 'default',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(37,99,235,0.2)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* ─── Social Links (from profile) ─────────────────── */}
              {creatorProfile?.social_links && Object.keys(creatorProfile.social_links).length > 0 && (
                <section className="cd-section">
                  <h2 className="cd-section-title">
                    <i className="fas fa-share-alt" aria-hidden="true" />
                    {lang === 'ht' ? 'Rezo Sosyo' : 'Social Links'}
                  </h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {Object.entries(creatorProfile.social_links).map(([platform, url]) => {
                      if (!url) return null;
                      const icon = platform === 'github' ? 'fa-github'
                        : platform === 'twitter' ? 'fa-twitter'
                        : platform === 'linkedin' ? 'fa-linkedin-in'
                        : platform === 'youtube' ? 'fa-youtube'
                        : platform === 'instagram' ? 'fa-instagram'
                        : platform === 'facebook' ? 'fa-facebook'
                        : platform === 'website' ? 'fa-globe'
                        : 'fa-link';
                      const color = platform === 'github' ? '#333'
                        : platform === 'twitter' ? '#1DA1F2'
                        : platform === 'linkedin' ? '#0A66C2'
                        : platform === 'youtube' ? '#FF0000'
                        : platform === 'instagram' ? '#E4405F'
                        : platform === 'facebook' ? '#1877F2'
                        : 'var(--cd-primary, #2563eb)';
                      return (
                        <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
                          style={{
                            ...S.flexRow, gap: 8, padding: '10px 18px', borderRadius: 12,
                            background: 'var(--cd-surface, #fff)',
                            border: '1px solid var(--cd-border, #e2e8f0)',
                            textDecoration: 'none', transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--cd-shadow-lg, 0 10px 25px rgba(0,0,0,0.08))'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                        >
                          <i className={`fab ${icon}`} style={{ color, fontSize: '1.1rem', width: 20, textAlign: 'center' }} />
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--cd-text, #1e293b)', textTransform: 'capitalize' }}>
                            {platform}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ─── Demo CTA ─────────────────────────────────────── */}
              <div className="cd-price-card">
                <div className="cd-price-card-header">
                  <div className="cd-price-card-info">
                    <span className="cd-price-label">
                      <i className="fas fa-external-link-alt" style={{ marginRight: 6 }} />
                      {t.spotlight_detail_open_demo || (lang === 'ht' ? 'Demo' : 'Demo')}
                    </span>
                    {typeof payload.created_at === 'string' && payload.created_at.length > 0 && (
                      <span style={{ fontSize: '0.82rem', color: 'var(--cd-text-secondary, #64748b)', marginTop: 2 }}>
                        <i className="fas fa-calendar" style={{ fontSize: '0.7rem', marginRight: 4, opacity: 0.5 }} />
                        {formatDate(payload.created_at, lang)}
                      </span>
                    )}
                  </div>

                  {typeof payload.link_url === 'string'
                    && payload.link_url.length > 0
                    && /^(https?:)?\/\//i.test(payload.link_url)
                    ? (
                    <button type="button" className="cd-cta-btn" onClick={() =>
                      window.open(payload.link_url, '_blank', 'noopener,noreferrer')
                    }>
                      <i className="fas fa-external-link-alt" aria-hidden="true" />
                      {t.spotlight_detail_open_demo || (lang === 'ht' ? 'Ouvri demo' : 'Open demo')}
                    </button>
                    ) : (
                    <button type="button" className="cd-cta-btn" disabled style={{
                      opacity: 0.5, cursor: 'default', filter: 'grayscale(1)',
                    }}>
                      <i className="fas fa-link" aria-hidden="true" />
                      {lang === 'ht' ? 'Pa gen demo' : 'No demo'}
                    </button>
                    )}
                </div>
                <p className="cd-price-disclaimer">
                  <i className="fas fa-user" style={{ marginRight: 4, opacity: 0.5 }} />
                  {(t.spotlight_detail_by_author || 'by @{user}').replace(
                    '@{user}',
                    creatorProfile?.display_name
                      || creatorProfile?.artist_name
                      || (typeof payload.username === 'string' && payload.username.length > 0
                        ? payload.username.replace(/@.*$/, '')
                        : (lang === 'ht' ? 'Endiskitab' : 'Unknown')),
                  )}
                  {creatorProfile?.slug && (
                    <span style={{ marginLeft: 4, opacity: 0.6 }}>· @{creatorProfile.slug}</span>
                  )}
                </p>
              </div>

              {/* ─── Contact Creator (from profile) ──────────────── */}
              {creatorProfile?.contact_email && (
                <div className="cd-price-card" style={{ marginTop: 0 }}>
                  <div className="cd-price-card-header">
                    <div className="cd-price-card-info">
                      <span className="cd-price-label">
                        <i className="fas fa-envelope" style={{ marginRight: 6 }} />
                        {lang === 'ht' ? 'Kontakte Kreyatè a' : 'Contact Creator'}
                      </span>
                      {creatorProfile.availability && (
                        <span style={{
                          fontSize: '0.75rem', color: creatorProfile.availability === 'available' ? '#22c55e' : '#f59e0b',
                          fontWeight: 600, marginTop: 2,
                        }}>
                          {creatorProfile.availability === 'available'
                            ? (lang === 'ht' ? 'Disponib' : 'Available')
                            : creatorProfile.availability === 'busy'
                              ? (lang === 'ht' ? 'Okipe' : 'Busy')
                              : creatorProfile.availability === 'hiring'
                                ? (lang === 'ht' ? 'Ap anbochE' : 'Hiring')
                                : creatorProfile.availability}
                        </span>
                      )}
                    </div>
                    <a href={`mailto:${creatorProfile.contact_email}`}
                      className="cd-cta-btn" style={{ textDecoration: 'none' }}>
                      <i className="fas fa-paper-plane" aria-hidden="true" />
                      {lang === 'ht' ? 'Voye imèl' : 'Send email'}
                    </a>
                  </div>
                  {creatorProfile.contact_phone && (
                    <p className="cd-price-disclaimer" style={{ marginTop: 8 }}>
                      <i className="fas fa-phone" style={{ marginRight: 4, opacity: 0.5 }} />
                      {creatorProfile.contact_phone}
                    </p>
                  )}
                </div>
              )}

              {/* ─── Stats ─────────────────────────────────────── */}
              <div className="cd-section">
                <h2 className="cd-section-title">
                  <i className="fas fa-chart-bar" aria-hidden="true" />
                  {lang === 'ht' ? 'Estatistik' : 'Stats'}
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                  <StatTile
                    icon="fa-eye"
                    label={lang === 'ht' ? 'View' : 'Views'}
                    value={payload.view_count || 0}
                  />
                  <StatTile
                    icon="fa-calendar"
                    label={lang === 'ht' ? 'Kreye' : 'Created'}
                    value={formatDate(payload.created_at, lang)}
                  />
                  <StatTile
                    icon="fa-clock"
                    label={lang === 'ht' ? 'Soumit' : 'Submitted'}
                    value={formatDate(payload.created_at, lang)}
                  />
                  {payload.rejection_count > 0 && (
                    <StatTile
                      icon="fa-rotate-left"
                      label={lang === 'ht' ? 'Rejete' : 'Rejected'}
                      value={`${payload.rejection_count}x`}
                      color="#f59e0b"
                    />
                  )}
                </div>
              </div>

              {/* ─── Actions: Follow + Share ────────────────────── */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {payload.username && (
                  <button type="button" className="cd-cta-btn" onClick={handleFollow}>
                    <i className="fas fa-user-plus" aria-hidden="true" />
                    {lang === 'ht' ? 'Swivi Kreyatè a' : 'Follow Creator'}
                  </button>
                )}
                <button type="button" className="cd-cta-btn cd-cta-btn-secondary" onClick={handleShare} disabled={shareBusy}>
                  <i className="fas fa-share-nodes" aria-hidden="true" />
                  {lang === 'ht' ? 'Pataje' : 'Share'}
                </button>
              </div>

              {/* ─── Related Spotlights ────────────────────────── */}
              {!relatedLoading && relatedSpotlights.length > 0 && (
                <div className="cd-section">
                  <h2 className="cd-section-title">
                    <i className="fas fa-lightbulb" aria-hidden="true" />
                    {lang === 'ht' ? 'Lòt Envansyon' : 'More Inventions'}
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                    {relatedSpotlights.map((item) => (
                      <RelatedSpotlightCard key={item.id} item={item} t={t} lang={lang} onClick={() => navigate(buildContentUrl('spotlight', item))} resolveCategoryLabel={resolveCategoryLabel} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// HERO CONTENT — avatar/logo + title + tags + meta
// ═══════════════════════════════════════════════════════════════════════
function HeroContent({ payload, creatorProfile, creatorLoading, t, lang, resolveCategoryLabel }) {
  const catColor = categoryColor(payload.category);
  const [heroAvatarFailed, setHeroAvatarFailed] = useState(false);
  // Real avatar priority: public profile avatar > serializer avatar > lightbulb icon
  const avatarUrl = creatorProfile?.avatar_url || payload.avatar_url || '';
  const displayName = creatorProfile?.display_name || creatorProfile?.artist_name || payload.display_name || payload.invention_title;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
      data-testid="spotlight-detail-invention-card">
      {/* ─── Avatar / Logo Ring ──────────────────────────────── */}
      <div style={{
        position: 'relative', marginBottom: 20,
      }}>
        <div style={{
          width: 120, height: 120, borderRadius: '50%', padding: 4,
          background: `linear-gradient(135deg, ${catColor.color}, #7c3aed)`,
          boxShadow: `0 8px 30px ${catColor.color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {creatorLoading ? (
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
          ) : avatarUrl && !heroAvatarFailed ? (
            <img src={avatarUrl} alt={displayName}
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              onError={() => setHeroAvatarFailed(true)}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, #f59e0b, #f97316)',
              fontSize: '2.5rem', color: '#fff',
              fontWeight: 800,
              textShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}>
              {(payload.username || '?').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        {payload.category && (
          <div style={{
            position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 50, fontSize: '0.65rem', fontWeight: 700,
            background: catColor.color, color: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            whiteSpace: 'nowrap',
          }}>
            <i className={`fas ${catColor.icon}`} style={{ fontSize: '0.55rem' }} />
            {resolveCategoryLabel(payload.category, t, lang)}
          </div>
        )}
      </div>

      <div className="cd-hero-tags" style={{ justifyContent: 'center' }}>
        <span className="cd-tag" style={{
          background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}>
          <i className="fas fa-lightbulb" style={{ fontSize: '0.65rem', opacity: 0.8 }} />
          {' '}Spotlight
        </span>
      </div>
      <h1 className="cd-hero-title" style={{ fontSize: '2rem', margin: '8px 0 4px' }}>{payload.invention_title}</h1>
      <p className="cd-hero-desc" style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.8)' }}>
        {(t.spotlight_detail_by_author || 'by @{user}').replace(
          '@{user}',
          payload.display_name
            || creatorProfile?.display_name
            || (typeof payload.username === 'string' && payload.username.length > 0
              ? payload.username.replace(/@.*$/, '')
              : (lang === 'ht' ? 'Endiskitab' : 'Unknown')),
        )}
        {creatorProfile?.slug && (
          <span style={{ opacity: 0.6 }}> · @{creatorProfile.slug}</span>
        )}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CREATOR CARD — avatar + display_name + slug + verified badge
// ═══════════════════════════════════════════════════════════════════════
function CreatorCardSection({ payload, creatorProfile, creatorLoading, t, lang, resolveCategoryLabel }) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const catColor = categoryColor(payload.category);
  // Real avatar priority: public profile avatar > serializer avatar > fallback
  const displayName = creatorProfile?.display_name
    || creatorProfile?.artist_name
    || payload.display_name
    || payload.invention_title;
  const avatarUrl = creatorProfile?.avatar_url || payload.avatar_url || '';
  const slug = creatorProfile?.slug || (typeof payload.username === 'string' ? payload.username.replace(/@.*$/, '') : '');

  return (
    <div className="cd-creator-card" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Subtle gradient accent on the right */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 120, height: '100%',
        background: `linear-gradient(135deg, transparent 40%, ${catColor.color}08 100%)`,
        pointerEvents: 'none',
      }} />

      {creatorLoading ? (
            <div style={{ ...S.flexRow, gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--cd-border, #e2e8f0)' }} />
              <div style={{ ...S.flexCol, gap: 4 }}>
                <div style={{ width: 120, height: 14, borderRadius: 4, background: 'var(--cd-border, #e2e8f0)' }} />
                <div style={{ width: 80, height: 10, borderRadius: 4, background: 'var(--cd-border, #e2e8f0)' }} />
              </div>
            </div>
          ) : (
          <>
            {avatarUrl && !avatarFailed ? (
              <img src={avatarUrl} alt={displayName}
                style={{
                  width: 56, height: 56, borderRadius: '50%', objectFit: 'cover',
                  flexShrink: 0, boxShadow: `0 4px 12px ${catColor.color}40`,
                }}
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <div className="cd-creator-avatar" style={{
                width: 56, height: 56, borderRadius: '50%',
                background: `linear-gradient(135deg, ${catColor.color}, #7c3aed)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontSize: '1.2rem', color: '#fff', fontWeight: 800,
              }}>
                {(payload.username || '?').charAt(0).toUpperCase()}
              </div>
            )}
          <div className="cd-creator-info" style={{ flex: 1 }}>
            <span className="cd-creator-label">
              {lang === 'ht' ? 'Kreyatè' : 'Creator'}
              {creatorProfile?.is_verified && (
                <i className="fas fa-check-circle" style={{ marginLeft: 4, color: '#3b82f6', fontSize: '0.7rem' }} />
              )}
              {creatorProfile?.is_enterprise && (
                <span style={{
                  marginLeft: 6, padding: '1px 8px', borderRadius: 50, fontSize: '0.6rem',
                  fontWeight: 700, background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#fff',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  INC
                </span>
              )}
            </span>
            <span className="cd-creator-name">
              {displayName}
            </span>
            {slug && (
              <span style={{ fontSize: '0.75rem', color: 'var(--cd-text-secondary, #64748b)' }}>
                @{slug}
              </span>
            )}
          </div>
          {payload.category && (
            <span style={{
              padding: '4px 12px', borderRadius: 50, fontSize: '0.75rem', fontWeight: 700,
              background: catColor.bg, color: catColor.color, flexShrink: 0, marginLeft: 'auto',
            }}>
              <i className={`fas ${catColor.icon}`} style={{ marginRight: 4, fontSize: '0.6rem' }} />
              {resolveCategoryLabel(payload.category, t, lang)}
            </span>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// INFO TILE — grid cell for location / languages / website / etc.
// ═══════════════════════════════════════════════════════════════════════
function InfoTile({ icon, label, value, isLink, href }) {
  const content = (
    <div style={{
      ...S.flexCol, gap: 6, padding: '16px 18px', borderRadius: 12,
      background: 'var(--cd-surface, #fff)',
      border: '1px solid var(--cd-border, #e2e8f0)',
      transition: 'box-shadow 0.2s ease',
      height: '100%', boxSizing: 'border-box',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--cd-shadow-lg, 0 10px 25px rgba(0,0,0,0.08))'; }}
    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; }}
    >
      <div style={{ ...S.flexRow, gap: 6, color: 'var(--cd-text-secondary, #64748b)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <i className={`fas ${icon}`} style={{ fontSize: '0.7rem', opacity: 0.6 }} />
        {label}
      </div>
      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--cd-text, #1e293b)', wordBreak: 'break-word' }}>
        {value}
      </span>
    </div>
  );

  if (isLink && href) {
    return <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{content}</a>;
  }
  return content;
}

// ═══════════════════════════════════════════════════════════════════════
// HERO EMPTY MESSAGE — for not_found / load_error
// ═══════════════════════════════════════════════════════════════════════
function HeroEmptyMessage({ icon, msg }) {
  return (
    <div role="alert" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      padding: '30px 0', color: 'rgba(255,255,255,0.6)',
    }}>
      <i className={`fas ${icon}`} style={{ fontSize: '2rem', opacity: 0.3 }} aria-hidden="true" />
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{msg}</p>
    </div>
   );
}

// ═══════════════════════════════════════════════════════════════════════
// STAT TILE — small metric card for the stats grid
// ═══════════════════════════════════════════════════════════════════════
function StatTile({ icon, label, value, color }) {
  return (
    <div style={{
      ...S.flexCol, gap: 6, padding: '14px 16px', borderRadius: 12,
      background: 'var(--cd-surface, #fff)',
      border: '1px solid var(--cd-border, #e2e8f0)',
      transition: 'box-shadow 0.2s ease',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--cd-shadow-lg, 0 10px 25px rgba(0,0,0,0.08))'; }}
    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; }}
    >
      <div style={{ ...S.flexRow, gap: 6, color: 'var(--cd-text-secondary, #64748b)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <i className={`fas ${icon}`} style={{ fontSize: '0.7rem', opacity: 0.6, color: color || 'var(--cd-primary, #2563eb)' }} />
        {label}
      </div>
      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--cd-text, #1e293b)', wordBreak: 'break-word' }}>
        {value}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// RELATED SPOTLIGHT CARD — compact card for the "More Inventions" rail
// ═══════════════════════════════════════════════════════════════════════
function RelatedSpotlightCard({ item, t, lang, onClick, resolveCategoryLabel }) {
  const catKey = item.category || 'other';
  const cfg = CATEGORY_CFG[catKey] || CATEGORY_CFG.other;
  const title = item.invention_title || '';
  const avatarUrl = item.avatar_url || '';

  return (
    <div
      className="related-spotlight-card"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: '14px 16px', borderRadius: 12,
        background: 'var(--cd-surface, #fff)',
        border: '1px solid var(--cd-border, #e2e8f0)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--cd-shadow-lg, 0 10px 25px rgba(0,0,0,0.08))';
        e.currentTarget.style.borderColor = cfg.color;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '';
        e.currentTarget.style.borderColor = 'var(--cd-border, #e2e8f0)';
      }}
    >
      <div style={{ ...S.flexRow, gap: 8, alignItems: 'center' }}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={item.display_name || item.username}
            style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <span style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: cfg.bg, color: cfg.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem',
          }}>
            <i className={`fas ${cfg.icon}`} />
          </span>
        )}
        <span style={{
          fontSize: '0.75rem', fontWeight: 700, textTransform: 'capitalize',
          color: cfg.color,
        }}>
          {resolveCategoryLabel(catKey, t, lang)}
        </span>
      </div>
      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--cd-text, #1e293b)', lineHeight: 1.3 }}>
        {title || (lang === 'ht' ? 'Envansyon' : 'Invention')}
      </div>
      {item.invention_description && (
        <div style={{
          fontSize: '0.78rem', color: 'var(--cd-text-secondary, #64748b)',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {item.invention_description.slice(0, 100)}{item.invention_description.length > 100 ? '…' : ''}
        </div>
      )}
      <div style={{ ...S.flexRow, gap: 6, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--cd-border, #e2e8f0)' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--cd-text-secondary, #64748b)' }}>
          {item.display_name || `@${item.username || (lang === 'ht' ? 'Endiskitab' : 'Unknown')}`}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: cfg.color, fontWeight: 600 }}>
          {lang === 'ht' ? 'Wè plis' : 'View'} <i className="fas fa-arrow-right" style={{ fontSize: '0.6rem' }} />
        </span>
      </div>
    </div>
  );
}
