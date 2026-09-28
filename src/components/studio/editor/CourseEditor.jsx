/**
 * src/components/studio/editor/CourseEditor.jsx
 *
 * EDITOR-FIRST course creation/editing workspace (replaces the old
 * one-long-form CourseFormModal).
 *
 * A course is STRUCTURED CONTENT, so the workspace is:
 *   • LEFT   — content structure: the syllabus modules tree
 *   • CENTER — the editor canvas: Overview (title + description) or
 *              the selected module (module title + lesson copy)
 *   • RIGHT  — contextual properties: difficulty, category, hashtags,
 *              cover/video URLs, price
 *
 * Save behavior mirrors the backend EXACTLY (courses have no
 * draft/publish flag — a save IS the publish):
 *   • First save POSTs /api/courses/, subsequent edits autosave via PUT
 *     (debounced) once the course exists.
 *   • saveState drives the shell header pill: dirty → saving → saved.
 *   • Unsaved changes are guarded on back/close.
 *
 * DELIVERY MODELS (backend: delivery_type online|external):
 *   • ONLINE  — the learning experience lives inside Atelnyo; the
 *               syllabus modules are the lesson structure.
 *   • EXTERNAL — Atelnyo is the organized discovery/presentation
 *               layer; learning happens on another platform, location,
 *               or institution. The creator provides an external_url
 *               (required, validated) + a display-only format label.
 *               The syllabus is optional (organization, not hosting).
 *
 * EXTENSION POINTS (architecture only — nothing faked):
 *   • The syllabus list is the seam for richer structures: a module
 *     could grow children (lessons/labs/quizzes/assignments) by
 *     evolving the JSON shape while keeping the same field — the
 *     structure panel renders whatever the backend returns.
 *   • Course messaging must integrate with the EXISTING global
 *     messaging system (MessagesSection) — no parallel chat system.
 *   • Lazy-load heavy panels (lesson-by-lesson content, learner
 *     analytics) via React.lazy when such endpoints exist.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api, { courseService } from '../../../services/api';
import { parseHashtags, hashtagsToInput } from '../../../utils/hashtags';
import MediaUploadButton from './MediaUploadButton';
import './MediaUploadButton.css';
import StudioEditorShell from './StudioEditorShell';
import StudioPropertiesPanel, {
  PropertyGroup, PropField, PropInput, PropSelect,
} from './StudioPropertiesPanel';
import useAutosave from '../../../hooks/useAutosave';
import SaveStatusIndicator from '../shared/SaveStatusIndicator';
import DraftRecoveryBanner from '../shared/DraftRecoveryBanner';
import BlockEditor from './BlockEditor';
import QuizEditor from './QuizEditor';
import CourseFaqEditor from './CourseFaqEditor';
import CoursePreviewModal from './CoursePreviewModal';
import VersionHistoryModal from './VersionHistoryModal';
import CollaborationPanel from './CollaborationPanel';
import CurriculumBuilder from './CurriculumBuilder';
import LessonEditor from './LessonEditor';
import ContentValidationEngine from './ContentValidationEngine';
import ContentStructureView from './ContentStructureView';
import CompletionRulesEditor from './CompletionRulesEditor';
import StudioAIChat from './StudioAIChat';
import styles from './editor.module.css';

function isModuleList(v) {
  return Array.isArray(v);
}

/** Normalize the syllabus JSON to a stable [{title, description, blocks}] list.
 *  ``blocks`` (language-practice items) is preserved when present —
 *  existing courses without blocks keep working unchanged. */
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

