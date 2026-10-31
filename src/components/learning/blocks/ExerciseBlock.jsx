/**
 * src/components/learning/blocks/ExerciseBlock.jsx (v2 — UX + speech)
 *
 * Interactive exercise block. Supports: short text, long text, multiple
 * choice, checklist, number — plus SPEAKING (oral answer with real
 * microphone recording + speech recognition when available).
 *
 * Why speaking lives here too:
 *   Creators often set an exercise whose instructions say "pale / speak"
 *   but the old block only rendered a textarea — the learner saw a
 *   "speak" prompt with nowhere to speak. Now `answerType: 'speaking'`
 *   (or 'audio_record') renders the real SpeechRecorder + optional
 *   recognition, so the prompt and the input always match.
 *
 * Contract: { block, lang, courseId, moduleIndex, onComplete,
 *   onPortfolioSave, registerBlock }
 * Block shape: { id, title, instructions/content, answerType,
 *   options[], items[], recognitionLang/targetLang, portfolioSection }
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useCompletionContract, { COMPLETION_MODE, BLOCK_REQUIREMENT } from '../../../hooks/useCompletionContract';
import useAutosave from '../../../hooks/useAutosave';
import useBlockSaveContract from '../../../hooks/useBlockSaveContract';
import { useSpeechRecognition } from '../../../modules/learning/useSpeechRecognition';
import SpeechRecorder from '../SpeechRecorder';
import styles from '../learning.module.css';

/**
 * Resolve the BCP-47 tag for speech recognition.
 * Priority: block.recognitionLang > block.targetLang > course lang prop.
 * Haitian Creole (ht) has no Web Speech support — fall back to fr-FR
 * (closest acoustic model) and flag it so the UI can say so honestly.
 */
export function resolveRecognitionLang(block, lang) {
  const raw = (block?.recognitionLang || block?.targetLang || '').trim();
  if (raw) return { tag: raw, fallback: false };
  if (lang === 'ht') return { tag: 'fr-FR', fallback: true };
  if (lang === 'fr') return { tag: 'fr-FR', fallback: false };
  if (lang === 'es') return { tag: 'es-ES', fallback: false };
  return { tag: 'en-US', fallback: false };
}

