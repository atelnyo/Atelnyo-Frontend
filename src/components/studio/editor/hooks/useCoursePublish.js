/**
 * useCoursePublish — the explicit, validated publish action.
 *
 * Courses are created as DRAFT and publishing is the explicit action —
 * a course is only public after POST /courses/<id>/publish/ passes the
 * server-side gate. If the course hasn't been saved yet (fresh editor),
 * it is saved first, then published. Gate failures (title / description
 * / cover / external URL) are surfaced so the creator can fix inline.
 */
import { useCallback, useState } from 'react';
import { courseService } from '../../../../services/api';

export function useCoursePublish({ savedIdRef, doSave, isHt, showToast, setSaveState, setSaveError, clearDirty, setDirty, onSaved }) {
  const [publishing, setPublishing] = useState(false);

  const handlePublish = useCallback(async () => {
    if (publishing) return;
    setPublishing(true);
    try {
      // A brand-new course must exist before it can be published.
      if (!savedIdRef.current) {
        const ok = await doSave();
        if (!ok || !savedIdRef.current) {
          setSaveError(isHt
            ? 'Sove kou a anvan w pibliye l — gen jaden ki pa konplè.'
            : 'Save the course before publishing — some fields are incomplete.');
          setSaveState('error');
          return;
        }
      }
      const res = await courseService.publish(savedIdRef.current);
      if (res?.data?.status === 'published') {
        clearDirty();
        setDirty(false);
        setSaveState('saved');
        setSaveError('');
        onSaved?.();
        showToast?.(isHt ? '🚀 Kou pibliye! Vizitè yo ka wè l kounye a.' : '🚀 Course published! Visitors can see it now.', 'check-circle');
        return;
      }
    } catch (err) {
      const gate = err?.response?.data?.errors;
      if (gate) {
        // Server-side publish gate (§51) — surface each missing item.
        const map = {
          title: isHt ? 'Ajoute yon tit' : 'Add a title',
          description: isHt ? 'Deskripsyon an dwe gen 20+ karaktè' : 'Description must be 20+ characters',
          image_url: isHt ? 'Ajoute yon imaj kouvèti' : 'Add a cover image',
          external_url: isHt ? 'Ajoute URL kou ekstèn lan' : 'Add the external course URL',
        };
        const missing = Object.keys(gate).map((k) => map[k] || gate[k]).join(' · ');
        setSaveError(isHt
          ? `Kou a pa pibliye — ${missing}.`
          : `Course not published — ${missing}.`);
        setSaveState('error');
        showToast?.(isHt ? `Kou a pa pibliye — ${missing}.` : `Course not published — ${missing}.`, 'circle-exclamation');
      } else {
        const detail = err?.response?.data?.detail || err?.message
          || (isHt ? 'Pa t kapab pibliye kou a.' : 'Could not publish the course.');
        setSaveError(detail);
        setSaveState('error');
        showToast?.(detail, 'circle-exclamation');
      }
    } finally {
      setPublishing(false);
    }
  }, [publishing, doSave, savedIdRef, isHt, showToast, setSaveState, setSaveError, clearDirty, setDirty, onSaved]);

  return { publishing, handlePublish };
}
