/**
 * CanvasBlock — the Business Model Canvas block.
 *
 * `canvas` was declared in BLOCK_TYPES and accepted by the backend
 * validator (optional `sections` + `title`) but had NO component in
 * BLOCK_REGISTRY, so any course using it showed "This block type is not
 * yet available." This is that missing component.
 *
 * Behaviour:
 *   • Nine standard sections, or whatever `block.sections` defines.
 *   • The learner types freely into each section; work is kept in
 *     localStorage per course+block, so a refresh never loses it.
 *   • Completion is explicit ("I'm done") and only enabled once
 *     something has actually been written — no fake progress.
 *   • Copy / download the canvas as text for the learner's portfolio.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './CanvasBlock.css';

/** Standard Business Model Canvas sections (bilingual titles). */
export const DEFAULT_SECTIONS = [
  { key: 'partners', title: { en: 'Key Partners', ht: 'Patnè Kle' }, hint: { en: 'Who helps you deliver?', ht: 'Kilès ki ede w delivre?' } },
  { key: 'activities', title: { en: 'Key Activities', ht: 'Aktivite Kle' }, hint: { en: 'What must you do well?', ht: 'Ki sa ou dwe fè byen?' } },
  { key: 'resources', title: { en: 'Key Resources', ht: 'Resous Kle' }, hint: { en: 'What do you need?', ht: 'Ki sa ou bezwen?' } },
  { key: 'value', title: { en: 'Value Propositions', ht: 'Pwopozisyon Valè' }, hint: { en: 'Why should they choose you?', ht: 'Poukisa yo ta chwazi w?' } },
  { key: 'relationships', title: { en: 'Customer Relationships', ht: 'Relasyon ak Kliyan' }, hint: { en: 'How do you keep them?', ht: 'Kijan ou kenbe yo?' } },
  { key: 'channels', title: { en: 'Channels', ht: 'Kanal' }, hint: { en: 'How do they find you?', ht: 'Kijan yo jwenn ou?' } },
  { key: 'segments', title: { en: 'Customer Segments', ht: 'Segman Kliyan' }, hint: { en: 'Who exactly are they?', ht: 'Kilès egzakteman yo ye?' } },
  { key: 'costs', title: { en: 'Cost Structure', ht: 'Estrikti Depans' }, hint: { en: 'What does it cost?', ht: 'Konbyen sa koute?' } },
  { key: 'revenue', title: { en: 'Revenue Streams', ht: 'Sous Revni' }, hint: { en: 'How do you earn?', ht: 'Kijan ou touche lajan?' } },
];

/** Normalize any stored `sections` shape into `{ key, title, content }`. */
export function normalizeSections(raw, isHt = true) {
  const fallback = DEFAULT_SECTIONS.map((s) => ({
    key: s.key,
    title: s.title[isHt ? 'ht' : 'en'],
    hint: s.hint[isHt ? 'ht' : 'en'],
    content: '',
  }));

  if (!Array.isArray(raw) || raw.length === 0) return fallback;

  const cleaned = raw
    .map((section, i) => {
      if (!section) return null;
      if (typeof section === 'string') {
        return { key: `section-${i}`, title: section, hint: '', content: '' };
      }
      const title = section.title || section.name || section.label || `Section ${i + 1}`;
      const items = Array.isArray(section.items) ? section.items.join('\n') : '';
      const content = typeof section.content === 'string' ? section.content : items;
      return {
        key: section.key || section.id || `section-${i}`,
        // Fall back to the other language rather than showing an empty
        // heading when only one translation was filled in.
        title: typeof title === 'object'
          ? (title[isHt ? 'ht' : 'en'] || title[isHt ? 'en' : 'ht'] || '')
          : String(title),
        hint: section.hint
          ? (typeof section.hint === 'object'
            ? (section.hint[isHt ? 'ht' : 'en'] || section.hint[isHt ? 'en' : 'ht'] || '')
            : String(section.hint))
          : '',
        content: content || '',
      };
    })
    .filter(Boolean);

  return cleaned.length ? cleaned : fallback;
}

function storageKey(courseId, blockId) {
  return `atelnyo-canvas:${courseId || 'preview'}:${blockId || 'block'}`;
}

