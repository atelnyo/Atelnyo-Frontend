/**
 * src/components/explore/JobSheet.jsx
 *
 * Phase 25 job detail sheet for the Explore catalog. Mirrors the
 * TalentSheet / MusicSheet design system (cd-page → cd-hero → cd-body)
 * so the job browse flow feels native to the rest of Explore.
 *
 * Layout: sticky header → hero (title + budget + status chips) →
 * body (poster card, description, skills, info grid, proposals, apply).
 */
import React, { useEffect, useState, useCallback } from 'react';
import useSafeNavigate from '../../hooks/useSafeNavigate';
import useSavedItem from '../../hooks/useSavedItem';
import SaveHeartButton from '../SaveHeartButton';
import { Navigate, useLocation } from 'react-router-dom';
import { translations } from '../../data/translations';
import { jobService } from '../../services/api';
import { buildContentUrl, buildContentShareUrl, isLegacyContentUrl } from '../../utils/contentUrl';
import SEOHead, { jobSchema } from '../shared/SEOHead';
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

function formatBudget(j) {
  if (!j || j.budget_min == null) return null;
  const min = Number(j.budget_min);
  const max = Number(j.budget_max);
  const cur = j.currency || 'USD';
  if (j.budget_type === 'hourly') return `$${min}-${max}/${cur === 'USD' ? 'hr' : cur}`;
  return `$${min} — $${max} ${cur}`;
}

/* ─── Inline style helpers (same tokens as TalentSheet) ─────────────── */
const S = {
  flexCol: { display: 'flex', flexDirection: 'column' },
  flexRow: { display: 'flex', alignItems: 'center' },
};

