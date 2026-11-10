import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../services/api', () => ({
  courseService: {
    getById: vi.fn(),
    getMyCoursesCI: vi.fn(),
    getIntelligenceManaged: vi.fn(),
    unpublishIntelligenceManaged: vi.fn(),
    publishIntelligenceManaged: vi.fn(),
  },
}));

vi.mock('../../../services/affiliateApi', () => ({
  affiliateApi: { getIntelligenceMetrics: vi.fn() },
}));

vi.mock('../../../hooks/useRoleGate', () => ({
  useRoleGate: vi.fn(),
}));

import { courseService } from '../../../services/api';
import { affiliateApi } from '../../../services/affiliateApi';
import { useRoleGate } from '../../../hooks/useRoleGate';
import IntelligenceSection from './IntelligenceSection';

const COURSE = {
  id: 12,
  title: 'My course',
  status: 'published',
  intelligence_status: 'ready',
  skills: [],
};

describe('IntelligenceSection course actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    courseService.getMyCoursesCI.mockResolvedValue({
      data: { count: 1, courses: [COURSE] },
    });
    courseService.getById.mockResolvedValue({
      data: { ...COURSE, description: 'Owner course data' },
    });
    courseService.getIntelligenceManaged.mockResolvedValue({
      data: { ...COURSE, description: 'Full course data' },
    });
    courseService.unpublishIntelligenceManaged.mockResolvedValue({ data: { ...COURSE, status: 'draft' } });
    courseService.publishIntelligenceManaged.mockResolvedValue({ data: { ...COURSE, status: 'published' } });
    affiliateApi.getIntelligenceMetrics.mockResolvedValue({ data: null });
    useRoleGate.mockReturnValue({ allowed: true, loading: false });
  });

  it('loads the complete course before opening the editor', async () => {
    const onEdit = vi.fn();
    render(<IntelligenceSection lang="en" showToast={vi.fn()} onEdit={onEdit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Content AI' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));

    await waitFor(() => expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 12,
        description: 'Full course data',
        _intelligenceAdminManaged: true,
      }),
    ));
    expect(courseService.getIntelligenceManaged).toHaveBeenCalledWith(12);
  });

  it('moves a published course back to draft and refreshes the list', async () => {
    render(<IntelligenceSection lang="en" showToast={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Content AI' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Move to draft' }));

    await waitFor(() => expect(courseService.unpublishIntelligenceManaged).toHaveBeenCalledWith(12));
    await waitFor(() => expect(courseService.getMyCoursesCI).toHaveBeenCalledTimes(2));
  });

  it('lets an admin republish a draft course and refreshes the list', async () => {
    courseService.getMyCoursesCI.mockResolvedValue({
      data: { count: 1, courses: [{ ...COURSE, status: 'draft' }] },
    });
    render(<IntelligenceSection lang="en" showToast={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Content AI' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(courseService.publishIntelligenceManaged).toHaveBeenCalledWith(12));
    await waitFor(() => expect(courseService.getMyCoursesCI).toHaveBeenCalledTimes(2));
  });

  it('lets a creator edit their own course without granting admin actions', async () => {
    useRoleGate.mockReturnValue({ allowed: false, loading: false });
    const onEdit = vi.fn();
    render(<IntelligenceSection lang="en" showToast={vi.fn()} onEdit={onEdit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Content AI' }));

    expect(await screen.findByText('My course')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await waitFor(() => expect(courseService.getById).toHaveBeenCalledWith(12));
    await waitFor(() => expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: 12, description: 'Owner course data' }),
    ));
    expect(onEdit.mock.calls[0][0]._intelligenceAdminManaged).toBeUndefined();
    expect(courseService.getIntelligenceManaged).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Move to draft' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Process' })).toBeTruthy();
  });
});
