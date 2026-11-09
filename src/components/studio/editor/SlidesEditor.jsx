/**
 * src/components/studio/editor/SlidesEditor.jsx
 * 
 * Advanced presentation slide editor with full element manipulation,
 * grouping, selection handles, text controls, and undo/redo support.
 * 
 * Data shape written back (what SlidesBlock understands):
 *   block.slides = [{ title, body, imageUrl, alt, backgroundColor, elements: [{type, ...}], theme, autoplaySeconds }, ...]
 *   block.audioUrl        — optional background music
 *   block.autoplaySeconds — 0 = learner-driven
 *   block.theme           — 'brand' | 'light' | 'dark'
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUndoRedo } from '../../../hooks/useUndoRedo';
import { useKeyboardShortcuts } from '../../../hooks/useKeyboardShortcuts';
import styles from './editor.module.css';
import AudioLibraryModal from './AudioLibraryModal';

/* ─── Icon definitions ───────────────────────────────────────────── */
const Icon = ({ name, className, title }) => (
  <i className={`fas fa-${name} ${className || ''}`} aria-hidden="true" title={title} />
);

/* ─── Normalize slides raw data ─────────────────────────────────── */
function normalizeSlides(raw, fallbackTheme = 'brand') {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ title: '', body: '', imageUrl: '', alt: '', elements: [], backgroundColor: '#ffffff', theme: fallbackTheme, autoplaySeconds: 0 }];
  }
  return raw.map((s) => {
    if (!s) return { title: '', body: '', imageUrl: '', alt: '', elements: [], backgroundColor: '#ffffff', theme: fallbackTheme, autoplaySeconds: 0 };
    if (typeof s === 'string') return { title: '', body: s, imageUrl: '', alt: '', elements: [], backgroundColor: '#ffffff', theme: fallbackTheme, autoplaySeconds: 0 };
    return {
      title: typeof s.title === 'string' ? s.title : '',
      body: typeof s.body === 'string' ? s.body : (Array.isArray(s.bullets) ? s.bullets.map((b) => `- ${b}`).join('\n') : ''),
      imageUrl: s.imageUrl || '',
      alt: s.alt || '',
      backgroundColor: s.backgroundColor || '#ffffff',
      theme: s.theme || fallbackTheme,
      autoplaySeconds: Number(s.autoplaySeconds) || 0,
      // Preserve existing elements, add default empty ones if needed
      elements: Array.isArray(s.elements) ? s.elements : [],
    };
  });
}

/* ─── Deck themes ───────────────────────────────────────────────── */
// Mirrors the learner deck (SlidesBlock.css): dark and light repaint the
// slide canvas, while brand keeps the creator's own background and only
// tints the frame + accents.
const SLIDE_THEMES = {
  brand: {
    frame: '#fff7fa',
    border: '#f3c6d8',
    canvas: null,
    ink: '#1f2937',
    muted: '#6b7280',
    headerBorder: '#f3d6e2',
    accent: 'var(--color-primary, #d81b60)',
  },
  light: {
    frame: '#eef2f7',
    border: '#dbe3ec',
    canvas: '#f8fafc',
    ink: '#111827',
    muted: '#4b5563',
    headerBorder: '#e2e8f0',
    accent: '#0f172a',
  },
  dark: {
    frame: '#0b1220',
    border: '#1f2937',
    canvas: '#111827',
    ink: '#f9fafb',
    muted: '#cbd5e1',
    headerBorder: '#1f2937',
    accent: '#ff6f9c',
  },
};

/* ─── Element types ─────────────────────────────────────────────── */
const ELEMENT_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  ICON: 'icon',
  SHAPE: 'shape',
  LINE: 'line',
  CHART: 'chart',
  TABLE: 'table',
  DIAGRAM: 'diagram',
};

/* ─── Default element styles ─────────────────────────────────────── */
const defaultElement = {
  id: Date.now().toString() + Math.random().toString(36).substr(2),
  type: ELEMENT_TYPES.TEXT,
  text: 'Add text',
  fontFamily: 'sans-serif',
  fontSize: '24px',
  fontWeight: 'normal',
  color: '#000000',
  textAlign: 'left',
  lineHeight: '1.5',
  letterSpacing: '0px',
  backgroundColor: 'transparent',
  // Position & size
  x: 0,
  y: 0,
  width: 200,
  height: 50,
  // Rotation
  rotation: 0,
  // Selection & styling
  selected: false,
  locked: false,
};

