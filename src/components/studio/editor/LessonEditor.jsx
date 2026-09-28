/**
 * src/components/studio/editor/LessonEditor.jsx
 *
 * Edit content blocks for a single lesson using the backend
 * ContentBlock API (Chapter → Lesson → ContentBlock hierarchy).
 *
 * This replaces the per-module block editing when using the new
 * curriculum system. It reuses BlockRenderer for preview and the
 * block type registry for block metadata.
 *
 * Features:
 *   - Add / reorder / delete content blocks
 *   - Per-block type editing (paragraph, code, image, video, etc.)
 *   - Inline block editor with live preview
 *   - Autosave (debounced) for individual block edits
 *   - Drag-reorder blocks
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { contentBlockService, lessonService } from '../../../services/api';
import { BlockRenderer } from '../../learning/blocks';
import { BLOCK_TYPES, getBlockMeta, getBlockTypesByCategory } from '../../learning/blocks/registry';
import { validateBlock, scoreLessonContent } from '../../learning/blocks/blockSchema';
import useUndoRedo from '../../../hooks/useUndoRedo';
import useKeyboardShortcuts from '../../../hooks/useKeyboardShortcuts';
import MediaPicker from '../../media/MediaPicker';
import AIAssistPanel from './AIAssistPanel';
import styles from './editor.module.css';

/* ─── Build block type list from centralized registry ──────────────── */
function buildBlockTypeList() {
  const categories = getBlockTypesByCategory();
  const list = [];
  for (const [cat, types] of Object.entries(categories)) {
    for (const t of types) {
      list.push({ value: t.type, icon: t.icon, label: t.label, category: cat });
    }
  }
  return list;
}

