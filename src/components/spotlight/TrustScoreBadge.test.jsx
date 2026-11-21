import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import TrustScoreBadge from './TrustScoreBadge';

describe('TrustScoreBadge', () => {
  it('announces the score and level for Haitian Creole', () => {
    render(<TrustScoreBadge score={85} lang="ht" />);
    expect(screen.getByRole('img', { name: '85 / 100 · Verifye' })).toBeTruthy();
  });

  it('localizes levels in Spanish', () => {
    render(<TrustScoreBadge score={10} lang="es" />);
    expect(screen.getByRole('img', { name: '10 / 100 · Nuevo' })).toBeTruthy();
  });

  it('clamps out-of-range scores before rendering', () => {
    render(<TrustScoreBadge score={150} lang="en" />);
    expect(screen.getByRole('img', { name: '100 / 100 · Verified' })).toBeTruthy();
  });
});
