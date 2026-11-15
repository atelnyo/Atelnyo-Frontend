/**
 * src/components/studio/editor/CommunityFounderPanels.test.jsx
 *
 * Founder workspace tabs — Apèsi, Manm, Anons, Evènman, Fichye & Kou.
 * The services module is mocked (no network); the real useFetch hook and
 * ConfirmModal run so the tests exercise the actual data → render →
 * mutation → refetch loop of each panel.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import CommunityFounderOverview from './CommunityFounderOverview';
import CommunityMembersPanel from './CommunityMembersPanel';
import CommunityAnnouncementsPanel from './CommunityAnnouncementsPanel';
import CommunityPostsPanel from './CommunityPostsPanel';
import CommunityEventsPanel from './CommunityEventsPanel';
import CommunityFilesPanel from './CommunityFilesPanel';
import {
  communitiesService,
  communityEventsService,
  courseService,
} from '../../../services/api';

vi.mock('../../../services/api', () => ({
  default: { post: vi.fn() },
  communitiesService: {
    members: vi.fn(),
    joinRequests: vi.fn(),
    bannedMembers: vi.fn(),
    announcements: vi.fn(),
    posts: vi.fn(),
    approveJoinRequest: vi.fn(),
    rejectJoinRequest: vi.fn(),
    promote: vi.fn(),
    demote: vi.fn(),
    mute: vi.fn(),
    unmute: vi.fn(),
    banMember: vi.fn(),
    unbanMember: vi.fn(),
    createAnnouncement: vi.fn(),
    updateAnnouncement: vi.fn(),
    deleteAnnouncement: vi.fn(),
    updatePost: vi.fn(),
    deletePost: vi.fn(),
    comments: vi.fn(),
    deleteComment: vi.fn(),
    files: vi.fn(),
    linkedCourses: vi.fn(),
    createFile: vi.fn(),
    deleteFile: vi.fn(),
    linkCourse: vi.fn(),
    updateLinkedCourse: vi.fn(),
    unlinkCourse: vi.fn(),
  },
  communityEventsService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
    delete: vi.fn(),
    attendees: vi.fn(),
  },
  courseService: { getMyCoursesCI: vi.fn() },
}));

const SLUG = 'dev-ayiti';

beforeEach(() => {
  vi.clearAllMocks();
  communitiesService.members.mockResolvedValue({ data: [] });
  communitiesService.joinRequests.mockResolvedValue({ data: [] });
  communitiesService.bannedMembers.mockResolvedValue({ data: [] });
  communitiesService.announcements.mockResolvedValue({ data: [] });
  communitiesService.posts.mockResolvedValue({ data: { count: 0, results: [] } });
  communitiesService.files.mockResolvedValue({ data: [] });
  communitiesService.linkedCourses.mockResolvedValue({ data: [] });
  communitiesService.createAnnouncement.mockResolvedValue({});
  communitiesService.updateAnnouncement.mockResolvedValue({});
  communitiesService.deleteAnnouncement.mockResolvedValue({});
  communitiesService.updatePost.mockResolvedValue({});
  communitiesService.deletePost.mockResolvedValue({});
  communitiesService.comments.mockResolvedValue({ data: [] });
  communitiesService.deleteComment.mockResolvedValue({});
  communitiesService.approveJoinRequest.mockResolvedValue({});
  communitiesService.promote.mockResolvedValue({});
  communitiesService.banMember.mockResolvedValue({});
  communitiesService.linkCourse.mockResolvedValue({});
  communitiesService.unlinkCourse.mockResolvedValue({});
  communityEventsService.list.mockResolvedValue({ data: [] });
  communityEventsService.create.mockResolvedValue({});
  communityEventsService.update.mockResolvedValue({});
  communityEventsService.delete.mockResolvedValue({});
  communityEventsService.cancel.mockResolvedValue({});
  communityEventsService.attendees.mockResolvedValue({ data: [] });
  courseService.getMyCoursesCI.mockResolvedValue({ data: { courses: [] } });
});

describe('CommunityFounderOverview', () => {
  it('shows the founder card and live counters, and routes shortcuts to tabs', async () => {
    const recent = new Date().toISOString();
    communitiesService.members.mockResolvedValue({ data: [
      { id: 1, username: 'jhon', role: 'owner', joined_at: recent },
      { id: 2, username: 'marie', role: 'member', joined_at: recent },
      { id: 3, username: 'old', role: 'member', joined_at: '2020-01-01T00:00:00Z' },
    ] });
    communitiesService.joinRequests.mockResolvedValue({ data: [
      { id: 9, user_id: 42, username: 'hopeful' },
    ] });
    communitiesService.announcements.mockResolvedValue({ data: [
      { id: 1, title: 'A' }, { id: 2, title: 'B' },
    ] });
    communitiesService.posts.mockResolvedValue({ data: { count: 4, results: [{}] } });

    const onOpenTab = vi.fn();
    render(
      <CommunityFounderOverview
        community={{
          id: 3,
          name: 'Dev Ayiti',
          created_by_username: 'jhon',
          current_user_role: 'owner',
          created_at: '2026-01-05T00:00:00Z',
          event_count: 5,
        }}
        slug={SLUG}
        onOpenTab={onOpenTab}
      />,
    );

    expect(await screen.findByText('@jhon')).toBeInTheDocument();
    expect(screen.getByText('Founder')).toBeInTheDocument();
    // Members, New (30 days), Pending, Announcements, Posts, Events
    expect(screen.getByText('4')).toBeInTheDocument(); // posts count
    expect(screen.getByText('5')).toBeInTheDocument(); // events count

    fireEvent.click(screen.getByRole('button', { name: /Manage members/i }));
    expect(onOpenTab).toHaveBeenCalledWith('members');

    fireEvent.click(screen.getByRole('button', { name: /Write an announcement/i }));
    expect(onOpenTab).toHaveBeenCalledWith('announcements');

    fireEvent.click(screen.getByRole('button', { name: /Plan an event/i }));
    expect(onOpenTab).toHaveBeenCalledWith('events');

    fireEvent.click(screen.getByRole('button', { name: /Share resources/i }));
    expect(onOpenTab).toHaveBeenCalledWith('resources');
  });
});

describe('CommunityMembersPanel', () => {
  const draw = () => render(
    <CommunityMembersPanel
      slug={SLUG}
      lang="en"
      showToast={vi.fn()}
      isOwner
      canModerate
      currentUserId={1}
    />,
  );

  it('approves a join request by user id', async () => {
    communitiesService.members.mockResolvedValue({ data: [
      { id: 1, user: 1, username: 'jhon', role: 'owner' },
    ] });
    communitiesService.joinRequests.mockResolvedValue({ data: [
      { id: 7, user_id: 42, username: 'hopeful' },
    ] });

    draw();
    fireEvent.click(await screen.findByRole('button', { name: 'Approve hopeful' }));

    await waitFor(() => {
      expect(communitiesService.approveJoinRequest).toHaveBeenCalledWith(SLUG, 42);
    });
  });

  it('promotes by membership id and bans after confirmation', async () => {
    communitiesService.members.mockResolvedValue({ data: [
      { id: 1, user: 1, username: 'jhon', role: 'owner' },
      { id: 3, user: 3, username: 'bob', role: 'member' },
    ] });

    draw();
    fireEvent.click(await screen.findByRole('button', { name: 'Promote bob' }));
    await waitFor(() => {
      expect(communitiesService.promote).toHaveBeenCalledWith(SLUG, 3, 'moderator');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Ban bob' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ban' }));
    await waitFor(() => {
      expect(communitiesService.banMember).toHaveBeenCalledWith(SLUG, 3, '');
    });
  });

  it('filters the roster by username', async () => {
    communitiesService.members.mockResolvedValue({ data: [
      { id: 1, user: 1, username: 'jhon', role: 'owner' },
      { id: 3, user: 3, username: 'bob', role: 'member' },
    ] });

    draw();
    const search = await screen.findByLabelText('Search members');
    fireEvent.change(search, { target: { value: 'bob' } });

    expect(screen.getByText('@bob')).toBeInTheDocument();
    expect(screen.queryByText('@jhon')).toBeNull();

    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.getByText('No members match your search.')).toBeInTheDocument();
  });

  it('shows a retry banner when the roster fails to load', async () => {
    communitiesService.members
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ data: [
        { id: 1, user: 1, username: 'jhon', role: 'owner' },
      ] });

    draw();
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Could not load the member roster.')).toBeInTheDocument();

    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('@jhon')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('CommunityAnnouncementsPanel', () => {
  it('publishes, pins and deletes an announcement', async () => {
    communitiesService.announcements.mockResolvedValue({ data: [
      { id: 11, title: 'Nouvo orè', content: 'Nou kòmanse 6è.', is_pinned: false },
    ] });

    render(<CommunityAnnouncementsPanel slug={SLUG} lang="en" showToast={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText('Announcement title'), {
      target: { value: 'Rankont' },
    });
    fireEvent.change(screen.getByLabelText('Announcement content'), {
      target: { value: 'Nou rankontre samdi.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Publish announcement/i }));

    await waitFor(() => {
      expect(communitiesService.createAnnouncement).toHaveBeenCalledWith(SLUG, {
        title: 'Rankont',
        content: 'Nou rankontre samdi.',
        is_pinned: false,
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Pin announcement' }));
    await waitFor(() => {
      expect(communitiesService.updateAnnouncement).toHaveBeenCalledWith(11, { is_pinned: true });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete announcement' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(() => {
      expect(communitiesService.deleteAnnouncement).toHaveBeenCalledWith(11);
    });
  });

  it('edits an existing announcement in place', async () => {
    communitiesService.announcements.mockResolvedValue({ data: [
      { id: 11, title: 'Nouvo orè', content: 'Nou kòmanse 6è.', is_pinned: false },
    ] });

    render(<CommunityAnnouncementsPanel slug={SLUG} lang="en" showToast={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Nouvo orè' }));
    expect(screen.getByLabelText('Announcement title')).toHaveValue('Nouvo orè');

    fireEvent.change(screen.getByLabelText('Announcement title'), {
      target: { value: 'Nouvo orè v2' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save changes/i }));

    await waitFor(() => {
      expect(communitiesService.updateAnnouncement).toHaveBeenCalledWith(11, {
        title: 'Nouvo orè v2',
        content: 'Nou kòmanse 6è.',
        is_pinned: false,
      });
    });
  });
});

describe('CommunityPostsPanel', () => {
  const POSTS = [
    {
      id: 5,
      author_username: 'marie',
      content: 'Nou gen yon nouvo pwojè!',
      is_pinned: false,
      reaction_count: 3,
      comment_count: 1,
      created_at: '2026-11-01T10:00:00Z',
    },
    {
      id: 6,
      author_username: 'spammer',
      content: 'Buy followers cheap',
      is_pinned: false,
      reaction_count: 0,
      comment_count: 0,
      created_at: '2026-11-02T10:00:00Z',
    },
  ];

  it('pins a post and deletes another after confirmation', async () => {
    communitiesService.posts.mockResolvedValue({ data: { count: 2, results: POSTS } });

    render(<CommunityPostsPanel slug={SLUG} lang="en" showToast={vi.fn()} canModerate />);

    fireEvent.click(await screen.findByRole('button', { name: 'Pin post by @marie' }));
    await waitFor(() => {
      expect(communitiesService.updatePost).toHaveBeenCalledWith(5, { is_pinned: true });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete post by @spammer' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(() => {
      expect(communitiesService.deletePost).toHaveBeenCalledWith(6);
    });
  });

  it('loads comments and lets a moderator delete one', async () => {
    communitiesService.posts.mockResolvedValue({ data: { count: 1, results: [{
      id: 5,
      author_username: 'marie',
      content: 'Ki jan nou fè pou enskri?',
      comment_count: 2,
      reaction_count: 0,
      created_at: '2026-11-01T10:00:00Z',
    }] } });
    communitiesService.comments.mockResolvedValue({ data: [
      {
        id: 101,
        author_username: 'troll',
        content: 'follow me for free crypto',
        created_at: '2026-11-01T11:00:00Z',
      },
    ] });

    render(<CommunityPostsPanel slug={SLUG} lang="en" showToast={vi.fn()} canModerate />);

    fireEvent.click(await screen.findByRole('button', { name: 'Comments (2)' }));
    expect(await screen.findByText('follow me for free crypto')).toBeInTheDocument();
    expect(communitiesService.comments).toHaveBeenCalledWith(5);

    fireEvent.click(screen.getByRole('button', { name: 'Delete comment by @troll' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(() => {
      expect(communitiesService.deleteComment).toHaveBeenCalledWith(101);
    });
  });

  it('filters posts by author or text', async () => {
    communitiesService.posts.mockResolvedValue({ data: { count: 2, results: POSTS } });

    render(<CommunityPostsPanel slug={SLUG} lang="en" showToast={vi.fn()} canModerate />);

    const search = await screen.findByLabelText('Search posts');
    fireEvent.change(search, { target: { value: 'followers' } });

    expect(screen.getByText(/Buy followers cheap/)).toBeInTheDocument();
    expect(screen.queryByText(/Nou gen yon nouvo pwojè/)).toBeNull();
  });
});

describe('CommunityEventsPanel', () => {
  it('creates a draft event with ISO schedule and the community id', async () => {
    render(
      <CommunityEventsPanel
        slug={SLUG}
        communityId={3}
        lang="en"
        showToast={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Create event/i }));
    fireEvent.change(screen.getByPlaceholderText('Event name'), {
      target: { value: 'Meetup dev' },
    });
    fireEvent.change(screen.getByLabelText('Starts'), {
      target: { value: '2026-12-01T18:00' },
    });
    fireEvent.change(screen.getByLabelText('Ends'), {
      target: { value: '2026-12-01T20:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create event/i }));

    await waitFor(() => {
      expect(communityEventsService.create).toHaveBeenCalledTimes(1);
    });
    const payload = communityEventsService.create.mock.calls[0][0];
    expect(payload).toMatchObject({
      title: 'Meetup dev',
      community: 3,
      is_free: true,
      timezone: 'America/Port-au-Prince',
    });
    expect(payload.start_time).toBe(new Date('2026-12-01T18:00').toISOString());
    expect(payload.end_time).toBe(new Date('2026-12-01T20:00').toISOString());
  });

  it('publishes a draft from the list', async () => {
    communityEventsService.list.mockResolvedValue({ data: [
      {
        id: 21,
        title: 'Launch',
        status: 'draft',
        start_time: '2026-12-01T18:00:00Z',
        end_time: '2026-12-01T20:00:00Z',
        is_free: true,
      },
    ] });

    render(
      <CommunityEventsPanel
        slug={SLUG}
        communityId={3}
        lang="en"
        showToast={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Publish Launch' }));
    await waitFor(() => {
      expect(communityEventsService.update).toHaveBeenCalledWith(21, { status: 'published' });
    });
  });

  it('opens the guest list and cancels a published event', async () => {
    communityEventsService.list.mockResolvedValue({ data: [
      {
        id: 31,
        title: 'Open house',
        status: 'published',
        start_time: '2026-12-01T18:00:00Z',
        end_time: '2026-12-01T20:00:00Z',
        is_free: true,
        attendee_count: 2,
      },
    ] });
    communityEventsService.attendees.mockResolvedValue({ data: [
      { id: 7, username: 'marie', status: 'confirmed', quantity: 2, price_paid: 0, currency: 'USD' },
    ] });

    render(
      <CommunityEventsPanel
        slug={SLUG}
        communityId={3}
        lang="en"
        showToast={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'View attendees for Open house' }));
    expect(await screen.findByText('@marie')).toBeInTheDocument();
    expect(communityEventsService.attendees).toHaveBeenCalledWith(31);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Open house' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel event' }),
    );
    await waitFor(() => {
      expect(communityEventsService.cancel).toHaveBeenCalledWith(31);
    });
  });
});

describe('CommunityFilesPanel', () => {
  it('links an unlinked course and unlinks a linked one', async () => {
    communitiesService.linkedCourses.mockResolvedValue({ data: [
      { id: 2, course: 10, course_title: 'React 101', added_by_username: 'jhon', is_featured: false },
    ] });
    courseService.getMyCoursesCI.mockResolvedValue({
      data: { courses: [
        { id: 10, title: 'React 101' },
        { id: 11, title: 'Next 101' },
      ] },
    });

    render(<CommunityFilesPanel slug={SLUG} lang="en" showToast={vi.fn()} canModerate />);

    const picker = await screen.findByRole('combobox');
    // Already-linked course is filtered out of the picker.
    expect(within(picker).queryByRole('option', { name: 'React 101' })).toBeNull();
    fireEvent.change(picker, { target: { value: '11' } });
    fireEvent.click(screen.getByRole('button', { name: /Link course/i }));

    await waitFor(() => {
      expect(communitiesService.linkCourse).toHaveBeenCalledWith(SLUG, { course: 11 });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Unlink React 101' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Unlink' }),
    );
    await waitFor(() => {
      expect(communitiesService.unlinkCourse).toHaveBeenCalledWith(2);
    });
  });
});
