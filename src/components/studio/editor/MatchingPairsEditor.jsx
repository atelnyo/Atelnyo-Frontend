/**
 * src/components/studio/editor/MatchingPairsEditor.jsx
 *
 * Specialized inline editor for matching block pairs.
 * Replaces the generic JSON textarea with a structured pair editor:
 * each pair has a left item and a right item, with add/remove/reorder.
 *
 * Data shape (matches MatchingBlock expectations):
 *   block.pairs = [{ left, right }, ...]
 */
import React, { useState, useCallback, useRef } from 'react';
import styles from './editor.module.css';

export default function MatchingPairsEditor({ block, onChange, lang = 'ht' }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);

  const pairs = Array.isArray(block.pairs) ? block.pairs : [];
  const [editingPair, setEditingPair] = useState(null); // index of expanded pair
  const dragRef = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  const patch = useCallback((partial) => {
    onChange({ ...block, ...partial });
  }, [block, onChange]);

  // ─── Pairs CRUD ──────────────────────────────────────────────────
  const addPair = useCallback(() => {
    const updated = [...pairs, { left: '', right: '' }];
    patch({ pairs: updated });
    setEditingPair(updated.length - 1);
  }, [pairs, patch]);

  const removePair = useCallback((index) => {
    const updated = pairs.filter((_, i) => i !== index);
    patch({ pairs: updated });
    setEditingPair(null);
  }, [pairs, patch]);

  const updatePair = useCallback((index, field, value) => {
    const updated = pairs.map((p, i) => (i === index ? { ...p, [field]: value } : p));
    patch({ pairs: updated });
  }, [pairs, patch]);

  const movePair = useCallback((index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= pairs.length) return;
    const updated = [...pairs];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    patch({ pairs: updated });
    if (editingPair === index) setEditingPair(target);
    else if (editingPair === target) setEditingPair(index);
  }, [pairs, patch, editingPair]);

  const duplicatePair = useCallback((index) => {
    const src = pairs[index];
    const dup = { left: src.left, right: src.right };
    const updated = [...pairs];
    updated.splice(index + 1, 0, dup);
    patch({ pairs: updated });
    setEditingPair(index + 1);
  }, [pairs, patch]);

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
    const updated = [...pairs];
    const [moved] = updated.splice(src, 1);
    updated.splice(target, 0, moved);
    patch({ pairs: updated });
    if (editingPair === src) setEditingPair(target);
    else if (src < editingPair && target >= editingPair) setEditingPair(editingPair - 1);
    else if (src > editingPair && target <= editingPair) setEditingPair(editingPair + 1);
  }, [pairs, patch, editingPair]);

  // ─── Shuffle toggle ─────────────────────────────────────────────
  const shuffled = Boolean(block.shuffled);
  const toggleShuffle = useCallback(() => {
    patch({ shuffled: !shuffled });
  }, [shuffled, patch]);

  return (
    <div className={styles.matchEditor}>
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className={styles.matchHeader}>
        <span className={styles.matchTitle}>
          <i className="fas fa-link" /> {t('Matching Pairs', 'Pè Asosyasyon')}
          <span className={styles.matchCount}>{pairs.length}</span>
        </span>
        <div className={styles.matchHeaderActions}>
          <button
            type="button"
            className={`${styles.matchShuffleBtn} ${shuffled ? styles.matchShuffleBtnActive : ''}`}
            onClick={toggleShuffle}
            title={t('Trike dwat la pou elèv yo', 'Shuffle right side for learners')}
          >
            <i className="fas fa-shuffle" /> {t('Trike', 'Shuffle')}
          </button>
          <button type="button" className={styles.matchAddBtn} onClick={addPair}>
            <i className="fas fa-plus" /> {t('Ajoute Pè', 'Add Pair')}
          </button>
        </div>
      </div>

      {/* ─── Column labels ──────────────────────────────────────── */}
      {pairs.length > 0 && (
        <div className={styles.matchColumns}>
          <span className={styles.matchColLabel}>{isHt ? 'Gòch' : 'Left'}</span>
          <span className={styles.matchColLabel}>{isHt ? 'Dwat' : 'Right'}</span>
          <span className={styles.matchColSpacer} />
        </div>
      )}

      {/* ─── Pairs list ────────────────────────────────────────── */}
      {pairs.length === 0 ? (
        <p className={styles.matchEmpty}>
          {isHt
            ? 'Pa gen pè ankò. Klike "Ajoute Pè" pou kòmanse.'
            : 'No pairs yet. Click "Add Pair" to start.'}
        </p>
      ) : (
        <div className={styles.matchPairsList}>
          {pairs.map((pair, i) => (
            <div
              key={i}
              className={`${styles.matchPair} ${dragOver === i ? ' is-drag-over' : ''} ${editingPair === i ? ' is-editing' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(i)}
            >
              {editingPair === i ? (
                /* ─── Expanded editor ────────────────────────────── */
                <div className={styles.matchPairEditor}>
                  <div className={styles.matchPairEditorHeader}>
                    <span className={styles.matchPairNumber}>
                      <i className="fas fa-grip-vertical" /> {t('Pè', 'Pair')} {i + 1}
                    </span>
                    <div className={styles.matchPairEditorActions}>
                      <button type="button" className={styles.matchPairDone} onClick={() => setEditingPair(null)}>
                        <i className="fas fa-check" /> {t('Fèmen', 'Done')}
                      </button>
                    </div>
                  </div>

                  <div className={styles.matchPairFields}>
                    <label className={styles.matchField}>
                      <span className={styles.matchFieldLabel}>{isHt ? 'Gòch' : 'Left'}</span>
                      <input
                        type="text"
                        className={styles.matchFieldInput}
                        value={pair.left || ''}
                        onChange={(e) => updatePair(i, 'left', e.target.value)}
                        placeholder={isHt ? 'Mo oswa fraz gòch...' : 'Left word or phrase...'}
                        autoFocus
                      />
                    </label>

                    <span className={styles.matchArrow}><i className="fas fa-arrow-right" /></span>

                    <label className={styles.matchField}>
                      <span className={styles.matchFieldLabel}>{isHt ? 'Dwat' : 'Right'}</span>
                      <input
                        type="text"
                        className={styles.matchFieldInput}
                        value={pair.right || ''}
                        onChange={(e) => updatePair(i, 'right', e.target.value)}
                        placeholder={isHt ? 'Mo oswa fraz dwat...' : 'Right word or phrase...'}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                /* ─── Collapsed preview ──────────────────────────── */
                <div className={styles.matchPairPreview} onClick={() => setEditingPair(i)}>
                  <div className={styles.matchPairDrag}>
                    <i className="fas fa-grip-vertical" />
                  </div>
                  <span className={styles.matchPairBadge}>{i + 1}</span>
                  <span className={styles.matchPairLeft}>
                    {pair.left || <em>{isHt ? 'Vid' : 'Empty'}</em>}
                  </span>
                  <span className={styles.matchPairArrow}><i className="fas fa-arrow-right" /></span>
                  <span className={styles.matchPairRight}>
                    {pair.right || <em>{isHt ? 'Vid' : 'Empty'}</em>}
                  </span>
                  <div className={styles.matchPairActions}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); movePair(i, -1); }}
                      disabled={i === 0}
                      title={isHt ? 'Monte' : 'Move up'}
                    >
                      <i className="fas fa-chevron-up" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); movePair(i, 1); }}
                      disabled={i === pairs.length - 1}
                      title={isHt ? 'Desann' : 'Move down'}
                    >
                      <i className="fas fa-chevron-down" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); duplicatePair(i); }}
                      title={isHt ? 'Diplike' : 'Duplicate'}
                    >
                      <i className="fas fa-copy" />
                    </button>
                    <button
                      type="button"
                      className={styles.matchPairDelete}
                      onClick={(e) => { e.stopPropagation(); removePair(i); }}
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

      {pairs.length > 0 && (
        <p className={styles.matchHint}>
          <i className="fas fa-info-circle" /> {isHt
            ? 'Klike sou yon pè pou modifye l. Trike pou reòdone.'
            : 'Click a pair to edit. Drag to reorder.'}
        </p>
      )}
    </div>
  );
}
