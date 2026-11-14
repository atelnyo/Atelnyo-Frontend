import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';

const POSTS = [
  {
    id: 1, content: 'Bonjou tout moun!', image_url: '', is_pinned: false,
    author: 9, author_username: 'manm1', reaction_count: 2,
    reactions: { '❤️': 2 }, my_reaction: '❤️', created_at: '2026-11-01T10:00:00Z',
  },
];

vi.mock('../../services/api', () => ({
  communitiesService: {
    posts: vi.fn(),
    createPost: vi.fn(),
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

import { communitiesService, communityEventsService, eventsService } from '../../services/api';
import CommunityPosts from './CommunityPosts';
import { CommunityEvents, CommunityHome } from '../CommunityDetail';

function Harness({ community, user }) {
  return (
    <MemoryRouter initialEntries={['/community/test/posts']}>
      <Routes>
        <Route
          path="/community/:slug/posts"
          element={<Outlet context={{ community, lang: 'ht', t: {}, user, showToast: vi.fn() }} />}
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
  communitiesService.posts.mockResolvedValue({ data: POSTS });
  communityEventsService.list.mockResolvedValue({ data: [] });
  eventsService.ticket.mockResolvedValue({ data: { id: 21, status: 'confirmed' } });
  eventsService.cancelRSVP.mockResolvedValue({ data: { attendee_count: 4 } });
  communitiesService.announcements.mockResolvedValue({ data: [] });
});

describe('Community surfaces', () => {
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

  it('lets visitors join from the home CTA instead of sending them to a hidden composer', async () => {
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

    const joinButton = await screen.findByTestId('community-home-compose');
    expect(joinButton).toHaveTextContent('Antre pou pibliye');
    fireEvent.click(joinButton);
    expect(onJoin).toHaveBeenCalledOnce();
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
  });

  it('publishes through the composer and prepends the post', async () => {
    communitiesService.createPost.mockResolvedValue({
      data: { ...POSTS[0], id: 2, content: 'Nouvo pòs!' },
    });
    render(<Harness community={MEMBER_COMM} user={USER} />);
    await screen.findByText('Bonjou tout moun!');
    fireEvent.change(screen.getByTestId('post-composer-input'), { target: { value: 'Nouvo pòs!' } });
    fireEvent.click(screen.getByTestId('post-composer-submit'));
    await waitFor(() => expect(communitiesService.createPost).toHaveBeenCalledWith('test', { content: 'Nouvo pòs!' }));
    expect(await screen.findByText('Nouvo pòs!')).toBeTruthy();
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

  it('hides the composer for non-members', async () => {
    render(<Harness community={{ slug: 'test', is_member: false }} user={USER} />);
    await screen.findByText('Bonjou tout moun!');
    expect(screen.queryByTestId('post-composer-input')).toBeNull();
  });

  it('deletes the author own post', async () => {
    window.confirm = vi.fn(() => true);
    communitiesService.deletePost.mockResolvedValue({});
    render(<Harness community={MEMBER_COMM} user={USER} />);
    await screen.findByText('Bonjou tout moun!');
    fireEvent.click(screen.getByTestId('post-delete-1'));
    await waitFor(() => expect(communitiesService.deletePost).toHaveBeenCalledWith(1));
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
});
