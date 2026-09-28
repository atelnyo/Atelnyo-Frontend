/**
 * src/components/studio/editor/ChecklistItemsEditor.jsx
 *
 * Specialized inline editor for checklist block items.
 * Replaces the generic JSON textarea with a structured item editor:
 * each item has text and a required toggle.
 *
 * Data shape (matches ChecklistBlock expectations):
 *   block.items = [{ text, required }, ...]
 */
import React, { useState, useCallback, useRef } from 'react';
import styles from './editor.module.css';

export default function ChecklistItemsEditor({ block, onChange, lang = 'ht' }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);

  const items = Array.isArray(block.items) ? block.items : [];
  const [editingItem, setEditingItem] = useState(null); // index of expanded item
  const dragRef = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  const patch = useCallback((partial) => {
    onChange({ ...block, ...partial });
  }, [block, onChange]);

  // ─── Items CRUD ──────────────────────────────────────────────────
  const addItem = useCallback(() => {
    const updated = [...items, { text: '', required: true }];
    patch({ items: updated });
    setEditingItem(updated.length - 1);
  }, [items, patch]);

  const removeItem = useCallback((index) => {
    const updated = items.filter((_, i) => i !== index);
    patch({ items: updated });
    setEditingItem(null);
  }, [items, patch]);

  const updateItem = useCallback((index, field, value) => {
    const updated = items.map((it, i) => (i === index ? { ...it, [field]: value } : it));
    patch({ items: updated });
  }, [items, patch]);

  const toggleRequired = useCallback((index) => {
    const updated = items.map((it, i) => (i === index ? { ...it, required: it.required === false ? true : false } : it));
    patch({ items: updated });
  }, [items, patch]);

  const moveItem = useCallback((index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const updated = [...items];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    patch({ items: updated });
    if (editingItem === index) setEditingItem(target);
    else if (editingItem === target) setEditingItem(index);
  }, [items, patch, editingItem]);

  const duplicateItem = useCallback((index) => {
    const src = items[index];
    const dup = { text: src.text, required: src.required };
    const updated = [...items];
    updated.splice(index + 1, 0, dup);
    patch({ items: updated });
    setEditingItem(index + 1);
  }, [items, patch]);

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
    const updated = [...items];
    const [moved] = updated.splice(src, 1);
    updated.splice(target, 0, moved);
    patch({ items: updated });
    if (editingItem === src) setEditingItem(target);
    else if (src < editingItem && target >= editingItem) setEditingItem(editingItem - 1);
    else if (src > editingItem && target <= editingItem) setEditingItem(editingItem + 1);
  }, [items, patch, editingItem]);

  const requiredCount = items.filter((it) => it.required !== false).length;

  return (
    <div className={styles.checkEditor}>
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className={styles.checkHeader}>
        <span className={styles.checkTitle}>
          <i className="fas fa-list-check" /> {t('Checklist Items', 'Bagay Tcheklis')}
          <span className={styles.checkCount}>{items.length}</span>
        </span>
        <button type="button" className={styles.checkAddBtn} onClick={addItem}>
          <i className="fas fa-plus" /> {t('Ajoute Bagay', 'Add Item')}
        </button>
      </div>

      {items.length > 0 && (
        <p className={styles.checkSummary}>
          {requiredCount} {isHt ? 'oblije' : 'required'} · {items.length - requiredCount} {isHt ? 'opsyonèl' : 'optional'}
        </p>
      )}

      {/* ─── Items list ────────────────────────────────────────── */}
      {items.length === 0 ? (
        <p className={styles.checkEmpty}>
          {isHt
            ? 'Pa gen bagay ankò. Klike "Ajoute Bagay" pou kòmanse.'
            : 'No items yet. Click "Add Item" to start.'}
        </p>
      ) : (
        <div className={styles.checkItemsList}>
          {items.map((item, i) => (
            <div
              key={i}
              className={`${styles.checkItem} ${dragOver === i ? ' is-drag-over' : ''} ${editingItem === i ? ' is-editing' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(i)}
            >
              {editingItem === i ? (
                /* ─── Expanded editor ────────────────────────────── */
                <div className={styles.checkItemEditor}>
                  <div className={styles.checkItemEditorHeader}>
                    <span className={styles.checkItemNumber}>
                      <i className="fas fa-grip-vertical" /> {t('Bagay', 'Item')} {i + 1}
                    </span>
                    <div className={styles.checkItemEditorActions}>
                      <button type="button" className={styles.checkItemDone} onClick={() => setEditingItem(null)}>
                        <i className="fas fa-check" /> {t('Fèmen', 'Done')}
                      </button>
                    </div>
                  </div>

                  <div className={styles.checkItemFields}>
                    <label className={styles.checkField}>
                      <span className={styles.checkFieldLabel}>{isHt ? 'Tèks bagay la' : 'Item text'}</span>
                      <input
                        type="text"
                        className={styles.checkFieldInput}
                        value={item.text || ''}
                        onChange={(e) => updateItem(i, 'text', e.target.value)}
                        placeholder={isHt ? 'Ekri bagay la...' : 'Enter item text...'}
                        autoFocus
                      />
                    </label>

                    <label className={styles.checkRequiredToggle}>
                      <input
                        type="checkbox"
                        checked={item.required !== false}
                        onChange={() => toggleRequired(i)}
                      />
                      <span>{isHt ? 'Oblije pou konplete' : 'Required to complete'}</span>
                    </label>
                  </div>
                </div>
              ) : (
                /* ─── Collapsed preview ──────────────────────────── */
                <div className={styles.checkItemPreview} onClick={() => setEditingItem(i)}>
                  <div className={styles.checkItemDrag}>
                    <i className="fas fa-grip-vertical" />
                  </div>
                  <span className={styles.checkItemBadge}>{i + 1}</span>
                  <span className={styles.checkItemText}>
                    {item.text || <em>{isHt ? 'Vid' : 'Empty'}</em>}
                  </span>
                  {item.required !== false && (
                    <span className={styles.checkItemReq}>{isHt ? 'oblije' : 'req'}</span>
                  )}
                  <div className={styles.checkItemActions}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); moveItem(i, -1); }}
                      disabled={i === 0}
                      title={isHt ? 'Monte' : 'Move up'}
                    >
                      <i className="fas fa-chevron-up" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); moveItem(i, 1); }}
                      disabled={i === items.length - 1}
                      title={isHt ? 'Desann' : 'Move down'}
                    >
                      <i className="fas fa-chevron-down" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); duplicateItem(i); }}
                      title={isHt ? 'Diplike' : 'Duplicate'}
                    >
                      <i className="fas fa-copy" />
                    </button>
                    <button
                      type="button"
                      className={styles.checkItemDelete}
                      onClick={(e) => { e.stopPropagation(); removeItem(i); }}
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

      {items.length > 0 && (
       <p className={styles.checkHint}>
          <i className="fas fa-info-circle" /> {isHt
            ? 'Klike sou yon bagay pou modifye l. Trike pou reòdone.'
            : 'Click an item to edit. Drag to reorder.'}
        </p>
      )}
    </div>
  );
}
