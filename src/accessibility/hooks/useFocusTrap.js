/**
 * src/accessibility/hooks/useFocusTrap.js
 *
 * React hook for focus trapping within a container.
 * Manages focus trap lifecycle and return-focus on deactivate.
 *
 * Usage:
 *   const containerRef = useRef(null);
 *   useFocusTrap(containerRef, { isActive: isOpen, onEscape: onClose });
 */
import { useEffect, useRef } from 'react';
import { trapFocus, pushFocusReturn, popFocusReturn } from '../utils/focus';

/**
 * @param {React.RefObject} containerRef - Ref to the container element
 * @param {object} options
 * @param {boolean} options.isActive - Whether the trap is active
 * @param {Function} options.onEscape - Callback when Escape is pressed
 * @param {boolean} options.restoreFocus - Whether to restore focus on deactivate (default: true)
 */
export default function useFocusTrap(containerRef, options = {}) {
  const { isActive = false, onEscape, restoreFocus = true } = options;
  const cleanupRef = useRef(null);

  useEffect(() => {
    if (!isActive || !containerRef?.current) {
      // Clean up any existing trap
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      return undefined;
    }

    // Push current focus onto the return stack
    pushFocusReturn(document.activeElement);

    // Set up the focus trap
    cleanupRef.current = trapFocus(containerRef.current, {
      onEscape,
      restoreOnDeactivate: false, // We handle restoration manually
    });

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      if (restoreFocus) {
        popFocusReturn();
      }
    };
  }, [isActive, containerRef, onEscape, restoreFocus]);
}
