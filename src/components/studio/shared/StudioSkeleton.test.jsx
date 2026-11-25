import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StudioSkeleton from './StudioSkeleton';

describe('StudioSkeleton', () => {
  it('defaults to the stacked list and announces one busy status', () => {
    const { container } = render(<StudioSkeleton />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Loading');

    // Four default bars, none of them announced individually.
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(4);
  });

  it('renders row-shaped placeholders for list sections', () => {
    const { container } = render(
      <StudioSkeleton variant="rows" rows={2} label="Loading music…" />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading music');
    const rows = container.querySelectorAll('[aria-hidden="true"]');
    expect(rows).toHaveLength(2);
    // thumb + body(title + meta) + two actions per row
    rows.forEach((row) => expect(row.children).toHaveLength(3));
  });

  it('renders card-shaped placeholders for grids', () => {
    const { container } = render(<StudioSkeleton variant="cards" rows={3} />);

    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);
    expect(container.querySelector('table')).toBeNull();
  });

  it('renders stat-shaped placeholders for KPI grids', () => {
    const { container } = render(<StudioSkeleton variant="stats" rows={4} />);

    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(4);
    expect(container.querySelector('table')).toBeNull();
  });

  it('renders a real table shape for data tables', () => {
    const { container } = render(
      <StudioSkeleton variant="table" rows={2} columns={3} label="Loading orders…" />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading orders');
    expect(container.querySelectorAll('thead th')).toHaveLength(3);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(container.querySelectorAll('tbody tr[aria-hidden="true"]')).toHaveLength(2);
  });

  it('falls back to the list variant for an unknown variant name', () => {
    const { container } = render(<StudioSkeleton variant="nonsense" rows={2} />);

    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
  });
});
