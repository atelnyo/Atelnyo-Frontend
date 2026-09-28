/**
 * src/accessibility/utils/constants.js
 *
 * Accessibility constants used across the platform.
 * Centralizes severity levels, validation types, and metadata defaults.
 */

// ─── Validation Severity Levels ────────────────────────────────────
export const A11Y_SEVERITY = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

// ─── Validation Result Shape ───────────────────────────────────────
export const createValidationResult = (severity, code, message, details = {}) => ({
  severity,
  code,
  message,
  ...details,
});

// ─── Focus management constants ────────────────────────────────────
export const FOCUS_SENTINEL = 'data-a11y-focus-sentinel';
export const FOCUS_SKIP_ID = 'a11y-skip-nav';
export const FOCUS_MAIN_ID = 'a11y-main-content';
export const FOCUS_MODAL_INITIAL = 'data-a11y-modal-first';
export const FOCUS_RETURN_ATTR = 'data-a11y-focus-return';

// ─── Live region modes ─────────────────────────────────────────────
export const LIVE_MODE = {
  POLITE: 'polite',
  ASSERTIVE: 'assertive',
  OFF: 'off',
};

// ─── Keyboard key constants ────────────────────────────────────────
export const KEYS = {
  TAB: 'Tab',
  SHIFT_TAB: 'ShiftTab',
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
};

// ─── Accessibility metadata defaults for content blocks ────────────
export const DEFAULT_ACCESSIBILITY_META = {
  keyboardSupport: true,
  screenReaderSupport: true,
  requiresAltText: false,
  supportsCaptions: false,
  supportsTranscript: false,
  supportsAccessibleName: true,
  supportsReducedMotion: true,
  ariaRole: null,
  validationRules: [],
};

// ─── Image accessibility defaults ──────────────────────────────────
export const IMAGE_ACCESSIBILITY = {
  MAX_ALT_LENGTH: 150,
  DECORATIVE_ALT: '',
};

// ─── Minimum touch target size (WCAG 2.5.8) ───────────────────────
export const MIN_TOUCH_TARGET = 44; // px

// ─── Minimum contrast ratios ───────────────────────────────────────
export const CONTRAST = {
  NORMAL_TEXT: 4.5,    // WCAG AA normal text
  LARGE_TEXT: 3,       // WCAG AA large text (>=18pt or >=14pt bold)
  UI_COMPONENTS: 3,    // WCAG AA non-text contrast
};

// ─── Accessibility validation rules for the ContentValidationEngine ─
export const A11Y_VALIDATION_RULES = {
  IMAGE_MISSING_ALT: 'image_missing_alt',
  IMAGE_EMPTY_ALT: 'image_empty_alt',
  IMAGE_DECORATIVE_NO_FLAG: 'image_decorative_no_flag',
  VIDEO_MISSING_TITLE: 'video_missing_title',
  VIDEO_MISSING_CAPTIONS: 'video_missing_captions',
  VIDEO_MISSING_TRANSCRIPT: 'video_missing_transcript',
  EXTERNAL_VIDEO_NO_CAPTIONS: 'external_video_no_captions',
  AUDIO_MISSING_TRANSCRIPT: 'audio_missing_transcript',
  LINK_EMPTY: 'link_empty',
  LINK_VAGUE_TEXT: 'link_vague_text',
  HEADING_SKIPPED: 'heading_skipped',
  HEADING_MISSING_H1: 'heading_missing_h1',
  BUTTON_NO_LABEL: 'button_no_label',
  INPUT_NO_LABEL: 'input_no_label',
  INTERACTIVE_BLOCK_NO_A11Y: 'interactive_block_no_accessibility',
  DRAG_DROP_NO_KEYBOARD_ALT: 'drag_drop_no_keyboard_alt',
};

