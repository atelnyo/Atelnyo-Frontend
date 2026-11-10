import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  next: vi.fn(),
  start: vi.fn(),
  complete: vi.fn(),
}));

vi.mock('../../services/api', () => ({ rewardedAdService: service }));

import RewardedHeartOffer from './RewardedHeartOffer';

describe('RewardedHeartOffer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.next.mockResolvedValue({
      data: {
        available: true,
        promotion: {
          id: 8,
          title: 'Learn something',
          video_url: 'https://cdn.example/ad.mp4',
          destination_url: '',
        },
      },
    });
    service.start.mockResolvedValue({
      data: {
        watch_id: 'watch-1',
        promotion: {
          id: 8,
          title: 'Learn something',
          video_url: 'https://cdn.example/ad.mp4',
          destination_url: '',
        },
      },
    });
    service.complete.mockResolvedValue({
      data: { awarded: true, gamification: { hearts: 1 } },
    });
  });

  it('awards the server-confirmed heart after the video ends', async () => {
    const onGamification = vi.fn();
    render(
      <RewardedHeartOffer
        lang="en"
        hearts={0}
        heartsUnlimited={false}
        onGamification={onGamification}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /watch video for 1 heart/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.ended(dialog.querySelector('video'));

    await waitFor(() => {
      expect(service.complete).toHaveBeenCalledWith('watch-1');
      expect(onGamification).toHaveBeenCalledWith({ hearts: 1 });
    });
    expect(await screen.findByText(/you earned 1 heart/i)).toBeInTheDocument();
  });

  it('does not request an ad for a learner who already has hearts', () => {
    const { container } = render(
      <RewardedHeartOffer lang="en" hearts={2} heartsUnlimited={false} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(service.next).not.toHaveBeenCalled();
  });
});
