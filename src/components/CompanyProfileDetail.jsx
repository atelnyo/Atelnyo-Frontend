/**
 * src/components/CompanyProfileDetail.jsx
 *
 * Phase Company — dedicated in-app company page.
 *
 * A public, admin-approved company profile page opened from a
 * deep-link (``/company/:slug``) or from the owner's Creator Studio.
 * The page reuses the shared ``cd-page`` / ``[data-detail-sheet]``
 * layout system so the fixed top action bar NEVER overlaps the
 * hero content (same contract as SpotlightDetail + every other
 * detail page opened from Explore).
 *
 * Data flow
 * ---------
 *   API:  GET /api/companies/<slug|id>/  (CompanyPublicSerializer)
 *   Hook: direct fetch on mount (URL-driven — a cold deep-link
 *         always renders the latest approved data)
 *
 * The public payload includes the owner's linked content
 * (approved Spotlight, active products, published portfolio)
 * aggregated server-side — no extra round-trips.
 *
 * Meta tags: Open Graph + Twitter Card via react-helmet-async so a
 * pasted link produces a rich preview (same pattern as Spotlight).
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { translations } from '../data/translations';
import { companyProfileService } from '../services/api';
import { ogImageForLang } from './profile/profileConstants';

function buildOgUrl(slug) {
  const base = window.location.origin || 'https://atelnyo.app';
  return `${base}/company/${encodeURIComponent(slug || '')}`;
}

const OG_IMAGE_FALLBACK =
  'https://via.placeholder.com/1200x630/1e293b/ffffff?text=Atelnyo';

const S = {
  flexCol: { display: 'flex', flexDirection: 'column' },
  flexRow: { display: 'flex', flexDirection: 'row', alignItems: 'center' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
};

function truncateDescription(desc = '', max = 200) {
  if (!desc) return '';
  return desc.length > max ? `${desc.slice(0, max)}…` : desc;
}

/* ─── Small building blocks ─────────────────────────────────────── */

function InfoTile({ icon, label, value, isLink, href }) {
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
      {isLink && href ? (
        <a href={href} target="_blank" rel="noopener noreferrer"
          style={{ color: '#93c5fd', fontSize: '0.9rem', wordBreak: 'break-all', textDecoration: 'none' }}>
          {value}
        </a>
      ) : (
        <div style={{ color: 'rgba(255,255,255,0.92)', fontSize: '0.9rem', wordBreak: 'break-word' }}>
          {value || '—'}
        </div>
      )}
    </div>
  );
}

