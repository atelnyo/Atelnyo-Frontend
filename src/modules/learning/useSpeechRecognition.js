/**
 * src/modules/learning/useSpeechRecognition.js
 *
 * Shared hook that owns the browser-speech-recognition lifecycle for
 * language-practice blocks. Both the practice block (repeat /
 * pronunciation / speaking) and the conversation practice use it — this
 * is the single home of the "recognition runs WHILE the learner
 * records" wiring:
 *
 *   • startRecognition() — call when a take STARTS (recorder onStart):
 *     resets the previous take's state and starts the recognizer,
 *     streaming what it hears into liveTranscript in real time.
 *   • finishRecognition() — call when the take STOPS (recorder
 *     onRecorded): aborts the recognizer and returns the transcript /
 *     confidence captured DURING the take — plus a pending hard
 *     recognition error message when one occurred, so the caller can
 *     surface it instead of the analysis.
 *   • resetRecognition() — discard the previous take's recognition
 *     state (the retry path).
 *
 * Honesty rules from modules/learning/speech.js still apply: this hook
 * never scores — it only captures what the recognizer heard. The
 * caller decides what to do with the transcript.
 */
import { useMemo, useRef, useState, useCallback } from 'react';
import { createSpeechRecognizer } from './speech';

/**
 * @param {string} recognitionLang  BCP-47 tag for the recognizer.
 * @param {{ translateError?: (err: string) => string }} [opts]
 *        translateError maps a hard recognition error code ('not-allowed',
 *        'audio-capture', …) to a human message. Return '' to ignore it.
 */
export function useSpeechRecognition(recognitionLang = 'en-US', { translateError } = {}) {
  const recognition = useMemo(() => createSpeechRecognizer(recognitionLang), [recognitionLang]);
  const canRecognize = Boolean(recognition);

  // Transcript/confidence captured during the CURRENT take — refs so
  // live results never trigger re-renders mid-speech.
  const latestTranscriptRef = useRef('');
  const latestConfidenceRef = useRef(0);
  // A hard recognition error (mic blocked, recognizer failure) that
  // should replace the analysis when the take stops.
  const pendingErrorRef = useRef('');
  const [liveTranscript, setLiveTranscript] = useState('');

  const startRecognition = useCallback(() => {
    latestTranscriptRef.current = '';
    latestConfidenceRef.current = 0;
    pendingErrorRef.current = '';
    setLiveTranscript('');
    if (!canRecognize) return;
    recognition.recognize({
      onInterim: (interim) => {
        setLiveTranscript(interim);
        latestTranscriptRef.current = interim;
      },
      onResult: ({ transcript, confidence }) => {
        setLiveTranscript(transcript);
        latestTranscriptRef.current = transcript;
        latestConfidenceRef.current = confidence;
      },
      onError: (err) => {
        // 'no-speech' / 'aborted' are normal ends of a take — never
        // surface them as errors (the caller shows its own "didn't
        // hear you" message when the transcript is empty).
        if (err !== 'no-speech' && err !== 'aborted') {
          pendingErrorRef.current = translateError?.(err) || '';
        }
      },
    });
  }, [recognition, canRecognize, translateError]);

  const finishRecognition = useCallback(() => {
    const result = {
      transcript: latestTranscriptRef.current,
      confidence: latestConfidenceRef.current,
      error: pendingErrorRef.current,
    };
    pendingErrorRef.current = '';
    recognition?.abort?.(); // take is done — stop listening
    return result;
  }, [recognition]);

  const resetRecognition = useCallback(() => {
    latestTranscriptRef.current = '';
    latestConfidenceRef.current = 0;
    pendingErrorRef.current = '';
    setLiveTranscript('');
    recognition?.abort?.();
  }, [recognition]);

  return {
    canRecognize,
    liveTranscript,
    startRecognition,
    finishRecognition,
    resetRecognition,
  };
}
