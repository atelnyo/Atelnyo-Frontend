/**
 * src/hooks/useBlockSaveContract.js
 *
 * §8 — Learning Block Save Contract
 *
 * Interactive learning blocks use this hook to register with the
 * Learning Navigation Engine.  The navigation engine can then:
 *   §7 — Check if the block has pending changes
 *   §9 — Trigger a save before navigation
 *   §5 — Validate if the block allows navigation
 *
 * Expected interface on blocks that register:
 *   hasPendingChanges() → boolean
 *   save() → Promise<{ ok, savedLocal? }>
 *   validateForNavigation() → { ok, reason? }
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useBlockSaveContract — Register a block with the navigation engine.
 *
 * @param {Object} opts
 * @param {string} opts.blockId           — unique block identifier
 * @param {Function} opts.registerBlock   — from useLearningNavigation.registerBlock
 * @param {Function} opts.onSave         — async save function
 * @param {Function} opts.onValidate     — () => { ok, reason? }
 * @param {any} opts.content             — current block content (for dirty check)
 * @param {any} opts.savedContent        — last saved content
 *
 * @returns {Object} block contract API
 */
export default function useBlockSaveContract({
  blockId,
  registerBlock,
  onSave,
  onValidate,
  content,
  savedContent,
}) {
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | failed | local_only
  const contentRef = useRef(content);
  const savedRef = useRef(savedContent);

  // Keep refs current
  contentRef.current = content;
  savedRef.current = savedContent;

  // §7 — hasPendingChanges: compare current content to last saved
  const hasPendingChanges = useCallback(() => {
    if (!contentRef.current || !savedRef.current) return false;
    // Shallow JSON comparison — sufficient for most block types
    return JSON.stringify(contentRef.current) !== JSON.stringify(savedRef.current);
  }, []);

  // §9 — save: persist the current content
  const save = useCallback(async () => {
    if (!onSave) return { ok: true, savedLocal: false };
    setSaveState('saving');
    try {
      const result = await onSave(contentRef.current);
      if (result?.savedLocal) {
        setSaveState('local_only');
      } else {
        setSaveState('saved');
      }
      return result || { ok: true };
    } catch (err) {
      // §10 — save failed: try localStorage fallback
      try {
        const key = `atelnyo_block_${blockId}`;
        window.localStorage.setItem(key, JSON.stringify({
          content: contentRef.current,
          savedAt: Date.now(),
        }));
        setSaveState('local_only');
        return { ok: true, savedLocal: true };
      } catch {
        setSaveState('failed');
        return { ok: false };
      }
    }
  }, [blockId, onSave]);

  // §5 — validateForNavigation
  const validateForNavigation = useCallback(() => {
    if (onValidate) return onValidate();
    return { ok: true };
  }, [onValidate]);

  // §8 — Register with navigation engine on mount, unregister on unmount
  useEffect(() => {
    if (!registerBlock || !blockId) return;
    const unregister = registerBlock(blockId, {
      hasPendingChanges,
      save,
      validateForNavigation,
    });
    return unregister;
  }, [blockId, registerBlock, hasPendingChanges, save, validateForNavigation]);

  return {
    saveState,
    hasPendingChanges,
    save,
    validateForNavigation,
  };
}
