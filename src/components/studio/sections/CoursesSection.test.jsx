import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../services/api', () => ({
  courseService: {
    getAll: vi.fn(),
    delete: vi.fn(),
    publish: vi.fn(),
  },
}));

vi.mock('../shared', () => ({
  StudioSkeleton: () => <div>Loading</div>,
  EmptyState: () => <div>Empty</div>,
  SectionHeader: ({ title }) => <h2>{title}</h2>,
  fmtCount: (value) => String(value),
}));

vi.mock('../../common/ConfirmModal', () => ({ default: () => null }));
vi.mock('../../shared/ContentLifecycleControls', () => ({ default: () => null }));
vi.mock('./CourseAnalyticsModal', () => ({ default: () => null }));
vi.mock('./CurriculumAnalyticsModal', () => ({ default: () => null }));
vi.mock('./CourseExportImportModal', () => ({ default: () => null }));

import { courseService } from '../../../services/api';
import CoursesSection from './CoursesSection';

describe('CoursesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    expect(await screen.findByText('In review')).toBeTruthy();
    expect(screen.queryByText('Published')).toBeNull();
    expect(screen.getByRole('link', { name: 'Preview course' }))
      .toHaveAttribute('href', '/sheet/course/7');
  });
});
