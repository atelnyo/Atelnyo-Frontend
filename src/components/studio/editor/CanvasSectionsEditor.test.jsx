/**
 * CanvasSectionsEditor — rename / add / remove / reorder canvas sections.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CanvasSectionsEditor, { toEditableSections } from './CanvasSectionsEditor';
import { DEFAULT_SECTIONS } from '../../learning/blocks/CanvasBlock';

const renameInput = (i) => screen.getAllByLabelText(/Non seksyon an|Section name/)[i];

describe('toEditableSections', () => {
  it('falls back to the nine standard sections', () => {
    const out = toEditableSections(undefined, 'ht');
    expect(out).toHaveLength(DEFAULT_SECTIONS.length);
    expect(out[0]).toEqual({
      key: 'partners',
      title: 'Patnè Kle',
      hint: 'Kilès ki ede w delivre?',
    });
  });

  it('picks the requested language from bilingual titles', () => {
    const out = toEditableSections([{ key: 'a', title: { en: 'Key Partners', ht: 'Patnè Kle' } }], 'en');
    expect(out[0].title).toBe('Key Partners');
  });

  it('accepts plain strings and keeps stable keys', () => {
    const out = toEditableSections(['Segman', { id: 'x', name: 'Depans' }], 'ht');
    expect(out.map((s) => s.key)).toEqual(['section-0', 'x']);
    expect(out.map((s) => s.title)).toEqual(['Segman', 'Depans']);
  });
});

describe('CanvasSectionsEditor', () => {
  const block = { id: 'cv1', type: 'canvas', title: 'Kannavas' };

  it('shows the nine standard sections for a block without sections', () => {
    render(<CanvasSectionsEditor block={block} onChange={vi.fn()} lang="ht" />);
    expect(screen.getAllByLabelText(/Non seksyon an/)).toHaveLength(9);
    expect(renameInput(0)).toHaveValue('Patnè Kle');
  });

  it('renames a section and keeps its key', () => {
    const onChange = vi.fn();
    render(<CanvasSectionsEditor block={block} onChange={onChange} lang="ht" />);
    fireEvent.change(renameInput(0), { target: { value: 'Patnè mwen' } });
    const sections = onChange.mock.calls[0][0].sections;
    expect(sections[0]).toMatchObject({ key: 'partners', title: 'Patnè mwen' });
    expect(sections).toHaveLength(9);
  });

  it('adds a section at the end', () => {
    const onChange = vi.fn();
    render(<CanvasSectionsEditor block={block} onChange={onChange} lang="ht" />);
    fireEvent.click(screen.getByRole('button', { name: /Ajoute seksyon/ }));
    const sections = onChange.mock.calls[0][0].sections;
    expect(sections).toHaveLength(10);
    expect(sections[9].title).toBe('Nouvo seksyon');
    expect(sections[9].key).toMatch(/^section-/);
  });

  it('reorders sections with the arrows', () => {
    const onChange = vi.fn();
    render(<CanvasSectionsEditor block={block} onChange={onChange} lang="ht" />);
    fireEvent.click(screen.getByLabelText('Desann — Patnè Kle'));
    const titles = onChange.mock.calls[0][0].sections.map((s) => s.title);
    expect(titles[0]).toBe('Aktivite Kle');
    expect(titles[1]).toBe('Patnè Kle');
  });

  it('deletes a section', () => {
    const onChange = vi.fn();
    render(<CanvasSectionsEditor block={block} onChange={onChange} lang="ht" />);
    fireEvent.click(screen.getByLabelText('Efase — Patnè Kle'));
    const sections = onChange.mock.calls[0][0].sections;
    expect(sections).toHaveLength(8);
    expect(sections.some((s) => s.key === 'partners')).toBe(false);
  });

  it('restores the nine standard sections after edits', () => {
    const onChange = vi.fn();
    render(
      <CanvasSectionsEditor
        block={{ ...block, sections: [{ key: 'a', title: 'Sèl' }] }}
        onChange={onChange}
        lang="ht"
      />,
    );
    expect(screen.getAllByLabelText(/Non seksyon an/)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Retabli 9 estanda/ }));
    const sections = onChange.mock.calls[0][0].sections;
    expect(sections).toHaveLength(9);
    expect(sections[0]).toMatchObject({ key: 'partners', title: 'Patnè Kle' });
  });

  it('keeps the block id and title when sections change', () => {
    const onChange = vi.fn();
    render(<CanvasSectionsEditor block={block} onChange={onChange} lang="ht" />);
    fireEvent.click(screen.getByRole('button', { name: /Ajoute seksyon/ }));
    expect(onChange.mock.calls[0][0]).toMatchObject({ id: 'cv1', type: 'canvas', title: 'Kannavas' });
  });
});
