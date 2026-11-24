/**
 * CourseTemplateModal — apply a starter template to a course that has no
 * syllabus yet.
 *
 * The backend refuses to fill a course that already has modules
 * (POST /api/courses/<id>/template/ → 400), so this modal is only opened
 * from rows whose syllabus is empty. It reuses TemplatePicker for the
 * catalog and reports the real number of modules the server created.
 */
import React, { useState } from 'react';
import { StudioModal } from '../modals/shared';
import TemplatePicker from '../editor/TemplatePicker';
import { courseService } from '../../../services/api';
import { inlineText } from '../../../utils/inlineI18n';
import styles from '../modals/modals.module.css';

export default function CourseTemplateModal({ course, lang = 'en', showToast, onClose, onApplied }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : inlineText(lang, en));
  const [templateKey, setTemplateKey] = useState('');
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  // "blank" is a valid catalog entry but has no modules: applying it would
  // be a no-op, so it never enables the action.
  const canApply = Boolean(templateKey) && templateKey !== 'blank' && !applying;

  const handleApply = async () => {
    if (!canApply) return;
    setApplying(true);
    setError('');
    try {
      const res = await courseService.applyTemplate(course.id, templateKey);
      const modules = res?.data?.modules ?? 0;
      showToast?.(
        t(`✅ Template applied — ${modules} modules.`, `✅ Modèl aplike — ${modules} modil.`),
        'check-circle',
      );
      onApplied?.();
      onClose?.();
    } catch (err) {
      setError(
        err?.response?.data?.error
        || err?.response?.data?.detail
        || t('Could not apply the template.', 'Pa t kapab aplike modèl la.'),
      );
    } finally {
      setApplying(false);
    }
  };

  return (
    <StudioModal
      onClose={onClose}
      icon="fa-wand-magic-sparkles"
      title={t('Add a starter outline', 'Ajoute yon plan kòmansman')}
      subtitle={t(
        `Fill “${course?.title || ''}” with a ready-made syllabus. You can edit every module afterwards.`,
        `Ranpli “${course?.title || ''}” ak yon silabis deja fèt. Ou ka modifye chak modil apre.`,
      )}
      wide
    >
      <TemplatePicker
        lang={lang}
        value={templateKey}
        onSelect={setTemplateKey}
        heading={false}
        appliedNote={t(
          'The outline is written to this course as soon as you apply it.',
          'Plan an ekri nan kou sa a touswit apre w aplike l.',
        )}
      />

      {error && (
        <p className={styles.apiError} role="alert">
          <i className="fas fa-triangle-exclamation" aria-hidden="true" /> {error}
        </p>
      )}

      <div className={styles.actions}>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={applying}>
          {t('Cancel', 'Anile')}
        </button>
        <button type="button" className="btn-primary" onClick={handleApply} disabled={!canApply}>
          {applying ? (
            <>
              <i className="fas fa-spinner fa-spin" aria-hidden="true" /> {t('Applying…', 'Ap aplike…')}
            </>
          ) : (
            <>
              <i className="fas fa-wand-magic-sparkles" aria-hidden="true" /> {t('Apply template', 'Aplike modèl')}
            </>
          )}
        </button>
      </div>
    </StudioModal>
  );
}
