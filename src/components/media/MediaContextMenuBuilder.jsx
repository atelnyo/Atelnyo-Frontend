/**
 * MediaContextMenuBuilder — Utility that returns the spec-compliant
 * 12-action context menu for a media entity.
 *
 * Spec (Prompt 23 §9 — Media Context Menu):
 *   - Right click OR long press
 *   - Shows: Open, Preview, Copy Link, Inspect, Replace, Favorite,
 *            Collection, Visibility, History, Archive, Delete Reference
 *   - DIVIDER between Library group and State group
 *
 * The actual rendering happens in ContextMenu.jsx — this module
 * is a pure data factory that takes the media payload + a set of
 * callbacks and returns the items array.
 *
 * Usage:
 *   const menuItems = buildMediaContextMenu({
 *     media, lang,
 *     onOpen, onPreview, onCopyLink, onInspect,
 *     onReplace, onToggleFavorite,
 *     onMoveToCollection, onVisibility,
 *     onHistory, onArchive, onDeleteReference,
 *     collections: [],  // [{ id, name }]
 *   });
 *   <ContextMenu items={menuItems} position={{x, y}} onClose={...} />
 */
import { t as makeT } from './langFallback';

export function buildMediaContextMenu({
  media = {},
  lang = 'ht',
  collections = [],
  visibleOptions = ['public', 'unlisted', 'private'],
  onOpen,
  onPreview,
  onCopyLink,
  onInspect,
  onReplace,
  onToggleFavorite,
  onMoveToCollection,
  onVisibility,
  onHistory,
  onArchive,
  onDeleteReference,
} = {}) {
  const t = makeT(lang);

  // Library group (5)
  const library = [
    { id: 'open',       label: t('Open'),          icon: 'fa-up-right-from-square',  shortcut: 'Enter',   action: onOpen },
    { id: 'preview',    label: t('Preview'),       icon: 'fa-eye',                   shortcut: 'Space',   action: onPreview },
    { id: 'copyLink',   label: t('Copy Link'),     icon: 'fa-link',                  shortcut: 'Ctrl+C',  action: onCopyLink },
    { id: 'inspect',    label: t('Inspect'),       icon: 'fa-magnifying-glass-plus',                   action: onInspect },
  ];

  if (onReplace) {
    library.push({
      id: 'replace',
      label: t('Replace'),
      icon: 'fa-arrow-right-arrow-left',
      action: onReplace,
    });
  }

  // State group (4 + 2 submenus)
  const stateChildren = [
    {
      id: 'favorite',
      label: media.is_favorite ? t('Remove from Favorites') : t('Add to Favorites'),
      icon: media.is_favorite ? 'fa-heart-crack' : 'fa-heart',
      shortcut: 'F',
      action: onToggleFavorite,
    },
    {
      id: 'collection',
      label: t('Move to Collection'),
      icon: 'fa-folder-tree',
      children: collections.length
        ? collections.map((c) => ({
            id: 'collection-' + (c.id || c.name),
            label: c.name || c.title || t('Untitled'),
            icon: 'fa-folder',
            action: onMoveToCollection ? () => onMoveToCollection(c) : undefined,
          }))
        : [{ id: 'collection-empty', label: t('No collections yet'), disabled: true }],
    },
    {
      id: 'visibility',
      label: t('Visibility'),
      icon: 'fa-eye-slash',
      children: visibleOptions.map((v) => ({
        id: 'visibility-' + v,
        label: t(v.charAt(0).toUpperCase() + v.slice(1)),
        icon:
          v === 'public' ? 'fa-globe'
          : v === 'unlisted' ? 'fa-link'
          : 'fa-lock',
        action: onVisibility ? () => onVisibility(v) : undefined,
      })),
    },
  ];

  const state = stateChildren.concat([
    { id: '__divider__', separator: true },
    { id: 'history',       label: t('History'),            icon: 'fa-clock-rotate-left', action: onHistory },
    { id: 'archive',       label: t('Archive'),            icon: 'fa-box-archive',  shortcut: 'Delete', action: onArchive },
    { id: 'deleteRef',     label: t('Delete Reference'),  icon: 'fa-link-slash',    danger: true, action: onDeleteReference },
  ]);

  return [...library, { id: '__divider__', separator: true }, ...state];
}

export default buildMediaContextMenu;
