/**
 * src/components/studio/editor/LanguagePracticeEditor.jsx
 *
 * Creator-side editor for language-practice blocks inside a course
 * module. The creator answers "what should my student DO?" — not
 * "what fields do I need to fill?":
 *
 *   [Vocabulary] [Listening] [Speaking] [Pronunciation] [Repeat]
 *
 * Blocks are stored as a ``blocks`` array inside the module's syllabus
 * JSON entry (additive — existing courses without blocks keep working).
 *
 * AI: a real "Translate" helper calls the existing ai/translate
 * endpoint (Gemini-backed) to fill the learner-language translation.
 * It is optional and editable — generated translations are never
 * assumed correct.
 */
import React, { useState, useCallback, useRef } from 'react';
import { aiService, mediaUploadService } from '../../../services/api';
import { SPEECH_CAPS } from '../../../modules/learning/speech';
import LanguagePracticeBlock from '../../learning/LanguagePracticeBlock';
import AudioLibraryModal from './AudioLibraryModal';
import styles from './editor.module.css';

export const PRACTICE_TYPES = [
  { id: 'repeat',        icon: 'fa-repeat',       label: { en: 'Repeat After Me', ht: 'Repete apre m' }, hint: { en: 'Listen, then repeat the sentence aloud.', ht: 'Koute, epi repete fraz la byen fò.' } },
  { id: 'pronunciation', icon: 'fa-language',     label: { en: 'Pronunciation',   ht: 'Pwononsyasyon' }, hint: { en: 'Practice a word with a pronunciation hint.', ht: 'Pratike yon mo ak yon endikasyon pwononsyasyon.' } },
  { id: 'vocabulary',    icon: 'fa-book-open',    label: { en: 'Vocabulary',      ht: 'Vokabilè' },      hint: { en: 'Word, meaning, example — learn and type it.', ht: 'Mo, siyifikasyon, egzanp — aprann li epi tape l.' } },
  { id: 'listening',     icon: 'fa-ear-listen',   label: { en: 'Listening',       ht: 'Koute' },         hint: { en: 'Play audio and answer what you heard.', ht: 'Jwe odyo a epi reponn sa ou tande.' } },
  { id: 'speaking',      icon: 'fa-comment-dots', label: { en: 'Speaking',        ht: 'Pale' },          hint: { en: 'Answer a question in your own words (open response).', ht: 'Reponn yon kesyon ak pwòp mo ou (repons lib).' } },
  { id: 'conversation',  icon: 'fa-comments',     label: { en: 'Conversation',    ht: 'Konvèsasyon' },   hint: { en: 'A scripted scenario — learners respond step by step.', ht: 'Yon senaryo eskri — elèv yo reponn etap pa etap.' } },
  // Lesson-content blocks — for ANY subject (not just language): a
  // creator can now write a real lesson or embed a video.
  { id: 'text',          icon: 'fa-file-lines',   label: { en: 'Reading Lesson',  ht: 'Leson Lekti' },   hint: { en: 'Lesson content — text the learner reads.', ht: 'Kontni leson — tèks elèv la li.' } },
  { id: 'video',         icon: 'fa-video',        label: { en: 'Video Lesson',    ht: 'Leson Videyo' },  hint: { en: 'Embed a video (YouTube, Vimeo, file…) the learner watches.', ht: 'Antre yon videyo (YouTube, Vimeo, fichye…) elèv la gade.' } },
];

function newBlock(type) {
  const base = {
    id: `${type}-${Date.now()}`,
    type,
    title: '',
    instruction: '',
    targetText: '',
    translation: '',
    pronunciationHint: '',
    example: '',
    referenceAudio: '',
    mode: type === 'speaking' ? 'open' : 'exact',
    recognitionLang: 'en-US',
  };
  if (type === 'listening') {
    base.question = '';
    base.answer = '';
    base.choices = [];
  }
  if (type === 'conversation') {
    base.scenario = '';
    base.steps = [{ speaker: '', prompt: '' }];
  }
  if (type === 'text') {
    base.content = '';
  }
  if (type === 'video') {
    base.videoUrl = '';
  }
  return base;
}

