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

  it('renders Spanish copy and portals the panel to the body', async () => {
    render(
      <ContentFeedbackMenu contentType="post" contentId={7} lang="es" />,
    );

    await userEvent.click(screen.getByRole('button', { name: /más opciones/i }));
    const panel = screen.getByRole('menu', { name: /más opciones/i });

    expect(panel.parentElement).toBe(document.body);
    expect(screen.getByRole('menuitem', { name: /no me interesa/i })).toBeTruthy();
  });

  it('closes on Escape and on an outside click', async () => {
    render(
      <ContentFeedbackMenu contentType="post" contentId={8} lang="en" />,
    );

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    expect(screen.getByRole('menu')).toBeTruthy();
    await userEvent.click(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('uses theme surface and text tokens for the panel', async () => {
    render(
      <ContentFeedbackMenu contentType="post" contentId={9} lang="en" />,
    );

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    const style = screen.getByRole('menu').getAttribute('style') || '';

    expect(style).toContain('var(--card-bg');
    expect(style).toContain('var(--text-main');
    expect(style).toContain('overflow-y: auto');
  });

  it('reports with the generic reason by default', async () => {
    contentFeedbackService.report.mockResolvedValue({ data: {} });
    render(
      <ContentFeedbackMenu contentType="post" contentId={2} lang="en" />,
    );

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /^report$/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /^other$/i }));

    await waitFor(() =>
      expect(contentFeedbackService.report).toHaveBeenCalledWith('post', 2, 'other'),
    );
  });
});
