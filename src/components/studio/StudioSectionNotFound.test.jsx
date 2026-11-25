import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import StudioSectionNotFound from './StudioSectionNotFound';

describe('StudioSectionNotFound', () => {
  it('keeps the broken address visible and explains it', () => {
    render(<StudioSectionNotFound section="ghost" onBack={vi.fn()} />);

    expect(screen.getByText('/studio/ghost')).toBeTruthy();
    expect(screen.getByText(/Section not found/i)).toBeTruthy();
    expect(screen.getByText(/does not exist/i)).toBeTruthy();
  });

  it('returns to the dashboard through the given handler', async () => {
    const onBack = vi.fn();
    render(<StudioSectionNotFound section="ghost" onBack={onBack} />);

    await userEvent.click(screen.getByRole('button', { name: /Back to dashboard/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('speaks Creole when the studio language is ht', () => {
    render(<StudioSectionNotFound section="ghost" lang="ht" onBack={vi.fn()} />);

    expect(screen.getByText(/Seksyon sa a pa egziste/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Tounen nan tablodbò a/ })).toBeTruthy();
  });
});
