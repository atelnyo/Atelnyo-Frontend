import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import AchievementCard from './AchievementCard';

const BASE = {
  user: { username: 'jan' },
  achievement_type: 'badge_earned',
  title: 'Premye badge',
  description: 'Ou gen yon nouvo badge.',
  icon: 'fa-medal',
  color: '#fbbf24',
};

describe('AchievementCard', () => {
  it('renders a semantic time element with French relative time', () => {
    const createdAt = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    const { container } = render(
      <AchievementCard achievement={{ ...BASE, created_at: createdAt }} lang="fr" />,
    );

    const time = container.querySelector('time');
    expect(time).toBeTruthy();
    expect(time.getAttribute('datetime')).toBe(createdAt);
    expect(time.textContent).toContain('il y a 2 h');
  });

  it('labels a featured achievement for assistive tech', () => {
    render(
      <AchievementCard
        achievement={{ ...BASE, is_featured: true, created_at: new Date().toISOString() }}
        lang="es"
      />,
    );

    expect(screen.getByRole('img', { name: 'Logro destacado' })).toBeTruthy();
  });

  it('omits the timestamp when the date is invalid', () => {
    const { container } = render(
      <AchievementCard achievement={{ ...BASE, created_at: 'not-a-date' }} lang="en" />,
    );

    expect(container.querySelector('time')).toBeNull();
  });
});
