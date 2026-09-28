/**
 * src/components/learning/CurriculumPlayer.jsx (v2 — UX Enhanced)
 *
 * Student-facing course player for the Chapter → Lesson → ContentBlock
 * curriculum hierarchy.
 *
 * UX Improvements over v1:
 *   - Visual sidebar with chapter icons, lesson status dots, hover effects
 *   - Larger progress bar with animated fill + percentage badge
 *   - Smooth fade/slide transitions between lessons
 *   - Celebration animation on lesson completion
 *   - Better empty states with illustrations
 *   - Improved mobile layout (full-screen sidebar overlay)
 *   - Keyboard shortcuts (← → for navigation, Escape to close sidebar)
 *   - Course color theming based on category
 *   - Block completion checkmarks in sidebar
 *   - Sticky header with breadcrumb
 */
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { chapterService, lessonService, contentBlockService, progressService, courseService } from '../../services/api';
import { BlockRenderer } from './blocks';
import { getBlockMeta } from './blocks/registry';
import SEOHead, { courseSchema } from '../shared/SEOHead';
import CourseAIChat from './CourseAIChat';

// ─── Course color themes by category ──────────────────────────────
const CATEGORY_COLORS = {
  Programming: { primary: '#3b82f6', light: '#dbeafe', dark: '#1e40af', icon: 'fa-code' },
  'Web Development': { primary: '#3b82f6', light: '#dbeafe', dark: '#1e40af', icon: 'fa-globe' },
  Music: { primary: '#ec4899', light: '#fce7f3', dark: '#9d174d', icon: 'fa-music' },
  Design: { primary: '#8b5cf6', light: '#ede9fe', dark: '#5b21b6', icon: 'fa-palette' },
  Language: { primary: '#10b981', light: '#d1fae5', dark: '#065f46', icon: 'fa-language' },
  Business: { primary: '#f59e0b', light: '#fef3c7', dark: '#92400e', icon: 'fa-briefcase' },
  Marketing: { primary: '#ef4444', light: '#fee2e2', dark: '#991b1b', icon: 'fa-bullhorn' },
  default: { primary: '#6366f1', light: '#e0e7ff', dark: '#3730a3', icon: 'fa-graduation-cap' },
};

function getTheme(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.default;
}

