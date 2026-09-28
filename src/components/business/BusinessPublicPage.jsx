/**
 * src/components/business/BusinessPublicPage.jsx
 *
 * Phase 3 — public Business Profile page (``/business/:slug``).
 *
 * The shared deep-link page for a Business Profile: visible to
 * ANYONE (no AuthGate), URL-driven, and sheet-isolated via the
 * shared ``cd-page`` / ``[data-detail-sheet]`` layout system so the
 * fixed top action bar never overlaps the hero (same contract as
 * SpotlightDetail + CompanyProfileDetail).
 *
 * Data flow
 * ---------
 *   API:  GET /api/business/profiles/<slug>/  — Phase 3 public
 *         retrieve. ACTIVE profiles are world-readable through the
 *         PII-free public serializer (no owner id, no email, no
 *         lifecycle); dormant (deactivated/archived) profiles 404
 *         for non-owners, and the page renders its not-found state.
 *
 * Discovery isolation: this page is reachable ONLY by knowing the
 * slug (a shared link). Business profiles are still NOT registered
 * in any global catalog — no Explore / Home Feed / Search surface
 * ever lists them, so creating one has zero effect on discovery.
 *
 * Meta tags: Open Graph + Twitter Card via react-helmet-async so a
 * pasted link produces a rich preview (same pattern as Spotlight /
 * Company).
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { SHEETS } from '../../routes/sheets';
import { translations } from '../../data/translations';
import { useAuth } from '../../hooks/useAuth';
import { businessCatalogService, businessInquiryService, businessOrderService, businessProfileService } from '../../services/api';
import { businessDayLabel, isClosedHours } from '../../utils/businessHours';
import { requireLogin } from '../../utils/history';
import { ogImageForLang } from '../profile/profileConstants';

function buildOgUrl(slug) {
  const base = window.location.origin || 'https://atelnyo.app';
  return `${base}/business/${encodeURIComponent(slug || '')}`;
}

// Static OG image fallback (business has no logo). SINGLE SOURCE OF
// TRUTH contract: kept in sync with ``_OG_IMAGE_FALLBACK`` in
// ``backend/business/views/business_og.py`` — IF either side changes,
// change the other. A stable CDN image (cacheable per crawler IP),
// not a placeholder service.
const OG_IMAGE_FALLBACK =
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8'
  + '?auto=format&fit=crop&w=1200&q=80';

const S = {
  flexCol: { display: 'flex', flexDirection: 'column' },
  flexRow: { display: 'flex', flexDirection: 'row', alignItems: 'center' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
};

function truncateDescription(desc = '', max = 200) {
  if (!desc) return '';
  return desc.length > max ? `${desc.slice(0, max)}…` : desc;
}

function InfoTile({ icon, label, value }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '12px 14px', minWidth: 0,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 6,
      }}>
        <i className={`fas ${icon}`} aria-hidden="true" />
        {label}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.92)', fontSize: '0.9rem', wordBreak: 'break-word' }}>
        {value || '—'}
      </div>
    </div>
  );
}

function CatalogCard({ item, lang, isHt, canOrder, onOrder }) {
  const value = Number(item.price ?? 0);
  const symbol = item.currency === 'HTG' ? 'G' : (item.currency || 'USD');
  return (
    <div className="company-offering-card" style={{
      background: 'var(--cd-surface, #1e293b)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, overflow: 'hidden',
    }} data-testid="business-public-item">
      {item.image_url ? (
        <img src={item.image_url} alt={item.name} loading="lazy"
          style={{ width: '100%', height: 120, objectFit: 'cover', background: 'rgba(255,255,255,0.06)' }} />
      ) : (
        <div style={{
          width: '100%', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, rgba(216,27,96,.25), rgba(124,58,237,.25))',
          color: 'rgba(255,255,255,0.75)', fontSize: '1.6rem',
        }}>
          <i className="fas fa-cube" aria-hidden="true" />
        </div>
      )}
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ color: 'var(--cd-text, #f1f5f9)', fontWeight: 700, fontSize: '0.95rem' }}>{item.name}</span>
          <span style={{ color: '#f472b6', fontWeight: 800, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
            {value.toLocaleString(isHt ? 'fr-HT' : 'en-US', { minimumFractionDigits: 2 })} {symbol}
          </span>
        </div>
        {item.category && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6,
            background: 'rgba(147,197,253,0.14)', color: '#93c5fd',
            border: '1px solid rgba(147,197,253,0.35)', borderRadius: 999,
            padding: '2px 10px', fontSize: '0.7rem', fontWeight: 600,
          }}>
            <i className="fas fa-tag" aria-hidden="true" />
            {item.category}
          </span>
        )}
        {item.description && (
          <p style={{ margin: '10px 0 0', color: 'rgba(148,163,184,0.9)', fontSize: '0.82rem', lineHeight: 1.5 }}>
            {item.description}
          </p>
        )}
        {canOrder && (
          <button
            type="button"
            onClick={() => onOrder?.(item)}
            className="biz-btn biz-btn-primary biz-btn-sm"
            style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}
            data-testid="business-public-order-btn"
          >
            <i className="fas fa-cart-plus" aria-hidden="true" />
            {isHt ? 'Kòmande' : 'Order'}
          </button>
        )}
      </div>
    </div>
  );
}

function FaqAccordion({ items, t, lang }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="biz-faq-accordion">
      {items.map((f) => (
        <details className="biz-faq-details" key={f.id} data-testid="business-public-faq-item">
          <summary className="biz-faq-summary">
            <span className="biz-faq-summary-q">{f.question}</span>
            <i className="fas fa-chevron-down biz-faq-chevron" aria-hidden="true" />
          </summary>
          <div className="biz-faq-panel">
            <p>{f.answer}</p>
          </div>
        </details>
      ))}
    </div>
  );
}

function FaqSection({ bizFaqs, prodFaqs, t, lang }) {
  const isHt = lang === 'ht';
  if ((!bizFaqs || bizFaqs.length === 0) && (!prodFaqs || prodFaqs.length === 0)) return null;

  // Group product FAQs under their item name (server sends item_name).
  const grouped = {};
  (prodFaqs || []).forEach((f) => {
    const key = f.item_name || (isHt ? 'Pwodui' : 'Product');
    (grouped[key] = grouped[key] || []).push(f);
  });

  return (
    <section className="cd-section" data-testid="business-public-faqs-section">
      <h2 className="cd-section-title">
        <i className="fas fa-circle-question" aria-hidden="true" />
        {t?.business_public_faqs || (isHt ? 'Kesyon souvan' : 'Frequently asked questions')}
      </h2>

      {(bizFaqs || []).length > 0 && (
        <div className="biz-faq-group" data-testid="business-public-business-faqs">
          <h3 className="biz-faq-group-title">
            {t?.business_public_biz_faq || (isHt ? 'Biznis la' : 'About the business')}
          </h3>
          <FaqAccordion items={bizFaqs} t={t} lang={lang} />
        </div>
      )}

      {Object.entries(grouped).map(([itemName, faqs]) => (
        <div className="biz-faq-group" key={itemName} data-testid="business-public-product-faqs">
          <h3 className="biz-faq-group-title">{itemName}</h3>
          <FaqAccordion items={faqs} t={t} lang={lang} />
        </div>
      ))}
    </section>
  );
}

function StarRow({ rating, size = '0.85rem' }) {
  return (
    <span className="biz-review-stars-static" style={{ fontSize: size }} aria-label={`${rating}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i
          key={n}
          className={`fas ${n <= rating ? 'fa-star' : 'fa-star biz-review-star-off'}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function ReviewsSection({ reviews, t, lang }) {
  const isHt = lang === 'ht';
  if (!reviews || reviews.length === 0) return null;
  const avg = reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length;
  return (
    <section className="cd-section" data-testid="business-public-reviews-section">
      <h2 className="cd-section-title">
        <i className="fas fa-star" aria-hidden="true" />
        {t?.business_public_reviews || (isHt ? 'Revizyon kliyan' : 'Customer reviews')}
      </h2>

      {/* Summary — average rating + count (no chart lib, pure CSS). */}
      <div className="biz-reviews-summary">
        <span className="biz-reviews-summary-avg">{avg.toFixed(1)}</span>
        <div className="biz-reviews-summary-side">
          <StarRow rating={Math.round(avg)} />
          <span className="biz-reviews-summary-count">
            {reviews.length} {isHt
              ? (reviews.length === 1 ? 'revizyon' : 'revizyon')
              : (reviews.length === 1 ? 'review' : 'reviews')}
          </span>
        </div>
      </div>

      <div className="biz-reviews-wall" data-testid="business-public-reviews">
        {reviews.map((r) => (
          <article className="biz-review-card" key={r.id} data-testid="business-public-review">
            <div className="biz-review-card-head">
              <div className="biz-review-avatar" aria-hidden="true">
                <i className="fas fa-user" />
              </div>
              <div className="biz-review-card-who">
                <span className="biz-review-username">@{r.customer_username || (isHt ? 'Kliyan' : 'Customer')}</span>
                <span className="biz-review-item">
                  {t?.business_review_on || (isHt ? 'sou' : 'on')} {r.item_name}
                </span>
              </div>
              <div className="biz-review-card-meta">
                <StarRow rating={Number(r.rating || 0)} size="0.75rem" />
                <span className="biz-review-date">
                  {new Date(r.created_at).toLocaleDateString(isHt ? 'fr-HT' : 'en-US', {
                    year: 'numeric', month: 'short', day: 'numeric',
                  })}
                </span>
              </div>
            </div>
            {r.comment && <p className="biz-review-comment">{r.comment}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

function HeroEmptyMessage({ icon, msg }) {
  return (
    <div style={{ ...S.center, gap: 10, padding: '32px 0', color: 'rgba(255,255,255,0.7)' }}>
      <i className={`fas ${icon}`} aria-hidden="true" style={{ fontSize: '2rem', opacity: 0.7 }} />
      <span style={{ fontSize: '0.92rem', textAlign: 'center' }}>{msg}</span>
    </div>
  );
}

function HeroContent({ payload, t, lang }) {
  const isHt = lang === 'ht';
  return (
    <div style={{ ...S.flexCol, gap: 14 }}>
      <div style={{ ...S.flexRow, gap: 16, flexWrap: 'wrap' }}>
        {/* Logo / avatar */}
        {payload.logo_url ? (
          <img src={payload.logo_url} alt={payload.name} loading="lazy"
            style={{
              width: 88, height: 88, borderRadius: 22, objectFit: 'cover',
              border: '3px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            }} />
        ) : (
          <div style={{
            width: 88, height: 88, borderRadius: 22,
            background: 'linear-gradient(135deg, #d81b60 0%, #7c3aed 60%, #2563eb 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '3px solid rgba(255,255,255,0.25)', boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            color: '#fff',
          }}>
            <i className="fas fa-store" aria-hidden="true" style={{ fontSize: '1.7rem' }} />
          </div>
        )}

        <div style={{ ...S.flexCol, gap: 6, flex: 1, minWidth: 0 }}>
          <h1 style={{
            margin: 0, color: '#fff', fontSize: 'clamp(1.4rem, 4.5vw, 2rem)',
            fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em',
          }}>{payload.name}</h1>

          {payload.tagline && (
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.85)', fontSize: '1rem', fontWeight: 500 }}>
              {payload.tagline}
            </p>
          )}

          <div style={{ ...S.flexRow, gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
            {payload.category_name && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(147,197,253,0.14)', color: '#93c5fd',
                border: '1px solid rgba(147,197,253,0.35)',
                borderRadius: 999, padding: '3px 10px', fontSize: '0.72rem',
                fontWeight: 600, letterSpacing: '0.03em',
              }} data-testid="business-public-category">
                <i className="fas fa-tag" aria-hidden="true" />
                {payload.category_name}
              </span>
            )}
            {payload.owner_username && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem',
              }} data-testid="business-public-owner">
                <i className="fas fa-user-circle" aria-hidden="true" />
                {t?.business_public_operated_by || (isHt ? 'Opere pa' : 'Operated by')}{' '}
                <strong style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
                  @{payload.owner_username}
                </strong>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BusinessPublicPage({ lang = 'ht', showToast }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const t = translations?.[lang] || translations?.ht || {};
  const isHt = lang === 'ht';
  const { user } = useAuth();

  const [payload, setPayload] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errCode, setErrCode] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [orderItem, setOrderItem] = useState(null);
  const [orderQty, setOrderQty] = useState(1);
  const [orderNote, setOrderNote] = useState('');
  const [orderBusy, setOrderBusy] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [payBusy, setPayBusy] = useState(false);
  // Phase 8 — customer inquiry (contact modal + My inquiries).
  const [contactOpen, setContactOpen] = useState(false);
  const [contactTopic, setContactTopic] = useState('general');
  const [contactItem, setContactItem] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactBody, setContactBody] = useState('');
  const [contactBusy, setContactBusy] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [myInquiries, setMyInquiries] = useState([]);
  const [myInquiriesOpen, setMyInquiriesOpen] = useState(false);
  // Phase 6b — public review wall.
  const [reviews, setReviews] = useState([]);
  // Phase 7a — public FAQ walls (business-level + per-product).
  const [bizFaqs, setBizFaqs] = useState([]);
  const [prodFaqs, setProdFaqs] = useState([]);
  const mounted = useRef(true);

  const isOwner = Boolean(user && payload && user.id === payload.owner);

  useEffect(() => {
    mounted.current = true;
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      mounted.current = false;
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // Fetch-on-mount with a cancellation guard. The backend public
  // retrieve serves ACTIVE profiles to anyone and 404s dormant ones
  // for non-owners — so a 404 here means "doesn't exist OR not
  // publicly active". Both render the same not-found state (the
  // lifecycle of a dormant business is never exposed).
  useEffect(() => {
    let cancelled = false;
    // Intentional synchronous reset so a slug change starts a clean
    // fetch — matches the fetch-effect pattern used across App.jsx
    // (the react-hooks v7 rule flags this, so it gets the same
    // convention-matching disable comment).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setErrCode(null);
    (async () => {
      try {
        const res = await businessProfileService.get(slug);
        const p = res?.data?.data ?? res?.data ?? null;
        if (!cancelled && mounted.current) {
          setPayload(p && typeof p === 'object' && p.id ? p : null);
          if (!p || !p.id) setErrCode('not_found');
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled && mounted.current) {
          setErrCode(err?.response?.status === 404 ? 'not_found' : 'load_error');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  // ─── Content Intelligence SEO data ─────────────────────────────
  const [ciSeo, setCiSeo] = useState(null);
  useEffect(() => {
    if (!payload?.id) return;
    let cancelled = false;
    businessProfileService.getSEO(payload.id)
      .then((res) => {
        if (!cancelled && res?.data?.status === 'ready') setCiSeo(res.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [payload?.id]);

  // Phase 4 — load the ACTIVE catalog items for the public page. The
  // backend serves ACTIVE items of ACTIVE profiles only; anything
  // else returns an empty list (never an error page).
  useEffect(() => {
    if (!payload?.slug) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await businessCatalogService.public(payload.slug);
        const data = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
        if (!cancelled) setItems(data);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => { cancelled = true; };
  }, [payload?.slug]);

  // Phase 6b — load the public review wall (active-profile only; the
  // backend hides reviews of dormant profiles the same way it hides
  // the profile itself). Empty list renders no section at all.
  useEffect(() => {
    if (!payload?.slug) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await businessProfileService.reviews(payload.slug);
        const data = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
        if (!cancelled) setReviews(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setReviews([]);
      }
    })();
    return () => { cancelled = true; };
  }, [payload?.slug]);

  // Phase 7a — load both FAQ walls. ACTIVE rows only (the backend
  // enforces it); empty lists render no FAQ section at all.
  useEffect(() => {
    if (!payload?.slug) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [biz, prod] = await Promise.all([
          businessProfileService.businessFaqs(payload.slug),
          businessProfileService.productFaqs(payload.slug),
        ]);
        const bizData = Array.isArray(biz?.data) ? biz.data : (biz?.data?.results || []);
        const prodData = Array.isArray(prod?.data) ? prod.data : (prod?.data?.results || []);
        if (!cancelled) {
          setBizFaqs(Array.isArray(bizData) ? bizData : []);
          setProdFaqs(Array.isArray(prodData) ? prodData : []);
        }
      } catch {
        if (!cancelled) {
          setBizFaqs([]);
          setProdFaqs([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [payload?.slug]);

  const handleBack = () => navigate('/');

  const handleShare = async () => {
    // Share the CRAWLER-AWARE URL (/business/<slug>/og/): the backend
    // serves prerendered OG HTML there (see business_og.py), so a
    // shared link unfurls with real metadata in FB/WhatsApp/etc. —
    // crawlers never run this page's JS Helmet. Browsers are bounced
    // into the SPA by the endpoint's 0-second meta-refresh (and its
    // og:url/canonical point back at this SPA deep-link).
    const url = `${window.location.origin}/business/${encodeURIComponent(slug || '')}/og/`;
    if (shareBusy) return;
    setShareBusy(true);
    try {
      if (navigator.share) {
        try {
          await navigator.share({
            title: payload?.name || 'Business',
            text: payload?.tagline || payload?.description?.slice(0, 120) || '',
            url,
          });
          return;
        } catch {
          // user cancelled → fall through to clipboard
        }
      }
      await navigator.clipboard.writeText(url);
      if (showToast) {
        showToast(t?.business_public_share_copied || (isHt ? 'Lyen kopye!' : 'Link copied!'));
      }
    } catch {
      // clipboard unavailable — nothing to do
    } finally {
      setShareBusy(false);
    }
  };

  // ─── Phase 5 — order + wallet payment flow ───────────────────────
  const openOrder = (item) => {
    setPlacedOrder(null);
    setOrderQty(1);
    setOrderNote('');
    setOrderItem(item);
  };

  const closeOrder = () => {
    if (orderBusy || payBusy) return;
    setOrderItem(null);
    setPlacedOrder(null);
    setOrderQty(1);
    setOrderNote('');
  };

  const placeOrder = async () => {
    if (!orderItem || orderBusy) return;
    setOrderBusy(true);
    try {
      const res = await businessOrderService.create({
        item: orderItem.id,
        quantity: orderQty,
        note: orderNote,
      });
      const data = res?.data?.data ?? res?.data ?? null;
      setPlacedOrder(data && data.id ? data : null);
      showToast?.(isHt ? 'Kòmand la kreye!' : 'Order placed!', 'check-circle');
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail || err?.response?.data?.item || (isHt
          ? 'Pa t ka kreye kòmand la.' : 'Could not place the order.'),
        'circle-exclamation',
      );
    } finally {
      setOrderBusy(false);
    }
  };

  const payOrder = async () => {
    if (!placedOrder || payBusy) return;
    setPayBusy(true);
    try {
      const res = await businessOrderService.pay(placedOrder.id);
      const data = res?.data?.data ?? res?.data ?? null;
      if (data?.id) setPlacedOrder(data);
      showToast?.(isHt ? 'Peman an reyisi! Revni al nan biznis la.' : 'Payment successful!', 'check-circle');
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 402) {
        showToast?.(
          isHt
            ? 'Balans Wallet ou pa sifi. Mete lajan nan Wallet ou anvan ou peye.'
            : 'Insufficient wallet balance. Top up your wallet before paying.',
          'circle-exclamation',
        );
      } else {
        showToast?.(detail || (isHt ? 'Peman an pa t mache.' : 'Payment failed.'), 'circle-exclamation');
      }
    } finally {
      setPayBusy(false);
    }
  };

  // ─── Phase 8 — customer inquiry (contact modal) ──────────────────
  const openContact = () => {
    setContactTopic('general');
    setContactItem('');
    setContactSubject('');
    setContactBody('');
    setContactSent(false);
    setMyInquiriesOpen(false);
    setContactOpen(true);
    if (user) loadMyInquiries();
  };

  const loadMyInquiries = async () => {
    try {
      const res = await businessInquiryService.mine();
      const data = res?.data?.data ?? res?.data ?? [];
      const mine = (Array.isArray(data) ? data : []).filter(
        (q) => q.business_profile_slug === payload?.slug,
      );
      setMyInquiries(mine);
    } catch {
      setMyInquiries([]);
    }
  };

  const sendInquiry = async () => {
    if (contactBusy || !user) return;
    setContactBusy(true);
    try {
      await businessInquiryService.create({
        business_profile: payload.id,
        catalog_item: contactTopic === 'product' && contactItem ? Number(contactItem) : undefined,
        topic: contactTopic,
        subject: contactSubject.trim(),
        body: contactBody.trim(),
      });
      setContactSent(true);
      showToast?.(t?.business_inquiry_sent || (isHt ? '✅ Demann lan voye!' : '✅ Inquiry sent!'), 'check-circle');
      loadMyInquiries();
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail || (isHt
          ? 'Pa t ka voye demann lan.'
          : 'Could not send your question.'),
        'circle-exclamation',
      );
    } finally {
      setContactBusy(false);
    }
  };

  const inquiryStatusLabel = (status) => ({
    new: t?.business_inquiry_status_new || (isHt ? 'Nouvo' : 'New'),
    replied: t?.business_inquiry_status_replied || (isHt ? 'Reponn' : 'Replied'),
    closed: t?.business_inquiry_status_closed || (isHt ? 'Fèmen' : 'Closed'),
  }[status] || status);

  const inquiryStatusColor = {
    new: '#f59e0b',
    replied: '#34d399',
    closed: '#94a3b8',
  };

  const pageTitle = payload?.name
    ? (t?.business_public_meta_title || '{name} · Business · Atelnyo').replace('{name}', payload.name)
    : 'Business · Atelnyo';
  const ogUrl = buildOgUrl(slug);
  // (og:locale is owned by App.jsx's global <Helmet> — see Helmet below.)

  // Phase 9 — public contact & info: precompute the hours rows + whether
  // the section should render at all (plain conditionals, no IIFE).
  const hoursEntries = Object.entries(payload?.hours || {});
  const hasInfo = Boolean(
    payload?.category_name || payload?.created_at || payload?.location
    || payload?.contact_email || payload?.phone || payload?.website_url
    || hoursEntries.length > 0,
  );

  return (
    <>
      <Helmet>
        <title>{ciSeo?.title || pageTitle}</title>
        <meta property="og:type" content="article" />
        <meta property="og:url" content={ogUrl} />
        <meta property="og:site_name" content="Atelnyo" />
        <meta property="og:title" content={ciSeo?.og_title || pageTitle} />
        <meta property="og:description" content={ciSeo?.og_description || truncateDescription(payload?.description)} />
        <meta property="og:image" content={ciSeo?.og_image || payload?.logo_url || ogImageForLang(lang)} />
        {/* og:locale lives in App.jsx's global <Helmet> (market-aware) —
            a second one here duplicated the tag. */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ciSeo?.title || pageTitle} />
        <meta name="twitter:description" content={ciSeo?.description || truncateDescription(payload?.description)} />
        <meta name="twitter:image" content={ciSeo?.og_image || payload?.logo_url || ogImageForLang(lang)} />
      </Helmet>

      <div className="cd-page" data-detail-sheet data-business-page
        data-testid="business-public-sheet" data-business-slug={slug || ''} data-lang={lang}>

        {/* ─── Sticky action bar (Back / Share) ────────────────── */}
        <header className={`cd-sticky-header${scrolled ? ' cd-sticky-header--scrolled' : ''}`}>
          <div className="cd-sticky-header-inner">
            <button type="button" className="cd-header-back" onClick={handleBack}
              aria-label={t?.business_public_back || (isHt ? 'Retounen' : 'Back')}
              data-testid="business-public-back-btn">
              <i className="fas fa-arrow-left" aria-hidden="true" />
            </button>
            <span className={`cd-header-title${scrolled ? ' cd-header-title--visible' : ''}`}>
              {payload?.name || (t?.business_public || 'Business')}
            </span>
            <div className="cd-header-actions">
              <button type="button" className="cd-header-action-btn" onClick={handleShare}
                disabled={shareBusy}
                aria-label={t?.business_public_share || (isHt ? 'Pataje' : 'Share')}
                title={t?.business_public_share || (isHt ? 'Pataje' : 'Share')}
                data-testid="business-public-share-btn">
                <i className="fas fa-share-alt" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        {/* ─── Hero ────────────────────────────────────────────── */}
        <section className="cd-hero">
          <div className="cd-hero-fallback">
            <div className="cd-hero-fallback-grad" style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #312e81 50%, #1e293b 100%)',
            }} />
          </div>

          <div className="cd-hero-content cd-hero-content--loaded">
            {loading ? (
              <div style={{ ...S.flexCol, alignItems: 'center', gap: 16, padding: '20px 0', color: 'rgba(255,255,255,0.7)' }}
                role="status" aria-live="polite" data-testid="business-public-loading">
                <div style={{
                  width: 88, height: 88, borderRadius: 22,
                  background: 'rgba(255,255,255,0.08)', border: '3px solid rgba(255,255,255,0.12)',
                  animation: 'pulse 2s infinite ease-in-out',
                }} />
                <div style={{ width: 160, height: 14, borderRadius: 6, background: 'rgba(255,255,255,0.10)', animation: 'pulse 2s infinite ease-in-out' }} />
                <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>
                  {t?.business_public_loading || (isHt ? 'Ap chaje paj biznis la...' : 'Loading business page...')}
                </span>
              </div>
            ) : errCode === 'not_found' ? (
              <HeroEmptyMessage
                icon="fa-store-slash"
                msg={t?.business_public_not_found || (isHt
                  ? 'Paj sa pa egziste oswa biznis la pa aktif.'
                  : 'This page does not exist or the business is not active.')}
              />
            ) : errCode === 'load_error' ? (
              <HeroEmptyMessage
                icon="fa-triangle-exclamation"
                msg={t?.business_public_load_error || (isHt
                  ? 'Nou pa t kapab chaje paj la.'
                  : 'Could not load this page.')}
              />
            ) : payload ? (
              <>
                <HeroContent payload={payload} t={t} lang={lang} />
                {!isOwner && (
                  <div style={{ marginTop: 6 }}>
                    <button
                      type="button"
                      className="biz-btn biz-btn-primary"
                      onClick={openContact}
                      data-testid="business-public-contact-btn"
                    >
                      <i className="fas fa-envelope" aria-hidden="true" />
                      {t?.business_inquiry_ask || (isHt ? 'Poz yon kesyon' : 'Ask a question')}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <HeroEmptyMessage icon="fa-store" msg="—" />
            )}
          </div>
        </section>

        {/* ─── Body ────────────────────────────────────────────── */}
        {payload && !loading && !errCode && (
          <div className="cd-body">
            <div className="cd-body-inner">

              {/* ─── About ──────────────────────────────────── */}
              {payload.description && (
                <section className="cd-section" data-testid="business-public-about-section">
                  <h2 className="cd-section-title">
                    <i className="fas fa-circle-info" aria-hidden="true" />
                    {t?.business_public_about || (isHt ? 'Apwopo' : 'About')}
                  </h2>
                  <p className="cd-text" style={{ whiteSpace: 'pre-wrap' }}>{payload.description}</p>
                </section>
              )}

              {/* ─── Products & Services (Phase 4) ──────────── */}
              {items.length > 0 && (
                <section className="cd-section" data-testid="business-public-offerings-section">
                  <h2 className="cd-section-title">
                    <i className="fas fa-box-open" aria-hidden="true" />
                    {t?.business_public_offerings || (isHt ? 'Pwodwi & Sèvis' : 'Products & Services')}
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                    {items.map((item) => (
                      <CatalogCard
                        key={item.id}
                        item={item}
                        lang={lang}
                        isHt={isHt}
                        canOrder={!isOwner}
                        onOrder={openOrder}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* ─── FAQs (Phase 7a) ─────────────────────────── */}
              <FaqSection bizFaqs={bizFaqs} prodFaqs={prodFaqs} t={t} lang={lang} />

              {/* ─── Customer reviews (Phase 6b) ──────────────── */}
              <ReviewsSection reviews={reviews} t={t} lang={lang} />

              {/* ─── Info grid (Phase 9 — public contact) ─────── */}
              {hasInfo && (
                  <section className="cd-section" data-testid="business-public-info-section">
                    <h2 className="cd-section-title">
                      <i className="fas fa-building" aria-hidden="true" />
                      {t?.business_public_information || (isHt ? 'Enfòmasyon' : 'Information')}
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                      {payload.location && (
                        <InfoTile
                          icon="fa-location-dot"
                          label={t?.business_field_location || (isHt ? 'Kote' : 'Location')}
                          value={payload.location}
                        />
                      )}
                      {payload.contact_email && (
                        <InfoTile
                          icon="fa-envelope"
                          label={t?.business_field_contact_email || (isHt ? 'Imèl kontak' : 'Contact email')}
                          value={<a className="biz-info-link" href={`mailto:${payload.contact_email}`}>{payload.contact_email}</a>}
                        />
                      )}
                      {payload.phone && (
                        <InfoTile
                          icon="fa-phone"
                          label={t?.business_field_phone || (isHt ? 'Telefòn' : 'Phone')}
                          value={payload.phone}
                        />
                      )}
                      {payload.website_url && (
                        <InfoTile
                          icon="fa-globe"
                          label={t?.business_field_website || (isHt ? 'Sit wèb' : 'Website')}
                          value={
                            <a
                              className="biz-info-link"
                              href={payload.website_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-testid="business-public-website"
                            >
                              {payload.website_url.replace(/^https?:\/\//, '')}
                              <i className="fas fa-arrow-up-right-from-square" aria-hidden="true" style={{ marginLeft: 6, fontSize: '0.7rem' }} />
                            </a>
                          }
                        />
                      )}
                      {payload.category_name && (
                        <InfoTile
                          icon="fa-tag"
                          label={t?.business_field_category || 'Category'}
                          value={payload.category_name}
                        />
                      )}
                      {payload.created_at && (
                        <InfoTile
                          icon="fa-calendar"
                          label={t?.business_public_created || (isHt ? 'Kreye' : 'Created')}
                          value={new Date(payload.created_at).toLocaleDateString(
                            isHt ? 'fr-HT' : 'en-US',
                            { year: 'numeric', month: 'long', day: 'numeric' },
                          )}
                        />
                      )}
                    </div>

                    {/* ─── Operating hours ─────────────────────── */}                      {hoursEntries.length > 0 && (
                        <div className="biz-hours-display" data-testid="business-public-hours">
                          <p className="biz-hours-display-title">
                            <i className="fas fa-clock" aria-hidden="true" />
                            {t?.business_field_hours || (isHt ? 'Èdtan operasyon' : 'Operating hours')}
                          </p>
                          <ul className="biz-hours-list">
                            {hoursEntries.map(([day, hoursText]) => (
                              <li className="biz-hours-list-row" key={day}>
                                <span className="biz-hours-day">
                                  {businessDayLabel(day, lang)}
                                </span>
                                <span className={`biz-hours-value${isClosedHours(hoursText) ? ' biz-hours-value--closed' : ''}`}>
                                  {hoursText}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </section>
              )}

              {/* ─── Owner credit ────────────────────────────── */}
              {payload.owner_username && (
                <div style={{ textAlign: 'center', padding: '8px 0 28px' }}>
                  <span style={{ color: 'rgba(148,163,184,0.75)', fontSize: '0.8rem' }}>
                    © {new Date().getFullYear()} {payload.name} · Atelnyo
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Contact modal — customer inquiry (Phase 8) ──────── */}
      {contactOpen && (
        <div
          className="biz-modal-overlay"
          onClick={() => setContactOpen(false)}
          data-testid="business-contact-modal"
        >
          <div className="biz-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="biz-modal-header">
              <h3 className="biz-modal-title">
                <i className="fas fa-envelope" aria-hidden="true" />
                {t?.business_inquiry_ask || (isHt ? 'Poz yon kesyon' : 'Ask a question')}
              </h3>
              <button
                type="button"
                className="biz-modal-close"
                onClick={() => setContactOpen(false)}
                aria-label="Close"
              >
                <i className="fas fa-xmark" aria-hidden="true" />
              </button>
            </div>

            {!user ? (
              <div className="biz-inquiry-login" data-testid="business-inquiry-login">
                <i className="fas fa-lock" aria-hidden="true" />
                <p>
                  {t?.business_inquiry_login_required || (isHt
                    ? 'Konekte pou w ka poze yon kesyon bay biznis sa a.'
                    : 'Log in to ask this business a question.')}
                </p>
                <button
                  type="button"
                  className="biz-btn biz-btn-primary"
                  onClick={() => requireLogin(navigate, location, SHEETS.LOGIN)}
                  data-testid="business-inquiry-login-btn"
                >
                  <i className="fas fa-right-to-bracket" aria-hidden="true" />
                  {isHt ? 'Konekte' : 'Log in'}
                </button>
              </div>
            ) : contactSent ? (
              <div className="biz-inquiry-success" data-testid="business-inquiry-success">
                <i className="fas fa-check-circle" aria-hidden="true" />
                <p>
                  {t?.business_inquiry_sent || (isHt
                    ? '✅ Demann lan voye! Biznis la ap reponn ou byento.'
                    : '✅ Inquiry sent! The business will reply to you soon.')}
                </p>
                <button
                  type="button"
                  className="biz-btn biz-btn-primary"
                  onClick={() => setContactOpen(false)}
                >
                  {isHt ? 'Fèmen' : 'Done'}
                </button>
              </div>
            ) : (
              <div className="biz-form">
                <div className="biz-form-group">
                  <label className="biz-form-label" htmlFor="biz-inquiry-topic">
                    {t?.business_inquiry_topic || (isHt ? 'Sijè' : 'Topic')}
                  </label>
                  <select
                    id="biz-inquiry-topic"
                    className="biz-form-input"
                    value={contactTopic}
                    onChange={(e) => setContactTopic(e.target.value)}
                    data-testid="business-inquiry-topic"
                  >
                    <option value="general">{isHt ? 'Jeneral' : 'General'}</option>
                    <option value="product">{isHt ? 'Kesyon sou yon pwodui' : 'Product question'}</option>
                    <option value="order">{isHt ? 'Kòmand / acha' : 'Order / purchase'}</option>
                    <option value="support">{isHt ? 'Sipò' : 'Support'}</option>
                  </select>
                </div>

                {contactTopic === 'product' && items.length > 0 && (
                  <div className="biz-form-group">
                    <label className="biz-form-label" htmlFor="biz-inquiry-item">
                      {t?.business_inquiry_item || (isHt ? 'Pwodui / sèvis' : 'Product / service')}
                    </label>
                    <select
                      id="biz-inquiry-item"
                      className="biz-form-input"
                      value={contactItem}
                      onChange={(e) => setContactItem(e.target.value)}
                      data-testid="business-inquiry-item"
                    >
                      <option value="">—</option>
                      {items.map((it) => (
                        <option key={it.id} value={it.id}>{it.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="biz-form-group">
                  <label className="biz-form-label" htmlFor="biz-inquiry-subject">
                    {t?.business_inquiry_subject || (isHt ? 'Sijè kesyon' : 'Subject')}
                  </label>
                  <input
                    id="biz-inquiry-subject"
                    className="biz-form-input"
                    type="text"
                    maxLength="120"
                    value={contactSubject}
                    onChange={(e) => setContactSubject(e.target.value)}
                    data-testid="business-inquiry-subject"
                  />
                </div>

                <div className="biz-form-group">
                  <label className="biz-form-label" htmlFor="biz-inquiry-body">
                    {t?.business_inquiry_body || (isHt ? 'Kesyon w la' : 'Your question')}
                  </label>
                  <textarea
                    id="biz-inquiry-body"
                    className="biz-form-input"
                    rows="4"
                    maxLength="3000"
                    value={contactBody}
                    onChange={(e) => setContactBody(e.target.value)}
                    data-testid="business-inquiry-body"
                  />
                </div>

                <div className="biz-form-actions">
                  <button
                    type="button"
                    className="biz-btn biz-btn-ghost"
                    onClick={() => setContactOpen(false)}
                    disabled={contactBusy}
                  >
                    {isHt ? 'Anile' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    className="biz-btn biz-btn-primary"
                    onClick={sendInquiry}
                    disabled={contactBusy || contactSubject.trim().length < 3 || contactBody.trim().length < 10}
                    data-testid="business-inquiry-send"
                  >
                    <i className={`fas ${contactBusy ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} aria-hidden="true" />
                    {t?.business_inquiry_send || (isHt ? 'Voye' : 'Send')}
                  </button>
                </div>
              </div>
            )}

            {user && !contactSent && (
              <div className="biz-inquiry-mine">
                <button
                  type="button"
                  className="biz-btn biz-btn-ghost biz-btn-sm"
                  onClick={() => {
                    setMyInquiriesOpen(!myInquiriesOpen);
                    if (!myInquiriesOpen) loadMyInquiries();
                  }}
                  data-testid="business-inquiry-mine-toggle"
                >
                  <i className="fas fa-inbox" aria-hidden="true" />
                  {t?.business_inquiry_mine || (isHt ? 'Demann mwen yo' : 'My inquiries')}
                </button>
                {myInquiriesOpen && (
                  <div className="biz-inquiry-mine-list" data-testid="business-inquiry-mine-list">
                    {myInquiries.length === 0 ? (
                      <p className="biz-inquiry-mine-empty">
                        {isHt
                          ? 'Ou poko gen demann pou biznis sa a.'
                          : 'You have no inquiries for this business yet.'}
                      </p>
                    ) : myInquiries.map((q) => {
                      const sc = inquiryStatusColor[q.status] || '#94a3b8';
                      return (
                        <div className="biz-inquiry-mine-item" key={q.id}>
                          <div className="biz-inquiry-mine-head">
                            <strong>{q.subject}</strong>
                            <span
                              className="biz-status-pill"
                              style={{
                                background: `${sc}1f`,
                                color: sc,
                                border: `1px solid ${sc}55`,
                              }}
                            >
                              {inquiryStatusLabel(q.status)}
                            </span>
                          </div>
                          <p className="biz-inquiry-mine-meta">
                            <i className="fas fa-user" aria-hidden="true" /> {payload?.name} ·{' '}
                            {new Date(q.created_at).toLocaleDateString(isHt ? 'fr-HT' : 'en-US', {
                              year: 'numeric', month: 'short', day: 'numeric',
                            })}
                          </p>
                          {q.body && <p className="biz-inquiry-mine-body">{q.body}</p>}
                          {q.reply && (
                            <p className="biz-inquiry-mine-reply">
                              <i className="fas fa-reply" aria-hidden="true" /> {q.reply}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Order / pay modal (Phase 5) ─────────────────────── */}
      {orderItem && (
        <div className="biz-modal-overlay" onClick={closeOrder} data-testid="business-order-modal">
          <div className="biz-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="biz-modal-header">
              <h3 className="biz-modal-title">
                <i className="fas fa-cart-shopping" aria-hidden="true" />
                {placedOrder
                  ? (t?.business_order_pay_title || (isHt ? 'Peye kòmand la' : 'Pay for your order'))
                  : (t?.business_order_title || (isHt ? 'Kòmande' : 'Order'))}
              </h3>
              <button type="button" className="biz-modal-close" onClick={closeOrder} aria-label="Close">
                <i className="fas fa-xmark" aria-hidden="true" />
              </button>
            </div>

            {!placedOrder ? (
              <>
                <p className="biz-modal-hint">
                  {orderItem.name} · {Number(orderItem.price ?? 0).toLocaleString(isHt ? 'fr-HT' : 'en-US', { minimumFractionDigits: 2 })}{' '}
                  {orderItem.currency === 'HTG' ? 'G' : (orderItem.currency || 'USD')}
                </p>
                <div className="biz-form">
                  <div className="biz-form-group">
                    <label className="biz-form-label" htmlFor="biz-order-qty">
                      {t?.business_order_quantity || (isHt ? 'Kantite' : 'Quantity')}
                    </label>
                    <input
                      id="biz-order-qty"
                      className="biz-form-input"
                      type="number"
                      min="1"
                      max="100"
                      value={orderQty}
                      onChange={(e) => setOrderQty(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                      data-testid="business-order-qty"
                    />
                  </div>
                  <div className="biz-form-group">
                    <label className="biz-form-label" htmlFor="biz-order-note">
                      {t?.business_order_note || (isHt ? 'Nòt (si gen)' : 'Note (optional)')}
                    </label>
                    <textarea
                      id="biz-order-note"
                      className="biz-form-input"
                      rows="2"
                      maxLength="1000"
                      value={orderNote}
                      onChange={(e) => setOrderNote(e.target.value)}
                      data-testid="business-order-note"
                    />
                  </div>
                  <div className="biz-form-actions">
                    <button type="button" className="biz-btn biz-btn-ghost" onClick={closeOrder} disabled={orderBusy}>
                      {isHt ? 'Anile' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      className="biz-btn biz-btn-primary"
                      onClick={placeOrder}
                      disabled={orderBusy}
                      data-testid="business-order-submit"
                    >
                      <i className={`fas ${orderBusy ? 'fa-spinner fa-spin' : 'fa-check'}`} aria-hidden="true" />
                      {t?.business_order_place || (isHt ? 'Kreye kòmand' : 'Place order')}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="biz-modal-hint">
                  {isHt
                    ? `Kòmand #${placedOrder.id} — ${placedOrder.item_name}`
                    : `Order #${placedOrder.id} — ${placedOrder.item_name}`}
                </p>
                <div className="biz-ws-card" style={{ marginBottom: 14 }}>
                  <p className="biz-ws-card-line">
                    <strong>{isHt ? 'Total:' : 'Total:'}</strong>{' '}
                    {Number(placedOrder.total ?? 0).toLocaleString(isHt ? 'fr-HT' : 'en-US', { minimumFractionDigits: 2 })}{' '}
                    {placedOrder.currency || 'USD'}
                  </p>
                  <p className="biz-ws-card-line">
                    <strong>{isHt ? 'Estati peman:' : 'Payment status:'}</strong>{' '}
                    {placedOrder.payment_status === 'paid'
                      ? (isHt ? 'Peye ✓' : 'Paid ✓')
                      : (isHt ? 'Pa peye' : 'Unpaid')}
                  </p>
                </div>
                {placedOrder.payment_status === 'unpaid' && placedOrder.payable ? (
                  <div className="biz-form-actions">
                    <button type="button" className="biz-btn biz-btn-ghost" onClick={closeOrder} disabled={payBusy}>
                      {isHt ? 'Pita' : 'Later'}
                    </button>
                    <button
                      type="button"
                      className="biz-btn biz-btn-primary"
                      onClick={payOrder}
                      disabled={payBusy}
                      data-testid="business-order-pay"
                    >
                      <i className={`fas ${payBusy ? 'fa-spinner fa-spin' : 'fa-wallet'}`} aria-hidden="true" />
                      {t?.business_order_pay || (isHt ? 'Peye ak Wallet' : 'Pay with Wallet')}
                    </button>
                  </div>
                ) : (
                  <div className="biz-form-actions">
                    <button type="button" className="biz-btn biz-btn-primary" onClick={closeOrder}>
                      {isHt ? 'Fèmen' : 'Done'}
                    </button>
                    <button
                      type="button"
                      className="biz-btn biz-btn-ghost"
                      onClick={() => { closeOrder(); navigate(SHEETS.BUSINESS_MY_ORDERS); }}
                      data-testid="business-order-view-mine"
                    >
                      <i className="fas fa-receipt" aria-hidden="true" />
                      {t?.business_my_orders_short || (isHt ? 'Wè kòmand mwen yo' : 'View my orders')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
