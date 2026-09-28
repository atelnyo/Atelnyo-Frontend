/**
 * src/accessibility/index.js
 *
 * Accessibility Foundation — centralized barrel export.
 *
 * Architecture:
 *   ┌─────────────────────────────────────────┐
 *   │  Accessibility Foundation                │
 *   ├─────────────────────────────────────────┤
 *   │  Utilities                               │
 *   │  ├── announcer (live regions)            │
 *   │  ├── focus (trap, restore)               │
 *   │  ├── formAccessibility                   │
 *   │  ├── validation                          │
 *   │  └── constants (strings, rules)          │
 *   ├─────────────────────────────────────────┤
 *   │  Hooks                                   │
 *   │  ├── useReducedMotion                    │
 *   │  ├── useAnnounce                         │
 *   │  ├── useFocusTrap                        │
 *   │  └── useKeyboardNavigation               │
 *   ├─────────────────────────────────────────┤
 *   │  Components                              │
 *   │  ├── SkipNavigation                      │
 *   │  ├── AccessibleDialog                    │
 *   │  ├── AccessibleDrawer                    │
 *   │  ├── AccessibleTabs                      │
 *   │  ├── AccessibleAccordion                 │
 *   │  ├── AccessibleTooltip                   │
 *   │  ├── AccessibleMenu / MenuItem / Divider │
 *   │  ├── AccessibleEmptyState                │
 *   │  ├── AccessibleSearch                    │
 *   │  ├── AccessibleLockedContent             │
 *   │  └── AccessibleErrorRecovery             │
 *   └─────────────────────────────────────────┘
 */

// ─── Utilities ────────────────────────────────────────────────────
export {
  announce,
  clearAnnouncements,
  destroyAnnouncer,
} from './utils/announcer';

export {
  getFocusableElements,
  getFirstFocusable,
  getLastFocusable,
  trapFocus,
  pushFocusReturn,
  popFocusReturn,
  clearFocusReturnStack,
  safeFocus,
} from './utils/focus';

export {
  getFormFieldIds,
  createFieldProps,
  validateFieldAccessibility,
  createErrorSummary,
} from './utils/formAccessibility';

export {
  validateImageBlock,
  validateVideoBlock,
  validateExternalVideoBlock,
  validateAudioBlock,
  validateLinkAccessibility,
  validateHeadingHierarchy,
  validateInteractiveBlock,
  validateLessonAccessibility,
  validateCourseAccessibility,
} from './utils/validation';

export {
  A11Y_SEVERITY,
  A11Y_VALIDATION_RULES,
  FOCUS_SKIP_ID,
  FOCUS_MAIN_ID,
  LIVE_MODE,
  KEYS,
  DEFAULT_ACCESSIBILITY_META,
  IMAGE_ACCESSIBILITY,
  MIN_TOUCH_TARGET,
  CONTRAST,
  getA11yString,
  A11Y_STRINGS,
} from './utils/constants';

// ─── Hooks ────────────────────────────────────────────────────────
export { default as useReducedMotion } from './hooks/useReducedMotion';
export { default as useAnnounce } from './hooks/useAnnounce';
export { default as useFocusTrap } from './hooks/useFocusTrap';
export { default as useKeyboardNavigation } from './hooks/useKeyboardNavigation';

// ─── Components ───────────────────────────────────────────────────
export { default as SkipNavigation } from './components/SkipNavigation';
export { default as AccessibleDialog } from './components/AccessibleDialog';
export { default as AccessibleDrawer } from './components/AccessibleDrawer';
export { default as AccessibleTabs } from './components/AccessibleTabs';
export { default as AccessibleAccordion } from './components/AccessibleAccordion';
export { default as AccessibleTooltip } from './components/AccessibleTooltip';
export { AccessibleMenu, AccessibleMenuItem, AccessibleMenuDivider } from './components/AccessibleMenu';
export { default as AccessibleEmptyState } from './components/AccessibleEmptyState';
export { default as AccessibleSearch } from './components/AccessibleSearch';
export { default as AccessibleLockedContent } from './components/AccessibleLockedContent';
export { default as AccessibleErrorRecovery } from './components/AccessibleErrorRecovery';
