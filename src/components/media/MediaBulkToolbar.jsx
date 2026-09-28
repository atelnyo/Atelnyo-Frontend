/**
 * MediaBulkToolbar — Enterprise bulk-actions toolbar (Prompt 23).
 *
 * Renders ONLY when at least one media item is selected.
 *
 * Two interaction modes:
 *   • Default:    groups of library / state / flags buttons (Archive,
 *                  Move Collection, Delete References, Change Visibility,
 *                  Validate, Export Metadata, Mark Favorite, Remove
 *                  Favorite).
 *   • Sub-form:   when the creator clicks Move Collection or Change
 *                  Visibility, the toolbar expands an INLINE form
 *                  on the same row. The form has:
 *                    − Escape-to-close (no disruptive modal)
 *                    − focus return to the originating trigger button
 *                    − Cancel button + confirm button
 *
 * "No fake content" rule: every action is real. If a parent doesn't pass
 * a callback for a given action, the corresponding button renders as
 * disabled (visual cue) rather than missing.
 */
import React, { useState, useRef, useEffect } from 'react';

const ACTION_GROUPS = [
  {
    id: 'library',
    en: 'Library',
    ht: 'Bibliyotèk',
    actions: [
      { key: 'archive',          icon: 'fa-archive',         labelEn: 'Archive',           labelHt: 'Achive',          danger: false },
      { key: 'move',             icon: 'fa-folder-open',     labelEn: 'Move Collection',   labelHt: 'Deplase',         danger: false, opensSubform: 'move' },
      { key: 'deleteReferences', icon: 'fa-unlink',          labelEn: 'Delete References', labelHt: 'Efase Referans',  danger: true },
    ],
  },
  {
    id: 'state',
    en: 'State',
    ht: 'Estati',
    actions: [
      { key: 'visibility', icon: 'fa-eye',          labelEn: 'Change Visibility', labelHt: 'Chanje Vizibilite', danger: false, opensSubform: 'visibility' },
      { key: 'validate',   icon: 'fa-stethoscope',  labelEn: 'Validate',          labelHt: 'Valide',           danger: false },
      { key: 'export',     icon: 'fa-file-export',  labelEn: 'Export Metadata',   labelHt: 'Ekspòte Done',     danger: false },
    ],
  },
  {
    id: 'flags',
    en: 'Flags',
    ht: 'Markè',
    actions: [
      { key: 'markFavorite',   icon: 'fa-star',           labelEn: 'Mark Favorite',   labelHt: 'Mete nan Favori',  danger: false },
      { key: 'removeFavorite', icon: 'fa-star-half-alt',  labelEn: 'Remove Favorite', labelHt: 'Retire nan Favori', danger: false },
    ],
  },
];

const VISIBILITY_PRESETS = [
  { value: 'public',    icon: 'fa-globe',          en: 'Public',     ht: 'Piblik',     color: 'var(--state-success, #10b981)', bg: 'var(--severity-low-bg, rgba(16,185,129,0.08))' },
  { value: 'followers', icon: 'fa-users',          en: 'Followers',  ht: 'Abonnen',    color: 'var(--state-info, #38bdf8)', bg: 'var(--state-info-bg, rgba(56,189,248,0.08))' },
  { value: 'students',  icon: 'fa-graduation-cap', en: 'Students',   ht: 'Elèv',       color: 'var(--pr-color-violet-500, #8b5cf6)', bg: 'var(--pr-color-violet-500-bg, rgba(139,92,246,0.08))' },
  { value: 'customers', icon: 'fa-shopping-bag',   en: 'Customers',  ht: 'Kliyan',     color: 'var(--state-warning, #f59e0b)', bg: 'var(--severity-medium-bg, rgba(245,158,11,0.08))' },
  { value: 'community', icon: 'fa-comments',       en: 'Community',  ht: 'Kominote',   color: 'var(--pr-color-pink-500, #ec4899)', bg: 'rgba(236,72,153,0.08)' },
  { value: 'purchased', icon: 'fa-receipt',        en: 'Purchased',  ht: 'Achte',      color: 'var(--pr-color-teal-500, #14b8a6)', bg: 'rgba(20,184,166,0.08)' },
  { value: 'private',   icon: 'fa-lock',           en: 'Private',    ht: 'Prive',      color: 'var(--text-secondary, #64748b)', bg: 'var(--state-neutral-bg, rgba(100,116,139,0.08))' },
  { value: 'unlisted',  icon: 'fa-eye-slash',      en: 'Unlisted',   ht: 'Rezève',     color: 'var(--text-secondary, #94a3b8)', bg: 'var(--state-neutral-bg, rgba(148,163,184,0.08))' },
];

