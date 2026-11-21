import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CourseDetailSkeleton from './CourseDetailSkeleton';

describe('CourseDetailSkeleton', () => {
  it('announces a busy course loading state', () => {
    render(<CourseDetailSkeleton lang="ht" />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Ap chaje detay kou a…')).toBeInTheDocument();
  });

  it('falls back to English for an unsupported language', () => {
    render(<CourseDetailSkeleton lang="de" />);
    expect(screen.getByText('Loading course…')).toBeInTheDocument();
  });
});
