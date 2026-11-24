import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../services/api', () => ({
  courseService: {
    getAll: vi.fn(),
    delete: vi.fn(),
    publish: vi.fn(),
    transition: vi.fn(),
  },
}));

vi.mock('../shared', () => ({
  StudioSkeleton: () => <div>Loading</div>,
  CourseSectionSkeleton: () => <div>Loading</div>,
  EmptyState: () => <div>Empty</div>,
  SectionHeader: ({ title }) => <h2>{title}</h2>,
  fmtCount: (value) => String(value),
}));

vi.mock('../../common/ConfirmModal', () => ({
  default: ({ title, onConfirm }) => (
    <div>
      <span>{title}</span>
      <button type="button" onClick={onConfirm}>Confirm</button>
    </div>
  ),
}));
vi.mock('../../shared/ContentLifecycleControls', () => ({ default: () => null }));
vi.mock('./CourseAnalyticsModal', () => ({ default: () => null }));
vi.mock('./CurriculumAnalyticsModal', () => ({ default: () => null }));
vi.mock('./CourseExportImportModal', () => ({ default: () => null }));
vi.mock('./CourseTemplateModal', () => ({
  default: ({ course }) => <div>Outline picker for {course.title}</div>,
}));

import { courseService } from '../../../services/api';
import CoursesSection from './CoursesSection';

