/**
 * src/components/learning/ConversationPractice.jsx
 *
 * ConversationPractice — scripted, step-by-step conversation.
 *
 * The creator defines the SCENARIO + ordered STEPS (speaker + prompt,
 * optional reference audio per step). The learner progresses step by
 * step, responding freely (open speech — never exact-matched). No AI
 * engine here: this is the structured, honest v1 — the conversation
 * data the editor stores is exactly what plays back.
 *
 * Recognition runs WHILE the learner records (useSpeechRecognition);
 * the transcript captured during the take is what gets shown + saved.
 */
import React, { useState, useCallback, useRef } from 'react';
import { useSpeechRecognition } from '../../modules/learning/useSpeechRecognition';
import { transcribeTakeOnServer } from '../../modules/learning/serverTranscription';
import { speechSubmissionService } from '../../services/api';
import AudioPlayer from './AudioPlayer';
import SpeechRecorder from './SpeechRecorder';
import styles from './learning.module.css';

export default function ConversationPractice({ block, lang = 'ht', courseId, moduleIndex, reportComplete }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);
  const steps = Array.isArray(block.steps) ? block.steps : [];
  const [current, setCurrent] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [responses, setResponses] = useState([]);
  const [serverWorking, setServerWorking] = useState(false);
  const completedRef = useRef(false);
  const {
    canRecognize,
    liveTranscript,
    startRecognition,
    finishRecognition,
    resetRecognition,
  } = useSpeechRecognition(block.recognitionLang || 'en-US', { translateError: () => '' });
  const step = steps[current];

  const handleRecStart = useCallback(() => {
    setFeedback(null);
    setServerWorking(false);
    startRecognition();
  }, [startRecognition]);

  const handleRecorded = useCallback(async (url, blob) => {
    setRecordingUrl(url);
    if (!url) {
      // Retry — discard the previous take's recognition state.
      resetRecognition();
      setFeedback(null);
      setServerWorking(false);
      return;
    }
    const { transcript, confidence, error } = finishRecognition();
    if (error) {
      setFeedback({ error, kind: 'error' });
      return;
    }
    if (!canRecognize) return;
    let finalTranscript = transcript;
    let finalConfidence = confidence;
    let source = 'browser';
    if (!finalTranscript) {
      const hasAudio = blob && typeof blob.size === 'number' ? blob.size > 800 : false;
      if (!hasAudio) {
        setFeedback({ error: t("We didn't hear you — try again.", 'Nou pa tande w — eseye ankò.'), kind: 'error' });
        return;
      }
      if (courseId) {
        setServerWorking(true);
        const server = await transcribeTakeOnServer({ courseId, blob });
        setServerWorking(false);
        if (server) {
          finalTranscript = server.transcript;
          finalConfidence = null;
          source = 'server';
        }
      }
      if (!finalTranscript) {
        setFeedback({
          error: t(
            'Recording saved, but recognition could not catch the words — listen to your playback, speak louder and clearer, then try again.',
            'Anrejistreman an sove, men rekonesans lan pa t kenbe pawòl yo — koute anrejistreman w la, pale pi fò epi pi klè, epi eseye ankò.',
          ),
          kind: 'error',
        });
        return;
      }
    }
    setFeedback({ transcript: finalTranscript, confidence: finalConfidence, kind: 'open', source });
    if (courseId && finalTranscript) {
      speechSubmissionService.create({
        course_id: courseId,
        module_index: Number(moduleIndex) || 0,
        block_id: block.id || '',
        block_type: 'conversation',
        transcript: finalTranscript,
        confidence: typeof finalConfidence === 'number' ? finalConfidence : 0,
        // Open conversation: no target phrase, but the engine label
        // still matters honestly in creator review.
        ...(source === 'browser' || source === 'server' ? { transcript_source: source } : {}),
      }).catch(() => {});
    }
    // Final step answered = conversation completed (progress).
    if (current >= steps.length - 1 && !completedRef.current) {
      completedRef.current = true;
      reportComplete?.();
    }
  }, [canRecognize, courseId, moduleIndex, block.id, current, steps.length, reportComplete, resetRecognition, finishRecognition, t]);

  if (steps.length === 0) {
    return (
      <div className={styles.practiceBlockEmpty}>
        {t('This conversation has no steps yet.', 'Konvèsasyon sa a pa gen etap ankò.')}
      </div>
    );
  }

  const nextStep = () => {
    if (feedback?.transcript) setResponses((r) => [...r, feedback.transcript]);
    setFeedback(null);
    setRecordingUrl(null);
    setCurrent((c) => Math.min(c + 1, steps.length - 1));
  };

  return (
    <>
      {block.scenario && (
        <p className={styles.practiceScenario}>
          <i className="fas fa-map-pin" aria-hidden="true" /> {block.scenario}
        </p>
      )}
      <div className={styles.conversationProgress}>
        {steps.map((_, i) => (
          <span
            key={i}
            className={`${styles.conversationDot} ${i === current ? styles.conversationDotActive : ''} ${i < current ? styles.conversationDotDone : ''}`}
            aria-hidden="true"
          />
        ))}
      </div>

      <div className={styles.conversationStep}>
        <span className={styles.conversationSpeaker}>
          <i className="fas fa-user" aria-hidden="true" /> {step.speaker || t('Speaker', 'Moun k ap pale')}
        </span>
        <p className={styles.conversationPrompt}>{step.prompt}</p>
        {step.audio && <AudioPlayer src={step.audio} label={t('Audio', 'Odyo')} lang={lang} />}
      </div>

      <div className={styles.practiceSpeak}>
        <SpeechRecorder lang={lang} onRecorded={handleRecorded} onStart={handleRecStart} recordLabel={t('Tap to respond', 'Tape pou reponn')} />
        {!recordingUrl && liveTranscript && (
          <div className={styles.practiceLiveTranscript} role="status" aria-live="polite">
            <span className={styles.practiceLiveTranscriptDot} aria-hidden="true" />
            <p className={styles.practiceTranscript}>
              <strong>{t('Hearing:', 'Koute:')}</strong> “{liveTranscript}”
            </p>
          </div>
        )}
        {serverWorking && (
          <div className={styles.practiceLiveTranscript} role="status" aria-live="polite">
            <span className={styles.practiceLiveTranscriptDot} aria-hidden="true" />
            <p className={styles.practiceTranscript}>
              <i className="fas fa-spinner fa-spin" aria-hidden="true" />{' '}
              {t('Listening with the Creole model…', 'Ap koute ak modèl Kreyòl la…')}
            </p>
          </div>
        )}
        {feedback && !serverWorking && (
          <div className={styles.practiceFeedback} role="status">
            {feedback.transcript && (
              <p className={styles.practiceTranscript}>
                <strong>{t('Recognized:', 'Rekonèt:')}</strong> “{feedback.transcript}”
                {feedback.source === 'server' && (
                  <span className={styles.practiceSourceBadge}>
                    <i className="fas fa-server" aria-hidden="true" /> {t('Creole model', 'Modèl Kreyòl')}
                  </span>
                )}
              </p>
            )}
            {feedback.confidence != null && (
              <p className={styles.practiceConfidence}>
                {t('Recognition confidence', 'Konfyans rekonesans')}: <strong>{Math.round(feedback.confidence * 100)}%</strong>
              </p>
            )}
          </div>
        )}
        {current < steps.length - 1 ? (
          <button type="button" className={styles.practiceBtn} onClick={nextStep} disabled={!recordingUrl}>
            {t('Next step', 'Pwochen etap')} <i className="fas fa-arrow-right" aria-hidden="true" />
          </button>
        ) : (
          feedback?.transcript && (
            <div className={styles.practiceMatched}>
              <i className="fas fa-flag-checkered" aria-hidden="true" />
              {t('Conversation complete. Great practice!', 'Konvèsasyon an fini. Bèl pratik!')}
            </div>
          )
        )}
      </div>
    </>
  );
}
