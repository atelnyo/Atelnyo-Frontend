/**
 * src/components/admin/AdminLanguageAcademy.jsx
 *
 * Atelnyo Language Academy — staff management surface (mounted at
 * /sheet/admin/academy, gated by RequireRole staff).
 *
 * Per official program the staff member can:
 *   • Generate the curriculum  — POST generate/ (idempotent, DRAFT-first).
 *     Every course + level-assessment quiz is created as a normal
 *     Course/Quiz row; re-running reuses existing rows by their stable
 *     ``curriculum_key``. ``update`` forces a content resync.
 *   • Publish / Unpublish     — flips the program + all its courses
 *     between published/draft.
 *   • Review courses          — lists every program course (drafts
 *     included) with its status; clicking opens the course detail page.
 *     Editing happens in Creator Studio (generated courses belong to
 *     the staff member who generated them).
 *
 * Mirrors the AdminDashboard shell (ad-dash-*) so the surface blends
 * with the rest of the admin panel.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { languageProgramService } from '../../services/api';
import { SHEETS } from '../../routes/sheets';
import { inlineText } from '../../utils/inlineI18n';

const LEVELS = [
  { key: 'beginner', label: (lang) => (lang === 'ht' ? 'Debitan' : inlineText(lang, 'Beginner')) },
  { key: 'intermediate', label: (lang) => (lang === 'ht' ? 'Mwayen' : inlineText(lang, 'Intermediate')) },
  { key: 'advanced', label: (lang) => (lang === 'ht' ? 'Avanse' : inlineText(lang, 'Advanced')) },
];

const PROGRAM_COURSE_STATUS = {
  draft: { en: 'Draft', ht: 'Bouyon' },
  building: { en: 'Building', ht: 'Ap bati' },
  review: { en: 'In review', ht: 'Nan revizyon' },
  published: { en: 'Published', ht: 'Pibliye' },
  updating: { en: 'Updating', ht: 'Ap mete ajou' },
  archived: { en: 'Archived', ht: 'Achive' },
};

function StatusBadge({ status, isHt }) {
  const labels = PROGRAM_COURSE_STATUS[status] || PROGRAM_COURSE_STATUS.draft;
  const label = isHt ? labels.ht : labels.en;
  if (status === 'published') {
    return (
      <span className="badge" data-badge-type="official" title={label}>
        <i className="fas fa-circle-check" aria-hidden="true" /> {label}
      </span>
    );
  }
  return (
    <span className="badge" data-badge-type="draft" title={label}>
      <i className="fas fa-pen-ruler" aria-hidden="true" /> {label}
    </span>
  );
}

function ProgramCard({ program, lang, onGenerate, onPublish, onUnpublish, onToggleCourses, expanded, onOpenCourse, busy }) {
  const isHt = lang === 'ht';
  const title = isHt ? (program.title_ht || program.title) : (program.title_en || program.title);
  return (
    <div className="ad-dash-panel academy-admin-program">
      <div className="ad-dash-panel-header">
        <h3 className="ad-dash-panel-title academy-admin-program-title">
          <i className="fas fa-language" aria-hidden="true" />
          {title}
        </h3>
        <StatusBadge status={program.status} isHt={isHt} />
        <button
          type="button"
          className="ad-dash-panel-action-btn"
          onClick={onToggleCourses}
          title={expanded ? (isHt ? 'Fèmen kou yo' : inlineText(lang, 'Hide courses')) : (isHt ? 'Gade kou yo' : inlineText(lang, 'View courses'))}
        >
          <i className={`fas ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'}`} aria-hidden="true" />
          {expanded ? (isHt ? 'Fèmen' : inlineText(lang, 'Hide')) : (isHt ? 'Kou yo' : inlineText(lang, 'Courses'))}
        </button>
      </div>
      <div className="ad-dash-panel-body">
        <p className="academy-admin-direction">
          {program.source_language_label || '?'} <i className="fas fa-arrow-right" aria-hidden="true" /> {program.target_language_label || '?'}
        </p>
        {program.description && <p className="academy-admin-desc">{program.description}</p>}

        <div className="academy-admin-stats">
          {LEVELS.map(({ key, label }) => (
            <span key={key} className="academy-admin-stat">
              {label(lang)} · {Number(program.level_counts?.[key] || 0)}
            </span>
          ))}
          <span className="academy-admin-stat">
            <i className="fas fa-layer-group" aria-hidden="true" />
            {program.course_count || 0}
          </span>
        </div>

        <div className="academy-admin-actions">
          <button
            type="button"
            className="ad-dash-action-btn"
            disabled={busy}
            onClick={() => onGenerate(program, false)}
            title={isHt ? 'Jenere kourikoulòm (brouyon)' : inlineText(lang, 'Generate curriculum (draft)')}
          >
            {busy ? <i className="fas fa-spinner fa-spin" aria-hidden="true" /> : <i className="fas fa-wand-magic-sparkles" aria-hidden="true" />}
            {isHt ? 'Jenere kou yo' : inlineText(lang, 'Generate')}
          </button>
          <button
            type="button"
            className="ad-dash-action-btn"
            disabled={busy}
            onClick={() => onGenerate(program, true)}
            title={isHt ? 'Resynchronize kontni (update)' : inlineText(lang, 'Resync content (update)')}
          >
            <i className="fas fa-rotate" aria-hidden="true" />
            {isHt ? 'Rejenere' : inlineText(lang, 'Resync')}
          </button>
          {program.status === 'published' ? (
            <button
              type="button"
              className="ad-dash-action-btn ad-dash-action-danger"
              disabled={busy}
              onClick={() => onUnpublish(program)}
              title={isHt ? 'Retounen nan brouyon' : inlineText(lang, 'Unpublish')}
            >
              <i className="fas fa-eye-slash" aria-hidden="true" />
              {isHt ? 'Depibliye' : inlineText(lang, 'Unpublish')}
            </button>
          ) : (
            <button
              type="button"
              className="ad-dash-action-btn ad-dash-action-success"
              disabled={busy}
              onClick={() => onPublish(program)}
              title={isHt ? 'Pibliye pwogram + tout kou yo' : inlineText(lang, 'Publish program + all courses')}
            >
              <i className="fas fa-circle-check" aria-hidden="true" />
              {isHt ? 'Pibliye' : inlineText(lang, 'Publish')}
            </button>
          )}
        </div>

        {expanded && <ProgramCourses program={program} lang={lang} onOpenCourse={onOpenCourse} />}
      </div>
    </div>
  );
}

function ProgramCourses({ program, lang, onOpenCourse }) {
  const isHt = lang === 'ht';
  const [courses, setCourses] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCourses(null);
    setFailed(false);
    languageProgramService.courses(program.program_key)
      .then((res) => {
        if (!cancelled) setCourses(Array.isArray(res?.data) ? res.data : (res?.data?.results || []));
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [program.program_key]);

  if (failed) {
    return (
      <div className="ad-dash-panel-empty">
        <i className="fas fa-triangle-exclamation" />
        <p>{isHt ? 'Pa t kapab chaje kou yo.' : inlineText(lang, 'Could not load the courses.')}</p>
      </div>
    );
  }
  if (!courses) {
    return (
      <div className="ad-dash-panel-loading">
        <i className="fas fa-spinner fa-spin" />
      </div>
    );
  }
  if (courses.length === 0) {
    return (
      <div className="ad-dash-panel-empty">
        <i className="fas fa-book-open" />
        <p>
          {isHt
            ? 'Poko gen kou. Klike "Jenere kou yo" pou kreye kourikoulòm la.'
            : inlineText(lang, 'No courses yet. Click "Generate" to create the curriculum.')}
        </p>
      </div>
    );
  }
  return (
    <div className="academy-admin-courses">
      {courses.map((c) => (
        <button
          type="button"
          key={c.id}
          className="academy-admin-course-row"
          onClick={() => onOpenCourse?.(c)}
          title={isHt ? 'Louvri kou a' : inlineText(lang, 'Open course')}
        >
          <span className="academy-admin-course-icon"><i className="fas fa-book" aria-hidden="true" /></span>
          <span className="academy-admin-course-info">
            <strong>{c.title}</strong>
            <span>
              {c.difficulty ? (isHt
                ? (c.difficulty === 'beginner' ? 'Debitan' : c.difficulty === 'intermediate' ? 'Mwayen' : 'Avanse')
                : c.difficulty.charAt(0).toUpperCase() + c.difficulty.slice(1)) : ''}
              {c.syllabus?.length ? ` · ${c.syllabus.length} ${isHt ? 'modil' : inlineText(lang, 'modules')}` : ''}
            </span>
          </span>
          <span className="academy-admin-course-status">
            <StatusBadge status={c.status} isHt={isHt} />
            <i className="fas fa-chevron-right" aria-hidden="true" />
          </span>
        </button>
      ))}
    </div>
  );
}

export default function AdminLanguageAcademy({ lang = 'en', showToast, user, onNavigate }) {
  const isHt = lang === 'ht';
  const [programs, setPrograms] = useState(null);
  const [failed, setFailed] = useState(false);
  const [expandedKey, setExpandedKey] = useState(null);
  const [busy, setBusy] = useState(null); // 'program_key:action'

  const load = useCallback(() => {
    setFailed(false);
    setPrograms(null);
    languageProgramService.list()
      .then((res) => {
        const body = res?.data;
        setPrograms(Array.isArray(body) ? body : (body?.results || []));
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCourse = (course) => {
    if (course?.id && onNavigate) {
      onNavigate(`/sheet/course/${course.id}`, { state: { course } });
    }
  };

  const runAction = (program, action, opts = {}) => {
    const tag = `${program.program_key}:${action}`;
    setBusy(tag);
    const fn = action === 'generate'
      ? languageProgramService.generate(program.program_key, opts)
      : action === 'publish'
        ? languageProgramService.publish(program.program_key)
        : languageProgramService.unpublish(program.program_key);
    fn.then((res) => {
      // Refresh the program list so statuses + counts reflect the change.
      load();
      if (showToast) {
        const msg = action === 'generate'
          ? (isHt ? '✅ Kourikoulòm jenere (brouyon) — revize li anvan pibliye.' : inlineText(lang, '✅ Curriculum generated (draft) — review before publishing.'))
          : action === 'publish'
            ? (isHt ? '✅ Pwogram pibliye!' : inlineText(lang, '✅ Program published!'))
            : (isHt ? '✅ Pwogram depibliye.' : inlineText(lang, '✅ Program unpublished.'));
        showToast(msg, 'check-circle');
      }
      return res;
    })
      .catch((err) => {
        const detail = err?.response?.data?.detail || err?.message;
        if (showToast) {
          showToast(
            isHt ? `Erè: ${detail || 'aksyon an echwe'}` : `Error: ${detail || 'action failed'}`,
            'exclamation-triangle',
          );
        }
      })
      .finally(() => setBusy(null));
  };

  return (
    <div className="ad-dash-shell">
      <div className="ad-dash-header">
        <div className="ad-dash-header-left">
          <button type="button" className="ad-dash-back" onClick={() => onNavigate?.(SHEETS.ADMIN_DASHBOARD)} aria-label="Back">
            <i className="fas fa-arrow-left" />
          </button>
          <div>
            <h1 className="ad-dash-title">
              <i className="fas fa-graduation-cap" aria-hidden="true" />
              {' '}Language Academy
            </h1>
            <p className="ad-dash-subtitle">
              {isHt
                ? 'Jere pwogram ofisyèl yo — jenere, revize, pibliye.'
                : inlineText(lang, 'Manage the official programs — generate, review, publish.')}
            </p>
          </div>
        </div>
        <div className="ad-dash-header-right">
          <button type="button" className="ad-dash-refresh" onClick={load} title="Refresh">
            <i className="fas fa-rotate" />
          </button>
        </div>
      </div>

      <div className="ad-dash-body">
        <div className="ad-dash-panels academy-admin-panels">
          {failed ? (
            <div className="ad-dash-error-banner">
              <i className="fas fa-circle-exclamation" />
              <span>{isHt ? 'Pa t kapab chaje pwogram yo.' : inlineText(lang, 'Could not load the programs.')}</span>
              <button type="button" onClick={load}>Retry</button>
            </div>
          ) : !programs ? (
            <div className="ad-dash-panel-loading">
              <i className="fas fa-spinner fa-spin" />
            </div>
          ) : programs.length === 0 ? (
            <div className="ad-dash-panel-empty">
              <i className="fas fa-graduation-cap" />
              <p>
                {isHt
                  ? 'Poko gen pwogram. Kouri "generate_language_programs" (oswa klike jenere apre pwogram nan kreye).'
                  : inlineText(lang, 'No programs yet. Run "generate_language_programs" to create them.')}
              </p>
            </div>
          ) : (
            programs.map((program) => (
              <ProgramCard
                key={program.program_key}
                program={program}
                lang={lang}
                expanded={expandedKey === program.program_key}
                onToggleCourses={() => setExpandedKey((k) => (k === program.program_key ? null : program.program_key))}
                onGenerate={(p, update) => runAction(p, 'generate', { update })}
                onPublish={(p) => runAction(p, 'publish')}
                onUnpublish={(p) => runAction(p, 'unpublish')}
                onOpenCourse={openCourse}
              />
            ))
          )}
        </div>

        <div className="ad-dash-panel">
          <div className="ad-dash-panel-header">
            <h3 className="ad-dash-panel-title">
              <i className="fas fa-circle-info" aria-hidden="true" />
              {isHt ? 'Kijan sa mache' : inlineText(lang, 'How it works')}
            </h3>
          </div>
          <div className="ad-dash-panel-body academy-admin-help">
            <ul>
              <li>
                {isHt
                  ? '1. Klike "Jenere kou yo" — li kreye 15 kou (brouyon) + tès nivo yo. Li pa janm fè doublon.'
                  : inlineText(lang, '1. Click "Generate" — it creates 15 draft courses + level assessments. It never duplicates.')}
              </li>
              <li>
                {isHt
                  ? '2. Revize/edit chak kou — ouvri kou a, oswa edite l nan Creator Studio (kou yo se pou ou).'
                  : inlineText(lang, '2. Review/edit each course — open a course, or edit in Creator Studio (the courses belong to you).')}
              </li>
              <li>
                {isHt
                  ? '3. Klike "Pibliye" — pwogram nan + tout kou yo vin vizib pou elèv yo. "Depibliye" fèmen yo ankò.'
                  : inlineText(lang, '3. Click "Publish" — the program + all courses become visible to learners. "Unpublish" hides them again.')}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
