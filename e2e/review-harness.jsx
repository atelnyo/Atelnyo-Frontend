/**
 * e2e/review-harness.jsx
 *
 * Dev-only harness that mounts the REAL ModuleSession in REVIEW mode
 * (practice-only): the module's blocks are remixed and completion
 * NEVER writes progress. The spec verifies the review header, that
 * completing a step does NOT fire onComplete, and the "Revizyon fini!"
 * screen.
 *
 * Served by Vite at /e2e/review-harness.html.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import ModuleSession from '../src/components/learning/ModuleSession.jsx';

const REVIEW_MODULE = {
  title: 'Modil Test',
  blocks: [
    { id: 'v1', type: 'vocabulary', targetText: 'mèsi', title: 'Vokabilè' },
  ],
};

createRoot(document.getElementById('root')).render(
  <ModuleSession
    courseId={7}
    moduleIndex={0}
    item={REVIEW_MODULE}
    lang="ht"
    translations={{ ht: {} }}
    progress={null}
    completedBlocksMap={{}}
    completedModules={[]}
    review
    onComplete={(mi, bid, bt) => { window.__reviewComplete = [mi, bid, bt]; }}
    onViewed={() => {}}
    onExit={() => {}}
    onNextModule={() => {}}
    cachedQuizzes={[]}
    onQuizzesLoaded={() => {}}
    gamification={null}
    onGamification={() => {}}
  />,
);
