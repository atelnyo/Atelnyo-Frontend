/**
 * src/components/studio/modals/ProfileTemplateModal.jsx
 *
 * Profile Template picker — previews the curated layout presets
 * (section order + visibility) before applying one to the public profile.
 *
 * Applying a template is a DRAFT change: the caller stores it in the editor
 * form, and it only reaches the backend when the creator saves. Content is
 * never touched — only which sections show and in what order.
 */
import React, { useCallback, useState } from 'react';
import { StudioModal } from './shared';
import styles from './modals.module.css';
import { t as t4 } from '../../../utils/i18n';
import {
  PROFILE_TEMPLATES,
  PROFILE_SECTION_IDS,
  applyProfileTemplate,
  getProfileTemplate,
  templateDescription,
  templateName,
} from '../../profile/profileTemplates';

// Tiny wireframe labels for the preview bars — same ids the real page uses.
const PREVIEW_LABELS = {
  dashboard: 'Overview',
  picks: 'Picks',
  courses: 'Courses',
  products: 'Products',
  portfolio: 'Portfolio',
  reviews: 'Reviews',
  about: 'About',
};

export default function ProfileTemplateModal({
  onClose,
  onApply,
  lang = 'en',
  currentTemplateId = null,
  currentConfig = null,
}) {
  const [selectedId, setSelectedId] = useState(
    () => (getProfileTemplate(currentTemplateId)?.id || PROFILE_TEMPLATES[0].id),
  );
  const selected = getProfileTemplate(selectedId) || PROFILE_TEMPLATES[0];

  const handleApply = useCallback(() => {
    // Preserve any forward-compatible section ids from the current draft.
    const config = applyProfileTemplate(selected, currentConfig);
    onApply?.(config, selected);
    onClose?.();
  }, [selected, currentConfig, onApply, onClose]);

  // Radiogroup keyboard contract: arrows move selection/focus, Home/End jump
  // to the edges. Roving tabIndex keeps one stop in the Tab order.
  const handleCardKeyDown = useCallback((event, index) => {
    const count = PROFILE_TEMPLATES.length;
    let nextIndex = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % count;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + count) % count;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = count - 1;
    }
    if (nextIndex === null) { return; }
    event.preventDefault();
    setSelectedId(PROFILE_TEMPLATES[nextIndex].id);
    const focusCard = () => document
      .querySelector(`[data-template-card="${nextIndex}"]`)
      ?.focus();
    if (typeof requestAnimationFrame === 'function') { requestAnimationFrame(focusCard); }
    else { focusCard(); }
  }, []);

  return (
    <StudioModal
      onClose={onClose}
      icon="fa-layer-group"
      wide
      title={t4(lang, 'Modèl Pwofil', 'Profile Templates', 'Modèles de profil', 'Plantillas de perfil')}
      subtitle={t4(
        lang,
        'Chwazi yon layout — kontni ou pa janm chanje, se sèlman lòd ak vizibilite seksyon yo.',
        'Pick a layout — your content never changes, only section order and visibility.',
        'Choisissez une mise en page — votre contenu ne change pas, seulement l’ordre et la visibilité.',
        'Elige un diseño — tu contenido no cambia, solo el orden y la visibilidad.',
      )}
    >
      <div className={styles.templateGrid} role="radiogroup"
        aria-label={t4(lang, 'Modèl layout pwofil', 'Profile layout templates', 'Modèles de mise en page', 'Plantillas de diseño')}>
        {PROFILE_TEMPLATES.map((template, index) => {
          const config = applyProfileTemplate(template);
          const active = template.id === selectedId;
          return (
            <button
              key={template.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${templateName(template, lang)}. ${templateDescription(template, lang)}`}
              tabIndex={active ? 0 : -1}
              data-template-card={index}
              className={`${styles.templateCard}${active ? ` ${styles.templateCardActive}` : ''}`}
              onClick={() => setSelectedId(template.id)}
              onKeyDown={(event) => handleCardKeyDown(event, index)}
            >
              <span className={styles.templatePreview} aria-hidden="true">
                {PROFILE_SECTION_IDS.map((id) => (
                  <span
                    key={id}
                    className={`${styles.templatePreviewBar}${config.section_visibility[id] === false ? ` ${styles.templatePreviewBarHidden}` : ''}`}
                  >
                    <i className={`fas ${id === 'about' ? 'fa-user' : id === 'courses' ? 'fa-graduation-cap' : id === 'products' ? 'fa-cube' : id === 'portfolio' ? 'fa-briefcase' : id === 'reviews' ? 'fa-star' : id === 'picks' ? 'fa-bookmark' : 'fa-th-large'}`} />
                    {PREVIEW_LABELS[id]}
                  </span>
                ))}
              </span>
              <span className={styles.templateTitleRow}>
                <span className={styles.templateIcon}><i className={`fas ${template.icon}`} aria-hidden="true" /></span>
                <span className={styles.templateName}>{templateName(template, lang)}</span>
                {active && <i className={`fas fa-circle-check ${styles.templateCheck}`} aria-hidden="true" />}
              </span>
              <span className={styles.templateDesc}>{templateDescription(template, lang)}</span>
            </button>
          );
        })}
      </div>

      <p className={styles.templateFootnote}>
        <i className="fas fa-circle-info" aria-hidden="true" />
        {t4(
          lang,
          'Ou ka reòganize oswa kache seksyon endividyèl apre w aplike yon modèl.',
          'You can still reorder or hide individual sections after applying a template.',
          'Vous pouvez toujours réorganiser ou masquer des sections après avoir appliqué un modèle.',
          'Aún puedes reordenar u ocultar secciones después de aplicar una plantilla.',
        )}
      </p>

      <div className={styles.actions}>
        <button type="button" className="btn-secondary" onClick={onClose}>
          {t4(lang, 'Anile', 'Cancel', 'Annuler', 'Cancelar')}
        </button>
        <button type="button" className="btn-primary" onClick={handleApply}>
          <i className="fas fa-wand-magic-sparkles" aria-hidden="true" />{' '}
          {t4(lang, 'Aplike Modèl', 'Apply Template', 'Appliquer le modèle', 'Aplicar plantilla')}
        </button>
      </div>

      <span className={styles.srOnly} aria-live="polite">
        {t4(lang, 'Chwazi:', 'Selected:', 'Sélectionné :', 'Seleccionado:')} {templateName(selected, lang)}
      </span>
    </StudioModal>
  );
}