// ─── Localized accessibility strings (minimal inline set) ──────────
export const A11Y_STRINGS = {
  en: {
    skipToMainContent: 'Skip to main content',
    closeDialog: 'Close',
    openNavigation: 'Open navigation',
    loading: 'Loading',
    saving: 'Saving',
    saved: 'Saved',
    error: 'Error',
    retry: 'Retry',
    requiredField: 'required',
    closeModal: 'Close dialog',
    lessonCompleted: 'Lesson completed',
    progressText: (current, total) => `${current} of ${total} completed`,
    notificationsCount: (count) => `${count} new notifications`,
    courseProgress: (pct) => `Course progress: ${pct}%`,
    lockedContent: 'Content locked',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    expandAccordion: 'Expand',
    collapseAccordion: 'Collapse',
    previousTab: 'Previous tab',
    nextTab: 'Next tab',
    draggedToPosition: (position) => `Moved to position ${position}`,
    focusModeOn: 'Focus mode enabled',
    focusModeOff: 'Focus mode disabled',
    navigationLandmark: 'Main navigation',
    contentLandmark: 'Main content',
    asideLandmark: 'Supplementary content',
    footerLandmark: 'Page footer',
    announcementSave: 'Changes saved',
    announcementError: 'An error occurred',
    accessibilityReview: 'Accessibility review',
    accessibilityReady: 'Accessibility ready',
  },
  ht: {
    skipToMainContent: 'Ale nan kontni prensipal la',
    closeDialog: 'Fèmen',
    openNavigation: 'Ouvri navigasyon',
    loading: 'Ap chaje',
    saving: 'Ap sove',
    saved: 'Sove',
    error: 'Erè',
    retry: 'Eseye ankò',
    requiredField: 'obligatwa',
    closeModal: 'Fèmen dyalòg',
    lessonCompleted: 'Leson fini',
    progressText: (current, total) => `${current} sou ${total} konplete`,
    notificationsCount: (count) => `${count} notifikasyon nouvo`,
    courseProgress: (pct) => `Pwogrè kou a: ${pct}%`,
    lockedContent: 'KontniBloke',
    openMenu: 'Ouvri meni',
    closeMenu: 'Fèmen meni',
    expandAccordion: 'Espande',
    collapseAccordion: 'Fere',
    previousTab: 'Tab anvan',
    nextTab: 'Tab apre',
    draggedToPosition: (position) => `Deplase nan pozisyon ${position}`,
    focusModeOn: 'Mòd konsantre aktive',
    focusModeOff: 'Mòd konsantre desactive',
    navigationLandmark: 'Navigasyon prensipal',
    contentLandmark: 'Kontni prensipal',
    asideLandmark: 'Kontni siplemantè',
    footerLandmark: 'Pyè paj la',
    announcementSave: 'Chanjman sove',
    announcementError: 'Yon erè rive',
    accessibilityReview: 'Revizyon aksesibilite',
    accessibilityReady: 'Aksesibilite pare',
  },
  fr: {
    skipToMainContent: 'Aller au contenu principal',
    closeDialog: 'Fermer',
    openNavigation: 'Ouvrir la navigation',
    loading: 'Chargement',
    saving: 'Enregistrement',
    saved: 'Enregistré',
    error: 'Erreur',
    retry: 'Réessayer',
    requiredField: 'requis',
    closeModal: 'Fermer la boîte de dialogue',
    lessonCompleted: 'Leçon terminée',
    progressText: (current, total) => `${current} sur ${total} terminés`,
    notificationsCount: (count) => `${count} nouvelles notifications`,
    courseProgress: (pct) => `Progression du cours : ${pct}%`,
    lockedContent: 'Contenu verrouillé',
    openMenu: 'Ouvrir le menu',
    closeMenu: 'Fermer le menu',
    expandAccordion: 'Développer',
    collapseAccordion: 'Réduire',
    previousTab: 'Onglet précédent',
    nextTab: 'Onglet suivant',
    draggedToPosition: (position) => `Déplacé à la position ${position}`,
    focusModeOn: 'Mode focus activé',
    focusModeOff: 'Mode focus désactivé',
    navigationLandmark: 'Navigation principale',
    contentLandmark: 'Contenu principal',
    asideLandmark: 'Contenu supplémentaire',
    footerLandmark: 'Pied de page',
    announcementSave: 'Modifications enregistrées',
    announcementError: 'Une erreur s\'est produite',
    accessibilityReview: 'Revue d\'accessibilité',
    accessibilityReady: 'Accessibilité prête',
  },
  es: {
    skipToMainContent: 'Ir al contenido principal',
    closeDialog: 'Cerrar',
    openNavigation: 'Abrir navegación',
    loading: 'Cargando',
    saving: 'Guardando',
    saved: 'Guardado',
    error: 'Error',
    retry: 'Reintentar',
    requiredField: 'requerido',
    closeModal: 'Cerrar diálogo',
    lessonCompleted: 'Lección completada',
    progressText: (current, total) => `${current} de ${total} completados`,
    notificationsCount: (count) => `${count} notificaciones nuevas`,
    courseProgress: (pct) => `Progreso del curso: ${pct}%`,
    lockedContent: 'Contenido bloqueado',
    openMenu: 'Abrir menú',
    closeMenu: 'Cerrar menú',
    expandAccordion: 'Expandir',
    collapseAccordion: 'Contraer',
    previousTab: 'Pestaña anterior',
    nextTab: 'Pestaña siguiente',
    draggedToPosition: (position) => `Movido a la posición ${position}`,
    focusModeOn: 'Modo enfoque activado',
    focusModeOff: 'Modo enfoque desactivado',
    navigationLandmark: 'Navegación principal',
    contentLandmark: 'Contenido principal',
    asideLandmark: 'Contenido suplementario',
    footerLandmark: 'Pie de página',
    announcementSave: 'Cambios guardados',
    announcementError: 'Ocurrió un error',
    accessibilityReview: 'Revisión de accesibilidad',
    accessibilityReady: 'Accesibilidad lista',
  },
};

/**
 * Get a localized accessibility string.
 * @param {string} lang - Current language code
 * @param {string} key - String key from A11Y_STRINGS
 * @param {...any} args - Arguments for template functions
 * @returns {string}
 */
export function getA11yString(lang, key, ...args) {
  const langStrings = A11Y_STRINGS[lang] || A11Y_STRINGS.en;
  const value = langStrings[key] || A11Y_STRINGS.en[key] || '';
  return typeof value === 'function' ? value(...args) : value;
}
