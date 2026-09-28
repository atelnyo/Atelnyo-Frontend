/**
 * src/components/explore/TalentSheet.jsx
 *
 * Phase 18 — Talent detail sheet for the Explore catalog.
 * Enhanced 2026-07-30: INC-style pwofil ak creator profile fetching
 * (linked_username), info grid, social links, stats badges.
 *
 * Layout: cd-page → cd-hero → cd-body (creator-card, bio, info grid,
 * skills, social links, contact, created-by).
 */
import React, { useEffect, useState, useCallback } from 'react';
import useSafeNavigate from '../../hooks/useSafeNavigate';
import { Navigate, useLocation } from 'react-router-dom';
import { translations } from '../../data/translations';
import { recentService, savedTalentsService, savedItemService, creatorProfileService, talentService } from '../../services/api';
import SaveHeartButton from '../SaveHeartButton';
import { buildContentUrl, buildContentShareUrl, isLegacyContentUrl } from '../../utils/contentUrl';
import SEOHead, { talentSchema } from '../shared/SEOHead';
import { t2 } from '../../utils/i18n';

function formatDate(iso, lang) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(
      t2(lang, { ht: 'fr-HT', fr: 'fr-FR', es: 'es-ES', en: 'en-US' }),
      { year: 'numeric', month: 'short', day: 'numeric' },
    );
  } catch (_) {
    return '';
  }
}

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
};

