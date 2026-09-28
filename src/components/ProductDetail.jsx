/**
 * src/components/ProductDetail.jsx
 *
 * ProductDetail — full INC-style product page for /marketplace/:id.
 * The ``:id`` segment accepts EITHER the legacy numeric pk
 * (``/marketplace/123``) or the unique slug deep-link
 * (``/marketplace/my-product``) — the backend resolves both via
 * SlugOrPkLookupMixin on ProductViewSet.
 * Replaces the simple ProfileItemDetail placeholder with a rich
 * layout featuring product image hero, price card, seller info,
 * description, stats, and buy/download CTA.
 *
 * Layout: pd-page → pd-sticky-header → pd-hero → pd-body
 *   (product info, seller card, description, stats, buy CTA)
 */

import React, { useEffect, useRef, useState } from 'react';
import SEOHead, { productSchema } from './shared/SEOHead';
import useSafeNavigate from '../hooks/useSafeNavigate';
import useSavedItem from '../hooks/useSavedItem';
import SaveHeartButton from './SaveHeartButton';
import { useLocation, useParams } from 'react-router-dom';
import { marketplaceService } from '../services/api';
import { translations } from '../data/translations';
import { buildContentUrl, buildContentShareUrl, isLegacyContentUrl } from '../utils/contentUrl';
import { historyBack } from '../utils/history';
import { ogImageForLang } from './profile/profileConstants';
import { t2 } from '../utils/i18n';

/* ─── Constants ────────────────────────────────────────────────── */
const OG_IMAGE_FALLBACK = 'https://atelnyo.site/og-banner-en.svg';


function formatDate(iso, lang) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(
      t2(lang, { ht: 'fr-HT', fr: 'fr-FR', es: 'es-ES', en: 'en-US' }),
      { year: 'numeric', month: 'short', day: 'numeric' },
    );
  } catch (_) { return ''; }
}

function formatCurrency(amount, currency = 'USD', lang) {
  const num = Number(amount);
  if (Number.isNaN(num)) return '$0.00';
  try {
    return new Intl.NumberFormat(
      t2(lang, { ht: 'fr-HT', fr: 'fr-FR', es: 'es-ES', en: 'en-US' }),
      { style: 'currency', currency, minimumFractionDigits: 2 },
    ).format(num);
  } catch (_) { return `$${num.toFixed(2)}`; }
}

