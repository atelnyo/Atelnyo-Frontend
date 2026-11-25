import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

function Probe() {
  const { section } = useParams();
  return <p>{section ? `section:${section}` : 'section:none'}</p>;
}

const routes = (
  <Routes>
    <Route path="/studio/:section?" element={<Probe />} />
  </Routes>
);

describe('Studio route shape', () => {
  it('matches the bare /studio root without a section param', () => {
    render(<MemoryRouter initialEntries={['/studio']}>{routes}</MemoryRouter>);

    expect(screen.getByText('section:none')).toBeTruthy();
  });

  it('matches /studio/<section> and exposes the param', () => {
    render(<MemoryRouter initialEntries={['/studio/courses']}>{routes}</MemoryRouter>);

    expect(screen.getByText('section:courses')).toBeTruthy();
  });

  it('does not swallow deeper paths', () => {
    render(<MemoryRouter initialEntries={['/studio/courses/42']}>{routes}</MemoryRouter>);

    expect(screen.queryByText(/section:/)).toBeNull();
  });
});
