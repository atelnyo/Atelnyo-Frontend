/**
 * LearningCommandPalette — ⌘K quick jump.
 *
 * Covers the pure search helpers (they decide what a learner can find)
 * and the keyboard contract (type → arrow → Enter opens the right
 * activity), because a silent mis-route here would take someone to the
 * wrong lesson.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LearningCommandPalette, {
  buildPaletteItems,
  filterPaletteItems,
  normalize,
} from './LearningCommandPalette';

const syllabus = [
  {
    title: 'Fondasyon Design',
    blocks: [
      { id: 'b1', type: 'text', title: 'Kisa Design ye?' },
      { id: 'b2', type: 'image', title: 'Egzanp afich' },
    ],
  },
  {
    title: 'Tipografi',
    blocks: [{ id: 'b3', type: 'code', title: 'Enpòte Google Fonts' }],
  },
];

const baseArgs = {
  open: true,
  onClose: () => {},
  isHt: true,
  syllabus,
  completedBlocksMap: { 0: new Set(['b1']) },
  completedModules: [],
  moduleState: (i) => (i > 1 ? { status: 'available' } : { status: 'available' }),
  actions: [],
  onSelectModule: () => {},
  onSelectBlock: () => {},
};

describe('palette search helpers', () => {
  it('normalizes accents and case', () => {
    expect(normalize('Enpòte  GOOGLE')).toBe('enpote google');
  });

  it('builds one item per module and per activity', () => {
    const items = buildPaletteItems({ syllabus, isHt: true });
    expect(items.filter((i) => i.kind === 'module')).toHaveLength(2);
    expect(items.filter((i) => i.kind === 'block')).toHaveLength(3);
    expect(items[0]).toMatchObject({ kind: 'module', moduleIndex: 0, label: 'Fondasyon Design' });
  });

  it('marks completed activities and locked modules', () => {
    const items = buildPaletteItems({
      syllabus,
      isHt: true,
      completedBlocksMap: { 0: new Set(['b1']) },
      moduleState: (i) => (i === 1 ? { status: 'available', locked: true } : { status: 'available' }),
    });
    expect(items.find((i) => i.id === 'block-b1').done).toBe(true);
    expect(items.find((i) => i.id === 'block-b2').done).toBe(false);
    expect(items.find((i) => i.id === 'module-1').locked).toBe(true);
  });

  it('matches without accents and across tokens', () => {
    const items = buildPaletteItems({ syllabus, isHt: true });
    expect(filterPaletteItems(items, 'tipografi').map((i) => i.label)).toContain('Tipografi');
    expect(filterPaletteItems(items, 'enpote fonts').map((i) => i.label)).toEqual(['Enpòte Google Fonts']);
    expect(filterPaletteItems(items, 'zzz')).toHaveLength(0);
  });

  it('ranks module-title matches above mid-word matches', () => {
    const items = buildPaletteItems({ syllabus, isHt: true });
    const first = filterPaletteItems(items, 'tipografi')[0];
    expect(first.kind).toBe('module');
  });
});

describe('LearningCommandPalette', () => {
  it('renders nothing while closed', () => {
    const { container } = render(<LearningCommandPalette {...baseArgs} open={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('filters as the learner types', () => {
    render(<LearningCommandPalette {...baseArgs} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'enpote' } });
    expect(screen.getByText('Enpòte Google Fonts')).toBeInTheDocument();
    expect(screen.queryByText('Kisa Design ye?')).not.toBeInTheDocument();
  });

  it('Enter opens the highlighted activity with its module index', () => {
    const onSelectBlock = vi.fn();
    render(<LearningCommandPalette {...baseArgs} onSelectBlock={onSelectBlock} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'google' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onSelectBlock).toHaveBeenCalledWith(1, 'b3');
  });

  it('Escape closes the palette', () => {
    const onClose = vi.fn();
    render(<LearningCommandPalette {...baseArgs} onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('never opens a locked module', () => {
    const onSelectModule = vi.fn();
    render(
      <LearningCommandPalette
        {...baseArgs}
        moduleState={(i) => (i === 1 ? { status: 'available', locked: true } : { status: 'available' })}
        onSelectModule={onSelectModule}
      />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'tipografi' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onSelectModule).not.toHaveBeenCalled();
  });
});
