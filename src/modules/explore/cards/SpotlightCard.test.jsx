import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../services/api', () => ({
  savedItemService: {
    count: vi.fn(() => Promise.resolve(0)),
    isSaved: vi.fn(() => Promise.resolve(false)),
    create: vi.fn(() => Promise.resolve({})),
    remove: vi.fn(() => Promise.resolve({})),
  },
}));

import { savedItemService } from '../../../services/api';
import SpotlightCard from './SpotlightCard';

const ITEM = {
  id: 12,
  invention_title: 'Lamp Solè',
  invention_description: 'Yon lamp ki mache ak enèji solèy pou zòn ki pa gen kouran.',
  category: 'other',
  username: 'jan',
  display_name: 'Jan Kreyòl',
  avatar_url: '',
  link_url: 'https://example.com/demo',
  view_count: 42,
  share_count: 7,
};

const BASE_PROPS = { t: {}, lang: 'ht' };

describe('SpotlightCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savedItemService.count.mockResolvedValue(0);
    savedItemService.isSaved.mockResolvedValue(false);
    savedItemService.create.mockResolvedValue({});
    savedItemService.remove.mockResolvedValue({});
  });

  it('renders the invention, author and engagement counters', () => {
    render(<SpotlightCard item={ITEM} {...BASE_PROPS} />);

    expect(screen.getByText('Lamp Solè')).toBeTruthy();
    expect(screen.getByText('Jan Kreyòl')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
  });

  it('opens from one accessible overlay button', async () => {
    const onOpen = vi.fn();
    render(<SpotlightCard item={ITEM} onOpen={onOpen} {...BASE_PROPS} />);

    await userEvent.click(screen.getByRole('button', { name: 'Lamp Solè' }));

    expect(onOpen).toHaveBeenCalledWith(ITEM);
  });

  it('saves the spotlight from the rail for a signed-in viewer', async () => {
    render(
      <SpotlightCard item={ITEM} user={{ id: 1 }} showToast={vi.fn()} {...BASE_PROPS} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() =>
      expect(savedItemService.create).toHaveBeenCalledWith('spotlight', 12),
    );
  });

  it('asks anonymous visitors to sign in instead of saving', async () => {
    const showToast = vi.fn();
    render(<SpotlightCard item={ITEM} showToast={showToast} {...BASE_PROPS} />);

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(savedItemService.create).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Sign in to save', 'user-lock');
  });

  it('keeps the external CTA safe and does not open the card', async () => {
    const onOpen = vi.fn();
    render(<SpotlightCard item={ITEM} onOpen={onOpen} {...BASE_PROPS} />);

    const link = screen.getByRole('link', { name: /open external: lamp solè/i });
    expect(link.getAttribute('href')).toBe('https://example.com/demo');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.getAttribute('rel')).toContain('noreferrer');

    await userEvent.click(link);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('hides the counters when the payload has no engagement yet', () => {
    const { container } = render(
      <SpotlightCard item={{ ...ITEM, view_count: 0, share_count: 0 }} {...BASE_PROPS} />,
    );
    expect(container.querySelector('.spotlight-card-stats')).toBeNull();
  });
});
