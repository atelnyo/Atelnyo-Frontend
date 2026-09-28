/**
 * src/components/learning/LearnerDashboard.jsx
 *
 * The global Atelnyo learner area (spec §46–§48) — mounted at
 * /sheet/learn. One calm place to resume, review and discover:
 *
 *   • Continue Learning — enrolled courses in progress, resume-first
 *     (real UserProgress.last_module_index).
 *   • My Courses        — every active enrollment with its progress bar.
 *   • Completed         — percentage >= 100.
 *   • Saved             — bookmarked courses (SavedItem).
 *   • Recommended       — the existing recommendation pipeline.
 *
 * Every rail reads REAL backend rows (learning/dashboard joins
 * Enrollment + UserProgress; saved/recommended reuse existing
 * endpoints). Nothing is invented.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { learnerService, savedItemService, recommendedService, masteryService, goalService } from '../../services/api';
import CourseCard from '../../modules/explore/cards/CourseCard';
import GamificationBar from './GamificationBar';
import useLearnerStats from '../../hooks/useLearnerStats';

function ContinueCard({ row, lang, onOpenLearning }) {
  const isHt = lang === 'ht';
  const course = row.course;
  const pct = Number(row.progress?.percentage) || 0;
  const resumeMi = Number(row.progress?.resume_module_index ?? 0) || 0;
  // ?resume=1 tells the Learning Space to open the step session at the
  // last module directly — Duolingo-style "continue where I left off".
  const open = () => onOpenLearning?.(course, { resume: true });
  return (
    <div className="ls-dash-continue-card" onClick={open} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}>
      <div className="ls-dash-continue-cover">
        {course.image_url ? (
          <img src={course.image_url} alt="" loading="lazy" />
        ) : (
          <div className="ls-dash-continue-fallback"><i className="fas fa-graduation-cap" aria-hidden="true" /></div>
        )}
        <span className="ls-dash-continue-pct">{pct}%</span>
      </div>
      <div className="ls-dash-continue-body">
        <strong>{course.title}</strong>
        <span className="ls-dash-continue-sub">
          <i className="fas fa-location-dot" aria-hidden="true" />
          {isHt ? `Modil ${resumeMi + 1} — retounen la` : `Module ${resumeMi + 1} — resume here`}
        </span>
        <div className="ls-dash-progressbar"><div style={{ width: `${pct}%` }} /></div>
        <button type="button" className="ls-btn ls-btn--primary ls-dash-continue-btn">
          <i className="fas fa-play" aria-hidden="true" /> {isHt ? 'Kontinye' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

function CourseRail({ title, icon, rows, lang, t, onOpenLearning }) {
  if (!rows || rows.length === 0) return null;
  return (
    <section className="ls-dash-rail">
      <h3 className="ls-panel-title"><i className={`fas ${icon}`} aria-hidden="true" /> {title}</h3>
      <div className="ls-dash-courses">
        {rows.map((row) => {
          const course = row.course || row;
          const pct = row.progress ? Number(row.progress.percentage) || 0 : null;
          return (
            <div key={course.id} className="ls-dash-course-item">
              <div className="ls-dash-course-card">
                <CourseCard course={course} lang={lang} t={t} onOpen={onOpenLearning} />
                {pct != null && (
                  <div className="ls-dash-course-progress">
                    <span>{pct}%</span>
                    <div className="ls-dash-progressbar"><div style={{ width: `${pct}%` }} /></div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GoalEditor({ goals, lang, onSave }) {
  // 2027 §4/§65 — explicit, changeable goals. Add via inline editor,
  // archive via the × on each chip.
  const isHt = lang === 'ht';
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    onSave?.(text).finally(() => { setBusy(false); setDraft(''); });
  };
  if (!goals) return null; // null = not loaded yet
  return (
    <div className="ls-goals">
      {goals.length > 0 && (
        <div className="ls-goals-chips">
          {goals.map((g) => (
            <span key={g.id} className="ls-goal-chip">
              {g.goal}
              <button type="button" className="ls-goal-chip-x" aria-label={isHt ? 'Retire objektif' : 'Remove goal'}
                onClick={() => onSave?.(null, g.id)}>
                <i className="fas fa-xmark" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="ls-goals-add">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder={isHt ? 'Ajoute yon objektif...' : 'Add a goal...'}
          aria-label={isHt ? 'Nouvo objektif' : 'New goal'}
        />
        <button type="button" className="ls-btn ls-btn--sm" onClick={submit} disabled={busy || !draft.trim()}>
          <i className="fas fa-plus" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default function LearnerDashboard({ lang = 'ht', translations, user, showToast, onBack, onOpenLearning, onOpenCourse, onOpenCourseById }) {
  const isHt = lang === 'ht';
  const t = translations?.[lang] || translations?.ht || {};

  const [dash, setDash] = useState(null);
  const [saved, setSaved] = useState(null);
  const [recommended, setRecommended] = useState(null);
  const [mastery, setMastery] = useState(null);
  const [dueReviews, setDueReviews] = useState(null);
  const [goals, setGoals] = useState(null);
  const [failed, setFailed] = useState(false);

  // Duolingo-style gamification (XP / level / streak / hearts / goal).
  const { stats: gamiStats, refillHearts, updateGoal } = useLearnerStats({ user });

  const load = useCallback(() => {
    setFailed(false);
    setDash(null);
    Promise.allSettled([
      learnerService.dashboard(),
      savedItemService.list('course'),
      recommendedService.courses(4),
      masteryService.overview(),
      masteryService.dueReviews(),
      goalService.getAll(),
    ]).then(([d, s, r, m, rv, g]) => {
      setDash(d.status === 'fulfilled' ? d.value.data : { continue_learning: [], my_courses: [], completed: [] });
      const sBody = s.status === 'fulfilled' ? s.value.data : null;
      setSaved(Array.isArray(sBody) ? sBody : (sBody?.results || []));
      const rBody = r.status === 'fulfilled' ? r.value.data : null;
      const rList = Array.isArray(rBody) ? rBody : (rBody?.results || []);
      setRecommended(rList);
      const mBody = m.status === 'fulfilled' ? m.value.data : null;
      setMastery(Array.isArray(mBody) ? mBody : []);
      const rvBody = rv.status === 'fulfilled' ? rv.value.data : null;
      setDueReviews(Array.isArray(rvBody) ? rvBody : (rvBody?.results || []));
      const gBody = g.status === 'fulfilled' ? g.value.data : null;
      setGoals(Array.isArray(gBody) ? gBody : (gBody?.results || []));
      if (d.status === 'rejected') setFailed(true);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveGoal = useCallback((text, id) => {
    if (id) {
      return goalService.remove(id)
        .then(() => setGoals((prev) => (prev || []).filter((g) => g.id !== id)))
        .catch(() => { showToast?.(isHt ? 'Pa t kapab retire objektif la.' : 'Could not remove goal.', 'error'); });
    }
    return goalService.create({ goal: text })
      .then((r) => { if (r?.data) setGoals((prev) => [...(prev || []), r.data]); })
      .catch(() => { showToast?.(isHt ? 'Pa t kapab anrejistre objektif la.' : 'Could not save goal.', 'error'); });
  }, [isHt, showToast]);

  const savedCourses = (saved || [])
    .map((row) => row.item)
    .filter((c) => c && c.id);

  if (failed && !dash) {
    return (
      <div className="ls-page">
        <div className="ls-state" role="alert">
          <i className="fas fa-triangle-exclamation" aria-hidden="true" />
          <h3>{isHt ? 'Pa t kapab chaje espas aprantisaj ou.' : 'Could not load your learning space.'}</h3>
          <p>{isHt ? 'Tcheke koneksyon ou epi eseye ankò.' : 'Check your connection and try again.'}</p>
          <button type="button" className="ls-btn" onClick={load}>
            <i className="fas fa-rotate-right" aria-hidden="true" /> {isHt ? 'Eseye ankò' : 'Try again'}
          </button>
        </div>
      </div>
    );
  }
  if (!dash) {
    // Skeleton mirrors the real dashboard (header + continue cards + rails)
    // so the first paint feels instant — never a blank spinner screen.
    return (
      <div className="ls-page ls-dash-page" role="status" aria-busy="true" aria-label={isHt ? 'Ap chaje...' : 'Loading...'}>
        <div className="ls-skel-dash-header" aria-hidden="true">
          <div className="ls-skeleton" />
          <div className="ls-skel-dash-header-titles">
            <div className="ls-skeleton" />
            <div className="ls-skeleton" />
          </div>
        </div>
        <div className="ls-skel-dash-grid" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className="ls-skel-dash-card">
              <div className="ls-skeleton" />
              <div className="ls-skel-dash-card-body">
                <div className="ls-skeleton" />
                <div className="ls-skeleton" />
                <div className="ls-skeleton" />
                <div className="ls-skeleton" />
              </div>
            </div>
          ))}
        </div>
        <div className="ls-skel-dash-rails" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className="ls-skel-dash-rail">
              <div className="ls-skeleton" />
              <div className="ls-skel-dash-rail-grid">
                <div className="ls-skel-dash-rail-card" />
                <div className="ls-skel-dash-rail-card" />
                <div className="ls-skel-dash-rail-card" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { continue_learning: continueRows, my_courses: myRows, completed: completedRows } = dash;
  const empty = !continueRows.length && !myRows.length && !completedRows.length && !savedCourses.length;

  // Practice feed = weakest skills first (real course blocks).
  const practiceItems = (mastery || [])
    .flatMap((bucket) => (bucket.skills || []).map((s) => ({ ...s, course: bucket.course })))
    .filter((s) => s.state && s.state !== 'strong')
    .slice(0, 4);
  const dueCount = (dueReviews || []).length;

  return (
    <div className="ls-page ls-dash-page">
      <header className="ls-dash-header">
        <button type="button" className="ls-header-btn" onClick={onBack} aria-label={isHt ? 'Retounen' : 'Back'}>
          <i className="fas fa-arrow-left" aria-hidden="true" />
        </button>
        <div className="ls-dash-header-title">
          <h1><i className="fas fa-book-open" aria-hidden="true" /> {isHt ? 'Espas Aprantisaj ou' : 'Your Learning Space'}</h1>
          <p>{isHt ? 'Kontinye kote ou te sispann, jere kou ou yo, epi dekouvri pwochen etap ou.' : 'Resume where you left off, manage your courses, and discover your next step.'}</p>
        </div>
      </header>

      {/* ─── Duolingo-style gamification chips ─────────────── */}
      {user && gamiStats && (
        <GamificationBar
          stats={gamiStats}
          lang={lang}
          onRefillHearts={refillHearts}
          onUpdateGoal={updateGoal}
        />
      )}

      {empty ? (
        <div className="ls-state">
          <i className="fas fa-graduation-cap" aria-hidden="true" />
          <h3>{isHt ? 'Ou poko gen kou' : 'No courses yet'}</h3>
          <p>{isHt ? 'Dekouvri yon kou epi enskri pou kòmanse aprann.' : 'Discover a course and enroll to start learning.'}</p>
          <button type="button" className="ls-btn ls-btn--primary" onClick={() => onOpenCourse?.(null)}>
            <i className="fas fa-compass" aria-hidden="true" /> {isHt ? 'Dekouvri kou' : 'Discover courses'}
          </button>
        </div>
      ) : (
        <>
          {/* ─── Smart session rails (2027 §5/§8/§33): practice + review ── */}
          {(practiceItems.length > 0 || dueCount > 0) && (
            <section className="ls-dash-rail">
              <h3 className="ls-panel-title">
                <i className="fas fa-bolt" aria-hidden="true" />
                {isHt ? 'Sesyon rapid' : 'Quick session'}
              </h3>
              <div className="ls-dash-session-grid">
                {practiceItems.length > 0 && (
                  <div className="ls-dash-session-card">
                    <span className="ls-dash-session-icon"><i className="fas fa-dumbbell" aria-hidden="true" /></span>
                    <div>
                      <strong>{isHt ? 'Pratik pèsonalize' : 'Personalized practice'}</strong>
                      <p>{isHt
                        ? `${practiceItems.length} kou — fòtifye konpetans feblès ou yo.`
                        : `${practiceItems.length} items — strengthen your weakest skills.`}</p>
                    </div>
                    <button type="button" className="ls-btn ls-btn--sm ls-btn--primary"
                      onClick={() => onOpenCourseById?.(practiceItems[0].course?.id)}>
                      {isHt ? 'Pratike' : 'Practice'}
                    </button>
                  </div>
                )}
                {dueCount > 0 && (
                  <div className="ls-dash-session-card">
                    <span className="ls-dash-session-icon"><i className="fas fa-rotate" aria-hidden="true" /></span>
                    <div>
                      <strong>{isHt ? 'Revizyon akòz' : 'Review due'}</strong>
                      <p>{isHt
                        ? `${dueCount} aktivite pou revize kounye a.`
                        : `${dueCount} activities to review now.`}</p>
                    </div>
                    <button type="button" className="ls-btn ls-btn--sm ls-btn--primary"
                      onClick={() => onOpenCourseById?.(dueReviews[0].course_id)}>
                      {isHt ? 'Revize' : 'Review'}
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ─── Learning goals (2027 §4/§65) — explicit + changeable ── */}
          {goals && (
            <section className="ls-dash-rail">
              <h3 className="ls-panel-title">
                <i className="fas fa-bullseye" aria-hidden="true" />
                {isHt ? 'Objektif aprantisaj' : 'Learning goals'}
              </h3>
              <GoalEditor goals={goals} lang={lang} onSave={saveGoal} />
            </section>
          )}

          {/* Continue Learning — the primary rail */}
          {continueRows.length > 0 && (
            <section className="ls-dash-rail">
              <h3 className="ls-panel-title">
                <i className="fas fa-play-circle" aria-hidden="true" />
                {isHt ? 'Kontinye aprann' : 'Continue learning'}
              </h3>
              <div className="ls-dash-continue-grid">
                {continueRows.map((row) => (
                  <ContinueCard key={row.course.id} row={row} lang={lang} onOpenLearning={onOpenLearning} />
                ))}
              </div>
            </section>
          )}

          <CourseRail
            title={isHt ? 'Kou mwen yo' : 'My courses'}
            icon="fa-layer-group"
            rows={myRows}
            lang={lang}
            t={t}
            onOpenLearning={onOpenLearning}
          />

          <CourseRail
            title={isHt ? 'Kou fini' : 'Completed'}
            icon="fa-trophy"
            rows={completedRows}
            lang={lang}
            t={t}
            onOpenLearning={onOpenLearning}
          />

          {savedCourses.length > 0 && (
            <CourseRail
              title={isHt ? 'Sove' : 'Saved'}
              icon="fa-bookmark"
              rows={savedCourses.map((c) => ({ course: c }))}
              lang={lang}
              t={t}
              onOpenLearning={onOpenCourse}
            />
          )}

          {recommended && recommended.length > 0 && (
            <CourseRail
              title={isHt ? 'Rekòmande pou ou' : 'Recommended for you'}
              icon="fa-star"
              rows={recommended.map((c) => ({ course: c }))}
              lang={lang}
              t={t}
              onOpenLearning={onOpenCourse}
            />
          )}
        </>
      )}
    </div>
  );
}
