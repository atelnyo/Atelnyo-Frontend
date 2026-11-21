import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

const POSTS = [
  {
    id: 1, content: 'Bonjou tout moun!', image_url: '', is_pinned: false,
    author: 9, author_username: 'manm1', reaction_count: 2,
    reactions: { '❤️': 2 }, my_reaction: '❤️', created_at: '2026-11-01T10:00:00Z',
  },
];

vi.mock('../../services/api', () => ({
  default: { post: vi.fn(), get: vi.fn() },
  communitiesService: {
    posts: vi.fn(),
    getPost: vi.fn(),
    get: vi.fn(),
    getSEO: vi.fn(),
    createPost: vi.fn(),
    updatePost: vi.fn(),
    deletePost: vi.fn(),
    reactToPost: vi.fn(),
    postComments: vi.fn(),
    createComment: vi.fn(),
    deleteComment: vi.fn(),
    announcements: vi.fn(),
  },
  communityEventsService: { list: vi.fn() },
  eventsService: { ticket: vi.fn(), cancelRSVP: vi.fn() },
}));

import api, { communitiesService, communityEventsService, eventsService } from '../../services/api';
import CommunityPosts from './CommunityPosts';
import CommunityDetail, {
  CommunityDescription, CommunityEvents, CommunityHome, CommunityRulesTab,
} from '../CommunityDetail';

