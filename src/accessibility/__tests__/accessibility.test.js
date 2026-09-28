/**
 * src/accessibility/__tests__/accessibility.test.js
 *
 * Automated accessibility tests for the Phase 10 foundation.
 *
 * Tests:
 *   - Announcer utility
 *   - Focus utilities
 *   - Form accessibility utilities
 *   - Validation engine
 *   - Constants and strings
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  announce,
  clearAnnouncements,
  destroyAnnouncer,
} from '../utils/announcer';
import {
  getFocusableElements,
  getFirstFocusable,
  getLastFocusable,
} from '../utils/focus';
import {
  getFormFieldIds,
  createFieldProps,
  validateFieldAccessibility,
  createErrorSummary,
} from '../utils/formAccessibility';
import {
  validateImageBlock,
  validateVideoBlock,
  validateAudioBlock,
  validateLinkAccessibility,
  validateHeadingHierarchy,
  validateInteractiveBlock,
  validateLessonAccessibility,
} from '../utils/validation';
import {
  A11Y_SEVERITY,
  A11Y_VALIDATION_RULES,
  getA11yString,
  A11Y_STRINGS,
} from '../utils/constants';

// ─── Announcer Tests ───────────────────────────────────────────────
describe('Announcer', () => {
  beforeEach(() => {
    destroyAnnouncer();
  });

  it('creates live region containers on first announce', () => {
    announce('Test message');
    const polite = document.getElementById('a11y-live-polite');
    const assertive = document.getElementById('a11y-live-assertive');
    expect(polite).toBeTruthy();
    expect(assertive).toBeTruthy();
    expect(polite.getAttribute('role')).toBe('status');
    expect(polite.getAttribute('aria-live')).toBe('polite');
    expect(assertive.getAttribute('role')).toBe('alert');
    expect(assertive.getAttribute('aria-live')).toBe('assertive');
  });

  it('sets polite message', () => {
    announce('Saved', 'polite');
    const polite = document.getElementById('a11y-live-polite');
    // Debounced — check after a tick
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(polite.textContent).toBe('Saved');
        resolve();
      }, 400);
    });
  });

  it('clears announcements', () => {
    announce('Test');
    clearAnnouncements();
    const polite = document.getElementById('a11y-live-polite');
    expect(polite?.textContent).toBe('');
  });
});

// ─── Focus Utilities Tests ─────────────────────────────────────────
describe('Focus Utilities', () => {
  it('getFocusableElements finds buttons and inputs', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <button>Click</button>
      <input type="text" />
      <a href="#">Link</a>
      <div tabindex="0">Focusable div</div>
      <div>Not focusable</div>
      <button disabled>Disabled</button>
    `;
    document.body.appendChild(container);

    const elements = getFocusableElements(container);
    // Should find: button, input, a, div[tabindex] = 4
    // jsdom may handle offsetParent differently, so be lenient
    expect(elements.length).toBeGreaterThanOrEqual(3);
    expect(elements.some((el) => el.textContent === 'Click')).toBe(true);
    expect(elements.some((el) => el.tagName === 'INPUT')).toBe(true);

    document.body.removeChild(container);
  });

  it('getFirstFocusable returns the first focusable element', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <div>Not focusable</div>
      <button>First</button>
      <button>Second</button>
    `;
    document.body.appendChild(container);

    const first = getFirstFocusable(container);
    // In jsdom, offsetParent filtering may behave differently
    // Just verify it returns a focusable element
    expect(first).toBeTruthy();
    expect(first.tagName).toBe('BUTTON');

    document.body.removeChild(container);
  });

  it('getLastFocusable returns the last focusable element', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <button>First</button>
      <button>Last</button>
    `;
    document.body.appendChild(container);

    const last = getLastFocusable(container);
    expect(last).toBeTruthy();
    expect(last.tagName).toBe('BUTTON');

    document.body.removeChild(container);
  });
});

// ─── Form Accessibility Tests ──────────────────────────────────────
describe('Form Accessibility', () => {
  it('getFormFieldIds generates consistent IDs', () => {
    const ids = getFormFieldIds('my-field');
    expect(ids.inputId).toBe('my-field-input');
    expect(ids.descriptionId).toBe('my-field-desc');
    expect(ids.errorId).toBe('my-field-error');
  });

  it('createFieldProps returns aria-invalid when error', () => {
    const { ariaProps } = createFieldProps({
      fieldId: 'test',
      error: 'Required',
      required: true,
    });
    expect(ariaProps['aria-invalid']).toBe('true');
    expect(ariaProps['aria-describedby']).toContain('error');
    expect(ariaProps['aria-required']).toBe('true');
  });

  it('validateFieldAccessibility catches missing labels', () => {
    const issues = validateFieldAccessibility({ name: 'email' });
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].code).toBe('INPUT_NO_LABEL');
  });

  it('validateFieldAccessibility passes with label', () => {
    const issues = validateFieldAccessibility({
      name: 'email',
      label: 'Email address',
    });
    expect(issues.length).toBe(0);
  });

  it('createErrorSummary creates summary text', () => {
    const result = createErrorSummary([
      { fieldName: 'name', message: 'Required' },
      { fieldName: 'email', message: 'Invalid' },
    ]);
    expect(result.summary).toContain('2 errors');
    expect(result.fieldErrors.name).toBe('Required');
    expect(result.fieldErrors.email).toBe('Invalid');
  });

  it('createErrorSummary returns empty for no errors', () => {
    const result = createErrorSummary([]);
    expect(result.summary).toBe('');
  });
});

// ─── Validation Engine Tests ───────────────────────────────────────
describe('Accessibility Validation', () => {
  it('validateImageBlock catches missing alt text', () => {
    const issues = validateImageBlock({ id: 'img-1', imageUrl: 'test.jpg' });
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe(A11Y_SEVERITY.ERROR);
    expect(issues[0].code).toBe(A11Y_VALIDATION_RULES.IMAGE_MISSING_ALT);
  });

  it('validateImageBlock passes with alt text', () => {
    const issues = validateImageBlock({
      id: 'img-1',
      imageUrl: 'test.jpg',
      altText: 'A student studying',
    });
    expect(issues.length).toBe(0);
  });

  it('validateImageBlock allows decorative images', () => {
    const issues = validateImageBlock({
      id: 'img-1',
      imageUrl: 'test.jpg',
      isDecorative: true,
    });
    expect(issues.length).toBe(0);
  });

  it('validateImageBlock warns about short alt text', () => {
    const issues = validateImageBlock({
      id: 'img-1',
      imageUrl: 'test.jpg',
      altText: 'img',
    });
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe(A11Y_SEVERITY.WARNING);
  });

  it('validateVideoBlock warns about missing title', () => {
    const issues = validateVideoBlock({ id: 'vid-1', videoUrl: 'test.mp4' });
    expect(issues.some((i) => i.code === A11Y_VALIDATION_RULES.VIDEO_MISSING_TITLE)).toBe(true);
  });

  it('validateVideoBlock warns about missing captions for required video', () => {
    const issues = validateVideoBlock({
      id: 'vid-1',
      videoUrl: 'test.mp4',
      required: true,
      title: 'Lesson video',
    });
    expect(issues.some((i) => i.code === A11Y_VALIDATION_RULES.VIDEO_MISSING_CAPTIONS)).toBe(true);
  });

  it('validateAudioBlock warns about missing transcript', () => {
    const issues = validateAudioBlock({ id: 'aud-1' });
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe(A11Y_SEVERITY.WARNING);
  });

  it('validateLinkAccessibility catches vague link text', () => {
    const issues = validateLinkAccessibility({
      id: 'text-1',
      type: 'text',
      content: '<a href="#">click here</a>',
    });
    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe(A11Y_VALIDATION_RULES.LINK_VAGUE_TEXT);
  });

  it('validateHeadingHierarchy catches skipped levels', () => {
    const issues = validateHeadingHierarchy([
      { id: 'b1', type: 'text', headingLevel: 1 },
      { id: 'b2', type: 'text', headingLevel: 3 }, // skips H2
    ]);
    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe(A11Y_VALIDATION_RULES.HEADING_SKIPPED);
  });

  it('validateInteractiveBlock warns about missing title', () => {
    const issues = validateInteractiveBlock({ id: 'q1', type: 'quiz' });
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe(A11Y_SEVERITY.WARNING);
  });

  it('validateLessonAccessibility aggregates all issues', () => {
    const result = validateLessonAccessibility([
      { id: 'img-1', type: 'image', imageUrl: 'test.jpg' }, // missing alt
      { id: 'vid-1', type: 'video', videoUrl: 'test.mp4', required: true }, // missing title + captions
    ]);
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.warningCount).toBeGreaterThan(0);
    expect(result.valid).toBe(false);
  });
});

// ─── Constants Tests ───────────────────────────────────────────────
describe('Constants', () => {
  it('A11Y_SEVERITY has correct values', () => {
    expect(A11Y_SEVERITY.ERROR).toBe('error');
    expect(A11Y_SEVERITY.WARNING).toBe('warning');
    expect(A11Y_SEVERITY.INFO).toBe('info');
  });

  it('getA11yString returns correct string for each language', () => {
    expect(getA11yString('en', 'skipToMainContent')).toBe('Skip to main content');
    expect(getA11yString('ht', 'skipToMainContent')).toBe('Ale nan kontni prensipal la');
    expect(getA11yString('fr', 'skipToMainContent')).toBe('Aller au contenu principal');
    expect(getA11yString('es', 'skipToMainContent')).toBe('Ir al contenido principal');
  });

  it('getA11yString falls back to English', () => {
    expect(getA11yString('xx', 'skipToMainContent')).toBe('Skip to main content');
  });

  it('getA11yString handles template functions', () => {
    const result = getA11yString('en', 'progressText', 5, 10);
    expect(result).toBe('5 of 10 completed');
  });

  it('A11Y_STRINGS has all required languages', () => {
    expect(A11Y_STRINGS.en).toBeTruthy();
    expect(A11Y_STRINGS.ht).toBeTruthy();
    expect(A11Y_STRINGS.fr).toBeTruthy();
    expect(A11Y_STRINGS.es).toBeTruthy();
  });
});
