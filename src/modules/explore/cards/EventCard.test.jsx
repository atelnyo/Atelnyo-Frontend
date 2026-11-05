import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../services/api', () => ({
  eventsService: { ticket: vi.fn() },
}));

import EventCard from './EventCard';

const BASE = {
  id: 11,
  title: 'Konse Mizik Live',
  description: 'Yon sware mizik anba zetwal yo.',
  tags: ['mizik', 'live', 'deyo', 'ekstra'],
  start_time: '2026-12-20T19:00:00Z',
  end_time: '2026-12-20T22:00:00Z',
  location: 'Pòtoprens',
  is_online: false,
  community_name: 'Kominote Mizik',
  community_slug: 'kominote-mizik',
  attendee_count: 5,
  max_attendees: 100,
  is_free: false,
  price: 500,
  currency: 'HTG',
  status: 'published',
  has_ticket: false,
};

const props = { t: {}, lang: 'ht', user: { id: 1 }, showToast: vi.fn() };

describe('EventCard pre-click info', () => {
  it('shows description, end time and tags before click', () => {
    render(<EventCard event={BASE} {...props} />);
    expect(screen.getByText('Yon sware mizik anba zetwal yo.')).toBeTruthy();
    expect(screen.getByText('mizik')).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy();
    // End time follows the start time after the arrow separator.
    expect(screen.getByText('→')).toBeTruthy();
  });

  it('prices the ticket in the event currency instead of hardcoded $', () => {
    render(<EventCard event={BASE} {...props} />);
    expect(screen.getByText('G500.00')).toBeTruthy();
    expect(screen.queryByText('$500.00')).toBeNull();
  });

  it('flags cancelled events and hides the buy button', () => {
    render(<EventCard event={{ ...BASE, status: 'cancelled' }} {...props} />);
    expect(screen.getByText('Anile')).toBeTruthy();
    expect(screen.queryByText('G500.00')).toBeNull();
  });

  it('still offers RSVP on free upcoming events', () => {
    render(
      <EventCard event={{ ...BASE, is_free: true, price: 0 }} {...props} />,
    );
    expect(screen.getByText('RSVP')).toBeTruthy();
  });
});
