/**
 * CanvasBlock — the block type that used to render "not yet available".
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CanvasBlock, { normalizeSections, DEFAULT_SECTIONS } from './CanvasBlock';

// jsdom (as configured here) has no localStorage at all — give the test a
// real storage so the draft-persistence behaviour can be asserted.
if (!window.localStorage) {
  const mem = new Map();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => { mem.set(k, String(v)); },
      removeItem: (k) => { mem.delete(k); },
      clear: () => { mem.clear(); },
      key: (i) => Array.from(mem.keys())[i] ?? null,
      get length() { return mem.size; },
    },
  });
}

const block = { id: 'cv1', type: 'canvas', title: 'Kannavas Modèl Biznis' };

beforeEach(() => {
  window.localStorage.clear();
});

describe('normalizeSections', () => {
  it('falls back to the nine standard sections', () => {
    expect(normalizeSections(undefined, true)).toHaveLength(DEFAULT_SECTIONS.length);
    expect(normalizeSections([], false)).toHaveLength(DEFAULT_SECTIONS.length);
  });

  it('accepts custom sections, items arrays and plain strings', () => {
    const out = normalizeSections([
      { title: 'Patnè', items: ['A', 'B'] },
      'Segman',
    ], true);
    expect(out[0]).toMatchObject({ title: 'Patnè', content: 'A\nB' });
    expect(out[1]).toMatchObject({ title: 'Segman', content: '' });
  });

  it('localizes object titles', () => {
    const out = normalizeSections([{ title: { en: 'Partners', ht: 'Patnè' } }], false);
    expect(out[0].title).toBe('Partners');
  });
});

describe('CanvasBlock', () => {
  it('renders every section as an editable field', () => {
    render(<CanvasBlock block={block} lang="ht" moduleIndex={2} courseId={7} />);
    expect(screen.getAllByRole('textbox')).toHaveLength(DEFAULT_SECTIONS.length);
    expect(screen.getByLabelText('Patnè Kle')).toBeInTheDocument();
    expect(screen.getByText('0/' + DEFAULT_SECTIONS.length + ' seksyon')).toBeInTheDocument();
  });

  it('is not completable until something is written', () => {
    const onComplete = vi.fn();
    render(<CanvasBlock block={block} lang="ht" moduleIndex={2} courseId={7} onComplete={onComplete} />);
    const done = screen.getByRole('button', { name: /Mwen fini ak kannavas la/ });
    expect(done).toBeDisabled();
    fireEvent.click(done);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('completes with the module index, block id and type', async () => {
    const onComplete = vi.fn();
    render(<CanvasBlock block={block} lang="ht" moduleIndex={2} courseId={7} onComplete={onComplete} />);
    fireEvent.change(screen.getByLabelText('Patnè Kle'), { target: { value: 'Yon boulanje' } });
    const done = screen.getByRole('button', { name: /Mwen fini ak kannavas la/ });
    expect(done).not.toBeDisabled();
    fireEvent.click(done);
    expect(onComplete).toHaveBeenCalledWith(2, 'cv1', 'canvas');
  });

  it('reports the view once', () => {
    const onViewed = vi.fn();
    const { rerender } = render(
      <CanvasBlock block={block} lang="ht" moduleIndex={2} courseId={7} onViewed={onViewed} />,
    );
    rerender(<CanvasBlock block={block} lang="ht" moduleIndex={2} courseId={7} onViewed={onViewed} />);
    expect(onViewed).toHaveBeenCalledTimes(1);
    expect(onViewed).toHaveBeenCalledWith(2, 'cv1', 'canvas');
  });

  it('keeps the learner’s work across a remount', async () => {
    const { unmount } = render(<CanvasBlock block={block} lang="ht" moduleIndex={2} courseId={7} />);
    fireEvent.change(screen.getByLabelText('Pwopozisyon Valè'), { target: { value: 'Pen fre chak maten' } });
    await waitFor(() => {
      expect(window.localStorage.getItem('atelnyo-canvas:7:cv1')).toContain('Pen fre chak maten');
    });
    unmount();

    render(<CanvasBlock block={block} lang="ht" moduleIndex={2} courseId={7} />);
    expect(screen.getByLabelText('Pwopozisyon Valè')).toHaveValue('Pen fre chak maten');
  });
});
