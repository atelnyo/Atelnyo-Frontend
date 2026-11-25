/**
 * TemplatePicker — Choose a starter template when creating a new course.
 *
 * The backend (GET /api/courses/templates/) owns the template catalog:
 * each entry is a syllabus outline, so the picker only reports the chosen
 * key. CourseFormModal / CourseTemplateModal apply it via
 * POST /api/courses/<id>/template/.
 *
 * Selecting a card now loads its full outline
 * (GET /api/courses/templates/<key>/) and previews what will actually be
 * written to the course: the teaching objectives, every module in order,
 * its block mix and a time estimate. A creator should never have to apply
 * a template to find out what is inside it.
 *
 * States are explicit: a card skeleton while the catalog loads (never a
 * bare "loading…" line), an error with a retry, an honest empty state,
 * and a separate preview state that fails quietly (the template still
 * applies if only the preview request failed).
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

/** "2.5 h" for a full course, "45 min" for a short one. */
function formatDuration(hours) {
  const value = Number(hours);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value >= 1) return `${Number(value.toFixed(1))} h`;
  return `${Math.round(value * 60)} min`;
}

export default function TemplatePicker({ lang = 'en', value = '', onSelect, heading = true, appliedNote }) {
  const isHt = lang === 'ht';
  const labelKey = isHt ? 'ht' : 'en';
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  const t = (en, ht) => (isHt ? ht : inlineText(lang, en));

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

  // Preview the selected template. "blank" has no outline to show, and a
  // service without the endpoint (older mock) simply skips the preview.
  useEffect(() => {
    if (!value || value === 'blank' || typeof courseService.templateDetail !== 'function') {
      setPreview(null);
      setPreviewFailed(false);
      setPreviewLoading(false);
      return undefined;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewFailed(false);
    setPreview(null);
    courseService.templateDetail(value)
      .then((res) => {
        if (!cancelled) setPreview(res?.data || null);
      })
      .catch(() => {
        if (!cancelled) {
          setPreview(null);
          setPreviewFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => { cancelled = true; };
  }, [value]);

  const handleSelect = (key) => {
    onSelect?.(key === value ? '' : key);
  };

  const objectives = preview
    ? (isHt
      ? preview.objectives
      : (preview.objectives_en?.length ? preview.objectives_en : preview.objectives))
    : null;
  const duration = preview ? formatDuration(preview.estimated_hours) : null;

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
          {templates.map((tpl) => {
            const selected = tpl.key === value;
            const difficulty = DIFFICULTY_LABELS[tpl.difficulty]?.[labelKey] || tpl.difficulty;
            const hours = formatDuration(tpl.estimated_hours);
            return (
              <button
                key={tpl.key}
                type="button"
                className={`tp-card${selected ? ' tp-card-selected' : ''}`}
                onClick={() => handleSelect(tpl.key)}
                aria-pressed={selected}
              >
                <span className="tp-icon" aria-hidden="true">{tpl.icon}</span>
                <h4 className="tp-name">{isHt ? tpl.name : tpl.name_en}</h4>
                <p className="tp-desc">{isHt ? tpl.description : tpl.description_en}</p>
                <div className="tp-meta">
                  <span>
                    {tpl.module_count} {isHt ? 'modil' : inlineText(lang, 'modules')}
                  </span>
                  {hours && (
                    <span>
                      <i className="fas fa-clock" aria-hidden="true" /> {hours}
                    </span>
                  )}
                  <span className={`tp-diff tp-diff-${tpl.difficulty}`}>{difficulty}</span>
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

      {!loading && !failed && value && value !== 'blank' && (
        <div className="tp-preview" aria-live="polite">
          {previewLoading && (
            <div className="tp-preview-loading" role="status" aria-busy="true">
              <span className="tp-sr-only">
                {t('Loading the outline…', 'Ap chaje plan an…')}
              </span>
              <span className="tp-skeleton-line tp-skeleton-line-title" aria-hidden="true" />
              <span className="tp-skeleton-line" aria-hidden="true" />
              <span className="tp-skeleton-line tp-skeleton-line-short" aria-hidden="true" />
            </div>
          )}

          {!previewLoading && previewFailed && (
            <p className="tp-preview-note">
              <i className="fas fa-circle-info" aria-hidden="true" />{' '}
              {t(
                'The outline preview could not load — the template still applies.',
                'Aperçu plan an pa t chaje — modèl la ap aplike kanmenm.',
              )}
            </p>
          )}

          {!previewLoading && preview && (
            <>
              <div className="tp-preview-head">
                <h4>
                  <i className="fas fa-list-check" aria-hidden="true" />{' '}
                  {t('What this template gives you', 'Sa modèl sa a bay ou')}
                </h4>
                <span className="tp-preview-total">
                  {duration && <>{duration} · </>}
                  {preview.module_count} {isHt ? 'modil' : inlineText(lang, 'modules')} ·{' '}
                  {preview.block_count} {isHt ? 'blòk' : inlineText(lang, 'blocks')}
                </span>
              </div>

              {Array.isArray(objectives) && objectives.length > 0 && (
                <ul className="tp-objectives">
                  {objectives.map((objective) => (
                    <li key={objective}>
                      <i className="fas fa-check" aria-hidden="true" /> {objective}
                    </li>
                  ))}
                </ul>
              )}

              {preview.modules?.length > 0 && (
                <ol className="tp-outline">
                  {preview.modules.map((module) => (
                    <li key={module.position} className="tp-outline-item">
                      <span className="tp-outline-title">{module.title}</span>
                      <span className="tp-outline-meta">
                        {module.block_count}{' '}
                        {isHt ? 'blòk' : inlineText(lang, 'blocks')}
                        {' · '}
                        {module.estimated_minutes}{' '}
                        {isHt ? 'min' : inlineText(lang, 'min')}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
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
