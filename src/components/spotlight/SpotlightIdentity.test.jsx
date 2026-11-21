import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import api from '../../services/api';
import SpotlightIdentity from './SpotlightIdentity';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn() },
}));

const IDENTITY = {
  user: { username: 'jan', display_name: 'Jan Kreyòl', avatar_url: '' },
  identity: {
    total_achievements: 12,
    badges_earned: 4,
    courses_completed: 3,
    reviews_received: 5,
    total_followers: 42,
    trust_score: 72,
    is_verified_creator: true,
    spotlight_approved: true,
  },
  recent_achievements: [],
};

const ACHIEVEMENT = {
  id: 1,
  achievement_type: 'badge_earned',
  title: 'Premye badge',
  icon: 'fa-medal',
  color: '#fbbf24',
  created_at: new Date().toISOString(),
};

function renderPage(lang = 'ht') {
  return render(
    <MemoryRouter initialEntries={['/sheet/spotlight/identity/jan']}>
      <Routes>
        <Route
          path="/sheet/spotlight/identity/:username"
          element={<SpotlightIdentity lang={lang} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function mockApi({ identity } = {}) {
  api.get.mockImplementation((url, config) => {
    if (String(url).includes('achievements/identity/')) {
      return identity ? identity() : Promise.resolve({ data: IDENTITY });
    }
    const type = config?.params?.type;
    return Promise.resolve({ data: { results: type ? [] : [ACHIEVEMENT] } });
  });
}

beforeEach(() => {
  api.get.mockReset();
  mockApi();
});

describe('SpotlightIdentity', () => {
  it('renders the header, trust score, stats and achievements', async () => {
    renderPage();

    expect(await screen.findByText('Jan Kreyòl')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith(
      'spotlight/achievements/identity/jan/',
    );
    expect(screen.getByRole('img', { name: '72 / 100 · Fyab' })).toBeTruthy();
    expect(screen.getByText('Kou fini')).toBeTruthy();
    expect(screen.getByText('Swivè')).toBeTruthy();
    expect(screen.getByText('Premye badge')).toBeTruthy();
    expect(screen.getAllByText('Verifye').length).toBeGreaterThan(0);
  });

  it('filters achievements without refetching the identity and shows a filtered empty state', async () => {
    renderPage();
    await screen.findByText('Jan Kreyòl');

    await userEvent.click(screen.getByRole('button', { name: 'Kou' }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('spotlight/achievements/', {
        params: { user: 'jan', type: 'course_completed' },
      });
    });

    expect(
      screen.getByText('Pa gen reyalizasyon nan kategori sa a.'),
    ).toBeTruthy();
    expect(screen.queryByText('Premye badge')).toBeNull();

    const identityCalls = api.get.mock.calls.filter(([url]) =>
      String(url).includes('achievements/identity/'),
    );
    expect(identityCalls).toHaveLength(1);
  });

  it('retries the identity request when it fails', async () => {
    let attempts = 0;
    mockApi({
      identity: () => {
        attempts += 1;
        return attempts === 1
          ? Promise.reject(new Error('network'))
          : Promise.resolve({ data: IDENTITY });
      },
    });

    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Nou pa t kapab chaje idantite a.');

    await userEvent.click(screen.getByRole('button', { name: 'Eseye ankò' }));

    expect(await screen.findByText('Jan Kreyòl')).toBeTruthy();
    expect(attempts).toBe(2);
  });

  it('localizes the page in Spanish', async () => {
    renderPage('es');

    expect(await screen.findByText('Logros')).toBeTruthy();
    expect(screen.getByText('Seguidores')).toBeTruthy();
    expect(screen.getByRole('img', { name: '72 / 100 · Confiable' })).toBeTruthy();
  });
});
