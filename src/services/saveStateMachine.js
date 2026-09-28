/**
 * saveStateMachine.js — §11, §46 Save State Machine
 *
 * Provides a controlled state machine for tracking the persistence
 * lifecycle of student learning work. Each block/exercise/workspace
 * can have its own state machine instance.
 *
 * §11 — "Interactive student work should have a controlled state machine."
 * §46 — "Different failures need different responses."
 *
 * States:
 *   idle → changed → saving_local → saved_local → syncing → saved_server
 *   Error states: local_save_failed, sync_failed, conflict
 *
 * §12 — Human-friendly translations (not raw internal names):
 *   idle              → (no indicator)
 *   changed           → "Unsaved changes"
 *   saving_local      → "Saving..."
 *   saved_local       → "Saved on this device"
 *   syncing           → "Syncing..."
 *   saved_server      → "Saved"
 *   local_save_failed → "Could not save"
 *   sync_failed       → "Saved locally, waiting to sync"
 *   conflict          → "Conflict detected"
 */

/**
 * Valid state transitions (state → set of allowed next states).
 * Every transition must be explicitly declared — no arbitrary jumps.
 */
const TRANSITIONS = {
  idle:                ['changed', 'saving_local'],
  changed:             ['saving_local', 'idle'],
  saving_local:        ['saved_local', 'local_save_failed'],
  saved_local:         ['syncing', 'changed', 'idle'],
  syncing:             ['saved_server', 'sync_failed', 'conflict'],
  saved_server:        ['changed', 'idle'],
  local_save_failed:   ['saving_local', 'changed', 'idle'],
  sync_failed:         ['syncing', 'changed', 'idle'],
  conflict:            ['syncing', 'saving_local', 'idle'],
};

/**
 * Human-readable labels for each state (§12).
 * Bilingual — selected by lang parameter.
 */
const LABELS = {
  idle:                { en: '', ht: '' },
  changed:             { en: 'Unsaved changes', ht: 'Chanjman pa encore sove' },
  saving_local:        { en: 'Saving...', ht: 'Ap sove...' },
  saved_local:         { en: 'Saved on this device', ht: 'Sove sou aparèy sa a' },
  syncing:             { en: 'Syncing...', ht: 'Ap senkronize...' },
  saved_server:        { en: 'Saved', ht: 'Sove' },
  local_save_failed:   { en: 'Could not save', ht: 'Pa kapab sove' },
  sync_failed:         { en: 'Saved locally, waiting to sync', ht: 'Sove lokalman, ap tann senkronizasyon' },
  conflict:            { en: 'Conflict detected', ht: 'Konfli detekte' },
};

/**
 * Semantic state categories for UI rendering.
 * §13 — "Use subtle persistent indicators where appropriate.
 *         Important failures deserve stronger visibility."
 */
const SEMANTICS = {
  idle:                'neutral',
  changed:             'pending',
  saving_local:        'in-progress',
  saved_local:         'success',
  syncing:             'in-progress',
  saved_server:        'success',
  local_save_failed:   'error',
  sync_failed:         'warning',
  conflict:            'error',
};

/**
 * Create a new save state machine.
 *
 * @param {Object} opts
 * @param {string} opts.id — unique identifier (e.g. block ID)
 * @param {Function} [opts.onChange] — (state, label) => void callback
 * @returns {Object} state machine API
 */
export function createSaveStateMachine({ id, onChange }) {
  let state = 'idle';

  function transition(nextState) {
    const allowed = TRANSITIONS[state];
    if (!allowed || !allowed.includes(nextState)) {
      // Invalid transition — log in dev but don't crash
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[SaveState:${id}] Invalid transition: ${state} → ${nextState}`);
      }
      return false;
    }
    state = nextState;
    onChange?.(state, getLabel());
    return true;
  }

  function getState() { return state; }

  function getLabel(lang = 'en') {
    return LABELS[state]?.[lang] || LABELS[state]?.en || '';
  }

  function getSemantic() {
    return SEMANTICS[state] || 'neutral';
  }

  function canTransitionTo(nextState) {
    return TRANSITIONS[state]?.includes(nextState) || false;
  }

  function markChanged() { return transition('changed'); }
  function markSavingLocal() { return transition('saving_local'); }
  function markSavedLocal() { return transition('saved_local'); }
  function markSyncing() { return transition('syncing'); }
  function markSavedServer() { return transition('saved_server'); }
  function markLocalSaveFailed() { return transition('local_save_failed'); }
  function markSyncFailed() { return transition('sync_failed'); }
  function markConflict() { return transition('conflict'); }
  function reset() { state = 'idle'; onChange?.(state, getLabel()); return true; }

  return {
    getState,
    getLabel,
    getSemantic,
    canTransitionTo,
    markChanged,
    markSavingLocal,
    markSavedLocal,
    markSyncing,
    markSavedServer,
    markLocalSaveFailed,
    markSyncFailed,
    markConflict,
    reset,
  };
}

export { LABELS, SEMANTICS };
export default createSaveStateMachine;
