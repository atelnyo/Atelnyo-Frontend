/**
 * TemplatePicker — Choose a starter template when creating a new course.
 *
 * The backend (GET /api/courses/templates/) owns the template catalog:
 * each entry is a syllabus outline (modules + suggested blocks), so the
 * picker only reports the chosen key. CourseFormModal applies it to the
 * freshly created course via POST /api/courses/<id>/template/.
 *
 * States are explicit: a card skeleton while the catalog loads (never a
 * bare "loading…" line), an error with a retry, and an honest empty
 * state. Selecting is a toggle — clicking the active card clears it.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { courseService } from '../../../services/api';
import './TemplatePicker.css';
import { inlineText } from '../../../utils/inlineI18n';

const DIFFICULTY_LABELS = {
  beginner: { en: 'Beginner', ht: 'Debitan' },
  intermediate: { en: 'Intermediate', ht: 'Mwayen' },
  advanced: { en: 'Advanced', ht: 'Avanse' },
};

export default function TemplatePicker({ lang = 'en', value = '', onSelect, heading = true, appliedNote }) {
  const isHt = lang === 'ht';
  const labelKey = isHt ? 'ht' : 'en';
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await courseService.templates();
      const rows = res?.data?.templates;
      setTemplates(Array.isArray(rows) ? rows : []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleSelect = (key) => {
    onSelect?.(key === value ? '' : key);
  };

  return (
    <section className="template-picker" aria-labelledby={heading ? 'course-template-title' : undefined}>
      {heading && (
        <h3 id="course-template-title">
          <i className="fas fa-layer-group" aria-hidden="true" />{' '}
          {isHt ? 'Chwazi yon Modèl' : inlineText(lang, 'Choose a Template')}
        </h3>
      )}
      <p className="tp-subtitle">
        {isHt
          ? 'Chwazi yon modèl pou kòmanse ak yon plan kou deja fèt, oswa kòmanse ak yon kou vid.'
          : inlineText(lang, 'Pick a template to start from a ready-made outline, or begin with a blank course.')}
      </p>

      {loading && (
        <div className="tp-grid" role="status" aria-busy="true">
          <span className="tp-sr-only">
            {isHt ? 'Ap chaje modèl yo…' : inlineText(lang, 'Loading templates…')}
          </span>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="tp-skeleton-card" aria-hidden="true">
              <span className="tp-skeleton-icon" />
              <span className="tp-skeleton-line tp-skeleton-line-title" />
              <span className="tp-skeleton-line" />
              <span className="tp-skeleton-line tp-skeleton-line-short" />
            </div>
          ))}
        </div>
      )}

      {!loading && failed && (
        <div className="tp-error" role="alert">
          <p>
            <i className="fas fa-triangle-exclamation" aria-hidden="true" />{' '}
            {isHt ? 'Pa t kapab chaje modèl yo.' : inlineText(lang, 'Could not load the templates.')}
          </p>
          <button type="button" className="tp-retry" onClick={loadTemplates}>
            <i className="fas fa-rotate" aria-hidden="true" />{' '}
            {isHt ? 'Eseye ankò' : inlineText(lang, 'Retry')}
          </button>
        </div>
      )}

      {!loading && !failed && templates.length === 0 && (
        <p className="tp-empty">
          {isHt
            ? 'Pa gen modèl disponib kounye a — kòmanse ak yon kou vid.'
            : inlineText(lang, 'No templates available right now — start with a blank course.')}
        </p>
      )}

      {!loading && !failed && templates.length > 0 && (
        <div className="tp-grid">
          {templates.map((t) => {
            const selected = t.key === value;
            const difficulty = DIFFICULTY_LABELS[t.difficulty]?.[labelKey] || t.difficulty;
            return (
              <button
                key={t.key}
                type="button"
                className={`tp-card${selected ? ' tp-card-selected' : ''}`}
                onClick={() => handleSelect(t.key)}
                aria-pressed={selected}
              >
                <span className="tp-icon" aria-hidden="true">{t.icon}</span>
                <h4 className="tp-name">{isHt ? t.name : t.name_en}</h4>
                <p className="tp-desc">{isHt ? t.description : t.description_en}</p>
                <div className="tp-meta">
                  <span>
                    {t.module_count} {isHt ? 'modil' : inlineText(lang, 'modules')}
                  </span>
                  <span className={`tp-diff tp-diff-${t.difficulty}`}>{difficulty}</span>
                </div>
                <span className="tp-select-hint">
                  {selected ? (
                    <>
                      <i className="fas fa-check" aria-hidden="true" />{' '}
                      {isHt ? 'Chwazi' : inlineText(lang, 'Selected')}
                    </>
                  ) : (
                    isHt ? 'Sèvi ak modèl sa a' : inlineText(lang, 'Use this template')
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!loading && !failed && value && (
        <p className="tp-applied-note" role="status">
          <i className="fas fa-wand-magic-sparkles" aria-hidden="true" />{' '}
          {appliedNote || (isHt
            ? 'Modèl la ap aplike sou kou a touswit apre w fin kreye l. Ou ka modifye modil yo apre.'
            : inlineText(lang, 'The template is applied to the course right after you create it. You can edit the modules afterwards.'))}
        </p>
      )}
    </section>
  );
}
