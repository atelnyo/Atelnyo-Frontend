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
const deleteTemplate = vi.fn();

vi.mock('../../../services/api', () => ({
  default: {
    get: (...args) => get(...args),
    post: (...args) => post(...args),
  },
  messagesService: {
    templates: (...args) => templates(...args),
    createTemplate: (...args) => createTemplate(...args),
    deleteTemplate: (...args) => deleteTemplate(...args),
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
    deleteTemplate.mockResolvedValue({ data: {} });
  });

  it('shows a layout skeleton while the inbox loads', () => {
    get.mockReturnValue(new Promise(() => {}));

    render(<MessagesSection lang="en" t={{}} />);

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
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
