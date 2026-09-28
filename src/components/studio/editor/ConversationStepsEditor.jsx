/**
 * src/components/studio/editor/ConversationStepsEditor.jsx
 *
 * Specialized inline editor for conversation block steps.
 * Replaces the generic scenario textarea with a structured step-by-step
 * dialog editor: each step has speaker, prompt, and optional audio.
 *
 * Data shape (matches ConversationPractice expectations):
 *   block.steps = [{ speaker, prompt, audio }, ...]
 *   block.scenario = "..."
 *   block.recognitionLang = "en-US"
 */
import React, { useState, useCallback, useRef } from 'react';
import styles from './editor.module.css';

const DEFAULT_SPEAKER_LABELS = {
  en: { speaker1: 'Speaker A', speaker2: 'Speaker B' },
  ht: { speaker1: 'Moun A', speaker2: 'Moun B' },
};

function newStep(speaker1, speaker2, index) {
  const speaker = index % 2 === 0 ? speaker1 : speaker2;
  return { speaker, prompt: '', audio: '' };
}

export default function ConversationStepsEditor({ block, onChange, lang = 'ht' }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);
  const defaults = DEFAULT_SPEAKER_LABELS[isHt ? 'ht' : 'en'];

  const steps = Array.isArray(block.steps) ? block.steps : [];
  const scenario = block.scenario || '';
  const recognitionLang = block.recognitionLang || 'en-US';

  const [editingStep, setEditingStep] = useState(null); // index of expanded step
  const dragRef = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  const patch = useCallback((partial) => {
    onChange({ ...block, ...partial });
  }, [block, onChange]);

  // ─── Steps CRUD ──────────────────────────────────────────────────
  const addStep = useCallback(() => {
    const next = newStep(defaults.speaker1, defaults.speaker2, steps.length);
    const updated = [...steps, next];
    patch({ steps: updated });
    setEditingStep(updated.length - 1);
  }, [steps, patch, defaults]);

  const removeStep = useCallback((index) => {
    const updated = steps.filter((_, i) => i !== index);
    patch({ steps: updated });
    setEditingStep(null);
  }, [steps, patch]);

  const updateStep = useCallback((index, field, value) => {
    const updated = steps.map((s, i) => (i === index ? { ...s, [field]: value } : s));
    patch({ steps: updated });
  }, [steps, patch]);

  const moveStep = useCallback((index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    const updated = [...steps];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    patch({ steps: updated });
    if (editingStep === index) setEditingStep(target);
    else if (editingStep === target) setEditingStep(index);
  }, [steps, patch, editingStep]);

  const duplicateStep = useCallback((index) => {
    const src = steps[index];
    const dup = { ...src, prompt: src.prompt, audio: src.audio };
    const updated = [...steps];
    updated.splice(index + 1, 0, dup);
    patch({ steps: updated });
    setEditingStep(index + 1);
  }, [steps, patch]);

  // ─── Drag-and-drop ──────────────────────────────────────────────
  const handleDragStart = useCallback((e, idx) => {
    dragRef.current = idx;
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(idx);
  }, []);

  const handleDrop = useCallback((target) => {
    const src = dragRef.current;
    dragRef.current = null;
    setDragOver(null);
    if (src == null || src === target) return;
    const updated = [...steps];
    const [moved] = updated.splice(src, 1);
    updated.splice(target, 0, moved);
    patch({ steps: updated });
    if (editingStep === src) setEditingStep(target);
    else if (src < editingStep && target >= editingStep) setEditingStep(editingStep - 1);
    else if (src > editingStep && target <= editingStep) setEditingStep(editingStep + 1);
  }, [steps, patch, editingStep]);

  return (
    <div className={styles.convEditor}>
      {/* ─── Scenario context ───────────────────────────────────────── */}
      <label className={styles.convField}>
        <span className={styles.convFieldLabel}>
          <i className="fas fa-map-pin" /> {t('Scenario Context', 'Kontèks Senaryo')}
        </span>
        <textarea
          className={styles.convFieldInput}
          value={scenario}
          onChange={(e) => patch({ scenario: e.target.value })}
          placeholder={isHt
            ? 'Dekri sitiyasyon an... (eg: Ou nan yon restoran, ou vle manje.)'
            : 'Describe the situation... (e.g. You are at a restaurant, ordering food.)'}
          rows={2}
        />
      </label>

      {/* ─── Recognition language ─────────────────────────────────── */}
      <label className={styles.convField}>
        <span className={styles.convFieldLabel}>
          <i className="fas fa-language" /> {t('Recognition Language', 'Lang Rekonesans')}
        </span>
        <select
          className={styles.convFieldSelect}
          value={recognitionLang}
          onChange={(e) => patch({ recognitionLang: e.target.value })}
        >
          <option value="en-US">English (US)</option>
          <option value="en-GB">English (UK)</option>
          <option value="fr-FR">Français</option>
          <option value="es-ES">Español</option>
          <option value="ht-HT">Kreyòl Ayisyen</option>
          <option value="pt-BR">Português (BR)</option>
          <option value="de-DE">Deutsch</option>
          <option value="zh-CN">中文</option>
          <option value="ja-JP">日本語</option>
        </select>
      </label>

      {/* ─── Steps header ─────────────────────────────────────────── */}
      <div className={styles.convStepsHeader}>
        <span className={styles.convStepsTitle}>
          <i className="fas fa-comments" /> {t('Dialog Steps', 'Etap Dialog')}
          <span className={styles.convStepsCount}>{steps.length}</span>
        </span>
        <button type="button" className={styles.convAddStep} onClick={addStep}>
          <i className="fas fa-plus" /> {t('Add Step', 'Ajoute Etap')}
        </button>
      </div>

      {/* ─── Steps list ───────────────────────────────────────────── */}
      {steps.length === 0 ? (
        <p className={styles.convEmpty}>
          {isHt
            ? 'Pa gen etap ankò. Klike "Ajoute Etap" pou kreye yon dialog.'
            : 'No steps yet. Click "Add Step" to create a dialog.'}
        </p>
      ) : (
        <div className={styles.convStepsList}>
          {steps.map((step, i) => (
            <div
              key={i}
              className={`${styles.convStep} ${dragOver === i ? ' is-drag-over' : ''} ${editingStep === i ? ' is-editing' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(i)}
            >
              {editingStep === i ? (
                /* ─── Expanded editor ────────────────────────────────── */
                <div className={styles.convStepEditor}>
                  <div className={styles.convStepEditorHeader}>
                    <span className={styles.convStepNumber}>
                      <i className="fas fa-grip-vertical" /> {t('Etap', 'Step')} {i + 1}
                    </span>
                    <div className={styles.convStepEditorActions}>
                      <button type="button" className={styles.convStepDone} onClick={() => setEditingStep(null)}>
                        <i className="fas fa-check" /> {t('Fèmen', 'Done')}
                      </button>
                    </div>
                  </div>

                  <div className={styles.convStepFields}>
                    <label className={styles.convField}>
                      <span className={styles.convFieldLabel}>{t('Ki moun k ap pale', 'Speaker')}</span>
                      <input
                        type="text"
                        className={styles.convFieldInput}
                        value={step.speaker || ''}
                        onChange={(e) => updateStep(i, 'speaker', e.target.value)}
                        placeholder={isHt ? 'eg: Kasye, Kliyan...' : 'e.g. Cashier, Customer...'}
                      />
                    </label>

                    <label className={styles.convField}>
                      <span className={styles.convFieldLabel}>{t('Sa yo di', 'What they say')}</span>
                      <textarea
                        className={styles.convFieldInput}
                        value={step.prompt || ''}
                        onChange={(e) => updateStep(i, 'prompt', e.target.value)}
                        placeholder={isHt ? 'Fraz la...' : 'The line...'}
                        rows={2}
                      />
                    </label>

                    <label className={styles.convField}>
                      <span className={styles.convFieldLabel}>
                        {t('Odyo opsyonèl', 'Optional audio')}
                      </span>
                      <input
                        type="url"
                        className={styles.convFieldInput}
                        value={step.audio || ''}
                        onChange={(e) => updateStep(i, 'audio', e.target.value)}
                        placeholder="https://example.com/audio.mp3"
                      />
                    </label>
                  </div>
                </div>
              ) : (
                /* ─── Collapsed preview ──────────────────────────────── */
                <div className={styles.convStepPreview} onClick={() => setEditingStep(i)}>
                  <div className={styles.convStepDrag}>
                    <i className="fas fa-grip-vertical" />
                  </div>
                  <span className={styles.convStepBadge}>{i + 1}</span>
                  <div className={styles.convStepContent}>
                    <span className={styles.convStepSpeaker}>{step.speaker || t('Moun k ap pale', 'Speaker')}</span>
                    <span className={styles.convStepPrompt}>
                      {step.prompt || <em>{isHt ? 'Pa gen tèks' : 'No text'}</em>}
                    </span>
                  </div>
                  {step.audio && (
                    <span className={styles.convStepAudio}>
                      <i className="fas fa-volume-high" />
                    </span>
                  )}
                  <div className={styles.convStepActions}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); moveStep(i, -1); }}
                      disabled={i === 0}
                      title={isHt ? 'Monte' : 'Move up'}
                    >
                      <i className="fas fa-chevron-up" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); moveStep(i, 1); }}
                      disabled={i === steps.length - 1}
                      title={isHt ? 'Desann' : 'Move down'}
                    >
                      <i className="fas fa-chevron-down" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); duplicateStep(i); }}
                      title={isHt ? 'Diplike' : 'Duplicate'}
                    >
                      <i className="fas fa-copy" />
                    </button>
                    <button
                      type="button"
                      className={styles.convStepDelete}
                      onClick={(e) => { e.stopPropagation(); removeStep(i); }}
                      title={isHt ? 'Efase' : 'Delete'}
                    >
                      <i className="fas fa-trash" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {steps.length > 0 && (
        <p className={styles.convHint}>
          <i className="fas fa-info-circle" /> {isHt
            ? 'Klike sou yon etap pou modifye l. Trike pou reòdone.'
            : 'Click a step to edit. Drag to reorder.'}
        </p>
      )}
    </div>
  );
}
