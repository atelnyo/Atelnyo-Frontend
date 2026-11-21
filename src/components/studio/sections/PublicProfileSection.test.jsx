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
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PublicProfileSection from './PublicProfileSection';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock('../../../services/api', () => ({
  creatorProfileService: {
    get: vi.fn(),
    updateMe: vi.fn(),
    updateSectionConfig: vi.fn(),
    uploadAvatar: vi.fn(),
    uploadCover: vi.fn(),
  },
}));
vi.mock('../../../services/appStateStore', () => ({
  saveFormDraft: vi.fn(),
  restoreFormDraft: vi.fn(),
  removeFormDraft: vi.fn(),
}));
vi.mock('../../../hooks/useSafeNavigate', () => ({ default: () => navigateMock }));
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
import { removeFormDraft, restoreFormDraft, saveFormDraft } from '../../../services/appStateStore';
import { SEO_RECOMMENDED } from '../../profile/seoPreview';

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
  navigateMock.mockClear();
  restoreFormDraft.mockResolvedValue(null);
  saveFormDraft.mockResolvedValue({ ok: true });
  removeFormDraft.mockResolvedValue({ ok: true });
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

  it('applies a layout template and saves order + visibility separately', async () => {
    creatorProfileService.get.mockResolvedValue({ data: PROFILE });
    creatorProfileService.updateMe.mockResolvedValue({ data: PROFILE });
    creatorProfileService.updateSectionConfig.mockResolvedValue({ data: {} });

    renderEditor();
    await waitFor(() => expect(creatorProfileService.get).toHaveBeenCalledWith('testuser'));

    // Layout tab now hosts the real controls (templates + order/visibility).
    fireEvent.click(screen.getByRole('tab', { name: /Layout/ }));
    fireEvent.click(screen.getByRole('button', { name: /Akademi/ }));

    // Academy hides products; hide reviews too to prove per-section toggles.
    fireEvent.click(screen.getByRole('checkbox', { name: /Revi: vizib/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Sove' }));

    await waitFor(() => expect(creatorProfileService.updateSectionConfig).toHaveBeenCalled());
    const config = creatorProfileService.updateSectionConfig.mock.calls[0][0];
    expect(config.section_order[0]).toBe('courses');
    expect(config.section_visibility.products).toBe(false);
    expect(config.section_visibility.reviews).toBe(false);

    // Layout keys never leak into the profile serializer payload.
    const payload = creatorProfileService.updateMe.mock.calls[0][0];
    expect(payload).not.toHaveProperty('section_order');
    expect(payload).not.toHaveProperty('section_visibility');
    expect(payload.artist_name).toBe('Test User');
  });

  it('flags unsaved edits and lets the creator discard them', async () => {
    creatorProfileService.get.mockResolvedValue({ data: PROFILE });

    renderEditor();
    await waitFor(() => expect(creatorProfileService.get).toHaveBeenCalledWith('testuser'));

    fireEvent.change(screen.getByDisplayValue('Test User'), {
      target: { value: 'Changed Name' },
    });
    expect(await screen.findByText(/Chanjman ki poko sove/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Changed Name')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Jete chanjman/ }));

    await waitFor(() => expect(screen.getByDisplayValue('Test User')).toBeInTheDocument());
    expect(screen.queryByText(/Chanjman ki poko sove/)).not.toBeInTheDocument();
  });

  it('supports keyboard tab navigation and Ctrl+S saving', async () => {
    creatorProfileService.get.mockResolvedValue({ data: PROFILE });
    creatorProfileService.updateMe.mockResolvedValue({ data: PROFILE });

    renderEditor();
    await waitFor(() => expect(creatorProfileService.get).toHaveBeenCalledWith('testuser'));

    const appearanceTab = screen.getByRole('tab', { name: /Aparans/ });
    appearanceTab.focus();
    fireEvent.keyDown(appearanceTab, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /Pwofil/ })).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(creatorProfileService.updateMe).toHaveBeenCalled());
    await waitFor(() => expect(removeFormDraft).toHaveBeenCalled());
    expect(creatorProfileService.updateMe).toHaveBeenCalledWith(
      expect.not.objectContaining({ section_order: expect.anything() }),
    );
  });

  it('collapses and restores the live preview', async () => {
    creatorProfileService.get.mockResolvedValue({ data: PROFILE });

    renderEditor();
    await waitFor(() => expect(creatorProfileService.get).toHaveBeenCalledWith('testuser'));
    expect(await screen.findByTestId('live-preview-mock')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Aperè mobil' }));
    expect(screen.getByRole('button', { name: 'Aperè desktop' }))
      .toHaveAttribute('aria-pressed', 'true');

    const hide = screen.getByRole('button', { name: 'Kache aperè a' });
    expect(hide).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(hide);
    expect(screen.queryByTestId('live-preview-mock')).not.toBeInTheDocument();

    const show = screen.getByRole('button', { name: 'Montre aperè a' });
    expect(show).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(show);
    expect(await screen.findByTestId('live-preview-mock')).toBeInTheDocument();
  });

  it('shows a live search preview and recommended SEO counters', async () => {
    creatorProfileService.get.mockResolvedValue({ data: PROFILE });

    renderEditor();
    await waitFor(() => expect(creatorProfileService.get).toHaveBeenCalledWith('testuser'));

    fireEvent.click(screen.getByRole('tab', { name: /SEO/ }));

    const title = screen.getByLabelText(/Tit SEO/);
    const description = screen.getByLabelText(/Deskripsyon SEO/);
    fireEvent.change(title, { target: { value: 'Gid Mizik Ayiti' } });
    fireEvent.change(description, { target: { value: 'Aprann mizik ak kreyatè Ayisyen.' } });

    const preview = screen.getByRole('group', { name: 'Apèsi rezilta rechèch' });
    expect(within(preview).getByText('Gid Mizik Ayiti')).toBeInTheDocument();
    expect(within(preview).getByText('Aprann mizik ak kreyatè Ayisyen.')).toBeInTheDocument();
    expect(SEO_RECOMMENDED.title).toBe(60);
    expect(SEO_RECOMMENDED.description).toBe(160);
  });

  it('shows the saved completeness score and jumps to a missing field tab', async () => {
    creatorProfileService.get.mockResolvedValue({
      data: {
        ...PROFILE,
        profile_completeness: 62,
        completeness_missing: ['avatar', 'seo_title'],
      },
    });

    renderEditor();
    expect(await screen.findByText('Pwofil ou 62% konplè')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ale nan Foto Pwofil' }));
    expect(screen.getByRole('tab', { name: /Aparans/ }))
      .toHaveAttribute('aria-selected', 'true');
  });

  it('shows backend field errors and jumps to the affected tab', async () => {
    creatorProfileService.get.mockResolvedValue({ data: PROFILE });
    creatorProfileService.updateMe.mockRejectedValue({
      response: {
        status: 400,
        data: { bio: ['Bios la twò long.'], seo_title: ['Tit la obligatwa.'] },
      },
    });

    renderEditor();
    await waitFor(() => expect(creatorProfileService.get).toHaveBeenCalledWith('testuser'));

    fireEvent.click(screen.getByRole('button', { name: 'Sove' }));

    expect(await screen.findByText('Pwofil la pa t sove')).toBeInTheDocument();
    expect(screen.getByText('Bios la twò long.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Ale nan Biyografi/ }));
    expect(screen.getByRole('tab', { name: /Pwofil/ }))
      .toHaveAttribute('aria-selected', 'true');
  });

  it('keeps a layout write failure visible and actionable after the profile saves', async () => {
    creatorProfileService.get.mockResolvedValue({ data: PROFILE });
    creatorProfileService.updateMe.mockResolvedValue({ data: PROFILE });
    creatorProfileService.updateSectionConfig.mockRejectedValue({ response: { status: 500 } });

    renderEditor();
    await waitFor(() => expect(creatorProfileService.get).toHaveBeenCalledWith('testuser'));

    fireEvent.click(screen.getByRole('tab', { name: /Layout/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Akademi/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Sove' }));

    expect(await screen.findByText(/layout la pa t kapab mete ajou/)).toBeInTheDocument();
    expect(screen.getByText(/Chanjman ki poko sove/)).toBeInTheDocument();
  });

  it('asks in-app before leaving with unsaved changes', async () => {
    creatorProfileService.get.mockResolvedValue({ data: PROFILE });

    renderEditor();
    await waitFor(() => expect(creatorProfileService.get).toHaveBeenCalledWith('testuser'));

    fireEvent.change(screen.getByDisplayValue('Test User'), { target: { value: 'Unsaved Name' } });
    fireEvent.click(screen.getByRole('tab', { name: /Layout/ }));
    const go = await screen.findByRole('button', { name: /Ale nan Profile Settings/ });
    fireEvent.click(go);

    expect(await screen.findByRole('dialog', { name: 'Kite paj la?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rete sou paj la' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(navigateMock).not.toHaveBeenCalled();

    fireEvent.click(go);
    fireEvent.click(await screen.findByRole('button', { name: 'Kite san sove' }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/sheet/studio?section=profile_settings'));
  });

  it('moves focus into the full-screen preview and restores it on close', async () => {
    creatorProfileService.get.mockResolvedValue({ data: PROFILE });

    renderEditor();
    await waitFor(() => expect(creatorProfileService.get).toHaveBeenCalledWith('testuser'));

    const trigger = screen.getByRole('button', { name: 'Aperè tout ekran' });
    trigger.focus();
    fireEvent.click(trigger);

    const close = await screen.findByRole('button', { name: 'Fèmen aperè' });
    await waitFor(() => expect(close).toHaveFocus());

    fireEvent.click(close);
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('recovers a local draft after a refresh', async () => {
    creatorProfileService.get.mockResolvedValue({ data: PROFILE });
    restoreFormDraft.mockResolvedValue({
      form: { artist_name: 'Draft Name' },
      savedAt: Date.now(),
      profileId: 1,
    });

    renderEditor();

    expect(await screen.findByText(/Ou vle retabli li/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retabli' }));

    expect(await screen.findByDisplayValue('Draft Name')).toBeInTheDocument();
    expect(screen.queryByText(/Ou vle retabli li/)).not.toBeInTheDocument();
    expect(screen.getByText(/Chanjman ki poko sove/)).toBeInTheDocument();
  });

  it('shows the create-profile empty state when no profile exists', async () => {
    creatorProfileService.get.mockRejectedValue({ response: { status: 404 } });

    renderEditor();

    expect(await screen.findByText('Kreye Pwofil Piblik')).toBeInTheDocument();
    expect(screen.getByText('Pwofil poko kreye')).toBeInTheDocument();
  });

  it('lets a Premium account upload its account photo without creator access', async () => {
    creatorProfileService.get.mockRejectedValue({ response: { status: 403 } });

    renderEditor({
      user: { id: 2, premium: { is_premium: true }, avatar_url: '' },
    });

    expect(await screen.findByRole('button', { name: /Telechaje foto pwofil/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Istwa/ })).not.toBeInTheDocument();
  });
});
