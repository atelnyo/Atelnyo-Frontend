/**
 * src/components/explore/MusicSheet.jsx
 *
 * Phase 18 — Music detail sheet for the Explore catalog.
 * Refactored 2026-07-30: Menm layout ak CourseDetail (cd-page,
 * cd-sticky-header, cd-hero, cd-section, cd-price-card) pou UI/UX
 * egzakteman menm jan ak kou a, men ak idantite Music.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import useSafeNavigate from '../../hooks/useSafeNavigate';
import { Navigate, useLocation } from 'react-router-dom';
import api, { musicService, recentService, savedMusicService, savedItemService } from '../../services/api';
import SaveHeartButton from '../SaveHeartButton';
import { translations } from '../../data/translations';
import { buildContentUrl, buildContentShareUrl, isLegacyContentUrl } from '../../utils/contentUrl';
import { resolveVideoSource } from '../../modules/explore/utils/videoSource';
import SEOHead, { musicSchema } from '../shared/SEOHead';
import { t2 } from '../../utils/i18n';

function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

function formatPlays(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function MusicSheet({ lang = 'ht', showToast, user, contentId, track: initialTrack, onBack }) {
  const location = useLocation();
  const navigate = useSafeNavigate();
  const t = translations?.[lang] || translations?.ht || {};
  const stateTrack = location.state?.track;
  // Fallback id from the URL (contentId from the /{id}@{user}/music
  // deep-link, or the legacy ?id= query) so a hard refresh / pasted
  // link re-fetches instead of bouncing to the home page.
  const urlId = Number(new URLSearchParams(location.search).get('id')) || null;
  const detailId = contentId ?? urlId;
  const [track, setTrack] = useState(initialTrack || stateTrack || null);
  const [loadFailed, setLoadFailed] = useState(false);

  // ─── Re-fetch by id when no state/data was passed (deep link / refresh) ──
  useEffect(() => {
    if (initialTrack || stateTrack || !detailId) return;
    let cancelled = false;
    musicService.get(detailId)
      .then((res) => { if (!cancelled) setTrack(res?.data || null); })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, [initialTrack, stateTrack, detailId]);

  // ─── Canonical URL upgrade: legacy /sheet/explore/music(?id=) and
  //     state-only navigations redirect (replace) to /{id}@{user}/music
  //     once the payload is known. New-format URLs never match. ───────
  useEffect(() => {
    if (!track?.id) return;
    if (!isLegacyContentUrl('music', location.pathname)) return;
    navigate(buildContentUrl('music', track), { replace: true });
  }, [track?.id, location.pathname, navigate]);

  // ─── ALL hooks go BEFORE any conditional return (Rules of Hooks) ──
  const audioRef = useRef(null);
  const [previewing, setPreviewing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    return () => { if (audioRef.current) audioRef.current.pause(); };
  }, []);

  // ─── Content Intelligence SEO data ─────────────────────────────
  const [ciSeo, setCiSeo] = useState(null);
  useEffect(() => {
    if (!track?.id) return;
    let cancelled = false;
    musicService.getSEO(track.id)
      .then((res) => {
        if (!cancelled && res?.data?.status === 'ready') setCiSeo(res.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [track?.id]);

  // ─── Save toggle ─────────────────────────────────────────────────
  const [isSaved, setIsSaved] = useState(false);
  const [saveCount, setSaveCount] = useState(null);
  const [saveBusy, setSaveBusy] = useState(false);

  useEffect(() => {
    if (!user || !track?.id) return;
    let cancelled = false;
    savedMusicService.isSaved(track.id)
      .then((saved) => { if (!cancelled) setIsSaved(saved); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, track?.id]);

  // ─── Total saves badge (public count) ─────────────────────────────
  useEffect(() => {
    if (!track?.id) return;
    let cancelled = false;
    savedItemService.count('music', track.id)
      .then((c) => { if (!cancelled) setSaveCount(c); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [track?.id]);

  const handleToggleSave = useCallback(async () => {
    if (!user) {
      showToast?.(t.mwen_signin_required || 'Sign in to save', 'user-lock');
      return;
    }
    if (saveBusy || !track?.id) return;
    setSaveBusy(true);
    const wasSaved = isSaved;
    setIsSaved(!wasSaved);
    setSaveCount((c) => (c == null ? c : Math.max(0, c + (wasSaved ? -1 : 1))));
    try {
      if (wasSaved) await savedMusicService.remove(track.id);
      else await savedMusicService.create(track.id);
      // Re-sync the badge with the authoritative count.
      savedItemService.count('music', track.id)
        .then((c) => setSaveCount(c))
        .catch(() => {});
    } catch (e) {
      setIsSaved(wasSaved);
      setSaveCount((c) => (c == null ? c : Math.max(0, c + (wasSaved ? 1 : -1))));
      showToast?.(t.mwen_unsave_error || 'Could not save. Try again.', 'circle-exclamation');
    } finally {
      setSaveBusy(false);
    }
  }, [isSaved, saveBusy, track, user, showToast, t]);

  // ─── Share: copy the canonical /{id}@{user}/music deep-link ──────
  const handleShare = useCallback(async () => {
    if (!track?.id) return;
    const url = buildContentShareUrl('music', track);
    if (navigator.share) {
      try {
        await navigator.share({ title: track.title || 'Music', url });
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
  }, [track, showToast, t, lang]);

  // ─── Scroll detection (menm ak CourseDetail) ──────────────────────
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // ─── Recent-view tracking ───────────────────────────────────────
  useEffect(() => {
    if (!track?.id) return;
    recentService.track('music', track.id);
  }, [track?.id]);

  // No track AND no id to fetch -> bounce home.
  if (!track && !detailId) {
    return <Navigate to="/" replace />;
  }
  // Deep link with an id that failed to load — recoverable message.
  if (!track && loadFailed) {
    return (
      <div className="cd-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 24, textAlign: 'center' }}>
        <div>
          <i className="fas fa-music" style={{ fontSize: '2.5rem', color: 'var(--cd-text-secondary, #64748b)', marginBottom: 12, opacity: 0.5 }} />
          <p style={{ margin: '0 0 16px', color: 'var(--cd-text, #1e293b)' }}>
            {t.explore_not_found || (t2(lang, { ht: 'Mizik sa a pa disponib.', fr: 'Ce morceau n\'est pas disponible.', es: 'Esta pista no está disponible.', en: 'This track is not available.' }))}
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
  if (!track) {
    return (
      <div className="cd-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--cd-primary, #2563eb)' }} />
      </div>
    );
  }

  const hasPreview = Boolean(track.preview || track.preview_url);
  const previewSrc = track.preview || track.preview_url || '';
  const cover = track.cover || track.cover_url || '';
  const external = track.external || track.external_url || '';
  const videoSrc = track.video || track.video_url || '';
  const video = resolveVideoSource(videoSrc);
  const handleBack = () => (onBack ? onBack() : navigate(-1));

  async function togglePreview() {
    const audio = audioRef.current;
    if (!audio) return;
    if (previewing) {
      audio.pause();
      setPreviewing(false);
      return;
    }
    try {
      await audio.play();
      setPreviewing(true);
      api.post(`/explore/music/${track.id}/play/`).catch(() => {});
    } catch (err) {
      showToast?.(t.explore_audio_blocked || 'Tap again to play', 'play');
    }
  }

  function onTimeUpdate() {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setProgressPct(Math.min(100, (audio.currentTime / audio.duration) * 100));
  }
  function onEnded() {
    setPreviewing(false);
    setProgressPct(0);
  }

  return (
    <div className="cd-page" data-detail-sheet data-music-sheet>
      <SEOHead
        title={ciSeo?.title || track?.title}
        description={ciSeo?.description || track?.description || `${track?.title} — ${track?.artist || ''}`}
        image={ciSeo?.og_image || track?.image_url}
        url={track ? buildContentUrl('music', track) : '/sheet/explore/music'}
        type="music.song"
        schema={ciSeo?.structured_data && Object.keys(ciSeo.structured_data).length > 1 ? ciSeo.structured_data : musicSchema(track, track?.artist)}
        lang={lang}
        keywords={[...(ciSeo?.keywords || []), track?.title, track?.artist, track?.genre].filter(Boolean)}
      />
      {/* ─── Sticky Header — scroll-aware (menm ak CourseDetail) ── */}
      <header className={`cd-sticky-header${scrolled ? ' cd-sticky-header--scrolled' : ''}`}>
        <div className="cd-sticky-header-inner">
          <button
            type="button"
            onClick={handleBack}
            aria-label={t.common_back || 'Back'}
            className="cd-header-back"
          >
            <i className="fas fa-arrow-left" aria-hidden="true" />
          </button>
          <span className={`cd-header-title${scrolled ? ' cd-header-title--visible' : ''}`}>
            {track.title || (t.explore_sheet_music_title || 'Music')}
          </span>
          <div className="cd-header-actions">
            <button
              type="button"
              onClick={handleShare}
              disabled={!track}
              aria-label={t.share_music || 'Share'}
              title={t.share_music || 'Share'}
              className="cd-header-action-btn"
            >
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

      {/* ─── Hero — cover art + play button ──────────────────────── */}
      <section className="cd-hero">
        {cover ? (
          <div style={{
            position: 'absolute', inset: 0, overflow: 'hidden',
          }}>
            <img
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              src={cover}
              alt=""
              aria-hidden="true"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg, rgba(15,23,42,0.15) 0%, rgba(15,23,42,0.5) 40%, rgba(15,23,42,0.85) 100%)',
            }} />
          </div>
        ) : (
          <div className="cd-hero-fallback">
            <div className="cd-hero-fallback-grad" style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 50%, #d81b60 100%)',
            }} />
          </div>
        )}

        <div className="cd-hero-content cd-hero-content--loaded" style={{
          padding: '40px 24px 32px',
          textAlign: 'left', transform: 'none', opacity: 1,
        }}>
          <div className="cd-hero-tags" style={{ justifyContent: 'flex-start' }}>
            {track.genre && (
              <span className="cd-tag" style={{
                background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}>
                <i className="fas fa-music" style={{ fontSize: '0.65rem', opacity: 0.8 }} />
                {' '}{track.genre}
              </span>
            )}
            {track.duration && (
              <span className="cd-tag" style={{
                background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}>
                <i className="fas fa-clock" aria-hidden="true" />
                {' '}{track.duration}
              </span>
            )}
            {typeof track.plays === 'number' && (
              <span className="cd-tag" style={{
                background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}>
                <i className="fas fa-headphones" aria-hidden="true" />
                {' '}{formatPlays(track.plays)}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img
                style={{ width: 120, height: 120, borderRadius: 16, objectFit: 'cover',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}
                src={cover}
                alt={track.title || 'Track cover'}
                onError={(e) => {
                  e.currentTarget.src = `https://via.placeholder.com/400x400/2563eb/ffffff?text=${encodeURIComponent(track.title || 'Music')}`;
                }}
              />
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center',
              }}>
                <button
                  type="button"
                  onClick={togglePreview}
                  aria-label={previewing ? (t.explore_pause || 'Pause') : (t.explore_play || 'Play preview')}
                  aria-pressed={previewing}
                  style={{
                    width: 52, height: 52, borderRadius: '50%', border: 'none',
                    background: previewing ? 'rgba(37,99,235,0.9)' : 'rgba(255,255,255,0.9)',
                    color: previewing ? '#fff' : 'var(--cd-primary, #2563eb)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: '1.2rem',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
                >
                  <i className={classNames('fas', previewing ? 'fa-pause' : 'fa-play')}
                    style={{ marginLeft: previewing ? 0 : 3 }} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div>
              <h1 className="cd-hero-title" style={{ margin: '0 0 4px' }}>{track.title}</h1>
              {track.artist && (
                <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600, margin: 0 }}>
                  {track.artist}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Main body — cards (menm ak CourseDetail) ──────────────── */}
      <div className="cd-body">
        <div className="cd-body-inner">
          {/* Audio Player Card */}
          <section className="cd-section">
            <h2 className="cd-section-title">
              <i className="fas fa-headphones" aria-hidden="true" />
              {t.explore_audio_preview || 'Audio Preview'}
            </h2>
            {hasPreview ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <button
                    type="button"
                    onClick={togglePreview}
                    aria-label={previewing ? (t.explore_pause || 'Pause') : (t.explore_play || 'Play preview')}
                    style={{
                      width: 56, height: 56, borderRadius: '50%', border: 'none',
                      background: 'var(--cd-primary, #2563eb)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', fontSize: '1.3rem', flexShrink: 0,
                      boxShadow: previewing ? '0 0 0 4px var(--cd-primary-light, #dbeafe)' : '0 4px 14px rgba(37,99,235,0.3)',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
                  >
                    <i className={classNames('fas', previewing ? 'fa-pause' : 'fa-play')}
                      style={{ marginLeft: previewing ? 0 : 3 }} aria-hidden="true" />
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      height: 6, borderRadius: 3, background: 'var(--cd-border, #e2e8f0)',
                      overflow: 'hidden', marginBottom: 8,
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 3, width: `${progressPct}%`,
                        background: 'linear-gradient(90deg, var(--cd-primary, #2563eb), #7c3aed)',
                        transition: 'width 0.15s linear',
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--cd-text-secondary, #64748b)' }}>
                      <span>{previewing ? t.explore_playing || 'Playing' : t.explore_ready || 'Ready'}</span>
                      <span>{track.duration || '--:--'}</span>
                    </div>
                  </div>
                </div>
                <audio
                  ref={audioRef}
                  src={previewSrc}
                  preload="none"
                  onTimeUpdate={onTimeUpdate}
                  onEnded={onEnded}
                />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--cd-text-secondary, #64748b)' }}>
                <i className="fas fa-music" style={{ fontSize: '2rem', marginBottom: 8, opacity: 0.4 }} aria-hidden="true" />
                <p style={{ margin: 0, fontSize: '0.9rem' }}>{t.explore_no_preview || 'No audio preview available'}</p>
              </div>
            )}
          </section>

          {/* Music Video Card */}
          {video && (
            <section className="cd-section">
              <h2 className="cd-section-title">
                <i className="fas fa-video" aria-hidden="true" />
                {t.explore_video_title || 'Music Video'}
              </h2>
              {video.kind === 'embed' ? (
                <div style={{
                  position: 'relative', paddingBottom: '56.25%', height: 0,
                  overflow: 'hidden', borderRadius: 12,
                  background: '#000',
                  boxShadow: 'var(--cd-shadow-lg, 0 10px 25px rgba(0,0,0,0.08))',
                }}>
                  <iframe
                    src={video.src}
                    title={track.title || 'Music video'}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              ) : (
                <video
                  src={video.src}
                  controls
                  preload="metadata"
                  playsInline
                  poster={cover || undefined}
                  style={{ width: '100%', maxHeight: '70vh', borderRadius: 12, background: '#000', display: 'block' }}
                >
                  {lang === 'ht'
                    ? 'Navigatè w pa sipòte lekti videyo.'
                    : 'Your browser does not support video playback.'}
                </video>
              )}
            </section>
          )}

          {/* External Link */}
          {external && (
            <div className="cd-price-card">
                <div className="cd-price-card-header">
                  <div className="cd-price-card-info">
                    <span className="cd-price-label">
                      <i className="fas fa-external-link-alt" aria-hidden="true" style={{ marginRight: 6 }} />
                      {t.explore_open_external || 'Open external'}
                    </span>
                  </div>
                </div>
                <a
                  href={external}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 18px', borderRadius: 12, marginTop: 16,
                    background: 'var(--cd-surface, #fff)',
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
                    <i className="fas fa-external-link-alt" aria-hidden="true" />
                  </span>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--cd-text, #1e293b)' }}>
                      {t.explore_open_external || 'Open external'}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--cd-text-secondary, #64748b)' }}>
                      {new URL(external).hostname}
                    </span>
                  </div>
                  <i className="fas fa-chevron-right" style={{ fontSize: '0.85rem', color: 'var(--cd-text-secondary, #64748b)' }} aria-hidden="true" />
                </a>
                <p className="cd-price-disclaimer" style={{ marginTop: 12 }}>
                  <i className="fas fa-user" style={{ marginRight: 4, opacity: 0.5 }} />
                  {track.artist || ''}
                </p>
              </div>
          )}
        </div>
      </div>

      {/* ─── Scroll-to-top ─────────────────────────────────── */}
      {scrolled && (
        <button
          type="button"
          className="cd-scroll-top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label={t2(lang, { ht: 'Retounen anwo', en: 'Back to top' })}
        >
          <i className="fas fa-arrow-up" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default MusicSheet;