export default function CanvasBlock({
  block,
  lang = 'en',
  index,
  courseId,
  moduleIndex,
  onComplete,
  onViewed,
}) {
  const isHt = lang === 'ht';
  const sectionsFromBlock = useMemo(
    () => normalizeSections(block?.sections, isHt),
    [block?.sections, isHt],
  );

  const key = useMemo(() => storageKey(courseId, block?.id), [courseId, block?.id]);
  const viewedRef = useRef(false);
  const saveTimer = useRef(null);

  const [values, setValues] = useState(() => {
    const base = {};
    sectionsFromBlock.forEach((s) => { base[s.key] = s.content || ''; });
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
          Object.keys(base).forEach((k) => {
            if (typeof saved[k] === 'string') base[k] = saved[k];
          });
        }
      }
    } catch {
      // Private mode / quota — the canvas still works, it just won't persist.
    }
    return base;
  });
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    if (viewedRef.current || !block?.id) return;
    viewedRef.current = true;
    onViewed?.(moduleIndex, block.id, 'canvas');
  }, [block, moduleIndex, onViewed]);

  const writeDraft = useCallback((next) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
      setSavedAt(Date.now());
    } catch {
      // ignore — see above
    }
  }, [key]);

  const handleChange = useCallback((sectionKey, text) => {
    setValues((prev) => {
      const next = { ...prev, [sectionKey]: text };
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      // Short debounce: typing stays smooth, a refresh right after a
      // keystroke still lands.
      saveTimer.current = window.setTimeout(() => writeDraft(next), 350);
      return next;
    });
  }, [writeDraft]);

  useEffect(() => () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); }, []);

  const filled = useMemo(
    () => sectionsFromBlock.filter((s) => (values[s.key] || '').trim().length > 0).length,
    [sectionsFromBlock, values],
  );
  const canComplete = filled > 0;

  const asText = useCallback(() => {
    const title = block?.title || (isHt ? 'Kannavas Modèl Biznis' : 'Business Model Canvas');
    const lines = [title, ''];
    sectionsFromBlock.forEach((s) => {
      lines.push(`## ${s.title}`);
      lines.push((values[s.key] || '').trim() || (isHt ? '(vid)' : '(empty)'));
      lines.push('');
    });
    return lines.join('\n');
  }, [block?.title, isHt, sectionsFromBlock, values]);

  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(asText());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }, [asText]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([asText()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'business-model-canvas.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [asText]);

  return (
    <div className="ls-canvas-block">
      <div className="ls-canvas-head">
        <h3 className="ls-block-title">{block?.title || (isHt ? 'Kannavas Modèl Biznis' : 'Business Model Canvas')}</h3>
        <div className="ls-canvas-tools">
          <span className="ls-canvas-progress" aria-live="polite">
            {filled}/{sectionsFromBlock.length} {isHt ? 'seksyon' : 'sections'}
            {savedAt ? ` · ${isHt ? 'sove' : 'saved'}` : ''}
          </span>
          <button type="button" className="ls-canvas-btn" onClick={handleCopy}>
            <i className="fas fa-copy" aria-hidden="true" /> {copied ? (isHt ? 'Kopye ✔' : 'Copied ✔') : (isHt ? 'Kopye' : 'Copy')}
          </button>
          <button type="button" className="ls-canvas-btn" onClick={handleDownload}>
            <i className="fas fa-download" aria-hidden="true" /> .txt
          </button>
        </div>
      </div>

      <div className="ls-canvas-grid">
        {sectionsFromBlock.map((section) => {
          const id = `ls-canvas-${block?.id || 'b'}-${section.key}`;
          const value = values[section.key] || '';
          return (
            <div key={section.key} className={`ls-canvas-cell${value.trim() ? ' is-filled' : ''}`}>
              <label className="ls-canvas-cell-title" htmlFor={id}>{section.title}</label>
              {section.hint && <span className="ls-canvas-cell-hint">{section.hint}</span>}
              <textarea
                id={id}
                className="ls-canvas-textarea"
                value={value}
                placeholder={isHt ? 'Ekri ide w yo isit…' : 'Write your ideas here…'}
                onChange={(e) => handleChange(section.key, e.target.value)}
                rows={4}
              />
            </div>
          );
        })}
      </div>

      <div className="ls-canvas-foot">
        <button
          type="button"
          className="ls-btn ls-btn--primary"
          disabled={!canComplete}
          onClick={() => onComplete?.(moduleIndex, block.id, 'canvas')}
        >
          <i className="fas fa-check" aria-hidden="true" /> {isHt ? 'Mwen fini ak kannavas la' : "I'm done with the canvas"}
        </button>
        {!canComplete && (
          <span className="ls-canvas-note">
            {isHt ? 'Ranpli omwen yon seksyon pou w ka kontinye.' : 'Fill at least one section to continue.'}
          </span>
        )}
      </div>
    </div>
  );
}
