import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../services/api', () => ({
  courseService: { applyTemplate: vi.fn() },
}));

// The picker owns its own catalog/loading behaviour (covered by
// TemplatePicker.test.jsx); here it only needs to report a selection.
vi.mock('../editor/TemplatePicker', () => ({
  default: ({ onSelect, appliedNote }) => (
    <div>
      <button type="button" onClick={() => onSelect('business')}>Pick business</button>
      {appliedNote && <p>{appliedNote}</p>}
    </div>
  ),
}));

import { courseService } from '../../../services/api';
import CourseTemplateModal from './CourseTemplateModal';

const course = { id: 12, title: 'Kou Biznis', syllabus: [] };

describe('CourseTemplateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies the selected template and closes only after the server confirms', async () => {
    courseService.applyTemplate.mockResolvedValue({ data: { modules: 5 } });
    const showToast = vi.fn();
    const onApplied = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <CourseTemplateModal
        course={course}
        lang="en"
        showToast={showToast}
        onClose={onClose}
        onApplied={onApplied}
      />,
    );

    // No template chosen yet: the action is inert instead of firing a
    // 400 from the backend.
    expect(screen.getByRole('button', { name: 'Apply template' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Pick business' }));
    await user.click(screen.getByRole('button', { name: 'Apply template' }));

    expect(courseService.applyTemplate).toHaveBeenCalledWith(12, 'business');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onApplied).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('✅ Template applied — 5 modules.', 'check-circle');
  });

  it('keeps the dialog open and explains a server refusal', async () => {
    courseService.applyTemplate.mockRejectedValue({
      response: { data: { error: 'Course already has content. Clear it first or create a new course.' } },
    });
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <CourseTemplateModal course={course} lang="en" onClose={onClose} onApplied={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Pick business' }));
    await user.click(screen.getByRole('button', { name: 'Apply template' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Course already has content.');
    expect(onClose).not.toHaveBeenCalled();
  });
});
