/**
 * Render smoke test for the Learning Space (src/components/learning/LearningSpace.jsx).
 *
 * The LearnerRouteErrorBoundary exists because a render crash in the
 * learning routes used to surface as a black screen. This test renders
 * the REAL component (curriculum view + an open module session) with
 * realistic API data so a render regression fails loudly instead of
 * showing the user the "Yon erè rive lè w ap chaje espas aprantisaj la"
 * boundary.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import LearningSpace from './LearningSpace';

vi.mock('../../services/api', () => ({
  courseService: {
    getById: vi.fn(),
    getAll: vi.fn(),
    certificate: vi.fn(),
    messageInstructor: vi.fn(),
  },
  courseCheckoutService: { access: vi.fn() },
  progressService: {
    getAll: vi.fn(),
    create: vi.fn(),
    recordPosition: vi.fn(() => Promise.resolve({ data: {} })),
    completeBlock: vi.fn(() => Promise.resolve({ data: {} })),
  },
  courseSupportService: {
    announcements: vi.fn(),
    resources: vi.fn(),
    notes: vi.fn(),
    saveNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
  },
  masteryService: { overview: vi.fn() },
  gamificationService: { stats: vi.fn(), refillHearts: vi.fn(), updateGoal: vi.fn() },
  quizService: { list: vi.fn() },
  quizAttemptService: { submit: vi.fn() },
  speechSubmissionService: { create: vi.fn(), list: vi.fn() },
}));

vi.mock('../../services/offlineCourse', () => ({
  stageCourse: vi.fn(),
  getCachedCourse: vi.fn(() => Promise.resolve(null)),
  stageQuizzes: vi.fn(),
  enqueueProgress: vi.fn(),
}));

// §16, §38 — Mock learningSessionStore (async draftStore-backed)
// Tests pre-populate session state via a simple in-memory map so
// the async draftStore path is exercised without real IndexedDB.
const _sessionStore = new Map();
vi.mock('../../services/learningSessionStore', () => ({
  saveSessionState: vi.fn((_id, state) => {
    _sessionStore.set(String(_id), { data: state, updatedAt: Date.now() });
    return Promise.resolve({ ok: true });
  }),
  loadSessionState: vi.fn((id) => {
    const entry = _sessionStore.get(String(id));
    if (!entry) return Promise.resolve({ ok: true, state: null });
    // §16 — Mimic real store expiry: 7 days
    if (Date.now() - (entry.data?.savedAt || 0) > 7 * 86400000) {
      _sessionStore.delete(String(id));
      return Promise.resolve({ ok: true, state: null });
    }
    return Promise.resolve({ ok: true, state: entry.data });
  }),
  clearSessionState: vi.fn(async (id) => {
    _sessionStore.delete(String(id));
  }),
  clearAllSessionStates: vi.fn(() => { _sessionStore.clear(); return Promise.resolve(); }),
}));
// Import mocked functions for assertions
const { clearSessionState: mockClearSession } = await import('../../services/learningSessionStore');

// Silence the WebAudio celebration helpers (jsdom has no AudioContext).
vi.mock('../../utils/celebrate', () => ({
  playChime: vi.fn(),
  burstConfetti: vi.fn(),
}));

import {
  courseService,
  courseCheckoutService,
  progressService,
  courseSupportService,
  masteryService,
  gamificationService,
  quizService,
} from '../../services/api';

const COURSE = {
  id: 7,
  title: 'Kreyòl 101',
  description: 'Test course',
  price: 0,
  status: 'published',
  difficulty: 'beginner',
  learner_language: 'Haitian Creole',
  teaching_language: 'English',
  created_by: 1,
  created_by_username: 'owner',
  syllabus: [
    {
      title: 'Modil 1',
      blocks: [
        { id: 'r1', type: 'repeat', targetText: 'Bonjou', title: 'Repeat' },
        { id: 'v1', type: 'vocabulary', targetText: 'Mèsi', title: 'Vocab' },
        { id: 's1', type: 'speaking', targetText: 'Pale lib', title: 'Speaking' },
      ],
    },
    {
      title: 'Modil 2',
      blocks: [
        { id: 't1', type: 'text', content: 'Yon paragraf lekti.', title: 'Reading' },
        { id: 'v2', type: 'video', videoUrl: 'https://www.youtube.com/watch?v=abc123', title: 'Video' },
      ],
    },
  ],
};

const USER = { id: 2, username: 'elèv' };

beforeEach(() => {
  vi.clearAllMocks();
  courseService.getById.mockResolvedValue({ data: COURSE });
  courseCheckoutService.access.mockResolvedValue({ data: { has_access: true } });
  progressService.getAll.mockResolvedValue({
    data: {
      results: [{
        id: 1, course: 7, percentage: 20,
        last_module_index: 0, resume_module_index: 0,
        completed_blocks: {}, completed_modules: [],
      }],
    },
  });
  masteryService.overview.mockResolvedValue({ data: [] });
  courseSupportService.announcements.mockResolvedValue({ data: [] });
  courseSupportService.resources.mockResolvedValue({ data: [] });
  courseSupportService.notes.mockResolvedValue({ data: [] });
  courseService.getAll.mockResolvedValue({ data: { results: [] } });
  courseService.certificate.mockRejectedValue({ response: { status: 404 } });
  gamificationService.stats.mockResolvedValue({
    data: { xp: 120, level: 2, daily_streak: 3, hearts: 5, hearts_max: 5, daily_xp: 30, daily_goal: 20, level_progress_pct: 40 },
  });
  quizService.list.mockResolvedValue({ data: [] });
});

describe('Session persistence', () => {
  beforeEach(() => {
    // §16 — Clear async session store between tests
    _sessionStore.clear();
  });

  it('restores sessionModule from draftStore on mount', async () => {
    // §16 — Simulate a previous session where the learner was on module 1
    _sessionStore.set('7', { data: { sessionModule: 1, savedAt: Date.now() }, updatedAt: Date.now() });

    render(
      <LearningSpace
        courseId={7}
        lang="ht"
        translations={{ ht: {} }}
        user={USER}
        onBack={vi.fn()}
        onOpenCourse={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    // Module 2 (index 1) should auto-open without clicking anything
    await waitFor(() => expect(screen.getByTestId('module-session')).toBeInTheDocument());
    expect(screen.getByText('Modil 2')).toBeInTheDocument();
  });

  it('does NOT restore when ?module=N is provided (explicit takes precedence)', async () => {
    // §16 — Persist module 1, but pass initialModule=0
    _sessionStore.set('7', { data: { sessionModule: 1, savedAt: Date.now() }, updatedAt: Date.now() });

    render(
      <LearningSpace
        courseId={7}
        lang="ht"
        translations={{ ht: {} }}
        user={USER}
        initialModule={0}
        onBack={vi.fn()}
        onOpenCourse={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('module-session')).toBeInTheDocument());
    // Should open module 0 (initialModule), not module 1 (persisted)
    expect(screen.getByText('Modil 1')).toBeInTheDocument();
  });

  it('does NOT restore expired sessions (older than 7 days)', async () => {
    // §16 — Drafts expire after 7 days (longer than old 24h)
    _sessionStore.set('7', { data: { sessionModule: 1, savedAt: Date.now() - 7 * 86400001 }, updatedAt: Date.now() - 7 * 86400001 });

    render(
      <LearningSpace
        courseId={7}
        lang="ht"
        translations={{ ht: {} }}
        user={USER}
        onBack={vi.fn()}
        onOpenCourse={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    // Course loads but no session should auto-open (expired)
    await waitFor(() => expect(screen.getAllByText('Kreyòl 101').length).toBeGreaterThan(0));
    expect(screen.queryByTestId('module-session')).not.toBeInTheDocument();
  });

  it('does NOT restore sessions for modules with no blocks', async () => {
    const legacyCourse = {
      ...COURSE,
      syllabus: [
        { title: 'Empty Module', blocks: [] },
        { title: 'Real Module', blocks: [{ id: 'b1', type: 'text', content: 'Hi' }] },
      ],
    };
    courseService.getById.mockResolvedValue({ data: legacyCourse });
    // §16 — Persist module 0 (empty)
    _sessionStore.set('7', { data: { sessionModule: 0, savedAt: Date.now() }, updatedAt: Date.now() });

    render(
      <LearningSpace
        courseId={7}
        lang="ht"
        translations={{ ht: {} }}
        user={USER}
        onBack={vi.fn()}
        onOpenCourse={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getAllByText('Kreyòl 101').length).toBeGreaterThan(0));
    // Empty module should NOT be restored
    expect(screen.queryByTestId('module-session')).not.toBeInTheDocument();
  });

  it('saves sessionModule to localStorage when a module is opened', async () => {
    render(
      <LearningSpace
        courseId={7}
        lang="ht"
        translations={{ ht: {} }}
        user={USER}
        initialModule={1}
        onBack={vi.fn()}
        onOpenCourse={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('module-session')).toBeInTheDocument());
    // §3 — Wait for the async save effect to flush
    await waitFor(() => {
      const entry = _sessionStore.get('7');
      expect(entry).toBeDefined();
      expect(entry.data.sessionModule).toBe(1);
    });
  });

  it('clears session state when learner exits the session', async () => {
    const onBack = vi.fn();
    render(
      <LearningSpace
        courseId={7}
        lang="ht"
        translations={{ ht: {} }}
        user={USER}
        initialModule={0}
        onBack={onBack}
        onOpenCourse={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('module-session')).toBeInTheDocument());
    // §3 — Session is open — draftStore should have data
    expect(_sessionStore.has('7')).toBeTruthy();
    // Click the exit button (back arrow in session header)
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Soti nan sesyon an'));
    });
    // §37 — After exit, clearSessionState should have been called for this course
    const { clearSessionState } = await import('../../services/learningSessionStore');
    await waitFor(() => {
      expect(clearSessionState).toHaveBeenCalledWith(7);
    });
  });
});

describe('LearningSpace render smoke', () => {
  it('renders the curriculum without crashing', async () => {
    render(
      <LearningSpace
        courseId={7}
        lang="ht"
        translations={{ ht: {} }}
        user={USER}
        onBack={vi.fn()}
        onOpenCourse={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    // The curriculum title appears once the course payload lands.
    // (It renders twice — the header strong + the hero h1.)
    expect((await screen.findAllByText('Kreyòl 101')).length).toBeGreaterThan(0);
    // Every block type in the syllabus renders without throwing.
    expect(screen.getAllByText('Modil 1').length).toBeGreaterThan(0);
  });

  it('renders an open module step session (blocks + quiz) without crashing', async () => {
    render(
      <LearningSpace
        courseId={7}
        lang="ht"
        translations={{ ht: {} }}
        user={USER}
        initialModule={0}
        onBack={vi.fn()}
        onOpenCourse={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('module-session')).toBeInTheDocument());
    // The session header shows the module title and step counter.
    expect(screen.getByText('Modil 1')).toBeInTheDocument();
    expect(screen.getByText('Etap 1 sou 3')).toBeInTheDocument();
  });

  it('handles legacy course with empty modules gracefully', async () => {
    // A legacy course might have modules with no blocks array or empty blocks.
    const legacyCourse = {
      ...COURSE,
      syllabus: [
        { title: 'Empty Module', blocks: [] },
        {
          title: 'Real Module',
          blocks: [
            { id: 'b1', type: 'text', content: 'Hello', title: 'Reading' },
          ],
        },
      ],
    };
    courseService.getById.mockResolvedValue({ data: legacyCourse });

    render(
      <LearningSpace
        courseId={7}
        lang="ht"
        translations={{ ht: {} }}
        user={USER}
        onBack={vi.fn()}
        onOpenCourse={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    // Course loads without crashing — the curriculum renders both modules.
    await waitFor(() => expect(screen.getAllByText('Real Module').length).toBeGreaterThan(0));
  });
});
