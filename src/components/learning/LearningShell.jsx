/**
 * src/components/learning/LearningShell.jsx
 *
 * §1-§60 — Learning Shell Architecture
 *
 * The reusable shell that provides:
 *   • LearningHeader — essential context (back, title, progress, actions)
 *   • CurriculumSidebar — desktop curriculum navigation
 *   • MobileCurriculumDrawer — mobile bottom-sheet curriculum
 *   • LearningContentArea — main content with width tiers
 *   • LearningActionArea — sticky Previous/Continue
 *   • Progressive loading states
 *
 * The shell is INDEPENDENT from individual lesson content.
 * A lesson renders INSIDE the shell via `children`.
 * Future block types do not require modifications to the shell.
 *
 * Usage:
 *   <LearningShell
 *     course={course}
 *     progress={progress}
 *     syllabus={syllabus}
 *     currentModule={moduleIndex}
 *     onBack={handleBack}
 *     onModuleSelect={handleModuleSelect}
 *   >
 *     <LessonContentArea>
 *       {blocks.map(b => <BlockRenderer key={b.id} block={b} />)}
 *     </LessonContentArea>
 *   </LearningShell>
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './LearningShell.css';

// ─── Constants ──────────────────────────────────────────────────

// ─── LearningShell ──────────────────────────────────────────────
export default function LearningShell({
  course,
  progress,
  syllabus = [],
  currentModule = null,
  isSessionActive = false,
  lang = 'ht',
  user,
  onBack,
  onModuleSelect,
  onOpenCourse,
  children,
  // Header action slots
  headerActions,
  // Action area
  actionArea,
  // Focus mode
  focusMode = false,
  onToggleFocus,
  // Custom sidebar header
  sidebarHeader,
  // Custom sidebar footer
  sidebarFooter,
  // §4 — Current position breadcrumb
  currentModuleTitle,
  currentLessonTitle,
}) {
  const isHt = lang === 'ht';
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on escape
  useEffect(() => {
    if (!drawerOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [drawerOpen]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  // Computed data
  const title = course?.title || '';
  const pct = Number(progress?.percentage) || 0;
  const totalModules = syllabus.length;
  const isComplete = pct >= 100;

  // Module states
  const completedModules = useMemo(
    () => (Array.isArray(progress?.completed_modules) ? progress.completed_modules.map(Number) : []),
    [progress],
  );
  const completedBlocksMap = useMemo(() => {
    const m = {};
    const raw = progress?.completed_blocks;
    if (raw && typeof raw === 'object') {
      Object.entries(raw).forEach(([mi, ids]) => {
        m[String(mi)] = new Set(Array.isArray(ids) ? ids : []);
      });
    }
    return m;
  }, [progress]);

  const maxReached = useMemo(() => {
    let m = Number(progress?.last_module_index) || 0;
    completedModules.forEach((i) => { m = Math.max(m, i); });
    return m;
  }, [progress, completedModules]);

  const getModuleState = useCallback((index) => {
    const item = syllabus[index];
    const blocks = (typeof item === 'object' && Array.isArray(item?.blocks)) ? item.blocks : [];
    const done = blocks.filter((b) => completedBlocksMap[String(index)]?.has(b.id)).length;
    const allDone = blocks.length > 0 && done >= blocks.length;
    const inCompletedList = completedModules.includes(index);
    const isCurrent = index === (Number(progress?.last_module_index) || 0);
    if (allDone || inCompletedList) return 'completed';
    if (isCurrent && done === 0) return 'current';
    return 'available';
  }, [syllabus, completedBlocksMap, completedModules, progress]);

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className={`ls-shell${focusMode ? ' is-focus' : ''}`}>
      {/* ─── Header ──────────────────────────────────────────── */}
      <LearningShellHeader
        title={title}
        course={course}
        progress={progress}
        pct={pct}
        isComplete={isComplete}
        isHt={isHt}
        isSessionActive={isSessionActive}
        onBack={onBack}
        onOpenDrawer={() => setDrawerOpen(true)}
        onToggleFocus={onToggleFocus}
        focusMode={focusMode}
        actions={headerActions}
        currentModuleTitle={currentModuleTitle}
        currentLessonTitle={currentLessonTitle}
      />

      {/* ─── Body ────────────────────────────────────────────── */}
      <div className="ls-shell-body">
        {/* ─── Desktop Sidebar ──────────────────────────────── */}
        {!isSessionActive && (
          <CurriculumSidebar
            syllabus={syllabus}
            currentModule={currentModule}
            getModuleState={getModuleState}
            completedBlocksMap={completedBlocksMap}
            maxReached={maxReached}
            pct={pct}
            isHt={isHt}
            onModuleSelect={onModuleSelect}
            header={sidebarHeader}
            footer={sidebarFooter}
          />
        )}

        {/* ─── Main Content ─────────────────────────────────── */}
        <div className="ls-shell-content" role="region" aria-label={isHt ? 'Kontni leson' : 'Lesson content'}>
          {children}
        </div>
      </div>

      {/* ─── Action Area ────────────────────────────────────── */}
      {actionArea && (
        <div className="ls-action-area" role="navigation" aria-label={isHt ? 'Navigasyon leson' : 'Lesson navigation'}>
          <div className="ls-action-area-inner">
            {actionArea}
          </div>
        </div>
      )}

      {/* ─── Mobile Curriculum Drawer ───────────────────────── */}
      {!isSessionActive && (
        <MobileCurriculumDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          syllabus={syllabus}
          currentModule={currentModule}
          getModuleState={getModuleState}
          completedBlocksMap={completedBlocksMap}
          maxReached={maxReached}
          pct={pct}
          isHt={isHt}
          onModuleSelect={(idx) => {
            onModuleSelect?.(idx);
            setDrawerOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ─── LearningShellHeader ──────────────────────────────────────
function LearningShellHeader({
  title,
  course,
  progress,
  pct,
  isComplete,
  isHt,
  isSessionActive,
  onBack,
  onOpenDrawer,
  onToggleFocus,
  focusMode,
  actions,
  // §4 — Current position breadcrumb
  currentModuleTitle,
  currentLessonTitle,
}) {
  const subtitle = course?.learner_language && course?.teaching_language
    ? `${course.learner_language} → ${course.teaching_language}`
    : '';

  // §4 — Breadcrumb: Course → Module → Lesson (responsive)
  const hasBreadcrumb = isSessionActive && (currentModuleTitle || currentLessonTitle);

  return (
    <header className="ls-shell-header" role="banner">
      <button
        type="button"
        className="ls-shell-header-back"
        onClick={onBack}
        aria-label={isHt ? 'Retounen' : 'Back'}
      >
        <i className="fas fa-arrow-left" aria-hidden="true" />
      </button>

      <div className="ls-shell-header-info">
        <div className="ls-shell-header-title">{title}</div>
        {/* §4 — Show breadcrumb on session, subtitle on overview */}
        {hasBreadcrumb ? (
          <div className="ls-shell-header-subtitle" aria-label={isHt ? 'Kote ou ye' : 'Current position'}>
            {currentModuleTitle && (
              <span>{currentModuleTitle}</span>
            )}
            {currentModuleTitle && currentLessonTitle && (
              <span className="ls-breadcrumb-sep">·</span>
            )}
            {currentLessonTitle && (
              <span className="ls-breadcrumb-lesson">{currentLessonTitle}</span>
            )}
          </div>
        ) : subtitle ? (
          <div className="ls-shell-header-subtitle">{subtitle}</div>
        ) : null}
      </div>

      <div className="ls-shell-header-actions">
        {/* Mobile curriculum button */}
        {!isSessionActive && (
          <button
            type="button"
            className="ls-shell-header-btn"
            onClick={onOpenDrawer}
            aria-label={isHt ? 'Kourikoulòm' : 'Curriculum'}
            aria-haspopup="dialog"
          >
            <i className="fas fa-bars-staggered" aria-hidden="true" />
          </button>
        )}

        {/* Focus mode toggle */}
        {onToggleFocus && (
          <button
            type="button"
            className={`ls-shell-header-btn${focusMode ? ' is-active' : ''}`}
            onClick={onToggleFocus}
            aria-label={isHt ? 'Mòd Konsantre' : 'Focus Mode'}
            aria-pressed={focusMode}
          >
            <i className={`fas ${focusMode ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true" />
          </button>
        )}

        {/* Custom header actions */}
        {actions}
      </div>

      {/* Progress bar */}
      {!isSessionActive && pct > 0 && (
        <div className="ls-shell-progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="ls-shell-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      )}
    </header>
  );
}

// ─── CurriculumSidebar (Desktop) ───────────────────────────────
function CurriculumSidebar({
  syllabus,
  currentModule,
  getModuleState,
  completedBlocksMap,
  maxReached,
  pct,
  isHt,
  onModuleSelect,
  header,
  footer,
}) {
  return (
    <nav className="ls-shell-sidebar" role="navigation" aria-label={isHt ? 'Kourikoulòm' : 'Curriculum'}>
      {header && <div className="ls-shell-sidebar-header">{header}</div>}

      {!header && (
        <div className="ls-shell-sidebar-header">
          <h2 className="ls-shell-sidebar-title">
            {isHt ? 'Kourikoulòm' : 'Curriculum'}
          </h2>
          <div className="ls-shell-sidebar-meta">
            {pct}% {isHt ? 'konplete' : 'complete'}
          </div>
        </div>
      )}

      <ul className="ls-shell-sidebar-module" role="list">
        {syllabus.map((item, mi) => {
          const state = getModuleState(mi);
          const isFuture = mi > maxReached && state === 'available';
          const modTitle = (typeof item === 'object' && item.title)
            ? item.title
            : `${isHt ? 'Modil' : 'Module'} ${mi + 1}`;
          const blocks = (typeof item === 'object' && Array.isArray(item.blocks)) ? item.blocks : [];
          const doneDots = blocks.filter((b) => completedBlocksMap[String(mi)]?.has(b.id)).length;

          return (
            <li key={mi} className="ls-shell-sidebar-module-item">
              <button
                type="button"
                className={`ls-shell-sidebar-module-btn ${state === 'current' ? 'is-current' : ''} ${state === 'completed' ? 'is-completed' : ''} ${isFuture ? 'is-future' : ''}`}
                onClick={() => !isFuture && onModuleSelect?.(mi)}
                disabled={isFuture}
                aria-current={state === 'current' ? 'step' : undefined}
                aria-label={isHt ? `${modTitle} — ${doneDots}/${blocks.length}` : `${modTitle} — ${doneDots}/${blocks.length}`}
              >
                <span className="ls-shell-sidebar-module-icon">
                  {state === 'completed' ? <i className="fas fa-check" aria-hidden="true" /> :
                   isFuture ? <i className="fas fa-lock" aria-hidden="true" /> :
                   state === 'current' ? <i className="fas fa-play" aria-hidden="true" /> :
                   <span className="ls-shell-sidebar-module-num">{mi + 1}</span>}
                </span>
                <span className="ls-shell-sidebar-module-text">
                  <span className="ls-shell-sidebar-module-title">{modTitle}</span>
                  {blocks.length > 0 && (
                    <span className="ls-shell-sidebar-module-dots" aria-hidden="true">
                      {blocks.map((b, bi) => (
                        <span
                          key={b.id || bi}
                          className={`ls-shell-sidebar-module-dot ${completedBlocksMap[String(mi)]?.has(b.id) ? 'is-done' : ''}`}
                        />
                      ))}
                    </span>
                  )}
                </span>
                <span className="ls-shell-sidebar-module-count">
                  {blocks.length > 0 ? `${doneDots}/${blocks.length}` : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {footer && <div className="ls-shell-sidebar-footer">{footer}</div>}
    </nav>
  );
}

// ─── MobileCurriculumDrawer (§9) ──────────────────────────────
function MobileCurriculumDrawer({
  isOpen,
  onClose,
  syllabus,
  currentModule,
  getModuleState,
  completedBlocksMap,
  maxReached,
  pct,
  isHt,
  onModuleSelect,
}) {
  const drawerRef = useRef(null);

  // Trap focus inside drawer when open
  useEffect(() => {
    if (!isOpen) return;
    const el = drawerRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length > 0) focusable[0].focus();
  }, [isOpen]);

  return (
    <>
      {/* Overlay */}
      <div
        className={`ls-mobile-drawer-overlay${isOpen ? ' is-open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`ls-mobile-drawer${isOpen ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={isHt ? 'Kourikoulòm' : 'Curriculum'}
      >
        {/* Drag handle */}
        <div className="ls-mobile-drawer-handle">
          <div className="ls-mobile-drawer-handle-bar" />
        </div>

        {/* Header */}
        <div className="ls-mobile-drawer-header">
          <h2 className="ls-mobile-drawer-title">
            {isHt ? 'Kourikoulòm' : 'Curriculum'}
          </h2>
          <button
            type="button"
            className="ls-mobile-drawer-close"
            onClick={onClose}
            aria-label={isHt ? 'Fèmen' : 'Close'}
          >
            <i className="fas fa-xmark" aria-hidden="true" />
          </button>
        </div>

        {/* Progress */}
        <div className="ls-mobile-drawer-progress">
          {pct}% {isHt ? 'konplete' : 'complete'}
        </div>

        {/* Module list */}
        <div className="ls-mobile-drawer-body">
          <ul className="ls-mobile-drawer-module" role="list">
            {syllabus.map((item, mi) => {
              const state = getModuleState(mi);
              const isFuture = mi > maxReached && state === 'available';
              const modTitle = (typeof item === 'object' && item.title)
                ? item.title
                : `${isHt ? 'Modil' : 'Module'} ${mi + 1}`;
              const blocks = (typeof item === 'object' && Array.isArray(item.blocks)) ? item.blocks : [];
              const doneDots = blocks.filter((b) => completedBlocksMap[String(mi)]?.has(b.id)).length;
              const isCurrent = mi === currentModule;

              return (
                <li key={mi} className="ls-mobile-drawer-module-item">
                  <button
                    type="button"
                    className={`ls-mobile-drawer-module-btn ${isCurrent ? 'is-current' : ''} ${state === 'completed' ? 'is-completed' : ''} ${isFuture ? 'is-future' : ''}`}
                    onClick={() => !isFuture && onModuleSelect?.(mi)}
                    disabled={isFuture}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    <span className={`ls-shell-sidebar-module-icon ${state === 'completed' ? 'is-completed' : ''} ${isCurrent ? 'is-current' : ''}`}>
                      {state === 'completed' ? <i className="fas fa-check" aria-hidden="true" /> :
                       isFuture ? <i className="fas fa-lock" aria-hidden="true" /> :
                       isCurrent ? <i className="fas fa-play" aria-hidden="true" /> :
                       <span className="ls-shell-sidebar-module-num">{mi + 1}</span>}
                    </span>
                    <span className="ls-shell-sidebar-module-text">
                      <span className="ls-shell-sidebar-module-title">{modTitle}</span>
                      {blocks.length > 0 && (
                        <span className="ls-shell-sidebar-module-dots" aria-hidden="true">
                          {blocks.map((b, bi) => (
                            <span
                              key={b.id || bi}
                              className={`ls-shell-sidebar-module-dot ${completedBlocksMap[String(mi)]?.has(b.id) ? 'is-done' : ''}`}
                            />
                          ))}
                        </span>
                      )}
                    </span>
                    <span className="ls-mobile-drawer-module-count">
                      {blocks.length > 0 ? `${doneDots}/${blocks.length}` : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}

// ─── LessonContentArea ─────────────────────────────────────────
// §10 — The center of the Learning Experience
export function LessonContentArea({ children, className = '' }) {
  return (
    <div className={`ls-lesson-area ${className}`}>
      <div className="ls-lesson-area-inner">
        {children}
      </div>
    </div>
  );
}

// ─── BlockPlacementWrapper ─────────────────────────────────────
// §14-§17 — Every block renders inside a predictable layout contract
export function BlockPlacementWrapper({ block, width = 'content', children }) {
  // Determine block category for vertical rhythm
  const getCategory = (type) => {
    if (['text', 'callout', 'embed', 'timeline'].includes(type)) return 'content';
    if (['image', 'video', 'audio_record'].includes(type)) return 'media';
    if (['quiz', 'assignment', 'project', 'exercise', 'checklist'].includes(type)) return 'assessment';
    // Everything else is interactive
    return 'interactive';
  };

  const category = getCategory(block?.type);

  return (
    <div className={`ls-block-placement ls-block-placement--${category}`}>
      <div className={`ls-block-width ls-block-width--${width}`}>
        {children}
      </div>
    </div>
  );
}

// ─── BlockErrorBoundary ────────────────────────────────────────
// §17 — If one block fails, do not crash the entire lesson
export class BlockErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[BlockErrorBoundary]', error?.message, info?.componentStack?.slice(0, 300));
  }

  render() {
    if (this.state.hasError) {
      const { isHt = false, onRetry, blockType } = this.props;
      return (
        <div className="ls-block-error" role="alert">
          <div className="ls-block-error-icon">
            <i className="fas fa-triangle-exclamation" aria-hidden="true" />
          </div>
          <div className="ls-block-error-label">
            {isHt
              ? 'Aktivite sa a pa t kapab chaje.'
              : 'This activity could not load.'}
          </div>
          {blockType && (
            <div className="ls-block-error-type">
              {isHt ? 'Kalite:' : 'Type:'} {blockType}
            </div>
          )}
          {onRetry && (
            <button type="button" className="ls-block-error-retry" onClick={onRetry}>
              <i className="fas fa-rotate-right" aria-hidden="true" />
              {isHt ? 'Eseye ankò' : 'Retry'}
            </button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── LoadingShell ──────────────────────────────────────────────
// §45 — Progressive loading: shell → context → content → blocks
export function LoadingShell({ isHt = false }) {
  return (
    <div className="ls-shell" role="status" aria-busy="true" aria-label={isHt ? 'Ap chaje...' : 'Loading...'}>
      {/* Skeleton header */}
      <div className="ls-shell-header ls-skel-header" aria-hidden="true">
        <div className="ls-shell-skeleton ls-skel-back" />
        <div className="ls-skel-header-info">
          <div className="ls-shell-skeleton ls-skel-title" />
          <div className="ls-shell-skeleton ls-skel-subtitle" />
        </div>
      </div>

      <div className="ls-shell-body">
        {/* Skeleton sidebar */}
        <div className="ls-shell-sidebar ls-skel-sidebar" aria-hidden="true">
          <div className="ls-shell-skeleton ls-skel-sidebar-title" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="ls-skel-sidebar-item">
              <div className="ls-shell-skeleton ls-skel-sidebar-icon" />
              <div className="ls-shell-skeleton ls-skel-sidebar-text" />
            </div>
          ))}
        </div>

        {/* Skeleton content */}
        <div className="ls-shell-content ls-skel-content" aria-hidden="true">
          <div className="ls-shell-skeleton ls-skel-content-heading" />
          <div className="ls-shell-skeleton ls-skel-content-line" />
          <div className="ls-shell-skeleton ls-skel-content-line--short" />
          <div className="ls-shell-skeleton ls-skel-content-block" />
          <div className="ls-shell-skeleton ls-skel-content-line--long" />
          <div className="ls-shell-skeleton ls-skel-content-line" />
          <div className="ls-shell-skeleton ls-skel-content-line--med" />
        </div>
      </div>

      <div className="ls-loading-label" role="status" aria-live="polite">
        <i className="fas fa-spinner fa-spin" aria-hidden="true" />
        <span>{isHt ? 'Ap chaje espas aprantisaj la...' : 'Loading your learning space...'}</span>
      </div>
    </div>
  );
}

// ─── ErrorShell ────────────────────────────────────────────────
export function ErrorShell({ isHt = false, message, onBack, onRetry }) {
  return (
    <div className="ls-shell">
      <div className="ls-shell-header" role="banner">
        <button type="button" className="ls-shell-header-back" onClick={onBack}>
          <i className="fas fa-arrow-left" aria-hidden="true" />
        </button>
        <div className="ls-shell-header-info">
          <div className="ls-shell-header-title">
            {isHt ? 'Espas Aprantisaj' : 'Learning Space'}
          </div>
        </div>
      </div>
      <div className="ls-shell-body">
        <div className="ls-shell-content">
          <div className="ls-error-state" role="alert">
            <i className="fas fa-triangle-exclamation ls-error-state-icon" aria-hidden="true" />
            <h3>{isHt ? 'Pa t kapab chaje kou a.' : 'Could not load the course.'}</h3>
            <p>{message || (isHt ? 'Tcheke koneksyon ou epi eseye ankò.' : 'Check your connection and try again.')}</p>
            <div className="ls-error-state-actions">
              <button type="button" className="ls-btn" onClick={onBack}>
                <i className="fas fa-arrow-left" aria-hidden="true" /> {isHt ? 'Retounen' : 'Back'}
              </button>
              {onRetry && (
                <button type="button" className="ls-btn ls-btn--primary" onClick={onRetry}>
                  <i className="fas fa-rotate-right" aria-hidden="true" /> {isHt ? 'Eseye ankò' : 'Try again'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
