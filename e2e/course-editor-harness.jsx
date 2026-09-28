/**
 * e2e/course-editor-harness.jsx
 *
 * Dev-only harness that mounts the REAL CourseEditor (create mode) so a
 * Playwright spec can verify the two new structure actions in a real
 * browser:
 *   • drag-and-drop module reordering
 *   • copying one module's blocks into another module (structure reuse)
 *
 * The spec stubs /api/courses/** so the editor's debounced autosave has
 * somewhere to go (no backend needed). Served by Vite at
 * /e2e/course-editor-harness.html.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import CourseEditor from '../src/components/studio/editor/CourseEditor.jsx';

createRoot(document.getElementById('root')).render(
  <CourseEditor
    lang="ht"
    onClose={() => {}}
    onSuccess={() => {}}
    showToast={() => {}}
    item={null}
  />,
);
