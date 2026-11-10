import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  },
  communityEventsService: { list: vi.fn() },
}));

import { communitiesService, communityEventsService } from '../../services/api';
import CommunityPosts from './CommunityPosts';
import { CommunityHome } from '../CommunityDetail';

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
});

describe('CommunityPosts', () => {
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
