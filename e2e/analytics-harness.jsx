/**
 * e2e/analytics-harness.jsx
 *
 * Dev-only harness that mounts the REAL CourseAnalyticsModal so a
 * Playwright spec (e2e/analytics-speech.spec.ts) can verify the
 * creator-side "Speaking practice" review — the word-level analysis
 * chips (✓ well said / ◐ almost / ✗ missing / + extra) — renders
 * correctly in a real browser.
 *
 * The spec stubs the three backend endpoints via page.route (no Django
 * server needed): analytics, students, and speech-submissions. The
 * stubbed speech payload carries REAL analysis dicts exactly as the
 * backend serializer returns them (SpeechSubmission.analysis JSONField).
 *
 * Served by Vite at /e2e/analytics-harness.html.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import CourseAnalyticsModal from '../src/components/studio/sections/CourseAnalyticsModal.jsx';

const root = createRoot(document.getElementById('root'));
root.render(
  <CourseAnalyticsModal
    course={{ id: 7, title: 'Kreyòl 101' }}
    lang="ht"
    onClose={() => {}}
  />,
);
