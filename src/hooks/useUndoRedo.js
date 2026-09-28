/**
 * src/hooks/useUndoRedo.js
 *
 * Generic undo/redo state manager for any serializable state.
 * Maintains a history stack with configurable max depth.
 *
 * Usage:
 *   const { state, setState, undo, redo, canUndo, canRedo, clear } = useUndoRedo(initialState, { maxDepth: 50 });
 *
 * Design:
 *   - Pure function snapshots (no mutation)
 *   - Debounced push to avoid flooding history on rapid edits
 *   - Works with any serializable value (objects, arrays, primitives)
 */
import { useState, useCallback, useRef } from 'react';

export default function useUndoRedo(initialState, { maxDepth = 50, pushDelay = 300 } = {}) {
  const [state, _setState] = useState(initialState);

  // History stacks
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const pushTimerRef = useRef(null);
  const lastPushRef = useRef(Date.now());

  /**
   * Set state and push to history.
   * If called rapidly (within pushDelay ms), it batches into one undo entry.
   */
  const setState = useCallback((updater, { pushToHistory = true } = {}) => {
    _setState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;

      if (pushToHistory) {
        // Debounce: if called rapidly, only push the first change
        const now = Date.now();
        if (now - lastPushRef.current > pushDelay) {
          pastRef.current = [...pastRef.current.slice(-(maxDepth - 1)), prev];
          futureRef.current = [];
          lastPushRef.current = now;
        } else if (!pushTimerRef.current) {
          // Schedule a deferred push of the current state
          pushTimerRef.current = setTimeout(() => {
            pastRef.current = [...pastRef.current.slice(-(maxDepth - 1)), prev];
            futureRef.current = [];
            lastPushRef.current = Date.now();
            pushTimerRef.current = null;
          }, pushDelay);
        }
      }

      return next;
    });
  }, [maxDepth, pushDelay]);

  /** Undo: pop from past, push current to future */
  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    const prev = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);

    _setState((current) => {
      futureRef.current = [...futureRef.current, current];
      return prev;
    });
  }, []);

  /** Redo: pop from future, push current to past */
  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);

    _setState((current) => {
      pastRef.current = [...pastRef.current, current];
      return next;
    });
  }, []);

  /** Force-push current state to history (e.g. on explicit save point) */
  const pushHistory = useCallback(() => {
    _setState((current) => {
      pastRef.current = [...pastRef.current.slice(-(maxDepth - 1)), current];
      futureRef.current = [];
      lastPushRef.current = Date.now();
      return current;
    });
  }, [maxDepth]);

  /** Clear all history */
  const clear = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    if (pushTimerRef.current) {
      clearTimeout(pushTimerRef.current);
      pushTimerRef.current = null;
    }
  }, []);

  return {
    state,
    setState,
    undo,
    redo,
    pushHistory,
    clear,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    historyDepth: pastRef.current.length,
  };
}
