/**
 * e2e/session-harness.jsx
 *
 * Dev-only harness that mounts the REAL ModuleSession with a module
 * covering every learner-facing block type (vocabulary, listening,
 * reading, repeat, speaking) so a Playwright spec can drive the full
 * learner journey in a real browser — complete each step, navigate
 * with the keyboard (Enter/→/←/Space), and land on the module-complete
 * celebration.
 *
 * The spec injects fake browser speech APIs (same as speech-flow.spec)
 * and stubs /api/quizzes/ to return no quizzes (so the module has
 * exactly `blocks.length` steps). All progress is real component logic.
 *
 * Served by Vite at /e2e/session-harness.html.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import ModuleSession from '../src/components/learning/ModuleSession.jsx';

const MODULE = {
  title: 'Modil Test',
  blocks: [
    { id: 'v1', type: 'vocabulary', targetText: 'mèsi', title: 'Vokabilè' },
    { id: 'l1', type: 'listening', question: 'Kisa ou tande?', answer: 'estasyon', title: 'Koute' },
    { id: 't1', type: 'text', content: 'Yon paragraf lekti pou elèv la.', title: 'Lekti' },
    { id: 'r1', type: 'repeat', targetText: 'bonjou kouman ou ye', title: 'Repete' },
    { id: 's1', type: 'speaking', targetText: 'Pale lib', title: 'Pale' },
  ],
};

const root = createRoot(document.getElementById('root'));
root.render(
  <ModuleSession
    courseId={7}
    moduleIndex={0}
    item={MODULE}
    lang="ht"
    translations={{ ht: {} }}
    progress={null}
    completedBlocksMap={{}}
    completedModules={[]}
    onComplete={(mi, bid, bt) => { window.__lastComplete = [mi, bid, bt]; }}
    onViewed={() => {}}
    onExit={() => {}}
    onNextModule={() => {}}
    cachedQuizzes={[]}
    onQuizzesLoaded={() => {}}
  />,
);