/* ─── Slide editor component ─────────────────────────────────────── */
export default function SlidesEditor({ block, onChange, lang = 'ht' }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht || en : en);

  const normalizedSlides = useMemo(
    () => normalizeSlides(block?.slides, block?.theme),
    [block?.slides, block?.theme]
  );
  const dragRef = useRef(null);
  const [dragOver, setDragOver] = useState(null);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(-1);
  const [selectedElementIndex, setSelectedElementIndex] = useState(-1);

  /* ─── Undo/Redo over the full deck ─────────────────────────────── */
  // History tracks the slides array itself, so undo/redo restores the
  // exact deck the creator saw (elements, order, titles, theme).
  const {
    state: slides,
    setState: setSlides,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useUndoRedo(normalizedSlides, { maxDepth: 100, pushDelay: 0 });

  // Pick up external deck changes (parent swapped the block) without
  // recording them as edits in the local history.
  const incomingSlidesRef = useRef(normalizedSlides);
  useEffect(() => {
    if (incomingSlidesRef.current === normalizedSlides) return;
    incomingSlidesRef.current = normalizedSlides;
    setSlides(normalizedSlides, { pushToHistory: false });
  }, [normalizedSlides, setSlides]);

  /* ─── Slide-level state ──────────────────────────────────────── */
  const [theme, setTheme] = useState(block?.theme || 'brand');
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showMusicModal, setShowMusicModal] = useState(false);

  /* ─── Patch slides ───────────────────────────────────────────── */
  const patchSlides = useCallback((next) => {
    setSlides(next);
    onChange({ ...block, slides: next });
  }, [block, onChange, setSlides]);

  const handleUndo = useCallback(() => {
    const prev = undo();
    if (prev !== undefined) onChange({ ...block, slides: prev });
  }, [undo, block, onChange]);

  const handleRedo = useCallback(() => {
    const next = redo();
    if (next !== undefined) onChange({ ...block, slides: next });
  }, [redo, block, onChange]);

  const applyTheme = useCallback((value) => {
    setTheme(value);
    const next = slides.map((s) => ({ ...s, theme: value }));
    setSlides(next);
    onChange({ ...block, theme: value, slides: next });
  }, [slides, setSlides, block, onChange]);

  const applyAudio = useCallback((item) => {
    onChange({ ...block, audioUrl: item?.media_url || '' });
    setShowMusicModal(false);
  }, [block, onChange]);

  const updateSlide = useCallback((slideIndex, field, value) => {
    const next = slides.map((s, i) => (i === slideIndex ? { ...s, [field]: value } : s));
    patchSlides(next);
  }, [slides, patchSlides]);

  const addSlide = useCallback(() => {
    patchSlides([
      ...slides,
      {
        title: '',
        body: '',
        imageUrl: '',
        alt: '',
        elements: [JSON.parse(JSON.stringify(defaultElement))],
        backgroundColor: '#ffffff',
        theme: 'brand',
        autoplaySeconds: 0,
      },
    ]);
  }, [slides, patchSlides]);

  const removeSlide = useCallback((index) => {
    patchSlides(slides.filter((_, i) => i !== index));
  }, [slides, patchSlides]);

  const moveSlide = useCallback((index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    [next[index], next[target]] = [next[target], next[index]];
    patchSlides(next);
  }, [slides, patchSlides]);

  /* ─── Element-level undo/redo ─────────────────────────────────── */
  /* Elements state is managed via useUndoRedo at the slide level */
  /* Each slide's elements array is the undo-redo state unit */

  /* ─── Add element ─────────────────────────────────────────────── */
  const addElement = useCallback((slideIndex, elementType) => {
    const next = slides.map((s, i) =>
      i === slideIndex
        ? {
            ...s,
            elements: [
              ...(s.elements || []),
              { ...defaultElement, type: elementType, id: Date.now().toString() + Math.random().toString(36).substr(2) },
            ],
          }
        : s
    );
    patchSlides(next);
  }, [slides, patchSlides]);

  /* ─── Remove element ──────────────────────────────────────────── */
  const removeElement = useCallback((slideIndex, elementIndex) => {
    const next = slides.map((s, i) =>
      i === slideIndex
        ? {
            ...s,
            elements: s.elements.filter((_, idx) => idx !== elementIndex),
          }
        : s
    );
    patchSlides(next);
  }, [slides, patchSlides]);

  /* ─── Duplicate element ───────────────────────────────────────── */
  const duplicateElement = useCallback((slideIndex, elementIndex) => {
    const next = slides.map((s, i) =>
      i === slideIndex
        ? {
            ...s,
            elements: [
              ...s.elements.map((el, idx) =>
                idx === elementIndex
                  ? { ...el, id: Date.now().toString() + Math.random().toString(36).substr(2), selected: true }
                  : el
              ),
            ],
          }
        : s
    );
    patchSlides(next);
  }, [slides, patchSlides]);

  /* ─── Bring forward / Send backward ───────────────────────────── */
  const bringForward = useCallback((slideIndex, elementIndex) => {
    const next = slides.map((s, i) =>
      i !== slideIndex ? s : {
        ...s,
        elements: s.elements.map((el, idx) =>
          idx === elementIndex ? { ...el, zIndex: (s.elements[elementIndex]?.zIndex || 0) + 1 } : el
        ),
      }
    );
    patchSlides(next);
  }, [slides, patchSlides]);

  const sendBackward = useCallback((slideIndex, elementIndex) => {
    const next = slides.map((s, i) =>
      i !== slideIndex ? s : {
        ...s,
        elements: s.elements.map((el, idx) =>
          idx === elementIndex ? { ...el, zIndex: Math.max(0, (s.elements[elementIndex]?.zIndex || 1) - 1) } : el
        ),
      }
    );
    patchSlides(next);
  }, [slides, patchSlides]);

  /* ─── Toggle lock ─────────────────────────────────────────────── */
  const toggleLock = useCallback((slideIndex, elementIndex) => {
    const next = slides.map((s, i) =>
      i !== slideIndex ? s : {
        ...s,
        elements: s.elements.map((el, idx) =>
          idx === elementIndex ? { ...el, locked: !el.locked } : el
        ),
      }
    );
    patchSlideElements(next, slideIndex);
  }, [slides, patchSlideElements]);

  /* ─── Group / Ungroup ─────────────────────────────────────────── */
  const toggleGroup = useCallback((slideIndex, elementIndices) => {
    const next = slides.map((s, i) =>
      i !== slideIndex ? s : {
        ...s,
        elements: s.elements.map((el, idx) =>
          elementIndices.includes(idx) ? { ...el, grouped: !el.grouped } : el
        ),
      }
    );
    patchSlideElements(next, slideIndex);
  }, [slides, patchSlideElements]);

  /* ─── Patch slide elements ────────────────────────────────────── */
  const patchSlideElements = useCallback((newElements, slideIndex) => {
    const next = slides.map((s, j) =>
      j !== slideIndex ? s : { ...s, elements: newElements }
    );
    patchSlides(next);
  }, [slides, patchSlides]);

  /* ─── Element keyboard shortcuts ──────────────────────────────── */
  useKeyboardShortcuts([
    { key: 'z', ctrl: true, action: handleUndo },              // Ctrl+Z / Cmd+Z
    { key: 'y', ctrl: true, action: handleRedo },              // Ctrl+Y / Cmd+Y
    { key: 'z', ctrl: true, shift: true, action: handleRedo }, // Ctrl+Shift+Z / Cmd+Shift+Z
    {
      key: 'Delete',
      action: () => {
        if (selectedElementIndex >= 0 && selectedSlideIndex >= 0) {
          removeElement(selectedSlideIndex, selectedElementIndex);
        }
      },
    },
    {
      key: 'd',
      ctrl: true,
      action: () => {
        if (selectedElementIndex >= 0 && selectedSlideIndex >= 0) {
          duplicateElement(selectedSlideIndex, selectedElementIndex);
        }
      },
    },
    {
      key: 'Escape',
      action: () => {
        setSelectedElementIndex(-1);
        setSelectedSlideIndex(-1);
      },
    },
  ]);

  /* ─── Element change handlers ─────────────────────────────────── */
  const handleElementChange = useCallback((slideIndex, elementIndex, field, value) => {
    const next = slides.map((s, i) =>
      i !== slideIndex ? s : { ...s, elements: s.elements.map((el, idx) => (idx === elementIndex ? { ...el, [field]: value } : el) ) }
    );
    patchSlideElements(next, slideIndex);
  }, [patchSlideElements]);

  /* ─── Slide change handlers ───────────────────────────────────── */
  const handleSlideChange = useCallback((slideIndex, field, value) => {
    updateSlide(slideIndex, field, value);
  }, [updateSlide]);

  /* ─── Render ──────────────────────────────────────────────────── */
  /* Element rendering constants */
  const SNAP_GRID = 8;
  const RESIZE_HANDLE_SIZE = 8;
  const SELECTION_STROKE = 2;
  const SELECTED_STROKE = 3;

  /* ─── Get element by type ─────────────────────────────────────── */
  function getElementByType(slideIndex, type) {
    const elements = slides[slideIndex]?.elements || [];
    return elements.find((e) => e.type === type);
  }

  /* ─── Render slide ────────────────────────────────────────────── */
  function renderSlide(slide, slideIndex) {
    const elements = slide.elements || [];
    const slideTheme = SLIDE_THEMES[block?.theme] || SLIDE_THEMES[slide.theme] || SLIDE_THEMES.brand;
    const canvasBackground = slideTheme.canvas || slide.backgroundColor || '#ffffff';

    /* ─── Calculate bouding box for snap guides ─────────────────── */
    const allElements = elements.filter((e) => !e.locked || e.selected);
    const bounds = allElements.reduce(
      (acc, e) => {
        const ex = e.x || 0;
        const ey = e.y || 0;
        const ew = (e.width || 0) + (e.x || 0);
        const eh = (e.height || 0) + (e.y || 0);
        return {
          minX: Math.min(acc.minX, ex),
          minY: Math.min(acc.minY, ey),
          maxX: Math.max(acc.maxX, ew),
          maxY: Math.max(acc.maxY, eh),
        };
      },
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    );

    return (
      <div
        key={`slide-${slideIndex}`}
        className={`slide-editor-slide ${selectedSlideIndex === slideIndex ? 'selected' : ''}`}
        style={{
          position: 'relative', width: '100%', minHeight: 200, borderRadius: 8, marginBottom: 16,
          border: `2px solid ${selectedSlideIndex === slideIndex ? 'var(--color-primary)' : slideTheme.border}`,
          background: slideTheme.frame,
          color: slideTheme.ink,
        }}
        onClick={() => setSelectedSlideIndex(slideIndex)}
        role="button"
        aria-label={t(`Slide ${slideIndex + 1}`)}
      >
        <div className="slide-editor-canvas" style={{ position: 'relative', minHeight: 200, background: canvasBackground, padding: 24, color: slideTheme.ink }}>
          <header className="slide-editor-header" style={{ marginBottom: 16, paddingBottom: 8, borderBottom: `1px solid ${slideTheme.headerBorder}` }}>
            <div className="slide-editor-header-left">
              <button
                type="button"
                onClick={() => setSelectedSlideIndex(slideIndex)}
                style={{ cursor: 'pointer', color: slideTheme.ink, background: 'transparent', border: 'none' }}
                aria-label={t(`Select slide ${slideIndex + 1}`)}
              >
                <i className="fas fa-grip-vertical" />
                {t('Slide', 'Kat la')} {slideIndex + 1}
              </button>
              <span className="slide-editor-title" style={{ marginLeft: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: slideTheme.ink }}>
                {slide.title || t('Untitled slide', 'Kat sans tit')}
              </span>
            </div>
            <div className="slide-editor-header-right">
              <button
                type="button"
                onClick={() => setShowThemeModal(true)}
                style={{ cursor: 'pointer', fontSize: '0.7rem', marginRight: 4, color: slideTheme.accent, background: 'transparent', border: 'none' }}
                title={t('Change theme', 'Chanje tem')}
              >
                <i className={`fas fa-palette${slide.theme === 'brand' ? '-active' : ''}` } aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setShowMusicModal(true)}
                style={{ cursor: 'pointer', fontSize: '0.7rem', color: slideTheme.muted, background: 'transparent', border: 'none' }}
                title={t('Add background music', 'Ajoute mizik fon')}
              >
                <i className="fas fa-music" aria-hidden="true" />
              </button>
            </div>
          </header>

          {/* Selection guides / snap lines ──────────────────────── */}
          {selectedElementIndex >= 0 && selectedSlideIndex === slideIndex && elements[selectedElementIndex] && (
            <div className="slide-editor-snap-guides" style={{
              position: 'absolute',
              pointerEvents: 'none',
              left: 0,
              top: 0,
              bottom: 0,
              right: 0,
              background: 'rgba(0,0,0,0.02)',
            }}>
              {/* Vertical snap lines */}
              {elements.map((el, ei) => {
                if (el.x != null && !el.locked) {
                  return (
                    <div
                      key={`snap-x-${ei}`}
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: (el.x || 0) + 'px',
                        width: '1px',
                        height: '100%',
                        background: el.selected ? 'var(--color-primary)' : 'rgba(0,0,0,0.1)',
                        transition: 'background 0.15s ease',
                      }}
                    />
                  );
                }
                return null;
              })}

              {/* Horizontal snap lines */}
              {elements.map((el, ei) => {
                if (el.y != null && !el.locked) {
                  return (
                    <div
                      key={`snap-y-${ei}`}
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: (el.y || 0) + 'px',
                        height: '1px',
                        background: el.selected ? 'var(--color-primary)' : 'rgba(0,0,0,0.1)',
                        transition: 'background 0.15s ease',
                      }}
                    />
                  );
                }
                return null;
              })}
            </div>
          )}

          {/* Locked elements overlay ──────────────────────────────── */}
          {elements.map((el, ei) => {
            if (el.locked) {
              return (
                <div
                  key={`locked-${ei}`}
                  className="slide-editor-locked-overlay"
                  style={{
                    position: 'absolute',
                    left: (el.x || 0) + 'px',
                    top: (el.y || 0) + 'px',
                    width: (el.width || 0) + 'px',
                    height: (el.height || 0) + 'px',
                    background: 'rgba(255,255,255,0.8)',
                    border: '2px dashed #aaa',
                    borderRadius: 4,
                    pointerEvents: 'none',
                  }}
                >
                  <span style={{ position: 'absolute', left: 4, top: 4, fontSize: '0.6rem', color: '#666', pointerEvents: 'all' }}>
                    {t('Locked', 'Bloqué')}
                  </span>
                </div>
              );
            }
            return null;
          })}

          {/* Elements ──────────────────────────────────────────────── */}
          {elements.map((element, elementIndex) => {
            const isSelected = selectedElementIndex === elementIndex && selectedSlideIndex === slideIndex;
            const isLocked = element.locked;

            /* ─── Selection resize/move rectangle ──────────────────── */
            const style = {
              position: 'absolute',
              left: (element.x || 0) + 'px',
              top: (element.y || 0) + 'px',
              width: (element.width || 0) + 'px',
              height: (element.height || 0) + 'px',
              border: isSelected ? `${SELECTED_STROKE}px solid var(--color-primary)` : `${isLocked ? '2dashed #aaa' : '1px solid #dee2e6'}`,
              borderRadius: 4,
              transition: 'border 0.15s ease, transform 0.1s ease',
              cursor: isLocked ? 'not-allowed' : 'grab',
              zIndex: element.zIndex || 0,
            };

            /* ─── Handle positions ─────────────────────────────────── */
            const resizeHandles = {
              topLeft: { left: element.x, top: element.y, cursor: 'nw-resize' },
              topRight: { left: element.x + (element.width || 0) - RESIZE_HANDLE_SIZE, top: element.y, cursor: 'ne-resize' },
              bottomLeft: { left: element.x, top: element.y + (element.height || 0) - RESIZE_HANDLE_SIZE, cursor: 'nw-resize' },
              bottomRight: { left: element.x + (element.width || 0) - RESIZE_HANDLE_SIZE, top: element.y + (element.height || 0) - RESIZE_HANDLE_SIZE, cursor: 'ne-resize' },
            };

            return (
              <div
                key={`element-${slideIndex}-${elementIndex}`}
                className={`slide-editor-element ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}`}
                style={{ position: 'relative', cursor: isLocked ? 'not-allowed' : 'pointer' }}
                onClick={() => {
                  if (!isLocked) {
                    setSelectedElementIndex(elementIndex);
                    setSelectedSlideIndex(slideIndex);
                  }
                }}
                role="button"
                aria-label={isLocked ? t('Element locked, cannot select') : t('Select element')}
              >
                <div className="slide-editor-element-resize-wrapper" style={style}>
                  {/* Element content ──────────────────────────────────── */}
                  <div className="slide-editor-element-content" style={{ padding: 8, minHeight: 50, color: element.color || '#000000' }}>
                    {element.type === ELEMENT_TYPES.TEXT && (
                      <div>
                        <textarea
                          value={element.text || ''}
                          onChange={(e) => handleElementChange(slideIndex, elementIndex, 'text', e.target.value)}
                          style={{
                            width: '100%', height: 'calc(100% - 16px)', fontFamily: element.fontFamily || 'sans-serif', fontSize: element.fontSize || '14px', border: 'none', resize: 'none', overflow: 'auto',
                          }}
                          aria-label={t('Slide text content')}
                        />
                        <div style={{ marginTop: 4, display: 'flex', gap: 4, fontSize: '0.7rem', color: '#666' }}>
                          <select
                            value={element.fontFamily || 'sans-serif'}
                            onChange={(e) => handleElementChange(slideIndex, elementIndex, 'fontFamily', e.target.value)}
                            style={{ flex: 1, minWidth: 100 }}
                          >
                            <option value="sans-serif">Sans-serif</option>
                            <option value="serif">Serif</option>
                            <option value="monospace">Monospace</option>
                            <option value="system-ui">System UI</option>
                          </select>
                          <select
                            value={element.fontSize || '14px'}
                            onChange={(e) => handleElementChange(slideIndex, elementIndex, 'fontSize', e.target.value)}
                            style={{ flex: 1, minWidth: 80 }}
                          >
                            <option value="10px">10px</option>
                            <option value="12px">12px</option>
                            <option value="14px">14px</option>
                            <option value="16px">16px</option>
                            <option value="18px">18px</option>
                            <option value="20px">20px</option>
                          </select>
                          <select
                            value={element.fontWeight || 'normal'}
                            onChange={(e) => handleElementChange(slideIndex, elementIndex, 'fontWeight', e.target.value)}
                          >
                            <option value="normal">Normal</option>
                            <option value="bold">Bold</option>
                          </select>
                        </div>
                        <div style={{ marginTop: 4, display: 'flex', gap: 4, alignItems: 'baseline', fontSize: '0.7rem', color: '#666' }}>
                          <select
                            value={element.textAlign || 'left'}
                            onChange={(e) => handleElementChange(slideIndex, elementIndex, 'textAlign', e.target.value)}
                          >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                          <select
                            value={element.lineHeight || '1.5'}
                            onChange={(e) => handleElementChange(slideIndex, elementIndex, 'lineHeight', e.target.value)}
                          >
                            <option value="1.0">1.0</option>
                            <option value="1.5">1.5</option>
                            <option value="2.0">2.0</option>
                          </select>
                          <select
                            value={element.letterSpacing || '0px'}
                            onChange={(e) => handleElementChange(slideIndex, elementIndex, 'letterSpacing', e.target.value)}
                          >
                            <option value="0px">0px</option>
                            <option value="2px">2px</option>
                            <option value="4px">4px</option>
                          </select>
                        </div>
                        <div style={{ marginTop: 4, display: 'flex', gap: 4, fontSize: '0.7rem', color: '#666' }}>
                          <select
                            value={element.backgroundColor || 'transparent'}
                            onChange={(e) => handleElementChange(slideIndex, elementIndex, 'backgroundColor', e.target.value)}
                          >
                            <option value="transparent">Transparent</option>
                            <option value="#ffffff">White</option>
                            <option value="#f0f0f0">Light gray</option>
                            <option value="#e0e0e0">Gray</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {element.type === ELEMENT_TYPES.IMAGE && (
                      <div>
                        <input
                          type="text"
                          value={element.imageUrl || ''}
                          onChange={(e) => handleElementChange(slideIndex, elementIndex, 'imageUrl', e.target.value)}
                          style={{ width: '100%', height: 'calc(1.5em + 20px)', border: '1px solid #ccc', borderRadius: 4, padding: '4px', fontSize: '0.7rem' }}
                          placeholder="https://…"
                          aria-label={t('Image URL')}
                        />
                      </div>
                    )}

                    {element.type === ELEMENT_TYPES.ICON && (
                      <div>
                        <select
                          value={element.iconName || 'fa-star'}
                          onChange={(e) => handleElementChange(slideIndex, elementIndex, 'iconName', e.target.value)}
                          style={{ width: '100%', padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.7rem' }}
                        >
                          <option value="fa-star">★ Star</option>
                          <option value="fa-heart">♥ Heart</option>
                          <option value="fa-lightbulb">💡 Light bulb</option>
                          <option value="fa-book">📚 Book</option>
                          <option value="fa-chart-line">📈 Chart</option>
                        </select>
                        <span style={{ fontSize: element.fontSize || '24px' }}>{element.iconName && ElementIcon[element.iconName]}</span>
                        <input
                          type="color"
                          value={element.color || '#000000'}
                          onChange={(e) => handleElementChange(slideIndex, elementIndex, 'color', e.target.value)}
                          style={{ marginLeft: 4, height: '24px', width: '24px' }}
                        />
                      </div>
                    )}

                    {element.type === ELEMENT_TYPES.SHAPE && (
                      <div>
                        <select
                          value={element.shapeType || 'rectangle'}
                          onChange={(e) => handleElementChange(slideIndex, elementIndex, 'shapeType', e.target.value)}
                          style={{ width: '100%', padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.7rem' }}
                        >
                          <option value="rectangle">Rectangle</option>
                          <option value="circle">Circle</option>
                          <option value="triangle">Triangle</option>
                          <option value="line">Line</option>
                        </select>
                        <input
                          type="color"
                          value={element.color || '#000000'}
                          onChange={(e) => handleElementChange(slideIndex, elementIndex, 'color', e.target.value)}
                        />
                        <input
                          type="number"
                          value={element.width || 100}
                          min="10"
                          max="400"
                          onChange={(e) => handleElementChange(slideIndex, elementIndex, 'width', Number(e.target.value))}
                          style={{ width: '50px' }}
                        />
                        <input
                          type="number"
                          value={element.height || 50}
                          min="10"
                          max="200"
                          onChange={(e) => handleElementChange(slideIndex, elementIndex, 'height', Number(e.target.value))}
                          style={{ width: '50px' }}
                        />
                      </div>
                    )}

                    {element.type === ELEMENT_TYPES.LINE && (
                      <div>
                        <select
                          value={element.lineType || 'horizontal'}
                          onChange={(e) => handleElementChange(slideIndex, elementIndex, 'lineType', e.target.value)}
                        >
                          <option value="horizontal">Horizontal</option>
                          <option value="vertical">Vertical</option>
                          <option value="diagonal">Diagonal</option>
                        </select>
                        <input
                          type="color"
                          value={element.color || '#000000'}
                          onChange={(e) => handleElementChange(slideIndex, elementIndex, 'color', e.target.value)}
                        />
                        <input
                          type="number"
                          value={element.width || 2}
                          min="1"
                          max="10"
                          onChange={(e) => handleElementChange(slideIndex, elementIndex, 'width', Number(e.target.value))}
                          style={{ width: '40px' }}
                        />
                      </div>
                    )}

                    {element.type === ELEMENT_TYPES.CHART && (
                      <div>
                        <select
                          value={element.chartType || 'bar'}
                          onChange={(e) => handleElementChange(slideIndex, elementIndex, 'chartType', e.target.value)}
                        >
                          <option value="bar">Bar chart</option>
                          <option value="line">Line chart</option>
                          <option value="pie">Pie chart</option>
                        </select>
                        <input
                          type="color"
                          value={element.color || '#007bff'}
                          onChange={(e) => handleElementChange(slideIndex, elementIndex, 'color', e.target.value)}
                        />
                        <textarea
                          value={element.data || '["5","10","15","20"]'}
                          onChange={(e) => handleElementChange(slideIndex, elementIndex, 'data', e.target.value)}
                          style={{ width: '100%', height: '60px', fontSize: '0.7rem', border: '1px solid #ccc', borderRadius: 4, padding: '4px', resize: 'vertical', overflow: 'auto' }}
                          aria-label={t('Chart data (JSON array of numbers)')}
                        />
                      </div>
                    )}

                    {element.type === ELEMENT_TYPES.TABLE && (
                      <div>
                        <select
                          value={element.tableRows || '3'}
                          onChange={(e) => handleElementChange(slideIndex, elementIndex, 'tableRows', Number(e.target.value))}
                        >
                          <option value="2">2 rows</option>
                          <option value="3">3 rows</option>
                          <option value="4">4 rows</option>
                          <option value="5">5 rows</option>
                        </select>
                        <select
                          value={element.tableCols || '3'}
                          onChange={(e) => handleElementChange(slideIndex, elementIndex, 'tableCols', Number(e.target.value))}
                        >
                          <option value="2">2 cols</option>
                          <option value="3">3 cols</option>
                          <option value="4">4 cols</option>
                          <option value="5">5 cols</option>
                        </select>
                        <input
                          type="color"
                          value={element.color || '#000000'}
                          onChange={(e) => handleElementChange(slideIndex, elementIndex, 'color', e.target.value)}
                        />
                        <textarea
                          value={element.headers || 'Header 1,Header 2,Header 3'}
                          onChange={(e) => handleElementChange(slideIndex, elementIndex, 'headers', e.target.value)}
                          style={{ width: '100%', height: '40px', fontSize: '0.7rem', border: '1px solid #ccc', borderRadius: 4, padding: '4px', resize: 'vertical', overflow: 'auto' }}
                          aria-label={t('Table headers (comma-separated)')}
                        />
                        <textarea
                          value={element.rows || ''}
                          onChange={(e) => handleElementChange(slideIndex, elementIndex, 'rows', e.target.value)}
                          style={{ width: '100%', height: '80px', fontSize: '0.7rem', border: '1px solid #ccc', borderRadius: 4, padding: '4px', resize: 'vertical', overflow: 'auto' }}
                        />
                      </div>
                    )}

                    {element.type === ELEMENT_TYPES.DIAGRAM && (
                      <div>
                        <select
                          value={element.diagramType || 'flow'}
                          onChange={(e) => handleElementChange(slideIndex, elementIndex, 'diagramType', e.target.value)}
                        >
                          <option value="flow">Flow diagram</option>
                          <option value="mind">Mind map</option>
                          <option value="process">Process flow</option>
                        </select>
                        <input
                          type="color"
                          value={element.color || '#007bff'}
                          onChange={(e) => handleElementChange(slideIndex, elementIndex, 'color', e.target.value)}
                        />
                        <textarea
                          value={element.nodes || ''}
                          onChange={(e) => handleElementChange(slideIndex, elementIndex, 'nodes', e.target.value)}
                          style={{ width: '100%', height: '60px', fontSize: '0.7rem', border: '1px solid #ccc', borderRadius: 4, padding: '4px', resize: 'vertical', overflow: 'auto' }}
                          aria-label={t('Diagram nodes description')}
                        />
                        <textarea
                          value={element.edges || ''}
                          onChange={(e) => handleElementChange(slideIndex, elementIndex, 'edges', e.target.value)}
                          style={{ width: '100%', height: '60px', fontSize: '0.7rem', border: '1px solid #ccc', borderRadius: 4, padding: '4px', resize: 'vertical', overflow: 'auto' }}
                          aria-label={t('Diagram connections description')}
                        />
                      </div>
                    )}
                  </div>

                  {/* Resize handles ──────────────────────────────────────── */}
                  <div
                    className="slide-editor-resize-handle"
                    style={{ position: 'absolute', width: RESIZE_HANDLE_SIZE, height: RESIZE_HANDLE_SIZE, left: resizeHandles.topLeft.left, top: resizeHandles.topLeft.top, background: isSelected ? 'var(--color-primary)' : '#fff', border: '2px solid #fff', borderRadius: 50, cursor: isSelected || isLocked ? 'nw-resize' : 'default', zIndex: 1000 }}
                    onMouseDown={(e) => startResize(e, slideIndex, elementIndex, 'topLeft')}
                    title={t('Resize top-left')}
                  />
                  <div
                    className="slide-editor-resize-handle"
                    style={{ position: 'absolute', width: RESIZE_HANDLE_SIZE, height: RESIZE_HANDLE_SIZE, left: resizeHandles.topRight.left, top: resizeHandles.topRight.top, background: isSelected ? 'var(--color-primary)' : '#fff', border: '2px solid #fff', borderRadius: 50, cursor: isSelected || isLocked ? 'ne-resize' : 'default', zIndex: 1000 }}
                    onMouseDown={(e) => startResize(e, slideIndex, elementIndex, 'topRight')}
                    title={t('Resize top-right')}
                  />
                  <div
                    className="slide-editor-resize-handle"
                    style={{ position: 'absolute', width: RESIZE_HANDLE_SIZE, height: RESIZE_HANDLE_SIZE, left: resizeHandles.bottomLeft.left, top: resizeHandles.bottomLeft.top, background: isSelected ? 'var(--color-primary)' : '#fff', border: '2px solid #fff', borderRadius: 50, cursor: isSelected || isLocked ? 'nw-resize' : 'default', zIndex: 1000 }}
                    onMouseDown={(e) => startResize(e, slideIndex, elementIndex, 'bottomLeft')}
                    title={t('Resize bottom-left')}
                  />
                  <div
                    className="slide-editor-resize-handle"
                    style={{ position: 'absolute', width: RESIZE_HANDLE_SIZE, height: RESIZE_HANDLE_SIZE, left: resizeHandles.bottomRight.left, top: resizeHandles.bottomRight.top, background: isSelected ? 'var(--color-primary)' : '#fff', border: '2px solid #fff', borderRadius: 50, cursor: isSelected || isLocked ? 'ne-resize' : 'default', zIndex: 1000 }}
                    onMouseDown={(e) => startResize(e, slideIndex, elementIndex, 'bottomRight')}
                    title={t('Resize bottom-right')}
                  />
                </div>

                {/* Element-specific action buttons when selected ──────────────────────────────────── */}
                {isSelected && !isLocked && (
                  <div className="slide-editor-element-actions" style={{
                    position: 'absolute',
                    right: 4,
                    top: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    zIndex: 1001,
                  }}>
                    <button
                      type="button"
                      className="slide-editor-action-btn"
                      onClick={() => bringForward(slideIndex, elementIndex)}
                      title={t('Bring forward', 'Ale avènye')}
                      style={{ width: 28, height: 28, borderRadius: 50, background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}
                    >
                      <i className="fas fa-arrow-up" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="slide-editor-action-btn"
                      onClick={() => sendBackward(slideIndex, elementIndex)}
                      title={t('Send backward', 'Ale derye')}
                      style={{ width: 28, height: 28, borderRadius: 50, background: '#fff', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--color-primary)', fontSize: '0.7rem' }}
                    >
                      <i className="fas fa-arrow-down" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="slide-editor-action-btn"
                      onClick={() => toggleLock(slideIndex, elementIndex)}
                      title={t(toggleLock ? 'Unlock' : 'Lock', toggleLock ? 'Débloquer' : 'Bloquer')}
                      style={{ width: 28, height: 28, borderRadius: 50, background: toggleLock ? '#fff' : 'var(--color-primary)', color: toggleLock ? 'var(--color-primary)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}
                    >
                      <i className={toggleLock ? 'fas fa-lock-open' : 'fas fa-lock'} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="slide-editor-action-btn"
                      onClick={() => duplicateElement(slideIndex, elementIndex)}
                      title={t('Duplicate', 'Kopyè')}
                      style={{ width: 28, height: 28, borderRadius: 50, background: '#e9ecef', color: '#495059', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}
                    >
                      <i className="fas fa-copy" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="slide-editor-action-btn"
                      onClick={() => removeElement(slideIndex, elementIndex)}
                      title={t('Delete', 'Efase')}
                      style={{ width: 28, height: 28, borderRadius: 50, background: '#ffdada', color: '#c50f1f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}
                    >
                      <i className="fas fa-trash" aria-hidden="true" />
                    </button>
                  </div>
                )}

                {/* ─── Bring forward / Send backward buttons (always visible when selected) ──────────────────────────────────── */}
                {!isLocked && (
                  <div className="slide-editor-bring-send" style={{
                    position: 'absolute',
                    left: 4,
                    top: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    zIndex: 1001,
                  }}>
                    <button
                      type="button"
                      onClick={() => bringForward(slideIndex, elementIndex)}
                      title={t('Bring forward', 'Ale avènye')}
                      style={{ width: 32, height: 32, borderRadius: 50, background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}
                    >
                      <i className="fas fa-arrow-up" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => sendBackward(slideIndex, elementIndex)}
                      title={t('Send backward', 'Ale derye')}
                      style={{ width: 32, height: 32, borderRadius: 50, background: '#fff', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--color-primary)', fontSize: '0.8rem' }}
                    >
                      <i className="fas fa-arrow-down" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add element button (when no element selected or on empty slide) ─────────────────────────────────────────────────── */}
          {selectedElementIndex < 0 && (
            <div className="slide-editor-add-element" style={{
              position: 'absolute',
              bottom: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '8px 16px',
              background: 'var(--color-primary)',
              color: '#fff',
              borderRadius: 4,
              fontSize: '0.8rem',
              cursor: 'pointer',
              textAlign: 'center',
            }}
            onClick={() => {
              // Add a text element by default
              addElement(slideIndex, ELEMENT_TYPES.TEXT);
              setSelectedElementIndex(slides[slideIndex]?.elements?.length - 1 || 0);
              setSelectedSlideIndex(slideIndex);
            }}
          >
            {t('Add element', 'Ajoute elèv')}
          </div>
          )}
        </div>

        {/* Slide title editor ──────────────────────────────────────── */}
        <div className="slide-editor-title-edit" style={{
          marginTop: 8,
          padding: 8,
          background: 'var(--bg, #fff)',
          border: '1px solid #dee2e6',
          borderRadius: 4,
        }}>
          <input
            type="text"
            value={slide.title || ''}
            onChange={(e) => updateSlide(slideIndex, 'title', e.target.value)}
            style={{ width: '100%', padding: '4px', fontSize: '0.85rem' }}
            aria-label={t('Slide title')}
            autoFocus
          />
        </div>
      </div>
    );
  }

  /* ─── Resize state ────────────────────────────────────────────── */
  const resizeRef = useRef({
    slideIndex: null,
    elementIndex: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
  });

  const startResize = useCallback((e, slideIndex, elementIndex, handle) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = {
      slideIndex,
      elementIndex,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: slides[slideIndex]?.elements[elementIndex]?.width || defaultElement.width,
      startHeight: slides[slideIndex]?.elements[elementIndex]?.height || defaultElement.height,
    };
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', handleResizeEnd);
  }, []);

  const handleResize = useCallback((e) => {
    if (!resizeRef.current.slideIndex) return;
    const { slideIndex, elementIndex, startX, startY, startWidth, startHeight } = resizeRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const newWidth = Math.max(10, startWidth + dx);
    const newHeight = Math.max(10, startHeight + dy);

    const next = slides.map((s, i) =>
      i !== slideIndex ? s : {
        ...s,
        elements: s.elements.map((el, idx) =>
          idx === elementIndex ? { ...el, width: newWidth, height: newHeight } : el
        ),
      }
    );
    patchSlides(next);
  }, [slides, patchSlides]);

  const handleResizeEnd = useCallback(() => {
    resizeRef.current = {
      slideIndex: null,
      elementIndex: null,
      startX: 0,
      startY: 0,
      startWidth: 0,
      startHeight: 0,
    };
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', handleResizeEnd);
  }, []);

  /* ─── Keyboard navigation for elements ──────────────────────────── */
  useEffect(() => {
    if (selectedElementIndex < 0 || selectedSlideIndex < 0) return;
    const handleKeyDown = (e) => {
      const element = slides[selectedSlideIndex]?.elements[selectedElementIndex];
      if (!element || element.locked) return;

      const step = 1; // pixels to move
      const newX = element.x + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : element.x);
      const newY = element.y + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : element.y);

      handleElementChange(selectedSlideIndex, selectedElementIndex, 'x', newX);
      handleElementChange(selectedSlideIndex, selectedElementIndex, 'y', newY);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementIndex, selectedSlideIndex]);

  /* ─── Render slides ───────────────────────────────────────────── */
  return (
    <div className="slides-editor-wrapper">
      <div className="slides-editor-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setSelectedSlideIndex(-1)} style={{ cursor: 'pointer', padding: '4px 8px', border: '1px solid #dee2e6', borderRadius: 4, fontSize: '0.7rem' }}>{t('Cancel selection', 'Renmen seleksyon')}</button>
        <button type="button" onClick={() => addSlide()} style={{ cursor: 'pointer', padding: '4px 8px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.7rem' }}>{t('Add slide', 'Ajoute kat')}</button>
        <button type="button" onClick={() => removeSlide(selectedSlideIndex)} style={{ cursor: 'pointer', padding: '4px 8px', background: '#ffdada', color: '#c50f1f', border: 'none', borderRadius: 4, fontSize: '0.7rem' }}>{t('Delete slide', 'Efase kat')}</button>
        <button type="button" onClick={() => moveSlide(selectedSlideIndex, -1)} style={{ cursor: 'pointer', padding: '4px 8px', background: '#e9ecef', color: '#495059', border: 'none', borderRadius: 4, fontSize: '0.7rem' }}>{t('Move up', 'Monte')}</button>
        <button type="button" onClick={() => moveSlide(selectedSlideIndex, 1)} style={{ cursor: 'pointer', padding: '4px 8px', background: '#e9ecef', color: '#495059', border: 'none', borderRadius: 4, fontSize: '0.7rem' }}>{t('Move down', 'Desann')}</button>
        <button type="button" onClick={() => setShowThemeModal(true)} style={{ cursor: 'pointer', padding: '4px 8px', background: '#f8f9fa', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.7rem' }}>{t('Theme', 'Tèm')}</button>
        <button type="button" onClick={() => setShowMusicModal(true)} style={{ cursor: 'pointer', padding: '4px 8px', background: '#f8f9fa', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.7rem' }}>{t('Music', 'Mizik')}</button>
        <button type="button" onClick={handleUndo} disabled={!canUndo} style={{ cursor: 'pointer', padding: '4px 8px', background: '#e9ecef', color: '#6c757d', border: 'none', borderRadius: 4, fontSize: '0.7rem' }}>{t('Undo', 'Undo')}</button>
        <button type="button" onClick={handleRedo} disabled={!canRedo} style={{ cursor: 'pointer', padding: '4px 8px', background: '#e9ecef', color: '#6c757d', border: 'none', borderRadius: 4, fontSize: '0.7rem' }}>{t('Redo', 'Redo')}</button>
      </div>

      <div className="slides-editor-main">
        {slides.map((slide, slideIndex) => renderSlide(slide, slideIndex))}
      </div>

      {showThemeModal && (
        <ThemeModal
          lang={lang}
          value={theme}
          onClose={() => setShowThemeModal(false)}
          onSelect={applyTheme}
        />
      )}
      {showMusicModal && (
        <MusicModal
          lang={lang}
          onClose={() => setShowMusicModal(false)}
          onSelect={applyAudio}
        />
      )}
    </div>
  );
}

/* ─── Element icon lookup ───────────────────────────────────────── */
const ElementIcon = {
  'fa-star': '<i className="fas fa-star" />',
  'fa-heart': '<i className="fas fa-heart" />',
  'fa-lightbulb': '<i className="fas fa-lightbulb" />',
  'fa-book': '<i className="fas fa-book" />',
  'fa-chart-line': '<i className="fas fa-chart-line" />',
};

/* ─── Theme modal ──────────────────────────────────────────────── */
function ThemeModal({ onClose, onSelect, lang = 'en', value = 'brand' }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);
  const [selected, setSelected] = useState(value);
  const [hovered, setHovered] = useState(null);
  const previewValue = hovered || selected;
  const previewTheme = SLIDE_THEMES[previewValue] || SLIDE_THEMES.brand;
  const previewCanvas = previewTheme.canvas || '#ffffff';
  const themes = [
    { value: 'brand', label: isHt ? 'Mak' : 'Brand' },
    { value: 'light', label: isHt ? 'Klè' : 'Light' },
    { value: 'dark', label: isHt ? 'Fonse' : 'Dark' },
  ];

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label={t('Change theme', 'Change tem')}
    >
      <div className="modal-content" style={{ maxWidth: 300, padding: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>{t('Change theme', 'Change tem')}</h3>

        {/* Live mini preview of the highlighted theme */}
        <div
          aria-hidden="true"
          style={{
            marginBottom: 12, padding: 8, borderRadius: 10,
            border: `1px solid ${previewTheme.border}`,
            background: previewTheme.frame,
          }}
        >
          <div style={{
            minHeight: 86, padding: '10px 12px', borderRadius: 7,
            background: previewCanvas, color: previewTheme.ink,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Aa</span>
              <span style={{ width: 18, height: 18, borderRadius: 999, background: previewTheme.accent }} />
            </div>
            <span style={{ height: 7, width: '62%', borderRadius: 999, background: previewTheme.ink, opacity: 0.85 }} />
            <span style={{ height: 5, width: '94%', borderRadius: 999, background: previewTheme.muted, opacity: 0.55 }} />
            <span style={{ height: 5, width: '76%', borderRadius: 999, background: previewTheme.muted, opacity: 0.45 }} />
          </div>
        </div>

        {themes.map((theme) => (
          <button
            key={theme.value}
            type="button"
            onClick={() => setSelected(theme.value)}
            onMouseEnter={() => setHovered(theme.value)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(theme.value)}
            onBlur={() => setHovered(null)}
            aria-pressed={selected === theme.value}
            style={{
              width: '100%', padding: '8px', margin: '4px 0', borderRadius: 4,
              fontSize: '0.85rem', cursor: 'pointer',
              border: theme.value === previewValue ? '2px solid var(--color-primary)' : '1px solid #dee2e6',
              background: theme.value === previewValue ? 'rgba(37, 99, 235, 0.08)' : '#fff',
            }}
          >
            {theme.label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => { onSelect(selected); onClose?.(); }}
          style={{ marginTop: '12px', width: '100%', padding: '8px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          {t('Apply', 'Aplike')}
        </button>
        <button type="button" onClick={onClose} style={{ marginTop: '6px', width: '100%', padding: '8px', background: '#f8f9fa', border: '1px solid #ccc', borderRadius: 4 }}>{t('Cancel', 'Renmen')}</button>
      </div>
    </div>
  );
}

/* ─── Music modal ──────────────────────────────────────────────── */
function MusicModal({ onClose, onSelect, lang = 'en' }) {
  // Reuse AudioLibraryModal from existing code
  return <AudioLibraryModal lang={lang} onClose={onClose} onSelect={onSelect} />;
}