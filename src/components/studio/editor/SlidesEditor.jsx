/**
 * src/components/studio/editor/SlidesEditor.jsx
 *
 * Structured editor for the `slides` block — the creator side of the
 * animated deck. Without this, `slides` would be a block type with no
 * UI (same gap CanvasSectionsEditor closed for the canvas).
 *
 * Data shape written back (what SlidesBlock understands):
 *   block.slides = [{ title, body, imageUrl, alt }, ...]
 *   block.audioUrl        — optional background music
 *   block.autoplaySeconds — 0 = learner-driven
 *   block.theme           — 'brand' | 'light' | 'dark'
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import styles from './editor.module.css';
import AudioLibraryModal from './AudioLibraryModal';

function normalizeSlides(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ title: '', body: '', imageUrl: '', alt: '' }];
  }
  return raw.map((s) => {
    if (!s) return { title: '', body: '', imageUrl: '', alt: '' };
    if (typeof s === 'string') return { title: '', body: s, imageUrl: '', alt: '' };
    return {
      title: typeof s.title === 'string' ? s.title : '',
      body: typeof s.body === 'string'
        ? s.body
        : (Array.isArray(s.bullets) ? s.bullets.map((b) => `- ${b}`).join('\n') : ''),
      imageUrl: s.imageUrl || '',
      alt: s.alt || '',
    };
  });
}

export default function SlidesEditor({ block, onChange, lang = 'ht' }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);

  const slides = useMemo(() => normalizeSlides(block?.slides), [block?.slides]);
  const dragRef = useRef(null);
  const [dragOver, setDragOver] = useState(null);
  const [showLibrary, setShowLibrary] = useState(false);

  const patchSlides = useCallback((next) => {
    onChange({ ...block, slides: next });
  }, [block, onChange]);

  const patchDeck = useCallback((key, value) => {
    onChange({ ...block, [key]: value });
  }, [block, onChange]);

  const update = useCallback((index, field, value) => {
    patchSlides(slides.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }, [slides, patchSlides]);

  const addSlide = useCallback(() => {
    patchSlides([...slides, { title: '', body: '', imageUrl: '', alt: '' }]);
  }, [slides, patchSlides]);

  const removeSlide = useCallback((index) => {
    patchSlides(slides.filter((_, i) => i !== index));
  }, [slides, patchSlides]);

  const move = useCallback((index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    [next[index], next[target]] = [next[target], next[index]];
    patchSlides(next);
  }, [slides, patchSlides]);

  const handleDragStart = useCallback((e, index) => {
    dragRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDrop = useCallback((target) => {
    const src = dragRef.current;
    dragRef.current = null;
    setDragOver(null);
    if (src == null || src === target) return;
    const next = [...slides];
    const [moved] = next.splice(src, 1);
    next.splice(target, 0, moved);
    patchSlides(next);
  }, [slides, patchSlides]);

  return (
    <div className={styles.checkEditor}>
      <div className={styles.checkHeader}>
        <span className={styles.checkTitle}>
          <i className="fas fa-images" /> {t('Slides', 'Kat yo')}
          <span className={styles.checkCount}>{slides.length}</span>
        </span>
        <button type="button" className={styles.checkAddBtn} onClick={addSlide}>
          <i className="fas fa-plus" /> {t('Add slide', 'Ajoute yon kat')}
        </button>
      </div>

      <div className={styles.checkItemsList}>
        {slides.map((slide, i) => (
          <div
            key={`slide-${i}`}
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
                  <i className="fas fa-grip-vertical" aria-hidden="true" /> {t('Slide', 'Kat')} {i + 1}
                </span>
                <div className={styles.checkItemEditorActions}>
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    title={t('Move up', 'Monte')}
                    aria-label={`${t('Move up', 'Monte')} — ${slide.title || i + 1}`}
                  >
                    <i className="fas fa-chevron-up" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === slides.length - 1}
                    title={t('Move down', 'Desann')}
                    aria-label={`${t('Move down', 'Desann')} — ${slide.title || i + 1}`}
                  >
                    <i className="fas fa-chevron-down" />
                  </button>
                  <button
                    type="button"
                    className={styles.checkItemDelete}
                    onClick={() => removeSlide(i)}
                    title={t('Delete', 'Efase')}
                    aria-label={`${t('Delete', 'Efase')} — ${slide.title || i + 1}`}
                  >
                    <i className="fas fa-trash" />
                  </button>
                </div>
              </div>

              <div className={styles.checkItemFields}>
                <label className={styles.checkField}>
                  <span className={styles.checkFieldLabel}>{t('Slide title', 'Tit kat la')}</span>
                  <input
                    type="text"
                    className={styles.checkFieldInput}
                    value={slide.title}
                    onChange={(e) => update(i, 'title', e.target.value)}
                    placeholder={t('e.g. What is entrepreneurship?', 'eg. Kisa antreprenarya ye?')}
                  />
                </label>
                <label className={styles.checkField}>
                  <span className={styles.checkFieldLabel}>
                    {t('Body (one idea per line — start lines with "- " for bullets)', 'Kò tèks (yon ide pa liy — kòmanse ak "- " pou pwen)')}
                  </span>
                  <textarea
                    className={styles.checkFieldInput}
                    rows={4}
                    value={slide.body}
                    onChange={(e) => update(i, 'body', e.target.value)}
                    placeholder={t('- First point\n- Second point', '- Premye pwen\n- Dezyèm pwen')}
                  />
                </label>
                <label className={styles.checkField}>
                  <span className={styles.checkFieldLabel}>{t('Image URL (optional)', 'URL imaj (opsyonèl)')}</span>
                  <input
                    type="url"
                    className={styles.checkFieldInput}
                    value={slide.imageUrl}
                    onChange={(e) => update(i, 'imageUrl', e.target.value)}
                    placeholder="https://…"
                  />
                </label>
                <label className={styles.checkField}>
                  <span className={styles.checkFieldLabel}>{t('Alt text (accessibility)', 'Tèks alt (aksesibilite)')}</span>
                  <input
                    type="text"
                    className={styles.checkFieldInput}
                    value={slide.alt}
                    onChange={(e) => update(i, 'alt', e.target.value)}
                    placeholder={t('Describe the image', 'Dekri imaj la')}
                  />
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      {slides.length === 0 && (
        <p className={styles.checkEmpty}>
          {isHt ? 'Pa gen kat — ajoute premye kat la.' : 'No slides — add the first one.'}
        </p>
      )}

      <div className={styles.checkItemFields} style={{ marginTop: 12 }}>
        <label className={styles.checkField}>
          <span className={styles.checkFieldLabel}>{t('Background music (optional)', 'Mizik an fon (opsyonèl)')}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="url"
              className={styles.checkFieldInput}
              style={{ flex: '1 1 220px' }}
              value={block?.audioUrl || ''}
              onChange={(e) => patchDeck('audioUrl', e.target.value)}
              placeholder={t('Audio file (.mp3) — learner taps play', 'Fichye odyo (.mp3) — elèv la peze jwe')}
            />
            <button
              type="button"
              className={styles.checkAddBtn}
              onClick={() => setShowLibrary(true)}
            >
              <i className="fas fa-music" aria-hidden="true" /> {t('My audio library', 'Bibliyotèk odyo m')}
            </button>
          </div>
        </label>
        <label className={styles.checkField}>
          <span className={styles.checkFieldLabel}>{t('Auto-advance seconds (0 = manual)', 'Segonn pou defile otomatik (0 = manyèl)')}</span>
          <input
            type="number"
            min="0"
            max="120"
            className={styles.checkFieldInput}
            value={Number(block?.autoplaySeconds) || 0}
            onChange={(e) => patchDeck('autoplaySeconds', Number(e.target.value) || 0)}
          />
        </label>
        <label className={styles.checkField}>
          <span className={styles.checkFieldLabel}>{t('Theme', 'Tèm')}</span>
          <select
            className={styles.checkFieldInput}
            value={block?.theme || 'brand'}
            onChange={(e) => patchDeck('theme', e.target.value)}
          >
            <option value="brand">{t('Brand', 'Mak')}</option>
            <option value="light">{t('Light', 'Klè')}</option>
            <option value="dark">{t('Dark', 'Fonse')}</option>
          </select>
        </label>
      </div>

      <div className={styles.checkHint}>
        <p>
          <i className="fas fa-info-circle" aria-hidden="true" /> {isHt
            ? 'Elèv la ka avanse manyèlman tout tan. Muzik pa janm jwe pou kont li — li peze bouton an.'
            : 'The learner can always advance manually. Music never autoplays — they tap the button.'}
        </p>
      </div>

      {showLibrary && (
        <AudioLibraryModal
          lang={lang}
          onClose={() => setShowLibrary(false)}
          onSelect={(item) => {
            const url = item?.media_url || '';
            if (url) patchDeck('audioUrl', url);
            setShowLibrary(false);
          }}
        />
      )}
    </div>
  );
}
