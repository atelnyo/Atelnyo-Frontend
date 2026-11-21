import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CommentListSkeleton from './CommentListSkeleton';

describe('CommentListSkeleton', () => {
  it('announces the localized comment loading state', () => {
    render(<CommentListSkeleton lang="ht" rows={2} />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveAttribute('aria-label', 'Ap chaje kòmantè yo…');
    expect(status.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
  });

  it('falls back to English for an unsupported language', () => {
    render(<CommentListSkeleton lang="de" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading comments…');
  });
});
