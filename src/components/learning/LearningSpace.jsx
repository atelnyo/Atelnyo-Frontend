/**
 * src/components/learning/LearningSpace.jsx
 *
 * The dedicated learner environment (spec §7–§16, §34, §60). This is
 * where an enrolled learner actually STUDIES — distinct from the
 * Course Detail page (pre-enrollment discovery).
 *
 * Everything here reuses the EXISTING Atelnyo architecture:
 *   • Access      — CourseEntitlement via ``/courses/<id>/access/``
 *   • Progress    — UserProgress rows (resume position + completed
 *                   blocks), server-computed percentage
 *   • Lessons     — the same ``LanguagePracticeBlock`` + ``QuizBlock``
 *                   renderers the creator studio produces
 *   • Completion  — ``complete_block`` (real activity, idempotent)
 *   • Messaging   — ``message_instructor`` → real 1:1 conversation
 *   • Pathway     — official program next-level recommendation
 *
 * No fake state: a module is "completed" only from real completed
 * blocks; the continue card comes from the backend-recorded position.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { courseService, courseCheckoutService, progressService, courseSupportService, masteryService } from '../../services/api';
import { stageCourse, getCachedCourse, stageQuizzes, enqueueProgress } from '../../services/offlineCourse';
import ModuleSession from './ModuleSession';
import { BlockRenderer } from './blocks';
import CourseCard from '../../modules/explore/cards/CourseCard';
import GamificationBar from './GamificationBar';
import useLearnerStats from '../../hooks/useLearnerStats';
import { playChime, burstConfetti } from '../../utils/celebrate';
import { openCertificateWindow } from './CertificateTemplate';
import BusinessWorkspace from '../studio/editor/BusinessWorkspace';
import '../studio/editor/BusinessWorkspace.css';
import ProjectWorkspace from './workspace/ProjectWorkspace';
import './workspace/ProjectWorkspace.css';
import useLearningNavigation from '../../hooks/useLearningNavigation';
import useLessonPrefetch from '../../hooks/useLessonPrefetch';
import LearningShell, { LessonContentArea, BlockPlacementWrapper } from './LearningShell';
import LessonIntroduction from './LessonIntroduction';
import ProgressDomains from './ProgressDomains';
import SaveIndicator from './SaveIndicator';
import RecoveryBanner from './RecoveryBanner';
import { saveSessionState as saveSession, loadSessionState as loadSession, clearSessionState as clearSession } from '../../services/learningSessionStore';

// ─── Session persistence — survives page reload ──────────────────
// Migrated from raw localStorage to draftStore primitive for proper
// account isolation and quota handling (§38-§39).
// Thin wrappers that bridge async draftStore to the sync callers.
function saveSessionState(courseId, state) {
  saveSession(courseId, state).catch(() => {});
}
function loadSessionState(courseId) {
  // Return cached value from last load (set during mount)
  return loadSessionCache.get(courseId) || null;
}
function clearSessionState(courseId) {
  clearSession(courseId).catch(() => {});
}
// Cache for session state loaded at mount time
const loadSessionCache = new Map();

// ─── Inner ErrorBoundary for ModuleSession ───────────────────────
// Catches render crashes inside the step player (e.g. a broken block
// renderer) WITHOUT killing the entire LearningSpace.  The learner
// sees a friendly retry prompt and can jump right back in.
class ModuleSessionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('[ModuleSessionErrorBoundary]', error?.message, info?.componentStack?.slice(0, 500));
  }
  render() {
    if (this.state.hasError) {
      const { isHt, onRetry, onExit } = this.props;
      return (
        <div className="ls-session-crash" role="alert">
          <div className="ls-state ls-crash-state">
            <i className="fas fa-triangle-exclamation ls-crash-icon" aria-hidden="true" />
            <h3 className="ls-crash-title">
              {isHt ? 'Yon erè rive nan aktivite sa a.' : 'Something went wrong in this activity.'}
            </h3>
            <p className="ls-crash-desc">
              {isHt
                ? 'Pwogrè ou deja anrejistre. Eseye ankò oswa retounen nan kou a.'
                : 'Your progress is already saved. Try again or go back to the course.'}
            </p>
            <div className="ls-state-actions ls-crash-actions">
              <button type="button" className="ls-btn" onClick={onExit}>
                <i className="fas fa-arrow-left" aria-hidden="true" /> {isHt ? 'Retounen' : 'Back'}
              </button>
              <button type="button" className="ls-btn ls-btn--primary" onClick={onRetry}>
                <i className="fas fa-rotate-right" aria-hidden="true" /> {isHt ? 'Eseye ankò' : 'Try again'}
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const LEVEL_LABEL = {
  beginner: { en: 'Beginner', ht: 'Debitan' },
  intermediate: { en: 'Intermediate', ht: 'Mwayen' },
  advanced: { en: 'Advanced', ht: 'Avanse' },
};

// Stage 3 — course resources (spec §23): kind → icon + label. Only
// kinds the backend emits are mapped; unknown kinds fall back to a link.
const RESOURCE_ICONS = {
  link: 'fa-link',
  pdf: 'fa-file-pdf',
  audio: 'fa-file-audio',
  video: 'fa-file-video',
  doc: 'fa-file-lines',
};
const RESOURCE_KIND_LABEL = {
  link: { en: 'Link', ht: 'Lyen' },
  pdf: { en: 'PDF', ht: 'PDF' },
  audio: { en: 'Audio', ht: 'Odio' },
  video: { en: 'Video', ht: 'Videyo' },
  doc: { en: 'Document', ht: 'Dokiman' },
};

function kindLabel(kind, isHt) {
  const l = RESOURCE_KIND_LABEL[kind] || RESOURCE_KIND_LABEL.link;
  return isHt ? l.ht : l.en;
}

function blockTypeLabel(type, isHt) {
  const map = {
    repeat: { en: 'Repeat', ht: 'Repete' },
    pronunciation: { en: 'Pronunciation', ht: 'Pwononsyasyon' },
    vocabulary: { en: 'Vocabulary', ht: 'Vokabilè' },
    listening: { en: 'Listening', ht: 'Koute' },
    speaking: { en: 'Speaking', ht: 'Pale' },
    conversation: { en: 'Conversation', ht: 'Konvèsasyon' },
    text: { en: 'Reading', ht: 'Lekti' },
    video: { en: 'Video Lesson', ht: 'Leson Videyo' },
  };
  const l = map[type] || { en: 'Activity', ht: 'Aktivite' };
  return isHt ? l.ht : l.en;
}

export default function LearningSpace({
  courseId,
  lang = 'ht',
  translations,
  user,
  showToast,
  onBack,
  onOpenCourse,
  onNavigate,
  autoResume = false,
  initialModule = null,
}) {
  const isHt = lang === 'ht';
  const t = translations?.[lang] || translations?.ht || {};

  const [course, setCourse] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [access, setAccess] = useState(null);
  const [progress, setProgress] = useState(null);
  const [sessionModule, setSessionModule] = useState(null); // module index currently in the step session
  const [reviewModule, setReviewModule] = useState(null); // practice-only review session (completed modules)
  const [sessionRetryKey, setSessionRetryKey] = useState(0); // forces remount of ModuleSession after crash
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageBody, setMessageBody] = useState('');
  const [messageBusy, setMessageBusy] = useState(false);
  // Stage 2 — Practice Center + certificate + similar-courses rail.
  const [mode, setMode] = useState('curriculum'); // 'curriculum' | 'practice'
  const [certificate, setCertificate] = useState(null); // null | object | 'none'
  const [similar, setSimilar] = useState(null); // similar published courses
  // Stage 3 — course support surfaces (announcements §22, resources §23,
  // private learner notes §24). All backend-gated; nothing invented.
  const [announcements, setAnnouncements] = useState([]);
  const [resources, setResources] = useState([]);
  const [notes, setNotes] = useState([]); // my notes for this course
  const [noteDrafts, setNoteDrafts] = useState({}); // moduleIndex → draft text
  const [noteBusy, setNoteBusy] = useState({}); // moduleIndex → saving
  const [noteStatus, setNoteStatus] = useState({}); // moduleIndex → {kind, text}
  const [noteOpen, setNoteOpen] = useState({}); // moduleIndex → note editor open
  // Stage 4 — offline learning (spec §48–§49): rendering from a staged
  // snapshot + queued progress writes.
  const [offlineMode, setOfflineMode] = useState(false);
  const [cachedQuizzes, setCachedQuizzes] = useState(null); // staged quiz list
  // Stage 5 — mastery (2027 §32–§36): weak-skill highlight for THIS
  // course. Read-only; evidence is recorded server-side.
  const [courseSkills, setCourseSkills] = useState(null); // skills | null
  // Business Workspace — student portfolio for business courses
  const [showWorkspace, setShowWorkspace] = useState(false);
  // §1-§49 — Project-Based Learning Workspace
  const [showProjectWorkspace, setShowProjectWorkspace] = useState(false);
  // §25, §32 — Recovery state
  const [recoveryType, setRecoveryType] = useState(null); // 'restored' | 'sync_pending' | null
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  // §39 — Focus Mode: reduces navigation distractions
  const [focusMode, setFocusMode] = useState(false);
  // §37 — Unlock toast notification
  const [unlockToast, setUnlockToast] = useState(null);
  // §38 — Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState(null);
  // §44 — Notification queue (priority-based)
  const [notifications, setNotifications] = useState([]);
  // §43 — Accessible status announcements
  const [srAnnouncement, setSrAnnouncement] = useState('');
  const announce = useCallback((msg) => {
    setSrAnnouncement('');
    requestAnimationFrame(() => setSrAnnouncement(msg));
  }, []);

  // ─── Duolingo-style gamification (XP / level / daily streak / hearts /
  //     daily goal). Stats load once; every completion payload (progress,
  //     quiz) merges into the local state so the chips update live.
  const { stats: gamiStats, applyGamification, refillHearts, updateGoal } =
    useLearnerStats({ user });
  const [xpPopup, setXpPopup] = useState(null); // {id, amount} floating +N XP

  const celebrateFrom = useCallback((g) => {
    if (!g) return;
    applyGamification(g);
    const amount = Number(g.xp_awarded) || 0;
    if (amount > 0) {
      setXpPopup({ id: Date.now(), amount });
      window.setTimeout(() => setXpPopup((p) => (p ? null : p)), 1600);
    }
    // 30+ XP in one shot = module/course completion or a passed quiz →
    // the big celebration; anything else earns a small correct chime.
    if (amount >= 30) { burstConfetti(); playChime('complete'); }
    else if (amount > 0) { playChime('correct'); }
  }, [applyGamification]);

  // ─── Load course + access + my progress ────────────────────────────
  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    setCourse(null);
    setLoadFailed(false);
    setAccess(null);
    setProgress(null);
    setOfflineMode(false);
    courseService.getById(courseId)
      .then((res) => { if (!cancelled) setCourse(res?.data || null); })
      .catch(() => {
        if (cancelled) return;
        // Offline: fall back to the staged snapshot (last time this
        // learner studied the course while online). Honest — if there
        // is no snapshot, the page says so instead of pretending.
        getCachedCourse(courseId, user?.id).then((snap) => {
          if (cancelled) return;
          if (snap?.course) {
            setCourse(snap.course);
            setOfflineMode(true);
            if (snap.progress) setProgress(snap.progress);
            if (Array.isArray(snap.announcements)) setAnnouncements(snap.announcements);
            if (Array.isArray(snap.resources)) setResources(snap.resources);
            if (Array.isArray(snap.quizzes)) setCachedQuizzes(snap.quizzes);
            if (Array.isArray(snap.notes)) {
              setNotes(snap.notes);
              const drafts = {};
              snap.notes.forEach((n) => { drafts[String(n.module_index)] = n.content || ''; });
              setNoteDrafts((prev) => ({ ...drafts, ...prev }));
            }
          } else {
            setLoadFailed(true);
          }
        }).catch(() => { if (!cancelled) setLoadFailed(true); });
      });
    if (user) {
      courseCheckoutService.access(courseId)
        .then((res) => { if (!cancelled) setAccess(res?.data || null); })
        .catch(() => { if (!cancelled) setAccess({ has_access: false }); });
      progressService.getAll()
        .then((res) => {
          if (cancelled) return;
          const list = Array.isArray(res?.data?.results || res?.data) ? (res?.data?.results || res?.data) : [];
          setProgress(list.find((p) => Number(p.course) === Number(courseId)) || null);
        })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [courseId, user]);

  // ─── Mastery for this course (2027 §32–§36) — weak skills worth a
  //     second look. Online only; never blocks the page.
  useEffect(() => {
    if (!courseId || !user || offlineMode) return;
    let cancelled = false;
    masteryService.overview()
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        const bucket = list.find((b) => Number(b.course?.id) === Number(courseId));
        setCourseSkills(bucket?.skills || null);
      })
      .catch(() => { if (!cancelled) setCourseSkills(null); });
    return () => { cancelled = true; };
  }, [courseId, user, offlineMode]);

  // Session resume is handled INSIDE ModuleSession (it lands on the
  // first genuinely unfinished step). Here we only need the resume
  // module index for the "Continue learning" button in the hero.
  const resumeModuleIndex = useMemo(() => {
    if (!progress) return 0;
    return Number(progress.last_module_index) || 0;
  }, [progress]);

  // Completed-state helper used by the certificate fetch (below) and
  // the hero — computed here so it is initialized BEFORE the effects
  // that reference it (a later ``const`` would put it in the temporal
  // dead zone and crash every render with a ReferenceError).
  const pct = Number(progress?.percentage) || 0;
  const isComplete = pct >= 100;

  // ─── Certificate: fetch the VERIFIED completion certificate ────────
  useEffect(() => {
    if (!courseId || !user || !isComplete) return;
    let cancelled = false;
    setCertificate(null);
    courseService.certificate(courseId)
      .then((res) => { if (!cancelled) setCertificate(res?.data || 'none'); })
      .catch(() => { if (!cancelled) setCertificate('none'); });
    return () => { cancelled = true; };
  }, [courseId, user, isComplete]);

  // ─── Course support (Stage 3): announcements + resources + MY notes.
  //     Fetched only once the backend confirms real course access.
  //     List responses may be paginated ({results}) or plain arrays —
  //     normalize both. Notes are server-scoped to this user.
  useEffect(() => {
    if (!courseId || !user || (!access?.has_access && !offlineMode)) return;
    let cancelled = false;
    const unwrap = (res) => {
      const body = res?.data;
      return Array.isArray(body) ? body : (body?.results || []);
    };
    courseSupportService.announcements(courseId)
      .then((r) => { if (!cancelled) setAnnouncements(unwrap(r)); })
      .catch(() => {});
    courseSupportService.resources(courseId)
      .then((r) => { if (!cancelled) setResources(unwrap(r)); })
      .catch(() => {});
    courseSupportService.notes(courseId)
      .then((r) => {
        if (cancelled) return;
        const list = unwrap(r);
        setNotes(list);
        const drafts = {};
        list.forEach((n) => { drafts[String(n.module_index)] = n.content || ''; });
        setNoteDrafts((prev) => ({ ...drafts, ...prev })); // keep user edits
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [courseId, user, access?.has_access]);

  // ─── Similar courses: same language direction + level (recommendation
  //     context — real published courses, never the current one). ─────
  useEffect(() => {
    if (!course || !(course.teaching_language || course.learner_language)) return;
    let cancelled = false;
    courseService.getAll({
      teaching_language: course.teaching_language || undefined,
      learner_language: course.learner_language || undefined,
      difficulty: course.difficulty || undefined,
      limit: 8,
    }).then((res) => {
      if (cancelled) return;
      const body = res?.data;
      const list = Array.isArray(body) ? body : (body?.results || []);
      setSimilar(list.filter((c) => Number(c.id) !== Number(course.id)).slice(0, 4));
    }).catch(() => { if (!cancelled) setSimilar([]); });
    return () => { cancelled = true; };
  }, [course]);

  const syllabus = Array.isArray(course?.syllabus) ? course.syllabus : [];
  // Offline mode renders a snapshot of a course access was ALREADY
  // granted for (the snapshot is only staged after a real access check
  // while online) — so access is honored, never bypassed.
  const isEnrolled = offlineMode || Boolean(access?.has_access);
  const hasInstructor = Boolean(course?.created_by_username) && course?.created_by !== user?.id;

  // ?resume=1 (from the dashboard "Continue" card): once course + my
  // progress are loaded, jump straight into the session at the resume
  // module — Duolingo-style "pick up where I left off". One-shot; the
  // session itself lands on the first unfinished step.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!autoResume || !course || !progress) return;
    const mi = Number(progress.last_module_index) || 0;
    if (syllabus[mi]) setSessionModule(mi);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoResume, course, progress, syllabus]);

  // ?module=N (from the course page's "Open this module in the Learning
  // Space"): once the course loads, open THAT module's step session
  // directly — the course page hands the learner straight into the
  // module they clicked, no extra tap. Takes precedence over resume.
  useEffect(() => {
    if (initialModule == null || !course) return;
    const mi = Number(initialModule);
    if (syllabus[mi]) setSessionModule(mi);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialModule, course, syllabus]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ─── Session persistence: save/restore across page reloads ────────
  // When the learner reloads while inside a module session, we restore
  // their position automatically — no extra click needed.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || !course || !syllabus.length) return;
    restoredRef.current = true;
    // Don't override explicit ?module=N or ?resume=1
    if (initialModule != null || autoResume) return;
    // §16 — Async recovery from draftStore (account-isolated, quota-aware)
    loadSession(courseId).then(({ ok, state }) => {
      if (!ok || !state) return;
      loadSessionCache.set(courseId, state);
      if (state.sessionModule != null && syllabus[state.sessionModule]) {
        const item = syllabus[state.sessionModule];
        const blocks = (typeof item === 'object' && Array.isArray(item.blocks)) ? item.blocks : [];
        if (blocks.length > 0) {
          setSessionModule(state.sessionModule);
          // §32 — Show recovery banner when restoring a previous session
          if (!recoveryDismissed) setRecoveryType('restored');
        }
      }
    }).catch(() => {});
  }, [courseId, course, syllabus, initialModule, autoResume, recoveryDismissed]);

  // Persist session state whenever it changes
  useEffect(() => {
    if (!courseId || sessionModule == null) return;
    saveSessionState(courseId, { sessionModule, reviewModule });
  }, [courseId, sessionModule, reviewModule]);

  // ─── Completed-state helpers (real blocks only) ─────────────────────
  const completedBlocksMap = useMemo(() => {
    const m = {};
    const raw = progress?.completed_blocks;
    if (raw && typeof raw === 'object') {
      Object.entries(raw).forEach(([mi, ids]) => {
        m[String(mi)] = new Set(Array.isArray(ids) ? ids : []);
      });
    }
    return m;
  }, [progress]);

  const completedModules = useMemo(
    () => (Array.isArray(progress?.completed_modules) ? progress.completed_modules.map(Number) : []),
    [progress],
  );

  // §18, §19 — Page visibility handling: protect pending work when app becomes hidden
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // §43 — Flush session state immediately before possible suspension
        if (courseId && sessionModule != null) {
          saveSession(courseId, { sessionModule, reviewModule }).catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [courseId, sessionModule, reviewModule]);

  // §19 — beforeunload: protect pending work on application close
  useEffect(() => {
    const onBeforeUnload = () => {
      if (courseId && sessionModule != null) {
        // §17 — Do not rely exclusively on beforeunload, but use it as safety net
        saveSession(courseId, { sessionModule, reviewModule }).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [courseId, sessionModule, reviewModule]);

  const moduleState = useCallback((index) => {
    const item = syllabus[index];
    const blocks = (typeof item === 'object' && Array.isArray(item?.blocks)) ? item.blocks : [];
    const done = blocks.filter((b) => completedBlocksMap[String(index)]?.has(b.id)).length;
    const allDone = blocks.length > 0 && done >= blocks.length;
    const inCompletedList = completedModules.includes(index);
    const isCurrent = index === (Number(progress?.last_module_index) || 0);
    if (allDone || inCompletedList) return { status: 'completed', done, total: blocks.length };
    if (isCurrent && done === 0) return { status: 'current', done, total: blocks.length };
    return { status: 'available', done, total: blocks.length };
  }, [syllabus, completedBlocksMap, completedModules, progress]);

  // Frontier for the 🔒 "future" marker: the furthest module the learner
  // has actually reached (opened or completed). Beyond it = future work.
  const maxReached = useMemo(() => {
    let m = Number(progress?.last_module_index) || 0;
    completedModules.forEach((i) => { m = Math.max(m, i); });
    return m;
  }, [progress, completedModules]);

  // §1-§42 — Learning Navigation Engine: safe transitions, double-click
  // protection, pending-work checking, save coordination, completion
  // validation, and next-destination resolution.  Placed here because
  // it depends on `syllabus` and `progress` which are defined above.
  const learningNav = useLearningNavigation({
    progress,
    setProgress,
    syllabus,
    showToast,
    isHt,
    enqueueProgress,
  });

  // §38 — Confirmation: when learner is inside a session and tries to go back,
  // only ask if there is real unsaved work. Normal navigation flows freely.
  const confirmLeaveSession = useCallback((action) => {
    if (learningNav.saveState === 'local_only' || learningNav.saveState === 'error') {
      setConfirmDialog({
        title: isHt ? 'Travay ou pa anrejistre ankò' : 'Your work is not saved yet',
        message: isHt
          ? 'Ou gen travay ki pa t anrejistre sou sèvè a. Ou ka pèdi li si ou ale kounye a.'
          : 'You have unsaved work on the server. You may lose it if you leave now.',
        confirmLabel: isHt ? 'Ale kounye a' : 'Leave anyway',
        cancelLabel: isHt ? 'Retounen' : 'Stay',
        onConfirm: () => { setConfirmDialog(null); action(); },
        onCancel: () => setConfirmDialog(null),
        variant: 'danger',
      });
      return;
    }
    action();
  }, [learningNav.saveState, isHt]);

  // §44 — Notification priority: queue-based system with dedup.
  const addNotification = useCallback((msg, type = 'info', priority = 'low') => {
    const id = Date.now();
    setNotifications((prev) => {
      if (prev.some((n) => n.msg === msg)) return prev;
      const next = [...prev, { id, msg, type, priority }];
      if (priority === 'high') next.sort((a, b) => (a.priority === 'high' ? -1 : 1));
      return next;
    });
    const delay = priority === 'high' ? 5000 : priority === 'normal' ? 3000 : 2500;
    setTimeout(() => { setNotifications((prev) => prev.filter((n) => n.id !== id)); }, delay);
  }, []);

  // §44 — Wire notifications to save state changes
  useEffect(() => {
    if (learningNav.saveState === 'error') {
      addNotification(
        isHt ? '⚠️ Erè sove — travay ou sekirite lokalman.' : '⚠️ Save error — your work is safe locally.',
        'error',
        'high',
      );
    }
  }, [learningNav.saveState, isHt, addNotification]);

  // §37 — Unlock toast: brief notification when next module unlocks
  const unlockToastRef = useRef(null);
  useEffect(() => {
    if (!progress) return;
    const newMax = Number(progress.last_module_index) || 0;
    if (newMax > unlockToastRef.current && unlockToastRef.current !== null) {
      const moduleItem = syllabus[newMax];
      const modTitle = (typeof moduleItem === 'object' && moduleItem?.title)
        ? moduleItem.title
        : `${isHt ? 'Modil' : 'Module'} ${newMax + 1}`;
      setUnlockToast({
        id: Date.now(),
        text: isHt ? `🔓 ${modTitle} debloke!` : `🔓 ${modTitle} unlocked!`,
      });
      announce(isHt ? `${modTitle} debloke` : `${modTitle} unlocked`);
      setTimeout(() => setUnlockToast(null), 3000);
    }
    unlockToastRef.current = newMax;
  }, [progress, syllabus, isHt, announce]);

  // §39 — Scroll to top when a lesson opens
  useEffect(() => {
    if (sessionModule != null) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [sessionModule]);

  // §25 — Mobile keyboard: when a textarea/input gets focus, scroll it
  // into view so the keyboard doesn't hide it.
  useEffect(() => {
    const handleFocus = (e) => {
      const tag = e.target.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') {
        // Small delay to let the keyboard animate open
        setTimeout(() => {
          e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    };
    document.addEventListener('focusin', handleFocus);
    return () => document.removeEventListener('focusin', handleFocus);
  }, []);

  // §46 — Lesson Prefetching: prefetch next lesson's media on idle.
  // Uses sessionModule (defined before early returns) to detect active session.
  const nextModuleForPrefetch = useMemo(() => {
    if (sessionModule != null || !syllabus || syllabus.length === 0) return null;
    const currentIdx = progress?.last_module_index || 0;
    const nextIdx = currentIdx + 1;
    return nextIdx < syllabus.length ? syllabus[nextIdx] : null;
  }, [sessionModule, syllabus, progress?.last_module_index]);
  useLessonPrefetch({
    nextLesson: nextModuleForPrefetch,
    nextLessonIndex: nextModuleForPrefetch ? (progress?.last_module_index || 0) + 1 : null,
    courseId,
    isEnabled: sessionModule == null && !offlineMode,
  });

  // ─── Progress actions (same engine as CourseDetail) ────────────────
  const handleViewed = useCallback((moduleIndex, blockIndex, blockId) => {
    if (!user || !progress) return;
    const payload = {
      module_index: Number(moduleIndex) || 0,
      block_index: Number(blockIndex) >= 0 ? Number(blockIndex) : -1,
      block_id: blockId || '',
    };
    progressService.recordPosition(progress.id, payload)
      .then((r) => { if (r?.data) setProgress((prev) => ({ ...prev, ...r.data })); })
      .catch(() => {
        // Offline / transient — queue for replay. The plain URL makes
        // the queue's last-write-wins dedup keep only the latest
        // position, which is exactly right.
        enqueueProgress({ url: `progress/${progress.id}/record_position/`, data: payload });
      });
  }, [user, progress]);

  const handleComplete = useCallback((moduleIndex, blockId, blockType) => {
    if (!user) return;
    const send = (rowId) => {
      const payload = {
        module_index: Number(moduleIndex) || 0,
        block_id: blockId || '',
        block_type: blockType || '',
      };
      progressService.completeBlock(rowId, payload)
        .then((r) => {
          if (r?.data) {
            setProgress((prev) => ({ ...prev, ...r.data }));
            celebrateFrom(r.data.gamification);
          }
        })
        .catch(() => {
          // Row id known — queue the row-based completion. The unique
          // ?bid= suffix makes each block survive the queue's per-URL
          // dedup; the server is idempotent, so replay is safe.
          enqueueProgress({
            url: `progress/${rowId}/complete_block/?bid=${encodeURIComponent(blockId || '')}`,
            data: payload,
          });
        });
    };
    if (progress?.id) { send(progress.id); return; }
    progressService.create({ course: courseId })
      .then((created) => {
        const fresh = created?.data || null;
        if (fresh) { setProgress(fresh); send(fresh.id); }
      })
      .catch(() => {
        // No row exists yet (first completion offline) — queue the
        // course-scoped completion; the server find-or-creates the row
        // (POST /api/progress/complete/).
        enqueueProgress({
          url: `progress/complete/?cid=${courseId}&bid=${encodeURIComponent(blockId || '')}`,
          data: {
            course_id: courseId,
            module_index: Number(moduleIndex) || 0,
            block_id: blockId || '',
            block_type: blockType || '',
          },
        });
      });
  }, [user, progress, courseId, celebrateFrom]);

  // ─── Offline staging (spec §48–§49): after a successful load, cache
  //     the snapshot so this learner can keep studying offline. Skipped
  //     while already rendering from cache (offlineMode). ─────────────
  useEffect(() => {
    if (!course || !courseId || !user || offlineMode) return;
    stageCourse(courseId, user.id, {
      course,
      progress,
      announcements,
      resources,
      notes,
    });
  }, [course, courseId, user, progress, announcements, resources, notes, offlineMode]);

  // ─── Private notes (spec §24): one note per (course, module) — the
  //     same upsert key the backend enforces, so saving twice updates
  //     the SAME row instead of duplicating. "Your note" is bound to the
  //     opened module, and is never visible to anyone but the learner.
  const notesByModule = useMemo(() => {
    const m = {};
    (notes || []).forEach((n) => { m[String(n.module_index)] = n; });
    return m;
  }, [notes]);

  const handleDeleteNote = useCallback((moduleIndex) => {
    const mi = Number(moduleIndex) || 0;
    const existing = notesByModule[mi];
    if (!existing || noteBusy[mi]) return;
    setNoteBusy((b) => ({ ...b, [mi]: true }));
    courseSupportService.deleteNote(existing.id)
      .then(() => {
        setNotes((prev) => prev.filter((n) => Number(n.id) !== Number(existing.id)));
        setNoteDrafts((d) => ({ ...d, [mi]: '' }));
        setNoteBusy((b) => ({ ...b, [mi]: false }));
        setNoteStatus((s) => ({ ...s, [mi]: { kind: 'saved', text: isHt ? 'Nòt efase' : 'Note deleted' } }));
        setTimeout(() => setNoteStatus((s) => { const c = { ...s }; delete c[mi]; return c; }), 2200);
      })
      .catch(() => {
        setNoteBusy((b) => ({ ...b, [mi]: false }));
        setNoteStatus((s) => ({ ...s, [mi]: { kind: 'error', text: isHt ? 'Erè — nòt la pa t efase.' : 'Error — note not deleted.' } }));
      });
  }, [notesByModule, noteBusy, isHt]);

  const handleSaveNote = useCallback((moduleIndex) => {
    const mi = Number(moduleIndex) || 0;
    const content = (noteDrafts[mi] || '').trim();
    const existing = notesByModule[mi];
    if (noteBusy[mi]) return;
    // Empty content over an existing note → delete it (cleanup, honest).
    if (!content) {
      if (existing) handleDeleteNote(mi);
      return;
    }
    setNoteBusy((b) => ({ ...b, [mi]: true }));
    const done = (note) => {
      setNotes((prev) => [
        ...prev.filter((n) => !(Number(n.module_index) === mi && (n.block_id || '') === '')),
        note,
      ]);
      setNoteBusy((b) => ({ ...b, [mi]: false }));
      setNoteStatus((s) => ({ ...s, [mi]: { kind: 'saved', text: isHt ? '✅ Nòt anrejistre' : '✅ Note saved' } }));
      setTimeout(() => setNoteStatus((s) => { const c = { ...s }; delete c[mi]; return c; }), 2200);
    };
    const fail = () => {
      setNoteBusy((b) => ({ ...b, [mi]: false }));
      setNoteStatus((s) => ({ ...s, [mi]: { kind: 'error', text: isHt ? 'Erè — nòt la pa t anrejistre.' : 'Error — note not saved.' } }));
    };
    if (existing) {
      courseSupportService.updateNote(existing.id, { content }).then((r) => done(r.data)).catch(fail);
    } else {
      courseSupportService.saveNote({ course_id: courseId, module_index: mi, block_id: '', content })
        .then((r) => done(r.data)).catch(fail);
    }
  }, [courseId, noteDrafts, notesByModule, noteBusy, isHt, handleDeleteNote]);

  // ─── Resume card data: "You stopped at Module 3 · Lesson 4" ─────────
  const resumeInfo = useMemo(() => {
    if (!progress || !course) return null;
    const mi = Number(progress.last_module_index) || 0;
    const item = syllabus[mi];
    if (!item) return null;
    const moduleTitle = typeof item === 'object' && item.title ? item.title : `${isHt ? 'Modil' : 'Module'} ${mi + 1}`;
    let blockTitle = '';
    if (progress.last_block_id && typeof item === 'object' && Array.isArray(item.blocks)) {
      const b = item.blocks.find((x) => x.id === progress.last_block_id);
      if (b) blockTitle = b.title || blockTypeLabel(b.type, isHt);
    }
    return { moduleIndex: mi, moduleTitle, blockTitle };
  }, [progress, course, syllabus, isHt]);

  const handleContinue = useCallback(() => {
    const mi = resumeInfo ? resumeInfo.moduleIndex : 0;
    // Guard: the target module must exist AND have blocks — otherwise
    // clicking Start would show an empty ModuleSession ("Module complete!"
    // with stepCount 0) or do nothing at all (syllabus empty).
    const target = syllabus[mi];
    if (!target) {
      showToast?.(isHt ? 'Kou sa a pa gen okenn aktivite pou kounye a.' : 'This course has no activities yet.', 'info-circle');
      return;
    }
    const blocks = (typeof target === 'object' && Array.isArray(target.blocks)) ? target.blocks : [];
    if (blocks.length === 0) {
      // Legacy course: module has no blocks. Try the next module instead
      // of showing an empty session.
      for (let i = mi + 1; i < syllabus.length; i++) {
        const next = syllabus[i];
        const nextBlocks = (typeof next === 'object' && Array.isArray(next.blocks)) ? next.blocks : [];
        if (nextBlocks.length > 0) {
          setSessionModule(i);
          return;
        }
      }
      // Fallback: try the first module with blocks
      for (let i = 0; i < syllabus.length; i++) {
        const next = syllabus[i];
        const nextBlocks = (typeof next === 'object' && Array.isArray(next.blocks)) ? next.blocks : [];
        if (nextBlocks.length > 0) {
          setSessionModule(i);
          return;
        }
      }
      showToast?.(isHt ? 'Kou sa a pa gen okenn aktivite. Ajoute aktivite nan Creator Studio.' : 'This course has no activities. Add activities in Creator Studio.', 'info-circle');
      return;
    }
    setSessionModule(mi);
  }, [resumeInfo, syllabus, isHt, showToast]);

  // Advance to the next NON-future module (real path progression: once
  // a module completes, its successor unlocks server-side). Falls back
  // to closing the session when there is no further available module.
  const handleNextModule = useCallback(() => {
    setSessionModule((cur) => {
      if (cur == null) return null;
      for (let i = cur + 1; i < syllabus.length; i++) {
        const st = moduleState(i);
        const isFuture = i > maxReached && st.status === 'available';
        if (!isFuture) return i;
      }
      return null;
    });
  }, [syllabus, moduleState, maxReached]);

  // ─── Message instructor ─────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    if (!messageBody.trim() || messageBusy) return;
    setMessageBusy(true);
    try {
      await courseService.messageInstructor(courseId, messageBody.trim());
      setMessageOpen(false);
      setMessageBody('');
      showToast?.(isHt ? '✅ Mesaj voye bay enstriktè a.' : '✅ Message sent to the instructor.', 'check-circle');
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message;
      showToast?.(isHt ? `Erè: ${detail || 'mesaj la pa t voye.'}` : `Error: ${detail || 'message not sent.'}`, 'exclamation-triangle');
    } finally {
      setMessageBusy(false);
    }
  }, [messageBody, messageBusy, courseId, isHt, showToast]);

  // ─── Practice Center (spec §14) — every practice block of the course
  //     grouped by type, rendered with the SAME block renderer (so
  //     completing practice records real progress). ────────────────────
  const practiceGroups = useMemo(() => {
    const groups = {};
    syllabus.forEach((item, mi) => {
      if (typeof item !== 'object' || !Array.isArray(item?.blocks)) return;
      item.blocks.forEach((b, bi) => {
        const key = b.type || 'repeat';
        if (!groups[key]) groups[key] = [];
        groups[key].push({ block: b, moduleIndex: mi, blockIndex: bi });
      });
    });
    const order = ['vocabulary', 'pronunciation', 'listening', 'speaking', 'conversation', 'repeat'];
    return order
      .filter((k) => groups[k]?.length)
      .map((k) => ({ type: k, items: groups[k] }));
  }, [syllabus]);

  // ─── Next-level pathway (official language programs) ────────────────
  const pathway = useMemo(() => {
    if (!course?.language_program) return null;
    const next = { beginner: 'intermediate', intermediate: 'advanced' }[course.difficulty];
    if (!next) return null;
    return {
      programId: course.language_program,
      nextLevel: next,
      label: LEVEL_LABEL[next]?.[isHt ? 'ht' : 'en'] || next,
    };
  }, [course, isHt]);

  // ─── Loading / error / gates ────────────────────────────────────────
  if (loadFailed) {
    return (
      <div className="ls-page">
        <div className="ls-state" role="alert">
          <i className="fas fa-triangle-exclamation" aria-hidden="true" />
          <h3>{isHt ? 'Pa t kapab chaje kou a.' : 'Could not load the course.'}</h3>
          <p>{isHt ? 'Tcheke koneksyon ou epi eseye ankò.' : 'Check your connection and try again.'}</p>
          <div className="ls-state-actions">
            <button type="button" className="ls-btn" onClick={onBack}>
              <i className="fas fa-arrow-left" aria-hidden="true" /> {isHt ? 'Retounen' : 'Back'}
            </button>
            <button type="button" className="ls-btn ls-btn--primary" onClick={() => window.location.reload()}>
              <i className="fas fa-rotate-right" aria-hidden="true" /> {isHt ? 'Eseye ankò' : 'Try again'}
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (!course || (user && !access && !offlineMode)) {
    // Skeleton mirrors the real layout (header + hero + panels + modules)
    // so loading feels fast — never a blank screen while data arrives.
    return (
      <div className="ls-page" role="status" aria-busy="true" aria-label={isHt ? 'Ap chaje...' : 'Loading...'}>
        <div className="ls-skel-header" aria-hidden="true">
          <div className="ls-skeleton" />
          <div className="ls-skeleton" />
        </div>
        <div className="ls-skel-hero" aria-hidden="true">
          <div className="ls-skel-hero-main">
            <div className="ls-skeleton" />
            <div className="ls-skeleton" />
            <div className="ls-skeleton" />
          </div>
          <div className="ls-skel-ring" />
        </div>
        <div className="ls-skel-panel" aria-hidden="true">
          <div className="ls-skeleton" />
          <div className="ls-skeleton" />
          <div className="ls-skeleton" />
        </div>
        <div className="ls-skel-modules" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="ls-skel-module">
              <div className="ls-skeleton" />
              <div className="ls-skeleton" />
              <div className="ls-skeleton" />
            </div>
          ))}
        </div>
        {/* Visible loading label — in dark mode the skeleton blocks are
            near-invisible on the near-black background, so without this
            the loading state reads as a BLACK EMPTY PAGE while the
            course + access + progress fetch. A real label keeps it
            honest: the space is loading, not broken. */}
        <p className="ls-loading-label" role="status">
          <i className="fas fa-spinner fa-spin" aria-hidden="true" />
          {isHt ? 'Ap chaje espas aprantisaj la...' : 'Loading your learning space...'}
        </p>
      </div>
    );
  }
  if (user && access && !isEnrolled) {
    return (
      <div className="ls-page">
        <div className="ls-state">
          <i className="fas fa-lock" aria-hidden="true" />
          <h3>{isHt ? 'Ou poko gen aksè sou kou sa a.' : 'You do not have access to this course yet.'}</h3>
          <p>{isHt ? 'Enskri oswa achte kou a pou antre nan Espas Aprantisaj la.' : 'Enroll or purchase the course to enter the Learning Space.'}</p>
          <button type="button" className="ls-btn ls-btn--primary" onClick={() => onOpenCourse?.(course)}>
            <i className="fas fa-graduation-cap" aria-hidden="true" /> {isHt ? 'Ale nan paj kou a' : 'Go to course page'}
          </button>
        </div>
      </div>
    );
  }

  const title = course.title || '';
  const totalBlocks = syllabus.reduce((n, item) => n + (Array.isArray(item?.blocks) ? item.blocks.length : 0), 0);
  const doneBlocks = syllabus.reduce((n, item, mi) => n + (completedBlocksMap[String(mi)]?.size || 0), 0);
  // §10-11 — Separate required vs optional blocks
  const requiredBlocks = syllabus.reduce((n, item) => {
    const blocks = Array.isArray(item?.blocks) ? item.blocks : [];
    return n + blocks.filter((b) => b.required !== false).length;
  }, 0);
  const optionalBlocks = totalBlocks - requiredBlocks;
  const doneRequired = syllabus.reduce((n, item, mi) => {
    const blocks = Array.isArray(item?.blocks) ? item.blocks : [];
    const completed = completedBlocksMap[String(mi)] || new Set();
    return n + blocks.filter((b) => b.required !== false && completed.has(b.id)).length;
  }, 0);
  const doneOptional = doneBlocks - doneRequired;
  const totalModules = syllabus.length;
  const levelLabel = LEVEL_LABEL[course.difficulty]?.[isHt ? 'ht' : 'en'];

  // ─── Active step session ───────────────────────────────────────────
  const activeModule = reviewModule != null ? reviewModule : sessionModule;
  const sessionItem = activeModule != null ? syllabus[activeModule] : null;

  // ─── LearningShell header actions (injected into shell header) ────
  const shellHeaderActions = (
    <>
      {!sessionItem && (<>
      <button
        type="button"
        className={`ls-shell-header-btn${mode === 'practice' ? ' is-active' : ''}`}
        title={isHt ? 'Sant Pratik' : 'Practice Center'}
        aria-label={isHt ? 'Sant Pratik' : 'Practice Center'}
        aria-pressed={mode === 'practice'}
        onClick={() => setMode(mode === 'practice' ? 'curriculum' : 'practice')}
      >
        <i className={`fas ${mode === 'practice' ? 'fa-book-open' : 'fa-dumbbell'}`} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="ls-shell-header-btn"
        title={isHt ? 'Kontakte enstriktè' : 'Contact instructor'}
        aria-label={isHt ? 'Kontakte enstriktè' : 'Contact instructor'}
        onClick={() => (hasInstructor ? setMessageOpen(true) : showToast?.(isHt ? 'Kou sa a pa gen enstriktè pou kontakte.' : 'This course has no instructor to contact.', 'info'))}
      >
        <i className="fas fa-comment-dots" aria-hidden="true" />
      </button>
      </>)}
    </>
  );

  // ─── LearningShell sidebar footer ────────────────────────────────
  const shellSidebarFooter = (
    <div className="ls-sidebar-footer">
      <div className="ls-sidebar-footer-row">
        <span>{isHt ? 'Aktivite' : 'Activities'}</span>
        <span>{doneBlocks}/{totalBlocks}</span>
      </div>
      <div className="ls-sidebar-footer-row">
        <span>{isHt ? 'Modil' : 'Modules'}</span>
        <span>{completedModules.length}/{totalModules}</span>
      </div>
    </div>
  );

  return (
    <LearningShell
      course={course}
      progress={progress}
      syllabus={syllabus}
      currentModule={activeModule}
      isSessionActive={Boolean(sessionItem)}
      lang={lang}
      user={user}
      onBack={onBack}
      onModuleSelect={(mi) => {
        const st = moduleState(mi);
        const isFuture = mi > maxReached && st.status === 'available';
        if (!isFuture) setSessionModule(mi);
      }}
      onOpenCourse={onOpenCourse}
      headerActions={shellHeaderActions}
      sidebarFooter={shellSidebarFooter}
      focusMode={focusMode}
      onToggleFocus={() => setFocusMode((f) => !f)}
      actionArea={sessionItem ? (
        <>
          <button
            type="button"
            className="ls-btn"
            onClick={() => confirmLeaveSession(() => { setSessionModule(null); setReviewModule(null); clearSessionState(courseId); })}
          >
            <i className="fas fa-arrow-left" aria-hidden="true" /> {isHt ? 'Kou a' : 'Course'}
          </button>
          <div className="ls-action-area-spacer" />
          {learningNav.navState !== 'idle' && (
            <span className="ls-nav-label">
              {learningNav.navLabel}
            </span>
          )}
        </>
      ) : undefined}
    >
      {/* ─── +XP celebration popup (Duolingo-style) ─────────── */}
      {xpPopup && (
        <div key={xpPopup.id} className="ls-xp-popup" role="status">
          <i className="fas fa-star" aria-hidden="true" />
          +{xpPopup.amount} XP
        </div>
      )}

      {/* ─── Offline banner — rendering from the staged snapshot ─── */}
      {offlineMode && (
        <div className="ls-offline-banner" role="status">
          <i className="fas fa-wifi" aria-hidden="true" />
          {isHt
            ? 'Disponib offline — pwogrè ou ap senkronize lè koneksyon retounen.'
            : 'Available offline — your progress will sync when you are back online.'}
        </div>
      )}

      {/* ─── §11 — Save state indicator: shows when work is saved locally
           vs on server. Only visible during active sessions. ────────── */}
      {sessionItem && learningNav.saveState && learningNav.saveState !== 'idle' && learningNav.saveState !== 'saved' && (
        <div className="ls-recovery-banner" role="status" aria-live="polite" style={{
          background: learningNav.saveState === 'local_only' ? 'rgba(255, 152, 0, 0.08)' : learningNav.saveState === 'syncing' ? 'rgba(33, 150, 243, 0.08)' : 'rgba(233, 30, 99, 0.08)',
          border: `1px solid ${learningNav.saveState === 'local_only' ? 'rgba(255, 152, 0, 0.2)' : learningNav.saveState === 'syncing' ? 'rgba(33, 150, 243, 0.2)' : 'rgba(233, 30, 99, 0.2)'}`,
          color: learningNav.saveState === 'local_only' ? '#e65100' : learningNav.saveState === 'syncing' ? '#0d47a1' : '#880e4f',
        }}>
          <i className={`fas ${learningNav.saveState === 'local_only' ? 'fa-hard-drive' : learningNav.saveState === 'syncing' ? 'fa-cloud-arrow-up' : 'fa-triangle-exclamation'}`} aria-hidden="true" />
          <span>
            {learningNav.saveState === 'local_only'
              ? (isHt ? '💾 Travay soke sou aparèy la. Ap senkronize lè koneksyon retounen.' : '💾 Saved on device. Will sync when online.')
              : learningNav.saveState === 'syncing'
                ? (isHt ? '🔄 Ap senkronize travay ou...' : '🔄 Syncing your work...')
                : (isHt ? '⚠️ Erè sove — travay ou an sekirite lokalman.' : '⚠️ Save error — your work is safe locally.')}
          </span>
        </div>
      )}

      {/* ─── Welcome back message — show when returning student has progress ─── */}
      {!sessionItem && progress && doneBlocks > 0 && !autoResume && (
        <div className="ls-welcome-back" role="status">
          <i className="fas fa-hand-wave ls-welcome-back-icon" aria-hidden="true" />
          <div>
            <strong>{isHt ? 'Byenveni retoure!' : 'Welcome back!'}</strong>
            <span>
              {isHt
                ? `Ou te rete nan modil ${resumeModuleIndex != null ? resumeModuleIndex + 1 : ''}. Kontinye la kote ou te rete.`
                : `You were working on module ${resumeModuleIndex != null ? resumeModuleIndex + 1 : ''}. Continue where you stopped.`}
            </span>
          </div>
          {resumeModuleIndex != null && (
            <button
              className="ls-welcome-back-btn"
              onClick={() => setSessionModule(resumeModuleIndex)}
            >
              {isHt ? 'Kontinye' : 'Continue'}
            </button>
          )}
        </div>
      )}

      {/* ─── Gamification chips — XP / level / streak / hearts / daily
           goal. Hidden while a step session owns the screen (the
           session header shows the hearts it needs). ──────────────── */}
      {!sessionItem && user && gamiStats && (
        <GamificationBar
          stats={gamiStats}
          lang={lang}
          onRefillHearts={refillHearts}
          onUpdateGoal={updateGoal}
        />
      )}

      {/* ─── Active step session (Duolingo-style) — full focus: the
           whole page becomes ONE module, one activity at a time. The
           header above still offers course-level nav; the session's
           own exit returns to the curriculum path. ─────────────── */}
      {sessionItem ? (
        <>
        {/* §32 — Recovery banner: shows when session is restored */}
        {!recoveryDismissed && recoveryType && (
          <RecoveryBanner
            type={recoveryType}
            lang={lang}
            onDismiss={() => { setRecoveryDismissed(true); setRecoveryType(null); }}
          />
        )}
        <ModuleSessionErrorBoundary
          isHt={isHt}
          onRetry={() => { setSessionRetryKey((k) => k + 1); }}
          onExit={() => { setSessionModule(null); setReviewModule(null); setSessionRetryKey(0); clearSessionState(courseId); }}
          key={sessionRetryKey}
        >
        <ModuleSession
          courseId={courseId}
          moduleIndex={activeModule}
          item={sessionItem}
          lang={lang}
          translations={translations}
          progress={progress}
          completedBlocksMap={completedBlocksMap}
          completedModules={completedModules}
          review={reviewModule != null}
          onComplete={handleComplete}
          onViewed={reviewModule != null ? () => {} : handleViewed}
          onExit={() => { setSessionModule(null); setReviewModule(null); clearSessionState(courseId); }}
          onNextModule={() => { setReviewModule(null); handleNextModule(); }}
          cachedQuizzes={offlineMode ? cachedQuizzes : undefined}
          gamification={gamiStats}
          onGamification={celebrateFrom}
          onQuizzesLoaded={(list) => {
            setCachedQuizzes(list);
            stageQuizzes(courseId, user?.id, list);
          }}
          onSafeNavigate={learningNav.safeNavigate}
          courseObjectives={course?.objectives || []}
          // §20 — Granular position tracking for session recovery
          onPositionChange={(blockId, blockType) => {
            if (courseId) {
              saveSession(courseId, { sessionModule, reviewModule, currentBlockId: blockId, currentBlockType: blockType }).catch(() => {});
            }
          }}
        />
        </ModuleSessionErrorBoundary>
        </>
      ) : (<>

      {/* ─── Weak-skill highlight (2027 §32–§33) — evidence-based, not
          a reminder to grind: this course has skills the learner has
          practiced but not yet strengthened. One calm line. ─────── */}
      {Array.isArray(courseSkills) && courseSkills.some((s) => s.state === 'needs_review' || s.state === 'developing') && (
        <div className="ls-skill-nudge" role="status">
          <i className="fas fa-lightbulb" aria-hidden="true" />
          <span>
            {isHt
              ? `Konpetans pou ranfòse: ${courseSkills
                  .filter((s) => s.state === 'needs_review' || s.state === 'developing')
                  .map((s) => s.skill).join(', ')}. Repase yo nan Sant Pratik.`
              : `Skills to strengthen: ${courseSkills
                  .filter((s) => s.state === 'needs_review' || s.state === 'developing')
                  .map((s) => s.skill).join(', ')}. Review them in the Practice Center.`}
          </span>
          <button type="button" className="ls-skill-nudge-cta" onClick={() => setMode('practice')}>
            {isHt ? 'Pratike' : 'Practice'}
          </button>
        </div>
      )}

      {/* ─── Continue / progress hero ─────────────────────── */}
      <section className="ls-hero">
        <div className="ls-hero-main">
          <h1>{title}</h1>
          {isComplete ? (
            <div className="ls-complete-badge">
              <i className="fas fa-trophy" aria-hidden="true" /> {isHt ? 'Kou fini — Félicitations!' : 'Course completed — congratulations!'}
            </div>
          ) : totalBlocks > 0 ? (
            <button type="button" className="ls-continue-btn" onClick={handleContinue}>
              <i className="fas fa-play" aria-hidden="true" />
              {resumeInfo && pct > 0
                ? (isHt ? 'Kontinye aprann' : 'Continue learning')
                : (isHt ? 'Kòmanse kou a' : 'Start the course')}
            </button>
          ) : (
            <div className="ls-complete-badge ls-complete-badge--empty">
              <i className="fas fa-folder-open" aria-hidden="true" />
              {isHt ? 'Kou sa a poko gen aktivite.' : 'This course has no activities yet.'}
            </div>
          )}
          {resumeInfo && !isComplete && (
            <p className="ls-resume-hint">
              <i className="fas fa-location-dot" aria-hidden="true" />
              {isHt ? 'Ou te sispann nan' : 'You stopped at'} <strong>{resumeInfo.moduleTitle}</strong>
              {resumeInfo.blockTitle ? ` · ${resumeInfo.blockTitle}` : ''}
            </p>
          )}
        </div>
        <div className="ls-progress-ring" style={{ '--ls-pct': `${pct}%` }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
          <span>{pct}%</span>
        </div>
      </section>

      {/* ─── Practice Center (spec §14) ───────────────────── */}
      {mode === 'practice' && (
        <section className="ls-practice">
          <div className="ls-practice-head">
            <h3 className="ls-panel-title"><i className="fas fa-dumbbell" aria-hidden="true" /> {isHt ? 'Sant Pratik' : 'Practice Center'}</h3>
            <p>
              {isHt
                ? 'Revize tout aktivite kou a, pa tip. Konplete yon aktivite anrejistre pwogrè ou reyèlman.'
                : 'Review every activity in the course, by type. Completing an activity genuinely records your progress.'}
            </p>
          </div>
          {practiceGroups.length === 0 ? (
            <div className="ls-state ls-state--small">
              <i className="fas fa-spa" aria-hidden="true" />
              <p>{isHt ? 'Kou sa a pa gen aktivite pratik.' : 'This course has no practice activities.'}</p>
            </div>
          ) : (
            practiceGroups.map(({ type, items }) => (
              <div key={type} className="ls-practice-group">
                <h4 className="ls-practice-type">
                  <i className={`fas ${type === 'repeat' ? 'fa-repeat' : type === 'pronunciation' ? 'fa-language' : type === 'listening' ? 'fa-ear-listen' : type === 'speaking' ? 'fa-comment-dots' : type === 'conversation' ? 'fa-comments' : 'fa-book-open'}`} aria-hidden="true" />
                  {blockTypeLabel(type, isHt)}
                  <span className="ls-practice-count">{items.length}</span>
                </h4>
                <div className="ls-blocks">
                  {items.map(({ block, moduleIndex, blockIndex }) => (
                    <BlockRenderer
                      key={`${moduleIndex}-${block.id || blockIndex}`}
                      block={block}
                      lang={lang}
                      index={blockIndex}
                      courseId={courseId}
                      moduleIndex={moduleIndex}
                      onComplete={handleComplete}
                      onViewed={handleViewed}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {/* ─── Curriculum mode content ──────────────────────── */}
      {mode !== 'practice' && (<>
      {/* ─── Progress summary ─────────────────────────────── */}
      <section className="ls-panel ls-progress-summary">
        <h3 className="ls-panel-title"><i className="fas fa-chart-simple" aria-hidden="true" /> {isHt ? 'Pwogrè ou' : 'Your progress'}</h3>
        <div className="ls-progress-stats">
          <div className="ls-stat"><strong>{pct}%</strong><span>{isHt ? 'Konple' : 'Complete'}</span></div>
          <div className="ls-stat"><strong>{doneRequired}/{requiredBlocks}</strong><span>{isHt ? 'Aktivite obligatwa' : 'Required'}</span></div>
          <div className="ls-stat"><strong>{completedModules.length}/{totalModules}</strong><span>{isHt ? 'Modil' : 'Modules'}</span></div>
        </div>
        {/* §10-11 — Show optional progress separately when present */}
        {optionalBlocks > 0 && (            <div className="ls-progress-optional">
              {isHt ? 'Resous optional' : 'Optional'}: {doneOptional}/{optionalBlocks}
            </div>
        )}
        {/* §2 — Progress Domains: separate Learning vs Assessment vs Activity */}
        {!sessionItem && (
          <ProgressDomains
            blocks={syllabus.flatMap((item) => Array.isArray(item?.blocks) ? item.blocks : [])}
            completedBlocks={(() => {
              const all = new Set();
              Object.values(completedBlocksMap).forEach((s) => { if (s instanceof Set) s.forEach((id) => all.add(id)); });
              return all;
            })()}
            lang={lang}
          />
        )}
      </section>

      {/* ─── Business Workspace (flagship course) ───────────── */}
      <section className="ls-panel">
        <button
          className="ls-panel-title ls-workspace-toggle"
          onClick={() => setShowWorkspace(!showWorkspace)}
        >
          <i className="fas fa-briefcase" aria-hidden="true" /> {isHt ? '💼 Biznis Workspace' : '💼 Business Workspace'}
          <span className="ls-workspace-arrow">{showWorkspace ? '▲' : '▼'}</span>
        </button>
        {showWorkspace && (
          <BusinessWorkspace courseId={courseId} user={user} showToast={showToast} />
        )}
      </section>

      {/* ─── §1-§49 — Project-Based Learning Workspace ──────── */}
      <section className="ls-panel">
        <button
          className="ls-panel-title ls-workspace-toggle"
          onClick={() => setShowProjectWorkspace(!showProjectWorkspace)}
        >
          <i className="fas fa-folder-open" aria-hidden="true" /> {isHt ? '📂 Pwojè Mwen' : '📂 My Project'}
          <span className="ls-workspace-arrow">{showProjectWorkspace ? '▲' : '▼'}</span>
        </button>
        {showProjectWorkspace && (
          <ProjectWorkspace
            courseId={courseId}
            lang={lang}
            user={user}
            showToast={showToast}
            originLesson={sessionItem?.block?.id || null}
            onReturnToLesson={() => setShowProjectWorkspace(false)}
          />
        )}
      </section>

      {/* ─── Announcements (spec §22) — course-scoped, created by the
           owner/staff; shown INSIDE the Learning Space. ───────── */}
      {announcements.length > 0 && (
        <section className="ls-panel ls-announcements">
          <h3 className="ls-panel-title"><i className="fas fa-bullhorn" aria-hidden="true" /> {isHt ? 'Anons' : 'Announcements'}</h3>
          <div className="ls-announcement-list">
            {announcements.map((a) => (
              <article key={a.id} className={`ls-announcement${a.is_pinned ? ' is-pinned' : ''}`}>
                <div className="ls-announcement-head">
                  {a.is_pinned && (
                    <span className="ls-announcement-pin"><i className="fas fa-thumbtack" aria-hidden="true" /> {isHt ? 'Pinned' : 'Pinned'}</span>
                  )}
                  <strong>{a.title}</strong>
                  <span className="ls-announcement-meta">
                    {a.created_by_username ? `${a.created_by_username} · ` : ''}
                    {a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}
                  </span>
                </div>
                {a.content && <p className="ls-announcement-content">{a.content}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ─── Resources (spec §23) — owner/staff-added files & links. */}
      {resources.length > 0 && (
        <section className="ls-panel ls-resources">
          <h3 className="ls-panel-title"><i className="fas fa-paperclip" aria-hidden="true" /> {isHt ? 'Resous' : 'Resources'}</h3>
          <ul className="ls-resource-list">
            {resources.map((r) => (
              <li key={r.id} className="ls-resource">
                <span className={`ls-resource-icon kind-${r.kind}`}>
                  <i className={`fas ${RESOURCE_ICONS[r.kind] || 'fa-link'}`} aria-hidden="true" />
                </span>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="ls-resource-link">
                  <strong>{r.title}</strong>
                  <span className="ls-resource-meta">{kindLabel(r.kind, isHt)}</span>
                </a>
                <i className="fas fa-arrow-up-right-from-square ls-resource-open" aria-hidden="true" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ─── Orientation ──────────────────────────────────── */}
      {(course.description || course.learning_objective) && (
        <section className="ls-panel">
          <h3 className="ls-panel-title"><i className="fas fa-compass" aria-hidden="true" /> {isHt ? 'Oryantasyon kou a' : 'Course orientation'}</h3>
          {course.learning_objective && (
            <p className="ls-objective"><strong>{isHt ? 'Kisa w pral aprann:' : 'What you will learn:'}</strong> {course.learning_objective}</p>
          )}
          {course.description && <p className="ls-desc">{course.description}</p>}
          {course.language_program && (
            <p className="ls-program-note">
              <i className="fas fa-graduation-cap" aria-hidden="true" />
              {isHt ? 'Kou sa a fè pati yon pwogram ofisyèl atelnyo.' : 'This course is part of an official Atelnyo program.'}
            </p>
          )}
        </section>
      )}

      {/* ─── Curriculum ───────────────────────────────────── */}
      <section className="ls-curriculum">
        <h3 className="ls-panel-title"><i className="fas fa-list-check" aria-hidden="true" /> {isHt ? 'Kourikoulòm' : 'Curriculum'}</h3>
        {syllabus.length === 0 && (
          <div className="ls-state ls-state--small">
            <i className="fas fa-book-open" aria-hidden="true" />
            <p>{isHt ? 'Kou sa a poko gen leson.' : 'This course has no lessons yet.'}</p>
          </div>
        )}
        {syllabus.map((item, mi) => {
          const st = moduleState(mi);
          const isFuture = mi > maxReached && st.status === 'available';
          const blocks = (typeof item === 'object' && Array.isArray(item.blocks)) ? item.blocks : [];
          const modTitle = (typeof item === 'object' && item.title) ? item.title : `${isHt ? 'Modil' : 'Module'} ${mi + 1}`;
          // Per-module mini path: one dot per real block, filled only
          // when genuinely completed (real progress, never assumed).
          const doneDots = blocks.filter((b) => completedBlocksMap[String(mi)]?.has(b.id)).length;
          const isDone = st.status === 'completed';
          const canOpen = !isFuture;
          return (
            <div
              key={mi}
              id={`ls-module-${mi}`}
              className={`ls-module ls-path-node ${mi % 2 === 0 ? 'is-side-left' : 'is-side-right'} ${st.status === 'completed' ? 'is-completed' : ''} ${isFuture ? 'is-future' : ''}`}
            >
              <button
                type="button"
                className="ls-module-head"
                onClick={() => canOpen && setSessionModule(mi)}
                disabled={!canOpen}
                aria-label={isHt ? `Ouvri ${modTitle}` : `Open ${modTitle}`}
              >
                <span className="ls-module-status" aria-hidden="true">
                  {isDone ? <i className="fas fa-circle-check" />
                    : isFuture ? <i className="fas fa-lock" />
                      : st.status === 'current' ? <i className="fas fa-play" />
                        : <i className="fas fa-circle" />}
                </span>
                <span className="ls-module-title">
                  {modTitle}
                  {st.status === 'current' && <em className="ls-module-now">{isHt ? 'Kounye a' : 'Current'}</em>}
                </span>
                <span className="ls-module-dots" aria-hidden="true">
                  {blocks.map((b, bi) => (
                    <i
                      key={b.id || bi}
                      className={`ls-module-dot ${completedBlocksMap[String(mi)]?.has(b.id) ? 'is-done' : ''}`}
                    />
                  ))}
                </span>
                <span className="ls-module-meta">
                  {st.total > 0 ? `${doneDots}/${st.total}` : ''}
                  {isFuture && <em className="ls-module-lock-label">{isHt ? 'Fèt' : 'Future'}</em>}
                </span>
                {!isFuture && (
                  <span className="ls-module-go" aria-hidden="true">
                    <i className={`fas ${isDone ? 'fa-rotate-right' : 'fa-play'}`} />
                  </span>
                )}
              </button>

              {/* Review a COMPLETED module — a practice-only session
                  that remixes its blocks without touching progress. */}
              {isDone && (
                <button
                  type="button"
                  className="ls-module-review"
                  onClick={() => setReviewModule(mi)}
                  aria-label={isHt ? `Revizyon ${modTitle}` : `Review ${modTitle}`}
                >
                  <i className="fas fa-rotate-right" aria-hidden="true" /> {isHt ? 'Revizyon' : 'Review'}
                </button>
              )}

              {/* Private learner note (spec §24) — bound to this
                  module, visible only to the learner. Collapsible so
                  the path stays clean. */}
              <div className="ls-path-note">
                <button
                  type="button"
                  className="ls-path-note-toggle"
                  onClick={() => setNoteOpen((o) => ({ ...o, [mi]: !o[mi] }))}
                  aria-expanded={Boolean(noteOpen[mi])}
                >
                  <i className="fas fa-note-sticky" aria-hidden="true" />
                  {notesByModule[mi] ? (isHt ? 'Nòt ou' : 'Your note') : (isHt ? 'Nòt' : 'Note')}
                  {notesByModule[mi] && <em className="ls-path-note-has">•</em>}
                </button>
                {noteOpen[mi] && (
                  <div className="ls-note">
                    <div className="ls-note-head">
                      <i className="fas fa-note-sticky" aria-hidden="true" />
                      <span>{isHt ? 'Nòt ou' : 'Your note'}</span>
                      <em>{isHt ? 'prive' : 'private'}</em>
                    </div>
                    <textarea
                      className="ls-textarea"
                      value={noteDrafts[mi] ?? ''}
                      onChange={(e) => setNoteDrafts((d) => ({ ...d, [mi]: e.target.value }))}
                      rows={2}
                      maxLength={2000}
                      placeholder={isHt ? 'Ekri yon nòt pou ou menm...' : 'Write a private note for yourself...'}
                    />
                    <div className="ls-note-actions">
                      <button
                        type="button"
                        className="ls-btn ls-btn--small"
                        onClick={() => handleSaveNote(mi)}
                        disabled={noteBusy[mi]}
                      >
                        {noteBusy[mi]
                          ? <i className="fas fa-spinner fa-pulse" aria-hidden="true" />
                          : <i className="fas fa-floppy-disk" aria-hidden="true" />}
                        {isHt ? 'Anrejistre' : 'Save'}
                      </button>
                      {notesByModule[mi] && (
                        <button
                          type="button"
                          className="ls-btn ls-btn--small ls-btn--ghost"
                          onClick={() => handleDeleteNote(mi)}
                          disabled={noteBusy[mi]}
                        >
                          <i className="fas fa-trash-can" aria-hidden="true" />
                          {isHt ? 'Efase' : 'Delete'}
                        </button>
                      )}
                    </div>
                    {noteStatus[mi] && (
                      <p className={`ls-note-status is-${noteStatus[mi].kind}`}>{noteStatus[mi].text}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* ─── Next-level pathway ───────────────────────────── */}
      {pathway && isComplete && (
        <section className="ls-panel ls-pathway">
          <h3 className="ls-panel-title"><i className="fas fa-arrow-up" aria-hidden="true" /> {isHt ? 'Nivo kap vini an' : 'Next level'}</h3>
          <p>
            {isHt
              ? `Ou fini nivo ${LEVEL_LABEL[course.difficulty]?.ht || course.difficulty} a. Kontinye nan nivo ${pathway.label}.`
              : `You completed the ${LEVEL_LABEL[course.difficulty]?.en || course.difficulty} level. Continue to ${pathway.label}.`}
          </p>
          <button type="button" className="ls-btn ls-btn--primary" onClick={() => onNavigate?.('/sheet/academy')}>
            <i className="fas fa-graduation-cap" aria-hidden="true" />
            {isHt ? 'Gade pwogram an' : 'View the program'}
          </button>
        </section>
      )}

      {/* ─── Certificate — verified completion only ──────── */}
      {isComplete && certificate && certificate !== 'none' && (
        <section className="ls-panel ls-certificate">
          <h3 className="ls-panel-title"><i className="fas fa-certificate" aria-hidden="true" /> {isHt ? 'Sètifika ou' : 'Your certificate'}</h3>
          <div className="ls-certificate-card">
            <span className="ls-certificate-seal"><i className="fas fa-award" aria-hidden="true" /></span>
            <div className="ls-certificate-body">
              <p className="ls-certificate-name">{certificate.learner_name}</p>
              <p className="ls-certificate-course">{certificate.course_title}</p>
              <p className="ls-certificate-meta">
                <i className="fas fa-hashtag" aria-hidden="true" /> {certificate.certificate_number}
                {certificate.issued_at ? ` · ${new Date(certificate.issued_at).toLocaleDateString()}` : ''}
              </p>
            </div>
          </div>
          <div className="ls-cert-actions">
            <button
              type="button"
              className="ls-btn ls-btn--primary"
              onClick={() => {
                const certNumber = certificate.certificate_number || 'ATY-00000000-00000000';
                const learnerName = certificate.learner_name || (isHt ? 'Elèv' : 'Learner');
                const courseTitle = certificate.course_title || '';
                const issuedDate = certificate.issued_at ? new Date(certificate.issued_at).toLocaleDateString(isHt ? 'ht-HT' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
                const verifyUrl = `https://atelnyo.site/verify?cert=${certNumber}`;
                openCertificateWindow({
                  certNumber, learnerName, courseTitle, issuedDate,
                  verifyUrl, isHt,
                });
              }}
            >
              <i className="fas fa-print" aria-hidden="true" /> {isHt ? 'Enprime Sètifika' : 'Print Certificate'}
            </button>
            <button
              type="button"
              className="ls-btn"
              onClick={() => {
                const text = [
                  `${isHt ? 'SÈTIFIKA KONPLÈT' : 'CERTIFICATE OF COMPLETION'}`,
                  `${isHt ? 'Atelnyo — Espas Aprantisaj' : 'Atelnyo — Learning Platform'}`,
                  '',
                  `${isHt ? 'Sètifye ke' : 'This certifies that'} ${certificate.learner_name || (isHt ? 'Elèv' : 'Learner')}`,
                  `${isHt ? 'te konplete' : 'completed'} ${certificate.course_title}`,
                  certificate.issued_at ? `${new Date(certificate.issued_at).toLocaleDateString(isHt ? 'ht-HT' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}` : '',
                  '',
                  `${isHt ? 'Nimewo:' : 'No.:'} ${certificate.certificate_number}`,
                  `${isHt ? 'Verifie:' : 'Verify:'} https://atelnyo.site/verify?cert=${certificate.certificate_number}`,
                  '',
                  'Atelnyo — atelnyo.site',
                ].join('\n');
                navigator.clipboard.writeText(text).then(() => {
                  showToast?.(isHt ? '✅ Sètifika kope.' : '✅ Certificate copied.', 'check-circle');
                }).catch(() => {});
              }}
            >
              <i className="fas fa-copy" aria-hidden="true" /> {isHt ? 'Kope' : 'Copy'}
            </button>
          </div>
          {/* Social share buttons */}
          <div className="ls-share-row">
            <span className="ls-share-label">
              <i className="fas fa-share-nodes" aria-hidden="true" /> {isHt ? 'Pataje:' : 'Share:'}
            </span>
            {(() => {
              const shareUrl = `https://atelnyo.site/verify?cert=${certificate.certificate_number}`;
              const shareText = isHt
                ? `Mwen fini kou "${certificate.course_title}" sou Atelnyo! 🎓`
                : `I completed "${certificate.course_title}" on Atelnyo! 🎓`;
              const shareTitle = isHt ? 'Sètifika Atelnyo' : 'Atelnyo Certificate';
              const handleNativeShare = () => {
                if (navigator.share) {
                  navigator.share({ title: shareTitle, text: shareText, url: shareUrl }).catch(() => {});
                }
              };
              return (
                <>
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Facebook"
                    className="ls-share-btn ls-share-btn--fb"
                  >
                    <i className="fab fa-facebook-f" />
                  </a>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText + ' #Atelnyo #Learning')}&url=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="X / Twitter"
                    className="ls-share-btn ls-share-btn--x"
                  >
                    <i className="fab fa-x-twitter" />
                  </a>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="LinkedIn"
                    className="ls-share-btn ls-share-btn--li"
                  >
                    <i className="fab fa-linkedin-in" />
                  </a>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="WhatsApp"
                    className="ls-share-btn ls-share-btn--wa"
                  >
                    <i className="fab fa-whatsapp" />
                  </a>
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    title={isHt ? 'Pataje' : 'Share'}
                    className="ls-share-btn ls-share-btn--native"
                  >
                    <i className="fas fa-share-nodes" />
                  </button>
                </>
              );
            })()}
          </div>
        </section>
      )}
      </>)}

      {/* ─── Similar courses (recommendation context, §30) — only in
           the non-session path: a running session stays full-focus. */}
      {similar && similar.length > 0 && (
        <section className="ls-panel">
          <h3 className="ls-panel-title"><i className="fas fa-thumbs-up" aria-hidden="true" /> {isHt ? 'Kou menm jan' : 'Similar courses'}</h3>
          <div className="ls-similar-grid">
            {similar.map((c) => (
              <CourseCard key={c.id} course={c} lang={lang} t={t} onOpen={onOpenCourse} user={user} />
            ))}
          </div>
        </section>
      )}
      </>
      )}

      {/* ─── Message instructor modal ─────────────────────── */}
      {messageOpen && (
        <div className="ls-modal-backdrop" role="presentation" onClick={() => setMessageOpen(false)}>
          <div className="ls-modal" role="dialog" aria-modal="true" aria-label={isHt ? 'Kontakte enstriktè' : 'Contact instructor'} onClick={(e) => e.stopPropagation()}>
            <h3><i className="fas fa-comment-dots" aria-hidden="true" /> {isHt ? 'Kontakte enstriktè a' : 'Contact the instructor'}</h3>
            <p className="ls-modal-hint">
              {isHt
                ? `Yon mesaj pral voye bay ${course.created_by_username || 'enstriktè a'} atravè mesaj atelnyo.`
                : `A message will be sent to ${course.created_by_username || 'the instructor'} through Atelnyo messaging.`}
            </p>
            <textarea
              className="ls-textarea"
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              rows={4}
              maxLength={4000}
              placeholder={isHt ? 'Ekri mesaj ou...' : 'Write your message...'}
              autoFocus
            />
            <div className="ls-modal-actions">
              <button type="button" className="ls-btn" onClick={() => setMessageOpen(false)} disabled={messageBusy}>
                {isHt ? 'Annile' : 'Cancel'}
              </button>
              <button type="button" className="ls-btn ls-btn--primary" onClick={sendMessage} disabled={messageBusy || !messageBody.trim()}>
                {messageBusy ? <i className="fas fa-spinner fa-pulse" aria-hidden="true" /> : <i className="fas fa-paper-plane" aria-hidden="true" />}
                {isHt ? 'Voye' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* §37 — Unlock toast notification */}
      {unlockToast && (
        <div key={unlockToast.id} className="ls-unlock-toast" role="status" aria-live="polite">
          {unlockToast.text}
        </div>
      )}

      {/* §38 — Confirmation dialog for risky actions */}
      {confirmDialog && (
        <div className="ls-confirm-backdrop" role="presentation" onClick={confirmDialog.onCancel}>
          <div className="ls-confirm-dialog" role="alertdialog" aria-modal="true" aria-label={confirmDialog.title} onClick={(e) => e.stopPropagation()}>
            <h3 className="ls-confirm-title">{confirmDialog.title}</h3>
            <p className="ls-confirm-message">{confirmDialog.message}</p>
            <div className="ls-confirm-actions">
              <button type="button" className="ls-btn" onClick={confirmDialog.onCancel}>
                {confirmDialog.cancelLabel}
              </button>
              <button
                type="button"
                className={`ls-btn ${confirmDialog.variant === 'danger' ? 'ls-btn--danger' : 'ls-btn--primary'}`}
                onClick={confirmDialog.onConfirm}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* §44 — Notification queue */}
      {notifications.length > 0 && (
        <div className="ls-notifications" aria-live="polite">
          {notifications.map((n) => (
            <div key={n.id} className={`ls-notification ls-notification--${n.type}`} role="status">
              {n.msg}
            </div>
          ))}
        </div>
      )}

      {/* §43 — Accessible screen reader announcements */}
      <div className="ls-sr-only" role="status" aria-live="assertive" aria-atomic="true">
        {srAnnouncement}
      </div>
    </LearningShell>
  );
}