/* ─── Inline block field editor ───────────────────────────────────── */
function BlockFieldEditor({ block, onChange }) {
  const { content } = block;

  const updateContent = useCallback((key, value) => {
    onChange({ ...content, [key]: value });
  }, [content, onChange]);

  switch (block.block_type) {
    case 'paragraph':
      return (
        <textarea
          className={styles.blockTextarea}
          value={content.text || ''}
          onChange={(e) => updateContent('text', e.target.value)}
          placeholder="Write content..."
          rows={4}
        />
      );
    case 'heading':
      return (
        <div className={styles.blockFields}>
          <input
            className={styles.blockInput}
            value={content.text || ''}
            onChange={(e) => updateContent('text', e.target.value)}
            placeholder="Heading text..."
            maxLength={200}
          />
          <select
            className={styles.blockSelect}
            value={content.level || 'h2'}
            onChange={(e) => updateContent('level', e.target.value)}
          >
            <option value="h1">H1</option>
            <option value="h2">H2</option>
            <option value="h3">H3</option>
            <option value="h4">H4</option>
          </select>
        </div>
      );
    case 'code':
      return (
        <div className={styles.blockFields}>
          <input
            className={styles.blockInput}
            value={content.title || ''}
            onChange={(e) => updateContent('title', e.target.value)}
            placeholder="Code title..."
            maxLength={200}
          />
          <textarea
            className={`${styles.blockTextarea} ${styles.blockTextareaMono}`}
            value={content.code || ''}
            onChange={(e) => updateContent('code', e.target.value)}
            placeholder="# Write code here..."
            rows={8}
          />
          <select
            className={styles.blockSelect}
            value={content.language || 'python'}
            onChange={(e) => updateContent('language', e.target.value)}
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="sql">SQL</option>
            <option value="bash">Bash</option>
            <option value="json">JSON</option>
            <option value="text">Plain Text</option>
          </select>
        </div>
      );
    case 'code_exercise':
      return (
        <div className={styles.blockFields}>
          <input
            className={styles.blockInput}
            value={content.title || ''}
            onChange={(e) => updateContent('title', e.target.value)}
            placeholder="Exercise title..."
            maxLength={200}
          />
          <textarea
            className={styles.blockTextarea}
            value={content.instructions || ''}
            onChange={(e) => updateContent('instructions', e.target.value)}
            placeholder="Instructions for the student..."
            rows={3}
          />
          <textarea
            className={`${styles.blockTextarea} ${styles.blockTextareaMono}`}
            value={content.code || ''}
            onChange={(e) => updateContent('code', e.target.value)}
            placeholder="# Starter code..."
            rows={6}
          />
          <select
            className={styles.blockSelect}
            value={content.language || 'python'}
            onChange={(e) => updateContent('language', e.target.value)}
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
          </select>
        </div>
      );
    case 'image':
      return (
        <div className={styles.blockFields}>
          <div className={styles.blockUrlRow}>
            <input
              className={styles.blockInput}
              value={content.url || ''}
              onChange={(e) => updateContent('url', e.target.value)}
              placeholder="Image URL..."
            />
            <MediaPickerButton onSelect={(media) => {
              updateContent('url', media.url || media.public_url || '');
              if (!content.alt && media.alt_text) updateContent('alt', media.alt_text);
            }} mediaType="image" />
          </div>
          <input
            className={styles.blockInput}
            value={content.alt || ''}
            onChange={(e) => updateContent('alt', e.target.value)}
            placeholder="Alt text (accessibility)..."
          />
          <input
            className={styles.blockInput}
            value={content.caption || ''}
            onChange={(e) => updateContent('caption', e.target.value)}
            placeholder="Caption..."
          />
        </div>
      );
    case 'video':
      return (
        <div className={styles.blockFields}>
          <div className={styles.blockUrlRow}>
            <input
              className={styles.blockInput}
              value={content.url || ''}
              onChange={(e) => updateContent('url', e.target.value)}
              placeholder="Video URL..."
            />
            <MediaPickerButton onSelect={(media) => updateContent('url', media.url || media.public_url || '')} mediaType="video" />
          </div>
          <input
            className={styles.blockInput}
            value={content.title || ''}
            onChange={(e) => updateContent('title', e.target.value)}
            placeholder="Video title..."
          />
        </div>
      );
    case 'audio':
      return (
        <div className={styles.blockFields}>
          <div className={styles.blockUrlRow}>
            <input
              className={styles.blockInput}
              value={content.url || ''}
              onChange={(e) => updateContent('url', e.target.value)}
              placeholder="Audio URL..."
            />
            <MediaPickerButton onSelect={(media) => updateContent('url', media.url || media.public_url || '')} mediaType="audio" />
          </div>
          <input
            className={styles.blockInput}
            value={content.title || ''}
            onChange={(e) => updateContent('title', e.target.value)}
            placeholder="Audio title..."
          />
        </div>
      );
    case 'callout':
      return (
        <div className={styles.blockFields}>
          <textarea
            className={styles.blockTextarea}
            value={content.text || ''}
            onChange={(e) => updateContent('text', e.target.value)}
            placeholder="Callout text..."
            rows={3}
          />
          <select
            className={styles.blockSelect}
            value={content.variant || 'info'}
            onChange={(e) => updateContent('variant', e.target.value)}
          >
            <option value="info">ℹ️ Info</option>
            <option value="tip">💡 Tip</option>
            <option value="warning">⚠️ Warning</option>
            <option value="example">🧪 Example</option>
            <option value="note">📝 Note</option>
          </select>
        </div>
      );
    case 'quote':
      return (
        <div className={styles.blockFields}>
          <textarea
            className={styles.blockTextarea}
            value={content.text || ''}
            onChange={(e) => updateContent('text', e.target.value)}
            placeholder="Quote text..."
            rows={3}
          />
          <input
            className={styles.blockInput}
            value={content.author || ''}
            onChange={(e) => updateContent('author', e.target.value)}
            placeholder="Author (optional)..."
          />
        </div>
      );
    case 'separator':
      return <p className={styles.blockHint}>Horizontal line — no content needed.</p>;
    case 'checklist':
      return (
        <div className={styles.blockFields}>
          {(content.items || []).map((item, i) => (
            <div key={i} className={styles.checklistItem}>
              <input
                className={styles.blockInput}
                value={item.text || ''}
                onChange={(e) => {
                  const items = [...(content.items || [])];
                  items[i] = { ...items[i], text: e.target.value };
                  updateContent('items', items);
                }}
                placeholder={`Item ${i + 1}...`}
              />
              <button
                type="button"
                className={styles.checklistRemove}
                onClick={() => {
                  const items = (content.items || []).filter((_, j) => j !== i);
                  updateContent('items', items);
                }}
              >
                <i className="fas fa-times" />
              </button>
            </div>
          ))}
          <button
            type="button"
            className={styles.checklistAdd}
            onClick={() => updateContent('items', [...(content.items || []), { text: '', checked: false }])}
          >
            <i className="fas fa-plus" /> Add item
          </button>
        </div>
      );
    case 'table':
      return (
        <textarea
          className={`${styles.blockTextarea} ${styles.blockTextareaMono}`}
          value={content.markdown || ''}
          onChange={(e) => updateContent('markdown', e.target.value)}
          placeholder="| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |"
          rows={6}
        />
      );
    case 'file':
      return (
        <div className={styles.blockFields}>
          <div className={styles.blockUrlRow}>
            <input className={styles.blockInput} value={content.url || ''} onChange={(e) => updateContent('url', e.target.value)} placeholder="File URL..." />
            <MediaPickerButton onSelect={(media) => updateContent('url', media.url || media.public_url || '')} mediaType="file" />
          </div>
          <input className={styles.blockInput} value={content.name || ''} onChange={(e) => updateContent('name', e.target.value)} placeholder="File name..." />
        </div>
      );
    case 'embed':
      return (
        <div className={styles.blockFields}>
          <input className={styles.blockInput} value={content.url || ''} onChange={(e) => updateContent('url', e.target.value)} placeholder="Embed URL..." />
          <input className={styles.blockInput} value={content.title || ''} onChange={(e) => updateContent('title', e.target.value)} placeholder="Embed title..." />
        </div>
      );
    default:
      return (
        <textarea
          className={styles.blockTextarea}
          value={JSON.stringify(content, null, 2)}
          onChange={(e) => {
            try { onChange(JSON.parse(e.target.value)); } catch { /* ignore */ }
          }}
          rows={4}
        />
      );
  }
}

