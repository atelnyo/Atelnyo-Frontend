/**
 * src/components/academy/AcademyHub.jsx
 *
 * Atelnyo Language Academy — public hub (mounted at /sheet/academy).
 *
 *   View 1 — Program list: every PUBLISHED official program (the backend
 *   hides drafts from non-staff), showing the direction
 *   (source → target), level counts, and description.
 *
 *   View 2 — Program detail: level tabs (Beginner / Intermediate /
 *   Advanced) backed by the real course catalog filtered with the
 *   ``program_id`` query param. Courses render with the same
 *   CourseCard used in Explore; clicking one opens CourseDetail via the
 *   canonical content URL.
 *
 * States: loading (spinner), error (retry), empty (no published
 * programs yet) — same contract as the rest of the app.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { languageProgramService, courseService } from '../../services/api';
import CourseCard from '../../modules/explore/cards/CourseCard';

const LEVELS = [
  { key: 'beginner', icon: 'fa-seedling' },
  { key: 'intermediate', icon: 'fa-arrow-up' },
  { key: 'advanced', icon: 'fa-rocket' },
];

function levelLabel(key, lang) {
  if (key === 'beginner') return lang === 'ht' ? 'Debitan' : 'Beginner';
  if (key === 'intermediate') return lang === 'ht' ? 'Mwayen' : 'Intermediate';
  return lang === 'ht' ? 'Avanse' : 'Advanced';
}

function AcademyEmpty({ isHt, onBack }) {
  return (
    <div className="academy-empty">
      <i className="fas fa-graduation-cap" aria-hidden="true" />
      <h3>{isHt ? 'Akademi a poko louvri' : 'The academy is not open yet'}</h3>
      <p>
        {isHt
          ? 'Nou ap prepare pwogram ofisyèl yo. Tcheke ankò byento.'
          : 'We are preparing the official programs. Check back soon.'}
      </p>
      <button type="button" className="academy-btn" onClick={onBack}>
        <i className="fas fa-arrow-left" aria-hidden="true" />
        {isHt ? 'Retounen' : 'Back'}
      </button>
    </div>
  );
}

export default function AcademyHub({ lang = 'ht', translations, onOpenCourse, onBack, showToast }) {
  const isHt = lang === 'ht';
  const t = translations?.[lang] || translations?.ht || {};

  const [programs, setPrograms] = useState(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState(null); // program payload or null
  const [courses, setCourses] = useState(null);   // grouped by level
  const [level, setLevel] = useState('beginner');
  const [coursesLoading, setCoursesLoading] = useState(false);

  const loadPrograms = useCallback(() => {
    setFailed(false);
    setPrograms(null);
    languageProgramService.list()
      .then((res) => {
        const body = res?.data;
        const list = Array.isArray(body) ? body : (body?.results || []);
        setPrograms(list);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => { loadPrograms(); }, [loadPrograms]);

  // When a program is selected, fetch its full curriculum (all levels,
  // one request via program_id) and group by difficulty.
  const openProgram = useCallback((program) => {
    setSelected(program);
    setCourses(null);
    setLevel('beginner');
    setCoursesLoading(true);
    courseService.getByProgram(program.id)
      .then((res) => {
        const body = res?.data;
        const list = Array.isArray(body) ? body : (body?.results || []);
        const grouped = { beginner: [], intermediate: [], advanced: [] };
        list.forEach((c) => {
          if (grouped[c.difficulty]) grouped[c.difficulty].push(c);
        });
        setCourses(grouped);
      })
      .catch(() => {
        setCourses({ beginner: [], intermediate: [], advanced: [] });
        if (showToast) {
          showToast(
            isHt ? 'Pa t kapab chaje kou yo.' : 'Could not load the courses.',
            'exclamation-triangle',
          );
        }
      })
      .finally(() => setCoursesLoading(false));
  }, [isHt, showToast]);

  const activeCourses = useMemo(
    () => (courses ? (courses[level] || []) : []),
    [courses, level],
  );

  const selectedLevelCount = useCallback(
    (key) => Number(selected?.level_counts?.[key] || 0),
    [selected],
  );

  // ─── Loading state ────────────────────────────────────────────────
  if (programs === null && !failed) {
    return (
      <div className="academy-page">
        <div className="academy-loading">
          <i className="fas fa-spinner fa-pulse" aria-hidden="true" />
          <span>{isHt ? 'Ap chaje Akademi a...' : 'Loading the Academy...'}</span>
        </div>
      </div>
    );
  }

  // ─── Error state ──────────────────────────────────────────────────
  if (failed) {
    return (
      <div className="academy-page">
        <div className="academy-error">
          <i className="fas fa-triangle-exclamation" aria-hidden="true" />
          <h3>{isHt ? 'Pa t kapab chaje Akademi a.' : 'Could not load the Academy.'}</h3>
          <button type="button" className="academy-btn" onClick={loadPrograms}>
            <i className="fas fa-rotate-right" aria-hidden="true" />
            {isHt ? 'Eseye ankò' : 'Try again'}
          </button>
        </div>
      </div>
    );
  }

  // ─── Empty state (no published programs) ──────────────────────────
  if (!selected && programs.length === 0) {
    return (
      <div className="academy-page">
        <AcademyEmpty isHt={isHt} onBack={onBack} />
      </div>
    );
  }

  // ─── Program detail (level tabs + course grid) ────────────────────
  if (selected) {
    const prog = selected;
    const title = isHt ? (prog.title_ht || prog.title) : (prog.title_en || prog.title);
    return (
      <div className="academy-page">
        <button type="button" className="academy-back" onClick={() => setSelected(null)}>
          <i className="fas fa-arrow-left" aria-hidden="true" />
          {isHt ? 'Tout pwogram yo' : 'All programs'}
        </button>

        <header className="academy-hero">
          <div className="academy-hero-icon"><i className="fas fa-graduation-cap" aria-hidden="true" /></div>
          <div className="academy-hero-body">
            <h2>{title}</h2>
            <p className="academy-hero-direction">
              {prog.source_language_label || '?'} <i className="fas fa-arrow-right" aria-hidden="true" /> {prog.target_language_label || '?'}
            </p>
            {prog.description && <p className="academy-hero-desc">{prog.description}</p>}
            <div className="academy-hero-stats">
              {LEVELS.map(({ key }) => (
                <span key={key} className="academy-stat">
                  <i className={`fas ${key === 'beginner' ? 'fa-seedling' : key === 'intermediate' ? 'fa-arrow-up' : 'fa-rocket'}`} aria-hidden="true" />
                  {levelLabel(key, lang)} · {selectedLevelCount(key)}
                </span>
              ))}
            </div>
          </div>
        </header>

        {/* Level tabs */}
        <div className="academy-tabs" role="tablist" aria-label={isHt ? 'Nivo' : 'Levels'}>
          {LEVELS.map(({ key, icon }) => (
            <button
              type="button"
              key={key}
              role="tab"
              aria-selected={level === key}
              className={`academy-tab${level === key ? ' active' : ''}`}
              onClick={() => setLevel(key)}
            >
              <i className={`fas ${icon}`} aria-hidden="true" />
              <span>{levelLabel(key, lang)}</span>
              <span className="academy-tab-count">{selectedLevelCount(key)}</span>
            </button>
          ))}
        </div>

        {/* Course grid */}
        <div className="academy-level-body">
          {coursesLoading ? (
            <div className="academy-loading">
              <i className="fas fa-spinner fa-pulse" aria-hidden="true" />
              <span>{isHt ? 'Ap chaje kou yo...' : 'Loading courses...'}</span>
            </div>
          ) : activeCourses.length === 0 ? (
            <div className="academy-empty academy-empty--small">
              <i className="fas fa-book-open" aria-hidden="true" />
              <p>{isHt ? 'Poko gen kou nan nivo sa a.' : 'No courses in this level yet.'}</p>
            </div>
          ) : (
            <div className="academy-grid">
              {activeCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  lang={lang}
                  t={t}
                  onOpen={onOpenCourse}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Program list ─────────────────────────────────────────────────
  return (
    <div className="academy-page">
      <header className="academy-page-header">
        <h2>
          <i className="fas fa-graduation-cap" aria-hidden="true" />
          {t.academy_title || (isHt ? 'Akademi Lang Atelnyo' : 'Atelnyo Language Academy')}
        </h2>
        <p>
          {t.academy_subtitle || (isHt
            ? 'Pwogram ofisyèl pou aprann yon lang — nivo Debitan, Mwayen ak Avanse.'
            : 'Official programs to learn a language — Beginner, Intermediate and Advanced levels.')}
        </p>
      </header>

      {programs.length === 0 ? (
        <AcademyEmpty isHt={isHt} onBack={onBack} />
      ) : (
        <div className="academy-program-grid">
          {programs.map((prog) => {
            const title = isHt ? (prog.title_ht || prog.title) : (prog.title_en || prog.title);
            return (
              <button
                type="button"
                key={prog.id}
                className="academy-program-card"
                onClick={() => openProgram(prog)}
              >
                <div className="academy-program-card-top">
                  <span className="academy-program-icon"><i className="fas fa-language" aria-hidden="true" /></span>
                  <span className="academy-program-badge">
                    {isHt ? 'Ofisyèl' : 'Official'}
                  </span>
                </div>
                <h3>{title}</h3>
                <p className="academy-program-direction">
                  {prog.source_language_label || '?'} <i className="fas fa-arrow-right" aria-hidden="true" /> {prog.target_language_label || '?'}
                </p>
                {prog.description && <p className="academy-program-desc">{prog.description}</p>}
                <div className="academy-program-levels">
                  {LEVELS.map(({ key }) => {
                    const n = Number(prog.level_counts?.[key] || 0);
                    if (!n) return null;
                    return (
                      <span key={key} className="academy-program-level">
                        {levelLabel(key, lang)} · {n}
                      </span>
                    );
                  })}
                </div>
                <span className="academy-program-cta">
                  {isHt ? 'Gade kou yo' : 'View courses'}
                  <i className="fas fa-chevron-right" aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