// Module-scope clone (like newBlock): an exact copy with a fresh id and
// a "(copy)" title suffix, inserted right after the original.
function cloneBlock(b, copyLabel) {
  return {
    ...b,
    id: `${b.type}-${Date.now()}-copy`,
    title: b.title ? `${b.title} (${copyLabel})` : b.title,
  };
}

function validateBlock(b) {
  const errs = {};
  if (b.type === 'repeat' || b.type === 'pronunciation' || b.type === 'vocabulary') {
    if (!b.targetText.trim()) errs.targetText = 'target';
  }
  if (b.type === 'speaking') {
    if (!b.targetText.trim()) errs.targetText = 'target'; // the question
  }
  if (b.type === 'listening' && !b.referenceAudio.trim()) {
    errs.referenceAudio = 'audio';
  }
  if (b.type === 'conversation') {
    const steps = Array.isArray(b.steps) ? b.steps : [];
    if (steps.length === 0) errs.steps = 'steps';
    else if (steps.some((s) => !String(s?.prompt || '').trim())) errs.steps = 'prompt';
  }
  if (b.type === 'text' && !String(b.content || '').trim()) {
    errs.content = 'content';
  }
  if (b.type === 'video' && !String(b.videoUrl || '').trim()) {
    errs.videoUrl = 'video';
  }
  return errs;
}

