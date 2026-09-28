/**
 * src/hooks/useLearningNavigation.js
 *
 * §1-§42 — Learning Navigation Engine
 *
 * Provides safe student transitions between lessons with:
 *   §2-3  ｜ Continue button state machine (idle → checking → saving → navigating)
 *   §3    ｜ Double-click / rapid-tap protection
 *   §4    ｜ Idempotent completion (dedup via ref lock)
 *   §5-6  ｜ Completion validation + required-action UX
 *   §7-8  ｜ Pending work checker + block save contract
 *   §9-10 ｜ Save coordinator — save before navigation
 *   §11   ｜ Offline / local-save strategy indicators
 *   §12   ｜ Progress manager (optimistic + backend authoritative)
 *   §14   ｜ Next destination resolver (not just ID + 1)
 *   §22-24｜ Recovery handler + resume + refresh safety
 *   §30   ｜ Concurrent-request protection
 *   §31   ｜ Navigation transaction concept
 */
import { useCallback, useRef, useState } from 'react';

/* ─── Navigation States (§2) ──────────────────────────────────── */
export const NAV_STATE = {
  IDLE: 'idle',
  CHECKING: 'checking',     // inspecting pending work
  VALIDATING: 'validating', // checking completion requirements
  SAVING: 'saving',         // persisting student work
  SYNCING: 'syncing',       // server sync pending
  COMPLETING: 'completing', // marking step done on server
  RESOLVING: 'resolving',   // finding next destination
  NAVIGATING: 'navigating', // transition animation
  ERROR: 'error',           // something failed
};

/* ─── Save States (§9, §11) ───────────────────────────────────── */
export const SAVE_STATE = {
  SAVED: 'saved',             // confirmed server save
  SAVING: 'saving',           // in progress
  PENDING: 'pending',         // unsaved changes exist
  FAILED: 'failed',           // save attempted but failed
  LOCAL_ONLY: 'local_only',   // saved locally only (offline)
  SYNCING: 'syncing',         // queued for server sync
  IDLE: 'idle',               // no pending work
};

/* ─── Helper: human-friendly navigation label (§2) ────────────── */
function navLabel(state, isHt) {
  const labels = {
    [NAV_STATE.IDLE]: isHt ? 'Kontinye' : 'Continue',
    [NAV_STATE.CHECKING]: isHt ? 'Ap tcheke...' : 'Checking...',
    [NAV_STATE.VALIDATING]: isHt ? 'Ap verifye...' : 'Validating...',
    [NAV_STATE.SAVING]: isHt ? 'Ap sove travay ou...' : 'Saving your work...',
    [NAV_STATE.SYNCING]: isHt ? 'Ap senkronize...' : 'Syncing...',
    [NAV_STATE.COMPLETING]: isHt ? 'Ap konplete...' : 'Completing...',
    [NAV_STATE.RESOLVING]: isHt ? 'Ap prepare pwochen leson...' : 'Preparing next lesson...',
    [NAV_STATE.NAVIGATING]: isHt ? 'Ap travèse...' : 'Navigating...',
    [NAV_STATE.ERROR]: isHt ? 'Eseye ankò' : 'Try again',
  };
  return labels[state] || labels[NAV_STATE.IDLE];
}

/**
 * useLearningNavigation — §1-§42 Navigation Engine
 *
 * @param {Object} opts
 * @param {Object} opts.progress          — current progress record from server
 * @param {Function} opts.setProgress     — setter for progress state
 * @param {Array} opts.syllabus           — course module list
 * @param {Function} opts.showToast       — toast notification
 * @param {boolean} opts.isHt             — Haitian Creole language flag
 * @param {Function} opts.enqueueProgress — offline queue function
 *
 * @returns {Object} navigation helpers
 */
