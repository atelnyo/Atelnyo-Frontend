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
 *   - Pure snapshots (no mutation)
 *   - Debounced push to avoid flooding history on rapid edits
 *   - Works with any serializable value (objects, arrays, primitives)
 *   - undo()/redo() RETURN the restored snapshot so a controlled parent
 *     (e.g. a block editor persisting to onChange) can store it too.
 */
import { useState, useCallback, useRef } from 'react';

export default function useUndoRedo(initialState, { maxDepth = 50, pushDelay = 300 } = {}) {
  const [state, _setState] = useState(initialState);

  // Latest snapshot, readable synchronously from callbacks. React state
  // updates are async, but undo/redo must know the exact current value.
  const stateRef = useRef(initialState);

  // History stacks
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const pushTimerRef = useRef(null);
  const pendingPrevRef = useRef(null);
  const lastPushRef = useRef(0);

  /**
   * Set state and push to history.
   * If called rapidly (within pushDelay ms), it batches into one undo entry.
   */
  const setState = useCallback((updater, { pushToHistory = true } = {}) => {
    const prev = stateRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;

    if (pushToHistory) {
      const now = Date.now();
      if (pushDelay <= 0 || now - lastPushRef.current > pushDelay) {
        pastRef.current = [...pastRef.current.slice(-(maxDepth - 1)), prev];
        futureRef.current = [];
        lastPushRef.current = now;
      } else if (!pushTimerRef.current) {
        // Remember the state BEFORE the burst so one undo returns to the
        // pre-burst snapshot (not to the latest edit in the burst).
        pendingPrevRef.current = prev;
        pushTimerRef.current = setTimeout(() => {
          pastRef.current = [...pastRef.current.slice(-(maxDepth - 1)), pendingPrevRef.current];
          futureRef.current = [];
          lastPushRef.current = Date.now();
          pendingPrevRef.current = null;
          pushTimerRef.current = null;
        }, pushDelay);
      }
    }

    stateRef.current = next;
    _setState(next);
    return next;
  }, [maxDepth, pushDelay]);

  /** Undo: pop from past, push current to future. Returns the restored state. */
  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return undefined;
    const prev = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, stateRef.current];
    stateRef.current = prev;
    _setState(prev);
    return prev;
  }, []);

  /** Redo: pop from future, push current to past. Returns the restored state. */
  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return undefined;
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [...pastRef.current, stateRef.current];
    stateRef.current = next;
    _setState(next);
    return next;
  }, []);

  /** Force-push current state to history (e.g. on explicit save point) */
  const pushHistory = useCallback(() => {
    pastRef.current = [...pastRef.current.slice(-(maxDepth - 1)), stateRef.current];
    futureRef.current = [];
    lastPushRef.current = Date.now();
  }, [maxDepth]);

  /** Clear all history */
  const clear = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    pendingPrevRef.current = null;
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

// Named export for consumers that use `import { useUndoRedo }`.
export { useUndoRedo };
