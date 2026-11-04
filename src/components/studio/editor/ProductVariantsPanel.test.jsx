import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import ProductVariantsPanel from './ProductVariantsPanel';

const VARIANTS = [
  { id: 1, name: 'Black / M', price: 25, stock: null, sku: '', is_printify: true },
  { id: 2, name: 'Black / L', price: null, stock: 0, sku: '', is_printify: true },
  { id: 3, name: 'Manual', price: null, stock: null, sku: '', is_printify: false },
];

const baseProps = {
  lang: 'ht',
  variants: VARIANTS,
  canEdit: true,
  onAdd: vi.fn(),
  onUpdate: vi.fn(),
  onRemove: vi.fn(),
};

describe('ProductVariantsPanel bulk delete', () => {
  it('explains Printify stock instead of bare unlimited/zero', () => {
    // The meta line mixes price + stock in separate text nodes, so match
    // on the row's full text instead of a single text node.
    const { container } = render(<ProductVariantsPanel {...baseProps} />);
    const text = container.textContent;
    // Available POD variant (stock null) is not "illimite" without context…
    expect(text).toContain('Disponib (Printify)');
    // …and an unavailable one names the provider instead of "0 an stock".
    expect(text).toContain('Pa disponib sou Printify');
    // Manual variants keep the old wording.
    expect(text).toContain('illimite');
  });

  it('selects several rows and deletes them with one callback', async () => {
    const onRemoveMany = vi.fn().mockResolvedValue({ data: { deleted: 2 } });
    render(<ProductVariantsPanel {...baseProps} onRemoveMany={onRemoveMany} />);

    const boxes = screen.getAllByRole('checkbox');
    // 1 select-all + 3 rows.
    expect(boxes).toHaveLength(4);

    fireEvent.click(screen.getByLabelText('Chwazi variant Black / M'));
    fireEvent.click(screen.getByLabelText('Chwazi variant Black / L'));
    expect(screen.getByText('2 chwazi')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Efase seleksyon yo' }));
    // ConfirmModal asks before the destructive action.
    expect(await screen.findByText('Efase variants chwazi yo?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Wi, efase' }));

    await waitFor(() => expect(onRemoveMany).toHaveBeenCalledTimes(1));
    expect(onRemoveMany).toHaveBeenCalledWith([1, 2]);
  });

  it('select-all toggles every row', () => {
    const onRemoveMany = vi.fn();
    render(<ProductVariantsPanel {...baseProps} onRemoveMany={onRemoveMany} />);
    fireEvent.click(screen.getByLabelText('Chwazi tout variants yo'));
    expect(screen.getByText('3 chwazi')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Chwazi tout variants yo'));
    expect(
      screen.getByText('Chwazi variants pou efase plizyè ansanm.'),
    ).toBeTruthy();
  });

  it('shows no checkboxes for a single variant', () => {
    render(
      <ProductVariantsPanel
        {...baseProps}
        variants={[VARIANTS[0]]}
        onRemoveMany={vi.fn()}
      />,
    );
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });
});
