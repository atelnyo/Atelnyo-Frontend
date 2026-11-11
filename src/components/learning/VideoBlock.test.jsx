import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import VideoBlock from './VideoBlock';

describe('VideoBlock', () => {
  it('shows a visible loading state for embeds and resets when the URL changes', () => {
    const firstBlock = {
      title: 'Lesson video',
      videoUrl: 'https://www.youtube.com/watch?v=first1234567',
    };
    const { rerender } = render(<VideoBlock block={firstBlock} lang="ht" />);

    expect(screen.getByRole('status')).toHaveTextContent('Ap chaje videyo...');
    fireEvent.load(screen.getByTitle('Lesson video'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    rerender(
      <VideoBlock
        block={{ ...firstBlock, videoUrl: 'https://vimeo.com/123456789' }}
        lang="ht"
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Ap chaje videyo...');
  });

  it('shows loading feedback for direct video files until media data is ready', () => {
    render(
      <VideoBlock
        block={{ title: 'Uploaded video', videoUrl: 'https://cdn.example.com/video.mp4' }}
        lang="en"
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading video...');
    fireEvent.loadedData(screen.getByLabelText('Uploaded video'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
