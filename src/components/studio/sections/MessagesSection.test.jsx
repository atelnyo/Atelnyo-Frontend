// @vitest-environment jsdom
/**
 * MessagesSection — inbox skeleton + reply templates.
 *
 * The inbox is a conversation list plus a chat pane, so its loading state
 * must copy that geometry. Reply templates insert canned text into the
 * draft (never send it) so the creator can edit before sending.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const get = vi.fn();
const post = vi.fn();

vi.mock('../../../services/api', () => ({
  default: {
    get: (...args) => get(...args),
    post: (...args) => post(...args),
  },
}));

import MessagesSection from './MessagesSection';

const CONV = {
  id: 5,
  participant_id: 9,
  participant_name: 'Alice',
  unread_count: 1,
  last_message: 'sali',
  last_message_at: new Date().toISOString(),
};

describe('MessagesSection — inbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a layout skeleton while the inbox loads', () => {
    get.mockReturnValue(new Promise(() => {}));

    render(<MessagesSection lang="en" t={{}} />);

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
  });

  it('inserts a reply template into the composer without sending it', async () => {
    get.mockImplementation((url) => Promise.resolve({
      data: url.endsWith('/messages/') ? [] : [CONV],
    }));

    render(<MessagesSection lang="en" t={{}} />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy());

    fireEvent.click(screen.getByText('Alice'));
    await waitFor(() => expect(screen.getByRole('textbox')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /reply templates/i }));
    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.click(screen.getByRole('menuitem', { name: /thanks for your message/i }));

    expect(screen.getByRole('textbox').value)
      .toBe('Thanks for your message. I will reply as soon as I can.');
    expect(post).not.toHaveBeenCalled();
  });
});
