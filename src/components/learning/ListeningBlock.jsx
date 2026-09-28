/**
 * src/components/learning/ListeningBlock.jsx
 *
 * Listening — reference audio + question; the learner answers with a
 * choice, by typing what they heard, or confirms they listened. A
 * correct answer completes the block; a wrong one shows a retry hint.
 */
import React, { useState } from 'react';
import { normalizeSpeechText } from '../../modules/learning/speech';
import styles from './learning.module.css';

export default function ListeningBlock({ block, lang = 'ht', reportComplete }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);
  const [typed, setTyped] = useState('');
  const [typedResult, setTypedResult] = useState(null);
  const [listenDone, setListenDone] = useState(false);
  const [choice, setChoice] = useState(null);
  const [choiceResult, setChoiceResult] = useState(null);

  const listeningAnswer = block.answer;
  const hasChoices = Array.isArray(block.choices) && block.choices.length > 0;

  return (
    <div className={styles.practiceQuestion}>
      {block.question && <p className={styles.practicePhrase}>{block.question}</p>}
      {hasChoices ? (
        <div className={styles.practiceChoices}>
          {block.choices.map((c, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.practiceChoice} ${choice === c ? styles.practiceChoiceSelected : ''}`}
              onClick={() => {
                setChoice(c);
                const ok = c === listeningAnswer;
                setChoiceResult(ok ? 'correct' : 'incorrect');
                if (ok) reportComplete();
              }}
            >
              {c}
            </button>
          ))}
        </div>
      ) : listeningAnswer ? (
        <div className={styles.practiceTypedRow}>
          <input
            className={styles.practiceInput}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={t('Type what you heard…', 'Tape sa ou tande…')}
          />
          <button
            type="button"
            className={styles.practiceBtn}
            onClick={() => {
              const ok = normalizeSpeechText(typed) === normalizeSpeechText(listeningAnswer);
              setTypedResult({ matched: ok, kind: 'listening' });
              if (ok) reportComplete();
            }}
          >
            {t('Check', 'Tcheke')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`${styles.practiceBtn} ${listenDone ? styles.practiceBtnDone : ''}`}
          onClick={() => {
            if (!listenDone) reportComplete();
            setListenDone(true);
          }}
        >
          <i className="fas fa-check" aria-hidden="true" /> {listenDone ? t('Listened', 'Koute') : t('I listened', 'M koute')}
        </button>
      )}
      {choiceResult === 'correct' && <div className={styles.practiceMatched}><i className="fas fa-circle-check" aria-hidden="true" /> {t('Correct!', 'Kòrèk!')}</div>}
      {choiceResult === 'incorrect' && <div className={styles.practiceRetryHint}><i className="fas fa-rotate-left" aria-hidden="true" /> {t('Try again.', 'Eseye ankò.')}</div>}
      {typedResult?.kind === 'listening' && (
        typedResult.matched
          ? <div className={styles.practiceMatched}><i className="fas fa-circle-check" aria-hidden="true" /> {t('Correct!', 'Kòrèk!')}</div>
          : <div className={styles.practiceRetryHint}><i className="fas fa-rotate-left" aria-hidden="true" /> {t('Not quite — try again.', 'Pa egzak — eseye ankò.')}</div>
      )}
    </div>
  );
}
