/**
 * BlockEditor — general-purpose block editing surface for all block types.
 *
 * This is the universal creator-side editor for content blocks inside
 * a course module.  It replaces LanguagePracticeEditor as the single
 * editing surface — supports language blocks AND new types (image,
 * code, assignment, project, callout).
 *
 * Features:
 *   - Block picker (add new blocks by type)
 *   - Inline editing of block properties
 *   - Drag/reorder blocks
 *   - Duplicate / delete blocks
 *   - Live preview of each block
 *
 * Block data shape:
 *   { id, type, title, ...type-specific fields }
 */
import React, { useState, useCallback, useRef } from 'react';
import { BLOCK_TYPES, getBlockTypesByCategory, getBlockMeta } from '../../learning/blocks';
import { BlockRenderer } from '../../learning/blocks';
import ConversationStepsEditor from './ConversationStepsEditor';
import MatchingPairsEditor from './MatchingPairsEditor';
import ChecklistItemsEditor from './ChecklistItemsEditor';
import QuizInlineEditor from './QuizInlineEditor';
import BlockPreview from './BlockPreview';
import useKeyboardShortcuts from '../../../hooks/useKeyboardShortcuts';
import styles from './editor.module.css';

// ─── Block field schemas per type ───────────────────────────────────
const BLOCK_FIELDS = {
  text: [
    { key: 'title', label: { en: 'Title', ht: 'Tit' }, type: 'text' },
    { key: 'content', label: { en: 'Content', ht: 'Kontni' }, type: 'textarea', rows: 6 },
  ],
  image: [
    { key: 'title', label: { en: 'Title', ht: 'Tit' }, type: 'text' },
    { key: 'imageUrl', label: { en: 'Image URL', ht: 'URL Imaj' }, type: 'url' },
    { key: 'caption', label: { en: 'Caption', ht: 'Legend' }, type: 'text' },
    { key: 'alt', label: { en: 'Alt text', ht: 'Tèks alt' }, type: 'text' },
  ],
  video: [
    { key: 'title', label: { en: 'Title', ht: 'Tit' }, type: 'text' },
    { key: 'videoUrl', label: { en: 'Video URL', ht: 'URL Videyo' }, type: 'url' },
    { key: 'description', label: { en: 'Description', ht: 'Deskripsyon' }, type: 'textarea', rows: 2 },
  ],
  callout: [
    { key: 'content', label: { en: 'Note text', ht: 'Tèks nòt' }, type: 'textarea', rows: 3 },
    { key: 'variant', label: { en: 'Type', ht: 'Kalite' }, type: 'select', options: [
      { value: 'info', label: 'ℹ️ Info' },
      { value: 'tip', label: '💡 Tip' },
      { value: 'warning', label: '⚠️ Warning' },
      { value: 'example', label: '🧪 Example' },
      { value: 'note', label: '📝 Note' },
    ]},
  ],
  code: [
    { key: 'title', label: { en: 'Title', ht: 'Tit' }, type: 'text' },
    { key: 'code', label: { en: 'Code', ht: 'Kòd' }, type: 'textarea', rows: 8, mono: true },
    { key: 'language', label: { en: 'Language', ht: 'Langaj' }, type: 'select', options: [
      { value: 'python', label: 'Python' },
      { value: 'javascript', label: 'JavaScript' },
      { value: 'html', label: 'HTML' },
      { value: 'css', label: 'CSS' },
      { value: 'sql', label: 'SQL' },
      { value: '', label: '—' },
    ]},
  ],
  code_exercise: [
    { key: 'title', label: { en: 'Title', ht: 'Tit' }, type: 'text' },
    { key: 'instructions', label: { en: 'Instructions', ht: 'Enstriksyon' }, type: 'textarea', rows: 3 },
    { key: 'code', label: { en: 'Starter code', ht: 'Kòd kòmanse' }, type: 'textarea', rows: 6, mono: true },
    { key: 'language', label: { en: 'Language', ht: 'Langaj' }, type: 'select', options: [
      { value: 'python', label: 'Python' },
      { value: 'javascript', label: 'JavaScript' },
      { value: '', label: '—' },
    ]},
  ],
  assignment: [
    { key: 'title', label: { en: 'Title', ht: 'Tit' }, type: 'text' },
    { key: 'instructions', label: { en: 'Instructions', ht: 'Enstriksyon' }, type: 'textarea', rows: 4 },
    { key: 'dueLabel', label: { en: 'Due label', ht: 'Dat limit' }, type: 'text' },
  ],
  project: [
    { key: 'title', label: { en: 'Title', ht: 'Tit' }, type: 'text' },
    { key: 'description', label: { en: 'Description', ht: 'Deskripsyon' }, type: 'textarea', rows: 4 },
    { key: 'deliverables', label: { en: 'Deliverables (one per line)', ht: 'Livrab (yon pa lin)' }, type: 'textarea', rows: 3 },
  ],
  // Language practice types — share the same fields as LanguagePracticeEditor
  repeat: [
    { key: 'title', label: { en: 'Title', ht: 'Tit' }, type: 'text' },
    { key: 'targetText', label: { en: 'Target phrase', ht: 'Fraz objektif' }, type: 'text' },
    { key: 'translation', label: { en: 'Translation', ht: 'Tradiksyon' }, type: 'text' },
    { key: 'referenceAudio', label: { en: 'Audio URL', ht: 'URL odyo' }, type: 'url' },
  ],
  pronunciation: [
    { key: 'title', label: { en: 'Title', ht: 'Tit' }, type: 'text' },
    { key: 'targetText', label: { en: 'Target word', ht: 'Mo objektif' }, type: 'text' },
    { key: 'pronunciationHint', label: { en: 'Hint', ht: 'Endikasyon' }, type: 'text' },
    { key: 'referenceAudio', label: { en: 'Audio URL', ht: 'URL odyo' }, type: 'url' },
  ],
  vocabulary: [
    { key: 'title', label: { en: 'Title', ht: 'Tit' }, type: 'text' },
    { key: 'targetText', label: { en: 'Word', ht: 'Mo' }, type: 'text' },
    { key: 'translation', label: { en: 'Translation', ht: 'Tradiksyon' }, type: 'text' },
    { key: 'example', label: { en: 'Example', ht: 'Egzanp' }, type: 'text' },
    { key: 'referenceAudio', label: { en: 'Audio URL', ht: 'URL odyo' }, type: 'url' },
  ],
  listening: [
    { key: 'title', label: { en: 'Title', ht: 'Tit' }, type: 'text' },
    { key: 'targetText', label: { en: 'Answer', ht: 'Repons' }, type: 'text' },
    { key: 'referenceAudio', label: { en: 'Audio URL', ht: 'URL odyo' }, type: 'url' },
  ],
  speaking: [
    { key: 'title', label: { en: 'Title', ht: 'Tit' }, type: 'text' },
    { key: 'targetText', label: { en: 'Prompt', ht: 'Kesyon' }, type: 'text' },
    { key: 'referenceAudio', label: { en: 'Audio URL', ht: 'URL odyo' }, type: 'url' },
  ],
  conversation: [],
  // scenario + steps handled by ConversationStepsEditor; title rendered separately
  // Enhanced content blocks (Creator+)
  fill_blank: [
    { key: 'title', label: { en: 'Title', ht: 'Tit' }, type: 'text' },
    { key: 'sentence', label: { en: 'Sentence (use ___ for blank)', ht: 'Fraz (itilize ___ pou vid)' }, type: 'textarea', rows: 2 },
    { key: 'answer', label: { en: 'Answer', ht: 'Repons' }, type: 'text' },
    { key: 'hint', label: { en: 'Hint', ht: 'Endikasyon' }, type: 'text' },
    { key: 'translation', label: { en: 'Translation', ht: 'Tradiksyon' }, type: 'text' },
    { key: 'referenceAudio', label: { en: 'Audio URL', ht: 'URL odyo' }, type: 'url' },
  ],
  matching: [],
  // pairs handled by MatchingPairsEditor; title rendered separately
  resource: [
    { key: 'title', label: { en: 'Title', ht: 'Tit' }, type: 'text' },
    { key: 'description', label: { en: 'Description', ht: 'Deskripsyon' }, type: 'textarea', rows: 2 },
    // Resources are managed as a list — one per line: title | url | type
    { key: 'resources', label: { en: 'Resources (one per line: title | url | type)', ht: 'Resous (yon pa lin: tit | url | kalite)' }, type: 'textarea', rows: 4 },
  ],
  embed: [
    { key: 'title', label: { en: 'Title', ht: 'Tit' }, type: 'text' },
    { key: 'embedUrl', label: { en: 'Embed URL', ht: 'URL Embed' }, type: 'url' },
    { key: 'caption', label: { en: 'Caption', ht: 'Legend' }, type: 'text' },
    { key: 'height', label: { en: 'Height (px)', ht: 'Wotè (px)' }, type: 'text' },
  ],
  checklist: [
    { key: 'description', label: { en: 'Description', ht: 'Deskripsyon' }, type: 'textarea', rows: 2 },
  ],
  // items handled by ChecklistItemsEditor; title rendered separately
  audio_record: [
    { key: 'title', label: { en: 'Title', ht: 'Tit' }, type: 'text' },
    { key: 'prompt', label: { en: 'Prompt / What to say', ht: 'Kesyon / Ki sa pou di' }, type: 'textarea', rows: 2 },
    { key: 'targetText', label: { en: 'Target text', ht: 'Tèks objektif' }, type: 'text' },
    { key: 'hint', label: { en: 'Hint', ht: 'Endikasyon' }, type: 'text' },
    { key: 'referenceAudio', label: { en: 'Reference audio URL', ht: 'URL odyo referans' }, type: 'url' },
  ],
  reflection: [
    { key: 'title', label: { en: 'Title', ht: 'Tit' }, type: 'text' },
    { key: 'prompt', label: { en: 'Prompt', ht: 'Kesyon pou refleksyon' }, type: 'textarea', rows: 3 },
    { key: 'mode', label: { en: 'Mode', ht: 'Mòd' }, type: 'select', options: [
      { value: 'private', label: '🔒 Privé / Private' },
      { value: 'optional', label: '📝 Opsyonèl / Optional' },
      { value: 'saved', label: '💾 Sove / Saved' },
      { value: 'required', label: '⚠️ Obligatwa / Required' },
    ]},
  ],
  // §14-19 — Question blocks (shared foundation)
  multiple_choice: [
    { key: 'title', label: { en: 'Title', ht: 'Tit' }, type: 'text' },
    { key: 'question', label: { en: 'Question', ht: 'Kesyon' }, type: 'textarea', rows: 3 },
    { key: 'description', label: { en: 'Description', ht: 'Deskripsyon' }, type: 'textarea', rows: 2 },
    { key: 'options', label: { en: 'Options (one per line)', ht: 'Opsyon (yon pa lin)' }, type: 'textarea', rows: 4 },
    { key: 'correct', label: { en: 'Correct answer index (0-based)', ht: 'Indèks repons korek (kòmanse a 0)' }, type: 'text' },
    { key: 'explanation', label: { en: 'Explanation', ht: 'Explikasyon' }, type: 'textarea', rows: 2 },
  ],
  multiple_answer: [
    { key: 'title', label: { en: 'Title', ht: 'Tit' }, type: 'text' },
    { key: 'question', label: { en: 'Question', ht: 'Kesyon' }, type: 'textarea', rows: 3 },
    { key: 'description', label: { en: 'Description', ht: 'Deskripsyon' }, type: 'textarea', rows: 2 },
    { key: 'options', label: { en: 'Options (one per line)', ht: 'Opsyon (yon pa lin)' }, type: 'textarea', rows: 4 },
    { key: 'correct', label: { en: 'Correct indices (comma-separated, e.g. 0,2)', ht: 'Indèks korek (separe ak vègoul, eg. 0,2)' }, type: 'text' },
    { key: 'explanation', label: { en: 'Explanation', ht: 'Explikasyon' }, type: 'textarea', rows: 2 },
  ],
  true_false: [
    { key: 'title', label: { en: 'Title', ht: 'Tit' }, type: 'text' },
    { key: 'question', label: { en: 'Statement', ht: 'Deklarasyon' }, type: 'textarea', rows: 3 },
    { key: 'description', label: { en: 'Description', ht: 'Deskripsyon' }, type: 'textarea', rows: 2 },
    { key: 'correct', label: { en: 'Correct answer', ht: 'Repons korek' }, type: 'select', options: [
      { value: 'true', label: '✅ Vrè / True' },
      { value: 'false', label: '❌ Fo / False' },
    ]},
    { key: 'explanation', label: { en: 'Explanation', ht: 'Explikasyon' }, type: 'textarea', rows: 2 },
  ],
};

