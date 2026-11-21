/**
 * src/components/studio/sections/ProfileSettingsSection.test.jsx
 *
 * Stability regressions for Profile Settings:
 *   • loading a saved 5.00 monthly price must NOT look like an unsaved change
 *     (canonical price comparison), so "Save All" starts disabled;
 *   • applying a layout template marks the settings dirty and saving sends the
 *     template order/visibility through updateSectionConfig;
 *   • Discard restores the saved layout.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ProfileSettingsSection from './ProfileSettingsSection';

vi.mock('../../../services/api', () => ({
  creatorProfileService: {
    get: vi.fn(),
    updateSectionConfig: vi.fn(),
    updateMe: vi.fn(),
  },
  creatorProfileHealthService: {
    get: vi.fn(),
    pin: vi.fn(),
  },
  courseService: { getAll: vi.fn() },
  marketplaceService: { list: vi.fn() },
  portfolioService: { list: vi.fn() },
}));
vi.mock('../../../services/appStateStore', () => ({
  saveFormDraft: vi.fn(),
  restoreFormDraft: vi.fn(),
  removeFormDraft: vi.fn(),
}));
vi.mock('../../../utils/userIdentity', () => ({
  getUserIdentity: () => ({ creatorLookupKey: 'testuser' }),
}));

import {
  creatorProfileService,
  creatorProfileHealthService,
  courseService,
  marketplaceService,
  portfolioService,
} from '../../../services/api';
import { removeFormDraft, restoreFormDraft, saveFormDraft } from '../../../services/appStateStore';

const renderSettings = (showToast = () => {}) =>
  render(<ProfileSettingsSection lang="ht" showToast={showToast} user={{ id: 1 }} />);

beforeEach(() => {
  vi.clearAllMocks();
  restoreFormDraft.mockResolvedValue(null);
  saveFormDraft.mockResolvedValue({ ok: true });
  removeFormDraft.mockResolvedValue({ ok: true });
  creatorProfileService.get.mockResolvedValue({
    data: { section_config: null, subscription_price: '5.00' },
  });
  creatorProfileService.updateSectionConfig.mockResolvedValue({ data: {} });
  creatorProfileService.updateMe.mockResolvedValue({ data: {} });
  creatorProfileHealthService.get.mockResolvedValue({ data: { featured_pins: {} } });
  courseService.getAll.mockResolvedValue({ data: [] });
  marketplaceService.list.mockResolvedValue({ data: [] });
  portfolioService.list.mockResolvedValue({ data: [] });
});

describe('ProfileSettingsSection stability', () => {
  it('does not treat a saved 5.00 price as dirty, and saves a template cleanly', async () => {
    renderSettings();

    const saveAll = await screen.findByRole('button', { name: 'Sove tout' });
    expect(saveAll).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Akademi/ }));
    await waitFor(() => expect(saveAll).not.toBeDisabled());
    expect(screen.getByText(/Gen chanjman ki poko sove/)).toBeInTheDocument();

    fireEvent.click(saveAll);
    await waitFor(() => expect(creatorProfileService.updateSectionConfig).toHaveBeenCalled());
    const config = creatorProfileService.updateSectionConfig.mock.calls[0][0];
    expect(config.section_order[0]).toBe('courses');
    expect(config.section_visibility.products).toBe(false);
    // Canonical price, not the raw "5.00" display string.
    expect(creatorProfileService.updateMe).toHaveBeenCalledWith({ subscription_price: '5' });
    await waitFor(() => expect(removeFormDraft).toHaveBeenCalled());
  });

  it('saves with Ctrl+S once there are changes', async () => {
    renderSettings();

    const saveAll = await screen.findByRole('button', { name: 'Sove tout' });
    fireEvent.click(screen.getByRole('button', { name: /Akademi/ }));
    await waitFor(() => expect(saveAll).not.toBeDisabled());

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(creatorProfileService.updateSectionConfig).toHaveBeenCalled());
  });

  it('announces section moves for screen readers', async () => {
    renderSettings();
    await screen.findByRole('button', { name: 'Sove tout' });

    fireEvent.click(screen.getByRole('button', { name: 'Desann Kou' }));
    expect(screen.getByText('Kou deplase nan pozisyon 4 sou 7.')).toBeInTheDocument();
  });

  it('reports a partial save honestly when only the price write fails', async () => {
    const showToast = vi.fn();
    creatorProfileService.updateMe.mockRejectedValue({ response: { status: 500 } });
    renderSettings(showToast);

    const saveAll = await screen.findByRole('button', { name: 'Sove tout' });
    fireEvent.click(screen.getByRole('button', { name: /Akademi/ }));
    await waitFor(() => expect(saveAll).not.toBeDisabled());
    fireEvent.click(saveAll);

    await waitFor(() => expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('Layout sove'),
      'exclamation-triangle',
    ));
    expect(creatorProfileService.updateSectionConfig).toHaveBeenCalled();
  });

  it('recovers a saved local settings draft after a refresh', async () => {
    restoreFormDraft.mockResolvedValue({
      sectionOrder: ['courses', 'dashboard'],
      sectionVisibility: { courses: true, products: false },
      subscriptionPrice: '9',
      savedAt: Date.now(),
      profileId: 1,
    });

    renderSettings();
    const saveAll = await screen.findByRole('button', { name: 'Sove tout' });
    expect(saveAll).toBeDisabled();

    expect(await screen.findByText(/Ou vle retabli li/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retabli' }));

    await waitFor(() => expect(saveAll).not.toBeDisabled());
    expect(screen.getByDisplayValue('9')).toBeInTheDocument();
    expect(screen.queryByText(/Ou vle retabli li/)).not.toBeInTheDocument();
  });

  it('discards a template draft back to the saved layout', async () => {
    renderSettings();
    const saveAll = await screen.findByRole('button', { name: 'Sove tout' });
    expect(saveAll).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Akademi/ }));
    await waitFor(() => expect(saveAll).not.toBeDisabled());

    fireEvent.click(screen.getByRole('button', { name: /Jete chanjman/ }));
    await waitFor(() => expect(saveAll).toBeDisabled());
    expect(screen.queryByText(/Gen chanjman ki poko sove/)).not.toBeInTheDocument();
  });
});
