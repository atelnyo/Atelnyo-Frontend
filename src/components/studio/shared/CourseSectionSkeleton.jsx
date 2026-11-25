/**
 * src/components/studio/shared/CourseSectionSkeleton.jsx
 *
 * Course-list loading placeholder that mirrors a real course row —
 * thumbnail, title/meta, action buttons — instead of generic bars, so the
 * list does not jump when the courses land.
 *
 * Kept as its own component because CoursesSection imports it by name;
 * the geometry now lives in ``StudioSkeleton``'s ``rows`` variant so
 * every Studio list shares one implementation.
 *
 * @param {number} rows — number of placeholder rows (default: 3)
 */
import React from 'react';
import StudioSkeleton from './StudioSkeleton';

export default function CourseSectionSkeleton({ rows = 3 }) {
  return <StudioSkeleton variant="rows" rows={rows} label="Loading courses…" />;
}
