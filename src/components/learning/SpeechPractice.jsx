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
import { transcribeTakeOnServer } from '../../modules/learning/serverTranscription';
import { aiService, speechSubmissionService } from '../../services/api';
import SpeechRecorder from './SpeechRecorder';
import styles from './learning.module.css';

function resolveSpeechLang(block, lang) {
  const raw = (block?.recognitionLang || block?.targetLang || '').trim();
  if (raw) return { tag: raw, fallback: false };
  if (lang === 'ht') return { tag: 'fr-FR', fallback: true };
  if (lang === 'fr') return { tag: 'fr-FR', fallback: false };
  if (lang === 'es') return { tag: 'es-ES', fallback: false };
  return { tag: 'en-US', fallback: false };
}

export default function SpeechPractice({ block, lang = 'en', courseId, moduleIndex, reportComplete }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);
  const speechLang = resolveSpeechLang(block, lang);
  const [recordingUrl, setRecordingUrl] = useState(null);
  const [feedback, setFeedback] = useState(null); // { transcript, confidence, matched, kind, analysis? }
  const [typed, setTyped] = useState('');
  const [typedResult, setTypedResult] = useState(null);
  const [serverWorking, setServerWorking] = useState(false);
  const [aiCoach, setAiCoach] = useState(null); // { forWord, text, loading, error }
  const submitRef = useRef(false); // avoid double-submitting the same result
  const {
    canRecognize,
    liveTranscript,
    startRecognition,
    finishRecognition,
    resetRecognition,
  } = useSpeechRecognition(speechLang.tag, {
    translateError: (err) => (err === 'not-allowed'
      ? t('Speech recognition was blocked.', 'Rekonesans vwa te bloke.')
      : t('Speech recognition could not read your recording.', 'Rekonesans vwa pa t kapab li anrejistreman w.') + ' ' + t('Try again.', 'Eseye ankò.')),
  });

  const handleRecStart = useCallback(() => {
    setFeedback(null);
    setServerWorking(false);
    setAiCoach(null);
    startRecognition();
  }, [startRecognition]);

  // Settle a take with a transcript from EITHER source (browser live
  // recognition or the server Creole model). Shared so both paths score
  // and submit identically — the source is shown honestly in the UI.
  const settleWithTranscript = useCallback((transcript, confidence, source) => {
    let analysis = null;
    if (block.mode === 'open' || block.type === 'speaking') {
      // Open speech — never exact-match. Honest transcript + confidence.
      setFeedback({ transcript, confidence, matched: null, kind: 'open', source });
      // Open response submitted = a real completion for progress.
      reportComplete();
    } else {
      // Real speech analysis: compare the transcript to the target
      // WORD BY WORD, so the learner sees exactly which words were
      // said well, which were off, and which are missing — not just
      // a flat pass/fail.
      analysis = analyzeSpeech(block.targetText, transcript);
      setFeedback({ transcript, confidence, analysis, kind: 'exact', source });
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
        // What the learner was asked to say + which engine heard it —
        // so creator review can show target-vs-heard side by side.
        // (Open speech has no target: backend keeps target_text ''.)
        ...(block.targetText ? { target_text: block.targetText } : {}),
        ...(source === 'browser' || source === 'server' ? { transcript_source: source } : {}),
      }).catch(() => { /* submission is best-effort */ });
    }
  }, [block.mode, block.type, block.targetText, block.id, reportComplete, courseId, moduleIndex]);

  // Recording stopped → finalize with the transcript captured DURING the
  // take (never by re-listening to the room afterwards).
  // url = playback URL, blob = recorded audio (size tells us whether the
  // microphone actually captured voice — so we never blame the learner
  // when the recognizer is the part that failed).
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
    if (transcript) {
      settleWithTranscript(transcript, confidence, 'browser');
      return;
    }
    // No browser transcript. If the mic captured real audio, the
    // recognizer (French fallback model) is what failed — not the
    // learner. Second chance: the platform's own Creole model.
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
        settleWithTranscript(server.transcript, null, 'server');
        return;
      }
    }
    // Server couldn't help (not deployed / offline) — the recording
    // itself is kept and playable; say exactly that.
    setFeedback({
      error: t(
        'Recording saved, but recognition could not catch the words — listen to your playback, speak louder and clearer, then try again.',
        'Anrejistreman an sove, men rekonesans lan pa t kenbe pawòl yo — koute anrejistreman w la, pale pi fò epi pi klè, epi eseye ankò.',
      ),
      kind: 'error',
    });
    // Open response: the recording IS the answer, so progress still counts.
    if (block.mode === 'open' || block.type === 'speaking') reportComplete();
  }, [resetRecognition, finishRecognition, canRecognize, settleWithTranscript, t, block.mode, block.type, reportComplete, courseId]);

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
        {/* AI pronunciation coach — ONLY on explicit tap, never automatic:
            the learner asks about one missed/near word, the AI explains HOW
            to say it. The speech score stays the judge; this changes nothing. */}
        {!a.passed && (a.missingWords.length > 0 || a.nearMisses.length > 0) && (
          <div className={styles.practiceAiCoach}>
            {!aiCoach || aiCoach.forWord == null ? (
              <button
                type="button"
                className={styles.practiceAiCoachButton}
                onClick={() => askAiCoach(a)}
                disabled={aiCoach?.loading}
              >
                <i className="fas fa-robot" aria-hidden="true" />{' '}
                {aiCoach?.loading
                  ? t('Asking the coach…', 'N ap mande kouch la…')
                  : t('Ask AI for help', 'Mande AI pou èd')}
              </button>
            ) : null}
            {aiCoach?.loading && aiCoach.forWord != null && (
              <p className={styles.practiceAiCoachLoading} role="status">
                <i className="fas fa-spinner fa-spin" aria-hidden="true" /> {t('Asking the coach…', 'N ap mande kouch la…')}
              </p>
            )}
            {aiCoach?.error && (
              <p className={styles.practiceAiCoachError} role="alert">
                <i className="fas fa-circle-exclamation" aria-hidden="true" /> {aiCoach.error}
              </p>
            )}
            {aiCoach?.text && (
              <div className={styles.practiceAiCoachBubble} role="status">
                <p className={styles.practiceAiCoachWord}>
                  <i className="fas fa-robot" aria-hidden="true" /> {aiCoach.forWord}
                </p>
                <p>{aiCoach.text}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // One deliberate AI call about the FIRST missed (or near-miss) word.
  // Fire-and-forget for the score — coaching text only.
  const askAiCoach = useCallback(async (analysis) => {
    const miss = analysis.missingWords[0];
    const near = analysis.nearMisses[0];
    const target = miss || near?.target;
    if (!target || aiCoach?.loading) return;
    const heard = near && !miss ? near.said : (near?.target === target ? near.said : '');
    setAiCoach({ forWord: target, text: '', loading: true, error: '' });
    try {
      const res = await aiService.pronunciationHelp({
        target_word: target,
        heard: heard || '',
        target_phrase: block.targetText || '',
        lang,
      });
      const text = res?.data?.text || '';
      setAiCoach({
        forWord: target, loading: false, error: '',
        text: text || t('The coach has no tip right now — try again.', 'Kouch la pa gen konsèy pou kounye a — eseye ankò.'),
      });
    } catch {
      setAiCoach({
        forWord: target, loading: false, text: '',
        error: t('The coach is unavailable — repeat the word and try again.', 'Kouch la pa disponib — repete mo a epi eseye ankò.'),
      });
    }
  }, [aiCoach?.loading, block.targetText, lang, t]);

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
            {feedback.source === 'server' && (
              <span className={styles.practiceSourceBadge}>
                <i className="fas fa-server" aria-hidden="true" /> {t('Creole model', 'Modèl Kreyòl')}
              </span>
            )}
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
      {speechLang.fallback && (
        <p className={styles.practiceTranslation} role="note">
          <i className="fas fa-circle-info" aria-hidden="true" />{' '}
          {t(
            'Voice recognition has no Haitian Creole model, so it listens in French.',
            'Rekonesans vwa pa gen modèl kreyòl, kidonk li koute an fransè.',
          )}
        </p>
      )}
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
        {serverWorking && (
          <div className={styles.practiceLiveTranscript} role="status" aria-live="polite">
            <span className={styles.practiceLiveTranscriptDot} aria-hidden="true" />
            <p className={styles.practiceTranscript}>
              <i className="fas fa-spinner fa-spin" aria-hidden="true" />{' '}
              {t('Listening with the Creole model…', 'Ap koute ak modèl Kreyòl la…')}
            </p>
          </div>
        )}
        {recordingUrl && !serverWorking && renderFeedback()}
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
