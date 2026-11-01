/**
 * src/components/profile/profilePublicData.test.jsx
 *
 * Public-profile surfaces must only show real data and only offer
 * buttons that actually do something:
 *   - LanguageCard used to hard-code "Native" for every language.
 *   - Affiliate commission is a PERCENTAGE but used a "$" prefix.
 *   - ActionBar's "More" button only showed an "options" toast.
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import ActionBar from './ProfileActionBar';
import AboutTab from './ProfileAboutTab';
import LeftNavRail from './ProfileLeftRail';
import { LanguageCard, AffiliateCard } from './ProfileSectionContracts';

afterEach(cleanup);

describe('LanguageCard', () => {
  it('renders language codes without inventing a proficiency level', () => {
    const { container } = render(<LanguageCard languages={['ht', 'fr']} />);
    expect(screen.getByText('HT')).toBeTruthy();
    expect(screen.getByText('FR')).toBeTruthy();
    expect(container.textContent).not.toMatch(/Native/i);
  });

  it('shows a level only when the payload actually carries one', () => {
    render(<LanguageCard languages={[{ name: 'Kreyòl', level: 'Fluent' }]} />);
    expect(screen.getByText('KREYÒL')).toBeTruthy();
    expect(screen.getByText('Fluent')).toBeTruthy();
  });
});

describe('AffiliateCard', () => {
  it('labels commission as a percentage, not dollars', () => {
    const { container } = render(
      <AffiliateCard offers={[{ id: 1, title: 'Program', commission: 10 }]} />,
    );
    expect(container.textContent).toContain('10% commission');
    expect(container.textContent).not.toContain('$10');
  });
});

describe('ActionBar', () => {
  const renderBar = (overrides = {}) => {
    const handlers = {
      onFollow: vi.fn(),
      onShare: vi.fn(),
      onCopyLink: vi.fn(),
      onMessage: vi.fn(),
      onHire: vi.fn(),
      onCollab: vi.fn(),
      onTip: vi.fn(),
      onBook: vi.fn(),
      onSubscribe: vi.fn(),
    };
    const utils = render(
      <ActionBar
        profile={{ user_id: 1, username: 'Atelnyo' }}
        lang="en"
        t={{}}
        isOwner={false}
        isFollowing={false}
        copied={false}
        followLoading={false}
        subscriptionsEnabled={false}
        affiliateActive={false}
        campaignsEnabled={false}
        {...handlers}
        {...overrides}
      />,
    );
    return { ...utils, handlers };
  };

  it('does not render the dead "More" button', () => {
    const { container } = renderBar();
    expect(container.querySelector('[title="More"]')).toBeNull();
  });

  it('wires every visible action to its handler', () => {
    const { handlers } = renderBar();

    fireEvent.click(screen.getByRole('button', { name: /follow/i }));
    fireEvent.click(screen.getByRole('button', { name: /message/i }));
    fireEvent.click(screen.getByRole('button', { name: /share/i }));
    fireEvent.click(screen.getByTitle('Copy link'));
    fireEvent.click(screen.getByRole('button', { name: /^hire$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^collab$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^tip$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^book$/i }));

    expect(handlers.onFollow).toHaveBeenCalledTimes(1);
    expect(handlers.onMessage).toHaveBeenCalledTimes(1);
    expect(handlers.onShare).toHaveBeenCalledTimes(1);
    expect(handlers.onCopyLink).toHaveBeenCalledTimes(1);
    expect(handlers.onHire).toHaveBeenCalledTimes(1);
    expect(handlers.onCollab).toHaveBeenCalledTimes(1);
    expect(handlers.onTip).toHaveBeenCalledTimes(1);
    expect(handlers.onBook).toHaveBeenCalledTimes(1);
  });

  it('renders Subscribe and opens it when subscriptions are enabled', () => {
    const { handlers } = renderBar({ subscriptionsEnabled: true });
    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }));
    expect(handlers.onSubscribe).toHaveBeenCalledTimes(1);
  });

  it('gates Affiliate/Campaigns buttons on real program data', () => {
    const { handlers } = renderBar({ affiliateActive: true, campaignsEnabled: true });
    fireEvent.click(screen.getByRole('button', { name: /affiliate/i }));
    fireEvent.click(screen.getByRole('button', { name: /campaigns/i }));
    // Both open the real contact modal with a prefilled subject.
    expect(handlers.onMessage).toHaveBeenNthCalledWith(1, 'Affiliate inquiry');
    expect(handlers.onMessage).toHaveBeenNthCalledWith(2, 'Campaign inquiry');
  });
});

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname}</div>;
}

describe('AboutTab — real language + link data', () => {
  const baseProfile = { username: 'Atelnyo', display_name: 'Atelnyo' };

  it('never claims "Native" for a code-only language list', () => {
    const { container } = render(
      <AboutTab profile={{ ...baseProfile, languages: ['ht', 'fr'] }} lang="en" t={{}} />,
    );
    expect(screen.getByText('HT')).toBeTruthy();
    expect(container.textContent).not.toMatch(/Native/i);
  });

  it('renders a real proficiency when the payload carries one', () => {
    render(
      <AboutTab
        profile={{ ...baseProfile, languages: [{ name: 'Kreyòl', level: 'Fluent' }] }}
        lang="en"
        t={{}}
      />,
    );
    expect(screen.getByText('KREYÒL')).toBeTruthy();
    expect(screen.getByText('Fluent')).toBeTruthy();
  });

  it('makes a scheme-less website absolute instead of a broken relative link', () => {
    render(
      <AboutTab profile={{ ...baseProfile, website_url: 'atelnyo.site' }} lang="en" t={{}} />,
    );
    const link = screen.getByRole('link', { name: /atelnyo\.site/i });
    expect(link.getAttribute('href')).toBe('https://atelnyo.site');
  });
});

describe('LeftNavRail — settings', () => {
  it('opens the real settings route instead of doing nothing', () => {
    render(
      <MemoryRouter initialEntries={['/c/Atelnyo']}>
        <LeftNavRail activeTab="dashboard" onChange={() => {}} lang="en" />
        <LocationProbe />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByTestId('loc').textContent).toBe('/sheet/settings');
  });
});