describe('CoursesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('shows existing courses beyond the first ten rows', async () => {
    const courses = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      title: `Course ${index + 1}`,
      status: 'published',
      price: 0,
    }));
    courseService.getAll.mockResolvedValue({ data: { results: courses } });

    render(
      <CoursesSection
        lang="en"
        t={{}}
        showToast={vi.fn()}
        setShowCourseModal={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(await screen.findByText('Course 12')).toBeTruthy();
  });

  it('surfaces a failed request instead of pretending there are no courses', async () => {
    courseService.getAll.mockRejectedValue({
      response: { data: { detail: 'Authentication required.' } },
    });

    render(
      <CoursesSection
        lang="en"
        t={{}}
        showToast={vi.fn()}
        setShowCourseModal={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load your courses.');
    expect(alert).toHaveTextContent('Authentication required.');
  });

  it('labels non-published lifecycle states and lets the owner preview a draft', async () => {
    courseService.getAll.mockResolvedValue({
      data: {
        results: [{ id: 7, title: 'Draft course', status: 'review', price: 0 }],
      },
    });

    render(
      <CoursesSection
        lang="en"
        t={{}}
        showToast={vi.fn()}
        setShowCourseModal={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    // Scope to the row badge: the status filter chip carries the same
    // label ("In review") and must not be mistaken for it.
    expect(await screen.findByText('In review', { selector: 'span' })).toBeTruthy();
    expect(screen.queryByText('Published', { selector: 'span' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Preview course' }))
      .toHaveAttribute('href', '/sheet/course/7');
  });

  it('filters by search and lifecycle status, and can clear the filters', async () => {
    courseService.getAll.mockResolvedValue({
      data: {
        results: [
          { id: 1, title: 'Watercolor basics', status: 'published', price: 20 },
          { id: 2, title: 'Guitar for beginners', status: 'draft', price: 0 },
        ],
      },
    });
    const user = userEvent.setup();

    render(
      <CoursesSection
        lang="en"
        t={{}}
        showToast={vi.fn()}
        setShowCourseModal={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(await screen.findByText('Watercolor basics')).toBeTruthy();
    expect(screen.getByText('Guitar for beginners')).toBeTruthy();
    expect(screen.getByText('2 / 2')).toBeTruthy();

    // Search is client-side: it narrows the rows without another request.
    await user.type(screen.getByRole('searchbox'), 'guitar');
    expect(screen.queryByText('Watercolor basics')).toBeNull();
    expect(screen.getByText('Guitar for beginners')).toBeTruthy();
    expect(screen.getByText('1 / 2')).toBeTruthy();
    expect(courseService.getAll).toHaveBeenCalledTimes(1);

    // A filter that matches nothing explains itself and offers a reset.
    await user.click(screen.getByRole('button', { name: 'Published' }));
    expect(await screen.findByText('No courses match this search or filter.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Watercolor basics')).toBeTruthy();
    expect(screen.getByText('Guitar for beginners')).toBeTruthy();
    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('sorts by title and remembers the sort across visits', async () => {
    courseService.getAll.mockResolvedValue({
      data: {
        results: [
          { id: 1, title: 'Beta', status: 'published', price: 0 },
          { id: 2, title: 'Alpha', status: 'published', price: 0 },
        ],
      },
    });
    const user = userEvent.setup();

    render(
      <CoursesSection
        lang="en"
        t={{}}
        showToast={vi.fn()}
        setShowCourseModal={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await screen.findByText('Beta');
    await user.selectOptions(screen.getByRole('combobox'), 'title');

    expect(screen.getAllByText(/^(Alpha|Beta)$/).map((node) => node.textContent))
      .toEqual(['Alpha', 'Beta']);
    expect(JSON.parse(window.localStorage.getItem('atelnyo.studio.courses.prefs')))
      .toEqual({ status: 'all', sort: 'title' });
  });

  it('restores the saved status view and offers an outline only for empty courses', async () => {
    window.localStorage.setItem(
      'atelnyo.studio.courses.prefs',
      JSON.stringify({ status: 'draft', sort: 'title' }),
    );
    courseService.getAll.mockResolvedValue({
      data: {
        results: [
          { id: 1, title: 'Empty draft', status: 'draft', price: 0, syllabus: [] },
          { id: 2, title: 'Full draft', status: 'draft', price: 0, syllabus: [{ title: 'Module 1' }] },
        ],
      },
    });
    const user = userEvent.setup();

    render(
      <CoursesSection
        lang="en"
        t={{}}
        showToast={vi.fn()}
        setShowCourseModal={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await screen.findByText('Empty draft');
    expect(screen.getByRole('button', { name: 'Drafts' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('combobox')).toHaveValue('title');

    const outlineButtons = screen.getAllByTitle('Add a starter outline');
    expect(outlineButtons).toHaveLength(1);
    await user.click(outlineButtons[0]);
    expect(screen.getByText('Outline picker for Empty draft')).toBeTruthy();
  });

  it('publishes the selected drafts in bulk and keeps the ones that are not ready', async () => {
    courseService.getAll.mockResolvedValue({
      data: {
        results: [
          { id: 1, title: 'Draft one', status: 'draft', price: 0 },
          { id: 2, title: 'Draft two', status: 'building', price: 0 },
          { id: 3, title: 'Live one', status: 'published', price: 0 },
        ],
      },
    });
    courseService.publish.mockImplementation((id) => (id === 2
      ? Promise.reject({ response: { data: { errors: { image_url: ['required'] } } } })
      : Promise.resolve({ data: { status: 'published' } })));
    const showToast = vi.fn();
    const user = userEvent.setup();

    render(
      <CoursesSection
        lang="en"
        t={{}}
        showToast={showToast}
        setShowCourseModal={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await screen.findByText('Draft one');
    await user.click(screen.getByRole('checkbox', { name: 'Select all shown' }));
    expect(screen.getByText('3 selected')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Publish selected' }));

    // Already-published courses are not republished; the failed one stays
    // ticked so the creator can fix it and retry with one click.
    await waitFor(() => expect(courseService.publish).toHaveBeenCalledTimes(2));
    expect(courseService.publish).toHaveBeenCalledWith(1);
    expect(courseService.publish).toHaveBeenCalledWith(2);
    expect(screen.getByText('1 selected')).toBeTruthy();
    expect(showToast).toHaveBeenCalledWith(
      '1 published, 1 not ready — Add a cover image.',
      'circle-exclamation',
    );
  });

  it('archives the selected courses only after confirmation', async () => {
    courseService.getAll.mockResolvedValue({
      data: {
        results: [
          { id: 1, title: 'Live one', status: 'published', price: 0 },
          { id: 2, title: 'Live two', status: 'updating', price: 0 },
        ],
      },
    });
    courseService.transition.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(
      <CoursesSection
        lang="en"
        t={{}}
        showToast={vi.fn()}
        setShowCourseModal={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await screen.findByText('Live one');
    await user.click(screen.getByRole('checkbox', { name: 'Select all shown' }));
    await user.click(screen.getByRole('button', { name: 'Archive selected' }));
    expect(screen.getByText('Archive 2 courses')).toBeTruthy();
    expect(courseService.transition).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(courseService.transition).toHaveBeenCalledTimes(2));
    expect(courseService.transition).toHaveBeenCalledWith(1, 'archived');
    expect(courseService.transition).toHaveBeenCalledWith(2, 'archived');
  });
});
