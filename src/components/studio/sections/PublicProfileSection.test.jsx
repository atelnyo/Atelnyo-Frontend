/**
 * src/components/studio/sections/PublicProfileSection.test.jsx
 *
 * Smoke tests for the Public Profile editor (Creator Studio):
 *   • renders the editor tab bar (Appearance / Profile / Story /
 *     Social & Contact / SEO / Layout) without crashing;
 *   • each tab shows its own card(s) with loaded profile data;
 *   • shows the "create profile" empty state when no profile exists yet.
 *
 * The section talks to the real API service + navigation hooks — all
 * mocked here so the test only exercises the component's render path.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PublicProfileSection from './PublicProfileSection';

vi.mock('../../../services/api', () => ({
  creatorProfileService: {
    get: vi.fn(),
    updateMe: vi.fn(),
    uploadAvatar: vi.fn(),
    uploadCover: vi.fn(),
  },
}));
vi.mock('../../../hooks/useSafeNavigate', () => ({ default: () => vi.fn() }));
vi.mock('../../../utils/userIdentity', () => ({
  getUserIdentity: () => ({
    creatorLookupKey: 'testuser',
    initial: 'T',
    displayName: 'Test User',
    username: 'testuser',
    emailPrefix: 'test',
  }),
}));
vi.mock('../../shared/LocationPicker', () => ({
  default: () => <div data-testid="location-picker">LOCATION_PICKER_MOCK</div>,
}));
// The editor renders the REAL CreatorPublicProfile page inside its live
// preview pane (lazy-loaded). Mock the module so the smoke test doesn't
// mount the full page (which talks to many unmocked API methods).
vi.mock('../../../components/CreatorPublicProfile', () => ({
  default: () => <div data-testid="live-preview-mock">LIVE_PREVIEW_MOCK</div>,
}));

import { creatorProfileService } from '../../../services/api';

const PROFILE = {
  id: 1,
  artist_name: 'Test User',
  display_name: 'Test User',
  username: 'testuser',
  bio: 'Hello world',
  avatar_url: '',
  cover_url: '',
  country: 'Ayiti',
  city: 'Potoprens',
  languages: ['ht', 'en'],
  skills: ['React', 'Python'],
  experience: [{ title: 'Dev', company: 'Acme', period: '2020-2024', description: '' }],
  education: [{ institution: 'INUQUA', degree: 'Licence', year: '2023', description: '' }],
  social_links: { github: 'https://github.com/x' },
  contact_email: 'hi@test.dev',
  contact_phone: '+509',
  availability: 'available',
  seo_title: '',
  seo_description: '',
  seo_keywords: ['creator', 'music'],
};

const renderEditor = (overrides = {}) =>
  render(<PublicProfileSection lang="ht" showToast={() => {}} user={{ id: 1 }} {...overrides} />);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PublicProfileSection editor', () => {
  it('renders the editor tab bar and shows each tab with its data', async () => {
    creatorProfileService.get.mockResolvedValue({ data: PROFILE });

    renderEditor();

    await waitFor(() => expect(creatorProfileService.get).toHaveBeenCalledWith('testuser'));

    // Tab bar (Kreyòl labels) — all six categories are visible.
    const tabs = ['Aparans', 'Pwofil', 'Istwa', 'Rezo & Kontak', 'SEO', 'Layout'];
    for (const t of tabs) {
      expect(screen.getByRole('tab', { name: new RegExp(t) })).toBeInTheDocument();
    }

    // ── Appearance tab (default) — identity data loads ──
    expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();

    // ── Profile tab — bio + languages + skills ──
    fireEvent.click(screen.getByRole('tab', { name: /Pwofil/ }));
    expect(screen.getByDisplayValue('Hello world')).toBeInTheDocument();
    expect(screen.getByDisplayValue('React, Python')).toBeInTheDocument();
    // Geolocation picker present
    expect(screen.getByTestId('location-picker')).toBeInTheDocument();

    // ── Story tab — experience + education rows ──
    fireEvent.click(screen.getByRole('tab', { name: /Istwa/ }));
    expect(screen.getByDisplayValue('Dev')).toBeInTheDocument();
    expect(screen.getByDisplayValue('INUQUA')).toBeInTheDocument();

    // ── Social & Contact tab — social links + add chips ──
    fireEvent.click(screen.getByRole('tab', { name: /Rezo & Kontak/ }));
    expect(screen.getByDisplayValue('https://github.com/x')).toBeInTheDocument();
    expect(screen.getAllByText('Ajoute').length).toBeGreaterThanOrEqual(1);

    // ── SEO tab — keywords round-trip ──
    fireEvent.click(screen.getByRole('tab', { name: /^SEO/ }));
    expect(screen.getByDisplayValue('creator, music')).toBeInTheDocument();

    // ── Layout tab — section order pointer ──
    fireEvent.click(screen.getByRole('tab', { name: /Layout/ }));
    expect(screen.getByText('Òd ak Viwabilite Seksyon')).toBeInTheDocument();

    // Live preview pane — the editor workspace (form + real page side by
    // side) renders the preview chrome with the mocked page inside.
    expect(screen.getByText('Aperè an dirèk')).toBeInTheDocument();
    expect(await screen.findByTestId('live-preview-mock')).toBeInTheDocument();
  });

  it('shows the create-profile empty state when no profile exists', async () => {
    creatorProfileService.get.mockRejectedValue({ response: { status: 404 } });

    renderEditor();

    expect(await screen.findByText('Kreye Pwofil Piblik')).toBeInTheDocument();
    expect(screen.getByText('Pwofil poko kreye')).toBeInTheDocument();
  });
});
