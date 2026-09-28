/**
 * src/components/learning/LanguagePracticeBlock.jsx
 *
 * Learner-side renderer for language-practice blocks stored in a
 * course module's syllabus JSON (``blocks`` array).
 *
 * This file is a DISPATCHER: it renders the shared block shell (type
 * header, instruction, target text, reference audio) and delegates the
 * interactive part to a focused component per block type:
 *
 *   • repeat / pronunciation / speaking → SpeechPractice
 *   • vocabulary                         → VocabularyBlock
 *   • listening                          → ListeningBlock
 *   • text                               → TextBlock
 *   • video                              → VideoBlock
 *   • conversation                       → ConversationPractice
 *
 * Speech honesty rules (see modules/learning/speech.js):
 *   • Recognition results show the transcript + the recognizer's own
 *     confidence, labelled "recognition confidence" — never presented
 *     as an objective pronunciation score.
 *   • Exact exercises (repeat/pronunciation) compare the transcript to
 *     the target word by word. Open speaking NEVER requires exact
 *     matching.
 *   • When SpeechRecognition is unsupported, exact exercises fall back
 *     to typing the target; open speaking stays a recording without
 *     recognition feedback. Nothing crashes, nothing is faked.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import AudioPlayer from './AudioPlayer';
import ConversationPractice from './ConversationPractice';
import SpeechPractice from './SpeechPractice';
import VocabularyBlock from './VocabularyBlock';
import ListeningBlock from './ListeningBlock';
import TextBlock from './TextBlock';
import VideoBlock from './VideoBlock';
import styles from './learning.module.css';

const TYPE_META = {
  repeat:        { icon: 'fa-repeat',        label: { en: 'Repeat After Me', ht: 'Repete apre m' } },
  pronunciation: { icon: 'fa-language',      label: { en: 'Pronunciation',   ht: 'Pwononsyasyon' } },
  vocabulary:    { icon: 'fa-book-open',     label: { en: 'Vocabulary',      ht: 'Vokabilè' } },
  listening:     { icon: 'fa-ear-listen',    label: { en: 'Listening',       ht: 'Koute' } },
  speaking:      { icon: 'fa-comment-dots',  label: { en: 'Speaking',        ht: 'Pale' } },
  conversation:  { icon: 'fa-comments',      label: { en: 'Conversation',    ht: 'Konvèsasyon' } },
  // Lesson-content blocks (any subject, not just language):
  text:          { icon: 'fa-file-lines',    label: { en: 'Reading',         ht: 'Lekti' } },
  video:         { icon: 'fa-video',         label: { en: 'Video Lesson',    ht: 'Leson Videyo' } },
};

export default function LanguagePracticeBlock({ block, lang = 'ht', index, courseId, moduleIndex, onComplete, onViewed }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);
  const meta = TYPE_META[block.type] || TYPE_META.repeat;
  const completedRef = useRef(false); // avoid double-reporting completion

  // REAL completion → progress engine (server-side). Called once per
  // block per session; the backend is idempotent anyway.
  const reportComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete?.(moduleIndex, block.id, block.type);
  }, [onComplete, moduleIndex, block.id, block.type]);

  // Last meaningful position — the learner OPENED this block.
  useEffect(() => {
    onViewed?.(moduleIndex, index, block.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subProps = { block, lang, courseId, moduleIndex, reportComplete };

  return (
    <div className={styles.practiceBlock} data-type={block.type}>
      <header className={styles.practiceHeader}>
        <span className={styles.practiceType}>
          <i className={`fas ${meta.icon}`} aria-hidden="true" />
          {isHt ? meta.label.ht : meta.label.en}
        </span>
        {block.title && <span className={styles.practiceTitle}>{block.title}</span>}
      </header>

      {block.instruction && <p className={styles.practiceInstruction}>{block.instruction}</p>}

      {/* ─── Shared target display (everything except listening) ─── */}
      {block.type !== 'listening' && block.targetText && (
        <div className={styles.practiceTarget}>
          {block.type === 'vocabulary' && block.pronunciationHint && (
            <span className={styles.practiceHint}>“{block.pronunciationHint}”</span>
          )}
          {block.translation && (
            <span className={styles.practiceTranslation}>
              {block.translation}
            </span>
          )}
          {block.example && block.type === 'vocabulary' && (
            <span className={styles.practiceExample}>“{block.example}”</span>
          )}
          <p className={styles.practicePhrase}>{block.targetText}</p>
        </div>
      )}

      {block.referenceAudio && (
        <AudioPlayer
          src={block.referenceAudio}
          label={t('Reference audio', 'Odyo referans')}
          lang={lang}
        />
      )}

      {/* ─── Interactive part per block type ─────────────────────── */}
      {block.type === 'listening' && <ListeningBlock {...subProps} />}
      {block.type === 'text' && <TextBlock {...subProps} />}
      {block.type === 'video' && <VideoBlock {...subProps} />}
      {block.type === 'vocabulary' && <VocabularyBlock {...subProps} />}
      {(block.type === 'repeat' || block.type === 'pronunciation' || block.type === 'speaking') && (
        <SpeechPractice {...subProps} />
      )}
      {block.type === 'conversation' && <ConversationPractice {...subProps} />}
    </div>
  );
}
