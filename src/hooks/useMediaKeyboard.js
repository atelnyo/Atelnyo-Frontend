/**
 * useMediaKeyboard — Keyboard shortcuts hook for media UI.
 *
 * Shortcuts (Prompt 23 §11 — Media Keyboard Shortcuts):
 *   Space         — Preview
 *   Enter         — Open
 *   F2            — Rename
 *   Ctrl+C        — Copy URL
 *   Ctrl+Shift+C  — Copy Atelnyo Link
 *   Delete        — Archive (confirm before destructive)
 *   Escape        — Close panel / deselect all
 *   Ctrl+A        — Select all (existing, in selection mode)
 *   /             — Focus search
 *   g then g      — Go to top
 *   j / k         — Navigate items (vim-style)
 *   ?             — Show shortcut help
 *
 * Behavior:
 *   - Skips when focus is inside INPUT / TEXTAREA / contenteditable.
 *   - Returns null (no DOM output). Caller renders the visual UI.
 *   - `enabled` flag lets a parent opt-out (e.g. when a child drawer
 *     has its own focus trap).
 *
 * Used by:
 *   - MediaEntityPage (page-level binding)
 *   - MediaInspector (drawer-level binding)
 */
import { useEffect, useCallback, useRef } from 'react';

export default function useMediaKeyboard({
  // ─── Spec shortcuts (Prompt 23 §11) ─────────────────────────────────
  onPreview,           // Space
  onOpen,              // Enter (when not inside an input)
  onRename,            // F2
  onCopyUrl,           // Ctrl+C / Cmd+C  (only fires if no text selection)
  onCopyAtelnyoLink,   // Ctrl+Shift+C / Cmd+Shift+C
  onDelete,            // Delete / Backspace
  // ─── Pre-existing shortcuts ────────────────────────────────────────
  onEscape,
  onSelectAll,
  onSearchFocus,
  onNavigateUp,
  onNavigateDown,
  onToggleShortcutHelp,
  onShare,             // s key (prompt 23 future)
  enabled = true,
} = {}) {
  const bufferRef = useRef('');
  const timeoutRef = useRef(null);

  const handleKeyDown = useCallback((e) => {
    if (!enabled) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const key = e.key;

    // ─── Spec shortcuts ──────────────────────────────────────────────
    // Space — Preview
    if (key === ' ' && onPreview) {
      e.preventDefault();
      onPreview();
      return;
    }

    // Enter — Open
    if (key === 'Enter' && onOpen) {
      e.preventDefault();
      onOpen();
      return;
    }

    // F2 — Rename
    if (key === 'F2' && onRename) {
      e.preventDefault();
      onRename();
      return;
    }

    // Ctrl+Shift+C / Cmd+Shift+C — Copy Atelnyo Link (must precede Ctrl+C below)
    if (ctrl && shift && (key === 'C' || key === 'c') && onCopyAtelnyoLink) {
      e.preventDefault();
      onCopyAtelnyoLink();
      return;
    }

    // Ctrl+C / Cmd+C — Copy URL (skip if user actually selected text)
    if (ctrl && !shift && (key === 'C' || key === 'c') && onCopyUrl) {
      const sel = window.getSelection && window.getSelection();
      const hasSelection = sel && String(sel.toString() || '').length > 0;
      if (!hasSelection) {
        e.preventDefault();
        onCopyUrl();
        return;
      }
    }

    // Delete — Archive
    if ((key === 'Delete' || key === 'Backspace') && onDelete) {
      e.preventDefault();
      onDelete();
      return;
    }

    // s — Share
    if (!ctrl && key === 's' && onShare) {
      e.preventDefault();
      onShare();
      return;
    }

    // ─── Pre-existing shortcuts ──────────────────────────────────────
    // Escape
    if (key === 'Escape' && onEscape) {
      e.preventDefault();
      onEscape();
      return;
    }

    // Ctrl+A / Cmd+A
    if (ctrl && (key === 'a' || key === 'A') && onSelectAll) {
      e.preventDefault();
      onSelectAll();
      return;
    }

    // / — Focus search
    if (key === '/' && onSearchFocus) {
      e.preventDefault();
      onSearchFocus();
      return;
    }

    // ? — Show shortcuts
    if (key === '?' && onToggleShortcutHelp) {
      e.preventDefault();
      onToggleShortcutHelp();
      return;
    }

    // j / k — Navigate
    if (key === 'j' && onNavigateDown) {
      e.preventDefault();
      onNavigateDown();
      return;
    }
    if (key === 'k' && onNavigateUp) {
      e.preventDefault();
      onNavigateUp();
      return;
    }

    // Type "gg" to go to top
    if (key === 'g') {
      bufferRef.current += 'g';
      if (bufferRef.current === 'gg' && onNavigateUp) {
        e.preventDefault();
        onNavigateUp();
        bufferRef.current = '';
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => { bufferRef.current = ''; }, 400);
    }
  }, [
    enabled,
    onPreview, onOpen, onRename, onCopyUrl, onCopyAtelnyoLink, onDelete, onShare,
    onEscape, onSelectAll, onSearchFocus, onNavigateUp, onNavigateDown, onToggleShortcutHelp,
  ]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [handleKeyDown]);

  return null;
}
