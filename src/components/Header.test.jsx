// @vitest-environment jsdom
/**
 * Header — direct-message badge.
 *
 * The badge reads the same participant-scoped unread count the inbox uses,
 * so a profile message or a reply shows up without opening the inbox. It
 * must disappear at zero instead of rendering an empty pill.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const unreadCount = vi.fn();

vi.mock('../services/api', () => ({
  creatorProfileService: { get: vi.fn().mockResolvedValue({ data: {} }) },
  enrollmentService: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
  messagesService: { unreadCount: (...args) => unreadCount(...args) },
}));

import Header from './Header';

const TRANSLATIONS = { en: {}, ht: {}, fr: {}, es: {} };

function renderHeader() {
  return render(
    <MemoryRouter>
      <Header
        lang="en"
        translations={TRANSLATIONS}
        toggleTheme={() => {}}
        darkMode={false}
        user={{ id: 1, username: 'kania' }}
        onLogout={() => {}}
        onLangChange={() => {}}
      />
    </MemoryRouter>,
  );
}

describe('Header — messages badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the unread message count', async () => {
    unreadCount.mockResolvedValue({ data: { unread_count: 3 } });

    renderHeader();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /3 new messages/i }),
      ).toBeTruthy();
    });
  });

  it('hides the badge when nothing is unread', async () => {
    unreadCount.mockResolvedValue({ data: { unread_count: 0 } });

    renderHeader();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /0 new messages/i }),
      ).toBeTruthy();
    });
    expect(screen.queryByText('0')).toBeNull();
  });
});
