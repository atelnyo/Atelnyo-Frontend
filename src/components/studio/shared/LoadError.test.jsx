import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import LoadError from './LoadError';

describe('LoadError', () => {
  it('announces the failure and retries through the given handler', async () => {
    const onRetry = vi.fn();
    render(
      <LoadError
        title="Could not load your music"
        error={{ response: { status: 503, data: { detail: 'Service unavailable' } } }}
        onRetry={onRetry}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Could not load your music');
    expect(alert).toHaveTextContent('Check your connection');

    // A failure is never swallowed: status + backend detail stay visible.
    expect(alert).toHaveTextContent('HTTP 503');
    expect(alert).toHaveTextContent('Service unavailable');

    await userEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('hides the retry button when no handler is supplied', () => {
    render(<LoadError error={new Error('offline')} />);

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('falls back to the error message when the backend sends no detail', () => {
    render(<LoadError error={new Error('Network down')} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Network down');
    expect(screen.queryByText(/HTTP/)).toBeNull();
  });

  it('speaks Creole when the studio language is ht', () => {
    render(<LoadError lang="ht" error={{ response: { status: 500 } }} onRetry={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Pa t kapab chaje seksyon sa a');
    expect(screen.getByRole('button', { name: /Eseye ankò/ })).toBeTruthy();
  });
});