function Harness({ community, user, entry = '/community/test/posts', onPostCountChange }) {
  return (
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/community/:slug/posts"
          element={<Outlet context={{ community, lang: 'ht', t: {}, user, showToast: vi.fn(), onPostCountChange }} />}
        >
          <Route index element={<CommunityPosts />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

const MEMBER_COMM = { slug: 'test', is_member: true, current_user_role: 'member' };
const USER = { id: 9, username: 'manm1' };

beforeEach(() => {
  vi.clearAllMocks();
  communitiesService.get.mockResolvedValue({
    data: {
      id: 1, slug: 'test', name: 'Test community', description: 'Short description.',
      member_count: 1, is_member: true, current_user_role: 'member',
      join_mode: 'public', rules: [],
    },
  });
  communitiesService.getSEO.mockResolvedValue({ data: { status: 'not_ready' } });
  communitiesService.posts.mockResolvedValue({ data: POSTS });
  communityEventsService.list.mockResolvedValue({ data: [] });
  eventsService.ticket.mockResolvedValue({ data: { id: 21, status: 'confirmed' } });
  eventsService.cancelRSVP.mockResolvedValue({ data: { attendee_count: 4 } });
  communitiesService.announcements.mockResolvedValue({ data: [] });
  api.get.mockResolvedValue({ data: null });
});

describe('Community surfaces', () => {
  it('prefills a first-post draft when the welcome checklist says introduce yourself', async () => {
    render(<Harness community={MEMBER_COMM} user={USER} entry="/community/test/posts?compose=intro" />);

    const input = await screen.findByTestId('post-composer-input');
    await waitFor(() => expect(input.value).toContain('manm1'));
    expect(input.value).toContain('Bonjou tout moun');
    expect(input.value).toContain('• Sa m vin chèche isit la:');
  });

  it('makes the post composer clear and easy to find from the community home', async () => {
    render(
      <MemoryRouter initialEntries={['/community/test/home']}>
        <Routes>
          <Route
            path="/community/test/home"
            element={<Outlet context={{ community: MEMBER_COMM, lang: 'en' }} />}
          >
            <Route index element={<CommunityHome />} />
          </Route>
          <Route path="/community/test/posts" element={<div>Posts feed</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByTestId('community-home-compose'));
    expect(await screen.findByText('Posts feed')).toBeTruthy();
  });

  it('keeps the home rules preview and the full rules tab on one ordered source', async () => {
    const community = {
      ...MEMBER_COMM,
      rules: [
        { id: 1, order: 2, title: 'Third rule' },
        { id: 2, order: 0, title: 'First rule', description: 'Start here.' },
        { id: 3, order: 1, title: 'Second rule' },
        { id: 4, order: 3, title: 'Fourth rule' },
      ],
    };

    render(
      <MemoryRouter initialEntries={['/community/test/home']}>
        <Routes>
          <Route
            path="/community/test/home"
            element={<Outlet context={{ community, lang: 'en' }} />}
          >
            <Route index element={<CommunityHome />} />
          </Route>
          <Route
            path="/community/test/rules"
            element={<Outlet context={{ community, lang: 'en' }} />}
          >
            <Route index element={<CommunityRulesTab />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const preview = await screen.findByTestId('community-rules-preview');
    const previewItems = within(preview).getAllByRole('listitem');
    expect(previewItems).toHaveLength(3);
    expect(previewItems[0]).toHaveTextContent('First rule');
    expect(previewItems[1]).toHaveTextContent('Second rule');
    expect(previewItems[2]).toHaveTextContent('Third rule');
    // Exactly one rule remains: localized singular, not "+1 more rules".
    expect(within(preview).getByRole('button', { name: '+1 rule' })).toBeTruthy();

    fireEvent.click(within(preview).getByRole('button', { name: /View all rules/ }));

    const full = await screen.findByTestId('community-rules-full');
    expect(full).toHaveTextContent('4 rules');
    const fullItems = within(full).getAllByRole('listitem');
    expect(fullItems).toHaveLength(4);
    expect(fullItems.map((item) => item.textContent)).toEqual([
      expect.stringContaining('First rule'),
      expect.stringContaining('Second rule'),
      expect.stringContaining('Third rule'),
      expect.stringContaining('Fourth rule'),
    ]);
  });

  it('shows visitors one contextual explainer without duplicating the header join action', async () => {
    const onJoin = vi.fn();
    render(
      <MemoryRouter initialEntries={['/community/test/home']}>
        <Routes>
          <Route
            path="/community/test/home"
            element={<Outlet context={{
              community: { slug: 'test', is_member: false, join_mode: 'open' },
              lang: 'ht',
              onJoin,
              canJoin: true,
            }} />}
          >
            <Route index element={<CommunityHome />} />
          </Route>
          <Route path="/community/test/posts" element={<div>Posts feed</div>} />
        </Routes>
      </MemoryRouter>,
    );

    const explainer = await screen.findByTestId('community-join-explainer');
    expect(within(explainer).getByTestId('community-join-explainer-status'))
      .toHaveTextContent('Antre ak bouton anwo a');

    // The header owns the single Join action; Home explains what joining
    // unlocks instead of rendering a second, competing Join button.
    expect(screen.queryByTestId('community-home-compose')).toBeNull();
    expect(screen.queryByTestId('community-join-explainer-cta')).toBeNull();
    expect(onJoin).not.toHaveBeenCalled();
    expect(screen.queryByText('Posts feed')).toBeNull();
  });

  it('previews pinned community announcements and links to the full list', async () => {
    communitiesService.announcements.mockResolvedValue({
      data: [
        { id: 1, title: 'Règ nouvo yo', content: 'Tanpri li règ kominote a.', is_pinned: false },
        { id: 2, title: 'Byenveni!', content: 'Nou kontan wè nou la.', is_pinned: true },
        { id: 3, title: 'Lòt anons', content: 'Sa a pa bezwen parèt sou akèy la.', is_pinned: false },
      ],
    });
    render(
      <MemoryRouter initialEntries={['/community/test/home']}>
        <Routes>
          <Route
            path="/community/test/home"
            element={<Outlet context={{ community: MEMBER_COMM, lang: 'ht' }} />}
          >
            <Route index element={<CommunityHome />} />
          </Route>
          <Route path="/community/test/announcements" element={<div>Anons yo</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('community-home-announcement-2')).toBeTruthy();
    expect(screen.getByTestId('community-home-announcement-1')).toBeTruthy();
    expect(screen.queryByTestId('community-home-announcement-3')).toBeNull();
    fireEvent.click(within(screen.getByRole('region', { name: 'Anons kominote a' }))
      .getByRole('button', { name: /Wè tout/ }));
    expect(await screen.findByText('Anons yo')).toBeTruthy();
  });

  it('lets members RSVP to a free event and updates the attendee count', async () => {
    communityEventsService.list.mockResolvedValue({
      data: [{
        id: 21,
        title: 'Atelye Konpa',
        status: 'published',
        start_time: '2027-01-15T18:00:00Z',
        end_time: '2027-01-15T20:00:00Z',
        is_free: true,
        price: 0,
        attendee_count: 4,
        max_attendees: 20,
        has_ticket: false,
      }],
    });
    const showToast = vi.fn();
    render(
      <MemoryRouter initialEntries={['/community/test/events']}>
        <Routes>
          <Route
            path="/community/test/events"
            element={<Outlet context={{
              community: MEMBER_COMM,
              lang: 'ht',
              user: USER,
              showToast,
            }} />}
          >
            <Route index element={<CommunityEvents />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Reponn' }));
    await waitFor(() => expect(eventsService.ticket).toHaveBeenCalledWith(21, 1));
    expect(await screen.findByText('Ap vini')).toBeTruthy();
    expect(screen.getByTestId('community-event-attendees-21')).toHaveTextContent('5');
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Ou reponn'), 'check-circle');
  });

  it('routes paid event tickets through the checkout modal instead of the RSVP endpoint', async () => {
    communityEventsService.list.mockResolvedValue({
      data: [{
        id: 31,
        title: 'Konsè peye',
        status: 'published',
        start_time: '2027-02-01T18:00:00Z',
        end_time: '2027-02-01T20:00:00Z',
        is_free: false,
        price: 25,
        currency: 'USD',
        attendee_count: 3,
        has_ticket: false,
      }],
    });
    const onOpenCheckout = vi.fn();
    render(
      <MemoryRouter initialEntries={['/community/test/events']}>
        <Routes>
          <Route
            path="/community/test/events"
            element={<Outlet context={{
              community: MEMBER_COMM,
              lang: 'en',
              user: USER,
              showToast: vi.fn(),
              onOpenCheckout,
            }} />}
          >
            <Route index element={<CommunityEvents />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Buy ticket — $25.00' }));
    expect(onOpenCheckout).toHaveBeenCalledWith('event', 25, expect.objectContaining({
      event_id: 31,
      title: 'Konsè peye',
    }));
    // Paid tickets are rejected with 402 on the direct endpoint — the
    // checkout creates the RESERVED ticket server-side instead.
    expect(eventsService.ticket).not.toHaveBeenCalled();
  });

  it('asks visitors to join before buying a paid ticket', async () => {
    communityEventsService.list.mockResolvedValue({
      data: [{
        id: 32,
        title: 'Konsè peye',
        status: 'published',
        start_time: '2027-02-01T18:00:00Z',
        end_time: '2027-02-01T20:00:00Z',
        is_free: false,
        price: 25,
        attendee_count: 0,
        has_ticket: false,
      }],
    });
    const onJoin = vi.fn();
    const onOpenCheckout = vi.fn();
    render(
      <MemoryRouter initialEntries={['/community/test/events']}>
        <Routes>
          <Route
            path="/community/test/events"
            element={<Outlet context={{
              community: { ...MEMBER_COMM, is_member: false, join_mode: 'public' },
              lang: 'en',
              user: null,
              showToast: vi.fn(),
              onJoin,
              canJoin: true,
              onOpenCheckout,
            }} />}
          >
            <Route index element={<CommunityEvents />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Join to buy' }));
    expect(onJoin).toHaveBeenCalledOnce();
    expect(onOpenCheckout).not.toHaveBeenCalled();
  });

  it('lets members cancel a free RSVP and updates the attendee count', async () => {
    communityEventsService.list.mockResolvedValue({
      data: [{
        id: 23,
        title: 'Reyinyon kominote',
        status: 'published',
        start_time: '2027-01-15T18:00:00Z',
        end_time: '2027-01-15T20:00:00Z',
        is_free: true,
        price: 0,
        attendee_count: 5,
        has_ticket: true,
      }],
    });
    const showToast = vi.fn();
    render(
      <MemoryRouter initialEntries={['/community/test/events']}>
        <Routes>
          <Route
            path="/community/test/events"
            element={<Outlet context={{
              community: MEMBER_COMM,
              lang: 'ht',
              user: USER,
              showToast,
            }} />}
          >
            <Route index element={<CommunityEvents />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Ap vini')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Anile prezans' }));
    await waitFor(() => expect(eventsService.cancelRSVP).toHaveBeenCalledWith(23));
    expect(await screen.findByRole('button', { name: 'Reponn' })).toBeTruthy();
    expect(screen.getByTestId('community-event-attendees-23')).toHaveTextContent('4');
    expect(showToast).toHaveBeenCalledWith('Ou anile prezans ou.', 'check-circle');
  });

  it('asks visitors to join before RSVP and does not create a ticket', async () => {
    communityEventsService.list.mockResolvedValue({
      data: [{
        id: 22,
        title: 'Reyinyon kominote',
        status: 'published',
        start_time: '2027-01-15T18:00:00Z',
        end_time: '2027-01-15T20:00:00Z',
        is_free: true,
        price: 0,
        attendee_count: 2,
        has_ticket: false,
      }],
    });
    const onJoin = vi.fn();
    render(
      <MemoryRouter initialEntries={['/community/test/events']}>
        <Routes>
          <Route
            path="/community/test/events"
            element={<Outlet context={{
              community: { slug: 'test', is_member: false, join_mode: 'public' },
              lang: 'ht',
              onJoin,
              canJoin: true,
            }} />}
          >
            <Route index element={<CommunityEvents />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Antre pou reponn' }));
    expect(onJoin).toHaveBeenCalledOnce();
    expect(eventsService.ticket).not.toHaveBeenCalled();
  });

  it('explains that members can publish persistent community posts', async () => {
    render(<Harness community={MEMBER_COMM} user={USER} />);
    expect(await screen.findByText('Pòs ak diskisyon')).toBeTruthy();
    expect(screen.getByText('Kreye yon pòs')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pibliye pòs' })).toBeTruthy();
  });

  it('shows skeleton first, then posts with reaction state', async () => {
    render(<Harness community={MEMBER_COMM} user={USER} />);
    expect(screen.getByTestId('posts-skeleton')).toBeTruthy();
    expect(await screen.findByText('Bonjou tout moun!')).toBeTruthy();
    expect(screen.queryByTestId('posts-skeleton')).toBeNull();
    // Active reaction button is pressed.
    expect(screen.getByTestId('post-react-1-❤️')).toHaveAttribute('aria-pressed', 'true');
    const timestamp = document.querySelector('time.c-post-time');
    expect(timestamp.getAttribute('datetime')).toBe(POSTS[0].created_at);
    expect(timestamp.getAttribute('title')).toBeTruthy();
  });

  it('renders the author avatar returned by the API', async () => {
    const avatarUrl = 'https://cdn.atelnyo.site/avatar.png';
    communitiesService.posts.mockResolvedValue({
      data: [{ ...POSTS[0], author_avatar: avatarUrl }],
    });
    render(<Harness community={MEMBER_COMM} user={USER} />);
    await screen.findByText('Bonjou tout moun!');

    const avatar = document.querySelector('.c-post-avatar img');
    expect(avatar).toHaveAttribute('src', avatarUrl);
  });

  it('searches posts in this community and renders the matching results', async () => {
    const result = { ...POSTS[0], id: 2, content: 'Rezilta rechèch la' };
    communitiesService.posts.mockImplementation((_slug, params) => Promise.resolve({
      data: params.search ? [result] : POSTS,
    }));
    render(<Harness community={MEMBER_COMM} user={USER} />);

    fireEvent.change(await screen.findByTestId('posts-search-input'), {
      target: { value: 'rechèch' },
    });

    await waitFor(() => {
      expect(communitiesService.posts).toHaveBeenLastCalledWith('test', {
        page: 1,
        search: 'rechèch',
      });
    });
    expect(await screen.findByText('Rezilta rechèch la')).toBeTruthy();
    // The search field must survive the request instead of being replaced
    // by the initial skeleton.
    expect(screen.getByTestId('posts-search-input')).toBeTruthy();

    fireEvent.click(screen.getByTestId('posts-search-reset'));
    await waitFor(() => {
      expect(communitiesService.posts).toHaveBeenLastCalledWith('test', { page: 1 });
    });
    expect(screen.getByTestId('posts-search-input').value).toBe('');
  });

  it('publishes through the composer and prepends the post', async () => {
    const onPostCountChange = vi.fn();
    communitiesService.createPost.mockResolvedValue({
      data: { ...POSTS[0], id: 2, content: 'Nouvo pòs!' },
    });
    render(<Harness community={MEMBER_COMM} user={USER} onPostCountChange={onPostCountChange} />);
    await screen.findByText('Bonjou tout moun!');
    fireEvent.change(screen.getByTestId('post-composer-input'), { target: { value: 'Nouvo pòs!' } });
    fireEvent.click(screen.getByTestId('post-composer-submit'));
    await waitFor(() => expect(communitiesService.createPost).toHaveBeenCalledWith('test', { content: 'Nouvo pòs!' }));
    expect(await screen.findByText('Nouvo pòs!')).toBeTruthy();
    expect(screen.getByTestId('posts-count')).toHaveTextContent('2');
    expect(onPostCountChange).toHaveBeenCalledWith(1);
  });

  it('counts Unicode code points and keeps empty publish disabled', async () => {
    render(<Harness community={MEMBER_COMM} user={USER} />);
    await screen.findByText('Bonjou tout moun!');
    const input = screen.getByTestId('post-composer-input');
    const submit = screen.getByTestId('post-composer-submit');
    expect(submit.disabled).toBe(true);

    fireEvent.change(input, { target: { value: '😀' } });
    expect(input.value).toBe('😀');
    expect(screen.getByText('1/2000')).toBeTruthy();
    expect(submit.disabled).toBe(false);
  });

  it('rejects unsafe links and normalizes valid ones', async () => {
    render(<Harness community={MEMBER_COMM} user={USER} />);
    await screen.findByText('Bonjou tout moun!');
    const input = screen.getByTestId('post-composer-input');

    fireEvent.click(screen.getByTestId('post-composer-link-btn'));
    let linkInput = screen.getByTestId('post-composer-link-input');
    fireEvent.change(linkInput, { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(screen.getByTestId('post-composer-link-add'));
    expect(await screen.findByTestId('post-composer-link-error')).toBeTruthy();
    expect(input.value).toBe('');

    // The row stays open after a validation error, so the user can fix
    // the URL without reopening the tool.
    linkInput = screen.getByTestId('post-composer-link-input');
    fireEvent.change(linkInput, { target: { value: 'atelnyo.site' } });
    fireEvent.click(screen.getByTestId('post-composer-link-add'));
    await waitFor(() => expect(input.value).toContain('https://atelnyo.site/'));
  });

  it('validates image type before uploading', async () => {
    render(<Harness community={MEMBER_COMM} user={USER} />);
    await screen.findByText('Bonjou tout moun!');
    const file = new File(['not an image'], 'notes.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByTestId('post-composer-file'), {
      target: { files: [file] },
    });
    expect(await screen.findByTestId('post-composer-image-error')).toBeTruthy();
  });

  it('tracks the counter through every requested boundary', async () => {
    render(<Harness community={MEMBER_COMM} user={USER} />);
    await screen.findByText('Bonjou tout moun!');
    const input = screen.getByTestId('post-composer-input');
    const submit = screen.getByTestId('post-composer-submit');

    for (const count of [0, 1, 100, 1000, 1999, 2000]) {
      fireEvent.change(input, { target: { value: 'a'.repeat(count) } });
      expect(input.value).toHaveLength(count);
      expect(screen.getByText(`${count}/2000`)).toBeTruthy();
      expect(submit.disabled).toBe(count === 0);
    }
  });

  it('accepts exactly 2000 code points and enables publishing', async () => {
    render(<Harness community={MEMBER_COMM} user={USER} />);
    await screen.findByText('Bonjou tout moun!');
    const input = screen.getByTestId('post-composer-input');
    const submit = screen.getByTestId('post-composer-submit');

    fireEvent.change(input, { target: { value: 'a'.repeat(2000) } });

    expect(input.value).toHaveLength(2000);
    expect(screen.getByText('2000/2000')).toBeTruthy();
    expect(submit.disabled).toBe(false);
    expect(screen.queryByTestId('post-composer-length-error')).toBeNull();
  });

  it('truncates text over 2000 code points and explains why', async () => {
    render(<Harness community={MEMBER_COMM} user={USER} />);
    await screen.findByText('Bonjou tout moun!');
    const input = screen.getByTestId('post-composer-input');

    fireEvent.change(input, { target: { value: 'a'.repeat(2001) } });

    expect(input.value).toHaveLength(2000);
    expect(await screen.findByTestId('post-composer-length-error')).toBeTruthy();
  });

  it('keeps the draft intact when publishing fails', async () => {
    communitiesService.createPost.mockRejectedValue({
      response: { data: { detail: 'Server refused' } },
    });
    render(<Harness community={MEMBER_COMM} user={USER} />);
    await screen.findByText('Bonjou tout moun!');
    const input = screen.getByTestId('post-composer-input');
    fireEvent.change(input, { target: { value: 'Brouyon enpòtan' } });
    fireEvent.click(screen.getByTestId('post-composer-submit'));

    await waitFor(() => expect(communitiesService.createPost).toHaveBeenCalled());
    expect(input.value).toBe('Brouyon enpòtan');
    expect(screen.getByTestId('post-composer-submit').disabled).toBe(false);
  });

  it('hides the global assistant while the composer is focused', async () => {
    render(<Harness community={MEMBER_COMM} user={USER} />);
    await screen.findByText('Bonjou tout moun!');
    const input = screen.getByTestId('post-composer-input');

    fireEvent.focus(input);
    expect(document.body.classList.contains('community-composing')).toBe(true);

    fireEvent.blur(input);
    await waitFor(() => {
      expect(document.body.classList.contains('community-composing')).toBe(false);
    });
  });

  it('inserts an emoji at the caret', async () => {
    render(<Harness community={MEMBER_COMM} user={USER} />);
    await screen.findByText('Bonjou tout moun!');
    const input = screen.getByTestId('post-composer-input');
    fireEvent.change(input, { target: { value: 'Bonjou ' } });

    fireEvent.click(screen.getByTestId('post-composer-emoji-btn'));
    const menu = screen.getByRole('menu');
    fireEvent.click(within(menu).getAllByRole('menuitem')[0]);

    expect(input.value).toBe('Bonjou ❤️');
    // ❤️ is two code points: the heart plus U+FE0F.
    expect(screen.getByText('9/2000')).toBeTruthy();
  });

  it('hides the assistant while the composer is visible in the mobile viewport', async () => {
    let observerCallback = null;
    const observe = vi.fn();
    class MockIntersectionObserver {
      constructor(callback) { observerCallback = callback; }

      observe = observe;

      disconnect = vi.fn();
    }
    const originalObserver = window.IntersectionObserver;
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      value: MockIntersectionObserver,
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    try {
      render(<Harness community={MEMBER_COMM} user={USER} />);
      await screen.findByText('Bonjou tout moun!');
      await waitFor(() => expect(observe).toHaveBeenCalled());

      act(() => observerCallback([{ isIntersecting: true }]));
      expect(document.body.classList.contains('community-composer-visible')).toBe(true);

      act(() => observerCallback([{ isIntersecting: false }]));
      expect(document.body.classList.contains('community-composer-visible')).toBe(false);
    } finally {
      Object.defineProperty(window, 'IntersectionObserver', {
        configurable: true,
        value: originalObserver,
      });
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: originalMatchMedia,
      });
    }
  });

  it('uploads an image and publishes it with image_url', async () => {
    api.post.mockResolvedValue({
      data: { url: 'https://cdn.example.com/community/photo.jpg' },
    });
    communitiesService.createPost.mockImplementation((slug, data) => Promise.resolve({
      data: {
        id: 87,
        ...data,
        author: 9,
        author_username: 'manm1',
        reaction_count: 0,
        reactions: {},
        my_reaction: null,
        created_at: '2026-11-02T10:00:00Z',
      },
    }));
    render(<Harness community={MEMBER_COMM} user={USER} />);
    await screen.findByText('Bonjou tout moun!');

    const file = new File(['fake-jpeg'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('post-composer-file'), {
      target: { files: [file] },
    });

    const preview = await screen.findByTestId('post-composer-preview');
    expect(preview.getAttribute('src')).toBe('https://cdn.example.com/community/photo.jpg');
    expect(api.post).toHaveBeenCalledWith(
      'media/upload/',
      expect.objectContaining({ kind: 'image' }),
      expect.any(Object),
    );

    fireEvent.change(screen.getByTestId('post-composer-input'), {
      target: { value: 'Yon bèl foto' },
    });
    fireEvent.click(screen.getByTestId('post-composer-submit'));
    await waitFor(() => {
      expect(communitiesService.createPost).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          content: 'Yon bèl foto',
          image_url: 'https://cdn.example.com/community/photo.jpg',
        }),
      );
    });
  });

  it('uploads an MP4 and publishes a video-only post', async () => {
    api.post.mockResolvedValue({
      data: { url: 'https://cdn.example.com/community/clip.mp4' },
    });
    communitiesService.createPost.mockImplementation((slug, data) => Promise.resolve({
      data: {
        id: 88,
        ...data,
        author: 9,
        author_username: 'manm1',
        reaction_count: 0,
        reactions: {},
        my_reaction: null,
        created_at: '2026-11-02T10:00:00Z',
      },
    }));
    render(<Harness community={MEMBER_COMM} user={USER} />);
    await screen.findByText('Bonjou tout moun!');

    const file = new File(['fake-mp4'], 'clip.mp4', { type: 'video/mp4' });
    fireEvent.change(screen.getByTestId('post-composer-video-file'), {
      target: { files: [file] },
    });

    const preview = await screen.findByTestId('post-composer-video-preview');
    expect(preview.getAttribute('src')).toBe('https://cdn.example.com/community/clip.mp4');
    expect(api.post).toHaveBeenCalledWith(
      'media/upload/',
      expect.objectContaining({ kind: 'video' }),
      expect.any(Object),
    );

    fireEvent.click(screen.getByTestId('post-composer-submit'));
    await waitFor(() => {
      expect(communitiesService.createPost).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          content: '',
          video_url: 'https://cdn.example.com/community/clip.mp4',
        }),
      );
    });
  });

  it('rejects non-MP4 video files before uploading', async () => {
    render(<Harness community={MEMBER_COMM} user={USER} />);
    await screen.findByText('Bonjou tout moun!');
    const file = new File(['fake-webm'], 'clip.webm', { type: 'video/webm' });

    fireEvent.change(screen.getByTestId('post-composer-video-file'), {
      target: { files: [file] },
    });

    expect(await screen.findByTestId('post-composer-video-error')).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('renders a YouTube Short with its timestamp as an embed', async () => {
    communitiesService.posts.mockResolvedValue({
      data: [{
        ...POSTS[0],
        id: 71,
        content: 'https://youtu.be/dQw4w9WgXcQ?t=43',
        video_url: '',
      }],
    });
    render(<Harness community={MEMBER_COMM} user={USER} />);

    const frame = await screen.findByTitle('Videyo pòs la');
    expect(frame.getAttribute('src')).toContain('/embed/dQw4w9WgXcQ');
    expect(frame.getAttribute('src')).toContain('start=43');
  });

  it('renders a Vimeo link as a player embed', async () => {
    communitiesService.posts.mockResolvedValue({
      data: [{
        ...POSTS[0],
        id: 72,
        content: 'https://vimeo.com/76979871',
        video_url: '',
      }],
    });
    render(<Harness community={MEMBER_COMM} user={USER} />);

    const frame = await screen.findByTitle('Videyo pòs la');
    expect(frame.getAttribute('src')).toBe('https://player.vimeo.com/video/76979871?dnt=1');
  });

  it('renders a native video-only post with a real player', async () => {
    communitiesService.posts.mockResolvedValue({
      data: [{
        ...POSTS[0],
        id: 73,
        content: '',
        video_url: 'https://cdn.example.com/community/native.mp4',
      }],
    });
    render(<Harness community={MEMBER_COMM} user={USER} />);

    const player = await screen.findByLabelText('Videyo pòs la');
    expect(player.tagName).toBe('VIDEO');
    expect(player.getAttribute('src')).toBe('https://cdn.example.com/community/native.mp4');
  });

  it('explains approval-mode visibility instead of promising open posting', async () => {
    render(
      <Harness
        community={{ ...MEMBER_COMM, join_mode: 'approval' }}
        user={USER}
      />,
    );
    expect(await screen.findByText(/apwobasyon/i)).toBeTruthy();
  });

  it('tells members a private community post is members-only', async () => {
    render(
      <Harness
        community={{ ...MEMBER_COMM, read_visibility: 'members' }}
        user={USER}
      />,
    );

    expect(await screen.findByText('Sèlman manm aktif yo ka li pòs sa a.')).toBeTruthy();
  });

  it('lets the author edit their post in place', async () => {
    communitiesService.updatePost.mockResolvedValue({
      data: { ...POSTS[0], content: 'Mete ajou' },
    });
    render(<Harness community={MEMBER_COMM} user={USER} />);
    await screen.findByText('Bonjou tout moun!');

    fireEvent.click(screen.getByTestId('content-feedback-menu-1'));
    fireEvent.click(await screen.findByTestId('post-edit-1'));
    const editInput = await screen.findByTestId('post-edit-input-1');
    fireEvent.change(editInput, { target: { value: 'Mete ajou' } });
    fireEvent.click(screen.getByTestId('post-edit-save-1'));

    await waitFor(() => expect(communitiesService.updatePost).toHaveBeenCalledWith(1, { content: 'Mete ajou' }));
    expect(await screen.findByText('Mete ajou')).toBeTruthy();
  });

  it('renders long URLs as clickable links inside the post body', async () => {
    const longUrl = 'https://atelnyo.site/yon/lyen/twò/long/ki/pa/dwe/kase/layout/la';
    communitiesService.posts.mockResolvedValue({
      data: [{ ...POSTS[0], content: `Gade ${longUrl}` }],
    });
    render(<Harness community={MEMBER_COMM} user={USER} />);

    const link = await screen.findByRole('link', { name: longUrl });
    expect(link).toHaveAttribute('href', longUrl);
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('toggles a reaction optimistically', async () => {
    communitiesService.reactToPost.mockResolvedValue({
      data: { ...POSTS[0], my_reaction: null, reactions: {}, reaction_count: 1 },
    });
    render(<Harness community={MEMBER_COMM} user={USER} />);
    await screen.findByText('Bonjou tout moun!');
    fireEvent.click(screen.getByTestId('post-react-1-❤️'));
    await waitFor(() => expect(communitiesService.reactToPost).toHaveBeenCalledWith(1, '❤️'));
  });

  it('shows the new reaction count optimistically before the server responds', async () => {
    communitiesService.posts.mockResolvedValue({
      data: [{ ...POSTS[0], my_reaction: null, reactions: {}, reaction_count: 0 }],
    });
    communitiesService.reactToPost.mockReturnValue(new Promise(() => {}));
    render(<Harness community={MEMBER_COMM} user={USER} />);
    await screen.findByText('Bonjou tout moun!');

    fireEvent.click(screen.getByTestId('post-react-1-❤️'));

    await waitFor(() => {
      const button = screen.getByTestId('post-react-1-❤️');
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(button).toHaveTextContent('1');
    });
  });

  it('hides the composer for non-members', async () => {
    render(<Harness community={{ slug: 'test', is_member: false }} user={USER} />);
    await screen.findByText('Bonjou tout moun!');
    expect(screen.queryByTestId('post-composer-input')).toBeNull();
  });

  it('deletes the author own post and decrements the feed count', async () => {
    window.confirm = vi.fn(() => true);
    const onPostCountChange = vi.fn();
    communitiesService.deletePost.mockResolvedValue({});
    render(<Harness community={MEMBER_COMM} user={USER} onPostCountChange={onPostCountChange} />);
    await screen.findByText('Bonjou tout moun!');
    expect(screen.getByTestId('posts-count')).toHaveTextContent('1');
    fireEvent.click(screen.getByTestId('content-feedback-menu-1'));
    fireEvent.click(await screen.findByTestId('post-delete-1'));
    await waitFor(() => expect(communitiesService.deletePost).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.getByTestId('posts-count')).toHaveTextContent('0'));
    expect(onPostCountChange).toHaveBeenCalledWith(-1);
  });

  it('puts author actions in one menu and never offers Report to the author', async () => {
    render(<Harness community={MEMBER_COMM} user={USER} />);
    await screen.findByText('Bonjou tout moun!');
    fireEvent.click(screen.getByTestId('content-feedback-menu-1'));

    expect(await screen.findByTestId('post-edit-1')).toBeTruthy();
    expect(screen.getByTestId('post-delete-1')).toBeTruthy();
    expect(screen.queryByText('Siyale')).toBeNull();
  });

  it('offers Report but not edit/delete to another member', async () => {
    render(<Harness community={MEMBER_COMM} user={{ id: 10, username: 'lotmanm' }} />);
    await screen.findByText('Bonjou tout moun!');
    fireEvent.click(screen.getByTestId('content-feedback-menu-1'));

    expect(await screen.findByText('Siyale')).toBeTruthy();
    expect(screen.queryByTestId('post-edit-1')).toBeNull();
    expect(screen.queryByTestId('post-delete-1')).toBeNull();
  });

  it('expands comments and sends one', async () => {
    communitiesService.postComments.mockResolvedValue({ data: [] });
    communitiesService.createComment.mockResolvedValue({
      data: { id: 10, content: 'Dakò!', author: 9, author_username: 'manm1' },
    });
    render(<Harness community={MEMBER_COMM} user={USER} />);
    await screen.findByText('Bonjou tout moun!');
    fireEvent.click(screen.getByTestId('post-comments-toggle-1'));
    expect(await screen.findByTestId('post-comments-1')).toBeTruthy();
    expect(communitiesService.postComments).toHaveBeenCalledWith(1);
    fireEvent.change(screen.getByTestId('comment-input-1'), { target: { value: 'Dakò!' } });
    fireEvent.click(screen.getByTestId('comment-send-1'));
    await waitFor(() => expect(communitiesService.createComment).toHaveBeenCalledWith(1, 'Dakò!'));
    expect(await screen.findByText('Dakò!')).toBeTruthy();
  });

  it('shows the comment count on the toggle', async () => {
    const withCount = [{ ...POSTS[0], comment_count: 3 }];
    communitiesService.posts.mockResolvedValue({ data: withCount });
    render(<Harness community={MEMBER_COMM} user={USER} />);
    expect(await screen.findByTestId('post-comments-toggle-1')).toHaveTextContent('3');
  });

  it('serves a shared post permalink with its own tags and hides the composer', async () => {
    const shared = {
      ...POSTS[0], id: 2, content: 'Pòs pataje a', image_url: 'https://cdn.example.com/p2.jpg',
      community_slug: 'test', community_name: 'Kominote Test',
    };
    communitiesService.getPost.mockResolvedValue({ data: shared });

    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/community/test/posts/2']}>
          <Routes>
            <Route
              path="/community/:slug/posts/:postId"
              element={<Outlet context={{ community: { ...MEMBER_COMM, name: 'Kominote Test' }, lang: 'ht', user: USER, showToast: vi.fn() }} />}
            >
              <Route index element={<CommunityPosts />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(await screen.findByText('Pòs pataje a')).toBeTruthy();
    expect(communitiesService.getPost).toHaveBeenCalledWith(2);
    expect(screen.getByText('Tout pòs yo')).toBeTruthy();
    expect(screen.queryByTestId('post-composer-input')).toBeNull();
    await waitFor(() => {
      expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content'))
        .toBe('https://cdn.example.com/p2.jpg');
      expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href'))
        .toBe('https://atelnyo.site/community/test/posts/2');
    });
  });

  it('walks a just-joined member from the welcome checklist to a prefilled intro post', async () => {
    const onWelcomeStep = vi.fn();
    const comm = {
      ...MEMBER_COMM,
      name: 'Atelye Test',
      rules: [{ title: 'Règleman 1' }, { title: 'Règleman 2' }],
    };
    render(
      <MemoryRouter initialEntries={['/community/test/home']}>
        <Routes>
          <Route
            path="/community/test/home"
            element={<Outlet context={{
              community: comm,
              lang: 'ht',
              user: USER,
              justJoined: true,
              welcomeDone: [],
              onWelcomeStep,
              showToast: vi.fn(),
            }} />}
          >
            <Route index element={<CommunityHome />} />
          </Route>
          <Route
            path="/community/test/posts"
            element={<Outlet context={{ community: comm, lang: 'ht', user: USER, showToast: vi.fn() }} />}
          >
            <Route index element={<CommunityPosts />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('welcome-step-rules')).toBeTruthy();
    expect(screen.getByText('0/4 fèt')).toBeTruthy();

    fireEvent.click(screen.getByTestId('welcome-step-intro'));
    expect(onWelcomeStep).toHaveBeenCalledWith('intro');
    const input = await screen.findByTestId('post-composer-input');
    await waitFor(() => expect(input.value).toContain('Atelye Test'));
  });

  it('marks exactly one route-driven tab active and updates it on navigation', async () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/community/test/events']}>
          <Routes>
            <Route
              path="/community/:slug"
              element={<CommunityDetail lang="en" user={{ id: 1 }} />}
            >
              <Route path="home" element={<div>Home view</div>} />
              <Route path="events" element={<div>Events view</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(await screen.findByText('Events view')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Events' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page'))
      .toHaveLength(1);

    fireEvent.click(screen.getByRole('link', { name: 'Home' }));

    expect(await screen.findByText('Home view')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page'))
      .toHaveLength(1);
  });

  it('revalidates membership on focus and unlocks the composer after approval', async () => {
    communitiesService.get.mockReset();
    communitiesService.get
      .mockResolvedValueOnce({
        data: {
          id: 1, slug: 'test', name: 'Test community', description: 'Pending approval.',
          member_count: 1, is_member: false, current_user_role: null, my_status: 'pending',
          join_mode: 'approval', read_visibility: 'public', can_read: true, rules: [],
        },
      })
      .mockResolvedValue({
        data: {
          id: 1, slug: 'test', name: 'Test community', description: 'Approved member.',
          member_count: 2, is_member: true, current_user_role: 'member', my_status: 'active',
          join_mode: 'approval', read_visibility: 'public', can_read: true, rules: [],
        },
      });
    const showToast = vi.fn();

    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/community/test/posts']}>
          <Routes>
            <Route
              path="/community/:slug"
              element={<CommunityDetail lang="en" user={USER} showToast={showToast} />}
            >
              <Route path="posts" element={<CommunityPosts />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );

    // Pending members see the request state and no composer.
    expect(await screen.findByText('Request sent')).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('post-composer-input')).toBeNull());

    // Returning to the tab revalidates membership without a reload.
    act(() => { window.dispatchEvent(new Event('focus')); });

    await waitFor(() => expect(communitiesService.get).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('post-composer-input')).toBeTruthy();
    expect(screen.queryByText('Request sent')).toBeNull();
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('Request approved'), 'check-circle',
    );
  });

  it('unlocks membership when the notification socket reports the approval', async () => {
    communitiesService.get.mockReset();
    communitiesService.get
      .mockResolvedValueOnce({
        data: {
          id: 1, slug: 'test', name: 'Test community', description: 'Pending approval.',
          member_count: 1, is_member: false, current_user_role: null, my_status: 'pending',
          join_mode: 'approval', read_visibility: 'public', can_read: true, rules: [],
        },
      })
      .mockResolvedValue({
        data: {
          id: 1, slug: 'test', name: 'Test community', description: 'Approved member.',
          member_count: 2, is_member: true, current_user_role: 'member', my_status: 'active',
          join_mode: 'approval', read_visibility: 'public', can_read: true, rules: [],
        },
      });
    const showToast = vi.fn();

    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/community/test/posts']}>
          <Routes>
            <Route
              path="/community/:slug"
              element={<CommunityDetail lang="en" user={USER} showToast={showToast} />}
            >
              <Route path="posts" element={<CommunityPosts />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(await screen.findByText('Request sent')).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('post-composer-input')).toBeNull());

    // A socket event for another community must not refetch this page.
    act(() => {
      window.dispatchEvent(new CustomEvent('atelnyo:community-membership', {
        detail: { slug: 'other' },
      }));
    });
    expect(communitiesService.get).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new CustomEvent('atelnyo:community-membership', {
        detail: { slug: 'test' },
      }));
    });

    await waitFor(() => expect(communitiesService.get).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('post-composer-input')).toBeTruthy();
    expect(screen.queryByText('Request sent')).toBeNull();
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('Request approved'), 'check-circle',
    );
  });

  describe('Community description', () => {
    it('keeps short descriptions compact without a toggle', () => {
      render(<CommunityDescription text="A short description." lang="en" />);
      expect(screen.queryByRole('button', { name: /Read more/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /Show less/ })).toBeNull();
    });

    it('clamps long descriptions and expands/collapses without losing text', async () => {
      const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
      const originalClient = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 120 });
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 60 });

      try {
        const longText = 'Long description text. '.repeat(80);
        const { container } = render(<CommunityDescription text={longText} lang="en" />);
        const paragraph = container.querySelector('.c-desc');

        expect(paragraph.className).toContain('c-desc--clamped');
        const more = await screen.findByRole('button', { name: /Read more/ });
        expect(more).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(more);

        expect(paragraph.className).not.toContain('c-desc--clamped');
        expect(screen.getByRole('button', { name: /Show less/ })).toHaveAttribute('aria-expanded', 'true');
        expect(paragraph.textContent).toContain('Long description text.');
      } finally {
        if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScroll);
        else delete HTMLElement.prototype.scrollHeight;
        if (originalClient) Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClient);
        else delete HTMLElement.prototype.clientHeight;
      }
    });
  });
});
