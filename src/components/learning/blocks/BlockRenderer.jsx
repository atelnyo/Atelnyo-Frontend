/**
 * BlockRenderer — §14-§17 Block Placement System
 *
 * General-purpose block dispatcher with:
 *   • Layout contract — each block renders inside a predictable width tier
 *   • Error isolation — one broken block does not crash the lesson
 *   • Lazy loading support — heavy blocks load only when needed
 *   • Block independence — each block renders independently
 *
 * Usage (in ModuleSession or LearningSpace):
 *   <BlockRenderer block={block} lang={lang} ... />
 *
 * §16 — Block Visual Independence:
 *   One block must not require assumptions about the previous or next block.
 *
 * §17 — Block Error Isolation:
 *   If one block fails, the remaining lesson continues functioning.
 */
import React, { Suspense, useCallback, useEffect, useMemo } from 'react';
import { getBlockComponent, getBlockMeta, getBlockDefaultLayout } from './registry';
import { BlockErrorBoundary } from '../LearningShell';
import useBlockAnalytics from '../../../hooks/useBlockAnalytics';

// §51-52 — Lazy-loaded heavy blocks. These are only imported when a
// block of this type is actually rendered. A simple lesson should not
// load advanced editors or heavy interactive libraries unnecessarily.
const LAZY_BLOCK_COMPONENTS = {
  calculator: React.lazy(() => import('./CalculatorBlock')),
  scenario: React.lazy(() => import('./ScenarioBlock')),
  code_exercise: React.lazy(() => import('./CodeExerciseBlock')),
  exercise: React.lazy(() => import('./ExerciseBlock')),
  project: React.lazy(() => import('./ProjectBlock')),
  multiple_choice: React.lazy(() => import('./MultipleChoiceBlock')),
  multiple_answer: React.lazy(() => import('./MultipleAnswerBlock')),
  true_false: React.lazy(() => import('./TrueFalseBlock')),
};

// Loading placeholder shown while a lazy block loads
function BlockLoadingPlaceholder({ lang }) {
  return (
    <div className="ls-block-placement ls-block-placement--interactive">
      <div className="ls-block-width ls-block-width--wide" style={{ padding: 20 }}>
        <div className="ls-shell-skeleton" style={{ width: '40%', height: 16, marginBottom: 12 }} />
        <div className="ls-shell-skeleton" style={{ width: '100%', height: 100, borderRadius: 12 }} />
      </div>
    </div>
  );
}

// Block width CSS class mapping
const WIDTH_CLASSES = {
  content: 'ls-block-width--content',
  standard: 'ls-block-width--standard',
  wide: 'ls-block-width--wide',
  full: 'ls-block-width--full',
};

// Block category for vertical rhythm
const CATEGORY_MAP = {
  text: 'content',
  callout: 'content',
  embed: 'content',
  timeline: 'content',
  image: 'media',
  video: 'media',
  audio_record: 'media',
  quiz: 'assessment',
  assignment: 'assessment',
  project: 'assessment',
  exercise: 'assessment',
  checklist: 'assessment',
  code: 'content',
  code_exercise: 'interactive',
  scenario: 'interactive',
  calculator: 'interactive',
  vocabulary: 'interactive',
  repeat: 'interactive',
  pronunciation: 'interactive',
  speaking: 'interactive',
  listening: 'interactive',
  conversation: 'interactive',
  fill_blank: 'interactive',
  matching: 'interactive',
  reflection: 'interactive',
};

export default function BlockRenderer({
  block,
  lang = 'ht',
  index = 0,
  courseId,
  moduleIndex,
  onComplete,
  onViewed,
  // §15 — Layout override: allows the shell to force a specific width
  layoutOverride,
  // §17 — Error recovery
  onRetry,
}) {
  if (!block || !block.type) {
    return (
      <div className="ls-block-placement ls-block-placement--content">
        <div className="ls-block-width ls-block-width--content" style={{ padding: 12, color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.85rem' }}>
          {lang === 'ht' ? 'Bloc enkoni.' : 'Unknown block.'}
        </div>
      </div>
    );
  }

  // §51-52 — Check if this block type has a lazy-loaded version
  const LazyComponent = LAZY_BLOCK_COMPONENTS[block.type];
  const EagerComponent = getBlockComponent(block.type);
  const Component = LazyComponent || EagerComponent;

  if (!Component) {
    const meta = getBlockMeta(block.type);
    return (
      <div className="ls-block-placement ls-block-placement--content">
        <div className="ls-block-width ls-block-width--content" style={{
          padding: 16, borderRadius: 8, border: '1px dashed var(--border-color, #e5e7eb)',
          textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem',
        }}>
          <i className={`fas ${meta.icon}`} style={{ fontSize: '1.2rem', marginBottom: 8, display: 'block', opacity: 0.5 }} aria-hidden="true" />
          <div>{meta.label[lang] || meta.label.en || block.type}</div>
          <div style={{ fontSize: '0.75rem', marginTop: 4, opacity: 0.7 }}>
            {lang === 'ht' ? 'Kalite bloc sa a poko disponib.' : 'This block type is not yet available.'}
          </div>
        </div>
      </div>
    );
  }

  // §15 — Determine layout width
  const layout = layoutOverride || getBlockDefaultLayout(block.type);
  const widthClass = WIDTH_CLASSES[layout] || WIDTH_CLASSES.content;

  // §14-16 — Determine block category for vertical rhythm
  const category = CATEGORY_MAP[block.type] || 'interactive';

  // §45 — Block analytics: track view + completion (metadata only, no student answers)
  const { trackView, trackComplete } = useBlockAnalytics({
    blockId: block?.id,
    blockType: block?.type,
    courseId,
    moduleIndex,
  });

  useEffect(() => { trackView(); }, [trackView]);

  // Wrap onComplete so block components can call reportComplete()
  // without arguments — we automatically inject the moduleIndex and
  // block.id that ModuleSession.handleComplete expects.
  const wrappedComplete = useCallback((...args) => {
    trackComplete();
    const mi = args[0] != null ? args[0] : moduleIndex;
    const bid = args[1] || block?.id;
    const btype = args[2] || block?.type;
    onComplete(mi, bid, btype);
  }, [onComplete, moduleIndex, block, trackComplete]);

  return (
    <div className={`ls-block-placement ls-block-placement--${category}`}>
      <div className={`ls-block-width ${widthClass}`}>
        {/* §17 — Error isolation: wrap each block in its own error boundary */}
        <BlockErrorBoundary
          isHt={lang === 'ht'}
          blockType={block.type}
          onRetry={onRetry}
        >
          {LazyComponent ? (
            <Suspense fallback={<BlockLoadingPlaceholder lang={lang} />}>
              <Component
                block={block}
                lang={lang}
                index={index}
                courseId={courseId}
                moduleIndex={moduleIndex}
                onComplete={wrappedComplete}
                reportComplete={wrappedComplete}
                onViewed={onViewed}
              />
            </Suspense>
          ) : (
            <Component
              block={block}
              lang={lang}
              index={index}
              courseId={courseId}
              moduleIndex={moduleIndex}
              onComplete={wrappedComplete}
              reportComplete={wrappedComplete}
              onViewed={onViewed}
            />
          )}
        </BlockErrorBoundary>
      </div>
    </div>
  );
}
