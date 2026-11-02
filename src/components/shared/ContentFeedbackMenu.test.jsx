import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../services/api', () => ({
  contentFeedbackService: {
    hide: vi.fn(),
    notInterested: vi.fn(),
    muteCreator: vi.fn(),
    blockCreator: vi.fn(),
    report: vi.fn(),
  },
}));

import { contentFeedbackService } from '../../services/api';
import ContentFeedbackMenu from './ContentFeedbackMenu';

describe('ContentFeedbackMenu', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends not-interested for the card and closes the menu', async () => {
    contentFeedbackService.notInterested.mockResolvedValue({ data: {} });
    const onDone = vi.fn();
    render(
      <ContentFeedbackMenu contentType="post" contentId={11} lang="en" onDone={onDone} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /not interested/i }));

    await waitFor(() =>
      expect(contentFeedbackService.notInterested).toHaveBeenCalledWith('post', 11),
    );
    expect(onDone).toHaveBeenCalled();
  });

  it('does not bubble card clicks when opening the menu', async () => {
    const onParentClick = vi.fn();
    render(
      <div onClick={onParentClick}>
        <ContentFeedbackMenu contentType="course" contentId={4} lang="en" />
      </div>,
    );

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('reports with the generic reason by default', async () => {
    contentFeedbackService.report.mockResolvedValue({ data: {} });
    render(
      <ContentFeedbackMenu contentType="post" contentId={2} lang="en" />,
    );

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /^report$/i }));

    await waitFor(() =>
      expect(contentFeedbackService.report).toHaveBeenCalledWith('post', 2, 'other'),
    );
  });
});
