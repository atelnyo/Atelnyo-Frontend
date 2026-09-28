/**
 * src/hooks/ScrollManager.test.jsx
 *
 * Pins the route-level scroll contract:
 *   • Detail pages ALWAYS open at the top — a leftover catalog scroll
 *     must never carry into a detail route (the "detail opens at the
 *     bottom" bug).
 *   • The catalog ("/") saves its position when you leave and restores
 *     it when you return.
 *   • Detail-page scroll positions are NEVER written into the catalog
 *     slot ("scrolling down one surface affects another").
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import ScrollManager from './ScrollManager';

vi.mock('../pwa/continuity/ContinuityManager', () => ({
  default: {
    saveScrollPosition: vi.fn().mockResolvedValue(undefined),
    restoreScrollPosition: vi.fn().mockResolvedValue(0),
  },
}));

import continuityManager from '../pwa/continuity/ContinuityManager';

function Nav({ to, label }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)}>
      {label}
    </button>
  );
}

function Harness() {
  return (
    <MemoryRouter initialEntries={['/']}>
      <ScrollManager />
      <Routes>
        <Route
          path="/"
          element={<><Nav to="/12@user/course" label="open-course" />HOME</>}
        />
        <Route
          path="/12@user/course"
          element={<><Nav to="/" label="back-home" />DETAIL</>}
        />
        <Route
          path="/other"
          element={<><Nav to="/" label="back-home-2" />OTHER</>}
        />
      </Routes>
    </MemoryRouter>
  );
}

function setScrollY(y) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true });
}

beforeEach(() => {
  setScrollY(0);
  window.scrollTo = vi.fn();
  vi.clearAllMocks();
});

describe('ScrollManager', () => {
  it('opens detail pages at the TOP (never mid-page from the catalog)', () => {
    setScrollY(500); // catalog scrolled down
    const { getByText } = render(<Harness />);

    fireEvent.click(getByText('open-course'));

    // Leaving the catalog saved its position, and the detail starts at 0.
    expect(continuityManager.saveScrollPosition).toHaveBeenCalledWith('/', 500);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('restores the catalog position when returning from a detail', async () => {
    continuityManager.restoreScrollPosition.mockResolvedValue(500);
    const { getByText } = render(<Harness />);

    fireEvent.click(getByText('open-course')); // detail at top
    fireEvent.click(getByText('back-home'));   // back to the catalog

    await waitFor(() => {
      expect(continuityManager.restoreScrollPosition).toHaveBeenCalledWith('/');
      expect(window.scrollTo).toHaveBeenCalledWith(0, 500);
    });
  });

  it('never writes a detail-page position into the catalog slot', () => {
    const { getByText } = render(<Harness />);

    fireEvent.click(getByText('open-course')); // enter detail
    setScrollY(800);                           // detail page scrolled deep
    fireEvent.click(getByText('back-home'));   // return to catalog

    // The detail route must never have been saved — only the catalog's
    // own leave-position ('/' at 0, since the catalog was at top).
    expect(continuityManager.saveScrollPosition).not.toHaveBeenCalledWith(
      '/12@user/course', expect.anything(),
    );
    expect(continuityManager.saveScrollPosition).toHaveBeenCalledWith('/', 0);
  });
});
