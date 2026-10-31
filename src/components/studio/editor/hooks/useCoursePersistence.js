/**
 * useCoursePersistence — ALL save paths for CourseEditor.
 *
 *   • autosave `onSave` (draft protection via useAutosave),
 *   • explicit `doSave` (create POST / update PUT),
 *   • debounced autosave once the course exists (first save explicit),
 *   • draft recovery banner wiring.
 *
 * Save behavior mirrors the backend EXACTLY (a save IS the publish
 * for content; the publish gate is a separate explicit action).
 */
import { useCallback, useEffect, useRef } from 'react';
import api, { courseService } from '../../../../services/api';
import useAutosave from '../../../../hooks/useAutosave';
import { buildCoursePayload } from './buildCoursePayload';

export function useCoursePersistence({
  form, setForm,
  savedId, setSavedId, savedIdRef, setHasSaved,
  dirtyRef, clearDirty, setDirty,
  saveState, setSaveState, setSaveError,
  setErrors,
  validate, isExternal, isHt, showToast, onSaved,
}) {
  // Debounce timer is owned here (the only place that reads it).
  const autoSaveTimer = useRef(null);
  const autosave = useAutosave({
    id: savedId,
    data: form,
    onSave: async (data) => {
      const payload = buildCoursePayload(data, { isExternal });
      if (savedIdRef.current) {
        await courseService.update(savedIdRef.current, payload);
      } else {
        const res = await api.post('courses/', payload);
        if (res.data?.id) {
          savedIdRef.current = res.data.id;
          setSavedId(res.data.id);
          setHasSaved(true);
        }
      }
    },
    debounceMs: 2500,
    draftKey: 'atelnyo-course-draft',
  });

  // ─── Draft recovery ───────────────────────────────────────────────
  const handleRecoverDraft = useCallback(() => {
    const draft = autosave.recoverDraft();
    if (draft) {
      setForm(draft);
      showToast?.(isHt ? '📋 Bouyon an retounen!' : '📋 Draft recovered!', 'check-circle');
    }
  }, [autosave, setForm, isHt, showToast]);

  // ─── Save — one function for create + update (existing endpoints) ────
  // Returns true/false like the original so VersionHistoryModal's
  // onRestored can ignore it safely.
  const doSave = useCallback(async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setSaveState('dirty');
      setSaveError(isHt ? 'Gen jaden ki pa konplè — tcheke yo anvan w sove.' : 'Some fields are incomplete — check them before saving.');
      return false;
    }
    setErrors({});
    setSaveState('saving');
    const payload = buildCoursePayload(form, { isExternal });
    try {
      let saved;
      if (savedIdRef.current) {
        saved = await courseService.update(savedIdRef.current, payload);
      } else {
        const res = await api.post('courses/', payload);
        saved = res.data;
      }
      if (saved?.id) {
        savedIdRef.current = saved.id;
        setSavedId(saved.id);
      }
      setHasSaved(true);
      clearDirty();
      setDirty(false);
      setSaveState('saved');
      setSaveError('');
      onSaved?.();
      return true;
    } catch (err) {
      const detail = err?.response?.data?.detail
        || err?.response?.data?.title?.[0]
        || err?.message
        || (isHt ? 'Pa t kapab sove kou a.' : 'Could not save the course.');
      setSaveState('error');
      setSaveError(detail);
      showToast?.(detail, 'circle-exclamation');
      return false;
    }
  }, [form, validate, isHt, showToast, onSaved, isExternal,
    savedIdRef, setSavedId, setHasSaved, clearDirty, setDirty,
    setSaveState, setSaveError, setErrors]);

  // ─── Debounced autosave — only after the course exists ──────────────
  useEffect(() => {
    if (!dirtyRef.current || saveState === 'saving') return undefined;
    if (!savedIdRef.current) return undefined; // first save is explicit
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      setSaveState('dirty');
      doSave();
    }, 2200);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [form, saveState, doSave, dirtyRef, savedIdRef, autoSaveTimer, setSaveState]);

  // ─── Cleanup ─────────────────────────────────────────────────────────
  useEffect(() => () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
  }, [autoSaveTimer]);

  const handleSave = useCallback(() => { doSave(); }, [doSave]);

  return { autosave, doSave, handleSave, handleRecoverDraft };
}