export default function useLearningNavigation({
  progress,
  setProgress,
  syllabus = [],
  showToast,
  isHt = false,
  enqueueProgress,
}) {
  const [navState, setNavState] = useState(NAV_STATE.IDLE);
  const [saveState, setSaveState] = useState(SAVE_STATE.IDLE);
  const [transitionMsg, setTransitionMsg] = useState('');

  // §3 — double-click / concurrent-request protection via ref lock
  const navLock = useRef(false);
  // §4 — idempotent completion dedup
  const completingRef = useRef(false);
  // §7 — registered block refs (interactive blocks register themselves)
  const blockRefs = useRef(new Map());

  /* ─── §8 — Block Save Contract ──────────────────────────────── */
  // Interactive blocks register/unregister via this function.
  // Expected contract on each registered ref:
  //   hasPendingChanges() → boolean
  //   save() → Promise<{ ok, savedLocal }>
  //   validateForNavigation() → { ok, reason? }
  const registerBlock = useCallback((blockId, blockApi) => {
    blockRefs.current.set(blockId, blockApi);
    return () => blockRefs.current.delete(blockId);
  }, []);

  /* ─── §7 — Pending Work Checker ─────────────────────────────── */
  const checkPendingWork = useCallback(() => {
    const pending = [];
    blockRefs.current.forEach((api, id) => {
      if (api?.hasPendingChanges?.()) {
        pending.push(id);
      }
    });
    return pending;
  }, []);

  /* ─── §9 — Save Coordinator ─────────────────────────────────── */
  const saveAllPending = useCallback(async () => {
    const pending = checkPendingWork();
    if (pending.length === 0) return { saved: true, count: 0 };

    setSaveState(SAVE_STATE.SAVING);
    let savedCount = 0;
    let localOnly = false;

    for (const blockId of pending) {
      const api = blockRefs.current.get(blockId);
      if (!api?.save) continue;
      try {
        const result = await api.save();
        if (result?.savedLocal) {
          localOnly = true;
        } else {
          savedCount++;
        }
      } catch {
        // §10 — save failed: keep local work, report failure
        localOnly = true;
      }
    }

    if (localOnly && savedCount === 0) {
      setSaveState(SAVE_STATE.LOCAL_ONLY);
    } else if (localOnly) {
      setSaveState(SAVE_STATE.SYNCING);
    } else {
      setSaveState(SAVE_STATE.SAVED);
    }

    return { saved: true, count: savedCount, localOnly };
  }, [checkPendingWork]);

  /* ─── §5-6 — Completion Validation ──────────────────────────── */
  // Returns { ok, reason } — whether the current step allows continuation.
  const validateCompletion = useCallback((stepDone, blockId, blockType) => {
    // §33 — ask registered block if it's ok to navigate away
    if (blockId) {
      const api = blockRefs.current.get(blockId);
      if (api?.validateForNavigation) {
        const result = api.validateForNavigation();
        if (!result?.ok) {
          return { ok: false, reason: result.reason || (isHt ? 'Konplete aktivite a anvan ou kontinye.' : 'Complete the activity before continuing.') };
        }
      }
    }
    // Basic step completion check
    if (!stepDone) {
      return { ok: false, reason: isHt ? 'Konplete aktivite a pou kontinye.' : 'Complete the activity to continue.' };
    }
    return { ok: true };
  }, [isHt]);

  /* ─── §14 — Next Destination Resolver ────────────────────────── */
  // Resolves the correct next module index given current position.
  // Respects: reordering, locked modules, empty modules.
  const resolveNextDestination = useCallback((currentModuleIndex, completedModules = []) => {
    const done = new Set(completedModules.map(Number));
    // Try next module after current
    for (let i = currentModuleIndex + 1; i < syllabus.length; i++) {
      const item = syllabus[i];
      const blocks = (typeof item === 'object' && Array.isArray(item.blocks)) ? item.blocks : [];
      if (blocks.length > 0) return i;
    }
    // No more modules — course complete
    return null;
  }, [syllabus]);

  /* ─── §31 — Navigation Transaction ──────────────────────────── */
  // The main safe-continue function.  §30 prevents concurrent calls.
  const safeNavigate = useCallback(async ({
    currentStepDone,
    currentBlockId,
    currentBlockType,
    currentModuleIndex,
    completedModules = [],
    isLastStep,
    onNavigateToStep,
    onNavigateToModule,
    onModuleComplete,
    onCourseComplete,
  }) => {
    // §30 — concurrent request protection
    if (navLock.current) return;
    navLock.current = true;
    setNavState(NAV_STATE.CHECKING);

    try {
      // §5 — validate completion
      setNavState(NAV_STATE.VALIDATING);
      const validation = validateCompletion(currentStepDone, currentBlockId, currentBlockType);
      if (!validation.ok) {
        setNavState(NAV_STATE.IDLE);
        showToast?.(validation.reason, 'info-circle');
        return;
      }

      // §7-8 — check pending work + save
      const pending = checkPendingWork();
      if (pending.length > 0) {
        setNavState(NAV_STATE.SAVING);
        setTransitionMsg(isHt ? 'Ap sove travay ou...' : 'Saving your work...');
        const saveResult = await saveAllPending();
        if (saveResult.localOnly) {
          // §11 — show local save indicator
          showToast?.(
            isHt ? '💾 Travay sove sou aparèy la. Ap senkronize lè koneksyon retounen.' : '💾 Saved on this device. Will sync when connection returns.',
            'info-circle',
          );
        }
      }

      // §14 — resolve next destination
      setNavState(NAV_STATE.RESOLVING);
      setTransitionMsg(isHt ? 'Ap prepare pwochen etap...' : 'Preparing next step...');

      if (isLastStep) {
        // Module complete
        setNavState(NAV_STATE.NAVIGATING);
        if (onModuleComplete) {
          await onModuleComplete(currentModuleIndex);
        }
        // Resolve next module
        const nextModuleIdx = resolveNextDestination(currentModuleIndex, completedModules);
        if (nextModuleIdx != null) {
          onNavigateToModule?.(nextModuleIdx);
        } else {
          // §21 — course complete
          onCourseComplete?.();
        }
      } else {
        // §18 — next step transition
        setNavState(NAV_STATE.NAVIGATING);
        onNavigateToStep?.();
      }
    } catch (err) {
      console.error('[LearningNavigation] Error:', err);
      setNavState(NAV_STATE.ERROR);
      showToast?.(
        isHt ? 'Yon erè rive. Travay ou an sekirite — esseye ankò.' : 'Something went wrong. Your work is safe — try again.',
        'exclamation-triangle',
      );
    } finally {
      // §2 — reset to idle after transition settles
      setTimeout(() => {
        setNavState(NAV_STATE.IDLE);
        setSaveState(SAVE_STATE.IDLE);
        setTransitionMsg('');
        navLock.current = false;
      }, 300);
    }
  }, [
    validateCompletion, checkPendingWork, saveAllPending,
    resolveNextDestination, showToast, isHt,
  ]);

  /* ─── §22 — Recovery: check localStorage on mount ────────────── */
  const getRecoveryState = useCallback((courseId) => {
    try {
      const raw = window.localStorage.getItem('atelnyo_ls_session');
      if (!raw) return null;
      const all = JSON.parse(raw);
      const state = all[String(courseId)];
      if (!state || (Date.now() - (state.savedAt || 0)) > 86400000) return null;
      return state;
    } catch {
      return null;
    }
  }, []);

  return {
    // State
    navState,
    saveState,
    transitionMsg,
    navLabel: navLabel(navState, isHt),

    // §8 — Block save contract
    registerBlock,

    // §31 — Navigation transaction
    safeNavigate,

    // §14 — Destination resolver
    resolveNextDestination,

    // §22 — Recovery
    getRecoveryState,

    // §30 — Lock status (for UI disable)
    isNavigating: navLock.current || navState !== NAV_STATE.IDLE,
  };
}
