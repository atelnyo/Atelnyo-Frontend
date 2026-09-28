import React, { useState, useEffect, useCallback, useRef } from 'react';
import FAQ from './FAQ';
import CourseFaqSection from './CourseFaqSection';
import useSavedItem from '../hooks/useSavedItem';
import SaveHeartButton from './SaveHeartButton';
import { progressService, courseCheckoutService, courseService } from '../services/api';
import { resolveVideoSource } from '../modules/explore/utils/videoSource';
import LanguagePracticeBlock from './learning/LanguagePracticeBlock';
import QuizBlock from './learning/QuizBlock';
import SEOHead, { courseSchema } from './shared/SEOHead';

/**
 * CourseDetail — full-viewport course detail page.
 *
 * Renders a beautiful, immersive course detail view with hero image,
 * instructor info, metadata chips, syllabus timeline, and pricing.
 * Supports both light and dark modes via CSS variables.
 */

export default function CourseDetail({ course, lang, translations, onBack, user, showToast, onOpenCheckout, onEnterLearning, onAuthOpen }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState(new Set());
  const headerRef = useRef(null);
  const t = translations?.[lang] || translations?.ht || {};
  const isHt = lang === 'ht';

  // ─── Content Intelligence SEO data ─────────────────────────────
  const [ciSeo, setCiSeo] = useState(null);
  useEffect(() => {
    if (!course?.id) return;
    let cancelled = false;
    courseService.getSEO(course.id)
      .then((res) => {
        if (!cancelled && res?.data?.status === 'ready') {
          setCiSeo(res.data);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [course?.id]);

  // ─── Save heart (generic SavedItem endpoint) ─────────────────────
  const { isSaved, saveCount, saveBusy, handleToggleSave } = useSavedItem(
    'course', course?.id, { user, showToast, t },
  );

  // ─── Enrollment / checkout — REAL state (backend-entitlement). ────
  // Free courses (price 0) and 100% promos enroll directly (no payment).
  // Paid courses create a real pending order through the existing
  // payment architecture — promo codes are validated server-side.
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoMsg, setPromoMsg] = useState('');
  const [promoErr, setPromoErr] = useState('');
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  // ─── Backend-authoritative access check (CourseEntitlement). ─────
  // The server decides who may take the course — never the frontend.
  useEffect(() => {
    if (!course?.id || !user) return;
    let cancelled = false;
    courseCheckoutService.access(course.id)
      .then((res) => {
        if (cancelled) return;
        const body = res?.data || {};
        setIsEnrolled(Boolean(body.has_access));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [course?.id, user]);

  // ─── Learner Progress Engine — REAL UserProgress rows. ─────────────
  // The server persists the learner's last meaningful position +
  // completed blocks; we surface it as "Continue where you left off"
  // and per-module completion. When no row exists yet, the first
  // completion action creates it lazily via the backend's create.
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (!course?.id || !user) return;
    let cancelled = false;
    progressService.getAll()
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res?.data?.results || res?.data) ? (res?.data?.results || res?.data) : [];
        const row = list.find((p) => Number(p.course) === Number(course.id)) || null;
        setProgress(row);
      })
      .catch(() => { /* progress is best-effort, never blocks the page */ });
    return () => { cancelled = true; };
  }, [course?.id, user]);

  // Position: the learner OPENED this module/block — real, meaningful,
  // not every scroll. Fire-and-forget.
  const handleRecordPosition = useCallback((moduleIndex, blockIndex = -1, blockId = '') => {
    if (!user || !progress) return;
    progressService.recordPosition(progress.id, {
      module_index: Number(moduleIndex) || 0,
      block_index: Number(blockIndex) >= 0 ? Number(blockIndex) : -1,
      block_id: blockId || '',
    }).then((r) => { if (r?.data) setProgress((prev) => ({ ...prev, ...r.data })); })
      .catch(() => {});
  }, [user, progress]);

  // Completion: a block was GENUINELY completed (exact match, quiz
  // passed, response submitted...). Creates the progress row on first
  // use, then records server-side and mirrors the returned state.
  const handleCompleteBlock = useCallback((moduleIndex, blockId, blockType = '') => {
    if (!user) return;
    const row = progress;
    const send = (rowId) => {
      progressService.completeBlock(rowId, {
        module_index: Number(moduleIndex) || 0,
        block_id: blockId || '',
        block_type: blockType || '',
      }).then((r) => { if (r?.data) setProgress((prev) => ({ ...prev, ...r.data })); })
        .catch(() => {});
    };
    if (row?.id) {
      send(row.id);
      return;
    }
    progressService.create({ course: course?.id })
      .then((created) => {
        const fresh = created?.data || null;
        if (fresh) {
          setProgress(fresh);
          send(fresh.id);
        }
      })
      .catch(() => {});
  }, [user, progress, course?.id]);

  // REAL course checkout — the backend decides: free course or 100%
  // promo → entitlement granted immediately (no payment); paid course
  // → a pending order is created (payment flow via the order system).
  const handleCheckout = async (promo = '') => {
    if (!course?.id || checkoutBusy) return;
    // Enskripsyon mande yon kont — olye pou yon 401 silans (erè a te
    // kache pou kou gratis, kidonk bouton an te sanble pa fè anyen),
    // ouvri modil koneksyon an pou itilizatè a ka konekte epi rekòmanse.
    if (!user) {
      if (typeof onAuthOpen === 'function') onAuthOpen();
      return;
    }
    setCheckoutBusy(true);
    setPromoMsg('');
    setPromoErr('');
    try {
      const res = await courseCheckoutService.checkout(course.id, promo);
      const body = res?.data || {};
      if (body.has_access) {
        setIsEnrolled(true);
        showToast?.(isHt
          ? '✅ Ou gen aksè sou kou a!' : '✅ You have access to this course!', 'check-circle');
        if (body.promo_code && body.final_price == 0) {
          setPromoMsg(isHt
            ? `Promo ${body.promo_code} aplike — kou a gratis pou ou!`
            : `Promo ${body.promo_code} applied — the course is free for you!`);
        }
        // Apre enskripsyon siksè, mennen elèv la dirèkteman nan Espas
        // Aprantisaj la (sèlman kou ki anseye sou Atelnyo — yon kou
        // ekstèn voye l sou platfòm li menm). UX: enskri → kòmanse
        // aprann imedyatman, pa rete anlè paj kou a.
        if (!isExternal && typeof onEnterLearning === 'function') {
          onEnterLearning(course);
          return;
        }
      } else if (body.order_id) {
        // Paid course — a real pending order exists. Open the unified
        // CheckoutModal (order type) so the learner pays through the
        // SAME payment architecture as products. The backend capture /
        // webhook grants the CourseEntitlement on success.
        setPromoErr('');
        setPromoMsg(isHt
          ? '✅ Promo aplike! Fini peman an pou gen aksè sou kou a.'
          : '✅ Promo applied! Complete payment to access the course.');
        if (typeof onOpenCheckout === 'function') {
          onOpenCheckout('order', Number(body.final_price) || Number(course.price) || 0, {
            order_id: body.order_id,
            amount: Number(body.final_price) || Number(course.price) || 0,
            description: course.title,
            onSuccess: () => {
              setIsEnrolled(true);
              // Peman fini → antre nan Espas Aprantisaj la tou.
              if (!isExternal && typeof onEnterLearning === 'function') {
                onEnterLearning(course);
              }
            },
          });
        } else {
          // No checkout wiring (embedded/standalone context) — keep it
          // honest: access is NOT granted until payment completes.
          setPromoMsg(isHt
            ? '✅ Promo aplike! Peman sou entènèt disponib sou paj kou a. Kontakte yon admin si w gen pwoblèm.'
            : '✅ Promo applied! Online payment is available on the course page. Contact an admin if you have trouble.');
        }
      } else {
        // Neither access nor order — enrollment didn't succeed.
        // Surface the server message so the user knows what happened.
        const msg = body.detail || body.error || (isHt ? 'Enskripsyon an pa t reyisi.' : 'Enrollment did not succeed.');
        setPromoErr(msg);
      }
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message
        || (isHt ? 'Pa t kapab fè enskripsyon an.' : 'Could not complete enrollment.');
      setPromoErr(detail);
    } finally {
      setCheckoutBusy(false);
    }
  };

  // ─── Scroll detection for sticky header ──────────────────────────
  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY;
      setScrolled(scrollY > 200);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ─── PWA: cache this course for offline reading ────────────────────
  useEffect(() => {
    if (!course || !navigator.serviceWorker?.controller) return;
    try {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_COURSE',
        url: window.location.href,
      });
    } catch (_) { /* SW messaging can fail in sandboxed contexts */ }
  }, [course?.id]);

  // ─── No cover image → <img onLoad> never fires, so the hero content
  //     must be treated as loaded. Courses without a cover (or whose
  //     image failed) must still show title / description over the
  //     gradient — otherwise the hero content stays invisible
  //     (opacity 0 until the --loaded class is applied).
  //     Derived in render instead of setState-in-effect. ─────────────
  const heroContentLoaded = imgLoaded || imgFailed || !course?.image_url;

  // ─── Toggle syllabus week expansion ───────────────────────────────
  const toggleWeek = useCallback((index) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  if (!course) return null;

  const syllabus = Array.isArray(course.syllabus) ? course.syllabus : [];
  const heroSrc =
    (imgFailed || !course.image_url)
      ? null
      : course.image_url;
  // Delivery model — online (taught inside Atelnyo) vs external
  // (Atelnyo organizes/presents; learning happens elsewhere).
  const isExternal = course.delivery_type === 'external';
  const externalUrl = isExternal && course.external_url ? course.external_url : null;
  // Promo video — same resolver the explore cards/sheets use (YouTube /
  // Vimeo → iframe embed, direct MP4/WebM → native <video>).
  const promoVideo = course.video_url ? resolveVideoSource(course.video_url) : null;

  // ─── Helper: format price ─────────────────────────────────────────
  const fmtPrice = (price) => {
    if (price == null || price === 0) return isHt ? 'Gratis' : 'Free';
    return `$${Number(price).toFixed(2)}`;
  };

  // ─── Premium pricing (mirrors backend PREMIUM_CREATOR_DISCOUNT_PCT) ──
  const isPremium = !!(user?.premium?.is_premium);
  const PREMIUM_DISCOUNT_PCT = 25;
  const premiumPrice = (() => {
    if (!isPremium || course.price == null) return null;
    const price = Number(course.price);
    if (price === 0) return null;
    if (course.owner_type === 'official') return 0;
    return Math.round(price * (100 - PREMIUM_DISCOUNT_PCT)) / 100;
  })();

  // ─── Progress-derived resume + per-module completion state ────────
  const completedBlocksMap = (() => {
    const m = {};
    const raw = progress?.completed_blocks;
    if (raw && typeof raw === 'object') {
      Object.entries(raw).forEach(([mi, ids]) => {
        m[String(mi)] = new Set(Array.isArray(ids) ? ids : []);
      });
    }
    return m;
  })();
  const completedModules = Array.isArray(progress?.completed_modules) ? progress.completed_modules.map(Number) : [];

  // Resume target: the last module the learner opened (0 = start).
  const resumeModule = progress ? (Number(progress.last_module_index) || 0) : -1;
  const resumeBlockId = progress?.last_block_id || '';

  const isBlockDone = (moduleIndex, blockId) => {
    const set = completedBlocksMap[String(moduleIndex)];
    return Boolean(set && blockId && set.has(blockId));
  };

  // Count blocks per module + how many are done (for per-module bars).
  const moduleBlockStats = syllabus.map((item, mi) => {
    const blocks = (typeof item === 'object' && Array.isArray(item?.blocks)) ? item.blocks : [];
    const done = blocks.filter((b) => isBlockDone(mi, b.id)).length;
    return { total: blocks.length, done };
  });

  const scrollToModule = (index) => {
    setExpandedWeeks((prev) => new Set(prev).add(index));
    const id = `cd-module-${index}`;
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  return (
    <div className="cd-page" data-detail-sheet data-testid="course-detail-sheet">
      <SEOHead
        title={ciSeo?.title || course.title}
        description={ciSeo?.description || course.description}
        image={ciSeo?.og_image || course.image_url}
        url={course.created_by_username
          ? `/${course.slug || course.id}/by/${course.created_by_username}/course`
          : `/sheet/course/${course.id}`}
        type="course"
        schema={ciSeo?.structured_data && Object.keys(ciSeo.structured_data).length > 1
          ? ciSeo.structured_data
          : courseSchema(course, course.created_by_username)}
        breadcrumbs={[
          { label: 'Home', url: '/' },
          { label: 'Explore', url: '/explore' },
          { label: course.title },
        ]}
        lang={lang}
        keywords={[
          ...(ciSeo?.keywords || []),
          course.title,
          course.category,
          course.difficulty,
          course.teaching_language,
          course.learner_language,
          ...(Array.isArray(course.tags) ? course.tags : []),
        ].filter(Boolean)}
      />
      {/* ─── Sticky Header ──────────────────────────────────── */}
      <header
        ref={headerRef}
        className={`cd-sticky-header ${scrolled ? 'cd-sticky-header--scrolled' : ''}`}
      >
        <div className="cd-sticky-header-inner">
          <button
            type="button"
            className="cd-header-back"
            onClick={onBack}
            aria-label={t.common_back || 'Back'}
          >
            <i className="fas fa-arrow-left" aria-hidden="true" />
          </button>
          <span className={`cd-header-title ${scrolled ? 'cd-header-title--visible' : ''}`}>
            {course.title}
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
            <button
              type="button"
              className="cd-header-action-btn"
              aria-label={t.share_course || 'Share'}
              title={t.share_course || 'Share'}
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: course.title,
                    text: course.description?.slice(0, 100),
                    url: window.location.href,
                  }).catch(() => {});
                }
              }}
            >
              <i className="fas fa-share-alt" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Hero Section ───────────────────────────────────── */}
      <section className="cd-hero">
        {heroSrc ? (
          <>
            <img
              src={heroSrc}
              alt={course.title}
              className={`cd-hero-img ${imgLoaded ? 'cd-hero-img--loaded' : ''}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgFailed(true)}
            />
            <div className="cd-hero-overlay" />
          </>
        ) : (
          <div className="cd-hero-fallback">
            <div className="cd-hero-fallback-grad" />
          </div>
        )}
        <div className={`cd-hero-content ${heroContentLoaded ? 'cd-hero-content--loaded' : ''}`}>
          <div className="cd-hero-tags">
            {course.difficulty && (
              <span className={`cd-tag cd-tag-${course.difficulty}`}>
                {course.difficulty === 'beginner'
                  ? (isHt ? 'Debitan' : 'Beginner')
                  : course.difficulty === 'intermediate'
                    ? (isHt ? 'Mwayen' : 'Intermediate')
                    : (isHt ? 'Avanse' : 'Advanced')}
              </span>
            )}
            {course.category && (
              <span className="cd-tag cd-tag-category">
                <i className="fas fa-folder" aria-hidden="true" />
                {course.category}
              </span>
            )}
            {course.is_featured && (
              <span className="cd-tag cd-tag-featured">
                <i className="fas fa-star" aria-hidden="true" />
                {isHt ? 'Rekòmande' : 'Featured'}
              </span>
            )}
            {isExternal && (
              <span className="cd-tag cd-tag-external">
                <i className="fas fa-globe" aria-hidden="true" />
                {isHt ? 'Kou sa a anseye deyò Atelnyo' : 'Taught outside Atelnyo'}
              </span>
            )}
          </div>
          <h1 className="cd-hero-title">{course.title}</h1>
          {course.description && (
            <p className="cd-hero-desc">
              {course.description.slice(0, 150)}{course.description.length > 150 ? '…' : ''}
            </p>
          )}
          <div className="cd-hero-meta">
            <div className="cd-hero-stat">
              <i className={`fas ${isExternal ? 'fa-globe' : 'fa-graduation-cap'}`} aria-hidden="true" />
              <span>
                {isExternal
                  ? (isHt ? 'Kou ekstèn — aprann yon lòt kote' : 'External course — learn elsewhere')
                  : (isHt ? 'Kou sou entènèt' : 'Online Course')}
              </span>
            </div>
            {isExternal && course.external_format && (
              <div className="cd-hero-stat">
                <i className="fas fa-video" aria-hidden="true" />
                <span>{course.external_format}</span>
              </div>
            )}
            {course.price != null && (
              <div className="cd-hero-stat cd-hero-stat-price">
                <i className="fas fa-tag" aria-hidden="true" />
                {premiumPrice !== null ? (
                  <span>
                    <span style={{ textDecoration: 'line-through', opacity: 0.5, marginRight: 6 }}>${Number(course.price).toFixed(2)}</span>
                    {premiumPrice === 0
                      ? (isHt ? 'Gratis pou Premium' : 'Free for Premium')
                      : `$${premiumPrice.toFixed(2)}`}
                    <span style={{ marginLeft: 4, fontSize: '0.65em', color: 'var(--pr-color-orange-500, #f97316)', fontWeight: 600 }}>Premium</span>
                  </span>
                ) : (
                  <span>{fmtPrice(course.price)}</span>
                )}
              </div>
            )}
            {syllabus.length > 0 && (
              <div className="cd-hero-stat">
                <i className="fas fa-list" aria-hidden="true" />
                <span>
                  {syllabus.length} {isHt ? 'modil' : 'modules'}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── Main Content ──────────────────────────────────── */}
      <div className="cd-body">
        <div className="cd-body-inner">

          {/* ─── Instructor / Creator Card ─────────────────── */}
          {course.created_by && (
            <div className="cd-creator-card">
              <div className="cd-creator-avatar">
                {course.created_by_username
                  ? course.created_by_username.charAt(0).toUpperCase()
                  : '?'}
              </div>
              <div className="cd-creator-info">
                <span className="cd-creator-label">
                  {isHt ? 'Kreyatè' : 'Instructor'}
                </span>
                <span className="cd-creator-name">
                  {course.created_by_username || (isHt ? 'Enstriktè' : 'Instructor')}
                </span>
              </div>
            </div>
          )}

          {/* ─── About This Course ─────────────────────────── */}
          <section className="cd-section">
            <h2 className="cd-section-title">
              <i className="fas fa-info-circle" aria-hidden="true" />
              {isHt ? 'Apwopo Kou Sa a' : 'About This Course'}
            </h2>
            <div className="cd-section-body">
              <p className="cd-text">{course.description}</p>
            </div>
          </section>

          {/* ─── Continue where you left off — REAL resume position ── */}
          {user && progress && resumeModule >= 0 && (
            <section className="cd-section">
              <div className="cd-resume-card">
                <span className="cd-resume-icon"><i className="fas fa-rotate-right" aria-hidden="true" /></span>
                <div className="cd-resume-info">
                  <span className="cd-resume-label">
                    {isHt ? 'Kontinye kote ou soti' : 'Continue where you left off'}
                  </span>
                  <span className="cd-resume-target">
                    {syllabus[resumeModule]
                      ? (typeof syllabus[resumeModule] === 'string'
                        ? syllabus[resumeModule]
                        : (syllabus[resumeModule]?.title || `${isHt ? 'Modil' : 'Module'} ${resumeModule + 1}`))
                      : (isHt ? 'Kòmansman kou a' : 'Course start')}
                    {resumeBlockId ? ` · ${isHt ? 'Pratik' : 'Practice'}` : ''}
                  </span>
                  <div className="cd-resume-progress">
                    <div className="cd-resume-track">
                      <span className="cd-resume-fill" style={{ width: `${Math.min(100, Math.max(0, progress.percentage || 0))}%` }} />
                    </div>
                    <span className="cd-resume-pct">{progress.percentage || 0}%</span>
                  </div>
                </div>
                <button type="button" className="cd-resume-btn" onClick={() => scrollToModule(resumeModule)}>
                  <i className="fas fa-arrow-right" aria-hidden="true" /> {isHt ? 'Kontinye' : 'Continue'}
                </button>
              </div>
            </section>
          )}

          {/* ─── Language metadata (only when the creator set it) ── */}
          {(course.teaching_language || course.learner_language || course.learning_objective) && (
            <section className="cd-section">
              <h2 className="cd-section-title">
                <i className="fas fa-language" aria-hidden="true" />
                {isHt ? 'Enfòmasyon Lang' : 'Language Information'}
              </h2>
              <div className="cd-section-body">
                {course.learning_objective && (
                  <p className="cd-text">
                    <strong>{isHt ? 'Objektif:' : 'Objective:'}</strong> {course.learning_objective}
                  </p>
                )}
                <div className="cd-hero-meta">
                  {course.teaching_language && (
                    <div className="cd-hero-stat">
                      <i className="fas fa-graduation-cap" aria-hidden="true" />
                      <span>
                        {isHt ? 'Lang ansèyman:' : 'Teaching language:'} <strong>{course.teaching_language}</strong>
                      </span>
                    </div>
                  )}
                  {course.learner_language && (
                    <div className="cd-hero-stat">
                      <i className="fas fa-user-graduate" aria-hidden="true" />
                      <span>
                        {isHt ? 'Lang elèv:' : 'Learner language:'} <strong>{course.learner_language}</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ─── Promo Video ────────────────────────────────── */}
          {promoVideo && (
            <section className="cd-section">
              <h2 className="cd-section-title">
                <i className="fas fa-video" aria-hidden="true" />
                {t.explore_video_title || (isHt ? 'Videyo Prezantasyon' : 'Promo Video')}
              </h2>
              {promoVideo.kind === 'embed' ? (
                <div style={{
                  position: 'relative', paddingBottom: '56.25%', height: 0,
                  overflow: 'hidden', borderRadius: 12,
                  background: '#000',
                  boxShadow: 'var(--cd-shadow-lg, 0 10px 25px rgba(0,0,0,0.08))',
                }}>
                  <iframe
                    src={promoVideo.src}
                    title={course.title || 'Promo video'}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              ) : (
                <video
                  src={promoVideo.src}
                  controls
                  preload="metadata"
                  playsInline
                  poster={course.image_url || undefined}
                  style={{ width: '100%', maxHeight: '70vh', borderRadius: 12, background: '#000', display: 'block' }}
                >
                  {isHt
                    ? 'Navigatè w pa sipòte lekti videyo.'
                    : 'Your browser does not support video playback.'}
                </video>
              )}
            </section>
          )}

          {/* ─── Syllabus / Curriculum ─────────────────────── */}
          {syllabus.length > 0 && (
            <section className="cd-section">
              <h2 className="cd-section-title">
                <i className="fas fa-list-ol" aria-hidden="true" />
                {t.syllabus_title || (isHt ? 'Kourikoulòm' : 'Curriculum')}
                <span className="cd-section-count">{syllabus.length} {isHt ? 'modil' : 'modules'}</span>
              </h2>
              <div className="cd-syllabus">
                {syllabus.map((item, index) => {
                  const isExpanded = expandedWeeks.has(index);
                  const isString = typeof item === 'string';
                  const title = isString ? item : (item?.title || `Module ${index + 1}`);
                  const desc = !isString && item?.description ? item.description : '';
                  // Language-practice blocks stored inside the module entry
                  // (additive — courses without blocks render exactly as before).
                  const blocks = !isString && Array.isArray(item?.blocks) ? item.blocks : [];
                  const stats = moduleBlockStats[index] || { total: 0, done: 0 };
                  const moduleDone = completedModules.includes(index);

                  return (
                    <div
                      id={`cd-module-${index}`}
                      key={index}
                      className={`cd-syllabus-item ${isExpanded ? 'cd-syllabus-item--expanded' : ''} ${moduleDone ? 'cd-syllabus-item--done' : ''}`}
                    >
                      <button
                        type="button"
                        className="cd-syllabus-header"
                        onClick={() => {
                          toggleWeek(index);
                          // Opening a module is a meaningful position.
                          if (!isExpanded && user) handleRecordPosition(index);
                        }}
                        aria-expanded={isExpanded}
                      >
                        <span className="cd-syllabus-number">
                          {moduleDone ? <i className="fas fa-circle-check" aria-hidden="true" /> : String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="cd-syllabus-title">{title}</span>
                        {stats.total > 0 && user && (
                          <span className="cd-syllabus-module-pct">
                            {Math.round((stats.done / stats.total) * 100)}%
                          </span>
                        )}
                        <i
                          className={`fas fa-chevron-down cd-syllabus-chevron ${isExpanded ? 'cd-syllabus-chevron--open' : ''}`}
                          aria-hidden="true"
                        />
                      </button>
                      {isExpanded && (desc || blocks.length > 0) && (
                        <div className="cd-syllabus-body">
                          {stats.total > 0 && user && (
                            <div className="cd-module-progress">
                              <div className="cd-module-progress-track">
                                <span
                                  className="cd-module-progress-fill"
                                  style={{ width: `${Math.round((stats.done / stats.total) * 100)}%` }}
                                />
                              </div>
                              <span className="cd-module-progress-label">
                                {stats.done}/{stats.total} {isHt ? 'blòk konplete' : 'blocks complete'}
                              </span>
                            </div>
                          )}
                          {desc && <p>{desc}</p>}
                          {/* ── Access gate: interactive practice + quizzes
                              render ONLY for learners the BACKEND has granted
                              access (CourseEntitlement / legacy enrollment).
                              The FE never decides who may take the course. ── */}
                          {isEnrolled ? (
                            <>
                              {/* Enrolled learners can jump straight into
                                  this module inside the Learning Space
                                  (the Duolingo-style step session) — not
                                  just the flat blocks here on the page. */}
                              {!isExternal && typeof onEnterLearning === 'function' && (
                                <button
                                  type="button"
                                  className="cd-module-learn-btn"
                                  onClick={() => onEnterLearning(course, index)}
                                >
                                  <i className="fas fa-graduation-cap" aria-hidden="true" />
                                  {isHt ? 'Ouvri modil la nan Espas Aprantisaj' : 'Open this module in the Learning Space'}
                                </button>
                              )}
                              {blocks.map((block, bi) => (
                                <div key={block.id || bi} className={`cd-block-wrap ${isBlockDone(index, block.id) ? 'cd-block-wrap--done' : ''}`}>
                                  <LanguagePracticeBlock
                                    block={block}
                                    lang={lang}
                                    index={bi}
                                    courseId={course.id}
                                    moduleIndex={index}
                                    onViewed={handleRecordPosition}
                                    onComplete={handleCompleteBlock}
                                  />
                                  {isBlockDone(index, block.id) && (
                                    <span className="cd-block-done-badge">
                                      <i className="fas fa-check" aria-hidden="true" /> {isHt ? 'Konplete' : 'Complete'}
                                    </span>
                                  )}
                                </div>
                              ))}
                              {/* Real quizzes attached to this module (only
                                  for online courses — the learning happens
                                  inside Atelnyo). */}
                              {!isExternal && (
                                <QuizBlock
                                  courseId={course.id}
                                  moduleIndex={index}
                                  lang={lang}
                                  onComplete={handleCompleteBlock}
                                />
                              )}
                            </>
                          ) : (blocks.length > 0 || !isExternal) ? (
                            <div className="cd-access-gate">
                              <i className="fas fa-lock" aria-hidden="true" />
                              <p>
                                {isHt
                                  ? 'Enskri nan kou a pou w fè pratik ak kiz yo.'
                                  : 'Enroll in this course to take the practice activities and quizzes.'}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ─── Price & Enrollment ────────────────────────── */}
          {course.price != null && (
            <section className="cd-section">
              <div className="cd-price-card">
                <div className="cd-price-card-header">
                  <div className="cd-price-card-info">
                    <span className="cd-price-label">
                      {t.price_label || 'Price'}
                    </span>
                    <span className={`cd-price-amount ${Number(course.price) === 0 ? 'cd-price-amount--free' : ''}`}>
                      {Number(course.price) === 0 ? (
                        <span className="cd-free-badge">
                          <i className="fas fa-gift" aria-hidden="true" /> {isHt ? 'GRATIS' : 'FREE'}
                        </span>
                      ) : premiumPrice !== null ? (
                        <>
                          <span style={{ textDecoration: 'line-through', opacity: 0.5, fontSize: '0.85em' }}>${Number(course.price).toFixed(2)}</span>
                          <span style={{ marginLeft: 8 }}>{premiumPrice === 0 ? (isHt ? 'Gratis' : 'Free') : `$${premiumPrice.toFixed(2)}`}</span>
                          <span style={{ marginLeft: 6, fontSize: '0.65em', color: 'var(--pr-color-orange-500, #f97316)', fontWeight: 600, verticalAlign: 'middle' }}>
                            <i className="fas fa-crown" style={{ marginRight: 2 }} />Premium
                          </span>
                        </>
                      ) : (
                        fmtPrice(course.price)
                      )}
                    </span>
                    {/* LTD (Lifetime Deal) price */}
                    {Number(course.price_ltd) > 0 && (
                      <div className="cd-ltd-row">
                        <span className="cd-ltd-badge">
                          <i className="fas fa-infinity" aria-hidden="true" /> LTD
                        </span>
                        <span className="cd-ltd-price">${Number(course.price_ltd).toFixed(2)}</span>
                        <span className="cd-ltd-label">
                          {isHt ? 'pou toujou' : 'forever'}
                        </span>
                      </div>
                    )}
                  </div>
                  {isExternal && externalUrl ? (
                    <a
                      href={externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cd-cta-btn"
                    >
                      <i className="fas fa-external-link-alt" aria-hidden="true" />
                      {isHt ? 'Ale sou kou a' : 'Go to course'}
                    </a>
                  ) : isEnrolled ? (
                    onEnterLearning ? (
                      <button type="button" className="cd-cta-btn" onClick={() => onEnterLearning(course)}>
                        <i className="fas fa-graduation-cap" aria-hidden="true" />
                        {isHt ? 'Antre nan Espas Aprantisaj' : 'Enter Learning Space'}
                      </button>
                    ) : (
                      <button type="button" className="cd-cta-btn" disabled aria-disabled="true">
                        <i className="fas fa-check" aria-hidden="true" />
                        {isHt ? 'Enskri ✓' : 'Enrolled'}
                      </button>
                    )
                  ) : Number(course.price) === 0 ? (
                    // Free course — REAL checkout: entitlement + enrollment,
                    // no payment flow.
                    <button
                      type="button"
                      className="cd-cta-btn"
                      onClick={() => handleCheckout('')}
                      disabled={checkoutBusy}
                    >
                      {checkoutBusy ? (
                        <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                      ) : (
                        <i className="fas fa-arrow-right" aria-hidden="true" />
                      )}
                      {isHt ? 'Enskri' : 'Enroll Now'}
                    </button>
                  ) : (
                    // Paid course — promo code + real checkout. Promo
                    // validation happens SERVER-SIDE; 100% promos grant
                    // access without payment.
                    <button
                      type="button"
                      className="cd-cta-btn"
                      onClick={() => handleCheckout(promoCode)}
                      disabled={checkoutBusy}
                    >
                      {checkoutBusy ? (
                        <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                      ) : (
                        <i className="fas fa-arrow-right" aria-hidden="true" />
                      )}
                      {isHt ? 'Enskri' : 'Enroll Now'}
                    </button>
                  )}
                </div>
                {!isExternal && !isEnrolled && (
                  <div className="cd-promo-row">
                    {Number(course.price) !== 0 && (
                      <input
                        className="cd-promo-input"
                        value={promoCode}
                        onChange={(e) => {
                          setPromoCode(e.target.value);
                          setPromoErr('');
                          setPromoMsg('');
                        }}
                        placeholder={isHt ? 'Kòd promosyon (eg. WELCOME20)' : 'Promo code (e.g. WELCOME20)'}
                        aria-label={isHt ? 'Kòd promosyon' : 'Promo code'}
                      />
                    )}
                    {/* Mesaj siksè/erè yo toujou parèt — yon enskripsyon
                        ki echwe (401, rezo, kòd pwomòs move...) pa janm
                        dwe sanble "pa fè anyen". */}
                    {promoErr && <span className="cd-promo-error" role="alert"><i className="fas fa-circle-exclamation" aria-hidden="true" /> {promoErr}</span>}
                    {promoMsg && <span className="cd-promo-msg"><i className="fas fa-circle-check" aria-hidden="true" /> {promoMsg}</span>}
                  </div>
                )}
                {isExternal ? (
                  <p className="cd-price-disclaimer">
                    <i className="fas fa-globe" aria-hidden="true" />{' '}
                    {isHt
                      ? 'Aprantisaj la fèt sou yon lòt platfòm — klike sou bouton an pou w ale dirèkteman sou kou a.'
                      : 'Learning happens on another platform — click the button to go directly to the course.'}
                  </p>
                ) : isEnrolled ? (
                  <p className="cd-price-disclaimer">
                    <i className="fas fa-check-circle" aria-hidden="true" />{' '}
                    {isHt
                      ? 'Ou gen aksè sou kou a.'
                      : 'You have access to this course.'}
                  </p>
                ) : Number(course.price) === 0 ? (
                  <p className="cd-price-disclaimer">
                    {t.explore_price_disclaimer || (isHt
                      ? 'Kou gratis — ou ka enskri dirèkteman, pa gen peman nesesè.'
                      : 'Free course — enroll directly, no payment required.')}
                  </p>
                ) : (
                  <p className="cd-price-disclaimer">
                    {t.explore_price_disclaimer || (isHt
                      ? 'Aplike yon kòd promosyon pou rabè. Tout validasyon fèt sou sèvè a.'
                      : 'Apply a promo code for a discount. All validation happens server-side.')}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* ─── Course FAQ ─────────────────────────────────── */}
          <section className="cd-section">
            <CourseFaqSection courseId={course.id} lang={lang} />
          </section>
        </div>
      </div>

      {/* ─── Scroll-to-top ─────────────────────────────────── */}
      {scrolled && (
        <button
          type="button"
          className="cd-scroll-top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label={isHt ? 'Retounen anwo' : 'Back to top'}
        >
          <i className="fas fa-arrow-up" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
