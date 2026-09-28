/**
 * src/components/studio/editor/BlockPreview.test.jsx
 *
 * Tests for BlockPreview — renders a block exactly as learners see it
 * using the BlockRenderer from the learning system.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import BlockPreview from './BlockPreview';

// Track what BlockRenderer receives
const blockRendererCalls = [];
vi.mock('../../learning/blocks', () => ({
  BlockRenderer: ({ block, lang, courseId, moduleIndex, onComplete, onViewed }) => {
    blockRendererCalls.push({ block, lang, courseId, moduleIndex, onComplete, onViewed });
    return (
      <div data-testid="mock-block-renderer">
        <span data-testid="rendered-type">{block?.type}</span>
        <span data-testid="rendered-title">{block?.title}</span>
      </div>
    );
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  blockRendererCalls.length = 0;
});

describe('BlockPreview', () => {
  it('renders empty state when block is null', () => {
    render(<BlockPreview block={null} lang="ht" />);
    // lang='ht' → t(en, ht) returns ht text
    expect(screen.getByText(/Pa gen blok pou afiche/)).toBeInTheDocument();
  });

  it('renders the block via BlockRenderer', () => {
    const block = { id: 't1', type: 'text', title: 'My Text' };
    render(<BlockPreview block={block} lang="ht" />);
    expect(screen.getByTestId('mock-block-renderer')).toBeInTheDocument();
    expect(screen.getByTestId('rendered-type')).toHaveTextContent('text');
    expect(screen.getByTestId('rendered-title')).toHaveTextContent('My Text');
  });

  it('passes correct props to BlockRenderer', () => {
    const block = { id: 'v1', type: 'vocabulary', title: 'Vocab' };
    render(<BlockPreview block={block} lang="en" courseId={42} moduleIndex={2} />);
    expect(blockRendererCalls).toHaveLength(1);
    const call = blockRendererCalls[0];
    expect(call.block).toBe(block);
    expect(call.lang).toBe('en');
    expect(call.courseId).toBe(42);
    expect(call.moduleIndex).toBe(2);
  });

  it('passes no-op callbacks for onComplete and onViewed', () => {
    const block = { id: 'c1', type: 'checklist', title: 'Check' };
    render(<BlockPreview block={block} lang="ht" />);
    const call = blockRendererCalls[0];
    expect(typeof call.onComplete).toBe('function');
    expect(typeof call.onViewed).toBe('function');
    // Calling them should not throw
    expect(() => call.onComplete()).not.toThrow();
    expect(() => call.onViewed()).not.toThrow();
  });

  it('renders all block types without error', () => {
    const types = ['text', 'image', 'video', 'callout', 'vocabulary', 'repeat', 'conversation', 'matching', 'checklist', 'quiz', 'code'];
    types.forEach((type) => {
      const { unmount } = render(
        <BlockPreview block={{ id: `${type}-1`, type, title: `${type} block` }} lang="ht" />,
      );
      expect(screen.getByTestId('rendered-type')).toHaveTextContent(type);
      unmount();
    });
    expect(blockRendererCalls).toHaveLength(types.length);
  });
});
