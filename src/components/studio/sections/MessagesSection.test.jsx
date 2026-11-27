// @vitest-environment jsdom
/**
 * MessagesSection — inbox skeleton + reply templates.
 *
 * Built-in replies ship with the app; a creator's saved replies come from
 * /api/messages/templates/ and are owner scoped. Both insert text into the
 * draft (never send it). Saving the draft creates a template; deleting one
 * removes it locally at once.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const get = vi.fn();
const post = vi.fn();
const templates = vi.fn();
const createTemplate = vi.fn();
const updateTemplate = vi.fn();
const deleteTemplate = vi.fn();
const markAllRead = vi.fn();

vi.mock('../../../services/api', () => ({
  default: {
    get: (...args) => get(...args),
    post: (...args) => post(...args),
  },
  messagesService: {
    templates: (...args) => templates(...args),
    createTemplate: (...args) => createTemplate(...args),
    updateTemplate: (...args) => updateTemplate(...args),
    deleteTemplate: (...args) => deleteTemplate(...args),
    markAllRead: (...args) => markAllRead(...args),
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

const SAVED = { id: 1, title: 'My price', body: 'The price is $50.' };

async function openConversation() {
  get.mockImplementation((url) => Promise.resolve({
    data: url.endsWith('/messages/') ? [] : [CONV],
  }));
  render(<MessagesSection lang="en" t={{}} />);
  await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy());
  fireEvent.click(screen.getByText('Alice'));
  await waitFor(() => expect(screen.getByRole('textbox')).toBeTruthy());
}

describe('MessagesSection — inbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    templates.mockResolvedValue({ data: { results: [] } });
    createTemplate.mockResolvedValue({ data: SAVED });
    updateTemplate.mockResolvedValue({ data: { ...SAVED, title: 'Pricing' } });
    deleteTemplate.mockResolvedValue({ data: {} });
    markAllRead.mockResolvedValue({ data: { marked_read: 1, unread_count: 0 } });
  });

  it('shows a layout skeleton while the inbox loads', () => {
    get.mockReturnValue(new Promise(() => {}));

    render(<MessagesSection lang="en" t={{}} />);

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
  });

  it('returns from a thread to the conversation list (mobile back)', async () => {
    await openConversation();

    // The back control is the phone-only way out of a thread — the list
    // is hidden behind the chat pane on narrow screens.
    expect(screen.getByRole('button', { name: /back to conversations/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /back to conversations/i }));

    expect(screen.getByText('Select a conversation')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('clears the whole inbox unread state in one tap', async () => {
    get.mockImplementation((url) => Promise.resolve({
      data: url.endsWith('/messages/') ? [] : [CONV],
    }));
    render(<MessagesSection lang="en" t={{}} />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /mark all as read/i }));

    await waitFor(() => expect(markAllRead).toHaveBeenCalledTimes(1));
    // Badge + button disappear together — both read from unreadTotal.
    await waitFor(() => expect(
      screen.queryByRole('button', { name: /mark all as read/i }),
    ).toBeNull());
  });

  it('filters the inbox as you type', async () => {
    const bob = {
      ...CONV,
      id: 6,
      participant_id: 10,
      participant_name: 'Bob Ménard',
      unread_count: 0,
      last_message: 'hey',
    };
    get.mockImplementation((url) => Promise.resolve({
      data: url.endsWith('/messages/') ? [] : [CONV, bob],
    }));
    render(<MessagesSection lang="en" t={{}} />);
    await waitFor(() => expect(screen.getByText('Bob Ménard')).toBeTruthy());

    // Accent-folded: "menard" still finds "Ménard".
    fireEvent.change(screen.getByRole('searchbox', { name: /search conversations/i }), {
      target: { value: 'menard' },
    });

    expect(screen.getByText('Bob Ménard')).toBeTruthy();
    expect(screen.queryByText('Alice')).toBeNull();
  });

  it('says so when nothing matches the search', async () => {
    get.mockImplementation((url) => Promise.resolve({
      data: url.endsWith('/messages/') ? [] : [CONV],
    }));
    render(<MessagesSection lang="en" t={{}} />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy());

    fireEvent.change(screen.getByRole('searchbox', { name: /search conversations/i }), {
      target: { value: 'zzz' },
    });

    expect(screen.getByText(/no conversations match your search/i)).toBeTruthy();
  });

  it('draws a day divider only where the day changes', async () => {
    const thread = [
      { id: 1, sender_id: 9, body: 'Bonjou', created_at: '2026-01-05T10:00:00Z' },
      { id: 2, sender_id: 9, body: 'Toujou la', created_at: '2026-01-05T11:00:00Z' },
      { id: 3, sender_id: 480018, body: 'Wi', created_at: '2026-01-07T09:00:00Z' },
    ];
    get.mockImplementation((url) => Promise.resolve({
      data: url.endsWith('/messages/') ? thread : [CONV],
    }));
    render(<MessagesSection lang="en" t={{}} />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy());
    fireEvent.click(screen.getByText('Alice'));

    await waitFor(() => expect(screen.getByText('Bonjou')).toBeTruthy());
    expect(screen.getAllByRole('separator')).toHaveLength(2);
  });

  it('loads older messages page by page', async () => {
    const page = Array.from({ length: 50 }, (_, i) => ({
      id: i + 10,
      sender_id: 9,
      body: `msg ${i}`,
      created_at: new Date(Date.UTC(2026, 0, 2, 0, i)).toISOString(),
    }));
    const olderPage = [
      { id: 2, sender_id: 9, body: 'older one', created_at: '2026-01-01T10:00:00Z' },
      { id: 3, sender_id: 9, body: 'older two', created_at: '2026-01-01T11:00:00Z' },
    ];
    get.mockImplementation((url, config) => {
      if (url.includes('/messages/')) {
        return Promise.resolve({ data: config?.params?.before ? olderPage : page });
      }
      return Promise.resolve({ data: [CONV] });
    });
    render(<MessagesSection lang="en" t={{}} />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy());
    fireEvent.click(screen.getByText('Alice'));

    fireEvent.click(await screen.findByRole('button', { name: /load older messages/i }));

    await waitFor(() => expect(screen.getByText('older one')).toBeTruthy());
    expect(get).toHaveBeenCalledWith('messages/conversations/5/messages/', {
      params: { limit: 50, before: 10 },
    });
    // A short page means the top of the thread was reached.
    await waitFor(() => expect(
      screen.queryByRole('button', { name: /load older messages/i }),
    ).toBeNull());
  });

  it('invites a first message when the thread is empty', async () => {
    await openConversation();

    expect(screen.getByText(/no messages in this conversation yet/i)).toBeTruthy();
  });

  it("renames one of the creator's saved replies", async () => {
    templates.mockResolvedValue({ data: { results: [SAVED] } });
    await openConversation();

    fireEvent.click(screen.getByRole('button', { name: /reply templates/i }));
    fireEvent.click(screen.getByRole('button', { name: /edit template: my price/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /template title/i }), {
      target: { value: 'Pricing' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save title/i }));

    await waitFor(() => expect(updateTemplate).toHaveBeenCalledWith(1, { title: 'Pricing' }));
    expect(screen.getByRole('menuitem', { name: /pricing/i })).toBeTruthy();
  });

  it('inserts a built-in reply into the composer without sending it', async () => {
    await openConversation();

    fireEvent.click(screen.getByRole('button', { name: /reply templates/i }));
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: /thanks for your message/i }));

    expect(screen.getByRole('textbox').value)
      .toBe('Thanks for your message. I will reply as soon as I can.');
    expect(post).not.toHaveBeenCalled();
  });

  it("inserts one of the creator's saved replies", async () => {
    templates.mockResolvedValue({ data: { results: [SAVED] } });
    await openConversation();

    fireEvent.click(screen.getByRole('button', { name: /reply templates/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /my price/i }));

    expect(screen.getByRole('textbox').value).toBe('The price is $50.');
    expect(post).not.toHaveBeenCalled();
  });

  it('saves the current draft as a template', async () => {
    await openConversation();

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Thanks, your order shipped today' },
    });
    fireEvent.click(screen.getByRole('button', { name: /reply templates/i }));
    fireEvent.click(screen.getByRole('button', { name: /save this message as a template/i }));

    await waitFor(() => {
      expect(createTemplate).toHaveBeenCalledWith({
        title: 'Thanks, your order shipped',
        body: 'Thanks, your order shipped today',
      });
    });
  });

  it("deletes one of the creator's saved replies", async () => {
    templates.mockResolvedValue({ data: { results: [SAVED] } });
    await openConversation();

    fireEvent.click(screen.getByRole('button', { name: /reply templates/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete template: my price/i }));

    await waitFor(() => expect(deleteTemplate).toHaveBeenCalledWith(1));
  });
});
