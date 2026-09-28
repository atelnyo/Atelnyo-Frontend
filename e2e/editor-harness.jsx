/**
 * e2e/editor-harness.jsx
 *
 * Dev-only harness that mounts the REAL LanguagePracticeEditor with a
 * small controlled block list so a Playwright spec can verify the
 * creator UX — specifically the Duplicate button — in a real browser.
 *
 * Served by Vite at /e2e/editor-harness.html.
 */
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import LanguagePracticeEditor from '../src/components/studio/editor/LanguagePracticeEditor.jsx';

function EditorHost() {
  const [blocks, setBlocks] = useState([
    { id: 'r1', type: 'repeat', targetText: 'bonjou kouman ou ye', title: 'Repete 1' },
    { id: 'v1', type: 'vocabulary', targetText: 'mèsi', title: 'Vokabilè 1' },
  ]);
  return (
    <LanguagePracticeEditor blocks={blocks} onBlocksChange={setBlocks} lang="ht" />
  );
}

createRoot(document.getElementById('root')).render(<EditorHost />);
