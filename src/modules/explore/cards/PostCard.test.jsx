import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../services/api', () => ({
  contentFeedbackService: {
    hide: vi.fn(),
    notInterested: vi.fn(),
    muteCreator: vi.fn(),
    blockCreator: vi.fn(),
    report: vi.fn(),
  },
}));

import PostCard from './PostCard';

const POST = {
  id: 41,
  body: 'Bonjou Atelnyo, men yon pòs kominote.',
  author_username: 'atelnyo',
};

describe('PostCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the post body and author', () => {
    const { container } = render(<PostCard post={POST} />);

    expect(screen.getByText(POST.body)).toBeTruthy();
    expect(container.querySelector('.explore-card-tag').textContent).toContain('atelnyo');
  });

  it('opens the post from one accessible overlay button', async () => {
    const onOpen = vi.fn();
    render(<PostCard post={POST} onOpen={onOpen} />);

    const openButton = screen.getByRole('button', { name: POST.body });
    await userEvent.click(openButton);

    expect(onOpen).toHaveBeenCalledWith(POST);
  });

  it('does not nest the feedback menu inside the open button', () => {
    const { container } = render(<PostCard post={POST} />);
    const openButton = container.querySelector('.explore-card-open');
    const menuButton = screen.getByTestId('content-feedback-menu-41');

    expect(openButton.contains(menuButton)).toBe(false);
    expect(container.querySelector('.explore-card-open button')).toBeNull();
  });

  it('passes the card language to the feedback menu', async () => {
    render(<PostCard post={POST} lang="es" />);

    await userEvent.click(screen.getByRole('button', { name: /más opciones/i }));
    expect(screen.getByRole('menu', { name: /más opciones/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /no me interesa/i })).toBeTruthy();
  });

  it('does not report a card open when the menu is used', async () => {
    const onOpen = vi.fn();
    render(<PostCard post={POST} lang="ht" onOpen={onOpen} />);

    await userEvent.click(screen.getByRole('button', { name: /plis opsyon/i }));
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.getByRole('menuitem', { name: /pa enterese/i })).toBeTruthy();
  });
});
