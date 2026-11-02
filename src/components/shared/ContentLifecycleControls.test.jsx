/**
 * ContentLifecycleControls — the publish control must reflect the
 * backend state and surface field-level validation errors instead of a
 * generic failure.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../services/api', () => ({
  contentStateService: {
    publish: vi.fn(),
    unpublish: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
    schedule: vi.fn(),
    visibility: vi.fn(),
  },
}));

import { contentStateService } from '../../services/api';
import ContentLifecycleControls from './ContentLifecycleControls';

const draft = {
  publication_state: 'draft',
  visibility: 'public',
  effective_distribution: 'excluded',
  is_discoverable: false,
};

describe('ContentLifecycleControls', () => {
  beforeEach(() => vi.clearAllMocks());

  it('publishes a draft and renders the returned published state', async () => {
    contentStateService.publish.mockResolvedValue({
      data: {
        publication_state: 'published',
        visibility: 'public',
        effective_distribution: 'normal',
        is_discoverable: true,
      },
    });

    render(
      <ContentLifecycleControls
        contentType="post"
        objectId={7}
        initialState={draft}
        lang="en"
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /publish/i }));
    await waitFor(() => expect(contentStateService.publish).toHaveBeenCalledWith('post', 7));
    expect(await screen.findByText(/in discovery/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unpublish/i })).toBeInTheDocument();
  });

  it('renders structured validation errors from the backend', async () => {
    contentStateService.publish.mockRejectedValue({
      response: {
        data: {
          detail: 'Content failed validation.',
          errors: { body: ['This field is required to publish.'] },
        },
      },
    });

    render(
      <ContentLifecycleControls contentType="post" objectId={9} lang="en" />,
    );

    await userEvent.click(screen.getByRole('button', { name: /publish/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/content failed validation/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/body/i);
  });

  it('changes visibility through the dedicated endpoint', async () => {
    contentStateService.visibility.mockResolvedValue({
      data: {
        publication_state: 'published',
        visibility: 'private',
        effective_distribution: 'excluded',
        is_discoverable: false,
      },
    });

    render(
      <ContentLifecycleControls
        contentType="course"
        objectId={3}
        initialState={{ ...draft, publication_state: 'published' }}
        lang="en"
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText(/visibility/i), 'private');
    await waitFor(() =>
      expect(contentStateService.visibility).toHaveBeenCalledWith('course', 3, 'private'),
    );
  });
});