/* ─── Single block card ───────────────────────────────────────────── */
function BlockCard({ block, index, isActive, onSelect, onUpdate, onDelete, onMoveUp, onMoveDown, isHt, total }) {
  const meta = getBlockMeta(block.block_type);
  const label = isHt ? meta.label.ht : meta.label.en;

  return (
    <div
      className={`${styles.blockCard} ${isActive ? styles.blockCardActive : ''}`}
      onClick={() => onSelect(block)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(index));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
    >
      <div className={styles.blockCardHeader}>
        <span className={styles.blockCardGrip} title="Drag to reorder">
          <i className="fas fa-grip-vertical" aria-hidden="true" />
        </span>
        <span className={styles.blockCardType}>
          <i className={`fas ${meta.icon}`} aria-hidden="true" /> {label}
        </span>
        <span className={styles.blockCardIndex}>{index + 1}/{total}</span>
        <div className={styles.blockCardControls}>
          <button type="button" className={styles.blockCtrl} onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={index === 0} title="Up">
            <i className="fas fa-chevron-up" />
          </button>
          <button type="button" className={styles.blockCtrl} onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={index === total - 1} title="Down">
            <i className="fas fa-chevron-down" />
          </button>
          <button type="button" className={`${styles.blockCtrl} ${styles.blockCtrlDanger}`} onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete">
            <i className="fas fa-trash" />
          </button>
        </div>
      </div>

      {isActive && (
        <div className={styles.blockCardBody} onClick={(e) => e.stopPropagation()}>
          <BlockFieldEditor
            block={block}
            onChange={(newContent) => onUpdate(block.id, { content: newContent })}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Clipboard helper ───────────────────────────────────────────── */
let _clipboard = null; // In-memory clipboard for block copy/paste

/* ─── Main LessonEditor ───────────────────────────────────────────── */
export default function LessonEditor({ lesson, lang = 'ht', onUpdate, showToast }) {
  const isHt = lang === 'ht';

  // Undo/Redo managed via useUndoRedo — blocks state tracks full history
  const blocksUndo = useUndoRedo([], { maxDepth: 30, pushDelay: 400 });
  const { state: blocks, setState: setBlocks, undo, redo, canUndo, canRedo, pushHistory } = blocksUndo;

  // Raw setter (no history) for initial load
  const [loading, setLoading] = useState(true);
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [lessonTitle, setLessonTitle] = useState(lesson?.title || '');
  const [lessonDesc, setLessonDesc] = useState(lesson?.description || '');
  const [dirty, setDirty] = useState(false);
  const [copySuccess, setCopySuccess] = useState(null);
  const autoSaveRef = useRef(null);

  // ─── Keyboard shortcuts ────────────────────────────────────────
  useKeyboardShortcuts([
    // Undo: Ctrl/Cmd + Z
    { key: 'z', ctrl: true, action: () => { if (canUndo) undo(); } },
    // Redo: Ctrl/Cmd + Shift + Z (or Ctrl+Y)
    { key: 'z', ctrl: true, shift: true, action: () => { if (canRedo) redo(); } },
    { key: 'y', ctrl: true, action: () => { if (canRedo) redo(); } },
    // Save: Ctrl/Cmd + S
    { key: 's', ctrl: true, action: () => { handleSaveLesson(); } },
    // Copy block: Ctrl/Cmd + C (when a block is active)
    { key: 'c', ctrl: true, action: () => { if (activeBlockId) handleCopyBlock(activeBlockId); } },
    // Paste block: Ctrl/Cmd + V
    { key: 'v', ctrl: true, action: () => { if (_clipboard) handlePasteBlock(); } },
    // Duplicate block: Ctrl/Cmd + D
    { key: 'd', ctrl: true, action: () => { if (activeBlockId) handleDuplicateBlock(activeBlockId); } },
    // Delete block: Delete or Backspace (when a block is active, not in input)
    { key: 'Delete', action: () => { if (activeBlockId && !isInputFocused()) handleDeleteBlock(activeBlockId); } },
    // Escape: deselect block
    { key: 'Escape', action: () => { setActiveBlockId(null); setShowTypePicker(false); } },
  ], { enabled: !!lesson?.id });

  /** Check if user is typing in an input/textarea */
  const isInputFocused = () => {
    const el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  };

  /* ─── Load blocks (no history for initial load) ─────────────────── */
  const loadBlocks = useCallback(async () => {
    if (!lesson?.id) { setBlocks([], { pushToHistory: false }); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await contentBlockService.list(lesson.id);
      const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setBlocks(data.sort((a, b) => (a.order || 0) - (b.order || 0)), { pushToHistory: false });
    } catch {
      setBlocks([], { pushToHistory: false });
    } finally {
      setLoading(false);
    }
  }, [lesson?.id, setBlocks]);

  useEffect(() => { loadBlocks(); }, [loadBlocks]);
  useEffect(() => { setLessonTitle(lesson?.title || ''); setLessonDesc(lesson?.description || ''); }, [lesson]);

  /* ─── Autosave lesson metadata ───────────────────────────────────── */
  useEffect(() => {
    if (!dirty || !lesson?.id) return;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(async () => {
      try {
        await lessonService.update(lesson.id, { title: lessonTitle, description: lessonDesc });
        onUpdate?.(lesson.id, { title: lessonTitle, description: lessonDesc });
        setDirty(false);
      } catch {
        // silent
      }
    }, 1500);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [dirty, lessonTitle, lessonDesc, lesson?.id, onUpdate]);

  /* ─── Save lesson metadata ─────────────────────────────────────── */
  const handleSaveLesson = useCallback(async () => {
    if (!lesson?.id) return;
    try {
      await lessonService.update(lesson.id, { title: lessonTitle, description: lessonDesc });
      onUpdate?.(lesson.id, { title: lessonTitle, description: lessonDesc });
      setDirty(false);
      showToast?.(isHt ? '✅ Leson sove!' : '✅ Lesson saved!', 'check-circle');
    } catch {
      showToast?.(isHt ? '❌ Pa t kapab sove.' : '❌ Could not save.', 'circle-exclamation');
    }
  }, [lesson?.id, lessonTitle, lessonDesc, onUpdate, isHt, showToast]);

  /* ─── Clipboard / Copy / Paste / Duplicate ─────────────────────── */
  const handleCopyBlock = useCallback((id) => {
    const block = blocks.find((b) => b.id === id);
    if (!block) return;
    _clipboard = { ...block, content: { ...block.content } };
    setCopySuccess(id);
    setTimeout(() => setCopySuccess(null), 1500);
    showToast?.(isHt ? '📋 Blòk kopye!' : '📋 Block copied!', 'check-circle');
  }, [blocks, isHt, showToast]);

  const handlePasteBlock = useCallback(async () => {
    if (!_clipboard || !lesson?.id) return;
    try {
      const res = await contentBlockService.create({
        lesson: lesson.id,
        block_type: _clipboard.block_type,
        content: { ..._clipboard.content },
        order: blocks.length,
      });
      setBlocks((prev) => [...prev, res.data]);
      setActiveBlockId(res.data.id);
      showToast?.(isHt ? '📋 Blòk kole!' : '📋 Block pasted!', 'check-circle');
    } catch (err) {
      showToast?.(err?.response?.data?.detail || 'Error', 'circle-exclamation');
    }
  }, [lesson?.id, blocks.length, isHt, showToast, setBlocks]);

  const handleDuplicateBlock = useCallback(async (id) => {
    const block = blocks.find((b) => b.id === id);
    if (!block || !lesson?.id) return;
    try {
      const res = await contentBlockService.create({
        lesson: lesson.id,
        block_type: block.block_type,
        content: { ...block.content },
        order: blocks.length,
      });
      setBlocks((prev) => [...prev, res.data]);
      setActiveBlockId(res.data.id);
      showToast?.(isHt ? '📋 Blòk duplike!' : '📋 Block duplicated!', 'check-circle');
    } catch (err) {
      showToast?.(err?.response?.data?.detail || 'Error', 'circle-exclamation');
    }
  }, [blocks, lesson?.id, isHt, showToast, setBlocks]);

  /* ─── Block CRUD ─────────────────────────────────────────────────── */
  const handleAddBlock = useCallback(async (blockType) => {
    setShowTypePicker(false);
    try {
      const res = await contentBlockService.create({
        lesson: lesson.id,
        block_type: blockType,
        content: {},
        order: blocks.length,
      });
      setBlocks((prev) => [...prev, res.data]);
      setActiveBlockId(res.data.id);
    } catch (err) {
      showToast?.(err?.response?.data?.detail || 'Error', 'circle-exclamation');
    }
  }, [lesson?.id, blocks.length, showToast]);

  const handleUpdateBlock = useCallback(async (id, data) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...data } : b)));
    // Debounced save
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(async () => {
      try {
        await contentBlockService.update(id, data);
      } catch {
        // silent — will retry on next edit
      }
    }, 800);
  }, []);

  const handleDeleteBlock = useCallback(async (id) => {
    try {
      await contentBlockService.delete(id);
      setBlocks((prev) => prev.filter((b) => b.id !== id));
      if (activeBlockId === id) setActiveBlockId(null);
    } catch (err) {
      showToast?.(err?.response?.data?.detail || 'Error', 'circle-exclamation');
    }
  }, [activeBlockId, showToast]);

  const handleReorderBlock = useCallback(async (srcIdx, targetIdx) => {
    setBlocks((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(srcIdx, 1);
      arr.splice(targetIdx, 0, moved);
      const items = arr.map((b, i) => ({ id: b.id, order: i }));
      contentBlockService.reorder(lesson.id, items).catch(() => {});
      return arr;
    });
  }, [lesson?.id]);

  if (!lesson) {
    return (
      <div className={styles.lessonEditorEmpty}>
        <i className="fas fa-arrow-left" aria-hidden="true" />
        <p>{isHt ? 'Chwazi yon leson nan kou a pou modifye.' : 'Select a lesson from the course to edit.'}</p>
      </div>
    );
  }

  return (
    <div className={styles.lessonEditor}>
      {/* Lesson header */}
      <div className={styles.lessonEditorHeader}>
        <input
          className={styles.lessonEditorTitle}
          value={lessonTitle}
          onChange={(e) => { setLessonTitle(e.target.value); setDirty(true); }}
          placeholder={isHt ? 'Tit leson...' : 'Lesson title...'}
          maxLength={200}
        />
        <textarea
          className={styles.lessonEditorDesc}
          value={lessonDesc}
          onChange={(e) => { setLessonDesc(e.target.value); setDirty(true); }}
          placeholder={isHt ? 'Deskripsyon leson...' : 'Lesson description...'}
          rows={2}
          maxLength={500}
        />
        {dirty && <span className={styles.savingIndicator}><i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap sove...' : 'Saving...'}</span>}
      </div>

      {/* Undo/Redo toolbar */}
      <div className={styles.editorToolbar}>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${!canUndo ? styles.toolbarBtnDisabled : ''}`}
          onClick={() => canUndo && undo()}
          disabled={!canUndo}
          aria-label={isHt ? 'Anile (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
          title={isHt ? 'Anile (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
        >
          <i className="fas fa-undo" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${!canRedo ? styles.toolbarBtnDisabled : ''}`}
          onClick={() => canRedo && redo()}
          disabled={!canRedo}
          aria-label={isHt ? 'Repeche (Ctrl+Shift+Z)' : 'Redo (Ctrl+Shift+Z)'}
          title={isHt ? 'Repeche (Ctrl+Shift+Z)' : 'Redo (Ctrl+Shift+Z)'}
        >
          <i className="fas fa-redo" aria-hidden="true" />
        </button>
        <span className={styles.toolbarSep} aria-hidden="true" />
        <button
          type="button"
          className={`${styles.toolbarBtn} ${activeBlockId ? '' : styles.toolbarBtnDisabled}`}
          onClick={() => activeBlockId && handleCopyBlock(activeBlockId)}
          disabled={!activeBlockId}
          aria-label={isHt ? 'Kopye blòk (Ctrl+C)' : 'Copy block (Ctrl+C)'}
          title={isHt ? 'Kopye blòk (Ctrl+C)' : 'Copy block (Ctrl+C)'}
        >
          <i className="fas fa-copy" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${_clipboard ? '' : styles.toolbarBtnDisabled}`}
          onClick={() => _clipboard && handlePasteBlock()}
          disabled={!_clipboard}
          aria-label={isHt ? 'Kole blòk (Ctrl+V)' : 'Paste block (Ctrl+V)'}
          title={isHt ? 'Kole blòk (Ctrl+V)' : 'Paste block (Ctrl+V)'}
        >
          <i className="fas fa-paste" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${activeBlockId ? '' : styles.toolbarBtnDisabled}`}
          onClick={() => activeBlockId && handleDuplicateBlock(activeBlockId)}
          disabled={!activeBlockId}
          aria-label={isHt ? 'Duplike blòk (Ctrl+D)' : 'Duplicate block (Ctrl+D)'}
          title={isHt ? 'Duplike blòk (Ctrl+D)' : 'Duplicate block (Ctrl+D)'}
        >
          <i className="fas fa-clone" aria-hidden="true" />
        </button>
        <span className={styles.toolbarSep} aria-hidden="true" />
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={handleSaveLesson}
          aria-label={isHt ? 'Sove leson (Ctrl+S)' : 'Save lesson (Ctrl+S)'}
          title={isHt ? 'Sove leson (Ctrl+S)' : 'Save lesson (Ctrl+S)'}
        >
          <i className="fas fa-save" aria-hidden="true" /> {isHt ? 'Sove' : 'Save'}
        </button>
      </div>

      {/* Blocks */}
      {loading ? (
        <div className={styles.lessonEditorLoading}>
          <i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap chaje blòk yo...' : 'Loading blocks...'}
        </div>
      ) : (
        <div className={styles.lessonEditorBlocks} role="list" aria-label={isHt ? 'Blòk kontni leson an' : 'Lesson content blocks'}>
          {blocks.map((block, i) => (
            <BlockCard
              key={block.id}
              block={block}
              index={i}
              isActive={activeBlockId === block.id}
              onSelect={(b) => setActiveBlockId(activeBlockId === b.id ? null : b.id)}
              onUpdate={handleUpdateBlock}
              onDelete={() => handleDeleteBlock(block.id)}
              onMoveUp={() => { if (i > 0) handleReorderBlock(i, i - 1); }}
              onMoveDown={() => { if (i < blocks.length - 1) handleReorderBlock(i, i + 1); }}
              isHt={isHt}
              total={blocks.length}
            />
          ))}

          {/* Add block button */}
          <div className={styles.addBlockArea}>
            {showTypePicker ? (
              <div className={styles.blockTypePicker}>
                {buildBlockTypeList().map((bt) => (
                  <button
                    key={bt.value}
                    type="button"
                    className={styles.blockTypeBtn}
                    onClick={() => handleAddBlock(bt.value)}
                  >
                    <i className={`fas ${bt.icon}`} aria-hidden="true" />
                    <span>{isHt ? bt.label.ht : bt.label.en}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className={styles.blockTypeCancel}
                  onClick={() => setShowTypePicker(false)}
                >
                  <i className="fas fa-times" /> {isHt ? 'Anile' : 'Cancel'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={styles.addBlockBtn}
                onClick={() => setShowTypePicker(true)}
              >
                <i className="fas fa-plus" aria-hidden="true" />
                {isHt ? 'Ajoute blòk' : 'Add block'}
              </button>
            )}
          </div>

          {blocks.length === 0 && (
            <p className={styles.lessonEditorEmptyHint}>
              {isHt
                ? 'Pa gen blòk ankò. Ajoute premye blòk la pou kòmanse.'
                : 'No blocks yet. Add the first block to start.'}
            </p>
          )}
        </div>
      )}

      {/* AI Assist Panel */}
      {!loading && lesson && (
        <div style={{ padding: '16px 0 0' }}>
          <AIAssistPanel
            lang={lang}
            currentContent={blocks.map((b) => b.content?.text || '').filter(Boolean).join('\n')}
            onInsertContent={(text) => {
              handleAddBlock('paragraph', { text });
            }}
          />
        </div>
      )}
    </div>
  );
}
