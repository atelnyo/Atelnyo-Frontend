/**
 * src/accessibility/utils/focus.js
 *
 * Centralized focus management utilities.
 *
 * Provides:
 *   - getFocusableElements: finds all focusable elements in a container
 *   - trapFocus: keeps Tab cycling within a container
 *   - restoreFocus: returns focus to a previously stored element
 *   - manageFocusOnRouteChange: handles focus after route transitions
 *
 * Design:
 *   - These are pure utilities, not React components
 *   - They work with any DOM container
 *   - They respect native element order (Tab = forward, Shift+Tab = backward)
 */

import { KEYS } from './constants';

// CSS selector for all focusable elements
const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"]):not([disabled])',
  'button:not([tabindex="-1"]):not([disabled]):not([aria-hidden="true"])',
  'input:not([tabindex="-1"]):not([disabled]):not([type="hidden"])',
  'select:not([tabindex="-1"]):not([disabled])',
  'textarea:not([tabindex="-1"]):not([disabled])',
  '[tabindex]:not([tabindex="-1"]):not([disabled])',
  '[contenteditable]:not([tabindex="-1"])',
].join(', ');

/**
 * Get all focusable elements within a container.
 * @param {HTMLElement} container
 * @returns {HTMLElement[]}
 */
export function getFocusableElements(container) {
  if (!container) return [];
  const elements = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
  return elements.filter((el) => {
    // Exclude elements explicitly hidden via CSS
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return true;
  });
}

/**
 * Get the first focusable element within a container.
 * @param {HTMLElement} container
 * @returns {HTMLElement|null}
 */
export function getFirstFocusable(container) {
  const elements = getFocusableElements(container);
  return elements[0] || null;
}

/**
 * Get the last focusable element within a container.
 * @param {HTMLElement} container
 * @returns {HTMLElement|null}
 */
export function getLastFocusable(container) {
  const elements = getFocusableElements(container);
  return elements[elements.length - 1] || null;
}

/**
 * Create a focus trap within a container.
 * Returns a cleanup function to remove the trap.
 *
 * @param {HTMLElement} container - The element to trap focus within
 * @param {object} options
 * @param {HTMLElement} options.initialFocus - Element to focus on trap activation
 * @param {Function} options.onEscape - Callback when Escape is pressed
 * @param {boolean} options.restoreOnDeactivate - Whether to restore focus on cleanup
 * @returns {Function} Cleanup function
 */
export function trapFocus(container, options = {}) {
  const { initialFocus, onEscape, restoreOnDeactivate = true } = options;

  // Store the element that had focus before the trap
  const previousFocus = document.activeElement;

  // Focus the initial element or the first focusable
  const target = initialFocus || getFirstFocusable(container);
  if (target) {
    // Defer to next frame so the DOM is ready
    requestAnimationFrame(() => target.focus());
  }

  const handleKeyDown = (e) => {
    if (e.key === KEYS.ESCAPE) {
      if (onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }
    }

    if (e.key !== KEYS.TAB) return;

    const focusable = getFocusableElements(container);
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      // Shift+Tab: if at first element, wrap to last
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab: if at last element, wrap to first
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  // Return cleanup function
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    if (restoreOnDeactivate && previousFocus && previousFocus.focus) {
      requestAnimationFrame(() => {
        try {
          previousFocus.focus();
        } catch {
          // Element may have been removed from DOM
        }
      });
    }
  };
}

// Stack for managing nested focus returns (modals on modals)
const _focusReturnStack = [];

/**
 * Push a focus return point.
 * Call this before opening a dialog/drawer/modal.
 *
 * @param {HTMLElement} element - The element to return focus to
 */
export function pushFocusReturn(element) {
  _focusReturnStack.push(element || document.activeElement);
}

/**
 * Pop and restore the most recent focus return point.
 * Call this after closing a dialog/drawer/modal.
 *
 * @returns {HTMLElement|null} The element that was restored
 */
export function popFocusReturn() {
  const element = _focusReturnStack.pop();
  if (element && element.focus) {
    requestAnimationFrame(() => {
      try {
        element.focus();
      } catch {
        // Element may have been removed from DOM
      }
    });
  }
  return element || null;
}

/**
 * Clear the focus return stack (for testing or cleanup).
 */
export function clearFocusReturnStack() {
  _focusReturnStack.length = 0;
}

/**
 * Move focus to a specific element with safety checks.
 * @param {HTMLElement} element
 * @param {object} options - { preventScroll: boolean }
 */
export function safeFocus(element, options = {}) {
  if (!element || !element.focus) return;
  try {
    // Make the element focusable if it isn't already
    if (element.tabIndex < 0 && !element.hasAttribute('tabindex')) {
      element.setAttribute('tabindex', '-1');
    }
    element.focus({ preventScroll: options.preventScroll || false });
  } catch {
    // Silently fail — focus management should never crash the app
  }
}
