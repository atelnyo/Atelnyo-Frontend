/**
 * src/components/storyboard/StoryboardEditor.jsx
 *
 * Dedicated storyboard workspace for creators.
 * Allows creators to:
 * - Add scenes
 * - Reorder scenes
 * - Write narration
 * - Add visual descriptions
 * - Attach media
 * - Define scene duration
 * - Define transitions
 * - Preview scene sequences
 * - Convert storyboard scenes into editable presentation slides
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { translations } from '../../data/translations';
import { useUndoRedo } from '../../../hooks/useUndoRedo';
import styles from './storyboard.module.css';

/* ─── Scene data shape ─────────────────────────────────────────── */
function initialSceneState() {
  return {
    id: Date.now().toString() + Math.random().toString(36).substr(2),
    title: '',
    narration: '',
    description: '',
    duration: 5, // seconds
    transition: 'cut', // 'cut' | 'fade' | 'slide' | 'dissolve'
    media: null, // { type: 'image'|'video'|'audio', url: string, caption: string }
    slides: [], // converted from storyboard
  };
}

/* ─── Storyboard Editor component ──────────────────────────────── */
export default function StoryboardEditor({ onClose, onSceneAdded, onSceneConverted }) {
  const isHt = translations.currentLang === 'ht';
  const t = (en, ht) => (isHt ? ht || en : en);

  const [scenes, setScenes] = useState(() => [initialSceneState()]);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [showAddSceneModal, setShowAddSceneModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);

  const { state, undo, redo, canUndo, canRedo } = useUndoRedo(
    { scenes, selectedSceneIndex },
    { maxDepth: 30 }
  );

  /* ─── Save state effect ──────────────────────────────────────── */
  useEffect(() => {
    // Persist storyboard state for undo/redo
  }, [state]);

  /* ─── Add new scene ──────────────────────────────────────────── */
  const handleAddScene = useCallback(() => {
    const newScene = initialSceneState();
    setScenes((prev) => [...prev, newScene]);
    setSelectedSceneIndex(prev => prev + 1);
    onSceneAdded?.(newScene);
  }, []);

  /* ─── Remove scene ──────────────────────────────────────────── */
  const handleRemoveScene = useCallback((index) => {
    setScenes((prev) => prev.filter((_, i) => i !== index));
    if (selectedSceneIndex >= index && selectedSceneIndex > 0) {
      setSelectedSceneIndex(selectedSceneIndex - 1);
    }
  }, [selectedSceneIndex]);

  /* ─── Move scene up/down ────────────────────────────────────── */
  const handleMoveScene = useCallback((index, direction) => {
    setScenes((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(index + direction, 0, moved);
      return next;
    });
  }, []);

  /* ─── Convert scene to slides ───────────────────────────────── */
  const convertSceneToSlides = useCallback((scene) => {
    // Convert storyboard scene into slide elements
    const slideElements = [];

    if (scene.media && scene.media.type === 'image') {
      slideElements.push({
        type: 'image',
        title: scene.title || 'Image Slide',
        imageUrl: scene.media.url,
        caption: scene.media.caption,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
    }

    if (scene.narration) {
      slideElements.push({
        type: 'text',
        title: '',
        text: scene.narration,
        fontSize: '24px',
        color: '#000000',
        textAlign: 'left',
      });
    }

    return slideElements;
  });

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <div className="storyboard-editor" role="region" aria-label="Storyboard editor">
      <div className="storybar-toolbar">
        <button type="button" onClick={handleAddScene} aria-label={t('Add scene', 'Ajoute scèn')}>
          <i className="fas fa-plus" aria-hidden="true" /> {t('Add scene', 'Ajoute scèn')}
        </button>
        <button type="button" onClick={() => setSelectedSceneIndex((i) => Math.max(0, i - 1))} disabled={scenes.length <= 1} aria-label={t('Previous scene', 'Scèn anvan')} >
          <i className="fas fa-chevron-left" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setSelectedSceneIndex((i) => Math.min(scenes.length - 1, i + 1))} aria-label={t('Next scene', 'Scèn pwochen')} >
          <i className="fas fa-chevron-right" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setShowConvertModal(true)} aria-label={t('Convert to slides', 'Konvèt en kat'}} >
          <i className="fas fa-image" aria-hidden="true" /> {t('Convert to slides', 'Konvèt en kat')}
        </button>
        <button type="button" onClick={handleRemoveScene} disabled={scenes.length <= 1} aria-label={t('Remove scene', 'Efface scèn')}} >
          <i className="fas fa-trash" aria-hidden="true" /> {t('Remove', 'Effase')}
        </button>
        <button type="button" onClick={onClose} aria-label={t('Close', 'Fermye')}} >
          <i className="fas fa-times" aria-hidden="true" /> {t('Close', 'Fermye')}
        </button>
      </div>

      <div className="storyboard-canvas">
        {scenes.map((scene, index) => (
          <div
            key={scene.id}
            className={`scene-card ${selectedSceneIndex === index ? 'selected' : ''}`}
            style={{
              border: `2px solid ${selectedSceneIndex === index ? 'var(--color-primary)' : '#dee2e6'}`,
              borderRadius: 8,
              marginBottom: 16,
              padding: 12,
              background: '#f8f9fa',
            }}
            role="button"
            onClick={() => setSelectedSceneIndex(index)}
            aria-label={t(`Scene ${index + 1}: ${scene.title || 'Untitled'`}}
          >
            <div className="scene-header">
              <h4 style={{ margin: '0 0 4px', fontSize: '0.9rem' }}>
                {scene.title || t('Untitled scene', 'Scèn sans tit')}
              </h4>
              <p style={{ margin: '0 0 8px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {t('Duration', 'Durasyon')}: {scene.duration}s · {t('Transition', 'Transition')}: {scene.transition}
              </p>
              <button
                type="button"
                className="scene-remove"
                onClick={() => handleRemoveScene(index)}
                style={{ float: 'right', background: '#ffdada', color: '#c50f1f', border: 'none', padding: '4px 8px', borderRadius: 4, fontSize: '0.65rem' }}
                aria-label={t('Remove scene', 'Efface scèn')}
              >
                ✕
              </button>
            </div>

            <div className="scene-body">
              {/* Narration */}
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>
                  {t('Narration', 'Narinasyon')}
                </label>
                <textarea
                  value={scene.narration}
                  onChange={(e) => {
                    const next = [...scenes];
                    next[index].narration = e.target.value;
                    setScenes(next);
                  }}
                  rows={2}
                  style={{ width: '100%', padding: '4px', fontSize: '0.8rem', border: '1px solid #dee2e6', borderRadius: 4, resize: 'vertical', overflow: 'auto' }}
                  aria-label={t('Narration text')}
                />
              </div>

              {/* Visual description */}
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>
                  {t('Visual description', 'Descripsyon vizyal')}
                </label>
                <textarea
                  value={scene.description}
                  onChange={(e) => {
                    const next = [...scenes];
                    next[index].description = e.target.value;
                    setScenes(next);
                  }}
                  rows={3}
                  style={{ width: '100%', padding: '4px', fontSize: '0.8rem', border: '1px solid #dee2e6', borderRadius: 4, resize: 'vertical', overflow: 'auto' }}
                  aria-label={t('Visual description')}
                />
              </div>

              {/* Media attachment */}
              {scene.media && (
                <div style={{ marginBottom: 8, padding: 6, background: '#e9ecef', borderRadius: 4 }}>
                  <p style={{ margin: '0 0 4px', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                    {t('Media', 'Medya')}
                  </p>
                  {scene.media.type === 'image' && (
                    <img
                      src={scene.media.url}
                      alt={scene.media.caption || 'Attached image'}
                      style={{ width: '60px', height: '40px', objectFit: 'cover', marginRight: 4 }}
                    />
                  )}
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                    {scene.media.caption || ''}
                  </p>
                </div>
              )}

              {/* Duration & transition */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 4 }}>
                <input
                  type="number"
                  value={scene.duration}
                  min="1"
                  max="60"
                  step="1"
                  onChange={(e => {
                    const next = [...scenes];
                    next[index].duration = Number(e.target.value);
                    setScenes(next);
                  })}
                  style={{ padding: '4px', fontSize: '0.7rem' }}
                  aria-label={t('Scene duration')}
                />
                <select
                  value={scene.transition}
                  onChange={(e => {
                    const next = [...scenes];
                    next[index].transition = e.target.value;
                    setScenes(next);
                  })}
                  style={{ padding: '4px', fontSize: '0.7rem' }}
                  aria-label={t('Transition type')}
                >
                  <option value="cut">{t('Cut', 'Kut')}</option>
                  <option value="fade">{t('Fade', 'FèFade')}</option>
                  <option value="slide">{t('Slide', 'Glis')}</option>
                  <option value="dissolve">{t('Dissolve', 'Dissolve')}</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Convert modal ────────────────────────────────────────────── */}
      {showConvertModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowConvertModal(false)} role="dialog" aria-modal="true">
          <div className="modal-content" style={{ maxWidth: 500, padding: 20 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>{t('Convert Scene to Slides', 'Konvèt Scèn en Kat')}</h3>
            <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              This will convert the selected scene into slide elements that can be edited in the Slide Editor. Continue?
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 12 }}>
              <button type="button" onClick={() => { setShowConvertModal(false); onClose(); }} style={{ padding: '8px 12px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.8rem' }}>
                {t('Cancel', 'Renmen')}
              </button>
              <button type="button" onClick={() => {
                const selected = scenes[selectedSceneIndex];
                const slideElements = convertSceneToSlides(selected);
                onSceneConverted?.(slideElements);
                setShowConvertModal(false);
                onClose();
              }} style={{ padding: '8px 12px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.8rem' }}>
                {t('Convert', 'Konvèt')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add scene modal ─────────────────────────────────────────── */}
      {showAddSceneModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowAddSceneModal(false)} role="dialog" aria-modal="true">
          <div className="modal-content" style={{ maxWidth: 400, padding: 20 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>{t('Add Scene', 'Ajoute Scèn')}</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>{t('Scene title', 'Tit scèn')}</label>
              <input
                type="text"
                value=""
                onChange={(e => {
                  // Would update scene title
                })}
                style={{ width: '100%', padding: '4px', fontSize: '0.8rem', border: '1px solid #ccc', borderRadius: 4 }}
                aria-label={t('Scene title')}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 12 }}>
              <button type="button" onClick={() => { setShowAddSceneModal(false); handleAddScene(); }} style={{ padding: '8px 12px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.8rem' }}>
                {t('Add', 'Ajoute')}
              </button>
              <button type="button" onClick={() => setShowAddSceneModal(false)} style={{ padding: '8px 12px', background: '#e9ecef', color: '#495059', border: 'none', borderRadius: 4, fontSize: '0.8rem' }}>
                {t('Cancel', 'Renmen')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}