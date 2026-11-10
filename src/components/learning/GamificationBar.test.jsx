import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GamificationBar from './GamificationBar';

const rewardedAdService = vi.hoisted(() => ({
  next: vi.fn().mockResolvedValue({ data: { available: false, reason: 'no_ads' } }),
  start: vi.fn(),
  complete: vi.fn(),
}));

vi.mock('../../services/api', () => ({ rewardedAdService }));

const EMPTY_STATS = {
  hearts: 0,
  hearts_max: 5,
  hearts_unlimited: false,
};

describe('GamificationBar empty-heart state', () => {
  it('explains the zero-heart state and shows when no promoted video is available', async () => {
    render(<GamificationBar stats={EMPTY_STATS} lang="en" />);

    expect(await screen.findByText(/out of hearts/i)).toBeInTheDocument();
    expect(await screen.findByText(/no promotional videos/i)).toBeInTheDocument();
    expect(rewardedAdService.next).toHaveBeenCalledOnce();
  });

  it('does not show the refill action for unlimited-heart users', () => {
    render(
      <GamificationBar
        stats={{ ...EMPTY_STATS, hearts: 5, hearts_unlimited: true }}
        lang="en"
      />,
    );

    expect(screen.queryByRole('button', { name: /watch video/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/unlimited hearts/i)).toBeInTheDocument();
  });
});
