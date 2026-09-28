/**
 * MediaCommandBar — Top-of-page toolbar for a media entity.
 *
 * Spec (Prompt 23 §3 — Media Command Bar):
 *   - 13 commands grouped into 4 sections:
 *       Library   — Preview, Inspect, Open Original
 *       Actions   — Replace URL, Validate, Refresh, Archive, History
 *       Sharing   — Copy Public URL, Copy Atelnyo Link, Share
 *       State     — Favorite, Delete Reference
 *   - Each command: icon + label + keyboard shortcut hint + aria-label
 *   - CmdBarState piped in via props (busy / disabled flags)
 *
 * Used by:
 *   - MediaEntityPage (full-page route)
 *   - MediaInspector (when surfaced as a page-bar instead of drawer)
 *
 * Keyboard shortcuts are implemented via the centralized
 * `useMediaKeyboard` hook — the bar here only renders the visual
 * shortcut hint chip. Hooking F2/Ctrl+C/etc. lives in the parent.
 */
import React from 'react';

export const MEDIA_COMMANDS = Object.freeze({
  // ─── Library ─────────────────────────────────────────────────────
  preview:       { icon: 'fa-eye',                   shortcut: 'Space',    group: 'library', labelEn: 'Preview',        labelHt: 'Aperçu' },
  inspect:       { icon: 'fa-magnifying-glass-plus', shortcut: 'Enter',    group: 'library', labelEn: 'Inspect',        labelHt: 'Enspekte' },
  openOriginal:  { icon: 'fa-up-right-from-square',  shortcut: '⇧↵',       group: 'library', labelEn: 'Open Original',  labelHt: 'Louvri orijinal' },
  // ─── Actions ─────────────────────────────────────────────────────
  replaceUrl:    { icon: 'fa-arrow-right-arrow-left',                  group: 'actions', labelEn: 'Replace URL',    labelHt: 'Ranplase URL' },
  validate:      { icon: 'fa-shield-halved',                           group: 'actions', labelEn: 'Validate',       labelHt: 'Valide' },
  refresh:       { icon: 'fa-arrows-rotate',                           group: 'actions', labelEn: 'Refresh',        labelHt: 'Rechaje' },
  archive:       { icon: 'fa-box-archive',           shortcut: 'Delete',  group: 'actions', labelEn: 'Archive',        labelHt: 'Achiv' },
  history:       { icon: 'fa-clock-rotate-left',                       group: 'actions', labelEn: 'History',        labelHt: 'Istwa' },
  // ─── Sharing ─────────────────────────────────────────────────────
  copyPublicUrl: { icon: 'fa-link',                  shortcut: 'Ctrl+C',   group: 'sharing', labelEn: 'Copy Public URL', labelHt: 'Kopye URL piblik' },
  copyAtelnyo:   { icon: 'fa-share-nodes',           shortcut: 'Ctrl+⇧C',  group: 'sharing', labelEn: 'Copy Atelnyo Link', labelHt: 'Kopye lyen Atelnyo' },
  share:         { icon: 'fa-share',                                                       group: 'sharing', labelEn: 'Share',          labelHt: 'Pataje' },
  // ─── State ───────────────────────────────────────────────────────
  favorite:      { icon: 'fa-heart',                 shortcut: 'F',        group: 'state',   labelEn: 'Favorite',       labelHt: 'Favori' },
  deleteRef:     { icon: 'fa-link-slash',            shortcut: '⇧Del',     group: 'state',   labelEn: 'Delete Reference', labelHt: 'Efase referans', danger: true },
});

const COMMAND_GROUPS = [
  { id: 'library', labelEn: 'Library', labelHt: 'Bibliyotèk' },
  { id: 'actions', labelEn: 'Actions', labelHt: 'Aksyon' },
  { id: 'sharing', labelEn: 'Sharing', labelHt: 'Pataje' },
  { id: 'state',   labelEn: 'State',   labelHt: 'Estati' },
];

export default function MediaCommandBar({
  media,
  lang = 'ht',
  onCommand,
  stateByCommand = {},
  compact = false,
}) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);

  const handleClick = (cmdId) => {
    if (!onCommand) return;
    const state = stateByCommand[cmdId] || {};
    if (state.disabled || state.busy) return;
    onCommand(cmdId, media);
  };

  return (
    <div
      className={`media-command-bar ${compact ? 'media-command-bar-compact' : ''}`}
      role="toolbar"
      aria-label={t('Media commands', 'Kòmand medya')}
    >
      {COMMAND_GROUPS.map((group, gi) => (
        <div key={group.id} className="media-command-bar-group" role="group" aria-label={isHt ? group.labelHt : group.labelEn}>
          {!compact && (
            <span className="media-command-bar-group-label">
              {isHt ? group.labelHt : group.labelEn}
            </span>
          )}
          <div className="media-command-bar-group-buttons">
            {Object.entries(MEDIA_COMMANDS)
              .filter(([, def]) => def.group === group.id)
              .map(([cmdId, def]) => {
                const state = stateByCommand[cmdId] || {};
                const label = isHt ? def.labelHt : def.labelEn;
                return (
                  <button
                    key={cmdId}
                    type="button"
                    className={`media-command-bar-btn ${def.danger ? 'media-command-bar-btn-danger' : ''}`}
                    onClick={() => handleClick(cmdId)}
                    disabled={state.disabled}
                    aria-busy={state.busy ? 'true' : 'false'}
                    aria-label={label + (def.shortcut ? ` (${def.shortcut})` : '')}
                    title={label + (def.shortcut ? ` [${def.shortcut}]` : '')}
                    data-command={cmdId}
                  >
                    <span className="media-command-bar-btn-icon" aria-hidden="true">
                      <i className={`fas ${def.icon}`} />
                    </span>
                    {!compact && (
                      <span className="media-command-bar-btn-label">{label}</span>
                    )}
                    {def.shortcut && !compact && (
                      <span className="media-command-bar-btn-shortcut" aria-hidden="true">
                        {def.shortcut}
                      </span>
                    )}
                    {state.busy && (
                      <span className="media-command-bar-btn-spinner" aria-hidden="true">
                        <i className="fas fa-spinner fa-spin" />
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
          {gi < COMMAND_GROUPS.length - 1 && (
            <span className="media-command-bar-divider" aria-hidden="true" />
          )}
        </div>
      ))}
    </div>
  );
}
