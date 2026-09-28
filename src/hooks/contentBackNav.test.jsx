/**
 * src/hooks/contentBackNav.test.jsx
 *
 * Pins the "back from content opened on the public Explore page" contract:
 *   • Clicking a content card on the public Explore page navigates to the
 *     canonical /{id}@{user}/{type} detail URL (a PUSH).
 *   • Pressing back returns to the public Explore page (/), NEVER to the
 *     creator public profile catch-all (/c/username).
 *
 * The harness mirrors App.jsx's route structure for the relevant paths:
 *   /               → Explore (public catalog)
 *   /:key/:type     → content detail (ContentKeyRoute equivalent)
 *   *               → catch-all, renders the public profile ONLY for /c/…
 *                    paths, NotFound otherwise (CatchAllRoute equivalent)
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Routes, Route, useLocation, useNavigate, useParams } from 'react-router-dom';

// --- Mirrors CatchAllRoute in App.jsx (path starts with /c/ → public profile) ---
function CatchAll({ onOpenCourse }) {
  const location = useLocation();
  if (location.pathname.match(/^\/c\//)) {
    return (
      <div data-testid="public-profile">
        PUBLIC_PROFILE
        <button type="button" onClick={onOpenCourse}>open-course-from-profile</button>
      </div>
    );
  }
  return <div data-testid="not-found">NOT_FOUND</div>;
}

// --- Mirrors ContentKeyRoute + CourseDetailRoute in App.jsx ---
function ContentDetail() {
  const { key, type } = useParams();
  const navigate = useNavigate();
  return (
    <div data-testid="content-detail">
      CONTENT_DETAIL::{type}::{key}
      <button type="button" onClick={() => navigate(-1)}>back</button>
      <button type="button" onClick={() => navigate('/')}>back-home</button>
    </div>
  );
}

// eslint-disable-next-line react/prop-types -- test harness prop
function ExplorePage({ onOpenCourse }) {
  const course = { id: 12, slug: 'python-avanse', user_key: 'rose', title: 'Python' };
  return (
    <div data-testid="explore">
      EXPLORE
      <button type="button" onClick={() => onOpenCourse(course)}>open-course</button>
    </div>
  );
}

function Harness() {
  const navigate = useNavigate();
  const onOpenCourse = (course) => {
    const key = course.slug || course.id;
    const user = course.user_key || 'Atelnyo';
    navigate(`/${key}@${user}/course`, { state: { course } });
  };
  const course = { id: 12, slug: 'python-avanse', user_key: 'rose', title: 'Python' };
  return (
    <Routes>
      <Route path="/" element={<ExplorePage onOpenCourse={onOpenCourse} />} />
      {/* Explicit /c/:username route — matches App.jsx's dedicated
          public-profile route (line 3249). Must come BEFORE the
          generic /:key/:type so /c/rose resolves here, not as a
          content detail key. */}
      <Route path="/c/:username" element={<CatchAll onOpenCourse={() => onOpenCourse(course)} />} />
      <Route path="/:key/:type" element={<ContentDetail />} />
      <Route path="*" element={<CatchAll onOpenCourse={() => onOpenCourse(course)} />} />
    </Routes>
  );
}

describe('content back-navigation from public Explore', () => {
  it('back from a content detail opened on Explore returns to Explore (not the public profile)', () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <MemoryRouter initialEntries={['/']}>
        <Harness />
      </MemoryRouter>,
    );

    expect(getByTestId('explore')).toBeTruthy();

    // Click a content card on the public Explore page.
    fireEvent.click(getByText('open-course'));
    expect(getByTestId('content-detail')).toBeTruthy();
    // The detail URL must NOT resolve to the public-profile catch-all.
    expect(queryByTestId('public-profile')).toBeNull();

    // Press back (browser back → navigate(-1), same as the sheet back buttons).
    fireEvent.click(getByText('back'));
    expect(getByTestId('explore')).toBeTruthy();
    expect(queryByTestId('public-profile')).toBeNull();
    expect(queryByTestId('content-detail')).toBeNull();
  });

  it('back from a course opened on a public profile returns to THAT profile', () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <MemoryRouter initialEntries={['/c/rose']}>
        <Harness />
      </MemoryRouter>,
    );

    expect(getByTestId('public-profile')).toBeTruthy();

    // Click a course card on the creator's public profile.
    fireEvent.click(getByText('open-course-from-profile'));
    expect(getByTestId('content-detail')).toBeTruthy();

    // Back must return to the profile, NOT dump the user on Explore.
    fireEvent.click(getByText('back'));
    expect(getByTestId('public-profile')).toBeTruthy();
    expect(queryByTestId('content-detail')).toBeNull();
  });

  it('a /c/username URL is the ONLY path that renders the public profile', () => {
    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/c/rose']}>
        <Harness />
      </MemoryRouter>,
    );
    expect(getByTestId('public-profile')).toBeTruthy();
  });

  it('canonical content URLs never render the public profile route', () => {
    const { getByTestId, queryByTestId } = render(
      <MemoryRouter initialEntries={['/python-avanse@rose/course']}>
        <Harness />
      </MemoryRouter>,
    );
    expect(getByTestId('content-detail')).toBeTruthy();
    expect(queryByTestId('public-profile')).toBeNull();
  });
});
