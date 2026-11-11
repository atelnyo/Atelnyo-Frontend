import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import VideoEmbedFrame from './VideoEmbedFrame';

describe('VideoEmbedFrame', () => {
  it('shows a loading status until the embed iframe loads', () => {
    render(
      <VideoEmbedFrame
        src="https://www.youtube.com/embed/video-id"
        title="Test video"
        lang="ht"
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Ap chaje videyo a...');
    fireEvent.load(screen.getByTitle('Test video'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the loading status again when the video URL changes', () => {
    const { rerender } = render(
      <VideoEmbedFrame src="https://www.youtube.com/embed/first" />,
    );
    fireEvent.load(screen.getByTitle('Video'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    rerender(<VideoEmbedFrame src="https://player.vimeo.com/video/second" />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading video...');
  });
});
