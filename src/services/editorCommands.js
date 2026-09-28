/**
 * src/services/editorCommands.js
 *
 * §142 — EDITOR COMMAND SYSTEM
 * Centralized command architecture for editor actions.
 * Provides foundation for: undo/redo, autosave, audit, collaboration.
 *
 * §143 — EDITOR EVENT SYSTEM
 * Event bus for editor events. Enables loose coupling between features.
 */

// ═══════════════════════════════════════════════════════════════════════
// §143 — EVENT SYSTEM
// ═══════════════════════════════════════════════════════════════════════

const listeners = new Map();

/**
 * Subscribe to an editor event.
 * @param {string} event - Event name
 * @param {Function} callback - Handler
 * @returns {Function} Unsubscribe function
 */
export function onEditorEvent(event, callback) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(callback);
  return () => listeners.get(event)?.delete(callback);
}

/**
 * Emit an editor event.
 * @param {string} event - Event name
 * @param {*} data - Event payload
 */
export function emitEditorEvent(event, data) {
  const handlers = listeners.get(event);
  if (handlers) {
    handlers.forEach(fn => {
      try { fn(data); } catch (e) { console.error(`Event handler error [${event}]:`, e); }
    });
  }
}

// ─── Known events (§143) ─────────────────────────────────────────────
export const EDITOR_EVENTS = {
  BLOCK_CREATED: 'block:created',
  BLOCK_UPDATED: 'block:updated',
  BLOCK_DELETED: 'block:deleted',
  BLOCK_MOVED: 'block:moved',
  BLOCK_DUPLICATED: 'block:duplicated',
  LESSON_UPDATED: 'lesson:updated',
  MODULE_ADDED: 'module:added',
  MODULE_DELETED: 'module:deleted',
  MODULE_REORDERED: 'module:reordered',
  MEDIA_UPLOADED: 'media:uploaded',
  MEDIA_FAILED: 'media:failed',
  COURSE_SAVED: 'course:saved',
  COURSE_PUBLISHED: 'course:published',
  COURSE_DIRTY: 'course:dirty',
  AUTOSAVE_START: 'autosave:start',
  AUTOSAVE_SUCCESS: 'autosave:success',
  AUTOSAVE_FAILURE: 'autosave:failure',
  UNDO: 'editor:undo',
  REDO: 'editor:redo',
};

// ═══════════════════════════════════════════════════════════════════════
// §142 — COMMAND SYSTEM
// ═══════════════════════════════════════════════════════════════════════

// Command history for undo/redo (§138)
const commandHistory = [];
let historyIndex = -1;
const MAX_HISTORY = 50;

/**
 * Execute an editor command and record it for undo/redo.
 * @param {string} type - Command type
 * @param {Object} payload - Command data
 * @param {Function} executor - Function that performs the action
 */
export function executeCommand(type, payload, executor) {
  const command = { type, payload, timestamp: Date.now() };

  // Execute the action
  executor(command);

  // Trim forward history if we're not at the end
  if (historyIndex < commandHistory.length - 1) {
    commandHistory.splice(historyIndex + 1);
  }

  // Add to history
  commandHistory.push(command);
  if (commandHistory.length > MAX_HISTORY) {
    commandHistory.shift();
  }
  historyIndex = commandHistory.length - 1;

  // Emit event
  emitEditorEvent(type, payload);
}

/**
 * Undo the last command (§138).
 * @param {Function} undoExecutor - Function that reverses the action
 */
export function undoCommand(undoExecutor) {
  if (historyIndex < 0) return false;
  const command = commandHistory[historyIndex];
  undoExecutor(command);
  historyIndex--;
  emitEditorEvent(EDITOR_EVENTS.UNDO, command);
  return true;
}

/**
 * Redo the last undone command (§138).
 * @param {Function} redoExecutor - Function that re-applies the action
 */
export function redoCommand(redoExecutor) {
  if (historyIndex >= commandHistory.length - 1) return false;
  historyIndex++;
  const command = commandHistory[historyIndex];
  redoExecutor(command);
  emitEditorEvent(EDITOR_EVENTS.REDO, command);
  return true;
}

/** Check if undo is available. */
export function canUndo() {
  return historyIndex >= 0;
}

/** Check if redo is available. */
export function canRedo() {
  return historyIndex < commandHistory.length - 1;
}

/** Clear command history. */
export function clearHistory() {
  commandHistory.length = 0;
  historyIndex = -1;
}

// ─── Command types ───────────────────────────────────────────────────
export const COMMAND_TYPES = {
  ADD_BLOCK: 'block:created',
  DELETE_BLOCK: 'block:deleted',
  MOVE_BLOCK: 'block:moved',
  DUPLICATE_BLOCK: 'block:duplicated',
  UPDATE_BLOCK: 'block:updated',
  ADD_MODULE: 'module:added',
  DELETE_MODULE: 'module:deleted',
  REORDER_MODULE: 'module:reordered',
  UPDATE_LESSON: 'lesson:updated',
  PUBLISH_COURSE: 'course:published',
};
