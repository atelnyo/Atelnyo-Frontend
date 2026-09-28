/**
 * src/components/studio/editor/BlockEditor.test.jsx
 *
 * Tests for the BlockEditor — the universal content block editing surface
 * for course modules. Covers:
 *   - Render with empty / populated blocks
 *   - Add block via picker
 *   - Edit / save / cancel block
 *   - Delete / duplicate block
 *   - Edit/Preview mode toggle
 *   - Specialized editors (conversation, matching, checklist, quiz)
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import BlockEditor from './BlockEditor';

// Mock the block registry to avoid loading real block components
vi.mock('../../learning/blocks', () => ({
  BLOCK_TYPES: {
    text:          { icon: 'fa-file-lines',   label: { en: 'Reading', ht: 'Lekti' },       category: 'content' },
    image:         { icon: 'fa-image',        label: { en: 'Image',   ht: 'Imaj' },        category: 'content' },
    video:         { icon: 'fa-video',        label: { en: 'Video',   ht: 'Videyo' },      category: 'content' },
    callout:       { icon: 'fa-circle-info',  label: { en: 'Note',    ht: 'Nòt' },         category: 'content' },
    vocabulary:    { icon: 'fa-book-open',    label: { en: 'Vocab',   ht: 'Vokabilè' },    category: 'practice' },
    repeat:        { icon: 'fa-repeat',       label: { en: 'Repeat',  ht: 'Repete' },      category: 'practice' },
    conversation:  { icon: 'fa-comments',     label: { en: 'Conv',    ht: 'Konvèsasyon' }, category: 'practice' },
    matching:      { icon: 'fa-link',         label: { en: 'Matching', ht: 'Asosye' },     category: 'practice' },
    checklist:     { icon: 'fa-list-check',   label: { en: 'Checklist', ht: 'Tcheklis' },  category: 'assessment' },
    quiz:          { icon: 'fa-circle-question', label: { en: 'Quiz', ht: 'Kiz' },         category: 'assessment' },
    code:          { icon: 'fa-code',         label: { en: 'Code',     ht: 'Kòd' },        category: 'code' },
  },
  getBlockTypesByCategory: () => ({
    content: [
      { type: 'text', icon: 'fa-file-lines', label: { en: 'Reading', ht: 'Lekti' }, category: 'content' },
      { type: 'image', icon: 'fa-image', label: { en: 'Image', ht: 'Imaj' }, category: 'content' },
    ],
    practice: [
      { type: 'vocabulary', icon: 'fa-book-open', label: { en: 'Vocab', ht: 'Vokabilè' }, category: 'practice' },
      { type: 'conversation', icon: 'fa-comments', label: { en: 'Conv', ht: 'Konvèsasyon' }, category: 'practice' },
      { type: 'matching', icon: 'fa-link', label: { en: 'Matching', ht: 'Asosye' }, category: 'practice' },
    ],
    assessment: [
      { type: 'checklist', icon: 'fa-list-check', label: { en: 'Checklist', ht: 'Tcheklis' }, category: 'assessment' },
      { type: 'quiz', icon: 'fa-circle-question', label: { en: 'Quiz', ht: 'Kiz' }, category: 'assessment' },
    ],
    code: [
      { type: 'code', icon: 'fa-code', label: { en: 'Code', ht: 'Kòd' }, category: 'code' },
    ],
  }),
  getBlockMeta: (type) => ({
    text: { icon: 'fa-file-lines', label: { en: 'Reading', ht: 'Lekti' } },
    image: { icon: 'fa-image', label: { en: 'Image', ht: 'Imaj' } },
    video: { icon: 'fa-video', label: { en: 'Video', ht: 'Videyo' } },
    callout: { icon: 'fa-circle-info', label: { en: 'Note', ht: 'Nòt' } },
    vocabulary: { icon: 'fa-book-open', label: { en: 'Vocab', ht: 'Vokabilè' } },
    repeat: { icon: 'fa-repeat', label: { en: 'Repeat', ht: 'Repete' } },
    conversation: { icon: 'fa-comments', label: { en: 'Conv', ht: 'Konvèsasyon' } },
    matching: { icon: 'fa-link', label: { en: 'Matching', ht: 'Asosye' } },
    checklist: { icon: 'fa-list-check', label: { en: 'Checklist', ht: 'Tcheklis' } },
    quiz: { icon: 'fa-circle-question', label: { en: 'Quiz', ht: 'Kiz' } },
    code: { icon: 'fa-code', label: { en: 'Code', ht: 'Kòd' } },
  })[type] || { icon: 'fa-cube', label: { en: type, ht: type } },
  BlockRenderer: ({ block }) => <div data-testid={`block-renderer-${block.type}`}>Rendered: {block.type}</div>,
}));

// Mock the specialized editors
vi.mock('./ConversationStepsEditor', () => ({
  default: ({ block }) => <div data-testid="conversation-editor">Conversation Editor</div>,
}));
vi.mock('./MatchingPairsEditor', () => ({
  default: ({ block }) => <div data-testid="matching-editor">Matching Editor</div>,
}));
vi.mock('./ChecklistItemsEditor', () => ({
  default: ({ block }) => <div data-testid="checklist-editor">Checklist Editor</div>,
}));
vi.mock('./QuizInlineEditor', () => ({
  default: ({ block }) => <div data-testid="quiz-editor">Quiz Editor</div>,
}));
vi.mock('./BlockPreview', () => ({
  default: ({ block }) => <div data-testid="block-preview">Preview: {block?.type}</div>,
}));

const TEXT_BLOCK = { id: 'text-1', type: 'text', title: 'My Text', content: 'Hello world' };
const IMAGE_BLOCK = { id: 'img-1', type: 'image', title: 'My Image', imageUrl: 'https://example.com/img.png' };

beforeEach(() => {
  vi.clearAllMocks();
  window.confirm = undefined;
});

describe('BlockEditor', () => {
  describe('rendering', () => {
    it('renders empty state when no blocks', () => {
      render(<BlockEditor blocks={[]} onBlocksChange={vi.fn()} lang="ht" />);
      // lang='ht' → t(en, ht) returns ht text; empty state is the second arg
      expect(screen.getByText(/No blocks yet/)).toBeInTheDocument();
    });

    it('renders existing blocks in collapsed preview', () => {
      render(<BlockEditor blocks={[TEXT_BLOCK]} onBlocksChange={vi.fn()} lang="ht" />);
      expect(screen.getByText('My Text')).toBeInTheDocument();
      expect(screen.getByText('text-1')).toBeInTheDocument();
    });

    it('shows block count in header', () => {
      render(<BlockEditor blocks={[TEXT_BLOCK, IMAGE_BLOCK]} onBlocksChange={vi.fn()} lang="ht" />);
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('block picker', () => {
    it('opens block picker when "Add Block" is clicked', () => {
      render(<BlockEditor blocks={[]} onBlocksChange={vi.fn()} lang="ht" />);
      fireEvent.click(screen.getByText(/Ajoute Blok/));
      // Category names are rendered as 'emoji Category' (e.g. '📄 Content')
      expect(screen.getByText(/📄 Content/)).toBeInTheDocument();
      expect(screen.getByText(/🎯 Practice/)).toBeInTheDocument();
      expect(screen.getByText(/📝 Assessment/)).toBeInTheDocument();
    });

    it('adds a new block when a type is selected', () => {
      const onBlocksChange = vi.fn();
      render(<BlockEditor blocks={[]} onBlocksChange={onBlocksChange} lang="ht" />);
      fireEvent.click(screen.getByText(/Ajoute Blok/));
      // Block picker items show icon + label in Haitian: 'Lekti' for text
      const readingBtn = screen.getByRole('button', { name: /Lekti/ });
      fireEvent.click(readingBtn);
      expect(onBlocksChange).toHaveBeenCalledTimes(1);
      const newBlocks = onBlocksChange.mock.calls[0][0];
      expect(newBlocks).toHaveLength(1);
      expect(newBlocks[0].type).toBe('text');
      expect(newBlocks[0].id).toMatch(/^text-/);
    });

    it('closes picker after adding a block', () => {
      const onBlocksChange = vi.fn();
      render(<BlockEditor blocks={[]} onBlocksChange={onBlocksChange} lang="ht" />);
      fireEvent.click(screen.getByText(/Ajoute Blok/));
      const readingBtn = screen.getByRole('button', { name: /Lekti/ });
      fireEvent.click(readingBtn);
      // Picker should close — category headers should disappear
      expect(screen.queryByText(/📄 Content/)).not.toBeInTheDocument();
    });
  });

  describe('inline editing', () => {
    it('enters edit mode when a block is clicked', () => {
      render(<BlockEditor blocks={[TEXT_BLOCK]} onBlocksChange={vi.fn()} lang="ht" />);
      fireEvent.click(screen.getByText('My Text'));
      // t(en, ht) when lang='ht' returns ht (second arg)
      // Cancel button: t('Anile', 'Cancel') → 'Cancel' when isHt=true
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      // Save button: t('Sove', 'Save') → 'Save' when isHt=true
      expect(screen.getAllByText('Save').length).toBeGreaterThan(0);
    });

    it('shows field inputs for text blocks', () => {
      render(<BlockEditor blocks={[TEXT_BLOCK]} onBlocksChange={vi.fn()} lang="ht" />);
      fireEvent.click(screen.getByText('My Text'));
      // Title input should have the block's title
      const titleInput = screen.getAllByDisplayValue('My Text')[0];
      expect(titleInput).toBeInTheDocument();
    });

    it('saves block changes on Save click', () => {
      const onBlocksChange = vi.fn();
      render(<BlockEditor blocks={[TEXT_BLOCK]} onBlocksChange={onBlocksChange} lang="ht" />);
      fireEvent.click(screen.getByText('My Text'));

      // Change title
      const titleInput = screen.getAllByDisplayValue('My Text')[0];
      fireEvent.change(titleInput, { target: { value: 'Updated Title' } });
      // Save button: t('Sove', 'Save') → 'Save' when isHt=true (second arg)
      const saveBtns = screen.getAllByText('Save');
      fireEvent.click(saveBtns[0]);

      expect(onBlocksChange).toHaveBeenCalledTimes(1);
      const updated = onBlocksChange.mock.calls[0][0];
      expect(updated[0].title).toBe('Updated Title');
    });

    it('cancels editing without saving', () => {
      const onBlocksChange = vi.fn();
      render(<BlockEditor blocks={[TEXT_BLOCK]} onBlocksChange={onBlocksChange} lang="ht" />);
      fireEvent.click(screen.getByText('My Text'));
      // Cancel: t('Anile', 'Cancel') → 'Cancel' when isHt=true
      fireEvent.click(screen.getByText('Cancel'));

      expect(onBlocksChange).not.toHaveBeenCalled();
      // Back to collapsed preview
      expect(screen.getByText('My Text')).toBeInTheDocument();
    });
  });

  describe('delete and duplicate', () => {
    it('deletes a block', () => {
      window.confirm = vi.fn(() => true);
      const onBlocksChange = vi.fn();
      render(<BlockEditor blocks={[TEXT_BLOCK, IMAGE_BLOCK]} onBlocksChange={onBlocksChange} lang="ht" />);
      // Hover to reveal actions, then click delete
      const deleteBtn = screen.getAllByTitle('Delete')[0];
      fireEvent.click(deleteBtn);
      expect(onBlocksChange).toHaveBeenCalledWith([IMAGE_BLOCK]);
    });

    it('duplicates a block', () => {
      const onBlocksChange = vi.fn();
      render(<BlockEditor blocks={[TEXT_BLOCK]} onBlocksChange={onBlocksChange} lang="ht" />);
      const dupBtn = screen.getAllByTitle('Duplicate')[0];
      fireEvent.click(dupBtn);
      expect(onBlocksChange).toHaveBeenCalledTimes(1);
      const next = onBlocksChange.mock.calls[0][0];
      expect(next).toHaveLength(2);
      expect(next[1].type).toBe('text');
      expect(next[1].title).toContain('copy');
    });
  });

  describe('edit/preview toggle', () => {
    it('shows edit and preview toggle buttons in edit mode', () => {
      render(<BlockEditor blocks={[TEXT_BLOCK]} onBlocksChange={vi.fn()} lang="ht" />);
      fireEvent.click(screen.getByText('My Text'));
      // Preview toggle: t('Gade', 'Preview') → 'Preview' when isHt=true
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });

    it('switches to preview mode when Preview is clicked', () => {
      render(<BlockEditor blocks={[TEXT_BLOCK]} onBlocksChange={vi.fn()} lang="ht" />);
      fireEvent.click(screen.getByText('My Text'));
      // Preview: t('Gade', 'Preview') → 'Preview' when isHt=true
      fireEvent.click(screen.getByText('Preview'));
      expect(screen.getByTestId('block-preview')).toBeInTheDocument();
      // Preview badge: isHt ? 'Gade kòman elèv yo wè l' : 'Preview how learners see this'
      expect(screen.getByText(/Gade kòman elèv yo wè l/)).toBeInTheDocument();
    });

    it('switches back to edit mode', () => {
      render(<BlockEditor blocks={[TEXT_BLOCK]} onBlocksChange={vi.fn()} lang="ht" />);
      fireEvent.click(screen.getByText('My Text'));
      // Preview: t('Gade', 'Preview') → 'Preview' when isHt=true
      fireEvent.click(screen.getByText('Preview'));
      expect(screen.getByTestId('block-preview')).toBeInTheDocument();
      // Edit: t('Editè', 'Edit') → 'Edit' when isHt=true
      fireEvent.click(screen.getByText('Edit'));
      expect(screen.queryByTestId('block-preview')).not.toBeInTheDocument();
    });
  });

  describe('specialized block editors', () => {
    it('renders ConversationStepsEditor for conversation blocks', () => {
      const convBlock = { id: 'c1', type: 'conversation', title: 'My Conv', steps: [] };
      render(<BlockEditor blocks={[convBlock]} onBlocksChange={vi.fn()} lang="ht" />);
      fireEvent.click(screen.getByText('My Conv'));
      expect(screen.getByTestId('conversation-editor')).toBeInTheDocument();
    });

    it('renders MatchingPairsEditor for matching blocks', () => {
      const matchBlock = { id: 'm1', type: 'matching', title: 'My Match', pairs: [] };
      render(<BlockEditor blocks={[matchBlock]} onBlocksChange={vi.fn()} lang="ht" />);
      fireEvent.click(screen.getByText('My Match'));
      expect(screen.getByTestId('matching-editor')).toBeInTheDocument();
    });

    it('renders ChecklistItemsEditor for checklist blocks', () => {
      const checkBlock = { id: 'ch1', type: 'checklist', title: 'My Check', items: [] };
      render(<BlockEditor blocks={[checkBlock]} onBlocksChange={vi.fn()} lang="ht" />);
      fireEvent.click(screen.getByText('My Check'));
      expect(screen.getByTestId('checklist-editor')).toBeInTheDocument();
    });

    it('renders QuizInlineEditor for quiz blocks', () => {
      const quizBlock = { id: 'q1', type: 'quiz', title: 'My Quiz' };
      render(<BlockEditor blocks={[quizBlock]} onBlocksChange={vi.fn()} lang="ht" courseId={1} moduleIndex={0} />);
      fireEvent.click(screen.getByText('My Quiz'));
      expect(screen.getByTestId('quiz-editor')).toBeInTheDocument();
    });
  });
});
