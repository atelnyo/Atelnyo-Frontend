/**
 * useCourseFormState — the form + save-status core of CourseEditor.
 *
 * Owns: form fields + syllabus modules container, per-field errors,
 * dirty tracking (state for render + ref for effects), saveState /
 * saveError for the shell pill, and the saved-id mirrors (ref for
 * handlers, state for render — the react-compiler rule forbids
 * touching a ref during render).
 */
import { useCallback, useRef, useState } from 'react';
import { hashtagsToInput } from '../../../../utils/hashtags';

function isModuleList(v) {
  return Array.isArray(v);
}

/** Normalize the syllabus JSON to a stable [{title, description, blocks}] list. */
function normalizeSyllabus(raw) {
  const arr = isModuleList(raw) ? raw : [];
  return arr.map((m) => (
    typeof m === 'string' ? { title: m, description: '', blocks: [] } : {
      title: m?.title || '',
      description: m?.description || '',
      blocks: Array.isArray(m?.blocks) ? m.blocks : [],
    }
  ));
}

export function useCourseFormState({ item, deliveryType = 'online' }) {
  const isEdit = Boolean(item);

  const [form, setForm] = useState({
    title: item?.title || '',
    short_description: item?.short_description || '',
    description: item?.description || '',
    price: item?.price ?? '',
    price_ltd: item?.price_ltd ?? '',
    category: item?.category || '',
    difficulty: item?.difficulty || 'beginner',
    teaching_language: item?.teaching_language || '',
    learner_language: item?.learner_language || '',
    learning_objective: item?.learning_objective || '',
    objectives: Array.isArray(item?.objectives) ? item.objectives.join('\n') : '',
    target_audience: item?.target_audience || '',
    prerequisites: Array.isArray(item?.prerequisites) ? item.prerequisites.join('\n') : '',
    estimated_duration: item?.estimated_duration || '',
    image_url: item?.image_url || '',
    video_url: item?.video_url || '',
    completion_rules: Array.isArray(item?.completion_rules) ? item.completion_rules : [],
    hashtags: hashtagsToInput(item?.tags),
    modules: normalizeSyllabus(item?.syllabus),
    delivery_type: item?.delivery_type || deliveryType || 'online',
    external_url: item?.external_url || '',
    external_format: item?.external_format || '',
  });

  const [errors, setErrors] = useState({});
  const [saveState, setSaveState] = useState('idle'); // idle|dirty|saving|saved|error
  const [saveError, setSaveError] = useState('');
  const savedIdRef = useRef(isEdit ? item.id : null);
  const [hasSaved, setHasSaved] = useState(isEdit);
  const [savedId, setSavedId] = useState(isEdit ? item.id : null);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  // NOTE: the debounce timer is owned by useCoursePersistence (the only
  // reader) — not here — so the compiler never sees a shared mutable.

  const markDirty = useCallback(() => {
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      setDirty(true);
      setSaveState('dirty');
    }
  }, []);

  const handleChange = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => (e[field] ? { ...e, [field]: null } : e));
    markDirty();
  }, [markDirty]);

  const clearDirty = useCallback(() => {
    dirtyRef.current = false;
    setDirty(false);
  }, []);

  return {
    isEdit,
    form, setForm,
    errors, setErrors,
    handleChange,
    markDirty, clearDirty,
    dirty, setDirty, dirtyRef,
    saveState, setSaveState,
    saveError, setSaveError,
    savedIdRef,
    hasSaved, setHasSaved,
    savedId, setSavedId,
  };
}
