// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { homeMock } = vi.hoisted(() => ({ homeMock: vi.fn() }));

vi.mock('../../../services/api', () => ({
  feedService: { home: homeMock },
  getAnonKey: () => null,
}));

import HomeFeed from './HomeFeed';

describe('HomeFeed loading', () => {
  beforeEach(() => {
    homeMock.mockReset();
  });

  it('requests the backend home feed and announces the skeleton', async () => {
    homeMock.mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <HomeFeed lang="ht" translations={{ ht: {} }} />
      </MemoryRouter>,
    );

    const skeleton = screen.getByTestId('home-feed-skeleton');
    expect(skeleton).toHaveAttribute('role', 'status');
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
    expect(skeleton).toHaveAttribute('aria-label', 'Ap chaje flux la…');

    await waitFor(() => expect(homeMock).toHaveBeenCalledWith(6, 'home'));
  });
});
