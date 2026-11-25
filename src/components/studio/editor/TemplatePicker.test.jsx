import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../services/api', () => ({
  courseService: { templates: vi.fn(), templateDetail: vi.fn() },
}));

import { courseService } from '../../../services/api';
import TemplatePicker from './TemplatePicker';

const TEMPLATES = [
  {
    key: 'business',
    name: 'Kou Biznis',
    name_en: 'Business Course',
    description: 'Gid pou biznis.',
    description_en: 'A guide for business courses.',
    icon: '💼',
    difficulty: 'intermediate',
    module_count: 5,
  },
  {
    key: 'blank',
    name: 'Kou Venn',
    name_en: 'Blank Course',
    description: 'Kòmanse vid.',
    description_en: 'Start empty.',
    icon: '📝',
    difficulty: 'beginner',
    module_count: 0,
  },
];

describe('TemplatePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // No preview payload by default: tests that care about the outline
    // opt in explicitly.
    courseService.templateDetail.mockResolvedValue({ data: null });
  });

  it('shows a busy card skeleton while templates load, then the catalog', async () => {
    let resolve;
    courseService.templates.mockReturnValue(new Promise((r) => { resolve = r; }));

    render(<TemplatePicker lang="en" onSelect={vi.fn()} />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Loading templates');

    resolve({ data: { templates: TEMPLATES } });

    expect(await screen.findByText('Business Course')).toBeTruthy();
    expect(screen.getByText('5 modules')).toBeTruthy();
    expect(screen.getByText('Intermediate')).toBeTruthy();
    expect(screen.queryByRole('status', { busy: true })).toBeNull();
  });

  it('reports the chosen key and toggles the selection off', async () => {
    courseService.templates.mockResolvedValue({ data: { templates: TEMPLATES } });
    const onSelect = vi.fn();
    const { rerender } = render(<TemplatePicker lang="en" onSelect={onSelect} />);

    const business = await screen.findByRole('button', { name: /Business Course/ });
    expect(business).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(business);
    expect(onSelect).toHaveBeenCalledWith('business');

    rerender(<TemplatePicker lang="en" value="business" onSelect={onSelect} />);
    expect(business).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/applied to the course right after/i)).toBeTruthy();

    await userEvent.click(business);
    expect(onSelect).toHaveBeenLastCalledWith('');
  });

  it('previews the outline of the selected template before applying', async () => {
    courseService.templates.mockResolvedValue({ data: { templates: TEMPLATES } });
    courseService.templateDetail.mockResolvedValue({
      data: {
        key: 'business',
        module_count: 2,
        block_count: 3,
        estimated_hours: 1.5,
        objectives: ['Objektif youn'],
        objectives_en: ['First objective'],
        modules: [
          { position: 1, title: 'Entwodiksyon', block_count: 2, estimated_minutes: 25, block_types: ['text'] },
          { position: 2, title: 'Pratik', block_count: 1, estimated_minutes: 15, block_types: ['exercise'] },
        ],
      },
    });

    render(<TemplatePicker lang="en" value="business" onSelect={vi.fn()} />);

    expect(await screen.findByText('What this template gives you')).toBeTruthy();
    expect(courseService.templateDetail).toHaveBeenCalledWith('business');
    expect(screen.getByText('First objective')).toBeTruthy();
    expect(screen.getByText('Entwodiksyon')).toBeTruthy();
    expect(screen.getByText(/1\.5 h/)).toBeTruthy();
    expect(screen.getByText(/2 modules · 3 blocks/)).toBeTruthy();
  });

  it('still offers the template when only the preview request fails', async () => {
    courseService.templates.mockResolvedValue({ data: { templates: TEMPLATES } });
    courseService.templateDetail.mockRejectedValue(new Error('offline'));

    render(<TemplatePicker lang="en" value="business" onSelect={vi.fn()} />);

    expect(await screen.findByText(/preview could not load/i)).toBeTruthy();
    expect(screen.getByText(/applied to the course right after/i)).toBeTruthy();
  });

  it('offers a retry when the catalog request fails', async () => {
    courseService.templates.mockRejectedValueOnce(new Error('offline'));
    render(<TemplatePicker lang="en" onSelect={vi.fn()} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load the templates.');

    courseService.templates.mockResolvedValueOnce({ data: { templates: TEMPLATES } });
    await userEvent.click(screen.getByRole('button', { name: /Retry/ }));

    await waitFor(() => expect(screen.getByText('Business Course')).toBeTruthy());
  });
});