export default function JobSheet({ lang = 'ht', showToast, user, contentId }) {
  const location = useLocation();
  const navigate = useSafeNavigate();
  const t = translations?.[lang] || translations?.ht || {};
  const stateJob = location.state?.job;
  // Fallback id from the URL (contentId from the /{id}@{user}/job
  // deep-link, or the legacy ?id= query) so a hard refresh (no router
  // state) re-fetches instead of bouncing the visitor to the home page.
  const urlId = Number(new URLSearchParams(location.search).get('id')) || null;
  const detailId = contentId ?? urlId;
  const [job, setJob] = useState(stateJob || null);
  const [loadFailed, setLoadFailed] = useState(false);

  // ─── Canonical URL upgrade: legacy /sheet/explore/job(?id=)
  //     redirects (replace) to /{id}@{user}/job once loaded. ──────────
  useEffect(() => {
    if (!job?.id) return;
    if (!isLegacyContentUrl('job', location.pathname)) return;
    navigate(buildContentUrl('job', job), { replace: true });
  }, [job?.id, location.pathname, navigate]);

  // ─── Content Intelligence SEO data ─────────────────────────────
  const [ciSeo, setCiSeo] = useState(null);
  useEffect(() => {
    if (!job?.id) return;
    let cancelled = false;
    jobService.getSEO(job.id)
      .then((res) => {
        if (!cancelled && res?.data?.status === 'ready') setCiSeo(res.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [job?.id]);

  // ─── Hooks (before conditional return) ───────────────────────────────
  const [scrolled, setScrolled] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [applyError, setApplyError] = useState('');

  // ─── Re-fetch by id when no state was passed (deep link / refresh) ──
  useEffect(() => {
    if (stateJob || !detailId) return;
    let cancelled = false;
    jobService.get(detailId)
      .then((res) => { if (!cancelled) setJob(res?.data || null); })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, [stateJob, detailId]);

  // Scroll detection
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Track applied state once
  useEffect(() => {
    if (!job?.id) return;
    if (job.has_applied) {
      // One-shot sync from the fetched payload — same project convention
      // as ImageUrlField (react-hooks/set-state-in-effect disabled here).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setApplied(true);
    }
  }, [job?.id, job?.has_applied]);

  // ─── Save heart (generic SavedItem endpoint) ─────────────────────
  const { isSaved, saveCount, saveBusy, handleToggleSave } = useSavedItem(
    'job', job?.id, { user, showToast, t },
  );

  // ─── Share: copy the canonical /{id}@{user}/job deep-link ────────
  const handleShare = useCallback(async () => {
    if (!job?.id) return;
    const url = buildContentShareUrl('job', job);
    if (navigator.share) {
      try {
        await navigator.share({ title: job.title || 'Job', url });
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
  }, [job, showToast, t, lang]);

  // ─── Apply (submit a proposal) ───────────────────────────────────────
  // Rules of Hooks: every hook (this useCallback included) MUST sit
  // before the early returns below — the loading/error branches render
  // a different number of hooks otherwise and React #310 crashes the
  // page on every deep-link visit.
  const handleApply = useCallback(async (e) => {
    e?.preventDefault?.();
    const amount = Number(bidAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setApplyError(t.explore_job_bid_error || 'Enter a valid bid amount');
      return;
    }
    setApplyBusy(true);
    setApplyError('');
    try {
      const res = await jobService.propose(job.id, {
        bid_amount: amount,
        currency: job.currency || 'USD',
        cover_letter: coverLetter.trim(),
      });
      setApplied(true);
      setShowApplyForm(false);
      showToast?.(
        res?.data?.status === 'pending'
          ? (t.explore_job_applied || 'Proposal sent!')
          : (t.explore_job_applied || 'Proposal submitted!'),
        'check-circle',
      );
    } catch (err) {
      const detail = err?.response?.data?.detail
        || err?.response?.data?.bid_amount?.[0]
        || err?.message
        || (t.explore_job_apply_error || 'Could not submit proposal.');
      setApplyError(detail);
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setApplyBusy(false);
    }
  }, [bidAmount, coverLetter, job, showToast, t]);

  // No job AND no id to fetch -> bounce home.
  if (!job && !detailId) {
    return <Navigate to="/" replace />;
  }
  // Deep link with an id that failed to load — recoverable message.
  if (!job && loadFailed) {
    return (
      <div className="cd-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 24, textAlign: 'center' }}>
        <div>
          <i className="fas fa-briefcase" style={{ fontSize: '2.5rem', color: 'var(--cd-text-secondary, #64748b)', marginBottom: 12, opacity: 0.5 }} />
          <p style={{ margin: '0 0 16px', color: 'var(--cd-text, #1e293b)' }}>
            {t.explore_not_found || (t2(lang, { ht: 'Travay sa a pa disponib.', fr: 'Cet emploi n\'est pas disponible.', es: 'Este empleo no está disponible.', en: 'This job is not available.' }))}
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
  if (!job) {
    return (
      <div className="cd-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--cd-primary, #2563eb)' }} />
      </div>
    );
  }

  const budget = formatBudget(job);
  const isOwner = Boolean(user && job.posted_by === user.id);
  const handleBack = () => navigate(-1);

  const chips = [];
  if (budget) chips.push({ icon: 'fa-dollar-sign', text: budget });
  if (job.is_remote) chips.push({ icon: 'fa-globe', text: t.explore_remote || 'Remote' });
  if (job.location) chips.push({ icon: 'fa-map-marker-alt', text: job.location });

  return (
    <div className="cd-page" data-detail-sheet data-job-sheet>
      <SEOHead
        title={ciSeo?.title || job.title}
        description={ciSeo?.description || job.description}
        image={ciSeo?.og_image || job.image_url}
        url={job ? buildContentUrl('job', job) : '/sheet/explore/job'}
        type="job"
        schema={ciSeo?.structured_data && Object.keys(ciSeo.structured_data).length > 1 ? ciSeo.structured_data : jobSchema(job)}
        lang={lang}
        keywords={[...(ciSeo?.keywords || []), job.title, job.location, job.category].filter(Boolean)}
      />
      {/* ─── Sticky Header ── */}
      <header className={`cd-sticky-header${scrolled ? ' cd-sticky-header--scrolled' : ''}`}>
        <div className="cd-sticky-header-inner">
          <button type="button" onClick={handleBack}
            aria-label={t.common_back || 'Back'} className="cd-header-back">
            <i className="fas fa-arrow-left" aria-hidden="true" />
          </button>
          <span className={`cd-header-title${scrolled ? ' cd-header-title--visible' : ''}`}>
            {job.title || (t.explore_job_title || 'Job details')}
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
            <button type="button" onClick={handleShare}
              disabled={!job}
              aria-label={t.share_job || 'Share'}
              title={t.share_job || 'Share'}
              className="cd-header-action-btn">
              <i className="fas fa-share-alt" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Hero — briefcase gradient ───────────────────────────────── */}
      <section className="cd-hero cd-hero--job" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #7c3aed 100%)' }}>
        <div className="cd-hero-content cd-hero-content--loaded" style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', textAlign: 'center', padding: '8px 24px 40px',
        }}>
          <div>
            {job.cover_url && !coverFailed ? (
              <img
                src={job.cover_url}
                alt=""
                style={{
                  width: 88, height: 88, margin: '0 auto 16px', borderRadius: 20,
                  objectFit: 'cover', display: 'block',
                  border: '2px solid rgba(255,255,255,0.35)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                }}
                onError={() => setCoverFailed(true)}
              />
            ) : (
              <div style={{
                width: 72, height: 72, margin: '0 auto 16px', borderRadius: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                fontSize: '1.6rem', color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              }}>
                <i className="fas fa-briefcase" aria-hidden="true" />
              </div>
            )}
            <h1 className="cd-hero-title" style={{ fontSize: '1.8rem', margin: '0 0 8px' }}>
              {job.title}
            </h1>
            {budget && (
              <p style={{ fontSize: '1.15rem', color: 'rgba(255,255,255,0.95)', fontWeight: 700, margin: '0 0 12px' }}>
                {budget}
              </p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
              {chips.map((c, i) => (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 50, fontSize: '0.8rem', fontWeight: 600,
                  background: 'rgba(255,255,255,0.14)', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}>
                  <i className={`fas ${c.icon}`} style={{ fontSize: '0.7rem', opacity: 0.85 }} />
                  {c.text}
                </span>
              ))}
              {job.proposal_count != null && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 50, fontSize: '0.8rem', fontWeight: 600,
                  background: 'rgba(16,185,129,0.2)', color: '#d1fae5',
                  border: '1px solid rgba(16,185,129,0.35)',
                }}>
                  <i className="fas fa-file-signature" style={{ fontSize: '0.7rem' }} />
                  {job.proposal_count} {t.explore_job_proposals || 'proposals'}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Body ─────────────────────────────────────────────────────── */}
      <div className="cd-body">
        <div className="cd-body-inner">
          {/* ─── Poster card ───────────────────────────────────────── */}
          {job.posted_by_name && (
            <div className="cd-creator-card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', top: 0, right: 0, width: 120, height: '100%',
                background: 'linear-gradient(135deg, transparent 40%, rgba(37,99,235,0.05) 100%)',
                pointerEvents: 'none',
              }} />
              <div className="cd-creator-avatar" style={{ width: 56, height: 56, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                <i className="fas fa-user" />
              </div>
              <div className="cd-creator-info" style={{ flex: 1 }}>
                <span className="cd-creator-label">{t.explore_job_poster || 'Posted by'}</span>
                <span className="cd-creator-name">{job.posted_by_name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--cd-text-secondary, #64748b)' }}>
                  {job.created_at ? formatDate(job.created_at, lang) : ''}
                </span>
              </div>
              <span style={{
                padding: '4px 12px', borderRadius: 50, fontSize: '0.68rem', fontWeight: 700,
                background: job.status === 'published'
                  ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                color: job.status === 'published' ? '#059669' : '#d97706',
                textTransform: 'uppercase', flexShrink: 0,
              }}>
                {job.status}
              </span>
            </div>
          )}

          {/* ─── Description ───────────────────────────────────────── */}
          {job.description && (
            <section className="cd-section">
              <h2 className="cd-section-title">
                <i className="fas fa-align-left" aria-hidden="true" />
                {t.explore_job_description || 'Job Description'}
              </h2>
              <p className="cd-text" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{job.description}</p>
            </section>
          )}

          {/* ─── Skills ─────────────────────────────────────────────── */}
          {Array.isArray(job.skills_required) && job.skills_required.length > 0 && (
            <section className="cd-section">
              <h2 className="cd-section-title">
                <i className="fas fa-cogs" aria-hidden="true" />
                {t.explore_skills_label || 'Skills Required'}
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {job.skills_required.map((s) => (
                  <span key={s} style={{
                    display: 'inline-block', padding: '6px 16px', borderRadius: 50,
                    background: 'var(--cd-primary-light, #dbeafe)',
                    color: 'var(--cd-primary, #2563eb)',
                    fontSize: '0.85rem', fontWeight: 600,
                  }}>{s}</span>
                ))}
              </div>
            </section>
          )}

          {/* ─── Info grid ──────────────────────────────────────────── */}
          {(job.budget_type || job.is_remote || job.location || job.expires_at) && (
            <section className="cd-section">
              <h2 className="cd-section-title">
                <i className="fas fa-info-circle" aria-hidden="true" />
                {t2(lang, { ht: 'Enfòmasyon', en: 'Information' })}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                {job.budget_type && (
                  <InfoTile icon="fa-money-check-alt"
                    label={t.explore_job_budget_type || 'Budget type'}
                    value={job.budget_type} />
                )}
                {job.is_remote && (
                  <InfoTile icon="fa-globe"
                    label={t.explore_remote || 'Remote'} value={t.explore_remote_yes || 'Yes'} />
                )}
                {job.location && (
                  <InfoTile icon="fa-map-marker-alt"
                    label={t2(lang, { ht: 'Kote', en: 'Location' })} value={job.location} />
                )}
                {job.expires_at && (
                  <InfoTile icon="fa-hourglass-half"
                    label={t.explore_job_expires || 'Expires'}
                    value={formatDate(job.expires_at, lang)} />
                )}
              </div>
            </section>
          )}

          {/* ─── Apply / proposal card ─────────────────────────────── */}
          <div className="cd-price-card">
            <div className="cd-price-card-header">
              <div className="cd-price-card-info">
                <span className="cd-price-label">
                  <i className="fas fa-paper-plane" aria-hidden="true" style={{ marginRight: 6 }} />
                  {t.explore_job_apply || 'Apply for this job'}
                </span>
                {applied && (
                  <span style={{ color: '#059669', fontWeight: 700, fontSize: '0.85rem' }}>
                    <i className="fas fa-check-circle" style={{ marginRight: 4 }} />
                    {t.explore_job_applied || 'Applied!'}
                  </span>
                )}
              </div>
            </div>

            {applied ? (
              <div style={{ textAlign: 'center', padding: '20px 0 8px', color: 'var(--cd-text-secondary, #64748b)' }}>
                <i className="fas fa-envelope-open-text" style={{ fontSize: '2rem', marginBottom: 8, opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  {t.explore_job_applied_desc || 'Your proposal has been submitted. The client will review it.'}
                </p>
              </div>
            ) : isOwner ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--cd-text-secondary, #64748b)' }}>
                <i className="fas fa-user-tag" style={{ fontSize: '2rem', marginBottom: 8, opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  {t.explore_job_own_job || 'This is your job posting — manage it from Creator Studio.'}
                </p>
              </div>
            ) : !user ? (
              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => showToast?.(t.mwen_signin_required || 'Sign in to apply', 'user-lock')}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff',
                    fontWeight: 700, fontSize: '0.95rem', fontFamily: 'inherit',
                  }}
                >
                  <i className="fas fa-sign-in-alt" style={{ marginRight: 8 }} />
                  {t.explore_job_apply_btn || 'Sign in to Apply'}
                </button>
              </div>
            ) : (
              <>
                {!showApplyForm ? (
                  <div style={{ marginTop: 16 }}>
                    <button
                      type="button"
                      onClick={() => setShowApplyForm(true)}
                      style={{
                        width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: 'pointer',
                        background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff',
                        fontWeight: 700, fontSize: '0.95rem', fontFamily: 'inherit',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
                    >
                      <i className="fas fa-file-signature" style={{ marginRight: 8 }} />
                      {t.explore_job_apply_btn || 'Submit a Proposal'}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApply} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                    {applyError && (
                      <div style={{
                        padding: '10px 14px', borderRadius: 10, fontSize: '0.85rem',
                        background: 'rgba(239,68,68,0.08)', color: '#dc2626',
                      }} role="alert">{applyError}</div>
                    )}
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--cd-text, #1e293b)' }}>
                      {t.explore_job_bid_label || `Your bid (${job.currency || 'USD'})`}
                      <input
                        type="number" min="0" step="0.01" required
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        style={{
                          display: 'block', width: '100%', marginTop: 6, boxSizing: 'border-box',
                          padding: '11px 14px', borderRadius: 10, border: '1px solid var(--cd-border, #e2e8f0)',
                          fontSize: '0.95rem', fontFamily: 'inherit',
                        }}
                        placeholder={job.budget_min != null ? `e.g. ${job.budget_min}` : '250'}
                      />
                    </label>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--cd-text, #1e293b)' }}>
                      {t.explore_job_cover_label || 'Cover letter (optional)'}
                      <textarea
                        rows={3}
                        value={coverLetter}
                        onChange={(e) => setCoverLetter(e.target.value)}
                        style={{
                          display: 'block', width: '100%', marginTop: 6, boxSizing: 'border-box',
                          padding: '11px 14px', borderRadius: 10, border: '1px solid var(--cd-border, #e2e8f0)',
                          fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical',
                        }}
                        placeholder={t.explore_job_cover_ph || 'Tell the client why you are the right fit...'}
                        maxLength={2000}
                      />
                    </label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setShowApplyForm(false)}
                        style={{
                          flex: 1, padding: '12px', borderRadius: 12, cursor: 'pointer',
                          border: '1px solid var(--cd-border, #e2e8f0)', background: 'transparent',
                          color: 'var(--cd-text-secondary, #64748b)', fontWeight: 600,
                          fontFamily: 'inherit', fontSize: '0.9rem',
                        }}
                      >
                        {t.common_cancel || 'Cancel'}
                      </button>
                      <button
                        type="submit"
                        disabled={applyBusy}
                        style={{
                          flex: 1, padding: '12px', borderRadius: 12, cursor: 'pointer',
                          border: 'none', background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                          color: '#fff', fontWeight: 700, fontFamily: 'inherit', fontSize: '0.9rem',
                          opacity: applyBusy ? 0.7 : 1,
                        }}
                      >
                        {applyBusy ? (
                          <><i className="fas fa-spinner fa-spin" /> {t.explore_job_submitting || 'Sending...'}</>
                        ) : (
                          <><i className="fas fa-paper-plane" style={{ marginRight: 6 }} /> {t.explore_job_submit || 'Submit'}</>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── Scroll-to-top ─────────────────────────────────────────── */}
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
function InfoTile({ icon, label, value }) {
  return (
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
}