function LinkedCard({ href, title, sub, image }) {
  return (
    <a href={href} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--cd-surface, #1e293b)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: 12, textDecoration: 'none',
      transition: 'transform .15s ease, border-color .15s ease',
    }} className="company-link-card">
      {image ? (
        <img src={image} alt="" loading="lazy"
          style={{ width: 46, height: 46, borderRadius: 10, objectFit: 'cover', background: 'rgba(255,255,255,0.06)' }} />
      ) : (
        <div style={{
          width: 46, height: 46, borderRadius: 10,
          background: 'linear-gradient(135deg, rgba(216,27,96,.35), rgba(124,58,237,.35))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.8)',
        }}>
          <i className="fas fa-link" aria-hidden="true" />
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ color: 'var(--cd-text, #f1f5f9)', fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </div>
        {sub && (
          <div style={{ color: 'rgba(148,163,184,0.9)', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {sub}
          </div>
        )}
      </div>
      <i className="fas fa-chevron-right" aria-hidden="true"
        style={{ marginLeft: 'auto', color: 'rgba(148,163,184,0.7)', fontSize: '0.75rem' }} />
    </a>
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

/* ─── Hero content ──────────────────────────────────────────────── */

function HeroContent({ payload, t, lang }) {
  return (
    <div style={{ ...S.flexCol, gap: 14 }}>
      <div style={{ ...S.flexRow, gap: 16, flexWrap: 'wrap' }}>
        {/* Logo / avatar */}
        {payload.logo_url ? (
          <img src={payload.logo_url} alt={payload.company_name} loading="lazy"
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
            <i className="fas fa-building" aria-hidden="true" style={{ fontSize: '1.7rem' }} />
          </div>
        )}

        <div style={{ ...S.flexCol, gap: 6, flex: 1, minWidth: 0 }}>
          <div style={{ ...S.flexRow, gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{
              margin: 0, color: '#fff', fontSize: 'clamp(1.4rem, 4.5vw, 2rem)',
              fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em',
            }}>{payload.company_name}</h1>
            {payload.is_verified && (
              <span className="company-verified-badge" data-testid="company-verified-badge"
                title={t.company_profile_verified || 'Verified Company'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'rgba(52,211,153,0.16)', color: '#34d399',
                  border: '1px solid rgba(52,211,153,0.4)',
                  borderRadius: 999, padding: '4px 12px', fontSize: '0.72rem',
                  fontWeight: 700, letterSpacing: '0.04em', alignSelf: 'center',
                }}>
                <i className="fas fa-badge-check" aria-hidden="true" />
                {t.company_profile_verified || (lang === 'ht' ? 'Konpanyi Verifye' : 'Verified Company')}
              </span>
            )}
          </div>
          {payload.tagline && (
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.85)', fontSize: '1rem', fontWeight: 500 }}>
              {payload.tagline}
            </p>
          )}
          {(payload.city || payload.country || payload.website) && (
            <div style={{ ...S.flexRow, gap: 14, flexWrap: 'wrap', fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
              {(payload.city || payload.country) && (
                <span style={{ ...S.flexRow, gap: 6 }}>
                  <i className="fas fa-map-marker-alt" aria-hidden="true" />
                  {[payload.city, payload.country].filter(Boolean).join(', ')}
                </span>
              )}
              {payload.website && (
                <a href={payload.website} target="_blank" rel="noopener noreferrer"
                  style={{ ...S.flexRow, gap: 6, color: 'rgba(147,197,253,0.95)', textDecoration: 'none' }}>
                  <i className="fas fa-globe" aria-hidden="true" />
                  {payload.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────── */

export default function CompanyProfileDetail({ lang = 'ht', showToast }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const t = translations?.[lang] || translations?.ht || {};

  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errCode, setErrCode] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      mounted.current = false;
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrCode(null);
    (async () => {
      try {
        const res = await companyProfileService.get(slug);
        if (!cancelled && mounted.current) {
          const p = res?.data?.data ?? res?.data ?? null;
          setPayload(p);
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
    companyProfileService.getSEO(payload.id)
      .then((res) => {
        if (!cancelled && res?.data?.status === 'ready') setCiSeo(res.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [payload?.id]);

  const handleBack = () => navigate('/');

  const handleShare = async () => {
    const url = window.location.href;
    if (shareBusy) return;
    setShareBusy(true);
    try {
      if (navigator.share) {
        try {
          await navigator.share({
            title: payload?.company_name || 'Company',
            text: payload?.tagline || payload?.description?.slice(0, 120) || '',
            url,
          });
          return;
        } catch {
          // user cancelled → fall through to clipboard
        }
      }
      await navigator.clipboard.writeText(url);
      if (showToast) showToast(t.company_profile_share || (lang === 'ht' ? 'Lyen kopye!' : 'Link copied!'));
    } catch {
      // clipboard unavailable — nothing to do
    } finally {
      setShareBusy(false);
    }
  };

  const pageTitle = payload?.company_name
    ? (t.company_profile_meta_title || '{name} · Company · Atelnyo').replace('{name}', payload.company_name)
    : 'Company · Atelnyo';
  const ogUrl = buildOgUrl(slug);
  // (og:locale is owned by App.jsx's global <Helmet> — see Helmet below.)

  const socialLinks = Array.isArray(payload?.social_links) ? payload.social_links : [];
  const team = Array.isArray(payload?.team_members) ? payload.team_members : [];
  const offerings = Array.isArray(payload?.products_services) ? payload.products_services : [];
  const linkedSpotlight = Array.isArray(payload?.linked_spotlight) ? payload.linked_spotlight : [];
  const linkedProducts = Array.isArray(payload?.linked_products) ? payload.linked_products : [];
  const linkedPortfolio = Array.isArray(payload?.linked_portfolio) ? payload.linked_portfolio : [];

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

      <div className="cd-page" data-detail-sheet data-company-page
        data-testid="company-detail-sheet" data-company-slug={slug || ''} data-lang={lang}>

        {/* ─── Sticky action bar (Back / Share) ────────────────── */}
        <header className={`cd-sticky-header${scrolled ? ' cd-sticky-header--scrolled' : ''}`}>
          <div className="cd-sticky-header-inner">
            <button type="button" className="cd-header-back" onClick={handleBack}
              aria-label={t.company_profile_back || (lang === 'ht' ? 'Retounen' : 'Back')}
              data-testid="company-detail-back-btn">
              <i className="fas fa-arrow-left" aria-hidden="true" />
            </button>
            <span className={`cd-header-title${scrolled ? ' cd-header-title--visible' : ''}`}>
              {payload?.company_name || (t.company_profile || 'Company')}
            </span>
            <div className="cd-header-actions">
              <button type="button" className="cd-header-action-btn" onClick={handleShare}
                disabled={shareBusy}
                aria-label={t.company_profile_share || (lang === 'ht' ? 'Pataje' : 'Share')}
                title={t.company_profile_share || (lang === 'ht' ? 'Pataje' : 'Share')}>
                <i className="fas fa-share-alt" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        {/* ─── Hero ────────────────────────────────────────────── */}
        <section className="cd-hero">
          <div className="cd-hero-fallback">
            <div className="cd-hero-fallback-grad" style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #1e293b 100%)',
            }} />
          </div>

          <div className="cd-hero-content cd-hero-content--loaded">
            {loading ? (
              <div style={{ ...S.flexCol, alignItems: 'center', gap: 16, padding: '20px 0', color: 'rgba(255,255,255,0.7)' }}
                role="status" aria-live="polite" data-testid="company-detail-loading">
                <div style={{
                  width: 88, height: 88, borderRadius: 22,
                  background: 'rgba(255,255,255,0.08)', border: '3px solid rgba(255,255,255,0.12)',
                  animation: 'pulse 2s infinite ease-in-out',
                }} />
                <div style={{ width: 160, height: 14, borderRadius: 6, background: 'rgba(255,255,255,0.10)', animation: 'pulse 2s infinite ease-in-out' }} />
                <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>
                  {lang === 'ht' ? 'Ap chaje paj konpanyi a...' : 'Loading company page...'}
                </span>
              </div>
            ) : errCode === 'not_found' ? (
              <HeroEmptyMessage
                icon="fa-building-circle-exclamation"
                msg={t.company_profile_not_found || (lang === 'ht' ? 'Paj sa pa egziste oswa li poko apwouve.' : 'Not found or not approved yet.')}
              />
            ) : errCode === 'load_error' ? (
              <HeroEmptyMessage
                icon="fa-triangle-exclamation"
                msg={lang === 'ht' ? 'Nou pa t kapab chaje paj la.' : 'Could not load this page.'}
              />
            ) : payload ? (
              <HeroContent payload={payload} t={t} lang={lang} />
            ) : (
              <HeroEmptyMessage icon="fa-building" msg="—" />
            )}
          </div>
        </section>

        {/* ─── Body ────────────────────────────────────────────── */}
        {payload && !loading && !errCode && (
          <div className="cd-body">
            <div className="cd-body-inner">

              {/* ─── About ──────────────────────────────────── */}
              {payload.description && (
                <section className="cd-section" data-testid="company-about-section">
                  <h2 className="cd-section-title">
                    <i className="fas fa-circle-info" aria-hidden="true" />
                    {t.company_profile_about || (lang === 'ht' ? 'Apwopo' : 'About')}
                  </h2>
                  <p className="cd-text" style={{ whiteSpace: 'pre-wrap' }}>{payload.description}</p>
                </section>
              )}

              {/* ─── Location / contact grid ─────────────────── */}
              {(payload.country || payload.city || payload.website || socialLinks.length > 0) && (
                <section className="cd-section">
                  <h2 className="cd-section-title">
                    <i className="fas fa-building" aria-hidden="true" />
                    {lang === 'ht' ? 'Enfòmasyon' : 'Information'}
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                    {(payload.country || payload.city) && (
                      <InfoTile
                        icon="fa-map-marker-alt"
                        label={lang === 'ht' ? 'Kote' : 'Location'}
                        value={[payload.city, payload.country].filter(Boolean).join(', ')}
                      />
                    )}
                    {payload.website && (
                      <InfoTile
                        icon="fa-globe"
                        label={lang === 'ht' ? 'Sit wèb' : 'Website'}
                        value={payload.website.replace(/^https?:\/\//, '')}
                        isLink href={payload.website}
                      />
                    )}
                    {socialLinks.map((s, i) => (
                      <InfoTile
                        key={`${s.platform}-${i}`}
                        icon="fa-share-nodes"
                        label={s.platform || `#${i + 1}`}
                        value={(s.url || '').replace(/^https?:\/\//, '')}
                        isLink href={s.url}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* ─── Team ────────────────────────────────────── */}
              {team.length > 0 && (
                <section className="cd-section" data-testid="company-team-section">
                  <h2 className="cd-section-title">
                    <i className="fas fa-users" aria-hidden="true" />
                    {t.company_profile_team || (lang === 'ht' ? 'Ekip nou' : 'Our team')}
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                    {team.map((m, i) => (
                      <div key={`${m.name}-${i}`} className="company-team-card" style={{
                        background: 'var(--cd-surface, #1e293b)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 14, padding: 16,
                      }}>
                        <div style={{ ...S.flexRow, gap: 10 }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                            background: 'linear-gradient(135deg, #d81b60, #7c3aed)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                          }}>
                            {(m.name || '?').slice(0, 1).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: 'var(--cd-text, #f1f5f9)', fontWeight: 600, fontSize: '0.9rem' }}>{m.name}</div>
                            {m.role && <div style={{ color: 'rgba(148,163,184,0.9)', fontSize: '0.78rem' }}>{m.role}</div>}
                          </div>
                        </div>
                        {m.bio && (
                          <p style={{ margin: '10px 0 0', color: 'rgba(148,163,184,0.85)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                            {m.bio}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ─── Products & Services ─────────────────────── */}
              {offerings.length > 0 && (
                <section className="cd-section" data-testid="company-offerings-section">
                  <h2 className="cd-section-title">
                    <i className="fas fa-box-open" aria-hidden="true" />
                    {t.company_profile_offerings || (lang === 'ht' ? 'Pwodwi & Sèvis' : 'Products & Services')}
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                    {offerings.map((o, i) => (
                      <div key={`${o.title}-${i}`} className="company-offering-card" style={{
                        background: 'var(--cd-surface, #1e293b)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 14, padding: 16,
                      }}>
                        <div style={{ ...S.flexRow, gap: 10 }}>
                          <i className={`fas ${o.icon || 'fa-cube'}`} aria-hidden="true"
                            style={{ color: '#f472b6', fontSize: '1.1rem', width: 22, textAlign: 'center' }} />
                          <div style={{ color: 'var(--cd-text, #f1f5f9)', fontWeight: 600, fontSize: '0.92rem' }}>{o.title}</div>
                        </div>
                        {o.description && (
                          <p style={{ margin: '10px 0 0', color: 'rgba(148,163,184,0.85)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                            {o.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ─── Linked content ──────────────────────────── */}
              {(linkedSpotlight.length > 0 || linkedProducts.length > 0 || linkedPortfolio.length > 0) && (
                <section className="cd-section" data-testid="company-linked-section">
                  <h2 className="cd-section-title">
                    <i className="fas fa-folder-open" aria-hidden="true" />
                    {t.company_profile_linked || (lang === 'ht' ? 'Kontni Konpanyi' : 'Company Content')}
                  </h2>

                  {linkedSpotlight.length > 0 && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.8)', marginBottom: 10 }}>
                        {t.company_profile_linked_spotlight || (lang === 'ht' ? 'Envansyon Spotlight' : 'Spotlight Inventions')}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                        {linkedSpotlight.map((s) => (
                          <LinkedCard
                            key={s.id}
                            href={`/sheet/spotlight/${s.id}`}
                            title={s.title}
                            sub={s.category || ''}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {linkedProducts.length > 0 && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.8)', marginBottom: 10 }}>
                        {t.company_profile_linked_products || (lang === 'ht' ? 'Pwodwi' : 'Products')}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                        {linkedProducts.map((p) => (
                          <LinkedCard
                            key={p.id}
                            href={`/marketplace/${p.slug}`}
                            title={p.title}
                            sub={`${p.currency || 'USD'} ${p.price}`}
                            image={p.image_url}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {linkedPortfolio.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.8)', marginBottom: 10 }}>
                        {t.company_profile_linked_portfolio || (lang === 'ht' ? 'Pòtfolyo' : 'Portfolio')}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                        {linkedPortfolio.map((pr) => (
                          <LinkedCard
                            key={pr.id}
                            href={`/portfolio/${pr.slug}`}
                            title={pr.title}
                            sub={pr.difficulty || ''}
                            image={pr.cover_url}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* ─── Owner credit ────────────────────────────── */}
              {payload.username && (
                <div style={{ textAlign: 'center', padding: '8px 0 28px' }}>
                  <span style={{ color: 'rgba(148,163,184,0.75)', fontSize: '0.8rem' }}>
                    © {new Date().getFullYear()} {payload.company_name} · Atelnyo
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