export function TalentSheet({ lang = 'ht', showToast, user, contentId }) {
  const location = useLocation();
  const navigate = useSafeNavigate();
  const t = translations?.[lang] || translations?.ht || {};
  const stateTalent = location.state?.talent;
  // Fallback id from the URL (contentId from the /{id}@{user}/talent
  // deep-link, or the legacy ?id= query) so a hard refresh (no router
  // state) re-fetches instead of bouncing the visitor to the home page.
  const urlId = Number(new URLSearchParams(location.search).get('id')) || null;
  const detailId = contentId ?? urlId;
  const [talent, setTalent] = useState(stateTalent || null);
  const [loadFailed, setLoadFailed] = useState(false);

  // ─── Canonical URL upgrade: legacy /sheet/explore/talent(?id=)
  //     redirects (replace) to /{id}@{user}/talent once loaded. ──────
  useEffect(() => {
    if (!talent?.id) return;
    if (!isLegacyContentUrl('talent', location.pathname)) return;
    navigate(buildContentUrl('talent', talent), { replace: true });
  }, [talent?.id, location.pathname, navigate]);

  // ─── ALL hooks go BEFORE any conditional return (Rules of Hooks) ──
  const [isSaved, setIsSaved] = useState(false);
  const [saveCount, setSaveCount] = useState(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [creatorProfile, setCreatorProfile] = useState(null);
  const [creatorLoading, setCreatorLoading] = useState(false);
  const [creatorAvatarFailed, setCreatorAvatarFailed] = useState(false);

  // ─── Re-fetch by id when no state was passed (deep link / refresh) ──
  useEffect(() => {
    if (stateTalent || !detailId) return;
    let cancelled = false;
    setLoadFailed(false);
    talentService.get(detailId)
      .then((res) => { if (!cancelled) setTalent(res?.data || null); })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, [stateTalent, detailId]);

  // ─── Content Intelligence SEO data ─────────────────────────────
  const [ciSeo, setCiSeo] = useState(null);
  useEffect(() => {
    if (!talent?.id) return;
    let cancelled = false;
    talentService.getSEO(talent.id)
      .then((res) => {
        if (!cancelled && res?.data?.status === 'ready') setCiSeo(res.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [talent?.id]);

  useEffect(() => {
    if (!user || !talent?.id) return;
    let cancelled = false;
    savedTalentsService.isSaved(talent.id)
      .then((saved) => { if (!cancelled) setIsSaved(saved); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, talent?.id]);

  // ─── Total saves badge (public count) ─────────────────────────────
  useEffect(() => {
    if (!talent?.id) return;
    let cancelled = false;
    savedItemService.count('talent', talent.id)
      .then((c) => { if (!cancelled) setSaveCount(c); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [talent?.id]);

  const handleToggleSave = useCallback(async () => {
    if (!user) {
      showToast?.(t.mwen_signin_required || 'Sign in to save', 'user-lock');
      return;
    }
    if (saveBusy || !talent?.id) return;
    setSaveBusy(true);
    const wasSaved = isSaved;
    setIsSaved(!wasSaved);
    setSaveCount((c) => (c == null ? c : Math.max(0, c + (wasSaved ? -1 : 1))));
    try {
      if (wasSaved) await savedTalentsService.remove(talent.id);
      else await savedTalentsService.create(talent.id);
      // Re-sync the badge with the authoritative count.
      savedItemService.count('talent', talent.id)
        .then((c) => setSaveCount(c))
        .catch(() => {});
    } catch (e) {
      setIsSaved(wasSaved);
      setSaveCount((c) => (c == null ? c : Math.max(0, c + (wasSaved ? 1 : -1))));
      showToast?.(t.mwen_unsave_error || 'Could not save. Try again.', 'circle-exclamation');
    } finally {
      setSaveBusy(false);
    }
  }, [isSaved, saveBusy, talent?.id, user, showToast, t]);

  // ─── Share: copy the canonical /{id}@{user}/talent deep-link ──────
  const handleShare = useCallback(async () => {
    if (!talent?.id) return;
    const url = buildContentShareUrl('talent', talent);
    if (navigator.share) {
      try {
        await navigator.share({ title: talent.name || 'Talent', url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast?.(t.share_link_copied || (t2(lang, { ht: 'Lyen kopye!', fr: 'Lien copié !', es: '¡Enlace copiado!', en: 'Link copied!' })), 'check-circle');
    } catch {
      // Clipboard not available — nothing else to do.
    }
  }, [talent, showToast, t, lang]);

  // ─── Fetch creator profile by linked_username ───────────────────
  useEffect(() => {
    if (!talent?.linked_username) return;
    setCreatorLoading(true);
    creatorProfileService.get(talent.linked_username)
      .then((res) => {
        setCreatorProfile(res?.data || null);
      })
      .catch(() => {})
      .finally(() => setCreatorLoading(false));
  }, [talent?.linked_username]);

  // ─── Scroll detection ──────────────────────────────────────────
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // ─── Recent-view tracking ───────────────────────────────────────
  useEffect(() => {
    if (!talent?.id) return;
    recentService.track('talent', talent.id);
  }, [talent?.id]);

  // Public creator profile lives at /creator/:username (Phase 54 route;
  // the /@:username alias was removed — React Router v6 can't match the
  // @ char in path patterns). Rules of Hooks: this useCallback MUST sit
  // before the early returns below — otherwise the loading branch runs
  // fewer hooks and React #310 crashes every deep-link visit.
  const handleViewProfile = useCallback(() => {
    if (!talent?.linked_username) return;
    navigate(`/creator/${encodeURIComponent(talent.linked_username)}`);
  }, [talent?.linked_username, navigate]);

  // No talent AND no id to fetch -> bounce home.
  if (!talent && !detailId) {
    return <Navigate to="/" replace />;
  }
  // Deep link with an id that failed to load — show a recoverable
  // message instead of a silent bounce.
  if (!talent && loadFailed) {
    return (
      <div className="cd-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 24, textAlign: 'center' }}>
        <div>
          <i className="fas fa-user-slash" style={{ fontSize: '2.5rem', color: 'var(--cd-text-secondary, #64748b)', marginBottom: 12, opacity: 0.5 }} />
          <p style={{ margin: '0 0 16px', color: 'var(--cd-text, #1e293b)' }}>
            {t.explore_not_found || (t2(lang, { ht: 'Talan sa a pa disponib.', fr: 'Ce talent n\'est pas disponible.', es: 'Este talento no está disponible.', en: 'This talent is not available.' }))}
          </p>
          <button type="button" onClick={() => navigate(-1)}
            style={{ padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'var(--cd-primary, #2563eb)', color: '#fff', fontWeight: 700, fontFamily: 'inherit' }}>
            {t.common_back || 'Back'}
          </button>
        </div>
      </div>
    );
  }
  // Deep link still loading (no state, id present, fetch in flight).
  if (!talent) {
    return (
      <div className="cd-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--cd-primary, #2563eb)' }} />
      </div>
    );
  }

  const avatar = talent.avatar || talent.avatar_url || '';
  const hasEmail = Boolean(talent.contact_email);
  const hasUrl = Boolean(talent.contact_url);
  const handleBack = () => navigate(-1);

  return (
    <div className="cd-page" data-detail-sheet data-talent-sheet>
      <SEOHead
        title={ciSeo?.title || talent.name}
        description={ciSeo?.description || talent.bio || `${talent.name} — ${talent.role || 'Talent'}`}
        image={ciSeo?.og_image || talent.image_url}
        url={talent ? buildContentUrl('talent', talent) : '/sheet/explore/talent'}
        type="profile"
        schema={ciSeo?.structured_data && Object.keys(ciSeo.structured_data).length > 1 ? ciSeo.structured_data : talentSchema(talent)}
        lang={lang}
        keywords={[...(ciSeo?.keywords || []), talent.name, talent.role, talent.location].filter(Boolean)}
      />
      {/* ─── Sticky Header ── */}
      <header className={`cd-sticky-header${scrolled ? ' cd-sticky-header--scrolled' : ''}`}>
        <div className="cd-sticky-header-inner">
          <button type="button" onClick={handleBack}
            aria-label={t.common_back || 'Back'} className="cd-header-back">
            <i className="fas fa-arrow-left" aria-hidden="true" />
          </button>
          <span className={`cd-header-title${scrolled ? ' cd-header-title--visible' : ''}`}>
            {talent.name || (t.explore_sheet_talent_title || 'Talent details')}
          </span>
          <div className="cd-header-actions">
            <button type="button" onClick={handleShare}
              disabled={!talent}
              aria-label={t.share_talent || 'Share'}
              title={t.share_talent || 'Share'}
              className="cd-header-action-btn">
              <i className="fas fa-share-alt" aria-hidden="true" />
            </button>
            <SaveHeartButton
              className="cd-header-action-btn"
              isSaved={isSaved}
              saveBusy={saveBusy}
              saveCount={saveCount}
              onToggle={handleToggleSave}
              t={t}
            />
          </div>
        </div>
      </header>

      {/* ─── Hero — gradient + centered avatar ────────────────────── */}
      <section className="cd-hero cd-hero--talent">
        <div className="cd-hero-fallback">
          <div className="cd-hero-fallback-grad" style={{
            background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 50%, #2563eb 100%)',
          }} />
        </div>

        <div className="cd-hero-content cd-hero-content--loaded" style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', textAlign: 'center', padding: '8px 24px 40px',
          transform: 'none', opacity: 1,
        }}>
          <div>
            <div style={{ display: 'inline-block', position: 'relative', marginBottom: 20 }}>
              <div style={{
                width: 140, height: 140, borderRadius: '50%', padding: 4,
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                boxShadow: '0 8px 30px rgba(37,99,235,0.25)',
              }}>
                <img
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', background: '#fff' }}
                  src={avatar}
                  alt={talent.name || 'Talent avatar'}
                  onError={(e) => {
                    e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(talent.name || '?')}&background=2563eb&color=ffffff&size=256`;
                  }}
                />
              </div>
              {talent.is_featured && (
                <div style={{
                  position: 'absolute', bottom: 4, right: -4,
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 50, fontSize: '0.75rem', fontWeight: 700,
                  background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#fff',
                  boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
                }}>
                  <i className="fas fa-star" aria-hidden="true" />
                  <span>{t.explore_chip_featured || 'Featured'}</span>
                </div>
              )}
            </div>
            <h1 className="cd-hero-title" style={{ fontSize: '2rem', margin: '0 0 6px' }}>
              {talent.name}
            </h1>
            {talent.role && (
              <p style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.9)', fontWeight: 600, margin: '0 0 8px' }}>
                {talent.role}
              </p>
            )}
            {talent.location && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
                <i className="fas fa-map-marker-alt" aria-hidden="true" />
                <span>{talent.location}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── Body — INC-style cards ───────────────────────────────── */}
      <div className="cd-body">
        <div className="cd-body-inner">
          {/* ─── Creator Card ─────────────────────────────────── */}
          {creatorProfile && (
            <div className="cd-creator-card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', top: 0, right: 0, width: 120, height: '100%',
                background: 'linear-gradient(135deg, transparent 40%, rgba(37,99,235,0.05) 100%)',
                pointerEvents: 'none',
              }} />
              {creatorProfile.avatar_url && !creatorAvatarFailed ? (
                <img src={creatorProfile.avatar_url} alt={creatorProfile.display_name || 'Creator'}
                  style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover',
                    flexShrink: 0, boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}
                  onError={() => setCreatorAvatarFailed(true)}
                />
              ) : (
                <div className="cd-creator-avatar">
                  <i className="fas fa-user" />
                </div>
              )}
              <div className="cd-creator-info" style={{ flex: 1 }}>
                <span className="cd-creator-label">
                  {t2(lang, { ht: 'Kreyatè', fr: 'Créateur', es: 'Creador', en: 'Creator' })}
                  {creatorProfile.is_verified && (
                    <i className="fas fa-check-circle" style={{ marginLeft: 4, color: '#3b82f6', fontSize: '0.7rem' }} />
                  )}
                  {talent.is_featured && (
                    <span style={{
                      marginLeft: 6, padding: '1px 8px', borderRadius: 50, fontSize: '0.6rem',
                      fontWeight: 700, background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#fff',
                      textTransform: 'uppercase',
                    }}>
                      FEATURED
                    </span>
                  )}
                </span>
                <span className="cd-creator-name">
                  {creatorProfile.display_name || creatorProfile.artist_name || talent.name}
                </span>
                {talent.linked_username && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--cd-text-secondary, #64748b)' }}>
                    @{talent.linked_username}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ─── View Profile CTA — keyed off linked_username alone so it
             always renders for linked talents, even when the
             creator-profiles fetch fails or 404s. ────────────── */}
          {talent.linked_username && (
            <button
              type="button"
              onClick={handleViewProfile}
              style={{
                ...S.flexRow, gap: 8, width: '100%', justifyContent: 'center', cursor: 'pointer',
                padding: '12px 16px', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                color: '#fff', fontWeight: 700, fontSize: '0.9rem',
                fontFamily: 'inherit', transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 22px rgba(37,99,235,0.35)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 14px rgba(37,99,235,0.25)'; }}
              aria-label={t2(lang, { ht: 'Gade pwofil kreyatè a', fr: 'Voir le profil du créateur', es: 'Ver perfil del creador', en: 'View creator profile' })}
            >
              <i className="fas fa-user" aria-hidden="true" />
              <span>{t2(lang, { ht: 'Gade Pwofil', fr: 'Voir le profil', es: 'Ver perfil', en: 'View Profile' })}</span>
            </button>
          )}

          {/* ─── Bio ────────────────────────────────────────────── */}
          {talent.bio && (
            <section className="cd-section">
              <h2 className="cd-section-title">
                <i className="fas fa-info-circle" aria-hidden="true" />
                {t.explore_bio_label || 'About'}
              </h2>
              <p className="cd-text" style={{ whiteSpace: 'pre-wrap' }}>{talent.bio}</p>
            </section>
          )}

          {/* ─── Info Grid ───────────────────────────────────────── */}
          {(talent.created_at || talent.is_new || talent.is_featured || talent.linked_username) && (
            <section className="cd-section">
              <h2 className="cd-section-title">
                <i className="fas fa-building" aria-hidden="true" />
                {t2(lang, { ht: 'Enfòmasyon', fr: 'Informations', es: 'Información', en: 'Information' })}
              </h2>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16,
              }}>
                {talent.location && (
                  <InfoTile icon="fa-map-marker-alt"
                    label={t2(lang, { ht: 'Kote', fr: 'Lieu', es: 'Ubicación', en: 'Location' })} value={talent.location} />
                )}
                {talent.created_at && (
                  <InfoTile icon="fa-calendar"
                    label={t2(lang, { ht: 'Kreye', fr: 'Créé', es: 'Creado', en: 'Created' })} value={formatDate(talent.created_at, lang)} />
                )}
                {talent.linked_username && (
                  <InfoTile icon="fa-user"
                    label={t2(lang, { ht: 'Kreyatè', fr: 'Créateur', es: 'Creador', en: 'Creator' })} value={`@${talent.linked_username}`} />
                )}
                {talent.role && (
                  <InfoTile icon="fa-briefcase"
                    label={t2(lang, { ht: 'Wòl', fr: 'Rôle', es: 'Rol', en: 'Role' })} value={talent.role} />
                )}
              </div>
            </section>
          )}

          {/* ─── Badges / Stats ──────────────────────────────────── */}
          {(talent.is_new || talent.is_featured || talent.is_active) && (
            <section className="cd-section">
              <h2 className="cd-section-title">
                <i className="fas fa-trophy" aria-hidden="true" />
                {t2(lang, { ht: 'Estatistik', fr: 'Statistiques', es: 'Estadísticas', en: 'Stats' })}
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {talent.is_new && (
                  <BadgeChip icon="fa-bolt" label={t2(lang, { ht: 'Nouvo', fr: 'Nouveau', es: 'Nuevo', en: 'New' })} color="#10b981" />
                )}
                {talent.is_featured && (
                  <BadgeChip icon="fa-star" label={t2(lang, { ht: 'Rekòmande', en: 'Featured' })} color="#f59e0b" />
                )}
                {talent.is_active && (
                  <BadgeChip icon="fa-circle" label={t2(lang, { ht: 'Aktif', en: 'Active' })} color="#22c55e" pulse />
                )}
              </div>
            </section>
          )}

          {/* ─── Skills ──────────────────────────────────────────── */}
          {Array.isArray(talent.skills) && talent.skills.length > 0 && (
            <section className="cd-section">
              <h2 className="cd-section-title">
                <i className="fas fa-cogs" aria-hidden="true" />
                {t.explore_skills_label || 'Skills'}
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {talent.skills.map((s) => (
                  <span key={s} style={{
                    display: 'inline-block', padding: '6px 16px', borderRadius: 50,
                    background: 'var(--cd-primary-light, #dbeafe)',
                    color: 'var(--cd-primary, #2563eb)',
                    fontSize: '0.85rem', fontWeight: 600,
                    transition: 'all 0.2s ease', cursor: 'default',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(37,99,235,0.2)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                  >{s}</span>
                ))}
              </div>
            </section>
          )}

          {/* ─── Creator Bio (from profile) ───────────────────────── */}
          {creatorProfile?.bio && (
            <section className="cd-section">
              <h2 className="cd-section-title">
                <i className="fas fa-user" aria-hidden="true" />
                {t2(lang, { ht: 'Apwopo Kreyatè a', en: 'About the Creator' })}
              </h2>
              <p className="cd-text">{creatorProfile.bio}</p>
            </section>
          )}

          {/* ─── Social Links (from profile) ──────────────────────── */}
          {creatorProfile?.social_links && Object.keys(creatorProfile.social_links).length > 0 && (
            <section className="cd-section">
              <h2 className="cd-section-title">
                <i className="fas fa-share-alt" aria-hidden="true" />
                {t2(lang, { ht: 'Rezo Sosyo', en: 'Social Links' })}
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {Object.entries(creatorProfile.social_links).map(([platform, url]) => {
                  if (!url) return null;
                  const icon = platform === 'github' ? 'fa-github'
                    : platform === 'twitter' ? 'fa-twitter'
                    : platform === 'linkedin' ? 'fa-linkedin-in'
                    : platform === 'youtube' ? 'fa-youtube'
                    : platform === 'instagram' ? 'fa-instagram'
                    : 'fa-link';
                  const color = platform === 'github' ? '#333'
                    : platform === 'twitter' ? '#1DA1F2'
                    : platform === 'linkedin' ? '#0A66C2'
                    : platform === 'youtube' ? '#FF0000'
                    : platform === 'instagram' ? '#E4405F'
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

          {/* ─── Contact ──────────────────────────────────────────── */}
          {hasEmail || hasUrl ? (
            <div className="cd-price-card">
              <div className="cd-price-card-header">
                <div className="cd-price-card-info">
                  <span className="cd-price-label">
                    <i className="fas fa-paper-plane" aria-hidden="true" style={{ marginRight: 6 }} />
                    {t.explore_contact_label || 'Contact'}
                  </span>
                  {talent.created_at && (
                    <span style={{ fontSize: '0.82rem', color: 'var(--cd-text-secondary, #64748b)', marginTop: 2 }}>
                      <i className="fas fa-calendar" style={{ fontSize: '0.7rem', marginRight: 4, opacity: 0.5 }} />
                      {formatDate(talent.created_at, lang)}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                {hasEmail && (
                  <a href={`mailto:${talent.contact_email}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                      borderRadius: 12, background: 'var(--cd-surface, #fff)',
                      border: '1px solid var(--cd-border, #e2e8f0)',
                      textDecoration: 'none', transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--cd-shadow-lg, 0 10px 25px rgba(0,0,0,0.08))'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                  >
                    <span style={{
                      width: 44, height: 44, borderRadius: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: '#dbeafe', color: '#2563eb', fontSize: '1.1rem', flexShrink: 0,
                    }}>
                      <i className="fas fa-envelope" aria-hidden="true" />
                    </span>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--cd-text, #1e293b)' }}>
                        {t.explore_contact_email || 'Send email'}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--cd-text-secondary, #64748b)' }}>
                        {talent.contact_email}
                      </span>
                    </div>
                    <i className="fas fa-chevron-right" style={{ fontSize: '0.85rem', color: 'var(--cd-text-secondary, #64748b)' }} aria-hidden="true" />
                  </a>
                )}
                {hasUrl && (
                  <a href={talent.contact_url} target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                      borderRadius: 12, background: 'var(--cd-surface, #fff)',
                      border: '1px solid var(--cd-border, #e2e8f0)',
                      textDecoration: 'none', transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--cd-shadow-lg, 0 10px 25px rgba(0,0,0,0.08))'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                  >
                    <span style={{
                      width: 44, height: 44, borderRadius: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: '#ede9fe', color: '#7c3aed', fontSize: '1.1rem', flexShrink: 0,
                    }}>
                      <i className="fas fa-globe" aria-hidden="true" />
                    </span>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--cd-text, #1e293b)' }}>
                        {t.explore_visit_website || 'Visit website'}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--cd-text-secondary, #64748b)' }}>
                        {new URL(talent.contact_url).hostname}
                      </span>
                    </div>
                    <i className="fas fa-external-link-alt" style={{ fontSize: '0.85rem', color: 'var(--cd-text-secondary, #64748b)' }} aria-hidden="true" />
                  </a>
                )}
              </div>
              {creatorProfile?.contact_email && (
                <p className="cd-price-disclaimer" style={{ marginTop: 12 }}>
                  <i className="fas fa-envelope" style={{ marginRight: 4, opacity: 0.5 }} />
                  {creatorProfile.contact_email}
                </p>
              )}
            </div>
          ) : (
            <div className="cd-price-card">
              <div className="cd-price-card-header">
                <div className="cd-price-card-info">
                  <span className="cd-price-label">
                    <i className="fas fa-paper-plane" aria-hidden="true" style={{ marginRight: 6 }} />
                    {t.explore_contact_label || 'Contact'}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--cd-text-secondary, #64748b)' }}>
                <i className="fas fa-user-slash" style={{ fontSize: '2rem', marginBottom: 8, opacity: 0.4 }} aria-hidden="true" />
                <p style={{ margin: 0, fontSize: '0.9rem' }}>{t.explore_no_contact || 'No contact info yet'}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Scroll-to-top ─────────────────────────────────── */}
      {scrolled && (
        <button type="button" className="cd-scroll-top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label={t2(lang, { ht: 'Retounen anwo', en: 'Back to top' })}>
          <i className="fas fa-arrow-up" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// INFO TILE
// ═══════════════════════════════════════════════════════════════════════
function InfoTile({ icon, label, value, isLink, href }) {
  const content = (
    <div style={{
      ...S.flexCol, gap: 6, padding: '16px 18px', borderRadius: 12,
      background: 'var(--cd-surface, #fff)', border: '1px solid var(--cd-border, #e2e8f0)',
      transition: 'box-shadow 0.2s ease', height: '100%', boxSizing: 'border-box',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--cd-shadow-lg, 0 10px 25px rgba(0,0,0,0.08))'; }}
    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; }}>
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
// BADGE CHIP
// ═══════════════════════════════════════════════════════════════════════
function BadgeChip({ icon, label, color, pulse }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '8px 16px', borderRadius: 50, fontSize: '0.85rem', fontWeight: 700,
      background: `${color}15`, color,
      animation: pulse ? 'pulse 2s infinite ease-in-out' : undefined,
    }}>
      <i className={`fas ${icon}`} style={{ fontSize: '0.75rem' }} aria-hidden="true" />
      {label}
    </div>
  );
}

export default TalentSheet;
