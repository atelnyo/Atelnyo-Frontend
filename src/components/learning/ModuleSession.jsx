/**
 * src/components/learning/ModuleSession.jsx
 *
 * The Duolingo-style step player for ONE module (2027 redesign of the
 * Learning Space). Clicking a module no longer dumps every activity on
 * the page at once — instead the learner moves through the module one
 * step at a time:
 *
 *   • Every block in the module is ONE step.
 *   • The module's quiz (if any) is the final "assessment" step — it
 *     only counts as done when the learner actually PASSES it
 *     (server-verified). ALL module quizzes must be passed for the
 *     assessment step to be complete.
 *   • A step-dot path at the top shows position in the module; filled
 *     dots = genuinely completed (real blocks from progress, never
 *     assumed).
 *   • "Continue" only advances when the current step is REALLY done —
 *     completion is still the same idempotent server action
 *     (complete_block / quiz submit), so progress stays honest.
 *   • Exiting mid-module is always safe: completed steps were already
 *     written to the backend; the session resumes at the first
 *     unfinished step next time.
 *
 * Everything reuses the existing architecture — LanguagePracticeBlock
 * and QuizBlock render the activities, onComplete/onViewed flow to the
 * same progress engine. No fake state, no fake scores.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { playChime, burstConfetti } from '../../utils/celebrate';
import { BlockRenderer } from './blocks';
import QuizBlock from './QuizBlock';
import LessonIntroduction from './LessonIntroduction';
import ProgressExplanation from './ProgressExplanation';
import useLearningNavigation, { NAV_STATE, SAVE_STATE } from '../../hooks/useLearningNavigation';
import useLessonCompletion from '../../hooks/useLessonCompletion';

// Fisher–Yates shuffle — module scope so the component body stays pure
// (the review session mixes the module's blocks into a fresh order).
function shuffleBlocks(blocks) {
  const arr = Array.isArray(blocks) ? [...blocks] : [];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function ModuleSession({
  courseId,
  moduleIndex,
  item,
  lang = 'ht',
  translations,
  progress,
  completedBlocksMap,
  completedModules = [],
  onComplete,
  onViewed,
  onExit,
  onNextModule,
  cachedQuizzes,
  onQuizzesLoaded,
  gamification = null,
  onGamification = null,
  review = false, // practice-only session: mixed blocks, NO progress writes
  // §42 — Learning Navigation Engine integration
  onSafeNavigate, // optional: external safe navigate handler (from LearningSpace)
  // §25-§26 — Course-level learning objectives for LessonIntroduction
  courseObjectives = [],
  // §20 — Granular position tracking for session recovery
  onPositionChange, // (blockId, blockType) => void
}) {
  const isHt = lang === 'ht';
  const blocks = useMemo(
    () => (typeof item === 'object' && Array.isArray(item?.blocks)) ? item.blocks : [],
    [item],
  );
  // Review sessions shuffle the module's blocks into a fresh order ONCE
  // per session (a remixed practice, not the same path again).
  const sessionBlocks = useMemo(
    () => (review ? shuffleBlocks(blocks) : blocks),
    [review, blocks],
  );

  // ─── Step model ────────────────────────────────────────────────────
  // Steps = every block + ONE optional final "assessment" step when the
  // module has quizzes. QuizBlock loads the quiz list async, so the
  // step count is only final once the list is known (quizzesLoaded).
  const [quizzesLoaded, setQuizzesLoaded] = useState(review); // review never has an assessment
  const [quizIds, setQuizIds] = useState([]);
  const [quizCount, setQuizCount] = useState(0);
  const [quizLoadTimedOut, setQuizLoadTimedOut] = useState(false);
  const stepCount = sessionBlocks.length + (quizCount > 0 ? 1 : 0);

  // Safety net: if quiz loading takes >8s, proceed with blocks only.
  // Prevents the session from freezing when the quiz API is slow or
  // the course has no quizzes (legacy courses).
  useEffect(() => {
    if (quizzesLoaded || review) return;
    const timer = setTimeout(() => {
      if (!quizzesLoaded) {
        setQuizLoadTimedOut(true);
        setQuizzesLoaded(true);
        setQuizCount(0);
        setQuizIds([]);
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [quizzesLoaded, review]);

  const [current, setCurrent] = useState(0);
  const [doneThisSession, setDoneThisSession] = useState({});
  const [passedThisSession, setPassedThisSession] = useState({});
  const placedRef = useRef(false);
  const stepRef = useRef(null);

  const isAssessment = quizCount > 0 && current >= sessionBlocks.length;
  const currentBlock = isAssessment ? null : sessionBlocks[current];

  // §20 — Report granular position changes to parent for session recovery
  useEffect(() => {
    if (onPositionChange && currentBlock?.id) {
      onPositionChange(currentBlock.id, currentBlock.type || 'unknown');
    }
  }, [currentBlock?.id, currentBlock?.type, onPositionChange]);

  // A step is "done" if it was already completed in real progress OR was
  // completed during this session (the same server action already ran).
  const isStepDone = useCallback((stepIdx) => {
    if (doneThisSession[stepIdx]) return true;
    if (stepIdx < sessionBlocks.length) {
      const b = sessionBlocks[stepIdx];
      if (!b?.id) return false;
      return Boolean(completedBlocksMap[String(moduleIndex)]?.has(b.id));
    }
    // Assessment step: done only when EVERY module quiz is passed
    // (server progress or passed this session).
    if (quizIds.length === 0) return false;
    return quizIds.every(
      (id) => Boolean(completedBlocksMap[String(moduleIndex)]?.has(`quiz:${id}`)) || Boolean(passedThisSession[id]),
    );
  }, [sessionBlocks, completedBlocksMap, moduleIndex, quizIds, doneThisSession, passedThisSession]);

  // ─── Resume: land on the first unfinished step once the step space
  //     is final (blocks known + quiz list loaded). Only placed once —
  //     after that, the learner's own Continue presses drive position.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (placedRef.current) return;
    if (!quizzesLoaded) return;
    if (stepCount === 0) { placedRef.current = true; return; }
    const firstUndone = [...Array(stepCount).keys()].find((i) => !isStepDone(i));
    setCurrent(firstUndone == null ? 0 : firstUndone);
    placedRef.current = true;
  }, [quizzesLoaded, stepCount, isStepDone]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const markDone = useCallback((stepIdx) => {
    setDoneThisSession((prev) => (prev[stepIdx] ? prev : { ...prev, [stepIdx]: true }));
  }, []);

  // Completion of a block OR a passed quiz — same idempotent server
  // action the Learning Space always used. Map the incoming block id /
  // quiz: pseudo-id onto a step index.
  const handleComplete = useCallback((mi, blockId, blockType) => {
    // Review mode is practice-only — the module is already completed,
    // so nothing is written to progress; the step still counts as done
    // for this session (Continue works).
    if (!review) {
      onComplete?.(mi, blockId, blockType);
    }
    // Small win chime — every real completion (block or passed quiz).
    playChime('correct');
    if (Number(mi) !== Number(moduleIndex)) return;
    const bid = String(blockId || '');
    if (bid.startsWith('quiz:')) {
      const id = bid.slice(5);
      setPassedThisSession((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
      // Assessment step = sessionBlocks.length; if every quiz is now
      // passed, mark the step done optimistically (server confirmed).
      if (quizIds.length > 0 && quizIds.every(
        (qid) => Boolean(completedBlocksMap[String(moduleIndex)]?.has(`quiz:${qid}`)) || qid === id || passedThisSession[qid],
      )) {
        markDone(sessionBlocks.length);
      }
      return;
    }
    const idx = sessionBlocks.findIndex((b) => String(b.id) === bid);
    if (idx >= 0) markDone(idx);
  }, [review, onComplete, moduleIndex, sessionBlocks, quizIds, completedBlocksMap, passedThisSession, markDone]);

  const handleViewed = useCallback((mi, blockIndex, blockId) => {
    onViewed?.(mi, blockIndex, blockId);
  }, [onViewed]);

  const handleQuizzesLoaded = useCallback((list) => {
    const mine = Array.isArray(list) ? list.filter((q) => Number(q.module_index) === Number(moduleIndex)) : [];
    setQuizIds(mine.map((q) => String(q.id)));
    setQuizCount(mine.length);
    setQuizzesLoaded(true);
    onQuizzesLoaded?.(list);
  }, [moduleIndex, onQuizzesLoaded]);

  const canContinue = isStepDone(current);
  const isLastStep = current >= stepCount - 1;

  // §3-4 — Double-click protection: navLock prevents rapid presses
  const navLockRef = useRef(false);
  const [navBusy, setNavBusy] = useState(false);

  const handleContinue = useCallback(() => {
    if (!isStepDone(current) || navLockRef.current) return;
    navLockRef.current = true;
    setNavBusy(true);

    if (onSafeNavigate) {
      // §31 — Delegate to the full navigation transaction
      const currentBlock = !isAssessment ? sessionBlocks[current] : null;
      onSafeNavigate({
        currentStepDone: true,
        currentBlockId: currentBlock?.id || null,
        currentBlockType: currentBlock?.type || null,
        currentModuleIndex: moduleIndex,
        completedModules: completedModules || [],
        isLastStep,
        onNavigateToStep: () => {
          setCurrent((c) => Math.min(c + 1, stepCount));
          navLockRef.current = false;
          setNavBusy(false);
        },
        onModuleComplete: () => {},
        onNavigateToModule: () => {
          onNextModule?.();
        },
        onCourseComplete: () => {
          onNextModule?.();
        },
      });
    } else {
      // §18 — Simple transition (no navigation engine)
      setCurrent((c) => Math.min(c + 1, stepCount));
      setTimeout(() => {
        navLockRef.current = false;
        setNavBusy(false);
      }, 200);
    }
  }, [isStepDone, current, isAssessment, sessionBlocks, moduleIndex, completedModules, isLastStep, stepCount, onSafeNavigate, onNextModule]);

  const moduleTitle = useMemo(() => {
    const base = (typeof item === 'object' && item.title) ? item.title : `${isHt ? 'Modil' : 'Module'} ${moduleIndex + 1}`;
    return review ? `${isHt ? 'Revizyon' : 'Review'} · ${base}` : base;
  }, [item, moduleIndex, isHt, review]);
  const doneCount = useMemo(
    () => [...Array(stepCount).keys()].filter((i) => isStepDone(i)).length,
    [stepCount, isStepDone],
  );
  // §6-8 — Completion Rule Engine: evaluate module completion
  const moduleCompletion = useLessonCompletion({
    blocks: sessionBlocks,
    completedBlocks: completedBlocksMap[String(moduleIndex)] || new Set(),
    assessmentResults: Object.fromEntries(
      quizIds.map((id) => [
        `quiz:${id}`,
        {
          passed: Boolean(completedBlocksMap[String(moduleIndex)]?.has(`quiz:${id}`)) || Boolean(passedThisSession[id]),
          score: null,
        },
      ]),
    ),
  });

  const showComplete = stepCount === 0 || current >= stepCount;

  // ─── Accessibility: move focus to the new step when the learner
  //     advances or steps back, so keyboard/screen-reader users are
  //     never left behind on the previous activity. ────────────────
  useEffect(() => {
    if (showComplete) return;
    stepRef.current?.focus({ preventScroll: true });
  }, [current, showComplete]);

  // ─── Module-complete celebration: chime + confetti, ONLY on the
  //     transition into the complete screen this session (reopening an
  //     already-finished module stays quiet). ─────────────────────────
  const prevShowCompleteRef = useRef(showComplete);
  useEffect(() => {
    if (showComplete && !prevShowCompleteRef.current && stepCount > 0) {
      playChime('complete');
      burstConfetti({ count: 90 });
    }
    prevShowCompleteRef.current = showComplete;
  }, [showComplete, stepCount]);

  // ─── Keyboard navigation ───────────────────────────────────────────
  // Enter / Space / → continue (only when the step is REALLY done);
  // ← steps back to the previous activity. Never hijacks typing or
  // button activation (form controls and buttons are ignored).
  const handleKeyDown = useCallback((e) => {
    if (showComplete) return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
    if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
      if (canContinue) {
        e.preventDefault();
        handleContinue();
      }
    } else if (e.key === 'ArrowLeft') {
      if (current > 0) {
        e.preventDefault();
        setCurrent((c) => Math.max(0, c - 1));
      }
    }
  }, [showComplete, canContinue, handleContinue, current]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ─── Progress-streak (real data): consecutive completed modules
  //     ending at THIS module. The module being completed counts — the
  //     ones before it come from the server's completed_modules. This
  //     is a genuine "you're on a roll" signal, never invented.
  const streakCount = useMemo(() => {
    if (!showComplete) return 0;
    const done = new Set((Array.isArray(completedModules) ? completedModules : []).map(Number));
    let n = 1; // this module just completed
    for (let i = moduleIndex - 1; i >= 0; i--) {
      if (done.has(i)) n += 1;
      else break;
    }
    return n;
  }, [showComplete, completedModules, moduleIndex]);

  return (
    <div className="ls-session" data-testid="module-session">
      {/* ─── Session header: exit + module title + step counter ─── */}
      <header className="ls-session-head">
        <button
          type="button"
          className="ls-header-btn"
          onClick={onExit}
          aria-label={isHt ? 'Soti nan sesyon an' : 'Exit session'}
          title={isHt ? 'Soti' : 'Exit'}
        >
          <i className="fas fa-arrow-left" aria-hidden="true" />
        </button>
        <div className="ls-session-head-title">
          <strong>{moduleTitle}</strong>
          <span aria-live="polite">
            {showComplete
              ? (isHt ? 'Sesyon fini' : 'Session complete')
              : (isHt ? `Etap ${current + 1} sou ${stepCount}` : `Step ${current + 1} of ${stepCount}`)}
          </span>
        </div>
        <div className="ls-session-head-progress">
          {showComplete ? (
            <span className="ls-session-check"><i className="fas fa-check" aria-hidden="true" /></span>
          ) : (
            <span className="ls-session-count">{doneCount}/{stepCount}</span>
          )}
        </div>
        {/* Duolingo-style hearts — mistakes left in this session. */}
        {gamification && Number(gamification.hearts_max) > 0 && (
          <span
            className={`ls-session-hearts${Number(gamification.hearts) === 0 ? ' is-empty' : ''}`}
            title={isHt ? 'Kè — erè ki rete' : 'Hearts — mistakes left'}
            role="status"
          >
            {Array.from({ length: Number(gamification.hearts_max) }, (_, i) => (
              <i
                key={i}
                className={`fas fa-heart ${i < Number(gamification.hearts) ? 'is-full' : 'is-lost'}`}
                aria-hidden="true"
              />
            ))}
          </span>
        )}
      </header>

      {/* ─── Step-dot path (real progress only) ─────────────────── */}
      {!showComplete && stepCount > 0 && (
        <div className="ls-session-path" role="img" aria-label={isHt ? 'Pwogrè nan modil la' : 'Module progress'}>
          {[...Array(stepCount).keys()].map((i) => {
            const done = isStepDone(i);
            const cls = [
              'ls-session-dot',
              done ? 'is-done' : '',
              i === current ? 'is-active' : '',
              i < current ? 'is-past' : '',
            ].filter(Boolean).join(' ');
            return (
              <span key={i} className={cls} aria-hidden="true">
                {done ? <i className="fas fa-check" /> : null}
              </span>
            );
          })}
        </div>
      )}

      {/* ─── Module-complete screen ─────────────────────────────── */}
      {showComplete ? (
        <div className="ls-session-done" role="status">
          {/* Celebration: trophy pop + pulse ring + rising sparkles.
              Pure CSS; respects prefers-reduced-motion. The streak chip
              below is real progress (consecutive modules), not flare. */}
          <div className="ls-celebrate" aria-hidden="true">
            <span className="ls-celebrate-ring" />
            <span className="ls-celebrate-spark ls-celebrate-spark--1"><i className="fas fa-star" /></span>
            <span className="ls-celebrate-spark ls-celebrate-spark--2"><i className="fas fa-star" /></span>
            <span className="ls-celebrate-spark ls-celebrate-spark--3"><i className="fas fa-star" /></span>
            <span className="ls-celebrate-spark ls-celebrate-spark--4"><i className="fas fa-star" /></span>
            <div className="ls-session-done-badge">
              <i className="fas fa-trophy" aria-hidden="true" />
            </div>
          </div>
          <h3>{review ? (isHt ? 'Revizyon fini!' : 'Review complete!') : (isHt ? 'Modil fini!' : 'Module complete!')}</h3>
          <p>
            {review
              ? (isHt
                  ? `Ou revize ${stepCount} sou ${stepCount} etap. Pwogrè ou pa chanje — se pratik.`
                  : `You reviewed ${stepCount} of ${stepCount} steps. Your progress is unchanged — this was practice.`)
              : (isHt
                  ? `Ou fini ${stepCount} sou ${stepCount} etap. Pwogrè ou anrejistre.`
                  : `You completed ${stepCount} of ${stepCount} steps. Your progress is saved.`)}
          </p>
          {!review && streakCount >= 2 && (
            <div className="ls-session-streak" role="status">
              <i className="fas fa-fire" aria-hidden="true" />
              {isHt
                ? `${streakCount} modil nan yon ranje — kontinye konsa!`
                : `${streakCount}-module streak — keep it going!`}
            </div>
          )}
          {/* §38-39 — Progress Explanation: show what was completed */}
          {!review && (
            <ProgressExplanation
              blocks={sessionBlocks}
              completedBlocks={completedBlocksMap[String(moduleIndex)] || new Set()}
              lang={lang}
            />
          )}
          <div className="ls-session-done-actions">
            <button type="button" className="ls-btn" onClick={onExit}>
              <i className="fas fa-list-check" aria-hidden="true" /> {isHt ? 'Tounen nan kourikoulòm' : 'Back to curriculum'}
            </button>
            {onNextModule && (
              <button type="button" className="ls-btn ls-btn--primary" onClick={onNextModule}>
                <i className="fas fa-arrow-right" aria-hidden="true" /> {isHt ? 'Pwochen modil' : 'Next module'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ─── §25-§26 — Lesson Introduction: calm beginning showing
               module title + objectives. Only on the first step.
               Not counted as a step — purely informational context. ── */}
          {!isAssessment && current === 0 && !review && (
            <LessonIntroduction
              title={moduleTitle}
              objectives={item?.objectives || courseObjectives || []}
              lang={lang}
              hideTitle
            />
          )}

          {/* ─── Current step: ONE activity at a time ───────────── */}
          {!isAssessment && currentBlock && (
            <div
              className="ls-session-step"
              key={`block-${moduleIndex}-${currentBlock.id || current}`}
              ref={stepRef}
              tabIndex={-1}
            >
              <BlockRenderer
                block={currentBlock}
                lang={lang}
                index={current}
                courseId={courseId}
                moduleIndex={moduleIndex}
                onComplete={handleComplete}
                onViewed={handleViewed}
              />
            </div>
          )}

          {isAssessment && (
            <div className="ls-session-assessment-head">
              <span className="ls-session-assessment-icon"><i className="fas fa-clipboard-question" aria-hidden="true" /></span>
              <div>
                <strong>{isHt ? 'Evalyasyon modil la' : 'Module assessment'}</strong>
                <span>{isHt ? 'Reponn tout kesyon yo — sa konte nan pwogrè ou.' : 'Answer every question — it counts toward your progress.'}</span>
              </div>
            </div>
          )}

          {/* ─── QuizBlock: ALWAYS mounted (hidden unless it's the
               assessment step) so the quiz list is known up front for
               the step count — no flash, no refetch. Skipped entirely
               in review mode (practice-only, no assessment). ────── */}
          {!review && (
            <div
              className={isAssessment ? 'ls-session-step' : 'ls-session-hidden'}
              aria-hidden={!isAssessment}
              ref={isAssessment ? stepRef : undefined}
              tabIndex={isAssessment ? -1 : undefined}
            >
              <QuizBlock
                courseId={courseId}
                moduleIndex={moduleIndex}
                lang={lang}
                onComplete={handleComplete}
                cachedQuizzes={cachedQuizzes}
                onQuizzesLoaded={handleQuizzesLoaded}
                gamification={gamification}
                onGamification={onGamification}
              />
            </div>
          )}

          {/* ─── Continue: only advances on REAL completion ────── */}
          <div className="ls-session-footer">
            {/* §38 — Progress Auditability: show what remains */}
            {moduleCompletion && !moduleCompletion.complete && doneCount > 0 && (
              <p className="ls-session-hint" style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #6b7280)', marginBottom: 6 }}>
                {isHt
                  ? `${doneCount}/${stepCount} etap konplete — ${moduleCompletion.remaining.length} obligatwa rete`
                  : `${doneCount}/${stepCount} steps complete — ${moduleCompletion.remaining.length} required remaining`}
              </p>
            )}
            <p className="ls-session-hint">
              {canContinue
                ? (isLastStep
                    ? (isHt ? 'Fini modil la' : 'Finish the module')
                    : (isHt ? 'Kontinye nan pwochen etap' : 'Continue to the next step'))
                : (isHt
                    ? 'Konplete aktivite a pou kontinye'
                    : 'Complete the activity to continue')}
            </p>
            {canContinue && (
              <span className="ls-session-kbd" aria-hidden="true">
                <kbd>Enter</kbd> <kbd>→</kbd> {isHt ? 'kontinye' : 'continue'}
                {current > 0 && (
                  <>
                    <span className="ls-session-kbd-sep">·</span>
                    <kbd>←</kbd> {isHt ? 'retounen' : 'back'}
                  </>
                )}
              </span>
            )}
            <div className="ls-session-nav">
            {current > 0 && (
              <button
                type="button"
                className="ls-btn ls-session-back"
                onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                aria-label={isHt ? 'Retounen nan etap anvan' : 'Previous step'}
                title={isHt ? 'Retounen' : 'Back'}
              >
                <i className="fas fa-arrow-left" aria-hidden="true" /> {isHt ? 'Retounen' : 'Back'}
              </button>
            )}
            <button
              type="button"
              className="ls-btn ls-btn--primary ls-session-continue"
              onClick={handleContinue}
              disabled={!canContinue || navBusy}
              aria-busy={navBusy}
              aria-live="polite"
            >
              {navBusy ? (
                <><i className="fas fa-spinner fa-pulse" aria-hidden="true" /> {isHt ? 'Ap trete...' : 'Processing...'}</>
              ) : isLastStep ? (
                <><i className="fas fa-flag-checkered" aria-hidden="true" /> {isHt ? 'Fini' : 'Finish'}</>
              ) : (
                <>{isHt ? 'Kontinye' : 'Continue'} <i className="fas fa-arrow-right" aria-hidden="true" /></>
              )}
            </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