export default function LanguagePracticeEditor({ blocks = [], onBlocksChange, lang = 'ht' }) {
  const isHt = lang === 'ht';
  const [choosing, setChoosing] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = add new draft
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState({});
  const [translateBusy, setTranslateBusy] = useState(false);
  // Preview as learner — renders the REAL learner block for the creator.
  const [previewBlock, setPreviewBlock] = useState(null);
  // HTML5 drag-and-drop reordering (the chevrons stay as fallback).
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  // Reference audio: record + upload (real MediaRecorder → storage).
  const [recordState, setRecordState] = useState('idle'); // idle|recording|uploading
  const [recordErr, setRecordErr] = useState('');
  const recRef = useRef(null);
  const streamRef = useRef(null);
  // Audio Library — reuse real cataloged audio from the creator's library.
  const [libraryOpen, setLibraryOpen] = useState(false);

  const t = (en, ht) => (isHt ? ht : en);

  // ─── TTS preview — browser speechSynthesis, feature-detected. ──────
  const ttsSupported = typeof window !== 'undefined'
    && Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);
  const [ttsBusy, setTtsBusy] = useState(false);

  const speakTarget = useCallback(() => {
    const text = draft?.targetText?.trim();
    if (!text || !ttsSupported) return;
    setTtsBusy(true);
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = draft?.recognitionLang || 'en-US';
      u.rate = 0.85; // slower = clearer for learners
      u.onend = () => setTtsBusy(false);
      u.onerror = () => setTtsBusy(false);
      window.speechSynthesis.speak(u);
    } catch (_) {
      setTtsBusy(false);
    }
  }, [draft, ttsSupported]);

  // ─── Reference-audio recording → upload → URL. ─────────────────────
  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    if (recRef.current && recRef.current.state !== 'inactive') {
      try { recRef.current.stop(); } catch (_) { /* ignore */ }
    }
    recRef.current = null;
  }, []);

  const setDraftField = useCallback((field, value) => {
    setDraft((d) => (d ? { ...d, [field]: value } : d));
    setErrors((e) => (e[field] ? { ...e, [field]: null } : e));
  }, []);

  const startRecording = useCallback(async () => {
    if (!SPEECH_CAPS.getUserMedia || !SPEECH_CAPS.mediaRecorder) {
      setRecordErr(isHt
        ? 'Anrejistreman vwa pa sipòte nan navigatè sa a.'
        : 'Voice recording is not supported in this browser.');
      return;
    }
    setRecordErr('');
    setRecordState('recording');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = [
        'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4',
      ].find((m) => window.MediaRecorder.isTypeSupported(m)) || '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recRef.current = rec;
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        stopTracks();
        setRecordState('uploading');
        try {
          const res = await mediaUploadService.uploadAudio(blob);
          const url = res?.data?.url;
          if (url) setDraftField('referenceAudio', url);
          else setRecordErr(isHt
            ? 'Upload odyo a te fèt men pa t jwenn URL la.'
            : 'The audio uploaded but no URL came back.');
        } catch (e) {
          setRecordErr(e?.response?.data?.error || (isHt
            ? 'Pa t kapab upload odyo a. Tcheke koneksyon an epi eseye ankò.'
            : 'Could not upload the audio. Check your connection and try again.'));
        } finally {
          setRecordState('idle');
        }
      };
      rec.start();
    } catch (err) {
      stopTracks();
      setRecordState('idle');
      const name = err?.name || '';
      setRecordErr(name === 'NotAllowedError' || name === 'PermissionDeniedError'
        ? (isHt ? 'Ou refize aksè mikro a.' : 'Microphone access was denied.')
        : (isHt ? 'Pa t kapab kòmanse anrejistreman an.' : 'Could not start recording.'));
    }
  }, [isHt, stopTracks, setDraftField]);

  const stopRecording = useCallback(() => {
    if (recRef.current && recRef.current.state === 'recording') recRef.current.stop();
    else stopTracks();
  }, [stopTracks]);

  React.useEffect(() => () => stopTracks(), [stopTracks]);

  const startAdd = (type) => {
    const b = newBlock(type);
    setDraft(b);
    setEditingId(null);
    setChoosing(false);
    setErrors({});
  };

  const startEdit = (block) => {
    setDraft({ ...block });
    setEditingId(block.id);
    setChoosing(false);
    setErrors({});
  };

  const saveBlock = () => {
    if (!draft) return;
    const errs = validateBlock(draft);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    if (editingId) {
      onBlocksChange(blocks.map((b) => (b.id === editingId ? draft : b)));
    } else {
      onBlocksChange([...blocks, draft]);
    }
    setDraft(null);
    setEditingId(null);
  };

  const removeBlock = (id) => onBlocksChange(blocks.filter((b) => b.id !== id));

  // Duplicate: an exact copy of the block inserted right after it — the
  // fastest way to build a variation (new target text, same structure).
  const duplicateBlock = (b, i) => {
    onBlocksChange([
      ...blocks.slice(0, i + 1),
      cloneBlock(b, isHt ? 'kopye' : 'copy'),
      ...blocks.slice(i + 1),
    ]);
  };

  const moveBlock = (index, dir) => {
    const next = [...blocks];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onBlocksChange(next);
  };

  const dropBlock = (target) => {
    if (dragIndex == null || dragIndex === target) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const next = [...blocks];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(target, 0, moved);
    onBlocksChange(next);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleTranslate = useCallback(async (field) => {
    const text = draft?.targetText?.trim();
    if (!text) return;
    setTranslateBusy(true);
    try {
      const res = await aiService.translate(text, draft?.translationLang || 'Haitian Creole');
      const translated = typeof res?.data === 'string' ? res.data : res?.data?.translation;
      if (translated) setDraftField('translation', translated);
    } catch (e) { /* translation is optional — creator can type it */ }
    finally { setTranslateBusy(false); }
  }, [draft, setDraftField]);

  return (
    <div className={styles.practiceEditor}>
      <div className={styles.practiceEditorHeader}>
        <span className={styles.practiceEditorTitle}>
          <i className="fas fa-microphone-lines" aria-hidden="true" />
          {t('Language Practice', 'Pratik Lang')}
        </span>
        <button type="button" className={styles.practiceEditorAdd} onClick={() => setChoosing((v) => !v)}>
          <i className="fas fa-plus" aria-hidden="true" /> {t('Add practice', 'Ajoute pratik')}
        </button>
      </div>

      {choosing && (
        <div className={styles.practiceTypes}>
          {PRACTICE_TYPES.map((pt) => (
            <button key={pt.id} type="button" className={styles.practiceTypeOption} onClick={() => startAdd(pt.id)}>
              <span className={styles.practiceTypeOptionIcon}>
                <i className={`fas ${pt.icon}`} aria-hidden="true" />
              </span>
              <span className={styles.practiceTypeOptionText}>
                <span className={styles.practiceTypeOptionTitle}>{isHt ? pt.label.ht : pt.label.en}</span>
                <span className={styles.practiceTypeOptionDesc}>{isHt ? pt.hint.ht : pt.hint.en}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {blocks.map((b, i) => {
        const meta = PRACTICE_TYPES.find((p) => p.id === b.type) || PRACTICE_TYPES[0];
        return (
          <div
            key={b.id}
            data-testid="block-row"
            className={`${styles.practiceBlockRow}${dragIndex === i ? ' is-dragging' : ''}${dragOverIndex === i ? ' is-drag-over' : ''}`}
            draggable
            onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIndex(i); }}
            onDragLeave={() => setDragOverIndex((cur) => (cur === i ? null : cur))}
            onDrop={(e) => { e.preventDefault(); dropBlock(i); }}
            onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
          >
            <span className={styles.practiceBlockRowType}>
              <i className={`fas ${meta.icon}`} aria-hidden="true" />
              {isHt ? meta.label.ht : meta.label.en}
            </span>
            <span className={styles.practiceBlockRowTitle}>
              {b.title || b.targetText || (isHt ? 'Sans tit' : 'Untitled')}
            </span>
            <span className={styles.practiceBlockRowActions}>
              <button type="button" onClick={() => moveBlock(i, -1)} disabled={i === 0} aria-label={t('Move up', 'Monte')}>
                <i className="fas fa-chevron-up" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1} aria-label={t('Move down', 'Desann')}>
                <i className="fas fa-chevron-down" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setPreviewBlock(previewBlock?.id === b.id ? null : b)} aria-label={t('Preview', 'Aperçu')} title={t('Preview as learner', 'Aperçu kòm elèv')}>
                <i className="fas fa-eye" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => duplicateBlock(b, i)} aria-label={t('Duplicate', 'Doublike')} title={t('Duplicate block', 'Doublike blòk')}>
                <i className="fas fa-copy" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => startEdit(b)} aria-label={t('Edit', 'Modifye')}>
                <i className="fas fa-pen" aria-hidden="true" />
              </button>
              <button type="button" className={styles.practiceBlockRowDanger} onClick={() => removeBlock(b.id)} aria-label={t('Delete', 'Efase')}>
                <i className="fas fa-trash" aria-hidden="true" />
              </button>
            </span>
          </div>
        );
      })}

      {blocks.length === 0 && !choosing && (
        <p className={styles.practiceEditorEmpty}>
          {t(
            'Add lesson content (reading, video) or practice activities so students can learn and train.',
            'Ajoute kontni leson (lekti, videyo) oswa aktivite pratik pou elèv yo ka aprann epi antrene.',
          )}
        </p>
      )}

      {/* Preview as learner — the REAL learner-side block renders here. */}
      {previewBlock && (
        <div className={styles.practicePreview}>
          <div className={styles.practicePreviewHeader}>
            <span>
              <i className="fas fa-eye" aria-hidden="true" />
              {t('Preview as learner', 'Aperçu kòm elèv')}
            </span>
            <button type="button" onClick={() => setPreviewBlock(null)} aria-label={t('Close preview', 'Fèmen aperçu')}>
              <i className="fas fa-times" aria-hidden="true" />
            </button>
          </div>
          <LanguagePracticeBlock block={previewBlock} lang={lang} index={0} />
        </div>
      )}

      {draft && (
        <div className={styles.practiceDraft} role="dialog" aria-label={t('Edit practice', 'Modifye pratik')}>
          <div className={styles.practiceDraftHeader}>
            <strong>
              {PRACTICE_TYPES.find((p) => p.id === draft.type)?.label?.[isHt ? 'ht' : 'en']}
            </strong>
            <button type="button" className={styles.practiceDraftClose} onClick={() => { setDraft(null); setEditingId(null); }} aria-label={t('Close', 'Fèmen')}>
              <i className="fas fa-times" aria-hidden="true" />
            </button>
          </div>

          <div className={styles.practiceDraftFields}>
            <label className={styles.practiceDraftField}>
              <span>{t('Title', 'Tit')}</span>
              <input value={draft.title} onChange={(e) => setDraftField('title', e.target.value)} placeholder={t('e.g. Ordering food', 'e.g. Kòmande manje')} maxLength={120} />
            </label>

            <label className={styles.practiceDraftField}>
              <span>{t('Instruction', 'Enstriksyon')}</span>
              <input value={draft.instruction} onChange={(e) => setDraftField('instruction', e.target.value)} placeholder={t('e.g. Listen and repeat the sentence.', 'e.g. Koute epi repete fraz la.')} maxLength={200} />
            </label>

            {draft.type !== 'text' && draft.type !== 'video' && (
              <label className={styles.practiceDraftField}>
                <span className={styles.practiceDraftLabelRow}>
                  {draft.type === 'speaking' ? t('Question', 'Kesyon') : t('Target text', 'Tèks sib')}
                  {errors.targetText && <em className={styles.practiceDraftError}>{t('Required', 'Obligatwa')}</em>}
                  {ttsSupported && (
                    <button type="button" className={styles.practiceDraftAi} onClick={speakTarget} disabled={ttsBusy || !draft.targetText.trim()}>
                      {ttsBusy ? <i className="fas fa-spinner fa-spin" aria-hidden="true" /> : <i className="fas fa-volume-high" aria-hidden="true" />}
                      {t('Preview audio (TTS)', 'Aperçu odyo (TTS)')}
                    </button>
                  )}
                </span>
                <textarea
                  value={draft.targetText}
                  onChange={(e) => setDraftField('targetText', e.target.value)}
                  placeholder={draft.type === 'speaking'
                    ? t('e.g. What did you do yesterday?', 'e.g. Kisa ou te fè yè?')
                    : t('e.g. I would like a chicken sandwich, please.', 'e.g. M ta renmen yon sandwich poul, souple.')}
                  rows={2}
                />
              </label>
            )}

            {draft.type === 'text' && (
              <label className={styles.practiceDraftField}>
                <span className={styles.practiceDraftLabelRow}>
                  {t('Lesson content', 'Kontni leson')}
                  {errors.content && <em className={styles.practiceDraftError}>{t('Required', 'Obligatwa')}</em>}
                </span>
                <textarea
                  value={draft.content || ''}
                  onChange={(e) => setDraftField('content', e.target.value)}
                  placeholder={t('Write the lesson the learner reads… (blank line = new paragraph)', 'Ekri leson an elèv la ap li… (liy vid = nouvo paragraf)')}
                  rows={8}
                />
              </label>
            )}

            {draft.type === 'video' && (
              <label className={styles.practiceDraftField}>
                <span className={styles.practiceDraftLabelRow}>
                  {t('Video URL', 'URL videyo')}
                  {errors.videoUrl && <em className={styles.practiceDraftError}>{t('Required', 'Obligatwa')}</em>}
                </span>
                <input
                  type="url"
                  value={draft.videoUrl || ''}
                  onChange={(e) => setDraftField('videoUrl', e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                />
              </label>
            )}

            {(draft.type === 'repeat' || draft.type === 'pronunciation' || draft.type === 'vocabulary') && (
              <label className={styles.practiceDraftField}>
                <span className={styles.practiceDraftLabelRow}>
                  {t('Translation (learner language)', 'Tradiksyon (lang aprann)')}
                  <button type="button" className={styles.practiceDraftAi} onClick={handleTranslate} disabled={translateBusy || !draft.targetText.trim()}>
                    {translateBusy ? <i className="fas fa-spinner fa-spin" aria-hidden="true" /> : <i className="fas fa-wand-magic-sparkles" aria-hidden="true" />}
                    {t('Translate', 'Tradwi')}
                  </button>
                </span>
                <input value={draft.translation} onChange={(e) => setDraftField('translation', e.target.value)} placeholder={t('Meaning in the learner’s language…', 'Siyifikasyon nan lang aprann lan…')} />
              </label>
            )}

            {draft.type === 'pronunciation' && (
              <label className={styles.practiceDraftField}>
                <span>{t('Pronunciation hint', 'Endikasyon pwononsyasyon')}</span>
                <input value={draft.pronunciationHint} onChange={(e) => setDraftField('pronunciationHint', e.target.value)} placeholder="throo" maxLength={80} />
              </label>
            )}

            {draft.type === 'vocabulary' && (
              <label className={styles.practiceDraftField}>
                <span>{t('Example sentence', 'Fraz egzanp')}</span>
                <input value={draft.example} onChange={(e) => setDraftField('example', e.target.value)} placeholder={t('e.g. I have a doctor’s appointment.', 'e.g. M gen yon randevou doktè.')} maxLength={200} />
              </label>
            )}

            {draft.type === 'listening' && (
              <>
                <label className={styles.practiceDraftField}>
                  <span>{t('Question', 'Kesyon')}</span>
                  <input value={draft.question} onChange={(e) => setDraftField('question', e.target.value)} placeholder={t('e.g. What did you hear?', 'e.g. Kisa ou tande?')} maxLength={200} />
                </label>
                <label className={styles.practiceDraftField}>
                  <span>{t('Expected answer', 'Repons atann')}</span>
                  <input value={draft.answer} onChange={(e) => setDraftField('answer', e.target.value)} placeholder={t('e.g. the train station', 'e.g. estasyon tren an')} maxLength={200} />
                </label>
              </>
            )}

            {draft.type === 'conversation' && (
              <>
                <label className={styles.practiceDraftField}>
                  <span className={styles.practiceDraftLabelRow}>
                    {t('Scenario', 'Senaryo')}
                    {errors.steps && <em className={styles.practiceDraftError}>{t('Every step needs a prompt.', 'Chak etap bezwen yon fraz.')}</em>}
                  </span>
                  <input value={draft.scenario || ''} onChange={(e) => setDraftField('scenario', e.target.value)} placeholder={t('e.g. At a restaurant', 'e.g. Nan yon restoran')} maxLength={120} />
                </label>
                <div className={styles.conversationSteps}>
                  {(draft.steps || []).map((step, si) => (
                    <div key={si} className={styles.conversationStepRow}>
                      <span className={styles.conversationStepNum}>{si + 1}</span>
                      <div className={styles.conversationStepFields}>
                        <input
                          value={step.speaker || ''}
                          onChange={(e) => setDraftField('steps', (draft.steps || []).map((s, i) => (i === si ? { ...s, speaker: e.target.value } : s)))}
                          placeholder={t('Speaker (e.g. Waiter)', 'Moun k ap pale (e.g. Gason)')}
                          maxLength={60}
                        />
                        <input
                          value={step.prompt || ''}
                          onChange={(e) => setDraftField('steps', (draft.steps || []).map((s, i) => (i === si ? { ...s, prompt: e.target.value } : s)))}
                          placeholder={t('Prompt (e.g. “Hello! What would you like?”)', 'Fraz (e.g. “Bonjou! Kisa ou ta renmen?”)')}
                          maxLength={200}
                        />
                      </div>
                      <button
                        type="button"
                        className={styles.conversationStepRemove}
                        onClick={() => setDraftField('steps', (draft.steps || []).filter((_, i) => i !== si))}
                        disabled={(draft.steps || []).length <= 1}
                        aria-label={t('Remove step', 'Retire etap')}
                        title={t('Remove step', 'Retire etap')}
                      >
                        <i className="fas fa-xmark" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={styles.conversationStepAdd}
                    onClick={() => setDraftField('steps', [...(draft.steps || []), { speaker: '', prompt: '' }])}
                  >
                    <i className="fas fa-plus" aria-hidden="true" /> {t('Add step', 'Ajoute etap')}
                  </button>
                </div>
              </>
            )}

            {(draft.type !== 'text' && draft.type !== 'video') && (
            <label className={styles.practiceDraftField}>
              <span className={styles.practiceDraftLabelRow}>
                {t('Reference audio URL', 'URL odyo referans')}
                {errors.referenceAudio && <em className={styles.practiceDraftError}>{t('Required', 'Obligatwa')}</em>}
              </span>
              <input type="url" value={draft.referenceAudio} onChange={(e) => setDraftField('referenceAudio', e.target.value)} placeholder="https://example.com/audio.mp3" />
              <span className={styles.practiceDraftRecordRow}>
                {recordState === 'recording' ? (
                  <button type="button" className={styles.practiceDraftRecord} onClick={stopRecording}>
                    <i className="fas fa-stop" aria-hidden="true" /> {t('Stop recording', 'Kanpe anrejistreman')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.practiceDraftRecord}
                    onClick={startRecording}
                    disabled={recordState === 'uploading'}
                  >
                    {recordState === 'uploading'
                      ? <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                      : <i className="fas fa-microphone" aria-hidden="true" />}
                    {recordState === 'uploading'
                      ? t('Uploading…', 'Ap upload…')
                      : t('Record reference audio', 'Anrejistre odyo referans')}
                  </button>
                )}
                <button
                  type="button"
                  className={styles.practiceDraftLibrary}
                  onClick={() => setLibraryOpen(true)}
                >
                  <i className="fas fa-music" aria-hidden="true" /> {t('Audio Library', 'Bibliyotèk Odyo')}
                </button>
                {recordErr && <em className={styles.practiceDraftError} role="alert">{recordErr}</em>}
              </span>
            </label>
            )}

            {draft.type === 'speaking' && (
              <div className={styles.practiceDraftNote}>
                {t(
                  'Open response — learners answer freely. The system shows the recognized transcript and confidence; it never requires an exact match.',
                  'Repons lib — elèv yo reponn lib. Sistèm nan montre transcript ak konfyans; li pa janm mande yon matche egzak.',
                )}
              </div>
            )}

            <div className={styles.practiceDraftActions}>
              <button type="button" className={styles.practiceDraftCancel} onClick={() => { setDraft(null); setEditingId(null); }}>
                {t('Cancel', 'Anile')}
              </button>
              <button type="button" className={styles.practiceDraftSave} onClick={saveBlock}>
                <i className="fas fa-check" aria-hidden="true" /> {editingId ? t('Save changes', 'Sove chanjman') : t('Add block', 'Ajoute blòk')}
              </button>
            </div>
          </div>
        </div>
      )}

      {libraryOpen && (
        <AudioLibraryModal
          lang={lang}
          onClose={() => setLibraryOpen(false)}
          onSelect={(item) => {
            setDraftField('referenceAudio', item.media_url || item.public_url || '');
            setLibraryOpen(false);
          }}
        />
      )}
    </div>
  );
}
