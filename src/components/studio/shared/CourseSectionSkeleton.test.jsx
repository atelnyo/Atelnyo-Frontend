import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CourseSectionSkeleton from './CourseSectionSkeleton';

describe('CourseSectionSkeleton', () => {
  it('announces a busy course list and renders the requested number of rows', () => {
    const { container } = render(<CourseSectionSkeleton rows={2} />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Loading courses');
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
  });

  it('defaults to three rows', () => {
    const { container } = render(<CourseSectionSkeleton />);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);
  });
});