export default function ExerciseBlock({ block, lang = 'ht', courseId, moduleIndex, onComplete, onPortfolioSave, registerBlock }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);
  const { markComplete } = useCompletionContract({
    blockId: block?.id,
    blockType: 'exercise',
    completionMode: COMPLETION_MODE.SUBMITTED,
    requirement: BLOCK_REQUIREMENT.REQUIRED,
  });

  const answerType = block?.answerType || 'text';
  const isSpeaking = answerType === 'speaking' || answerType === 'audio_record';
  const instructions = block?.instructions || block?.content || '';
  const options = block?.options || [];
  const checklistItems = block?.items || block?.checklistItems || [];

  const [answer, setAnswer] = useState(block?.answer || '');
  const [checklistState, setChecklistState] = useState(block?.checklistState || {});
  const [selectedOption, setSelectedOption] = useState(block?.selectedOption ?? null);
  const [submitted, setSubmitted] = useState(false);

  // ─── Speaking state ──────────────────────────────────────────────
  const { tag: recognitionLang, fallback: recognitionFallback } = useMemo(
    () => resolveRecognitionLang(block, lang),
    [block?.recognitionLang, block?.targetLang, lang], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const {
    canRecognize,
    liveTranscript,
    startRecognition,
    finishRecognition,
    resetRecognition,
  } = useSpeechRecognition(recognitionLang);
  const [speechUrl, setSpeechUrl] = useState(null);
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [speechError, setSpeechError] = useState('');

  const content = useMemo(
    () => ({ answer, checklistState, selectedOption, speechTranscript }),
    [answer, checklistState, selectedOption, speechTranscript],
  );
  const [savedContent, setSavedContent] = useState(content);

  const { stateLabel, flushSave, recoverDraft } = useAutosave({
    blockId: block?.id,
    courseId,
    lessonId: String(moduleIndex ?? 0),
    content,
    onSave: async (data) => {
      setSavedContent(data);
      return { ok: true, savedLocal: true };
    },
    debounceMs: 2000,
  });

  useEffect(() => {
    if (!block?.id) return;
    let cancelled = false;
    recoverDraft().then((draft) => {
      if (cancelled || !draft) return;
      if (draft.answer) setAnswer(draft.answer);
      if (draft.checklistState) setChecklistState(draft.checklistState);
      if (draft.selectedOption != null) setSelectedOption(draft.selectedOption);
      if (draft.speechTranscript) setSpeechTranscript(draft.speechTranscript);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [block?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useBlockSaveContract({
    blockId: block?.id,
    registerBlock,
    onSave: flushSave,
    content,
    savedContent,
  });

  // Any edit after a submit re-opens the exercise (retry path).
  const touchAfterSubmit = useCallback(() => {
    if (submitted) setSubmitted(false);
  }, [submitted]);

  const handleRecStart = useCallback(() => {
    setSpeechError('');
    setSpeechTranscript('');
    startRecognition();
  }, [startRecognition]);

  const handleRecorded = useCallback((url) => {
    setSpeechUrl(url);
    if (!url) {
      resetRecognition();
      setSpeechTranscript('');
      touchAfterSubmit();
      return;
    }
    const { transcript, error } = finishRecognition();
    if (error) {
      setSpeechError(error);
      return;
    }
    if (!canRecognize) {
      // Recording without recognition is still a valid oral answer.
      setSpeechTranscript('');
      return;
    }
    if (!transcript) {
      setSpeechError(t('We didn\'t hear you — try again.', 'Nou pa tande w — eseye ankò.'));
      return;
    }
    setSpeechTranscript(transcript);
    touchAfterSubmit();
  }, [finishRecognition, resetRecognition, canRecognize, touchAfterSubmit]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = isSpeaking
    ? Boolean(speechUrl)
    : answerType === 'multiple_choice'
      ? selectedOption != null
      : answerType === 'checklist'
        ? Object.values(checklistState).some(Boolean)
        : answer.trim().length > 0;

  const handleSubmit = async () => {
    await flushSave();
    const data = isSpeaking
      ? { answerType, audioUrl: speechUrl, transcript: speechTranscript }
      : { answer: answer || selectedOption || checklistState, answerType, checklistState, selectedOption };
    if (onComplete) onComplete(data);
    if (onPortfolioSave && block?.portfolioSection) onPortfolioSave(block.portfolioSection, data);
    markComplete();
    setSubmitted(true);
  };

  const handleRetry = () => {
    setSubmitted(false);
    if (isSpeaking) {
      setSpeechUrl(null);
      setSpeechTranscript('');
      setSpeechError('');
      resetRecognition();
    }
  };

  const handleChecklistToggle = (index) => {
    setChecklistState((prev) => ({ ...prev, [index]: !prev[index] }));
    touchAfterSubmit();
  };

  return (
    <div className={styles.exercise} data-answertype={answerType}>
      <div className={styles.exerciseHead}>
        <h3 className={styles.exerciseTitle}>
          <i className="fas fa-pen-to-square" aria-hidden="true" /> {block?.title || t('Exercise', 'Egzèsis')}
        </h3>
        {instructions && <p className={styles.exerciseInstructions}>{instructions}</p>}
        {block?.hint && <p className={styles.exerciseHint}><i className="fas fa-lightbulb" aria-hidden="true" /> {block.hint}</p>}
      </div>

      {(!block?.answerType || block.answerType === 'text' || block.answerType === 'long_text') && (
        <textarea
          className={styles.exerciseTextarea}
          value={answer}
          onChange={(e) => { setAnswer(e.target.value); touchAfterSubmit(); }}
          placeholder={t('Write your answer here…', 'Ekri repons ou isit la…')}
          rows={block.answerType === 'long_text' ? 8 : 4}
        />
      )}

      {block?.answerType === 'number' && (
        <input
          className={styles.exerciseInput}
          type="number"
          value={answer}
          onChange={(e) => { setAnswer(e.target.value); touchAfterSubmit(); }}
          placeholder={t('Enter a number…', 'Antre yon nonb…')}
        />
      )}

      {answerType === 'multiple_choice' && options.length > 0 && (
        <div className={styles.exerciseOptions} role="radiogroup">
          {options.map((opt, i) => (
            <label key={i} className={`${styles.exerciseOption} ${selectedOption === i ? styles.exerciseOptionSelected : ''}`}>
              <input
                type="radio"
                name={`exercise-${block?.id}`}
                checked={selectedOption === i}
                onChange={() => { setSelectedOption(i); touchAfterSubmit(); }}
              />
              <span>{typeof opt === 'string' ? opt : opt.text || opt.label}</span>
            </label>
          ))}
        </div>
      )}

      {answerType === 'checklist' && checklistItems.length > 0 && (
        <div className={styles.exerciseOptions}>
          {checklistItems.map((item, i) => (
            <label key={i} className={`${styles.exerciseOption} ${checklistState[i] ? styles.exerciseOptionSelected : ''}`}>
              <input
                type="checkbox"
                checked={!!checklistState[i]}
                onChange={() => handleChecklistToggle(i)}
              />
              <span>{typeof item === 'string' ? item : item.text || item.label}</span>
            </label>
          ))}
        </div>
      )}

      {isSpeaking && (
        <div className={styles.exerciseSpeaking}>
          {recognitionFallback && (
            <p className={styles.exerciseLangNote} role="note">
              <i className="fas fa-circle-info" aria-hidden="true" />{' '}
              {t(
                'Voice recognition has no Haitian Creole model, so it listens in French. Your recording is still yours.',
                'Rekonesans vwa pa gen modèl kreyòl, kidonk li koute an fransè. Anrejistreman w la rete pou ou.',
              )}
            </p>
          )}
          <SpeechRecorder
            lang={lang}
            onRecorded={handleRecorded}
            onStart={handleRecStart}
            recordLabel={t('Tap to answer aloud', 'Tape pou reponn ak vwa')}
          />
          {liveTranscript && !speechUrl && (
            <div className={styles.practiceLiveTranscript} role="status" aria-live="polite">
              <span className={styles.practiceLiveTranscriptDot} aria-hidden="true" />
              <p className={styles.practiceTranscript}><strong>{t('Hearing:', 'Koute:')}</strong> “{liveTranscript}”</p>
            </div>
          )}
          {speechTranscript && (
            <p className={styles.practiceTranscript} role="status">
              <strong>{t('Recognized:', 'Rekonèt:')}</strong> “{speechTranscript}”
            </p>
          )}
          {speechError && (
            <p className={styles.practiceError} role="alert">
              <i className="fas fa-circle-exclamation" aria-hidden="true" /> {speechError}
            </p>
          )}
          {!canRecognize && (
            <p className={styles.exerciseLangNote} role="note">
              <i className="fas fa-microphone-slash" aria-hidden="true" />{' '}
              {t(
                'Live transcription is not available in this browser — your recording will still be submitted.',
                'Transkripsyon an dirèk pa disponib nan navigatè sa a — anrejistreman w ap toujou voye.',
              )}
            </p>
          )}
        </div>
      )}

      <div className={styles.exerciseFoot}>
        <div className={styles.exerciseSaveState}>{stateLabel && <span>💾 {stateLabel}</span>}</div>
        <div className={styles.exerciseActions}>
          {submitted && (
            <button type="button" className={styles.exerciseRetry} onClick={handleRetry}>
              <i className="fas fa-rotate-left" aria-hidden="true" /> {t('Try again', 'Eseye ankò')}
            </button>
          )}
          <button
            type="button"
            className={styles.exerciseSubmit}
            onClick={handleSubmit}
            disabled={!canSubmit || submitted}
          >
            {submitted
              ? `✅ ${t('Submitted', 'Voye')}`
              : `📤 ${t('Submit answer', 'Voye repons')}`}
          </button>
        </div>
      </div>
    </div>
  );
}