export default function MediaBulkToolbar({
  selectedCount = 0,
  onArchive,
  onMove,
  onDeleteReferences,
  onChangeVisibility,
  onValidate,
  onExport,
  onMarkFavorite,
  onRemoveFavorite,
  onClearSelection,
  collections = [],
  visibilities = VISIBILITY_PRESETS.map((v) => v.value),
  lang = 'ht',
  className = '',
}) {
  const isHt = lang === 'ht';
  const [subform, setSubform] = useState(null); // 'move' | 'visibility' | null
  const [moveName, setMoveName] = useState('');
  const [visibilityChoice, setVisibilityChoice] = useState('public');
  const moveInputRef = useRef(null);
  // Holds the DOM node of the trigger button that opened the current
  // subform. Used to restore focus when the subform closes.
  const triggerRef = useRef(null);

  // ─── Auto-focus + Escape-to-close + focus return ──────────
  useEffect(() => {
    if (subform === 'move' && moveInputRef.current) {
      moveInputRef.current.focus();
    }
    if (!subform) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape' || e.keyCode === 27) {
        e.preventDefault();
        handleClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subform]);

  if (selectedCount === 0) return null;

  const isAvailable = (key) => {
    switch (key) {
      case 'archive':          return Boolean(onArchive);
      case 'move':             return Boolean(onMove);
      case 'deleteReferences': return Boolean(onDeleteReferences);
      case 'visibility':       return Boolean(onChangeVisibility);
      case 'validate':         return Boolean(onValidate);
      case 'export':           return Boolean(onExport);
      case 'markFavorite':     return Boolean(onMarkFavorite);
      case 'removeFavorite':   return Boolean(onRemoveFavorite);
      default:                 return false;
    }
  };

  const dispatch = (key, payload) => {
    switch (key) {
      case 'archive':          onArchive?.(); break;
      case 'move':             onMove?.(payload); break;
      case 'deleteReferences': onDeleteReferences?.(); break;
      case 'visibility':       onChangeVisibility?.(payload); break;
      case 'validate':         onValidate?.(); break;
      case 'export':           onExport?.(); break;
      case 'markFavorite':     onMarkFavorite?.(); break;
      case 'removeFavorite':   onRemoveFavorite?.(); break;
      default: break;
    }
  };

  // Close the subform and return focus to the originating trigger.
  // Called by Cancel, Confirm (after dispatch), and Escape handler.
  const handleClose = () => {
    setSubform(null);
    setMoveName('');
    // Restore focus on next tick so the form has unmounted already.
    setTimeout(() => {
      const node = triggerRef.current;
      if (node && typeof node.focus === 'function') node.focus();
      triggerRef.current = null;
    }, 0);
  };

  const handleActionClick = (a) => (e) => {
    e.stopPropagation?.();
    if (!isAvailable(a.key)) return;
    if (a.opensSubform) {
      // Capture the trigger DOM so we can restore focus on close.
      triggerRef.current = e.currentTarget;
      setSubform(a.opensSubform);
      return;
    }
    dispatch(a.key);
  };

  const submitMove = (e) => {
    e?.preventDefault?.();
    const name = moveName.trim();
    if (!name) return;
    dispatch('move', name);
    handleClose();
  };

  const submitVisibility = (e) => {
    e?.preventDefault?.();
    if (!visibilities.includes(visibilityChoice)) return;
    dispatch('visibility', visibilityChoice);
    handleClose();
  };

  return (
    <div
      className={`media-bulk-toolbar ${className}`}
      role="toolbar"
      aria-label={isHt ? 'Aksyon an mas' : 'Bulk actions'}
    >
      <div className="media-bulk-toolbar-summary">
        <span className="media-bulk-toolbar-count">
          <i className="fas fa-check-square" aria-hidden="true" />
          <strong>{selectedCount}</strong>{' '}
          {isHt ? 'chwazi' : 'selected'}
        </span>
        {onClearSelection && (
          <button
            type="button"
            className="media-bulk-toolbar-clear"
            onClick={(e) => { e.stopPropagation(); onClearSelection(); }}
            aria-label={isHt ? 'Netwaye seleksyon' : 'Clear selection'}
          >
            <i className="fas fa-times" aria-hidden="true" />
            {isHt ? 'Netwaye' : 'Clear'}
          </button>
        )}
      </div>

      <div className="media-bulk-toolbar-groups">
        {ACTION_GROUPS.map((group) => (
          <div key={group.id} className="media-bulk-toolbar-group">
            <span className="media-bulk-toolbar-group-label" aria-hidden="true">
              {isHt ? group.ht : group.en}
            </span>
            <div className="media-bulk-toolbar-actions">
              {group.actions.map((a) => {
                const available = isAvailable(a.key);
                const isActive = subform === a.opensSubform;
                return (
                  <button
                    key={a.key}
                    type="button"
                    className={`media-bulk-toolbar-action ${a.danger ? 'media-bulk-toolbar-action-danger' : ''} ${available ? '' : 'media-bulk-toolbar-action-unavailable'} ${isActive ? 'media-bulk-toolbar-action-active' : ''}`}
                    onClick={handleActionClick(a)}
                    disabled={!available}
                    title={isHt ? a.labelHt : a.labelEn}
                    aria-label={isHt ? a.labelHt : a.labelEn}
                    aria-expanded={a.opensSubform ? isActive : undefined}
                    aria-controls={a.opensSubform ? `media-bulk-subform-${a.opensSubform}` : undefined}
                  >
                    <i className={`fas ${a.icon}`} aria-hidden="true" />
                    <span>{isHt ? a.labelHt : a.labelEn}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {subform === 'move' && (
        <form
          id="media-bulk-subform-move"
          className="media-bulk-toolbar-form"
          onSubmit={submitMove}
          role="dialog"
          aria-label={isHt ? 'Deplase nan yon koleksyon' : 'Move to a collection'}
          // Skip ARIA dialog role's focus-trap expectations because this
          // is an INLINE form (not modal); Escape + return-to-trigger
          // provides the same escape affordance without trapping Tab.
        >
          {collections.length > 0 && (
            <select
              className="media-bulk-toolbar-form-select"
              value=""
              onChange={(e) => { if (e.target.value) setMoveName(e.target.value); }}
              aria-label={isHt ? 'Chwazi yon koleksyon egzistan' : 'Pick an existing collection'}
            >
              <option value="">{isHt ? 'Chwazi koleksyon...' : 'Pick a collection…'}</option>
              {collections.map((c) => (
                <option key={c.id || c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          )}
          <input
            ref={moveInputRef}
            type="text"
            className="media-bulk-toolbar-form-input"
            placeholder={isHt ? 'Oswa tape nouvo non koleksyon...' : 'Or type a new collection name…'}
            value={moveName}
            onChange={(e) => setMoveName(e.target.value)}
            maxLength={64}
            disabled={!moveName.trim() && false /* always enabled but guarded on submit */}
            aria-label={isHt ? 'Non koleksyon' : 'Collection name'}
            aria-invalid={false}
          />
          <button
            type="submit"
            className="media-bulk-toolbar-form-confirm"
            disabled={!moveName.trim()}
            aria-label={isHt ? 'Konfime deplasman' : 'Confirm move'}
          >
            <i className="fas fa-check" aria-hidden="true" />
            {isHt ? 'Konfime' : 'Confirm'}
          </button>
          <button
            type="button"
            className="media-bulk-toolbar-form-cancel"
            onClick={handleClose}
            aria-label={isHt ? 'Anile' : 'Cancel'}
          >
            <i className="fas fa-times" aria-hidden="true" />
            {isHt ? 'Anile' : 'Cancel'}
          </button>
        </form>
      )}

      {subform === 'visibility' && (
        <form
          id="media-bulk-subform-visibility"
          className="media-bulk-toolbar-form"
          onSubmit={submitVisibility}
          role="dialog"
          aria-label={isHt ? 'Chanje vizibilite' : 'Change visibility'}
        >
          <div className="media-bulk-toolbar-form-chips" role="radiogroup" aria-label={isHt ? 'Vizibilite' : 'Visibility'}>
            {VISIBILITY_PRESETS.filter((v) => visibilities.includes(v.value)).map((v) => (
              <button
                key={v.value}
                type="button"
                role="radio"
                aria-checked={visibilityChoice === v.value}
                tabIndex={visibilityChoice === v.value ? 0 : -1}
                className={`media-bulk-toolbar-chip ${visibilityChoice === v.value ? 'media-bulk-toolbar-chip-active' : ''}`}
                style={visibilityChoice === v.value ? { color: v.color, borderColor: v.color, background: v.bg } : undefined}
                onClick={() => setVisibilityChoice(v.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const idx = VISIBILITY_PRESETS.findIndex((p) => p.value === visibilityChoice);
                    const next = VISIBILITY_PRESETS[(idx + 1) % VISIBILITY_PRESETS.length];
                    setVisibilityChoice(next.value);
                  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const idx = VISIBILITY_PRESETS.findIndex((p) => p.value === visibilityChoice);
                    const next = VISIBILITY_PRESETS[(idx - 1 + VISIBILITY_PRESETS.length) % VISIBILITY_PRESETS.length];
                    setVisibilityChoice(next.value);
                  }
                }}
              >
                <i className={`fas ${v.icon}`} aria-hidden="true" />
                {isHt ? v.ht : v.en}
              </button>
            ))}
          </div>
          <button
            type="submit"
            className="media-bulk-toolbar-form-confirm"
            disabled={!visibilities.includes(visibilityChoice)}
            aria-label={isHt ? 'Konfime chanjman' : 'Confirm change'}
          >
            <i className="fas fa-check" aria-hidden="true" />
            {isHt ? 'Konfime' : 'Confirm'}
          </button>
          <button
            type="button"
            className="media-bulk-toolbar-form-cancel"
            onClick={handleClose}
            aria-label={isHt ? 'Anile' : 'Cancel'}
          >
            <i className="fas fa-times" aria-hidden="true" />
            {isHt ? 'Anile' : 'Cancel'}
          </button>
        </form>
      )}
    </div>
  );
}