export default function CourseEditor({ onClose, onSuccess, lang = 'ht', showToast, user, item, deliveryType = 'online' }) {
  const isEdit = Boolean(item);
  const isHt = lang === 'ht';
  const isPremium = !!(user?.premium?.is_premium);
  // Delivery model — where the learning actually happens.
  //   online   → taught inside Atelnyo
  //   external → Atelnyo is the discovery/presentation layer, learning
  //              happens on another platform/location/institution.
  const isExternal = (item?.delivery_type || deliveryType) === 'external';

  // ─── Form state (same fields + syllabus as the existing Course API) ──
  const [form, setForm] = useState({
    title: item?.title || '',
    short_description: item?.short_description || '',
    description: item?.description || '',
    price: item?.price ?? '',
    price_ltd: item?.price_ltd ?? '',
    category: item?.category || '',
    difficulty: item?.difficulty || 'beginner',
    // Optional language-course metadata (backend: teaching_language /
    // learner_language / learning_objective). Empty when unset.
    teaching_language: item?.teaching_language || '',
    learner_language: item?.learner_language || '',
    learning_objective: item?.learning_objective || '',
    // Extended course metadata (Phase 1 — Universal Course Studio)
    objectives: Array.isArray(item?.objectives) ? item.objectives.join('\n') : '',
    target_audience: item?.target_audience || '',
    prerequisites: Array.isArray(item?.prerequisites) ? item.prerequisites.join('\n') : '',
    estimated_duration: item?.estimated_duration || '',
    image_url: item?.image_url || '',
    video_url: item?.video_url || '',
    completion_rules: Array.isArray(item?.completion_rules) ? item.completion_rules : [],
    hashtags: hashtagsToInput(item?.tags),
    modules: normalizeSyllabus(item?.syllabus),
    // Delivery fields (backend: delivery_type / external_url / external_format)
    delivery_type: item?.delivery_type || deliveryType || 'online',
    external_url: item?.external_url || '',
    external_format: item?.external_format || '',
  });
  // Course status (Phase 1 — lifecycle)
  const [courseStatus, setCourseStatus] = useState(item?.status || 'draft');
  // Quality report (Phase 1 — quality validation)
  const [qualityReport, setQualityReport] = useState(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  // Curriculum mode (Phase 2 — Chapter/Lesson hierarchy)
  const [curriculumMode, setCurriculumMode] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState(null);

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
  }, []);

  // Fetch quality on mount if editing
  useEffect(() => {
    if (isEdit && savedIdRef.current) fetchQuality();
  }, [isEdit, fetchQuality]);

  // ─── Editor state ────────────────────────────────────────────────────
  const [selected, setSelected] = useState(null); // null = Overview
  const [errors, setErrors] = useState({});
  const [saveState, setSaveState] = useState('idle'); // idle|dirty|saving|saved|error
  const [saveError, setSaveError] = useState('');
  const savedIdRef = useRef(isEdit ? item.id : null);
  const autoSaveTimer = useRef(null);
  // ``hasSaved`` mirrors the ref as state so the save button label can
  // switch from "Create" to "Save" without touching a ref during render.
  const [hasSaved, setHasSaved] = useState(isEdit);
  // ``savedId`` mirrors the ref for render-time reads (the react-compiler
  // rule forbids touching a ref during render) — e.g. QuizEditor needs the
  // course id once the course exists.
  const [savedId, setSavedId] = useState(isEdit ? item.id : null);
  // Re-check quality right after the FIRST save of a new course
  // (savedId flips null → id only on create; updates keep the same id).
  const prevSavedIdRef = useRef(savedId);
  useEffect(() => {
    if (savedId && savedId !== prevSavedIdRef.current) {
      prevSavedIdRef.current = savedId;
      fetchQuality();
    }
  }, [savedId, fetchQuality]);
  // ``dirty`` drives the shell's unsaved-changes guard (state, so the
  // UI re-renders); the ref mirrors it for effects/handlers only.
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);

  const markDirty = useCallback(() => {
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      setDirty(true);
      setSaveState('dirty');
    }
  }, []);

  const handleChange = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
    markDirty();
  }, [errors, markDirty]);

  const handleModuleChange = useCallback((index, field, value) => {
    setForm((f) => {
      const modules = f.modules.map((m, i) => (i === index ? { ...m, [field]: value } : m));
      return { ...f, modules };
    });
    markDirty();
  }, [markDirty]);

  const handleModuleBlocksChange = useCallback((index, blocks) => {
    setForm((f) => {
      const modules = f.modules.map((m, i) => (i === index ? { ...m, blocks } : m));
      return { ...f, modules };
    });
    markDirty();
  }, [markDirty]);

  const addModule = useCallback(() => {
    setForm((f) => ({ ...f, modules: [...f.modules, { title: '', description: '' }] }));
    setSelected(form.modules.length);
    markDirty();
  }, [form.modules.length, markDirty]);

  const removeModule = useCallback((index) => {
    setForm((f) => ({ ...f, modules: f.modules.filter((_, i) => i !== index) }));
    setSelected((cur) => (cur === index ? null : (cur > index ? cur - 1 : cur)));
    markDirty();
  }, [markDirty]);

  const moveModule = useCallback((index, dir) => {
    setForm((f) => {
      const modules = [...f.modules];
      const target = index + dir;
      if (target < 0 || target >= modules.length) return f;
      [modules[index], modules[target]] = [modules[target], modules[index]];
      return { ...f, modules };
    });
    setSelected((cur) => (cur === index ? index + dir : cur));
    markDirty();
  }, [markDirty]);

  // ─── HTML5 drag-and-drop module reordering (chevrons stay) ─────────
  const dragModuleRef = useRef(null);
  const [dragOverModule, setDragOverModule] = useState(null);
  const dropModule = useCallback((target) => {
    const src = dragModuleRef.current;
    dragModuleRef.current = null;
    setDragOverModule(null);
    if (src == null || src === target) return;
    setForm((f) => {
      const modules = [...f.modules];
      const [moved] = modules.splice(src, 1);
      modules.splice(target, 0, moved);
      return { ...f, modules };
    });
    setSelected((cur) => {
      if (cur == null) return cur;
      if (cur === src) return target;
      if (src < cur && target >= cur) return cur - 1;
      if (src > cur && target <= cur) return cur + 1;
      return cur;
    });
    markDirty();
  }, [markDirty]);

  // ─── Copy a module's blocks into another module (reuse structure,
  //     fresh block ids) — the fastest way to build a variation. ─────
  const [copyFrom, setCopyFrom] = useState(null);
  const copyBlocksToModule = useCallback((target) => {
    if (copyFrom == null || copyFrom === target) return;
    const src = form.modules[copyFrom]?.blocks || [];
    if (src.length === 0) return;
    setForm((f) => ({
      ...f,
      modules: f.modules.map((m, i) => (i === target
        ? { ...m, blocks: [...(m.blocks || []), ...src.map((b) => ({ ...b, id: `${b.type}-${Date.now()}-copy` }))] }
        : m)),
    }));
    setCopyFrom(null);
    markDirty();
  }, [copyFrom, form.modules, markDirty]);

  // ─── Validation (mirrors the existing course rules + readiness) ──────
  const validate = useCallback(() => {
    const errs = {};
    if (!form.title.trim()) errs.title = isHt ? 'Tit oblije' : 'Title required';
    if (!form.description.trim() || form.description.trim().length < 20) {
      errs.description = isHt
        ? 'Deskripsyon an dwe gen 20 karaktè minimòm'
        : 'Description must be at least 20 characters';
    }
    if (form.price && isNaN(Number(form.price))) {
      errs.price = isHt ? 'Pri a pa valab' : 'Invalid price';
    }
    // External courses must point learners somewhere — a valid destination
    // URL is the one thing that makes an external course real.
    if (isExternal && !form.external_url.trim()) {
      errs.external_url = isHt
        ? 'Ajoute yon URL ekstèn (kote elèv yo ale pou aprann)'
        : 'Add an external URL (where students go to learn)';
    } else if (isExternal && form.external_url.trim() && !/^https?:\/\//i.test(form.external_url.trim())) {
      errs.external_url = isHt ? 'URL la dwe kòmanse ak http(s)://' : 'The URL must start with http(s)://';
    }
    return errs;
  }, [form.title, form.description, form.price, form.external_url, isExternal, isHt]);

  // Validate every language-practice block in the syllabus so a broken
  // exercise is never published silently. Each block problem maps to the
  // module that owns it (target: module index) so [Fix] can jump there.
  const blockReadiness = useCallback((modules) => {
    const items = [];
    (Array.isArray(modules) ? modules : []).forEach((m, mi) => {
      (Array.isArray(m?.blocks) ? m.blocks : []).forEach((b) => {
        if (!b || typeof b !== 'object') return;
        const type = b.type;
        const label = b.title || b.targetText || type;
        const inModule = isHt ? ` (Modil ${mi + 1})` : ` (Module ${mi + 1})`;
        if (type === 'repeat' || type === 'pronunciation' || type === 'vocabulary' || type === 'speaking') {
          if (!String(b.targetText || '').trim()) {
            items.push({
              message: isHt
                ? `Egzèsis ${label} bezwen yon tèks sib.${inModule}`
                : `${label} needs a target text.${inModule}`,
              target: `module-${mi}`,
            });
          }
        }
        if (type === 'listening' && !String(b.referenceAudio || '').trim()) {
          items.push({
            message: isHt
              ? `${label} bezwen odyo referans.${inModule}`
              : `${label} needs reference audio.${inModule}`,
            target: `module-${mi}`,
          });
        }
        if (type === 'conversation') {
          const steps = Array.isArray(b.steps) ? b.steps : [];
          if (steps.length === 0 || steps.some((s) => !String(s?.prompt || '').trim())) {
            items.push({
              message: isHt
                ? `${label} bezwen omwen yon etap ak yon fraz.${inModule}`
                : `${label} needs at least one step with a prompt.${inModule}`,
              target: `module-${mi}`,
            });
          }
        }
      });
    });
    return items;
  }, [isHt]);

  const readiness = useCallback(() => {
    const items = [];
    if (!form.title.trim()) items.push({ message: isHt ? 'Ajoute yon tit' : 'Add a title', target: 'overview' });
    if (!form.description.trim() || form.description.trim().length < 20) {
      items.push({ message: isHt ? 'Ekri deskripsyon an (20+ karaktè)' : 'Write the description (20+ characters)', target: 'overview' });
    }
    if (!form.image_url.trim()) items.push({ message: isHt ? 'Ajoute yon imaj kouvèti' : 'Add a cover image', target: 'props' });
    if (isExternal && !form.external_url.trim()) {
      items.push({ message: isHt ? 'Ajoute URL kou ekstèn lan' : 'Add the external course URL', target: 'props' });
    }
    return items.concat(blockReadiness(form.modules));
  }, [form.title, form.description, form.image_url, form.external_url, isExternal, form.modules, blockReadiness, isHt]);

  // ─── Autosave with draft protection (Phase 5) ──────────────────────
  const autosave = useAutosave({
    id: savedId,
    data: form,
    onSave: async (data) => {
      const payload = {
        title: data.title.trim(),
        short_description: data.short_description.trim(),
        description: data.description.trim(),
        tags: parseHashtags(data.hashtags),
        price: data.price ? Number(data.price) : 0,
        price_ltd: data.price_ltd ? Number(data.price_ltd) : 0,
        category: data.category || '',
        difficulty: data.difficulty || 'beginner',
        teaching_language: data.teaching_language.trim(),
        learner_language: data.learner_language.trim(),
        learning_objective: data.learning_objective.trim(),
        objectives: data.objectives.trim() ? data.objectives.trim().split('\n').filter(Boolean) : [],
        target_audience: data.target_audience.trim(),
        prerequisites: data.prerequisites.trim() ? data.prerequisites.trim().split('\n').filter(Boolean) : [],
        estimated_duration: data.estimated_duration.trim(),
        image_url: data.image_url.trim() || undefined,
        video_url: data.video_url.trim() || undefined,
        delivery_type: isExternal ? 'external' : 'online',
        external_url: isExternal ? data.external_url.trim() : '',
        external_format: isExternal ? data.external_format.trim() : '',
        syllabus: data.modules.length > 0
          ? data.modules.map((m) => ({
              title: m.title.trim(),
              description: m.description.trim(),
              blocks: Array.isArray(m.blocks) ? m.blocks : [],
            }))
          : [],
      };
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
      showToast?.(isHt ? '📋 Bouyon恢复!' : '📋 Draft recovered!', 'check-circle');
    }
  }, [autosave, isHt, showToast]);

  // ─── Save — one function for create + update (existing endpoints) ────
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
    const payload = {
      title: form.title.trim(),
      short_description: form.short_description.trim(),
      description: form.description.trim(),
      tags: parseHashtags(form.hashtags),
      price: form.price ? Number(form.price) : 0,
      price_ltd: form.price_ltd ? Number(form.price_ltd) : 0,
      category: form.category || '',
      difficulty: form.difficulty || 'beginner',
      // Optional language-course metadata — empty strings are fine.
      teaching_language: form.teaching_language.trim(),
      learner_language: form.learner_language.trim(),
      learning_objective: form.learning_objective.trim(),
      // Extended course metadata (Phase 1 — Universal Course Studio)
      objectives: form.objectives.trim() ? form.objectives.trim().split('\n').filter(Boolean) : [],
      target_audience: form.target_audience.trim(),
      prerequisites: form.prerequisites.trim() ? form.prerequisites.trim().split('\n').filter(Boolean) : [],
      estimated_duration: form.estimated_duration.trim(),
      image_url: form.image_url.trim() || undefined,
      video_url: form.video_url.trim() || undefined,
      completion_rules: form.completion_rules,
      // Delivery model — online vs external (backend choices).
      delivery_type: isExternal ? 'external' : 'online',
      external_url: isExternal ? form.external_url.trim() : '',
      external_format: isExternal ? form.external_format.trim() : '',
      // The existing syllabus JSON — the course's content structure
      // (optional for external courses — Atelnyo is the organizer,
      // not the host). ``blocks`` (language-practice items) ride along
      // inside each module entry — additive, never stripped.
      syllabus: form.modules.length > 0
        ? form.modules.map((m) => ({
            title: m.title.trim(),
            description: m.description.trim(),
            blocks: Array.isArray(m.blocks) ? m.blocks : [],
          }))
        : [],
    };
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
      dirtyRef.current = false;
      setDirty(false);
      setSaveState('saved');
      setSaveError('');
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
  }, [form, validate, isHt, showToast]);

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
  }, [form, saveState, doSave]);

  // ─── Cleanup ─────────────────────────────────────────────────────────
  useEffect(() => () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
  }, []);

  const handleSave = useCallback(() => { doSave(); }, [doSave]);

  // ─── Publish (draft → published) ────────────────────────────────────
  // Courses are created as DRAFT (Creator Studio §25) and publishing is
  // the explicit, validated action — a course is only public after
  // POST /courses/<id>/publish/ passes the server-side gate. If the
  // course hasn't been saved yet (fresh editor), save it first, then
  // publish. Gate failures (title/description/cover/external URL) are
  // surfaced so the creator can fix them inline.
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
        dirtyRef.current = false;
        setDirty(false);
        setSaveState('saved');
        setSaveError('');
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
  }, [publishing, doSave, isHt, showToast]);

  // ─── Live "View as Learner" preview ─────────────────────────────────
  // Renders the CURRENT editor state (unsaved changes included) with
  // the real learner block components — no save, no enrollment needed.
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const handlePreview = useCallback(() => {
    if (form.modules.length === 0) {
      showToast?.(isHt ? 'Ajoute yon modil anvan w fè preview.' : 'Add a module before previewing.', 'circle-info');
      return;
    }
    setPreviewOpen(true);
  }, [form.modules.length, isHt, showToast]);

  const activeModule = selected === null ? null : form.modules[selected];

  const navigateQualityTarget = useCallback((target) => {
    if (target === 'overview') setSelected(null);
    if (target === 'props') setSelected(null);
    if (target === 'curriculum') {
      setSelected('curriculum');
      setCurriculumMode(true);
    }
    if (typeof target === 'string' && target.startsWith('module-')) {
      const mi = Number(target.slice('module-'.length));
      if (Number.isInteger(mi) && mi >= 0 && mi < form.modules.length) setSelected(mi);
    }
  }, [form.modules.length]);

  // ─── Structure panel (left) ──────────────────────────────────────────
  const structurePanel = (
    <>
      <div className={styles.structureHeader}>
        <span className={styles.structureTitle}>
          <i className="fas fa-list-ol" aria-hidden="true" />
          {isHt ? 'Estrikti Kou' : 'Course Structure'}
        </span>
        <button
          type="button"
          className={styles.structureAdd}
          onClick={addModule}
          aria-label={isHt ? 'Ajoute yon modil' : 'Add a module'}
          title={isHt ? 'Ajoute modil' : 'Add module'}
        >
          <i className="fas fa-plus" aria-hidden="true" />
        </button>
      </div>
      <div className={styles.structureList}>
        <button
          type="button"
          className={`${styles.structureItem} ${selected === null ? styles.structureItemActive : ''}`}
          onClick={() => setSelected(null)}
        >
          <i className="fas fa-book-open" aria-hidden="true" style={{ color: 'var(--color-primary)', width: 20, textAlign: 'center' }} />
          <span className={styles.structureItemText}>
            <span className={styles.structureItemTitle}>{isHt ? 'Apèsi' : 'Overview'}</span>
            <span className={styles.structureItemMeta}>
              {isHt ? 'Tit ak deskripsyon kou a' : 'Course title & description'}
            </span>
          </span>
        </button>
        {form.modules.map((m, i) => (
          <div
            key={i}
            data-testid="structure-row"
            className={`${styles.structureRow}${dragOverModule === i ? ' is-drag-over' : ''}`}
            draggable
            onDragStart={(e) => { dragModuleRef.current = i; e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverModule(i); }}
            onDragLeave={() => setDragOverModule((cur) => (cur === i ? null : cur))}
            onDrop={(e) => { e.preventDefault(); dropModule(i); }}
            onDragEnd={() => { dragModuleRef.current = null; setDragOverModule(null); }}
          >
            <button
              type="button"
              className={`${styles.structureItem} ${selected === i ? styles.structureItemActive : ''}`}
              onClick={() => setSelected(i)}
            >
              <span className={styles.structureItemHint}>{String(i + 1).padStart(2, '0')}</span>
              <span className={styles.structureItemText}>
                <span className={styles.structureItemTitle}>{m.title.trim() || (isHt ? `Modil ${i + 1}` : `Module ${i + 1}`)}</span>
                <span className={styles.structureItemMeta}>
                  {m.description.trim()
                    ? `${m.description.trim().length} ${isHt ? 'karaktè' : 'chars'}`
                    : (isHt ? 'Pa gen kontni ankò' : 'No content yet')}
                </span>
              </span>
            </button>
            <span className={styles.structureItemControls}>
              <button
                type="button"
                className={styles.structureItemCtrl}
                onClick={() => moveModule(i, -1)}
                disabled={i === 0}
                aria-label={isHt ? 'Monte' : 'Move up'}
                title={isHt ? 'Monte' : 'Move up'}
              >
                <i className="fas fa-chevron-up" aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.structureItemCtrl}
                onClick={() => moveModule(i, 1)}
                disabled={i === form.modules.length - 1}
                aria-label={isHt ? 'Desann' : 'Move down'}
                title={isHt ? 'Desann' : 'Move down'}
              >
                <i className="fas fa-chevron-down" aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`${styles.structureItemCtrl}${copyFrom === i ? ` ${styles.structureItemCtrlActive || ''}` : ''}`}
                onClick={() => setCopyFrom(copyFrom === i ? null : i)}
                aria-label={isHt ? 'Kopye blòk yo' : 'Copy blocks'}
                title={isHt ? 'Kopye blòk modil sa a nan yon lòt' : 'Copy this module’s blocks into another'}
              >
                <i className="fas fa-copy" aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`${styles.structureItemCtrl} ${styles.structureItemCtrlDanger}`}
                onClick={() => removeModule(i)}
                aria-label={isHt ? 'Efase modil' : 'Delete module'}
                title={isHt ? 'Efase' : 'Delete'}
              >
                <i className="fas fa-trash" aria-hidden="true" />
              </button>
            </span>
          </div>
        ))}
        {form.modules.length === 0 && (
          <p className={styles.propsHint} style={{ padding: '0 var(--sp-lg)' }}>
            {isHt
              ? 'Ajoute modil pou òganize leson yo (Egzanp: Chapit 1, Chapit 2...).'
              : 'Add modules to organize lessons (e.g. Chapter 1, Chapter 2…).'}
          </p>
        )}

        {/* Curriculum tab (Phase 2 — Chapter/Lesson hierarchy) */}
        {savedId && (
          <button
            type="button"
            className={`${styles.structureItem} ${selected === 'curriculum' ? styles.structureItemActive : ''}`}
            onClick={() => { setSelected('curriculum'); setCurriculumMode(true); }}
          >
            <i className="fas fa-sitemap" aria-hidden="true" style={{ color: '#10b981', width: 20, textAlign: 'center' }} />
            <span className={styles.structureItemText}>
              <span className={styles.structureItemTitle}>{isHt ? 'Kurikilom' : 'Curriculum'}</span>
              <span className={styles.structureItemMeta}>
                {isHt ? 'Chapit & leson detaye' : 'Detailed chapters & lessons'}
              </span>
            </span>
          </button>
        )}

        {/* Validation tab (Phase 3 — Content Validation Engine) */}
        {savedId && (
          <button
            type="button"
            className={`${styles.structureItem} ${selected === 'validation' ? styles.structureItemActive : ''}`}
            onClick={() => setSelected('validation')}
          >
            <i className="fas fa-shield-halved" aria-hidden="true" style={{ color: '#8b5cf6', width: 20, textAlign: 'center' }} />
            <span className={styles.structureItemText}>
              <span className={styles.structureItemTitle}>{isHt ? 'Validasyon' : 'Validation'}</span>
              <span className={styles.structureItemMeta}>
                {isHt ? 'Kalite kontni ak tcheke publish' : 'Content quality & publish check'}
              </span>
            </span>
          </button>
        )}

        {/* FAQ tab — always available for saved courses */}
        {savedIdRef.current && (
          <button
            type="button"
            className={`${styles.structureItem} ${selected === 'faq' ? styles.structureItemActive : ''}`}
            onClick={() => setSelected('faq')}
          >
            <i className="fas fa-question-circle" aria-hidden="true" style={{ color: '#f59e0b', width: 20, textAlign: 'center' }} />
            <span className={styles.structureItemText}>
              <span className={styles.structureItemTitle}>{isHt ? 'FAQ' : 'FAQ'}</span>
              <span className={styles.structureItemMeta}>
                {isHt ? 'Kesyon ak repons pou elèv yo' : 'Questions & answers for learners'}
              </span>
            </span>
          </button>
        )}

        {/* Cross-module copy: pick a destination for the copied blocks. */}
        {copyFrom != null && (
          <div className={styles.structureCopyBar}>
            <span>
              {isHt
                ? `Kopye ${(form.modules[copyFrom]?.blocks || []).length} blòk yo nan:`
                : `Copy ${(form.modules[copyFrom]?.blocks || []).length} blocks to:`}
            </span>
            {form.modules.map((m, i) => i !== copyFrom && (
              <button
                key={i}
                type="button"
                className={styles.structureCopyTarget}
                onClick={() => copyBlocksToModule(i)}
              >
                {m.title.trim() || `${isHt ? 'Modil' : 'Module'} ${i + 1}`}
              </button>
            ))}
            <button
              type="button"
              className={styles.structureCopyCancel}
              onClick={() => setCopyFrom(null)}
            >
              {isHt ? 'Anile' : 'Cancel'}
            </button>
          </div>
        )}
      </div>
    </>
  );

  // ─── Main editor canvas ──────────────────────────────────────────────
  const editorPanel = (
    <div className={styles.editorSection}>
      <header className={styles.editorSectionHeader}>
        <span className={styles.editorSectionIcon}>
          <i className={`fas ${selected === 'faq' ? 'fa-question-circle' : selected === 'curriculum' ? 'fa-sitemap' : selected === 'validation' ? 'fa-shield-halved' : selected === 'lesson' ? 'fa-file-lines' : selected === null ? 'fa-book-open' : 'fa-file-lines'}`} aria-hidden="true" />
        </span>
        <div>
          <h2 className={styles.editorSectionTitle}>
            {selected === 'faq'
              ? 'FAQ'
              : selected === 'curriculum'
                ? (isHt ? 'Kurikilom' : 'Curriculum')
                : selected === 'validation'
                  ? (isHt ? 'Validasyon Kontni' : 'Content Validation')
                  : selected === 'lesson'
                    ? (isHt ? 'Editè Leson' : 'Lesson Editor')
                    : selected === null
                      ? (isHt ? 'Apèsi Kou' : 'Course Overview')
                      : (isHt ? 'Modil Editè' : 'Module Editor')}
          </h2>
          <p className={styles.editorSectionHint}>
            {selected === 'faq'
              ? (isHt ? 'Kesyon ak repons pou elèv yo — jere, òganize, ak kontwole vizibilite.' : 'Questions & answers for learners — manage, organize, and control visibility.')
              : selected === 'validation'
                ? (isHt ? 'Tcheke kalite kontni an ak erè anvan publish.' : 'Check content quality and errors before publishing.')
                : selected === 'curriculum'
                ? (isHt ? 'Bati estrikti kou a ak chapit ak leson detaye.' : 'Build the course structure with chapters and detailed lessons.')
                : selected === 'lesson'
                  ? (isHt ? `Modifye blòk kontni leson: ${selectedLesson?.title || '...'}` : `Edit content blocks for lesson: ${selectedLesson?.title || '...'}`)
                  : selected === null
                    ? (isHt ? 'Tit ak deskripsyon an — sa achtè yo wè an premye.' : 'Title and description — what buyers see first.')
                    : (isHt ? 'Kontni modil la — leson, konsèy, ak materyèl.' : 'Module content — lessons, tips, and materials.')}
          </p>
        </div>
      </header>
      <div className={styles.canvas}>
        {selected === 'faq' ? (
          <CourseFaqEditor
            courseId={savedId}
            modules={form.modules}
            lang={lang}
            showToast={showToast}
          />
        ) : selected === 'curriculum' ? (
          <CurriculumBuilder
            courseId={savedId}
            lang={lang}
            selectedLessonId={selectedLesson?.id}
            onSelectLesson={(lesson) => {
              setSelectedLesson(lesson);
              if (lesson) setSelected('lesson');
            }}
            showToast={showToast}
          />
        ) : selected === 'validation' ? (
          <div>
            <ContentStructureView
              chapters={form.modules || []}
              courseTitle={form.title || ''}
              lang={lang}
            />
            <ContentValidationEngine
              courseId={savedId}
              lang={lang}
              showToast={showToast}
              onNavigate={(msg) => {
                showToast?.(msg, 'circle-info');
              }}
            />
          </div>
        ) : selected === 'lesson' && selectedLesson ? (
          <LessonEditor
            lesson={selectedLesson}
            lang={lang}
            onUpdate={(id, data) => {
              setSelectedLesson((prev) => prev ? { ...prev, ...data } : null);
            }}
            showToast={showToast}
          />
        ) : selected === null ? (
          <>
            <input
              className={styles.canvasTitle}
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder={isHt ? 'Tit kou a...' : 'Course title…'}
              maxLength={200}
              aria-invalid={errors.title ? 'true' : 'false'}
            />
            {errors.title && (
              <span className={styles.propsError} role="alert">
                <i className="fas fa-circle-exclamation" aria-hidden="true" /> {errors.title}
              </span>
            )}
            <textarea
              className={styles.canvasBody}
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder={isHt
                ? 'Dekri sa elèv yo pral aprann, pou kiyès li ye, ak rezilta yo pral jwenn...'
                : 'Describe what students will learn, who it is for, and the outcome…'}
              rows={10}
              maxLength={5000}
              aria-invalid={errors.description ? 'true' : 'false'}
            />
            {errors.description && (
              <span className={styles.propsError} role="alert">
                <i className="fas fa-circle-exclamation" aria-hidden="true" /> {errors.description}
              </span>
            )}
          </>
        ) : (
          <>
            <input
              className={styles.canvasTitle}
              value={activeModule?.title || ''}
              onChange={(e) => handleModuleChange(selected, 'title', e.target.value)}
              placeholder={isHt ? 'Tit modil la...' : 'Module title…'}
              maxLength={200}
            />
            <textarea
              className={styles.canvasBody}
              value={activeModule?.description || ''}
              onChange={(e) => handleModuleChange(selected, 'description', e.target.value)}
              placeholder={isHt
                ? 'Ekri kontni leson an isit la...'
                : 'Write the lesson content here…'}
              rows={12}
            />
            {/* Universal content block editor for this module */}
            <BlockEditor
              blocks={activeModule?.blocks || []}
              onBlocksChange={(blocks) => handleModuleBlocksChange(selected, blocks)}
              lang={lang}
              courseId={savedId}
              moduleIndex={selected}
            />
            {/* Real quiz for this module (requires a saved course) */}
            <QuizEditor
              courseId={savedId}
              moduleIndex={selected}
              lang={lang}
            />
          </>
        )}
      </div>
    </div>
  );

  // ─── Field completion tracking ───────────────────────────────────────
  const fieldCompletion = useMemo(() => {
    const basicFields = [form.title, form.short_description, form.description, form.category, form.difficulty].filter(Boolean).length;
    const goalFields = [form.target_audience, form.objectives, form.learning_objective].filter(Boolean).length;
    const mediaFields = [form.image_url, form.hashtags].filter(Boolean).length;
    const priceFields = [form.price, form.price_ltd].filter(Boolean).length;
    return {
      basic: Math.round((basicFields / 5) * 100),
      goals: Math.round((goalFields / 3) * 100),
      media: Math.round((mediaFields / 2) * 100),
      price: Math.round((priceFields / 2) * 100),
      overall: Math.round(
        ((basicFields + goalFields + mediaFields + priceFields) / 12) * 100
      ),
    };
  }, [form]);

  const qualityGroups = useMemo(() => {
    const groups = {
      course: { title: isHt ? 'Enfòmasyon kou' : 'Course information', target: 'overview', items: [] },
      curriculum: { title: isHt ? 'Kurikilòm' : 'Curriculum', target: 'curriculum', items: [] },
      media: { title: isHt ? 'Medya & aksè' : 'Media & access', target: 'props', items: [] },
      path: { title: isHt ? 'Che aprantisaj' : 'Learning path', target: 'props', items: [] },
      projects: { title: isHt ? 'Pwojè' : 'Projects', target: 'props', items: [] },
      misc: { title: isHt ? 'Rekòmandasyon' : 'Recommendations', target: 'props', items: [] },
    };

    const classify = (issue) => {
      const text = `${issue?.entity_type || ''} ${issue?.code || ''} ${issue?.message || ''}`.toLowerCase();
      if (/(course|title|description|category|visibility|metadata|overview)/.test(text)) return 'course';
      if (/(module|curriculum|lesson|chapter|empty_lesson|empty_module|ordering|duplicate)/.test(text)) return 'curriculum';
      if (/(media|image|video|url|external|audio|embed|cover)/.test(text)) return 'media';
      if (/(prereq|schedule|access|completion|dependency|unlock|circular)/.test(text)) return 'path';
      if (/(project|template|field|section|lesson binding)/.test(text)) return 'projects';
      return 'misc';
    };

    const addIssue = (list, issue, severity) => {
      if (!issue || !issue.message) return;
      const level = severity || (issue.level || 'warning');
      const group = groups[classify(issue)];
      if (!group) return;
      list.push({ ...issue, level, target: group.target });
    };

    const issues = [];
    if (qualityReport) {
      const errorItems = Array.isArray(qualityReport.errors) ? qualityReport.errors : [];
      const warningItems = Array.isArray(qualityReport.warnings) ? qualityReport.warnings : [];
      const recItems = Array.isArray(qualityReport.recommendations) ? qualityReport.recommendations : [];
      errorItems.forEach((issue) => addIssue(issues, issue, 'error'));
      warningItems.forEach((issue) => addIssue(issues, issue, 'warning'));
      recItems.forEach((issue) => addIssue(issues, issue, 'info'));
    }

    issues.forEach((issue) => { groups[classify(issue)]?.items.push(issue); });

    return Object.values(groups).filter((group) => group.items.length > 0);
  }, [isHt, qualityReport]);

  // ─── Delivery badge for the shell header ────────────────────────────
  const deliveryBadge = (
    <span className={`${styles.deliveryBadge} ${isExternal ? styles.deliveryBadgeExternal : styles.deliveryBadgeOnline}`}>
      <i className={`fas ${isExternal ? 'fa-globe' : 'fa-laptop-code'}`} aria-hidden="true" />
      {isExternal
        ? (isHt ? 'Kou Ekstèn' : 'External')
        : (isHt ? 'Sou Atelnyo' : 'Online')}
    </span>
  );

  // ─── Properties panel (right) ────────────────────────────────────────
  const propsPanel = (
    <>
      <PropertyGroup
        icon="fa-circle-info"
        label="Basic Information"
        labelHt="Enfòmasyon Bazik"
        lang={lang}
        defaultOpen
        completionPct={fieldCompletion.basic}
        accent="#3b82f6"
      >
        <PropField label="Short Description" labelHt="Deskripsyon Kout" lang={lang}>
          <PropInput
            value={form.short_description}
            onChange={(e) => handleChange('short_description', e.target.value)}
            placeholder={isHt ? 'Rezime kout pou kat ak previews...' : 'One-line summary for cards and previews...'}
            maxLength={200}
          />
        </PropField>
        <PropField label="Difficulty" labelHt="Nivo" lang={lang}>
          <PropSelect value={form.difficulty} onChange={(e) => handleChange('difficulty', e.target.value)}>
            <option value="beginner">{isHt ? 'Debitan' : 'Beginner'}</option>
            <option value="intermediate">{isHt ? 'Mwayen' : 'Intermediate'}</option>
            <option value="advanced">{isHt ? 'Avanse' : 'Advanced'}</option>
          </PropSelect>
        </PropField>
        <PropField label="Category" labelHt="Kategori" lang={lang}>
          <PropInput
            value={form.category}
            onChange={(e) => handleChange('category', e.target.value)}
            placeholder={isHt ? 'Teknoloji, Biznis, Atizay...' : 'Technology, Business, Art…'}
          />
        </PropField>
        <PropField label="Estimated Duration" labelHt="Durasyon Estime" lang={lang}>
          <PropInput
            value={form.estimated_duration}
            onChange={(e) => handleChange('estimated_duration', e.target.value)}
            placeholder={isHt ? '12 èdtan, 4 semèn, 20 lesyon...' : '12 hours, 4 weeks, 20 lessons...'}
            maxLength={60}
          />
        </PropField>
      </PropertyGroup>

      <PropertyGroup
        icon="fa-bullseye"
        label="Learning Goals"
        labelHt="Objektif Aprantisaj"
        lang={lang}
        completionPct={fieldCompletion.goals}
        accent="#10b981"
      >
        <PropField label="Target Audience" labelHt="Odyans Tashe" lang={lang}>
          <PropInput
            value={form.target_audience}
            onChange={(e) => handleChange('target_audience', e.target.value)}
            placeholder={isHt ? 'Kiyès kou sa a ye pou?' : 'Who is this course for?'}
            maxLength={300}
          />
        </PropField>
        <PropField label="Learning Objectives" labelHt="Objektif" lang={lang}>
          <textarea
            className={styles.propsTextarea}
            value={form.objectives}
            onChange={(e) => handleChange('objectives', e.target.value)}
            placeholder={isHt ? 'Yonn pa lin\nAprende baz Python\nBati yon sit web' : 'One per line\nLearn Python basics\nBuild a web app'}
            rows={3}
          />
        </PropField>
        <PropField label="Prerequisites" labelHt="Prevwa" lang={lang}>
          <textarea
            className={styles.propsTextarea}
            value={form.prerequisites}
            onChange={(e) => handleChange('prerequisites', e.target.value)}
            placeholder={isHt ? 'Yonn pa lin\nKonnen enfòmatik bazik\nPython enstale' : 'One per line\nBasic computer skills\nPython installed'}
            rows={2}
          />
        </PropField>
      </PropertyGroup>

      <PropertyGroup
        icon="fa-language"
        label="Language Settings"
        labelHt="Anviwònman Lang"
        accent="#f59e0b"
        lang={lang}
        hint={isHt
          ? 'Opsyonèl — sèlman pou kou lang. Pa enfòse sou lòt kou.'
          : 'Optional — for language courses only. Never forced on other courses.'}
      >
        <PropField label="Teaching language" labelHt="Lang ansèyman" lang={lang}>
          <PropInput
            value={form.teaching_language}
            onChange={(e) => handleChange('teaching_language', e.target.value)}
            placeholder={isHt ? 'Anglè, Kreyòl, Panyòl...' : 'English, Haitian Creole, Spanish…'}
            maxLength={60}
          />
        </PropField>
        <PropField
          label="Learner language"
          labelHt="Lang elèv"
          lang={lang}
          hint={isHt ? 'Fakiltatif — se pa tout kou lang gen yon lang tradiksyon.' : 'Optional — not every language course has a translation language.'}
        >
          <PropInput
            value={form.learner_language}
            onChange={(e) => handleChange('learner_language', e.target.value)}
            placeholder={isHt ? 'Kreyòl Ayisyen...' : 'Haitian Creole…'}
            maxLength={60}
          />
        </PropField>
        <PropField label="Learning objective" labelHt="Objektif aprantisaj" lang={lang}>
          <PropInput
            value={form.learning_objective}
            onChange={(e) => handleChange('learning_objective', e.target.value)}
            placeholder={isHt ? 'e.g. Kòmande manje an Anglè.' : 'e.g. Order food in English.'}
            maxLength={300}
          />
        </PropField>
      </PropertyGroup>

      {/* §40 — Completion Rules Configuration */}
      <PropertyGroup
        icon="fa-list-check"
        label="Completion Rules"
        labelHt="Règ Konpleksyon"
        lang={lang}
        accent="#10b981"
        hint={isHt ? 'Konfigurè règ pou konplete kou a. Pa gen règ = tout blòk obligatwa dwe fini.' : 'Configure rules for course completion. No rules = all required blocks must be completed.'}
      >
        <CompletionRulesEditor
          rules={form.completion_rules || []}
          onChange={(rules) => handleChange('completion_rules', rules)}
          lang={lang}
          blocks={[]} /* Course-level — no block selection needed here */
        />
      </PropertyGroup>

      <PropertyGroup icon="fa-hashtag" label="Discovery" labelHt="Dekouvèt" lang={lang} completionPct={fieldCompletion.media} accent="#8b5cf6">
        <PropField
          label="Hashtags"
          labelHt="Hashtags"
          lang={lang}
          hint={isHt ? 'Separe ak espas — #Python #Kreyol' : 'Separate with spaces — #Python #Kreyol'}
        >
          <PropInput
            value={form.hashtags}
            onChange={(e) => handleChange('hashtags', e.target.value)}
            placeholder="#Python #Kreyol #Education"
            maxLength={120}
          />
        </PropField>
        <MediaUploadButton
          value={form.image_url}
          onChange={(v) => handleChange('image_url', v)}
          kind="image"
          label={isHt ? 'Imaj Kouvèti' : 'Cover Image'}
          placeholder="https://example.com/cover.jpg"
          isPremium={isPremium}
          required
          lang={lang}
        />
        <MediaUploadButton
          value={form.video_url}
          onChange={(v) => handleChange('video_url', v)}
          kind="video"
          label={isHt ? 'Videyo Pwomosyon' : 'Promo Video'}
          placeholder="https://youtube.com/watch?v=..."
          isPremium={isPremium}
          lang={lang}
        />
      </PropertyGroup>

      <PropertyGroup icon="fa-tag" label="Access & Price" labelHt="Aksè & Pri" lang={lang} completionPct={fieldCompletion.price} accent="#ec4899">
        <PropField label="Price ($)" labelHt="Pri ($)" lang={lang} error={errors.price}>
          <PropInput
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={form.price}
            onChange={(e) => handleChange('price', e.target.value)}
            placeholder="0.00"
          />
        </PropField>
        <PropField
          label="LTD Price ($)"
          labelHt="Pri LTD ($)"
          lang={lang}
          hint={isHt
            ? 'Pri yon fwa pou aksè pou toujou. Kite vid si pa gen LTD.'
            : 'One-time price for lifetime access. Leave empty if no LTD.'}
        >
          <PropInput
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={form.price_ltd}
            onChange={(e) => handleChange('price_ltd', e.target.value)}
            placeholder="0.00"
          />
        </PropField>
      </PropertyGroup>

      {isExternal && (
        <PropertyGroup icon="fa-globe" label="Where Learning Happens" labelHt="Kote Aprantisaj la Fèt" lang={lang} defaultOpen>
          <PropField
            label="External Course URL"
            labelHt="URL Kou Ekstèn"
            lang={lang}
            error={errors.external_url}
            hint={isHt
              ? 'Kote elèv yo ale pou enskri oswa aprann (Zoom, YouTube, yon sit, yon enstitisyon...)'
              : 'Where students go to enroll or learn (Zoom, YouTube, a website, an institution…)'}
          >
            <PropInput
              type="url"
              value={form.external_url}
              onChange={(e) => handleChange('external_url', e.target.value)}
              placeholder="https://example.com/enroll"
            />
          </PropField>
          <PropField
            label="Course Format"
            labelHt="Fòma Kou a"
            lang={lang}
            hint={isHt ? 'Zoom, Google Meet, YouTube, klas, enstitisyon...' : 'Zoom, Google Meet, YouTube, classroom, institution…'}
          >
            <PropInput
              value={form.external_format}
              onChange={(e) => handleChange('external_format', e.target.value)}
              placeholder={isHt ? 'Zoom / YouTube / Klas...' : 'Zoom / YouTube / Classroom…'}
              maxLength={100}
            />
          </PropField>
        </PropertyGroup>
      )}

      <PropertyGroup icon="fa-chart-line" label="Course Quality" labelHt="Kalite Kou" lang={lang} accent="#6366f1">
        {qualityLoading ? (
          <p className={styles.propsHint}>
            <i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap tcheke...' : 'Checking…'}
          </p>
        ) : qualityReport ? (
          (() => {
            const qErrors = Array.isArray(qualityReport.errors) ? qualityReport.errors : [];
            const qWarnings = Array.isArray(qualityReport.warnings) ? qualityReport.warnings : [];
            const qRecs = Array.isArray(qualityReport.recommendations) ? qualityReport.recommendations : [];
            const readiness = qualityReport.readiness_level || (qualityReport.is_publishable ? 'ready' : (qErrors.length > 0 ? 'blocked' : 'needs_attention'));
            const readinessText = readiness === 'ready'
              ? (isHt ? 'Pare pou pibliye' : 'Ready to publish')
              : readiness === 'needs_attention'
                ? (isHt ? 'Bezwen atansyon' : 'Needs attention')
                : (isHt ? 'Bloke' : 'Blocked');
            const readinessColor = readiness === 'ready' ? '#10b981' : readiness === 'needs_attention' ? '#f59e0b' : '#ef4444';
            const clean = qErrors.length === 0 && qWarnings.length === 0 && qRecs.length === 0;
            const issueGroups = qualityGroups.length > 0 ? qualityGroups : [{ title: isHt ? 'Lè sa a' : 'At the moment', target: 'overview', items: [] }];

            return (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.85rem',
                    background: readinessColor, color: '#fff', flexShrink: 0,
                  }}>
                    {readiness === 'ready' ? '✓' : readiness === 'needs_attention' ? '!' : 'X'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: readinessColor }}>
                      {readinessText}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {qErrors.length} {isHt ? 'erè' : 'errors'} · {qWarnings.length} {isHt ? 'avètisman' : 'warnings'} · {qRecs.length} {isHt ? 'rekòmandasyon' : 'tips'}
                    </div>
                  </div>
                </div>

                {issueGroups.map((group) => (
                  <div key={group.title} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 6 }}>
                      {group.title}
                    </div>
                    {group.items.length === 0 ? (
                      <div style={{ fontSize: '0.76rem', color: '#10b981' }}>
                        {isHt ? 'Tout sa bon nan seksyon sa a.' : 'This section looks good.'}
                      </div>
                    ) : (
                      group.items.map((issue, idx) => {
                        const severityColor = issue.level === 'error' ? '#ef4444' : issue.level === 'warning' ? '#f59e0b' : '#10b981';
                        const icon = issue.level === 'error' ? '❌' : issue.level === 'warning' ? '⚠️' : '💡';
                        return (
                          <button
                            key={`${group.title}-${idx}`}
                            type="button"
                            onClick={() => {
                              navigateQualityTarget(issue.target || group.target || 'overview');
                            }}
                            style={{
                              width: '100%', textAlign: 'left', background: 'transparent', border: '1px solid rgba(148,163,184,0.25)',
                              borderRadius: 8, padding: '8px 10px', marginBottom: 6, color: 'var(--text-primary)', cursor: 'pointer',
                              display: 'flex', alignItems: 'flex-start', gap: 8,
                            }}
                          >
                            <span aria-hidden="true">{icon}</span>
                            <span style={{ color: severityColor, fontSize: '0.77rem', lineHeight: 1.4 }}>{issue.message}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                ))}

                {clean && (
                  <p style={{ fontSize: '0.78rem', color: '#10b981', margin: 0 }}>
                    ✅ {isHt ? 'Pa gen pwoblèm — kou a pare!' : 'No issues — the course is ready!'}
                  </p>
                )}
                {!qualityReport.is_publishable && (
                  <p style={{ fontSize: '0.75rem', color: '#ef4444', margin: '8px 0 0' }}>
                    {isHt ? 'Kòrèk erè yo anvan w pibliye.' : 'Fix the errors before publishing.'}
                  </p>
                )}
              </>
            );
          })()
        ) : (
          <p className={styles.propsHint}>
            {isHt ? 'Sove kou a pou wè rapò kalite a.' : 'Save the course to see the quality report.'}
          </p>
        )}
        {savedIdRef.current && (
          <button type="button" className={styles.propsBtn} onClick={fetchQuality}>
            <i className="fas fa-refresh" /> {isHt ? 'Rechaje' : 'Refresh'}
          </button>
        )}
      </PropertyGroup>

      <PropertyGroup icon="fa-rocket" label="Publishing" labelHt="Piblikasyon" lang={lang} accent="#3b82f6">
        {/* Current status badge */}
        <div className={styles.statusBadgeRow}>
          <span className={`${styles.statusBadge} ${styles[`status_${courseStatus}`] || ''}`}>
            {courseStatus === 'draft' && <><i className="fas fa-pen" /> {isHt ? 'Bouyon' : 'Draft'}</>}
            {courseStatus === 'building' && <><i className="fas fa-hammer" /> {isHt ? 'Ap bati' : 'Building'}</>}
            {courseStatus === 'review' && <><i className="fas fa-eye" /> {isHt ? 'Revizyon' : 'Review'}</>}
            {courseStatus === 'published' && <><i className="fas fa-globe" /> {isHt ? 'Pibliye' : 'Published'}</>}
            {courseStatus === 'updating' && <><i className="fas fa-sync" /> {isHt ? 'Mete ajou' : 'Updating'}</>}
            {courseStatus === 'archived' && <><i className="fas fa-archive" /> {isHt ? 'Achive' : 'Archived'}</>}
          </span>
        </div>

        {/* Status transition buttons */}
        {isEdit && (
          <div className={styles.statusTransitions}>
            {courseStatus === 'draft' && (
              <button type="button" className={styles.statusTransitionBtn} onClick={async () => {
                try { await courseService.transition(savedIdRef.current, 'building'); setCourseStatus('building'); showToast?.(isHt ? 'Kou a kòmanse bati.' : 'Course moved to building.', 'check-circle'); } catch (e) { showToast?.(e?.response?.data?.detail || 'Error', 'circle-exclamation'); }
              }}>
                <i className="fas fa-hammer" /> {isHt ? 'Kòmanse bati' : 'Start building'}
              </button>
            )}
            {courseStatus === 'building' && (
              <button type="button" className={styles.statusTransitionBtn} onClick={async () => {
                try { await courseService.transition(savedIdRef.current, 'review'); setCourseStatus('review'); showToast?.(isHt ? 'Kou a nan revizyon.' : 'Course submitted for review.', 'check-circle'); } catch (e) { showToast?.(e?.response?.data?.detail || 'Error', 'circle-exclamation'); }
              }}>
                <i className="fas fa-eye" /> {isHt ? 'Voye pou revizyon' : 'Submit for review'}
              </button>
            )}
            {courseStatus === 'review' && (
              <button type="button" className={styles.statusTransitionBtn} onClick={async () => {
                try { await courseService.transition(savedIdRef.current, 'building'); setCourseStatus('building'); showToast?.(isHt ? 'Retounen nan bati.' : 'Returned to building.', 'check-circle'); } catch (e) { showToast?.(e?.response?.data?.detail || 'Error', 'circle-exclamation'); }
              }}>
                <i className="fas fa-arrow-left" /> {isHt ? 'Retounen nan bati' : 'Back to building'}
              </button>
            )}
            {(courseStatus === 'published' || courseStatus === 'updating') && (
              <button type="button" className={`${styles.statusTransitionBtn} ${styles.statusTransitionDanger}`} onClick={async () => {
                if (!window.confirm(isHt ? 'Vle achive kou sa a?' : 'Archive this course?')) return;
                try { await courseService.transition(savedIdRef.current, 'archived'); setCourseStatus('archived'); showToast?.(isHt ? 'Kou a achive.' : 'Course archived.', 'check-circle'); } catch (e) { showToast?.(e?.response?.data?.detail || 'Error', 'circle-exclamation'); }
              }}>
                <i className="fas fa-archive" /> {isHt ? 'Achive' : 'Archive'}
              </button>
            )}
            {courseStatus === 'archived' && (
              <button type="button" className={styles.statusTransitionBtn} onClick={async () => {
                try { await courseService.transition(savedIdRef.current, 'draft'); setCourseStatus('draft'); showToast?.(isHt ? 'Kou a retounen nan bouyon.' : 'Course restored to draft.', 'check-circle'); } catch (e) { showToast?.(e?.response?.data?.detail || 'Error', 'circle-exclamation'); }
              }}>
                <i className="fas fa-undo" /> {isHt ? 'Retounen' : 'Restore'}
              </button>
            )}
          </div>
        )}

        <p className={styles.propsHint}>
          {isHt
            ? isExternal
              ? 'Kou a kòmanse kòm bouyon. Klike “Pibliye” anlè a pou l vin piblik — Atelnyo prezante kou a epi pouse elèv yo ale aprann sou platfòm ekstèn lan (li klè sou paj piblik la).'
              : 'Kou a kòmanse kòm bouyon (kache pou vizitè yo). Klike “Pibliye” anlè a lè l pare — yo ka wè l nan Explore epi sou pwofil piblik ou.'
            : isExternal
              ? 'The course starts as a draft (hidden). Click “Publish” above when ready — Atelnyo presents the course and directs learners to the external platform (clearly labeled on the public page).'
              : 'The course starts as a draft (hidden from visitors). Click “Publish” above when ready — it then appears in Explore and on your public profile.'}
        </p>
      </PropertyGroup>

      {/* Collaboration Panel */}
      {item?.id && (
        <div style={{ marginTop: 12 }}>
          <CollaborationPanel
            courseId={item.id}
            lang={lang}
            isOwner={true}
          />
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Draft recovery banner (Phase 5) */}
      {autosave.hasRecovery && (
        <DraftRecoveryBanner
          onRecover={handleRecoverDraft}
          onDiscard={() => autosave.discardDraft()}
          lang={lang}
        />
      )}
      <StudioEditorShell
      title={isHt ? 'Editè Kou' : 'Course Editor'}
      icon="fa-graduation-cap"
      lang={lang}
      docTitle={form.title.trim()}
      isNew={!isEdit}
      badge={deliveryBadge}
      dirty={dirty}
      saveState={autosave.saveState !== 'idle' ? autosave.saveState : saveState}
      saveError={autosave.saveError || saveError}
      onBack={onClose}
      onPreview={handlePreview}
      onVersionHistory={() => setShowVersionHistory(true)}
      onSave={handleSave}
      onPublish={handlePublish}
      publishLabel={isHt ? 'Pibliye' : 'Publish'}
      saveLabel={hasSaved ? (isHt ? 'Sove' : 'Save') : (isHt ? 'Kreye Kou' : 'Create Course')}
      canSave
      validation={readiness()}
      onFixValidation={(item) => {
        if (item.target === 'overview') setSelected(null);
        if (item.target === 'props') setSelected(null);
        if (typeof item.target === 'string' && item.target.startsWith('module-')) {
          const mi = Number(item.target.slice('module-'.length));
          if (Number.isInteger(mi) && mi >= 0 && mi < form.modules.length) setSelected(mi);
        }
      }}
      structure={structurePanel}
      editor={editorPanel}
      properties={<StudioPropertiesPanel lang={lang} completionPct={fieldCompletion.overall}>{propsPanel}</StudioPropertiesPanel>}
    />
    {previewOpen && (
      <CoursePreviewModal
        course={{ title: form.title, modules: form.modules }}
        lang={lang}
        onClose={() => setPreviewOpen(false)}
      />
    )}
    {showVersionHistory && item?.id && (
      <VersionHistoryModal
        courseId={item.id}
        lang={lang}
        onClose={() => setShowVersionHistory(false)}
        onRestored={() => { doSave(); }}
      />
    )}

      {/* AI Creator Assistant */}
      <StudioAIChat
        courseForm={form}
        lang={lang}
        onInsertContent={(content) => {
          setForm(prev => ({
            ...prev,
            description: prev.description ? prev.description + '\n\n' + content : content,
          }));
        }}
      />
    </>
  );
}
