/**
 * ModuleSession — step placement regression.
 *
 * The step space settles late: `quizzesLoaded` only flips once the quiz
 * list call resolves. A video/embed step marks itself done the moment it
 * appears, so the auto-placement effect used to fire *after* the learner
 * was already on that step and jump them past it — the video flashed and
 * the next step (a text block waiting for "I finished reading") looked
 * like a dead Continue button.
 *
 * These tests pin the rule: automatic placement only happens before the
 * learner moves. It must never yank them forward or back afterwards.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const listDeferred = { resolve: null };
vi.mock('../../services/api', () => ({
  quizService: {
    list: vi.fn(() => new Promise((resolve) => { listDeferred.resolve = resolve; })),
  },
  quizAttemptService: {
    submit: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

vi.mock('../../services/learningDraftManager', () => ({
  saveDraft: vi.fn(),
  restoreDraft: vi.fn(() => Promise.resolve(null)),
  removeDraft: vi.fn(),
}));

import ModuleSession from './ModuleSession';

const blocks = [
  { id: 'img-1', type: 'image', title: 'Imaj', imageUrl: 'https://example.com/a.png' },
  { id: 'emb-1', type: 'embed', title: 'Videyo', embedUrl: 'https://www.youtube.com/watch?v=_r0VX-aU_T8' },
  { id: 'txt-1', type: 'text', title: 'Tèks', content: 'Yon paragraf.' },
];

function renderSession(overrides = {}) {
  return render(
    <ModuleSession
      courseId={120002}
      moduleIndex={0}
      item={{ title: 'Modil', blocks }}
      lang="ht"
      progress={{ id: 1 }}
      completedBlocksMap={{}}
      completedModules={[]}
      onComplete={vi.fn()}
      onViewed={vi.fn()}
      onExit={vi.fn()}
      onQuizzesLoaded={vi.fn()}
      {...overrides}
    />,
  );
}

const stepLabel = () => document.querySelector('.ls-session-head-title span')?.textContent || '';
const continueBtn = () => document.querySelector('.ls-session-continue');

beforeEach(() => {
  listDeferred.resolve = null;
});

describe('ModuleSession step placement', () => {
  it('keeps the learner on the video step when the quiz list resolves late', async () => {
    renderSession();

    // Browser finishes loading the first (image) block.
    fireEvent.load(document.querySelector('.ls-block-image img'));
    await waitFor(() => expect(continueBtn()).not.toBeDisabled());
    expect(stepLabel()).toContain('Etap 1');

    // Learner moves to the video step.
    fireEvent.click(continueBtn());
    await waitFor(() => expect(stepLabel()).toContain('Etap 2'));
    expect(document.querySelector('.ls-block--embed')).toBeInTheDocument();

    // Now the quiz list finally arrives — the step space settles.
    listDeferred.resolve({ data: { results: [] } });
    await new Promise((r) => setTimeout(r, 60));

    expect(stepLabel()).toContain('Etap 2');
    expect(document.querySelector('.ls-block--embed')).toBeInTheDocument();
    // Navigation lock releases a moment after the transition.
    await waitFor(() => expect(continueBtn()).not.toBeDisabled());

    // And Continue still walks forward normally.
    fireEvent.click(continueBtn());
    await waitFor(() => expect(stepLabel()).toContain('Etap 3'));
  });
});
