/**
 * src/components/learning/SpeechPractice.test.jsx
 *
 * The AI pronunciation coach is learner-tapped help, never automatic:
 * a missed word shows "Mande AI pou èd"; tapping it calls
 * ai/pronunciation_help/ ONCE with the missed word + what was heard,
 * then renders the coaching tip. The speech score stays the judge —
 * the AI text changes nothing about pass/fail or submission.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import SpeechPractice from './SpeechPractice';
import { aiService, speechSubmissionService } from '../../services/api';

const fakeTake = { transcript: '', confidence: 0.8 };

vi.mock('../../modules/learning/useSpeechRecognition', () => ({
  useSpeechRecognition: () => ({
    canRecognize: true,
    liveTranscript: '',
    startRecognition: vi.fn(),
    finishRecognition: vi.fn(() => ({ transcript: fakeTake.transcript, confidence: fakeTake.confidence })),
    resetRecognition: vi.fn(),
  }),
}));

vi.mock('../../modules/learning/serverTranscription', () => ({
  transcribeTakeOnServer: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('./SpeechRecorder', () => ({
  __esModule: true,
  default: ({ onStart, onRecorded }) => (
    <div>
      <button type="button" onClick={() => onStart && onStart()}>stub-start</button>
      <button
        type="button"
        onClick={() => onRecorded && onRecorded('blob:fake', { size: 5000 })}
      >
        stub-stop
      </button>
    </div>
  ),
}));

vi.mock('../../services/api', () => ({
  aiService: { pronunciationHelp: vi.fn(() => Promise.resolve({ data: { text: '' } })) },
  speechSubmissionService: { create: vi.fn(() => Promise.resolve({ data: {} })) },
}));

const REPEAT_BLOCK = { id: 'r1', type: 'repeat', mode: 'exact', targetText: 'bonjou kouman ou ye' };

const renderPractice = (block = REPEAT_BLOCK) => {
  const reportComplete = vi.fn();
  render(
    <SpeechPractice block={block} lang="ht" courseId={7} moduleIndex={0} reportComplete={reportComplete} />,
  );
  return { reportComplete };
};

const stopTakeWith = (transcript) => {
  fakeTake.transcript = transcript;
  fireEvent.click(screen.getByText('stub-start'));
  fireEvent.click(screen.getByText('stub-stop'));
};

beforeEach(() => {
  vi.clearAllMocks();
  fakeTake.transcript = '';
  fakeTake.confidence = 0.8;
});

describe('SpeechPractice AI pronunciation coach', () => {
  it('asks the coach about the missed word and renders the tip', async () => {
    aiService.pronunciationHelp.mockResolvedValueOnce({ data: { text: 'Di “bonjou” dousman: bon-jou.' } });
    renderPractice();
    // 'alo alo' matches nothing → the take FAILS (missing every word).
    stopTakeWith('alo alo');

    // Missed words → retry hint + coach button, no auto-call.
    expect(screen.getByText(/repete mo ki make yo/)).toBeInTheDocument();
    expect(aiService.pronunciationHelp).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Mande AI pou èd'));

    await waitFor(() => expect(aiService.pronunciationHelp).toHaveBeenCalledTimes(1));
    expect(aiService.pronunciationHelp.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        target_word: 'bonjou',
        target_phrase: 'bonjou kouman ou ye',
        lang: 'ht',
      }),
    );
    expect(await screen.findByText(/Di “bonjou”/)).toBeInTheDocument();
  });

  it('shows an honest error when the coach is unavailable', async () => {
    aiService.pronunciationHelp.mockRejectedValueOnce(new Error('down'));
    renderPractice();
    stopTakeWith('alo alo');
    fireEvent.click(screen.getByText('Mande AI pou èd'));

    expect(await screen.findByText(/Kouch la pa disponib/)).toBeInTheDocument();
  });

  it('offers no coach button when the take passes', () => {
    renderPractice();
    stopTakeWith('bonjou kouman ou ye');

    expect(screen.getByText('Byen pale!')).toBeInTheDocument();
    expect(screen.queryByText('Mande AI pou èd')).not.toBeInTheDocument();
    expect(aiService.pronunciationHelp).not.toHaveBeenCalled();
  });
});