// ─── Styles ───────────────────────────────────────────────────────
const base = {
  container: { display: 'flex', height: '100%', background: 'var(--bg, #0f172a)', color: 'var(--text, #e2e8f0)', fontFamily: "'Inter', -apple-system, sans-serif" },

  // Sidebar
  sidebar: { width: 320, flexShrink: 0, borderRight: '1px solid var(--border-color, #1e293b)', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width 0.25s ease' },
  sidebarHeader: { padding: '16px 18px', borderBottom: '1px solid var(--border-color, #1e293b)' },
  sidebarCourseTitle: { fontWeight: 800, fontSize: '0.95rem', lineHeight: 1.3, marginBottom: 10, color: '#f1f5f9' },
  progressContainer: { display: 'flex', alignItems: 'center', gap: 10 },
  progressTrack: { flex: 1, height: 8, background: '#1e293b', borderRadius: 4, overflow: 'hidden', position: 'relative' },
  progressFill: (pct, color) => ({ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)`, borderRadius: 4, transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)', position: 'relative' }),
  progressBadge: (pct, color) => ({
    fontSize: '0.72rem', fontWeight: 700, color: pct === 100 ? '#10b981' : color,
    minWidth: 36, textAlign: 'right',
  }),
  chapterList: { flex: 1, overflowY: 'auto', padding: '8px 0', scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' },

  // Chapter
  chapter: { padding: '0 0 2px' },
  chapterBtn: (isActive, color) => ({
    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 18px', background: isActive ? `${color}12` : 'none',
    border: 'none', color: isActive ? color : '#94a3b8',
    cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'inherit', textAlign: 'left',
    transition: 'background 0.15s, color 0.15s',
    borderLeft: isActive ? `3px solid ${color}` : '3px solid transparent',
  }),
  chapterIcon: (color) => ({
    width: 28, height: 28, borderRadius: 8, display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem',
    background: `${color}15`, color, flexShrink: 0,
  }),
  chapterTitle: { flex: 1, fontWeight: 600 },
  chapterCount: { fontSize: '0.68rem', color: '#64748b', background: '#1e293b', padding: '2px 6px', borderRadius: 4 },

  // Lessons
  lessonList: { padding: '2px 0 6px 0' },
  lessonBtn: (isActive) => ({
    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
    padding: '7px 18px 7px 44px', background: isActive ? 'rgba(59,130,246,0.1)' : 'none',
    border: 'none', color: isActive ? '#e2e8f0' : '#94a3b8',
    cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'inherit', textAlign: 'left',
    transition: 'background 0.15s',
  }),
  lessonDot: (done, active, color) => ({
    width: done ? 10 : 7, height: done ? 10 : 7, borderRadius: '50%', flexShrink: 0,
    background: done ? '#10b981' : active ? color : '#334155',
    border: done ? '2px solid #10b98133' : active ? `2px solid ${color}33` : 'none',
    transition: 'all 0.2s',
  }),
  lessonTitle: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  lessonCheck: { fontSize: '0.65rem', color: '#10b981', flexShrink: 0 },

  // Main content
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 },
  mainHeader: (color) => ({
    padding: '12px 24px', borderBottom: '1px solid var(--border-color, #1e293b)',
    display: 'flex', alignItems: 'center', gap: 12,
    background: `linear-gradient(180deg, ${color}08 0%, transparent 100%)`,
  }),
  mainTitle: { fontWeight: 700, fontSize: '1.05rem', flex: 1 },
  mainMeta: { fontSize: '0.75rem', color: '#94a3b8' },
  mainBody: { flex: 1, overflowY: 'auto', padding: '24px 28px', scrollBehavior: 'smooth' },
  blockCard: { marginBottom: 16, padding: 18, borderRadius: 12, background: 'var(--bg-elevated, #1e293b)', border: '1px solid var(--border-color, #334155)', transition: 'border-color 0.2s' },

  // Navigation
  navBar: { padding: '12px 24px', borderTop: '1px solid var(--border-color, #1e293b)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg, #0f172a)' },
  navBtn: { padding: '8px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' },
  navBtnPrimary: (color) => ({ background: color, color: '#fff', boxShadow: `0 2px 8px ${color}40` }),
  navBtnSecondary: { background: 'transparent', color: '#94a3b8', border: '1px solid #334155' },

  // Empty states
  empty: { textAlign: 'center', padding: '60px 24px', color: '#64748b' },
  emptyIcon: { fontSize: '2.5rem', marginBottom: 12, opacity: 0.3 },
  emptyTitle: { fontWeight: 600, fontSize: '1rem', marginBottom: 6, color: '#94a3b8' },
  emptyDesc: { fontSize: '0.82rem', maxWidth: 320, margin: '0 auto', lineHeight: 1.5 },

  // Celebration
  celebration: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 9999 },
  confetti: (i) => ({
    position: 'absolute', width: 8, height: 8, borderRadius: 2,
    background: ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6'][i % 5],
    top: `${20 + Math.random() * 60}%`, left: `${10 + Math.random() * 80}%`,
    animation: `confettiFall ${1 + Math.random()}s ease-out forwards`,
    transform: `rotate(${Math.random() * 360}deg)`,
  }),

  // Mobile
  mobileToggle: { display: 'none', position: 'fixed', bottom: 80, left: 16, zIndex: 100, width: 48, height: 48, borderRadius: 24, border: 'none', background: 'var(--color-primary, #3b82f6)', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', fontSize: '1.1rem' },
};

export default function CurriculumPlayer({
  courseId,
  lang = 'ht',
  progress: progressProp,
  onBlockComplete,
  onLessonComplete,
}) {
  const isHt = lang === 'ht';

  // ─── State ──────────────────────────────────────────────────
  const [chapters, setChapters] = useState([]);
  const [lessonsMap, setLessonsMap] = useState({});
  const [blocksMap, setBlocksMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeChapterId, setActiveChapterId] = useState(null);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [completedBlocks, setCompletedBlocks] = useState(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [progressData, setProgressData] = useState(null);
  const [courseData, setCourseData] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [lessonTransition, setLessonTransition] = useState(false);
  const progressIdRef = useRef(null);

  // ─── Derived ─────────────────────────────────────────────────
  const theme = useMemo(() => getTheme(courseData?.category), [courseData?.category]);
  const activeChapter = useMemo(() => chapters.find((c) => c.id === activeChapterId), [chapters, activeChapterId]);
  const activeLesson = useMemo(() => {
    const lessons = lessonsMap[activeChapterId] || [];
    return lessons.find((l) => l.id === activeLessonId);
  }, [lessonsMap, activeChapterId, activeLessonId]);
  const activeBlocks = useMemo(() => blocksMap[activeLessonId] || [], [blocksMap, activeLessonId]);
  const flatLessons = useMemo(() => chapters.flatMap((ch) => lessonsMap[ch.id] || []), [chapters, lessonsMap]);
  const currentIdx = useMemo(() => flatLessons.findIndex((l) => l.id === activeLessonId), [flatLessons, activeLessonId]);

  const totalBlocks = useMemo(() => {
    return chapters.reduce((sum, ch) => {
      const lessons = lessonsMap[ch.id] || [];
      return sum + lessons.reduce((s, l) => s + (blocksMap[l.id]?.length || 0), 0);
    }, 0);
  }, [chapters, lessonsMap, blocksMap]);

  const progressPct = useMemo(() => {
    if (totalBlocks === 0) return 0;
    return Math.round((completedBlocks.size / totalBlocks) * 100);
  }, [completedBlocks, totalBlocks]);

  // ─── Load data ───────────────────────────────────────────────
  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const chRes = await chapterService.list(courseId);
        const chs = Array.isArray(chRes.data) ? chRes.data : (chRes.data?.results || []);
        if (cancelled) return;
        setChapters(chs);

        const lMap = {};
        await Promise.all(chs.map(async (ch) => {
          try {
            const lr = await lessonService.list(ch.id);
            lMap[ch.id] = Array.isArray(lr.data) ? lr.data : (lr.data?.results || []);
          } catch { lMap[ch.id] = ch.lessons || []; }
        }));
        if (cancelled) return;
        setLessonsMap(lMap);

        try {
          const cRes = await courseService.getById(courseId);
          if (cRes?.data) setCourseData(cRes.data);
        } catch { /* best effort */ }

        try {
          const progRes = await progressService.getAll();
          const progList = Array.isArray(progRes.data) ? progRes.data : (progRes.data?.results || []);
          const prog = progList.find((p) => String(p.course) === String(courseId));
          if (prog) {
            setProgressData(prog);
            progressIdRef.current = prog.id;
            const completed = new Set();
            if (prog.completed_blocks) {
              Object.values(prog.completed_blocks).flat().forEach((b) => completed.add(String(b)));
            }
            setCompletedBlocks(completed);
          }
        } catch { /* best effort */ }

        // Auto-select first chapter + lesson
        if (chs.length > 0 && !activeChapterId) {
          const firstCh = chs[0];
          setActiveChapterId(firstCh.id);
          const firstLessons = lMap[firstCh.id] || [];
          if (firstLessons.length > 0) setActiveLessonId(firstLessons[0].id);
        }
      } catch (err) {
        console.error('[CurriculumPlayer] Load error:', err);
      } finally {
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [courseId]);

  // ─── Load blocks for active lesson ──────────────────────────
  useEffect(() => {
    if (!activeLessonId) return;
    let cancelled = false;
    (async () => {
      try {
        const bRes = await contentBlockService.list(activeLessonId);
        const blocks = Array.isArray(bRes.data) ? bRes.data : (bRes.data?.results || []);
        if (!cancelled) setBlocksMap((prev) => ({ ...prev, [activeLessonId]: blocks }));
      } catch {
        // Fallback: use blocks from lesson data
        const lessons = lessonsMap[activeChapterId] || [];
        const lesson = lessons.find((l) => l.id === activeLessonId);
        if (lesson?.content_blocks && !cancelled) {
          setBlocksMap((prev) => ({ ...prev, [activeLessonId]: lesson.content_blocks }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [activeLessonId, activeChapterId, lessonsMap]);

  // ─── Navigation ─────────────────────────────────────────────
  const goToLesson = useCallback((lessonId) => {
    setLessonTransition(true);
    setTimeout(() => {
      setActiveLessonId(lessonId);
      setLessonTransition(false);
    }, 150);
  }, []);

  const goNext = useCallback(() => {
    if (currentIdx < flatLessons.length - 1) {
      goToLesson(flatLessons[currentIdx + 1].id);
    }
  }, [currentIdx, flatLessons, goToLesson]);

  const goPrev = useCallback(() => {
    if (currentIdx > 0) {
      goToLesson(flatLessons[currentIdx - 1].id);
    }
  }, [currentIdx, flatLessons, goToLesson]);

  // ─── Block completion ───────────────────────────────────────
  const handleBlockComplete = useCallback((blockId) => {
    setCompletedBlocks((prev) => new Set([...prev, String(blockId)]));
    onBlockComplete?.(blockId);
    // Save to backend
    if (progressIdRef.current) {
      progressService.update(progressIdRef.current, {
        completed_blocks: { [activeLessonId]: [...completedBlocks, String(blockId)] },
      }).catch(() => {});
    }
  }, [activeLessonId, completedBlocks, onBlockComplete]);

  // ─── Celebration ────────────────────────────────────────────
  const triggerCelebration = useCallback(() => {
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 2000);
  }, []);

  // ─── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev]);

  // ─── SEO ────────────────────────────────────────────────────
  const seoTitle = useMemo(() => {
    if (!courseData) return isHt ? 'Kou' : 'Course';
    return `${courseData.title} — Atelnyo`;
  }, [courseData, isHt]);
  const seoDescription = courseData?.description?.slice(0, 160) || '';
  const seoImage = courseData?.image_url || '';
  const seoUrl = typeof window !== 'undefined' ? window.location.href : '';
  const breadcrumbs = useMemo(() => {
    const crumbs = [{ name: 'Atelnyo', url: '/' }, { name: isHt ? 'Kou' : 'Courses', url: '/explore' }];
    if (courseData?.title) crumbs.push({ name: courseData.title });
    if (activeChapter?.title) crumbs.push({ name: activeChapter.title });
    if (activeLesson?.title) crumbs.push({ name: activeLesson.title });
    return crumbs;
  }, [courseData, activeChapter, activeLesson, isHt]);

  // ─── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ ...base.container, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid ${theme.primary}33`, borderTopColor: theme.primary, animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{isHt ? 'Ap chaje kou a...' : 'Loading course...'}</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ─── Empty state ────────────────────────────────────────────
  if (chapters.length === 0) {
    return (
      <div style={{ ...base.container, alignItems: 'center', justifyContent: 'center' }}>
        <SEOHead title={seoTitle} description={seoDescription} image={seoImage} url={seoUrl} type="course" lang={lang} breadcrumbs={breadcrumbs} />
        <div style={base.empty}>
          <div style={{ fontSize: '3rem', marginBottom: 16, opacity: 0.2 }}>📚</div>
          <div style={base.emptyTitle}>{isHt ? 'Kou sa a poko gen chapit' : 'This course has no chapters yet'}</div>
          <div style={base.emptyDesc}>{isHt ? 'Kreyatè a ap prepare kontni an. Tann yon ti pleasantly!' : 'The creator is preparing content. Check back soon!'}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={base.container}>
      <SEOHead
        title={activeLesson ? `${seoTitle} — ${activeLesson.title}` : seoTitle}
        description={activeLesson?.description || seoDescription}
        image={seoImage} url={seoUrl} type="course" lang={lang}
        schema={courseData ? courseSchema(courseData, courseData.created_by_username) : undefined}
        breadcrumbs={breadcrumbs}
        keywords={courseData?.tags || [courseData?.category, courseData?.difficulty].filter(Boolean)}
      />

      {/* Skip to content */}
      <a href="#cp-main-content" style={{ position: 'absolute', left: -9999, top: 0, zIndex: 9999, padding: '8px 16px', background: theme.primary, color: '#fff', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600 }} onFocus={(e) => { e.target.style.left = 8; e.target.style.top = 8; }} onBlur={(e) => { e.target.style.left = -9999; }}>
        {isHt ? 'Pase nan kontni an' : 'Skip to content'}
      </a>

      {/* Screen reader live region */}
      <div aria-live="polite" aria-atomic="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
        {activeLesson && `${isHt ? 'Leson aktif:' : 'Active lesson:'} ${activeLesson.title || ''}`}
      </div>

      {/* ═══ Sidebar ═══ */}
      <nav
        aria-label={isHt ? 'Kurikilom kou a' : 'Course curriculum'}
        style={{ ...base.sidebar, ...(typeof window !== 'undefined' && window.innerWidth < 768 && !sidebarOpen ? { display: 'none' } : {}) }}
      >
        {/* Header + Progress */}
        <div style={base.sidebarHeader}>
          <div style={base.sidebarCourseTitle}>{courseData?.title || (isHt ? 'Kou' : 'Course')}</div>
          <div style={base.progressContainer}>
            <div style={base.progressTrack}>
              <div style={base.progressFill(progressPct, theme.primary)} />
            </div>
            <span style={base.progressBadge(progressPct, theme.primary)}>{progressPct}%</span>
          </div>
        </div>

        {/* Chapter list */}
        <div style={base.chapterList}>
          {chapters.map((ch, ci) => {
            const lessons = lessonsMap[ch.id] || [];
            const isActive = ch.id === activeChapterId;
            const chDone = lessons.every((l) => {
              const blocks = blocksMap[l.id] || [];
              return blocks.length > 0 && blocks.every((b) => completedBlocks.has(String(b.id)));
            });
            return (
              <div key={ch.id} style={base.chapter}>
                <button
                  type="button"
                  style={base.chapterBtn(isActive, theme.primary)}
                  onClick={() => setActiveChapterId(ch.id === activeChapterId ? null : ch.id)}
                >
                  <div style={base.chapterIcon(theme.primary)}>
                    {chDone ? <i className="fas fa-check" /> : <i className={`fas fa-${String(ci + 1)}`} style={{ fontSize: '0.65rem' }} />}
                  </div>
                  <span style={base.chapterTitle}>{ch.title || `${isHt ? 'Chapit' : 'Chapter'} ${ci + 1}`}</span>
                  <span style={base.chapterCount}>{lessons.length}</span>
                </button>

                {isActive && (
                  <div role="list" style={base.lessonList}>
                    {lessons.map((l) => {
                      const isLessonActive = l.id === activeLessonId;
                      const blocks = blocksMap[l.id] || [];
                      const lessonDone = blocks.length > 0 && blocks.every((b) => completedBlocks.has(String(b.id)));
                      return (
                        <button
                          key={l.id}
                          type="button"
                          role="listitem"
                          aria-current={isLessonActive ? 'step' : undefined}
                          style={base.lessonBtn(isLessonActive)}
                          onClick={() => goToLesson(l.id)}
                        >
                          <div style={base.lessonDot(lessonDone, isLessonActive, theme.primary)} />
                          <span style={base.lessonTitle}>{l.title || `${isHt ? 'Leson' : 'Lesson'} ${lessons.indexOf(l) + 1}`}</span>
                          {lessonDone && <i className="fas fa-check-circle" style={base.lessonCheck} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* ═══ Main content ═══ */}
      <main id="cp-main-content" style={base.main} aria-label={activeLesson ? `${isHt ? 'Kontni leson' : 'Lesson content'}: ${activeLesson.title}` : ''}>
        {activeLesson ? (
          <>
            {/* Sticky header */}
            <header style={base.mainHeader(theme.primary)}>
              <button
                type="button"
                style={{ ...base.navBtn, ...base.navBtnSecondary, display: typeof window !== 'undefined' && window.innerWidth < 768 ? 'flex' : 'none' }}
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <i className="fas fa-bars" />
              </button>
              <div style={{ flex: 1 }}>
                <div style={base.mainTitle}>{activeLesson.title || `${isHt ? 'Leson' : 'Lesson'} ${currentIdx + 1}`}</div>
                <div style={base.mainMeta}>{activeChapter?.title || ''} · {activeBlocks.length} {isHt ? 'blòk' : 'blocks'}</div>
              </div>
              <span style={{ fontSize: '0.78rem', color: '#64748b', background: '#1e293b', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>
                {currentIdx + 1} / {flatLessons.length}
              </span>
            </header>

            {/* Blocks with fade transition */}
            <section
              style={{
                ...base.mainBody,
                opacity: lessonTransition ? 0 : 1,
                transform: lessonTransition ? 'translateY(8px)' : 'translateY(0)',
                transition: 'opacity 0.2s ease, transform 0.2s ease',
              }}
            >
              {activeBlocks.length === 0 ? (
                <div style={base.empty}>
                  <div style={{ fontSize: '2rem', marginBottom: 12, opacity: 0.2 }}>📝</div>
                  <div style={base.emptyTitle}>{isHt ? 'Leson sa a pa gen kontni ankò' : 'This lesson has no content yet'}</div>
                  <div style={base.emptyDesc}>{isHt ? 'Kreyatè a ap prepare kontni an. Tann yon ti pleasant!' : 'Content is being prepared. Check back soon!'}</div>
                </div>
              ) : (
                activeBlocks.map((block, bi) => (
                  <div
                    key={block.id || bi}
                    style={{
                      ...base.blockCard,
                      animation: `fadeSlideIn 0.3s ease ${bi * 0.05}s both`,
                    }}
                  >
                    <BlockRenderer
                      block={block}
                      lang={lang}
                      courseId={courseId}
                      moduleIndex={0}
                      onComplete={() => handleBlockComplete(block.id)}
                      onViewed={() => handleBlockComplete(block.id)}
                    />
                  </div>
                ))
              )}
            </section>

            {/* Navigation bar */}
            <nav style={base.navBar}>
              <button
                type="button"
                style={{ ...base.navBtn, ...base.navBtnSecondary }}
                onClick={goPrev}
                disabled={currentIdx <= 0}
              >
                <i className="fas fa-arrow-left" /> {isHt ? 'Anvan' : 'Previous'}
              </button>
              <div style={{ flex: 1 }} />
              {currentIdx < flatLessons.length - 1 ? (
                <button
                  type="button"
                  style={{ ...base.navBtn, ...base.navBtnPrimary(theme.primary) }}
                  onClick={goNext}
                >
                  {isHt ? 'Pwochen' : 'Next'} <i className="fas fa-arrow-right" />
                </button>
              ) : (
                <button
                  type="button"
                  style={{ ...base.navBtn, ...base.navBtnPrimary('#10b981') }}
                  onClick={() => { triggerCelebration(); onLessonComplete?.(activeLessonId); }}
                >
                  <i className="fas fa-check" /> {isHt ? 'Fini kou a' : 'Complete course'}
                </button>
              )}
            </nav>
          </>
        ) : (
          <div style={{ ...base.empty, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16, opacity: 0.15 }}>👆</div>
            <div style={base.emptyTitle}>{isHt ? 'Chwazi yon leson' : 'Select a lesson'}</div>
            <div style={base.emptyDesc}>{isHt ? 'Klike sou yon leson nan tablo bò gòch la pou kòmanse aprann.' : 'Click a lesson in the sidebar to start learning.'}</div>
          </div>
        )}
      </main>

      {/* ═══ Celebration overlay ═══ */}
      {showCelebration && (
        <div style={base.celebration}>
          {Array.from({ length: 20 }, (_, i) => (
            <div key={i} style={base.confetti(i)} />
          ))}
          <style>{`
            @keyframes confettiFall {
              0% { opacity: 1; transform: translateY(0) rotate(0deg); }
              100% { opacity: 0; transform: translateY(100vh) rotate(720deg); }
            }
          `}</style>
        </div>
      )}

      {/* ═══ Mobile sidebar toggle ═══ */}
      <button
        type="button"
        style={base.mobileToggle}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={isHt ? 'Tablo leson' : 'Lesson list'}
      >
        <i className={`fas ${sidebarOpen ? 'fa-times' : 'fa-book-open'}`} />
      </button>

      {/* ═══ Global animations CSS ═══ */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 768px) {
          .cp-mobile-toggle { display: flex !important; align-items: center; justify-content: center; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
        @media (prefers-contrast: more) {
          [style*="border-color"] { border-color: #000 !important; }
        }
      `}</style>

      {/* ═══ AI Learning Assistant ═══ */}
      <CourseAIChat
        courseTitle={courseData?.title || ''}
        moduleTitle={activeChapter?.title || ''}
        lessonTitle={activeLesson?.title || ''}
        blockContent={activeBlocks.map(b => b.content || b.text || b.code || '').join('\n').slice(0, 1500)}
        lang={lang}
      />
    </div>
  );
}