function categoryAccent(cat) {
  switch ((cat || '').toLowerCase()) {
    case 'book':     return { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa', icon: 'fa-book' };
    case 'course':   return { bg: 'rgba(96,165,250,0.15)', color: '#60a5fa', icon: 'fa-graduation-cap' };
    case 'software':  return { bg: 'rgba(52,211,153,0.15)', color: '#34d399', icon: 'fa-code' };
    case 'music':    return { bg: 'rgba(251,146,60,0.15)', color: '#fb923c', icon: 'fa-music' };
    case 'art':      return { bg: 'rgba(244,114,182,0.15)', color: '#f472b6', icon: 'fa-palette' };
    case 'digital':  return { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8', icon: 'fa-cloud' };
    default:         return { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', icon: 'fa-tag' };
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

/* ─── SVG Fallback for product image ───────────────────────────── */
function ProductFallback({ title }) {
  return (
    <div className="pd-hero-fallback">
      <svg viewBox="0 0 800 450" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
        style={{ width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="pd-fb-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#d81b60" stopOpacity="0.06" />
          </linearGradient>
        </defs>
        <rect width="800" height="450" fill="url(#pd-fb-grad)" />
        <g transform="translate(400,200)" opacity="0.15">
          <rect x="-60" y="-60" width="120" height="120" rx="16" fill="#0ea5e9" />
          <rect x="-40" y="-35" width="80" height="10" rx="5" fill="#0ea5e9" />
          <rect x="-55" y="-10" width="110" height="10" rx="5" fill="#0ea5e9" opacity="0.6" />
          <rect x="-25" y="15" width="50" height="10" rx="5" fill="#0ea5e9" opacity="0.4" />
          <path d="M-18-20L18-20L0-35Z" fill="#d81b60" />
        </g>
        <text x="400" y="310" textAnchor="middle" fill="#0ea5e9" opacity="0.4"
          fontFamily="system-ui, -apple-system, sans-serif" fontSize="16" fontWeight="600">
          {title || 'Product'}
        </text>
      </svg>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════ */
export default function ProductDetail({ lang = 'ht', product: propProduct, onBack, onOpenCheckout, contentId, user, showToast }) {
  // ``id`` is the raw URL segment: the ``{id}`` from the canonical
  // ``/{id}@{user}/product`` key (contentId), a numeric pk, or a
  // unique slug (legacy /marketplace/:id links). All are resolved
  // server-side via SlugOrPkLookupMixin.
  const { id: urlId } = useParams();
  const location = useLocation();
  const navigate = useSafeNavigate();
  const id = contentId ?? urlId;
  const t = (translations && translations[lang]) || translations.ht || {};

  // Phase PayPal — Buy now routes through the unified CheckoutModal
  // (PayPal PRIMARY). Free digital products keep the direct download.
  // Variants (real backend model): the selected variant's price/stock
  // apply at checkout when one is chosen.
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [product, setProduct] = useState(propProduct || null);
  const variants = Array.isArray(propProduct?.variants)
    ? propProduct.variants
    : Array.isArray(product?.variants)
      ? product.variants
      : [];

  const effectivePrice = (p, variant) => {
    if (variant && variant.price != null) return Number(variant.price);
    return Number(p?.price) || 0;
  };

  const handleBuy = (p, variant = selectedVariant) => {
    const price = effectivePrice(p, variant);
    const meta = { product_id: p.id, title: p.title };
    if (variant) {
      meta.variant_id = variant.id;
      meta.variant_name = variant.name;
    }
    if (price > 0) {
      onOpenCheckout?.('order', price, meta);
    } else if (p?.kind === 'digital' && p?.download_url) {
      window.open(p.download_url, '_blank', 'noopener,noreferrer');
    }
  };

  const [loading, setLoading] = useState(!propProduct);
  const [errCode, setErrCode] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const cancelledRef = useRef(false);

  // Accept any non-empty segment — integer pk or slug string.
  const idValid = typeof id === 'string' && id.length > 0;

  /* ─── Fetch product (only when no propProduct provided) ──────── */
  useEffect(() => {
    if (propProduct) {
      // Prop-injected product → skip the fetch. Sync reset is intentional
      // (same pattern as CheckoutModal/DepositModal — see comment below).
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    // Pass the raw segment — the backend's SlugOrPkLookupMixin
    // resolves a numeric pk OR a unique slug on the same endpoint.
    marketplaceService.retrieve(id)
      .then((res) => {
        if (cancelledRef.current) return;
        setProduct(res?.data || null);
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
  }, [id, idValid, propProduct]);

  /* ─── Canonical URL upgrade: legacy /marketplace/:id deep-links
       (numeric or slug) redirect (replace) to /{id}@{user}/product
       once the payload loads. New-format URLs never match. ─────── */
  useEffect(() => {
    if (!product?.id) return;
    if (!isLegacyContentUrl('product', location.pathname)) return;
    navigate(buildContentUrl('product', product), { replace: true });
  }, [product?.id, location.pathname, navigate]);

  /* ─── Scroll-aware sticky header ────────────────────────────── */
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // ─── Content Intelligence SEO data ─────────────────────────────
  const [ciSeo, setCiSeo] = useState(null);
  useEffect(() => {
    if (!product?.id) return;
    let cancelled = false;
    marketplaceService.getSEO(product.id)
      .then((res) => {
        if (!cancelled && res?.data?.status === 'ready') {
          setCiSeo(res.data);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [product?.id]);

  /* ─── Meta tags ─────────────────────────────────────────────── */
  const fallbackTitle = t2(lang, { ht: 'Pwodwi · Atelnyo', fr: 'Produit · Atelnyo', es: 'Producto · Atelnyo', en: 'Product · Atelnyo' });

  const handleBack = () => {
    if (onBack) return onBack();
    // Opened from a public profile / Explore card (no onBack prop): go
    // back in history instead of dumping the user on Explore. Falls back
    // to '/' only when there is no prior entry (direct deep-link). Uses
    // history.state.idx — history.length is unreliable on fresh tabs.
    return historyBack(navigate);
  };

  /* ─── Save heart (generic SavedItem endpoint) ─────────────────── */
  const { isSaved, saveCount, saveBusy, handleToggleSave } = useSavedItem(
    'product', product?.id, { user, showToast, t },
  );

  /* ─── Share: copy the canonical /{slug}@{user}/product deep-link ── */
  const handleShare = async () => {
    if (!product?.id) return;
    const url = buildContentShareUrl('product', product);
    if (navigator.share) {
      try {
        await navigator.share({ title: product.title || 'Product', url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard not available — nothing else to do.
    }
  };

  /* ─── Render ────────────────────────────────────────────────── */
  return (
    <>
      <SEOHead
        title={ciSeo?.title || product?.title || t2(lang, { ht: 'Pwodwi', en: 'Product' })}
        description={ciSeo?.description || product?.description}
        image={ciSeo?.og_image || product?.image_url || ogImageForLang(lang)}
        url={product ? buildContentUrl('product', product) : `/marketplace/${encodeURIComponent(id || '')}`}
        type="product"
        schema={ciSeo?.structured_data && Object.keys(ciSeo.structured_data).length > 1
          ? ciSeo.structured_data
          : (product ? productSchema(product) : undefined)}
        lang={lang}
        breadcrumbs={[
          { label: 'Home', url: '/' },
          { label: t2(lang, { ht: 'Mache', en: 'Marketplace' }), url: '/explore' },
          { label: ciSeo?.title || product?.title || t2(lang, { ht: 'Pwodwi', en: 'Product' }) },
        ]}
        keywords={[
          ...(ciSeo?.keywords || []),
          product?.title,
          product?.category,
          ...(Array.isArray(product?.tags) ? product.tags : []),
        ].filter(Boolean)}
      />

      <div className="pd-page" data-detail-sheet data-testid="product-detail-sheet" data-product-id={typeof id === 'string' ? id : ''} data-lang={lang}>

        {/* ─── Sticky Header ─────────────────────────────────────── */}
        <header className={`pd-sticky-header${scrolled ? ' pd-sticky-header--scrolled' : ''}`}>
          <div className="pd-sticky-header-inner">
            <button type="button" className="pd-header-back" onClick={handleBack}
              aria-label={t2(lang, { ht: 'Retounen', fr: 'Retour', es: 'Volver', en: 'Back' })}>
              <i className="fas fa-arrow-left" aria-hidden="true" />
            </button>
            <span className={`pd-header-title${scrolled ? ' pd-header-title--visible' : ''}`}>
              {product?.title || (t2(lang, { ht: 'Pwodwi', fr: 'Produit', es: 'Producto', en: 'Product' }))}
            </span>
            <div className="pd-header-actions">
              <SaveHeartButton
                className="pd-header-action-btn"
                savedColor="var(--pd-primary, #2563eb)"
                isSaved={isSaved}
                saveBusy={saveBusy}
                saveCount={saveCount}
                onToggle={handleToggleSave}
                t={t}
                disabled={!product?.id}
              />
              <button
                type="button"
                onClick={handleShare}
                disabled={!product?.id}
                aria-label={t.share_product || 'Share'}
                title={copied ? (t.copied || 'Copied') : (t.share_product || 'Share')}
                className="pd-header-action-btn"
              >
                <i className={`fas ${copied ? 'fa-check' : 'fa-share-alt'}`} aria-hidden="true" />
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
                background: 'linear-gradient(135deg, #d81b60 0%, #7c3aed 50%, #2563eb 100%)',
              }} />
            </div>
          ) : product?.image_url && !imgFailed ? (
            <img
              className={`pd-hero-img ${!loading ? 'pd-hero-img--loaded' : ''}`}
              src={product.image_url}
              alt={product.title}
              onError={() => setImgFailed(true)}
            />
          ) : (
            <ProductFallback title={product?.title} />
          )}

          {/* ─── Hero Gradient Overlay ────────────────────────────── */}
          <div className="pd-hero-overlay" />

          {/* ─── Hero Content ─────────────────────────────────────── */}
          <div className="pd-hero-content pd-hero-content--loaded">
            {loading ? (
              <div style={{ ...S.flexCol, alignItems: 'center', gap: 14, padding: '30px 0', color: 'rgba(255,255,255,0.7)' }}
                role="status" aria-live="polite">
                <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem' }} aria-hidden="true" />
                <span style={{ fontSize: '0.9rem' }}>
                  {t2(lang, { ht: 'Ap chaje pwodwi a...', fr: 'Chargement...', es: 'Cargando...', en: 'Loading...' })}
                </span>
              </div>
            ) : errCode === 'not_found' ? (
              <EmptyHero icon="fa-circle-question" msg={t2(lang, { ht: 'Pwodwi a pa jwenn.', fr: 'Produit non trouvé.', es: 'Producto no encontrado.', en: 'Product not found.' })} />
            ) : errCode === 'load_error' ? (
              <EmptyHero icon="fa-triangle-exclamation" msg={t2(lang, { ht: 'Nou pa t kapab chaje pwodwi a.', fr: 'Impossible de charger le produit.', es: 'No se pudo cargar el producto.', en: 'Could not load product.' })} />
            ) : product ? (
              <HeroContent product={product} t={t} lang={lang} />
            ) : (
              <EmptyHero icon="fa-circle-question" msg="Not found." />
            )}
          </div>
        </section>

        {/* ─── Body ────────────────────────────────────────────────── */}
        {product && !loading && !errCode && (
          <div className="pd-body">
            <div className="pd-body-inner">

              {/* ─── Price Card ─────────────────────────────────────── */}
              <PriceCard
                product={product}
                t={t}
                lang={lang}
                onOpenCheckout={onOpenCheckout}
                selectedVariant={selectedVariant}
                onSelectVariant={setSelectedVariant}
              />

              {/* ─── Seller Card ────────────────────────────────────── */}
              <SellerCard product={product} lang={lang} />

              {/* ─── Product Info ────────────────────────────────────── */}
              <section className="pd-section">
                <h2 className="pd-section-title">
                  <i className="fas fa-info-circle" aria-hidden="true" />
                  {t2(lang, { ht: 'Enfòmasyon Pwodwi', en: 'Product Info' })}
                </h2>
                <InfoGrid product={product} lang={lang} t={t} />
              </section>

              {/* ─── Description ────────────────────────────────────── */}
              {product.description && (
                <section className="pd-section">
                  <h2 className="pd-section-title">
                    <i className="fas fa-align-left" aria-hidden="true" />
                    {t2(lang, { ht: 'Deskripsyon', en: 'Description' })}
                  </h2>
                  <p className="pd-text" style={{ whiteSpace: 'pre-wrap' }}>{product.description}</p>
                </section>
              )}

              {/* ─── Stats ──────────────────────────────────────────── */}
              <section className="pd-section">
                <h2 className="pd-section-title">
                  <i className="fas fa-chart-simple" aria-hidden="true" />
                  {t2(lang, { ht: 'Estadistik', en: 'Statistics' })}
                </h2>
                <div className="pd-stats-grid">
                  <StatTile icon="fa-star" label={t2(lang, { ht: 'Evalyasyon', en: 'Rating' })}
                    value={product.avg_rating != null ? `${Number(product.avg_rating).toFixed(1)}` : '—'} />
                  <StatTile icon="fa-comment" label={t2(lang, { ht: 'Revizyon', en: 'Reviews' })}
                    value={product.review_count != null ? String(product.review_count) : '0'} />
                  <StatTile icon="fa-shopping-cart" label={t2(lang, { ht: 'Vann', en: 'Sales' })}
                    value={product.sales_count != null ? String(product.sales_count) : '0'} />
                  <StatTile icon="fa-calendar" label={t2(lang, { ht: 'Kreye', en: 'Created' })}
                    value={formatDate(product.created_at, lang)} />
                </div>
              </section>

              {/* ─── Buy / Download CTA ─────────────────────────────── */}
              <div className="pd-price-card">
                <div className="pd-price-card-header">
                  <div className="pd-price-card-info">
                    <span className="pd-price-label">
                      <i className="fas fa-shopping-bag" style={{ marginRight: 6 }} />
                      {t2(lang, { ht: 'Prix', en: 'Price' })}
                    </span>
                    <span className="pd-price-amount">
                      {formatCurrency(product.price, product.currency, lang)}
                    </span>
                    {product.stock != null && (
                      <span style={{
                        fontSize: '0.78rem', color: product.stock > 0 ? 'var(--pd-success, #22c55e)' : 'var(--pd-error, #ef4444)',
                        fontWeight: 600, marginTop: 2,
                      }}>
                        {product.stock > 0
                          ? `${product.stock} ${t2(lang, { ht: 'an stock', en: 'in stock' })}`
                          : t2(lang, { ht: 'Pa gen stock', en: 'Out of stock' })}
                      </span>
                    )}
                    {product.stock == null && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--pd-text-secondary, #64748b)', fontWeight: 500 }}>
                        {t2(lang, { ht: 'Ilimit', en: 'Unlimited' })}
                      </span>
                    )}
                  </div>
                  <button type="button" className="pd-cta-btn"
                    onClick={() => handleBuy(product, selectedVariant)}>
                    <i className={product.kind === 'digital' && product.download_url ? 'fas fa-download' : 'fas fa-shopping-cart'} aria-hidden="true" />
                    {product.kind === 'digital' && product.download_url
                      ? (t2(lang, { ht: 'Telechaje', en: 'Download' }))
                      : (t2(lang, { ht: 'Achte kounye a', en: 'Buy now' }))}
                  </button>
                </div>
                <p className="pd-price-disclaimer">
                  <i className="fas fa-shield-alt" style={{ marginRight: 4, opacity: 0.5 }} />
                  {lang === 'ht'
                    ? 'Seksyon an sekirite. Paiement an komen se pa sa a platfòm nan jere a.'
                    : 'Secure checkout. Payment handled by the platform.'}
                </p>
              </div>

            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
   HERO CONTENT — category badge + title + seller
   ══════════════════════════════════════════════════════════════════ */
function HeroContent({ product, t, lang }) {
  const accent = categoryAccent(product.category);
  const kindLabel = product.kind === 'digital'
    ? (t2(lang, { ht: 'Digital', en: 'Digital' }))
    : product.kind === 'physical'
      ? (t2(lang, { ht: 'Fizik', en: 'Physical' }))
      : product.kind;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      {/* ─── Price Badge ─────────────────────────────────────── */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '6px 18px', borderRadius: 50,
        background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        color: '#fff', fontWeight: 700, fontSize: '1.3rem',
        marginBottom: 14,
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      }}>
        {formatCurrency(product.price, product.currency, lang)}
      </div>

      {/* ─── Tags ──────────────────────────────────────────────── */}
      <div className="pd-hero-tags" style={{ justifyContent: 'center' }}>
        {product.category && (
          <span className="pd-tag" style={{
            background: accent.bg, color: accent.color,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}>
            <i className={`fas ${accent.icon}`} style={{ fontSize: '0.65rem', marginRight: 4 }} />
            {product.category}
          </span>
        )}
        {kindLabel && (
          <span className="pd-tag" style={{
            background: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}>
            <i className="fas fa-circle" style={{ fontSize: '0.4rem', marginRight: 4, opacity: 0.6 }} />
            {kindLabel}
          </span>
        )}
        {product.is_featured && (
          <span className="pd-tag" style={{
            background: 'rgba(251,191,36,0.35)', color: '#fbbf24',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}>
            <i className="fas fa-star" style={{ fontSize: '0.65rem', marginRight: 4 }} />
            {t2(lang, { ht: 'Rekòmande', en: 'Featured' })}
          </span>
        )}
      </div>

      {/* ─── Title ────────────────────────────────────────────────── */}
      <h1 className="pd-hero-title" style={{ fontSize: '1.8rem', margin: '10px 0 6px' }}>
        {product.title}
      </h1>

      {/* ─── Seller ──────────────────────────────────────────────── */}
      {product.seller_username && (
        <p className="pd-hero-desc" style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.8)' }}>
          <i className="fas fa-user" style={{ marginRight: 6, opacity: 0.6 }} />
          {t2(lang, { ht: 'Pa', en: 'By' })} {product.seller_username}
        </p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PRICE CARD — quick price + buy CTA
   ══════════════════════════════════════════════════════════════════ */
function PriceCard({ product, t, lang, onOpenCheckout, selectedVariant, onSelectVariant }) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const outOfStock = selectedVariant
    ? selectedVariant.stock === 0
    : product.stock === 0;
  const handleBuy = () => {
    const price = selectedVariant && selectedVariant.price != null
      ? Number(selectedVariant.price)
      : Number(product?.price) || 0;
    const meta = { product_id: product.id, title: product.title };
    if (selectedVariant) {
      meta.variant_id = selectedVariant.id;
      meta.variant_name = selectedVariant.name;
    }
    if (price > 0) {
      onOpenCheckout?.('order', price, meta);
    } else if (product?.kind === 'digital' && product?.download_url) {
      window.open(product.download_url, '_blank', 'noopener,noreferrer');
    }
  };
  return (
    <div className="pd-price-card" style={{ marginBottom: 20 }}>
      {variants.length > 0 && (
        <div className="pd-variants">
          <span className="pd-variants-label">
            {t2(lang, { ht: 'Variant', en: 'Variant' })}:
          </span>
          <div className="pd-variants-list">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`pd-variant-chip ${selectedVariant?.id === v.id ? 'pd-variant-chip--active' : ''}`}
                onClick={() => onSelectVariant?.(v)}
                disabled={v.stock === 0}
                title={v.stock === 0
                  ? (t2(lang, { ht: 'Stock fini', en: 'Out of stock' }))
                  : (v.sku ? `SKU ${v.sku}` : undefined)}
              >
                {v.name}
                {v.price != null && (
                  <span className="pd-variant-chip-price">
                    {formatCurrency(v.price, product.currency, lang)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="pd-price-card-header">
        <div className="pd-price-card-info">
          <span className="pd-price-label">
            <i className="fas fa-tag" style={{ marginRight: 6 }} />
            {t2(lang, { ht: 'Prix', en: 'Price' })}
          </span>
          <span className="pd-price-amount">
            {formatCurrency(
              selectedVariant && selectedVariant.price != null ? selectedVariant.price : product.price,
              product.currency,
              lang,
            )}
          </span>
          {(selectedVariant ? selectedVariant.stock != null : product.stock != null) && (
            <span style={{
              fontSize: '0.75rem',
              color: outOfStock ? '#ef4444' : '#22c55e',
              fontWeight: 600, marginTop: 2,
            }}>
              {outOfStock
                ? (t2(lang, { ht: 'Stock fini', en: 'Out of stock' }))
                : `${selectedVariant ? selectedVariant.stock : product.stock} ${t2(lang, { ht: 'an stock', en: 'in stock' })}`}
            </span>
          )}
        </div>
        <button type="button" className="pd-cta-btn" onClick={handleBuy} disabled={outOfStock}>
          <i className={product.kind === 'digital' && product.download_url ? 'fas fa-download' : 'fas fa-shopping-cart'} />
          {product.kind === 'digital' && product.download_url
            ? (t2(lang, { ht: 'Telechaje', en: 'Download' }))
            : (t2(lang, { ht: 'Achte', en: 'Buy' }))}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SELLER CARD — seller info card
   ══════════════════════════════════════════════════════════════════ */
function SellerCard({ product, lang }) {
  const initial = (product.seller_username || '?')[0].toUpperCase();

  return (
    <div className="pd-seller-card">
      <div className="pd-seller-avatar">
        {initial}
      </div>
      <div className="pd-seller-info">
        <span className="pd-seller-label">
          {t2(lang, { ht: 'Vandè', en: 'Seller' })}
        </span>
        <span className="pd-seller-name">
          {product.seller_username || (t2(lang, { ht: 'Endiskitab', en: 'Unknown' }))}
        </span>
      </div>
      {product.kind === 'digital' && (
        <span className="pd-seller-badge">
          <i className="fas fa-cloud" style={{ fontSize: '0.6rem', marginRight: 4 }} />
          {t2(lang, { ht: 'Digital', en: 'Digital' })}
        </span>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   INFO GRID — category, kind, stock, dates
   ══════════════════════════════════════════════════════════════════ */
function InfoGrid({ product, lang, t }) {
  const accent = categoryAccent(product.category);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
      <InfoTile
        icon={`fas ${accent.icon}`}
        label={t2(lang, { ht: 'Kategori', en: 'Category' })}
        value={product.category || '—'}
        iconColor={accent.color}
      />
      <InfoTile
        icon="fas fa-box"
        label={t2(lang, { ht: 'Tip', en: 'Type' })}
        value={product.kind === 'digital' ? (t2(lang, { ht: 'Digital', en: 'Digital' }))
          : product.kind === 'physical' ? (t2(lang, { ht: 'Fizik', en: 'Physical' }))
          : product.kind || '—'}
      />
      <InfoTile
        icon="fas fa-cubes"
        label={t2(lang, { ht: 'Stock', en: 'Stock' })}
        value={product.stock != null ? String(product.stock) : (t2(lang, { ht: 'Ilimite', en: 'Unlimited' }))}
      />
      <InfoTile
        icon="fas fa-calendar-plus"
        label={t2(lang, { ht: 'Kreye', en: 'Created' })}
        value={formatDate(product.created_at, lang) || '—'}
      />
      {product.tags && product.tags.length > 0 && (
        <div className="pd-info-tile" style={{ gridColumn: '1 / -1' }}>
          <div className="pd-info-tile-header">
            <i className="fas fa-tags" style={{ fontSize: '0.7rem', opacity: 0.6 }} />
            {t2(lang, { ht: 'Etikèt', en: 'Tags' })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {product.tags.map((tag) => (
              <span key={tag} style={{
                padding: '3px 10px', borderRadius: 50, fontSize: '0.75rem', fontWeight: 600,
                background: 'var(--pd-primary-light, #dbeafe)', color: 'var(--pd-primary, #2563eb)',
              }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   INFO TILE — grid cell
   ══════════════════════════════════════════════════════════════════ */
function InfoTile({ icon, label, value, iconColor }) {
  return (
    <div className="pd-info-tile">
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
