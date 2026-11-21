/**
 * src/components/profile/ProfileSkeleton.test.jsx
 *
 * The skeleton must mirror the real page and stay accessible:
 *   • full page announces a single busy status (localized);
 *   • decorative shimmer blocks are hidden from assistive tech;
 *   • the tab section renders the requested number of card placeholders.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProfileSkeleton, { SkeletonSection } from './ProfileSkeleton';

describe('ProfileSkeleton', () => {
  it('announces the busy state once and hides decorative blocks', () => {
    const { container } = render(<ProfileSkeleton lang="ht" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Ap chaje pwofil la');
    expect(container.querySelector('.csp-skel-rail')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.csp-skel-sidebar')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.csp-skel-cover')).toBeTruthy();
    expect(container.querySelectorAll('.csp-skel-tab')).toHaveLength(5);
  });

  it('renders the requested number of content card placeholders', () => {
    const { container } = render(<SkeletonSection count={4} />);
    expect(container.querySelectorAll('.csp-skeleton-card')).toHaveLength(4);
    expect(container.querySelector('.csp-skeleton-grid')).toHaveAttribute('aria-hidden', 'true');
  });
});
