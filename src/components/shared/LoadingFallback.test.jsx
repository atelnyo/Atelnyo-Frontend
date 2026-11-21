// @vitest-environment jsdom
/**
 * LoadingFallback — the Suspense fallback that gives a lazy load a deadline.
 *
 * Without a deadline, a chunk request that is accepted but never answered
 * leaves the user on a skeleton forever (the /sheet/studio symptom: the
 * Creator Studio chunk simply never appears and nothing explains why). These
 * tests pin the three states of the fallback: loading, explaining, reloading.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import LoadingFallback from './LoadingFallback';

describe('LoadingFallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows a busy section skeleton first, with the same loading copy', () => {
    render(<LoadingFallback lang="en" />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Loading…');
    expect(status.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the full-page skeleton shell for route-level loads', () => {
    render(<LoadingFallback fullPage lang="fr" />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Chargement…');
    expect(status.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps spinning until the deadline actually passes', () => {
    render(<LoadingFallback timeoutMs={5000} />);

    act(() => { vi.advanceTimersByTime(4999); });

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('explains the wait and offers a reload once the deadline passes', () => {
    render(<LoadingFallback lang="ht" timeoutMs={5000} />);

    act(() => { vi.advanceTimersByTime(5000); });

    // The spinner is gone — no more endless "Chajman…" with no way out.
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('Sa ap pran twòp tan');
    expect(screen.getByRole('button', { name: 'Rechaje paj la' })).toBeTruthy();
  });

  it('reloads the page when the user taps the button', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });

    render(<LoadingFallback timeoutMs={1000} />);
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => { screen.getByRole('button').click(); });

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('falls back to English for an unknown language', () => {
    render(<LoadingFallback lang="pt-BR" timeoutMs={1000} />);

    act(() => { vi.advanceTimersByTime(1000); });

    expect(screen.getByRole('alert')).toHaveTextContent('This is taking longer than usual');
  });
});
