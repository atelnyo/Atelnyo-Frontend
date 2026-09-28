/**
 * e2e/speech-harness.jsx
 *
 * Dev-only harness that mounts the REAL LanguagePracticeBlock so a
 * Playwright spec (e2e/speech-flow.spec.ts) can drive the full
 * recorder → recognition → word-level-feedback flow in a real browser.
 *
 * The spec injects fake browser speech APIs (window.SpeechRecognition,
 * MediaRecorder, getUserMedia) via page.addInitScript — there is no
 * microphone on CI/dev boxes. The fakes read window.__speechTranscript
 * so each take in the spec can produce a deterministic transcript.
 *
 * Served by Vite at /e2e/speech-harness.html (Vite transforms any HTML
 * file under the project root). courseId is null so nothing is
 * submitted to the backend during a harness run.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import LanguagePracticeBlock from '../src/components/learning/LanguagePracticeBlock.jsx';

const BLOCKS = [
  {
    id: 'h-pass',
    type: 'repeat',
    targetText: 'bonjou kouman ou ye',
    title: 'Pass case — transcript "bonjou kouman ou mache" → 3/4 → Byen pale!',
  },
  {
    id: 'h-fail',
    type: 'repeat',
    targetText: 'mwen renmen kafe frèt',
    title: 'Fail case — transcript "mwen vle dlo" → 1/4 → retry hint, then retry to pass',
  },
];

const root = createRoot(document.getElementById('root'));
root.render(
  <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 640, margin: '0 auto' }}>
    {BLOCKS.map((block) => (
      <div key={block.id} style={{ marginBottom: 40 }}>
        <LanguagePracticeBlock block={block} lang="ht" courseId={null} moduleIndex={0} />
      </div>
    ))}
  </div>,
);
