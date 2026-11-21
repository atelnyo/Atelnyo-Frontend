import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import BusinessSpotlightCard from './BusinessSpotlightCard';

const BUSINESS = {
  id: 5,
  business_name: 'Kafe Kreyòl',
  business_description: 'Yon kafe familyal ki sèvi bon kafe ak patisri fre chak maten. '.repeat(4),
  business_category: 'Manje',
  business_slug: 'kafe-kreyol',
  website_url: 'https://kafe.example',
  services_offered: ['Kafe', 'Patisri', 'Livrezon', 'Evènman', 'Plis'],
  portfolio_items: [{ id: 1 }, { id: 2 }, { id: 3 }],
  client_testimonials: [{ id: 1 }],
  view_count: 128,
  profile: {
    logo: '',
    tagline: 'Bon gou depi 2019',
    rating: 4.6,
    review_count: 12,
    is_verified: true,
  },
  achievements: [{ id: 1, title: 'Top Biznis', icon: 'fa-trophy', color: '#fbbf24' }],
};

function renderCard(props = {}) {
  return render(
    <MemoryRouter>
      <BusinessSpotlightCard business={BUSINESS} lang="ht" {...props} />
    </MemoryRouter>,
  );
}

describe('BusinessSpotlightCard', () => {
  it('shows the business, trust stats and portfolio proof', () => {
    renderCard();

    expect(screen.getByText('Kafe Kreyòl')).toBeTruthy();
    expect(screen.getByText('Bon gou depi 2019')).toBeTruthy();
    expect(screen.getByLabelText(/4\.6 \/ 5/)).toBeTruthy();
    expect(screen.getByText('(12)')).toBeTruthy();
    expect(screen.getByText(/128/)).toBeTruthy();
    expect(screen.getByText(/3 pwojè/)).toBeTruthy();
    expect(screen.getByText(/1 temwayaj/)).toBeTruthy();
    expect(screen.getByText('Top Biznis')).toBeTruthy();
  });

  it('opens the business profile through one overlay link', async () => {
    renderCard();

    const link = screen.getByRole('link', { name: /ouvri pwofil: kafe kreyòl/i });
    expect(link.getAttribute('href')).toBe('/b/kafe-kreyol');

    await userEvent.click(link);
    expect(link).toBeTruthy();
  });

  it('localizes the card copy in Spanish', () => {
    renderCard({ lang: 'es' });

    expect(screen.getByLabelText('Empresa verificada')).toBeTruthy();
    expect(screen.getByText(/visitas/)).toBeTruthy();
    expect(screen.getByText('Ver perfil del negocio')).toBeTruthy();
  });

  it('expands and collapses a long description with aria-expanded', async () => {
    renderCard();

    const toggle = screen.getByRole('button', { name: /li plis/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.textContent).toMatch(/montre mwens/i);
  });

  it('keeps the website link safe and above the overlay', () => {
    renderCard();

    const site = screen.getByRole('link', { name: /sitwèb: kafe kreyòl/i });
    expect(site.getAttribute('href')).toBe('https://kafe.example');
    expect(site.getAttribute('target')).toBe('_blank');
    expect(site.getAttribute('rel')).toContain('noopener');
    expect(site.getAttribute('rel')).toContain('noreferrer');
  });
});
