/**
 * src/hooks/useKeyboardShortcuts.js
 *
 * Registers keyboard shortcuts on a target element (default: document).
 * Supports modifier keys (Ctrl/Cmd, Shift, Alt) and key combinations.
 *
 * Usage:
 *   useKeyboardShortcuts([
 *     { key: 'z', ctrl: true, action: () => undo(), label: 'Undo' },
 *     { key: 'z', ctrl: true, shift: true, action: () => redo(), label: 'Redo' },
 *     { key: 's', ctrl: true, action: () => save(), label: 'Save' },
 *   ], { enabled: true });
 *
 * Design:
 *   - Uses event.key (not keyCode) for modern browser support
 *   - Ctrl key maps to Cmd on Mac (metaKey)
 *   - Prevents default browser behavior when shortcut fires
 *   - Only fires when enabled is true
 */
import { useEffect, useRef } from 'react';

/**
 * @param {Array} shortcuts - Array of shortcut definitions
 * @param {object} opts - { enabled, target }
 */
export default function useKeyboardShortcuts(shortcuts = [], { enabled = true, target = null } = {}) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;

    const el = target || document;
    const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

    const handler = (e) => {
      for (const shortcut of shortcutsRef.current) {
        const { key, ctrl = false, shift = false, alt = false, meta = false, action, preventDefault = true } = shortcut;

        // Check modifier keys
        const ctrlKey = isMac ? e.metaKey : e.ctrlKey;
        if (ctrl && !ctrlKey) continue;
        if (!ctrl && ctrlKey) continue;
        if (shift && !e.shiftKey) continue;
        if (!shift && e.shiftKey) continue;
        if (alt && !e.altKey) continue;
        if (!alt && e.altKey) continue;
        if (meta && !e.metaKey) continue;
        if (!meta && e.metaKey) continue;

        // Check key
        if (e.key.toLowerCase() !== key.toLowerCase()) continue;

        // Match found — fire action
        if (preventDefault) {
          e.preventDefault();
          e.stopPropagation();
        }
        action(e);
        return;
      }
    };

    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [enabled, target]);
}
