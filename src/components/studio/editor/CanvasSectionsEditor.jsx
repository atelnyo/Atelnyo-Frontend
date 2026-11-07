/**
 * src/components/studio/editor/CanvasSectionsEditor.jsx
 *
 * Structured editor for the canvas block's `sections`.
 *
 * Before this, a creator could only get the nine standard Business Model
 * Canvas cells: `block.sections` was accepted by the backend validator but
 * had no UI. Here they can rename a cell, add one, remove one and reorder
 * them (drag or arrows).
 *
 * Data shape written back (what CanvasBlock understands):
 *   block.sections = [{ key, title, hint }, ...]
 * `key` is kept stable across renames, so learner drafts already saved
 * under that key in localStorage are not lost.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import styles from './editor.module.css';
import { DEFAULT_SECTIONS } from '../../learning/blocks/CanvasBlock';

/** Turn whatever is stored into `{ key, title, hint }` strings. */
export function toEditableSections(raw, lang = 'ht') {
  const pick = (value) => {
    if (!value) return '';
    if (typeof value === 'object') return value[lang] || value.ht || value.en || '';
    return String(value);
  };

  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_SECTIONS.map((s) => ({
      key: s.key,
      title: pick(s.title),
      hint: pick(s.hint),
    }));
  }

  return raw.map((section, i) => {
    if (typeof section === 'string') {
      return { key: `section-${i}`, title: section, hint: '' };
    }
    const title = section?.title || section?.name || section?.label || `Section ${i + 1}`;
    return {
      key: section?.key || section?.id || `section-${i}`,
      title: pick(title) || `Section ${i + 1}`,
      hint: pick(section?.hint),
    };
  });
}

let keySeq = 0;
function newKey() {
  keySeq += 1;
  return `section-${Date.now().toString(36)}-${keySeq}`;
}

export default function CanvasSectionsEditor({ block, onChange, lang = 'ht' }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);

  const sections = useMemo(
    () => toEditableSections(block?.sections, lang),
    [block?.sections, lang],
  );

  const dragRef = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  const patch = useCallback((next) => {
    onChange({ ...block, sections: next });
  }, [block, onChange]);

  const update = useCallback((index, field, value) => {
    patch(sections.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }, [sections, patch]);

  const addSection = useCallback(() => {
    patch([
      ...sections,
      { key: newKey(), title: isHt ? 'Nouvo seksyon' : 'New section', hint: '' },
    ]);
  }, [sections, patch, isHt]);

  const removeSection = useCallback((index) => {
    patch(sections.filter((_, i) => i !== index));
  }, [sections, patch]);

  const move = useCallback((index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    patch(next);
  }, [sections, patch]);

  const resetToStandard = useCallback(() => {
    patch(DEFAULT_SECTIONS.map((s) => ({
      key: s.key,
      title: s.title[isHt ? 'ht' : 'en'],
      hint: s.hint[isHt ? 'ht' : 'en'],
    })));
  }, [patch, isHt]);

  const handleDragStart = useCallback((e, index) => {
    dragRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDrop = useCallback((target) => {
    const src = dragRef.current;
    dragRef.current = null;
    setDragOver(null);
    if (src == null || src === target) return;
    const next = [...sections];
    const [moved] = next.splice(src, 1);
    next.splice(target, 0, moved);
    patch(next);
  }, [sections, patch]);

  return (
    <div className={styles.checkEditor}>
      <div className={styles.checkHeader}>
        <span className={styles.checkTitle}>
          <i className="fas fa-table-cells-large" /> {t('Canvas sections', 'Seksyon kannavas la')}
          <span className={styles.checkCount}>{sections.length}</span>
        </span>
        <button type="button" className={styles.checkAddBtn} onClick={addSection}>
          <i className="fas fa-plus" /> {t('Add section', 'Ajoute seksyon')}
        </button>
      </div>

      <div className={styles.checkItemsList}>
        {sections.map((section, i) => (
          <div
            key={section.key}
            className={`${styles.checkItem} ${dragOver === i ? ' is-drag-over' : ''}`}
            draggable
            onDragStart={(e) => handleDragStart(e, i)}
            onDragOver={(e) => { e.preventDefault(); setDragOver(i); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => handleDrop(i)}
          >
            <div className={styles.checkItemEditor}>
              <div className={styles.checkItemEditorHeader}>
                <span className={styles.checkItemNumber}>
                  <i className="fas fa-grip-vertical" aria-hidden="true" /> {t('Section', 'Seksyon')} {i + 1}
                </span>
                <div className={styles.checkItemEditorActions}>
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    title={t('Move up', 'Monte')}
                    aria-label={`${t('Move up', 'Monte')} — ${section.title || i + 1}`}
                  >
                    <i className="fas fa-chevron-up" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === sections.length - 1}
                    title={t('Move down', 'Desann')}
                    aria-label={`${t('Move down', 'Desann')} — ${section.title || i + 1}`}
                  >
                    <i className="fas fa-chevron-down" />
                  </button>
                  <button
                    type="button"
                    className={styles.checkItemDelete}
                    onClick={() => removeSection(i)}
                    title={t('Delete', 'Efase')}
                    aria-label={`${t('Delete', 'Efase')} — ${section.title || i + 1}`}
                  >
                    <i className="fas fa-trash" />
                  </button>
                </div>
              </div>

              <div className={styles.checkItemFields}>
                <label className={styles.checkField}>
                  <span className={styles.checkFieldLabel}>{t('Section name', 'Non seksyon an')}</span>
                  <input
                    type="text"
                    className={styles.checkFieldInput}
                    value={section.title}
                    onChange={(e) => update(i, 'title', e.target.value)}
                    placeholder={t('e.g. Key Partners', 'eg. Patnè Kle')}
                  />
                </label>
                <label className={styles.checkField}>
                  <span className={styles.checkFieldLabel}>{t('Short hint (optional)', 'Ti endikasyon (opsyonèl)')}</span>
                  <input
                    type="text"
                    className={styles.checkFieldInput}
                    value={section.hint}
                    onChange={(e) => update(i, 'hint', e.target.value)}
                    placeholder={t('e.g. Who helps you deliver?', 'eg. Kilès ki ede w delivre?')}
                  />
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      {sections.length === 0 && (
        <p className={styles.checkEmpty}>
          {isHt
            ? 'Pa gen seksyon — elèv yo ap wè 9 seksyon estanda yo.'
            : 'No sections — learners will see the nine standard sections.'}
        </p>
      )}

      <div className={styles.checkHint}>
        <p>
          <i className="fas fa-info-circle" aria-hidden="true" /> {isHt
            ? 'Lè w chanje non yon seksyon, repons elèv yo deja ekri yo rete.'
            : 'Renaming a section keeps answers learners already wrote.'}
        </p>
        <button type="button" className={styles.blockCtrl} onClick={resetToStandard}>
          <i className="fas fa-rotate-left" aria-hidden="true" /> {isHt ? 'Retabli 9 estanda' : 'Restore the 9 standard'}
        </button>
      </div>
    </div>
  );
}
