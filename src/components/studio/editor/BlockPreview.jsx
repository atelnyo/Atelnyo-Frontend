/**
 * src/components/studio/editor/BlockPreview.jsx
 *
 * Live block preview — renders a block exactly as learners will see it,
 * using the same BlockRenderer + block components from the learning system.
 *
 * Used inside BlockEditor so creators can toggle between editing and
 * previewing their content without leaving the editor.
 *
 * Props:
 *   block   — the block data object
 *   lang    — language code
 *   courseId — course ID (for quiz/progress features)
 *   moduleIndex — module index (for progress tracking)
 */
import React from 'react';
import { BlockRenderer } from '../../learning/blocks';
import styles from './editor.module.css';

export default function BlockPreview({ block, lang = 'ht', courseId, moduleIndex }) {
  if (!block) {
    return (
      <div className={styles.blockPreviewEmpty}>
        <i className="fas fa-eye-slash" aria-hidden="true" />
        <p>{lang === 'ht' ? 'Pa gen blok pou afiche.' : 'No block to preview.'}</p>
      </div>
    );
  }

  return (
    <div className={styles.blockPreviewContainer}>
      <div className={styles.blockPreviewFrame}>
        {/* Learner-side block rendering */}
        <BlockRenderer
          block={block}
          lang={lang}
          index={0}
          courseId={courseId}
          moduleIndex={moduleIndex}
          onComplete={() => {}} // no-op in preview mode
          onViewed={() => {}}   // no-op in preview mode
        />
      </div>
    </div>
  );
}
