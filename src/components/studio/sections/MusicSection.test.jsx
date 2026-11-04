import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../services/api', () => ({
  exploreService: { music: vi.fn() },
  musicService: { delete: vi.fn() },
}));

import { exploreService, musicService } from '../../../services/api';
import MusicSection from './MusicSection';

const TRACKS = [
  { id: 1, title: 'Track A', artist: 'Singer' },
  { id: 2, title: 'Track B', artist: 'Singer' },
];

const props = { lang: 'ht', t: {}, showToast: vi.fn(), setShowMusicModal: vi.fn() };

describe('MusicSection optimistic delete', () => {
  it('removes the row instantly on confirm, before the server answers', async () => {
    exploreService.music
      .mockResolvedValueOnce({ data: TRACKS })
      .mockResolvedValue({ data: [TRACKS[1]] });
    let resolveDelete;
    musicService.delete.mockImplementation(
      () => new Promise((resolve) => { resolveDelete = resolve; }),
    );

    render(<MusicSection {...props} />);
    expect(await screen.findByText('Track A')).toBeTruthy();

    // Open the confirm dialog for Track A.
    fireEvent.click(screen.getAllByTitle('Efase')[0]);
    expect(await screen.findByText(/sèten ou vle efase/)).toBeTruthy();

    // Confirm — the row must vanish IMMEDIATELY (no waiting on the server).
    // (getByText full-matches one element: the row. The modal message is a
    // longer sentence, so it never matches 'Track A' on its own.)
    fireEvent.click(screen.getByRole('button', { name: 'Wi, efase' }));
    await waitFor(() => expect(screen.queryByText('Track A')).toBeNull());
    expect(screen.getByText('Track B')).toBeTruthy();
    expect(musicService.delete).toHaveBeenCalledTimes(1);

    // The pending server call finally succeeds — the row stays gone.
    await act(async () => { resolveDelete({}); });
    await waitFor(() => expect(exploreService.music).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Track A')).toBeNull();
  });

  it('restores the row when the server delete fails', async () => {
    exploreService.music.mockResolvedValue({ data: TRACKS });
    musicService.delete.mockRejectedValueOnce(new Error('boom'));

    render(<MusicSection {...props} />);
    expect(await screen.findByText('Track A')).toBeTruthy();

    fireEvent.click(screen.getAllByTitle('Efase')[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Wi, efase' }));

    // Optimistic removal first…
    await waitFor(() => expect(screen.queryByText('Track A')).toBeNull());
    // …then the failed delete refetches from the server, restoring the row.
    await waitFor(() => expect(screen.getByText('Track A')).toBeTruthy());
  });
});