function generateId(type) {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function newBlock(type) {
  const meta = getBlockMeta(type);
  return {
    id: generateId(type),
    type,
    title: meta.label.en || type,
  };
}

export default function BlockEditor({ blocks = [], onBlocksChange, lang = 'ht', courseId, moduleIndex }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);

  const [showPicker, setShowPicker] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});
  const [previewMode, setPreviewMode] = useState(false);
  const dragRef = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  const categories = getBlockTypesByCategory();

  // Phase 10 — Creator Studio keyboard shortcuts
  // Ctrl+N: open block picker, Delete: delete selected, Ctrl+D: duplicate
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  useKeyboardShortcuts([
    // Ctrl+N — Add new block (open picker)
    { key: 'n', ctrl: true, action: () => { if (!editingId) setShowPicker(true); }, label: 'Add block' },
    // Delete/Backspace — Delete selected block (when not editing a field)
    { key: 'Delete', action: () => {
      if (selectedBlockId && !editingId) handleDelete(selectedBlockId);
    }, label: 'Delete block' },
    { key: 'Backspace', action: () => {
      if (selectedBlockId && !editingId) handleDelete(selectedBlockId);
    }, label: 'Delete block' },
    // Ctrl+D — Duplicate selected block
    { key: 'd', ctrl: true, action: () => {
      if (selectedBlockId && !editingId) {
        const block = blocks.find((b) => b.id === selectedBlockId);
        if (block) handleDuplicate(block);
      }
    }, label: 'Duplicate block' },
    // Ctrl+ArrowUp — Move block up
    { key: 'ArrowUp', ctrl: true, action: () => {
      if (selectedBlockId && !editingId) {
        const idx = blocks.findIndex((b) => b.id === selectedBlockId);
        if (idx > 0) {
          const next = [...blocks];
          [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
          onBlocksChange(next);
        }
      }
    }, label: 'Move block up' },
    // Ctrl+ArrowDown — Move block down
    { key: 'ArrowDown', ctrl: true, action: () => {
      if (selectedBlockId && !editingId) {
        const idx = blocks.findIndex((b) => b.id === selectedBlockId);
        if (idx < blocks.length - 1) {
          const next = [...blocks];
          [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
          onBlocksChange(next);
        }
      }
    }, label: 'Move block down' },
    // Escape — Close picker or editing
    { key: 'Escape', action: () => {
      if (showPicker) setShowPicker(false);
      else if (editingId) handleCancel();
    }, label: 'Close' },
  ], { enabled: true });

  const handleAdd = useCallback((type) => {
    const block = newBlock(type);
    onBlocksChange([...blocks, block]);
    setEditingId(block.id);
    setDraft(block);
    setShowPicker(false);
  }, [blocks, onBlocksChange]);

  const handleEdit = useCallback((block) => {
    setEditingId(block.id);
    const draftData = { ...block };
    // Matching pairs + checklist items now use dedicated editors
    // (work directly with block.pairs / block.items) — no JSON needed.
    setDraft(draftData);
    setPreviewMode(false);
  }, []);

  const handleSave = useCallback(() => {
    if (!editingId) return;
    const finalDraft = { ...draft };
    // Clean up any stale JSON fields from old editors
    delete finalDraft.pairsJson;
    delete finalDraft.itemsJson;
    onBlocksChange(blocks.map((b) => (b.id === editingId ? { ...b, ...finalDraft } : b)));
    setEditingId(null);
    setDraft({});
  }, [editingId, draft, blocks, onBlocksChange]);

  const handleCancel = useCallback(() => {
    setEditingId(null);
    setDraft({});
  }, []);

  // §49 — Block Deletion with confirmation
  const handleDelete = useCallback((id) => {
    const block = blocks.find((b) => b.id === id);
    const label = block?.title || block?.type || id;
    if (!window.confirm(isHt
      ? `Efase blòk "${label}"? Sa pa ka defèt.`
      : `Delete block "${label}"? This cannot be undone.`)) return;
    onBlocksChange(blocks.filter((b) => b.id !== id));
    if (editingId === id) { setEditingId(null); setDraft({}); }
  }, [blocks, onBlocksChange, editingId, isHt]);

  const handleDuplicate = useCallback((block) => {
    const dup = { ...block, id: generateId(block.type), title: `${block.title || ''} (copy)` };
    const idx = blocks.findIndex((b) => b.id === block.id);
    const next = [...blocks];
    next.splice(idx + 1, 0, dup);
    onBlocksChange(next);
  }, [blocks, onBlocksChange]);

  // ─── Drag/reorder ─────────────────────────────────────────────────
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
    const next = [...blocks];
    const [moved] = next.splice(src, 1);
    next.splice(target, 0, moved);
    onBlocksChange(next);
  }, [blocks, onBlocksChange]);

  const handleFieldChange = useCallback((key, value) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  const editingBlock = blocks.find((b) => b.id === editingId);
  const fields = editingBlock ? (BLOCK_FIELDS[editingBlock.type] || []) : [];

  return (
    <div className={styles.blockEditor}>
      {/* ─── Block list ─────────────────────────────────────────────── */}
      <div className={styles.blockListHeader}>
        <span className={styles.blockListTitle}>
          <i className="fas fa-puzzle-piece" /> {t('Content Blocks', 'Blok Kontni')}
          <span className={styles.blockListCount}>{blocks.length}</span>
        </span>
        <button
          type="button"
          className={styles.blockAddBtn}
          onClick={() => setShowPicker(!showPicker)}
          aria-label={t('Add Block (Ctrl+N)', 'Ajoute Blok (Ctrl+N)')}
          title={t('Ctrl+N', 'Ctrl+N')}
        >
          <i className="fas fa-plus" aria-hidden="true" /> {t('Add Block', 'Ajoute Blok')}
          <span className="sr-only">{t('Ctrl+N', 'Ctrl+N')}</span>
        </button>
      </div>

      {/* ─── Block picker ───────────────────────────────────────────── */}
      {showPicker && (
        <div className={styles.blockPicker}>
          {Object.entries(categories).map(([cat, items]) => (
            <div key={cat} className={styles.blockPickerGroup}>
              <div className={styles.blockPickerCat}>
                {cat === 'content' ? '📄' : cat === 'practice' ? '🎯' : cat === 'assessment' ? '📝' : cat === 'code' ? '💻' : '📦'}
                {' '}{cat.charAt(0).toUpperCase() + cat.slice(1)}
              </div>
              {items.map((item) => (
                <button key={item.type} type="button" className={styles.blockPickerItem} onClick={() => handleAdd(item.type)}>
                  <i className={`fas ${item.icon}`} />
                  <span>{item.label[lang] || item.label.en}</span>
                </button>
              ))}
            </div>
          ))}
          <button type="button" className={styles.blockPickerClose} onClick={() => setShowPicker(false)}>
            {t('Fèmen', 'Close')}
          </button>
        </div>
      )}

      {/* ─── Existing blocks ────────────────────────────────────────── */}
      {blocks.map((block, idx) => (
        <div
          key={block.id}
          className={`${styles.blockItem} ${dragOver === idx ? ' is-drag-over' : ''} ${editingId === block.id ? ' is-editing' : ''} ${selectedBlockId === block.id ? ' is-selected' : ''}`}
          draggable
          onClick={() => setSelectedBlockId(block.id)}
          onDragStart={(e) => handleDragStart(e, idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDragLeave={() => setDragOver(null)}
          onDrop={() => handleDrop(idx)}
          role="button"
          tabIndex={0}
          aria-label={`${getBlockMeta(block.type).label[lang] || block.type}: ${block.title || ''}${selectedBlockId === block.id ? ' — selected' : ''}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleEdit(block);
            }
          }}
        >
          {editingId === block.id ? (
            /* ─── Inline editor ──────────────────────────────────────── */
            <div className={styles.blockEditorForm}>
              <div className={styles.blockEditorHeader}>
                <span className={styles.blockEditorType}>
                  <i className={`fas ${getBlockMeta(block.type).icon}`} /> {getBlockMeta(block.type).label[lang] || block.type}
                </span>
                <div className={styles.blockEditorActions}>
                  {/* Edit/Preview toggle */}
                  <div className={styles.blockPreviewToggle}>
                    <button
                      type="button"
                      className={`${styles.blockPreviewToggleBtn} ${!previewMode ? styles.blockPreviewToggleBtnActive : ''}`}
                      onClick={() => setPreviewMode(false)}
                    >
                      <i className="fas fa-pen" aria-hidden="true" /> {t('Editè', 'Edit')}
                    </button>
                    <button
                      type="button"
                      className={`${styles.blockPreviewToggleBtn} ${previewMode ? styles.blockPreviewToggleBtnActive : ''}`}
                      onClick={() => setPreviewMode(true)}
                    >
                      <i className="fas fa-eye" aria-hidden="true" /> {t('Gade', 'Preview')}
                    </button>
                  </div>
                  <button type="button" onClick={handleSave} className={styles.blockSaveBtn}>{t('Sove', 'Save')}</button>
                  <button type="button" onClick={handleCancel} className={styles.blockCancelBtn}>{t('Anile', 'Cancel')}</button>
                </div>
              </div>
              {/* ─── Preview mode vs Edit mode ──────────────────────── */}
              {previewMode ? (
                <>
                  <div className={styles.blockPreviewBadge}>
                    <i className="fas fa-eye" aria-hidden="true" /> {isHt ? 'Gade kòman elèv yo wè l' : 'Preview how learners see this'}
                  </div>
                  <BlockPreview
                    block={draft}
                    lang={lang}
                    courseId={courseId}
                    moduleIndex={moduleIndex}
                  />
                  <p className={styles.blockPreviewNote}>
                    <i className="fas fa-info-circle" aria-hidden="true" />
                    {isHt ? 'Sa a se yon apèsi. Chanjman pa sove yo pa parèt isit la.' : 'This is a preview. Unsaved changes do not appear here.'}
                  </p>
                </>
              ) : (
              <>
              {/* Conversation blocks: title + specialized steps editor */}
              {block.type === 'conversation' ? (
                <>
                  <label className={styles.blockField}>
                    <span className={styles.blockFieldLabel}>{t('Tit', 'Title')}</span>
                    <input
                      type="text"
                      className={styles.blockFieldInput}
                      value={draft.title || ''}
                      onChange={(e) => handleFieldChange('title', e.target.value)}
                    />
                  </label>
                  <ConversationStepsEditor
                    block={draft}
                    onChange={(updated) => setDraft(updated)}
                    lang={lang}
                  />
                </>
              ) : block.type === 'matching' ? (
                <>
                  <label className={styles.blockField}>
                    <span className={styles.blockFieldLabel}>{t('Tit', 'Title')}</span>
                    <input
                      type="text"
                      className={styles.blockFieldInput}
                      value={draft.title || ''}
                      onChange={(e) => handleFieldChange('title', e.target.value)}
                    />
                  </label>
                  <MatchingPairsEditor
                    block={draft}
                    onChange={(updated) => setDraft(updated)}
                    lang={lang}
                  />
                </>
              ) : block.type === 'checklist' ? (
                <>
                  <label className={styles.blockField}>
                    <span className={styles.blockFieldLabel}>{t('Tit', 'Title')}</span>
                    <input
                      type="text"
                      className={styles.blockFieldInput}
                      value={draft.title || ''}
                      onChange={(e) => handleFieldChange('title', e.target.value)}
                    />
                  </label>
                  <ChecklistItemsEditor
                    block={draft}
                    onChange={(updated) => setDraft(updated)}
                    lang={lang}
                  />
                </>
              ) : block.type === 'quiz' ? (
                <QuizInlineEditor
                  block={draft}
                  onChange={(updated) => setDraft(updated)}
                  lang={lang}
                  courseId={courseId}
                  moduleIndex={moduleIndex}
                />
              ) : (
                fields.map((field) => (
                  <label key={field.key} className={styles.blockField}>
                    <span className={styles.blockFieldLabel}>{field.label[lang] || field.label.en}</span>
                    {field.type === 'textarea' ? (
                      <textarea
                        className={`${styles.blockFieldInput} ${field.mono ? styles.blockFieldMono : ''}`}
                        value={draft[field.key] || ''}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        rows={field.rows || 3}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        className={styles.blockFieldInput}
                        value={draft[field.key] || ''}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      >
                        {field.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type === 'url' ? 'url' : 'text'}
                        className={styles.blockFieldInput}
                        value={draft[field.key] || ''}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      />
                    )}
                  </label>
                ))
              )}
              </>
              )}
            </div>
          ) : (
            /* ─── Block preview (collapsed) ──────────────────────────── */
            <div className={styles.blockPreview} onClick={() => handleEdit(block)}>
              <div className={styles.blockDragHandle}>
                <i className="fas fa-grip-vertical" />
              </div>
              <div className={styles.blockPreviewContent}>
                <span className={styles.blockPreviewType}>
                  <i className={`fas ${getBlockMeta(block.type).icon}`} />
                </span>
                <span className={styles.blockPreviewTitle}>{block.title || getBlockMeta(block.type).label[lang]}</span>
                <span className={styles.blockPreviewId}>{block.id}</span>
              </div>
              <div className={styles.blockPreviewActions}>
                <button type="button" onClick={(e) => { e.stopPropagation(); handleDuplicate(block); }} title={t('Diplike', 'Duplicate')}>
                  <i className="fas fa-copy" />
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(block.id); }} title={t('Efase', 'Delete')} className={styles.blockDeleteBtn}>
                  <i className="fas fa-trash" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {blocks.length === 0 && !showPicker && (
        <p className={styles.blockEmpty}>
          {t('Pa gen bloc ankò. Klike "Ajoute Blok" pou kòmanse.', 'No blocks yet. Click "Add Block" to start.')}
        </p>
      )}
    </div>
  );
}
