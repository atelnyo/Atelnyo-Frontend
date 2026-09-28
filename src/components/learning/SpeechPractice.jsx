/**
 * src/components/learning/SpeechPractice.jsx
 *
 * Learner-side renderer for the SPEAKING block types:
 *   • repeat        — Repeat After Me (exact): listen, repeat, compare.
 *   • pronunciation — target word + hint + audio; record + compare.
 *   • speaking      — open response: record → transcript + confidence.
 *
 * Recognition runs WHILE the learner records (useSpeechRecognition) —
 * the transcript captured during the take is what gets analyzed when
 * the recording stops. Exact exercises (repeat/pronunciation) compare
 * the transcript to the target WORD BY WORD (analyzeSpeech) so the
 * learner sees which words were said well / off / missing; open
 * speaking NEVER requires an exact match.
 *
 * When SpeechRecognition is unsupported, exact exercises fall back to
 * typing the target; open speaking stays a recording without
 * recognition feedback. Nothing crashes, nothing is faked.
 */
import React, { useState, useCallback, useRef } from 'react';
import { analyzeSpeech, exactMatch } from '../../modules/learning/speech';
import { useSpeechRecognition } from '../../modules/learning/useSpeechRecognition';
import { speechSubmissionService } from '../../services/api';
import SpeechRecorder from './SpeechRecorder';
import styles from './learning.module.css';

