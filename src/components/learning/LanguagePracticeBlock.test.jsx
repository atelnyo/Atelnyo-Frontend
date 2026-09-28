/**
 * src/components/learning/LanguagePracticeBlock.test.jsx
 *
 * Regression tests for the SPEECH WIRING, not the analysis math (that
 * lives in src/modules/learning/__tests__/speech.test.js).
 *
 * The key contract under test: speech recognition starts the moment the
 * recording starts (onStart) and the transcript captured DURING the take
 * is what gets analyzed when the recording stops (onRecorded). Before
 * this wiring existed, recognition ran AFTER the take ended and re-listened
 * to the room — so a learner who didn't speak a second time got NO
 * feedback at all ("just speak and record").
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import LanguagePracticeBlock from './LanguagePracticeBlock';
import { speechSubmissionService } from '../../services/api';

// Fake browser recognizer — the test drives its callbacks directly.
const { fakeRecognizer } = vi.hoisted(() => ({
  fakeRecognizer: {
    supported: true,
    recognize: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
  },
}));

// Keep the REAL analyzeSpeech/exactMatch — only the browser-recognizer
// factory is faked, so the analysis is exercised end to end.
vi.mock('../../modules/learning/speech', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createSpeechRecognizer: vi.fn(() => fakeRecognizer),
  };
});

// Replace the real recorder with a stub that exposes when a take starts
// (onStart) and when it stops (onRecorded) — mirroring SpeechRecorder.
vi.mock('./SpeechRecorder', () => ({
  __esModule: true,
  default: ({ onStart, onRecorded, recordLabel }) => (
    <div>
      <button type="button" onClick={() => onStart && onStart()}>stub-start</button>
      <button type="button" onClick={() => onRecorded && onRecorded('blob:fake')}>stub-stop</button>
      <span>{recordLabel}</span>
    </div>
  ),
}));

vi.mock('../../services/api', () => ({
  speechSubmissionService: {
    create: vi.fn(() => Promise.resolve({ data: {} })),
    list: vi.fn(),
  },
}));

const REPEAT_BLOCK = {
  id: 'r1',
  type: 'repeat',
  targetText: 'bonjou kouman ou ye',
};

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * Start a take on a repeat block and return the recognizer callbacks
 * plus the onComplete spy. The caller fires onResult/onInterim to
 * simulate what the recognizer heard while the learner was speaking.
 */
const startTake = (block = REPEAT_BLOCK) => {
  const onComplete = vi.fn();
  render(<LanguagePracticeBlock block={block} lang="ht" courseId={7} moduleIndex={0} onComplete={onComplete} />);
  fireEvent.click(screen.getByText('stub-start'));
  const handlers = fakeRecognizer.recognize.mock.calls.at(-1)[0];
  return { onComplete, ...handlers };
};

describe('LanguagePracticeBlock speech wiring', () => {
  it('analyzes the transcript captured DURING the take and completes on a pass', () => {
    const { onComplete, onResult } = startTake();
    act(() => { onResult({ transcript: 'bonjou kouman ou mache', confidence: 0.9 }); });
    fireEvent.click(screen.getByText('stub-stop'));

    // 3 of 4 words well → "Byen pale!" and the block counts complete.
    expect(screen.getByText('Byen pale!')).toBeInTheDocument();
    expect(screen.getByText('3/4')).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);

    // The take is persisted with the word-level analysis for review.
    expect(speechSubmissionService.create).toHaveBeenCalledTimes(1);
    const payload = speechSubmissionService.create.mock.calls[0][0];
    expect(payload).toEqual(expect.objectContaining({
      course_id: 7,
      module_index: 0,
      block_id: 'r1',
      block_type: 'repeat',
      transcript: 'bonjou kouman ou mache',
      confidence: 0.9,
    }));
    expect(payload.analysis.passed).toBe(true);
    expect(payload.analysis.missingWords).toEqual(['ye']);
  });

  it('streams the transcript LIVE while the learner is still speaking', () => {
    const { onComplete, onInterim, onResult } = startTake();

    // Interim words appear as they are spoken — BEFORE the take stops.
    act(() => { onInterim('bonjou'); });
    expect(screen.getByText('Koute:')).toBeInTheDocument();
    expect(screen.getByText(/“bonjou”/)).toBeInTheDocument();

    // The final recognized transcript replaces the interim text live.
    act(() => { onResult({ transcript: 'bonjou kouman ou ye', confidence: 0.9 }); });
    expect(screen.getByText(/“bonjou kouman ou ye”/)).toBeInTheDocument();

    // Stopping the take replaces the live box with the analyzed feedback.
    fireEvent.click(screen.getByText('stub-stop'));
    expect(screen.getByText('Byen pale!')).toBeInTheDocument();
    expect(screen.queryByText('Koute:')).not.toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('shows a retry hint when the take did not pass — and completes after a fresh take', () => {
    const { onComplete, onResult } = startTake();
    // First take: only "bonjou" heard → 1/4 = 0.25 → fail.
    act(() => { onResult({ transcript: 'bonjou wi', confidence: 0.8 }); });
    fireEvent.click(screen.getByText('stub-stop'));

    expect(screen.getByText('Preske — repete mo ki make yo ankò.')).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();

    // Retry: start a NEW take — the old feedback must be cleared and the
    // new take analyzed on its own.
    fireEvent.click(screen.getByText('stub-start'));
    const retryHandlers = fakeRecognizer.recognize.mock.calls.at(-1)[0];
    act(() => { retryHandlers.onResult({ transcript: 'bonjou kouman ou ye', confidence: 0.95 }); });
    fireEvent.click(screen.getByText('stub-stop'));

    expect(screen.getByText('Byen pale!')).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('reports honestly when the recognizer heard nothing during the take', () => {
    const { onComplete } = startTake();
    // No onResult/onInterim fired — the recognizer heard nothing.
    fireEvent.click(screen.getByText('stub-stop'));

    expect(screen.getByText('Nou pa tande w — eseye ankò.')).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
    expect(speechSubmissionService.create).not.toHaveBeenCalled();
  });
});
