/**
 * MediaBadge — Tiny wrapper over MediaStatusEngine.
 *
 * Single source of truth for status icons/colors/labels is the
 * engine (15+ statuses from Phase 2 spec). This wrapper exists for
 * backward compat with existing call sites (MediaCard.jsx,
 * MediaInspector.jsx) and ensures they auto-render new statuses
 * (premium, scheduled, processing, deleted, success) without drift.
 *
 * Same props API as before: { status, lang, size, className }.
 */
import React from 'react';
import MediaStatusBadge from './MediaStatusBadge';

/** @deprecated Use MediaStatusBadge directly. Kept as alias for back-compat. */
export { getStatusMeta, STATUS_META, isValidStatus } from './MediaStatusEngine';

export default function MediaBadge({ status, size = 'sm', lang = 'ht', className = '' }) {
  return <MediaStatusBadge status={status} size={size} lang={lang} className={className} />;
}