export default function SpeechPractice({ block, lang = 'ht', courseId, moduleIndex, reportComplete }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);
  const [recordingUrl, setRecordingUrl] = useState(null);
  const [feedback, setFeedback] = useState(null); // { transcript, confidence, matched, kind, analysis? }
  const [typed, setTyped] = useState('');
  const [typedResult, setTypedResult] = useState(null);
  const submitRef = useRef(false); // avoid double-submitting the same result
  const {
    canRecognize,
    liveTranscript,
    startRecognition,
    finishRecognition,
    resetRecognition,
  } = useSpeechRecognition(block.recognitionLang || 'en-US', {
    translateError: (err) => (err === 'not-allowed'
      ? t('Speech recognition was blocked.', 'Rekonesans vwa te bloke.')
      : t('Speech recognition could not read your recording.', 'Rekonesans vwa pa t kapab li anrejistreman w.') + ' ' + t('Try again.', 'Eseye ankò.')),
  });

  const handleRecStart = useCallback(() => {
    setFeedback(null);
    startRecognition();
  }, [startRecognition]);

  // Recording stopped → finalize with the transcript captured DURING the
  // take (never by re-listening to the room afterwards).
  const handleRecorded = useCallback((url) => {
    setRecordingUrl(url);
    if (!url) {
      // Retry — discard the previous take's recognition state.
      resetRecognition();
      setFeedback(null);
      return;
    }
    const { transcript, confidence, error } = finishRecognition();
    if (error) {
      setFeedback({ error, kind: 'error' });
      return;
    }
    if (!canRecognize) return;
    if (!transcript) {
      setFeedback({ error: t("We didn't hear you — try again.", 'Nou pa tande w — eseye ankò.'), kind: 'error' });
      return;
    }
    let analysis = null;
    if (block.mode === 'open' || block.type === 'speaking') {
      // Open speech — never exact-match. Honest transcript + confidence.
      setFeedback({ transcript, confidence, matched: null, kind: 'open' });
      // Open response submitted = a real completion for progress.
      reportComplete();
    } else {
      // Real speech analysis: compare the transcript to the target
      // WORD BY WORD, so the learner sees exactly which words were
      // said well, which were off, and which are missing — not just
      // a flat pass/fail.
      analysis = analyzeSpeech(block.targetText, transcript);
      setFeedback({ transcript, confidence, analysis, kind: 'exact' });
      if (analysis.passed) reportComplete();
    }
    // Persist the REAL practice result to the backend when the
    // learner is in a course context (so the creator can review
    // speaking activity). Fire-and-forget; never blocks the UI.
    // Exact exercises ship the word-level analysis so the creator
    // sees WHICH words each learner said well / off — open speech
    // sends none (backend keeps analysis {}).
    if (courseId && transcript && !submitRef.current) {
      submitRef.current = true;
      speechSubmissionService.create({
        course_id: courseId,
        module_index: Number(moduleIndex) || 0,
        block_id: block.id || '',
        block_type: block.type || '',
        transcript,
        confidence: typeof confidence === 'number' ? confidence : 0,
        ...(analysis ? { analysis } : {}),
      }).catch(() => { /* submission is best-effort */ });
    }
  }, [resetRecognition, finishRecognition, canRecognize, t, block.mode, block.type, block.targetText, reportComplete, courseId, moduleIndex, block.id]);

  const handleTypedCheck = useCallback(() => {
    const { matched } = exactMatch(block.targetText, typed);
    setTypedResult({ matched });
    if (matched) reportComplete();
  }, [block.targetText, typed, reportComplete]);

  const renderAnalysis = (a) => {
    const matchedCount = a.matchedWords.length + a.nearMisses.length;
    return (
      <div className={styles.practiceAnalysis} role="status">
        <div className={styles.practiceScoreRow}>
          <span className={styles.practiceScoreLabel}>
            {t('Words said well', 'Mo byen di')}: <strong>{matchedCount}/{a.totalWords}</strong>
          </span>
          <span className={styles.practiceScoreBar} aria-hidden="true">
            <span className={styles.practiceScoreFill} style={{ width: `${Math.round(a.score * 100)}%` }} />
          </span>
        </div>
        <div className={styles.practiceWordChips}>
          {a.matchedWords.map((w, i) => (
            <span key={`ok-${i}`} className={`${styles.practiceWordChip} ${styles.practiceWordOk}`}>
              <i className="fas fa-check" aria-hidden="true" /> {w}
            </span>
          ))}
          {a.nearMisses.map((n, i) => (
            <span
              key={`near-${i}`}
              className={`${styles.practiceWordChip} ${styles.practiceWordNear}`}
              title={t('Almost — pronunciation', 'Preske — pwononsyasyon')}
            >
              <i className="fas fa-circle-half-stroke" aria-hidden="true" /> {n.target}
              <span className={styles.practiceWordSaid}>“{n.said}”</span>
            </span>
          ))}
          {a.missingWords.map((w, i) => (
            <span key={`miss-${i}`} className={`${styles.practiceWordChip} ${styles.practiceWordMiss}`}>
              <i className="fas fa-xmark" aria-hidden="true" /> {w}
            </span>
          ))}
          {a.extraWords.map((w, i) => (
            <span key={`extra-${i}`} className={`${styles.practiceWordChip} ${styles.practiceWordExtra}`}>
              <i className="fas fa-plus" aria-hidden="true" /> {w}
            </span>
          ))}
        </div>
        {a.passed ? (
          <div className={styles.practiceMatched}>
            <i className="fas fa-circle-check" aria-hidden="true" /> {t('Well said!', 'Byen pale!')}
          </div>
        ) : (
          <div className={styles.practiceRetryHint}>
            <i className="fas fa-rotate-left" aria-hidden="true" /> {t('Almost — repeat the highlighted words.', 'Preske — repete mo ki make yo ankò.')}
          </div>
        )}
      </div>
    );
  };

  const renderFeedback = () => {
    if (!feedback) return null;
    if (feedback.kind === 'error') {
      return <div className={styles.practiceError} role="alert"><i className="fas fa-circle-exclamation" aria-hidden="true" /> {feedback.error}</div>;
    }
    const pct = feedback.confidence != null ? `${Math.round(feedback.confidence * 100)}%` : null;
    return (
      <div className={styles.practiceFeedback} role="status">
        {feedback.transcript && (
          <p className={styles.practiceTranscript}>
            <strong>{t('Recognized:', 'Rekonèt:')}</strong> “{feedback.transcript}”
          </p>
        )}
        {feedback.analysis && renderAnalysis(feedback.analysis)}
        {pct && (
          <p className={styles.practiceConfidence}>
            {t('Recognition confidence', 'Konfyans rekonesans')}: <strong>{pct}</strong>
          </p>
        )}
      </div>
    );
  };

  return (
    <>
      <div className={styles.practiceSpeak}>
        <SpeechRecorder
          lang={lang}
          onRecorded={handleRecorded}
          onStart={handleRecStart}
          recordLabel={block.type === 'speaking'
            ? t('Tap to answer', 'Tape pou reponn')
            : t('Tap to speak', 'Tape pou pale')}
        />
        {!recordingUrl && liveTranscript && (
          <div className={styles.practiceLiveTranscript} role="status" aria-live="polite">
            <span className={styles.practiceLiveTranscriptDot} aria-hidden="true" />
            <p className={styles.practiceTranscript}>
              <strong>{t('Hearing:', 'Koute:')}</strong> “{liveTranscript}”
            </p>
          </div>
        )}
        {recordingUrl && renderFeedback()}
        {!canRecognize && recordingUrl && block.mode === 'open' && (
          <p className={styles.practiceNoRecognition}>
            {t('Recognition isn’t available in this browser, but your recording is ready.', 'Rekonesans pa disponib nan navigatè sa a, men anrejistreman w pare.')}
          </p>
        )}
      </div>

      {/* ─── Exact-type fallback when recognition unsupported ─── */}
      {(block.type === 'repeat' || block.type === 'pronunciation') && !canRecognize && (
        <div className={styles.practiceTypedRow}>
          <input
            className={styles.practiceInput}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={t('Type the target…', 'Tape fraz la…')}
          />
          <button type="button" className={styles.practiceBtn} onClick={handleTypedCheck}>
            {t('Check', 'Tcheke')}
          </button>
          {typedResult && (
            typedResult.matched
              ? <div className={styles.practiceMatched}><i className="fas fa-circle-check" aria-hidden="true" /> {t('Correct!', 'Kòrèk!')}</div>
              : <div className={styles.practiceRetryHint}><i className="fas fa-rotate-left" aria-hidden="true" /> {t('Not quite — try again.', 'Pa egzak — eseye ankò.')}</div>
          )}
        </div>
      )}
    </>
  );
}
