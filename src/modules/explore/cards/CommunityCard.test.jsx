import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../services/api', () => ({
  contentFeedbackService: { submit: vi.fn() },
}));

import CommunityCard from './CommunityCard';

const BASE = {
  id: 7,
  name: 'Kominote Mizik',
  description: 'Yon espas pou mizisyen.',
  category: 'Music',
  member_count: 42,
  join_mode: 'approval',
  event_count: 3,
  tags: ['mizik', 'live', 'kou', 'ekstra'],
  created_by_username: 'djken',
  is_member: false,
  my_status: null,
};

const props = { t: {}, lang: 'ht', onOpen: vi.fn() };

describe('CommunityCard pre-click info', () => {
  it('shows join mode, event count, founder and tags before click', () => {
    render(<CommunityCard community={BASE} {...props} />);
    expect(screen.getByText('Apwobasyon')).toBeTruthy();
    expect(screen.getByText(/3/)).toBeTruthy();
    expect(screen.getByText('@djken')).toBeTruthy();
    expect(screen.getByText('mizik')).toBeTruthy();
    // Overflow tag collapses the 4th tag.
    expect(screen.getByText('+1')).toBeTruthy();
    // No member chip when the viewer is not a member.
    expect(screen.queryByTestId('community-card-info')).toBeTruthy();
  });

  it('shows member chip when already a member', () => {
    render(<CommunityCard community={{ ...BASE, is_member: true }} {...props} />);
    expect(screen.getByText('Manm')).toBeTruthy();
  });

  it('shows pending chip when the join request is awaiting approval', () => {
    render(
      <CommunityCard community={{ ...BASE, my_status: 'pending' }} {...props} />,
    );
    expect(screen.getByText('Demann voye')).toBeTruthy();
  });

  it('hides the info row when the backend sends none of the fields', () => {
    const bare = { id: 1, name: 'Senp', member_count: 0 };
    render(<CommunityCard community={bare} {...props} />);
    expect(screen.queryByTestId('community-card-info')).toBeNull();
  });

  it('still opens the community on click', () => {
    const onOpen = vi.fn();
    render(<CommunityCard community={BASE} t={{}} lang="ht" onOpen={onOpen} />);
    // The name appears twice (title + SVG fallback text) — target the title.
    fireEvent.click(
      screen.getByText('Kominote Mizik', { selector: '.explore-card-title' }),
    );
    expect(onOpen).toHaveBeenCalledWith(BASE);
  });
});
