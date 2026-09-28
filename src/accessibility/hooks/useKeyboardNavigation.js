/**
 * src/accessibility/hooks/useKeyboardNavigation.js
 *
 * Hook for common keyboard navigation patterns.
 *
 * Supports:
 *   - Arrow key navigation in lists/menus
 *   - Home/End navigation
 *   - Type-ahead in menus (optional)
 *   - Escape to close
 *
 * Usage:
 *   useKeyboardNavigation({
 *     containerRef,
 *     isActive: isMenuOpen,
 *     onEscape: closeMenu,
 *     itemSelector: '[role="menuitem"]',
 *   });
 */
import { useEffect, useCallback, useRef } from 'react';

/**
 * @param {object} options
 * @param {React.RefObject} options.containerRef - Ref to the container
 * @param {boolean} options.isActive - Whether keyboard nav is active
 * @param {Function} options.onEscape - Escape key callback
 * @param {string} options.itemSelector - CSS selector for navigable items
 * @param {string} options.orientation - 'vertical' | 'horizontal' | 'both'
 * @param {boolean} options.wrap - Whether to wrap around at edges
 */
export default function useKeyboardNavigation(options) {
  const {
    containerRef,
    isActive = false,
    onEscape,
    itemSelector = '[role="menuitem"], [role="tab"], li:not([aria-hidden])',
    orientation = 'vertical',
    wrap = true,
  } = options;

  const focusIndexRef = useRef(-1);

  const getItems = useCallback(() => {
    if (!containerRef?.current) return [];
    return Array.from(containerRef.current.querySelectorAll(itemSelector))
      .filter((el) => el.offsetParent !== null && !el.disabled);
  }, [containerRef, itemSelector]);

  const focusItem = useCallback((index) => {
    const items = getItems();
    if (items.length === 0) return;

    const clampedIndex = wrap
      ? ((index % items.length) + items.length) % items.length
      : Math.max(0, Math.min(index, items.length - 1));

    focusIndexRef.current = clampedIndex;
    items[clampedIndex]?.focus();
  }, [getItems, wrap]);

  useEffect(() => {
    if (!isActive || !containerRef?.current) return undefined;

    const handleKeyDown = (e) => {
      const items = getItems();
      if (items.length === 0) return;

      const currentIndex = items.indexOf(document.activeElement);
      if (currentIndex === -1 && focusIndexRef.current === -1) {
        // Nothing focused yet, focus the first item
        focusItem(0);
        return;
      }

      const idx = currentIndex >= 0 ? currentIndex : focusIndexRef.current;

      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          if (orientation === 'horizontal' || orientation === 'both' || e.key === 'ArrowDown') {
            e.preventDefault();
            focusItem(idx + 1);
          }
          break;

        case 'ArrowUp':
        case 'ArrowLeft':
          if (orientation === 'horizontal' || orientation === 'both' || e.key === 'ArrowUp') {
            e.preventDefault();
            focusItem(idx - 1);
          }
          break;

        case 'Home':
          e.preventDefault();
          focusItem(0);
          break;

        case 'End':
          e.preventDefault();
          focusItem(items.length - 1);
          break;

        case 'Escape':
          if (onEscape) {
            e.preventDefault();
            onEscape();
          }
          break;

        default:
          break;
      }
    };

    const container = containerRef.current;
    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [isActive, containerRef, onEscape, getItems, focusItem, orientation]);

  return { focusItem, getItems };
}
