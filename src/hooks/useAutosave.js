/**
 * useAutosave — §7, §8, §9, §10, §11, §25-§28 Autosave + Local Draft Recovery
 *
 * Provides debounced autosave for interactive blocks:
 *   - §7  Block-appropriate autosave strategy
 *   - §8  Prioritize local persistence first
 *   - §9  Local-first draft protection
 *   - §10 Debouncing (don't save on every keystroke)
 *   - §11 Save state machine (idle → changed → saving → saved)
 *   - §28 Local draft recovery via draftStore primitive
 *   - §47 Performance (debouncing, no input lag)
 *
 * Storage: draftStore primitive (private:drafts:<formId>)
 *          via privateStorage → IndexedDB → localStorage fallback.
 *          NOT raw localStorage — proper quota handling, account isolation.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { saveDraft, restoreDraft, removeDraft } from '../services/learningDraftManager';
import logger from '../services/learningStateLogger';

/**
 * useAutosave
 *
 * @param {Object} opts
 * @param {string} opts.blockId — unique block identifier
 * @param {string} [opts.courseId] — course identifier (for learning drafts)
 * @param {string} [opts.lessonId] — lesson identifier (for learning drafts)
 * @param {any} opts.content — current content to save
 * @param {Function} opts.onSave — async (content) => { ok, savedLocal? }
 * @param {number} [opts.debounceMs=2000] — debounce delay
 * @param {boolean} [opts.enabled=true] — whether autosave is active
 *
 * @returns {{ saveState, triggerSave, flushSave, recoverDraft, discardDraft, getStateLabel }}
 */
export default function useAutosave({
  blockId,
  courseId,
  lessonId,
  content,
  onSave,
  debounceMs = 2000,
  enabled = true,
}) {
  // §11 — Save state machine: idle → changed → saving → saved → failed
  const [saveState, setSaveState] = useState('idle');
  // §12 — Human-friendly label for current save state
  const [stateLabel, setStateLabel] = useState('');

  const timerRef = useRef(null);
  const contentRef = useRef(content);
  const savedRef = useRef(null);
  const mountedRef = useRef(true);
  const versionRef = useRef(0);

  contentRef.current = content;

  // §12 — Update human-friendly label on state change
  const LABELS = {
    idle: '',
    changed: '',
    saving: 'Ap sove...',
    saved: 'Sove',
    failed: 'Pa kapab sove',
    local_only: 'Sove sou aparèy sa a',
  };

  useEffect(() => {
    setStateLabel(LABELS[saveState] || '');
  }, [saveState]);

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // §8, §9 — Local-first save: persist to draftStore FIRST, then sync to server
  const doSave = useCallback(async () => {
    if (!onSave || !mountedRef.current) return;
    setSaveState('saving');

    // §9 — Step 1: Local draft protection (fast, reliable)
    let localSaved = false;
    if (courseId && lessonId && blockId) {
      try {
        versionRef.current += 1;
        const localResult = await saveDraft({
          courseId,
          lessonId,
          blockId,
          data: contentRef.current,
          version: versionRef.current,
        });
        localSaved = localResult.ok;
      } catch {
        // draftStore failure — surface through state
      }
    }

    // §8 — Step 2: Server synchronization (debounced, may fail)
    try {
      const result = await onSave(contentRef.current);
      if (!mountedRef.current) return;
      if (result?.savedLocal) {
        setSaveState('local_only');
        logger.draftSaved(blockId, { ok: true, localOnly: true });
      } else {
        setSaveState('saved');
        logger.draftSaved(blockId, { ok: true });
        savedRef.current = contentRef.current;
        // §37 — Remove local draft after successful server sync
        if (courseId && lessonId && blockId) {
          removeDraft({ courseId, lessonId, blockId }).catch(() => {});
        }
      }
    } catch (err) {
      if (!mountedRef.current) return;
      if (localSaved) {
        // §9 — Server failed but local draft is protected
        setSaveState('local_only');
        logger.draftSaved(blockId, { ok: true, localOnly: true });
      } else {
        setSaveState('failed');
        logger.stateTransition(blockId, 'saving', 'failed');
      }
    }
  }, [blockId, courseId, lessonId, onSave]);

  // §10 — Debounced autosave trigger
  const triggerSave = useCallback(() => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doSave, debounceMs);
  }, [enabled, debounceMs, doSave]);

  // §43 — Flush: immediately persist (before navigation/close)
  const flushSave = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await doSave();
  }, [doSave]);

  // §28 — Recover draft from draftStore
  const recoverDraft = useCallback(async () => {
    if (!courseId || !lessonId || !blockId) return null;
    try {
      const result = await restoreDraft({ courseId, lessonId, blockId });
      if (result.ok && result.draft) {
        return result.draft.data;
      }
      return null;
    } catch {
      return null;
    }
  }, [courseId, lessonId, blockId]);

  // §37 — Discard draft (after submit or explicit discard)
  const discardDraft = useCallback(async () => {
    if (!courseId || !lessonId || !blockId) return;
    await removeDraft({ courseId, lessonId, blockId });
    savedRef.current = contentRef.current;
    setSaveState('idle');
  }, [courseId, lessonId, blockId]);

  // §10 — Trigger autosave when content changes
  useEffect(() => {
    if (!enabled || !content) return;
    // Only autosave if content actually changed
    if (JSON.stringify(content) === JSON.stringify(savedRef.current)) return;
    setSaveState('changed');
    triggerSave();
  }, [content, enabled, triggerSave]);

  return {
    saveState,
    stateLabel,
    triggerSave,
    flushSave,
    recoverDraft,
    discardDraft,
  };
}
