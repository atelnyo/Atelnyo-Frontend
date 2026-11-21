import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePageSkeleton from './HomePageSkeleton';

describe('HomePageSkeleton', () => {
  it('announces a busy, localized loading state', () => {
    render(<HomePageSkeleton lang="ht" />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Chajman paj akèy la…')).toBeInTheDocument();
  });

  it('falls back to English for an unsupported language', () => {
    render(<HomePageSkeleton lang="de" />);
    expect(screen.getByText('Loading the home page…')).toBeInTheDocument();
  });
});
