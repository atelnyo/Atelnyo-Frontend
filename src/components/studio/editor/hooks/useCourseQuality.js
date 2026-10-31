/**
 * useCourseQuality — server-side quality report for the editor.
 *
 * Fetches `GET /courses/<id>/quality/` on mount (edit mode) and
 * re-fetches right after the FIRST save of a new course (savedId
 * flips null → id only on create). Best-effort: the panel is
 * informational, never blocks saving.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { courseService } from '../../../../services/api';

export function useCourseQuality({ isEdit, savedId, savedIdRef }) {
  const [qualityReport, setQualityReport] = useState(null);
  const [qualityLoading, setQualityLoading] = useState(false);

  const fetchQuality = useCallback(async () => {
    if (!savedIdRef.current) return;
    setQualityLoading(true);
    try {
      const res = await courseService.quality(savedIdRef.current);
      setQualityReport(res?.data || null);
    } catch {
      // Best-effort — quality panel is informational
    } finally {
      setQualityLoading(false);
    }
  }, [savedIdRef]);

  // Fetch quality on mount if editing
  useEffect(() => {
    if (isEdit && savedIdRef.current) fetchQuality();
  }, [isEdit, savedIdRef, fetchQuality]);

  // Re-check quality right after the FIRST save of a new course
  const prevSavedIdRef = useRef(savedId);
  useEffect(() => {
    if (savedId && savedId !== prevSavedIdRef.current) {
      prevSavedIdRef.current = savedId;
      fetchQuality();
    }
  }, [savedId, fetchQuality]);

  return { qualityReport, setQualityReport, qualityLoading, fetchQuality };
}
