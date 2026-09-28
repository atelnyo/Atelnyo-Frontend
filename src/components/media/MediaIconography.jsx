/**
 * MediaIconography — Canonical icon vocabulary per Phase-2 spec.
 *
 * Spec mandates exactly 8 icons in the same family:
 *   image    → fa-image           (Landscape)
 *   video    → fa-play-circle     (Play)
 *   audio    → fa-wave-square     (Wave)
 *   document → fa-file-alt        (Document)
 *   certificate → fa-certificate  (Badge)
 *   model    → fa-cube             (3D Cube)
 *   archive  → fa-box             (Box)
 *   broken   → fa-exclamation-triangle (Warning)
 *
 * One canonical mapping per kind. If a new icon needs to land it goes
 * here, not inlined at any call site.
 */
import React from 'react';

export const MEDIA_TYPE_ICON = {
  image:       'fa-image',
  video:       'fa-play-circle',
  audio:       'fa-wave-square',
  document:    'fa-file-alt',
  certificate: 'fa-certificate',
  model:       'fa-cube',
  archive:     'fa-box',
  broken:      'fa-exclamation-triangle',
};

export function getMediaIcon(kind) {
  return MEDIA_TYPE_ICON[kind] || 'fa-file';
}

/**
 * MediaTypeIcon — Renders the spec icon for a known media kind.
 *   <MediaTypeIcon kind="certificate" />  // fa-certificate
 *   <MediaTypeIcon kind="audio" />        // fa-wave-square
 */
export default function MediaTypeIcon({ kind = 'file', size, color, className = '', title }) {
  const icon = getMediaIcon(kind);
  return (
    <i
      className={`fas ${icon} ${className}`}
      aria-hidden="true"
      title={title || kind}
      style={{
        fontSize: size ? `${size}px` : undefined,
        color: color || undefined,
      }}
    />
  );
}
export { MediaTypeIcon };  // named re-export for callers that use { MediaTypeIcon }

/** Convenience: status icon (broken and archived map cleanly to spec). */
export function MediaStatusIcon({ status, ...rest }) {
  const map = { broken: 'broken', archived: 'archive', deleted: 'broken', warning: 'broken' };
  return <MediaTypeIcon kind={map[status] || 'image'} {...rest} />;
}
