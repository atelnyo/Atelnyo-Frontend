/**
 * src/components/CourseDetail.test.jsx
 *
 * The public course page has exactly three access states, and they were
 * conflated in production: /access/ returns has_access=true for the
 * creator (and for staff) WITHOUT any enrollment, and the page used to
 * treat that flag as "enrolled" — showing 0% module progress, "you have
 * access" and an Enter button to someone who never enrolled.
 *
 * These tests pin the three states:
 *   1. visitor who is NOT enrolled  → locked modules, enroll CTA
 *   2. learner who IS enrolled      → unlocked modules, Enter CTA
 *   3. creator of the course        → no enrollment box, "manage" CTA
 * plus the enrollment → enrolled transition that must happen without a
 * reload.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { HelmetProvider } from 'react-helmet-async';
import CourseDetail from './CourseDetail';

vi.mock('../services/api', () => ({
  courseService: {
    getSEO: vi.fn(() => Promise.resolve({ data: null })),
  },
  progressService: {
    getAll: vi.fn(() => Promise.resolve({ data: { results: [] } })),
    create: vi.fn(() => Promise.resolve({ data: { id: 1 } })),
    recordPosition: vi.fn(() => Promise.resolve({ data: {} })),
    completeBlock: vi.fn(() => Promise.resolve({ data: {} })),
  },
  courseCheckoutService: {
    access: vi.fn(),
    checkout: vi.fn(),
  },
  courseFaqService: {
    public: vi.fn(() => Promise.resolve({ data: [] })),
  },
  savedItemService: {
    count: vi.fn(() => Promise.resolve(0)),
    isSaved: vi.fn(() => Promise.resolve(false)),
    create: vi.fn(() => Promise.resolve({ data: {} })),
    remove: vi.fn(() => Promise.resolve({ data: {} })),
  },
  // Imported by the (collapsed, never mounted here) practice blocks.
  quizService: { list: vi.fn(() => Promise.resolve({ data: [] })) },
  quizAttemptService: { submit: vi.fn() },
  speechSubmissionService: { create: vi.fn(), list: vi.fn() },
}));

import {
  courseService,
  courseCheckoutService,
  progressService,
  savedItemService,
  courseFaqService,
} from '../services/api';

const CREATOR_ID = 9;

const COURSE = {
  id: 42,
  slug: 'kou-test',
  title: 'Kou Tès',
  description: 'Yon kou pou tès la.',
  price: 0,
  status: 'published',
  difficulty: 'beginner',
  created_by: CREATOR_ID,
  created_by_username: 'kreyate',
  syllabus: [
    {
      title: 'Modil 1',
      description: 'Premye modil la.',
      blocks: [{ id: 'b1', type: 'text', content: 'Yon blòk.' }],
    },
    { title: 'Modil 2', description: 'Dezyèm modil la.', blocks: [] },
  ],
};

const OTHER_USER = { id: 2, username: 'vizitè' };
const CREATOR_USER = { id: CREATOR_ID, username: 'kreyate' };

function renderPage({ user = OTHER_USER, onEnterLearning = vi.fn() } = {}) {
  render(
    <HelmetProvider>
      <CourseDetail
        course={COURSE}
        lang="ht"
        translations={{ ht: {} }}
        user={user}
        onBack={vi.fn()}
        showToast={vi.fn()}
        onOpenCheckout={vi.fn()}
        onEnterLearning={onEnterLearning}
        onAuthOpen={vi.fn()}
      />
    </HelmetProvider>,
  );
  return { onEnterLearning };
}

beforeEach(() => {
  vi.clearAllMocks();
  courseService.getSEO.mockResolvedValue({ data: null });
  progressService.getAll.mockResolvedValue({ data: { results: [] } });
  savedItemService.count.mockResolvedValue(0);
  savedItemService.isSaved.mockResolvedValue(false);
  courseFaqService.public.mockResolvedValue({ data: [] });
});

describe('access state: visitor who is not enrolled', () => {
  beforeEach(() => {
    courseCheckoutService.access.mockResolvedValue({
      data: { has_access: false, entitled: false, source: null },
    });
  });

  it('shows the enroll CTA, never learner UI', async () => {
    renderPage();

    expect(await screen.findByText('Enskri nan kou sa a — Gratis')).toBeInTheDocument();
    expect(screen.getByText(/Jwenn aksè konplè imedyatman apre enskripsyon\./)).toBeInTheDocument();

    // The two claims that must NOT appear before enrolling.
    expect(screen.queryByText(/Ou gen aksè sou kou a\./)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ou enskri nan kou sa a/)).not.toBeInTheDocument();
    expect(screen.queryByText('Antre nan Espas Aprantisaj')).not.toBeInTheDocument();
  });

  it('locks every module: no percentage, no expansion', async () => {
    renderPage();
    await waitFor(() => expect(courseCheckoutService.access).toHaveBeenCalled());

    // One lock per module, and no progress percentage anywhere.
    expect(screen.getAllByTestId('cd-module-lock')).toHaveLength(COURSE.syllabus.length);
    expect(screen.queryByText('0%')).not.toBeInTheDocument();

    // Clicking a locked module must not open its body.
    fireEvent.click(screen.getByText('Modil 1'));
    expect(screen.queryByText('Premye modil la.')).not.toBeInTheDocument();
  });
});

describe('access state: learner who is enrolled', () => {
  beforeEach(() => {
    courseCheckoutService.access.mockResolvedValue({
      data: { has_access: true, entitled: true, source: 'free' },
    });
  });

  it('shows the enrolled copy, unlocks modules and enters the space', async () => {
    const { onEnterLearning } = renderPage();

    expect(await screen.findByText(/Ou enskri nan kou sa a\. Ou gen aksè konplè\./)).toBeInTheDocument();
    expect(screen.queryByTestId('cd-module-lock')).not.toBeInTheDocument();
    // Progress starts at 0% for a fresh learner — shown, but only now.
    expect(screen.getAllByText('0%').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText('Modil 1'));
    expect(await screen.findByText('Premye modil la.')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Antre nan Espas Aprantisaj'));
    expect(onEnterLearning).toHaveBeenCalledWith(COURSE);
  });
});

describe('access state: creator of the course', () => {
  beforeEach(() => {
    // Backend grants access to the creator without any enrollment.
    courseCheckoutService.access.mockResolvedValue({
      data: { has_access: true, entitled: false, source: 'creator' },
    });
  });

  it('hides the enrollment box and offers managing instead', async () => {
    renderPage({ user: CREATOR_USER });
    await waitFor(() => expect(courseCheckoutService.access).toHaveBeenCalled());

    const manage = await screen.findByTestId('cd-manage-course');
    expect(manage).toHaveTextContent('Jere kou a');
    expect(manage).toHaveAttribute('href', '/sheet/studio');

    // No enrollment UI at all, and no learner-progress claim.
    expect(screen.queryByText(/Enskri nan kou sa a/)).not.toBeInTheDocument();
    expect(screen.queryByText('Antre nan Espas Aprantisaj')).not.toBeInTheDocument();
    expect(screen.queryByText(/Ou gen aksè sou kou a\./)).not.toBeInTheDocument();
    expect(screen.queryByTestId('cd-module-lock')).not.toBeInTheDocument();
  });
});

describe('enrollment transition', () => {
  it('switches to the enrolled state without a reload', async () => {
    courseCheckoutService.access.mockResolvedValue({
      data: { has_access: false, entitled: false, source: null },
    });
    courseCheckoutService.checkout.mockResolvedValue({
      data: { has_access: true, order_id: null, final_price: '0.00' },
    });

    renderPage();

    fireEvent.click(await screen.findByText('Enskri nan kou sa a — Gratis'));

    expect(await screen.findByText(/Ou enskri nan kou sa a\. Ou gen aksè konplè\./)).toBeInTheDocument();
    expect(courseCheckoutService.checkout).toHaveBeenCalledWith(COURSE.id, '');
    expect(screen.queryByTestId('cd-module-lock')).not.toBeInTheDocument();
  });
});
