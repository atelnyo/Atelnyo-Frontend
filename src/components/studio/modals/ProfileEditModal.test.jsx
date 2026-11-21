import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import ProfileEditModal from './ProfileEditModal';

vi.mock('../../../services/api', () => ({
  default: { patch: vi.fn() },
  applyTokenPair: vi.fn(),
  creatorProfileService: {
    getMe: vi.fn(),
    updateMe: vi.fn(),
  },
}));

import api, { creatorProfileService } from '../../../services/api';

const renderModal = (overrides = {}) => {
  const onClose = overrides.onClose || vi.fn();
  const onSuccess = overrides.onSuccess || vi.fn();
  render(
    <ProfileEditModal
      lang="ht"
      showToast={() => {}}
      user={{ username: 'testuser', email: 'test@example.com' }}
      onClose={onClose}
      onSuccess={onSuccess}
      {...overrides}
    />,
  );
  return { onClose, onSuccess };
};

beforeEach(() => {
  vi.clearAllMocks();
  api.patch.mockResolvedValue({ data: { username: 'testuser' } });
  creatorProfileService.getMe.mockResolvedValue({
    data: {
      artist_name: 'Test User',
      bio: 'Old bio',
      country: 'Ayiti',
      city: 'Potoprens',
      languages: ['ht'],
      skills: ['React'],
      experience: [],
      education: [],
      social_links: {},
    },
  });
  creatorProfileService.updateMe.mockResolvedValue({ data: {} });
});

describe('ProfileEditModal stability', () => {
  it('shows backend field errors in one actionable alert', async () => {
    creatorProfileService.updateMe.mockRejectedValue({
      response: {
        status: 400,
        data: { bio: ['Bios la twò long.'], contact_email: ['Imèl la pa valid.'] },
      },
    });
    renderModal();

    await screen.findByDisplayValue('Old bio');
    fireEvent.click(screen.getByRole('button', { name: 'Sove Chanjman' }));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/Biyografi:/)).toBeInTheDocument();
    expect(within(alert).getByText(/Bios la twò long/)).toBeInTheDocument();
    expect(within(alert).getByText(/Imèl la pa valid/)).toBeInTheDocument();
  });

  it('confirms closing in-app, keeps focus safe, and never uses window.confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const { onClose } = renderModal();

    const bio = await screen.findByDisplayValue('Old bio');
    fireEvent.change(bio, { target: { value: 'New bio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anile' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Fèmen san sove?' });
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Rete sou paj la' })).toHaveFocus());
    expect(confirmSpy).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Rete sou paj la' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Anile' }));
    const again = await screen.findByRole('alertdialog', { name: 'Fèmen san sove?' });
    fireEvent.click(within(again).getByRole('button', { name: 'Fèmen san sove' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });

  it('saves with Ctrl+S once the profile has loaded', async () => {
    renderModal();
    const bio = await screen.findByDisplayValue('Old bio');
    fireEvent.change(bio, { target: { value: 'New bio' } });

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });

    await waitFor(() => expect(creatorProfileService.updateMe).toHaveBeenCalled());
    expect(creatorProfileService.updateMe.mock.calls[0][0].bio).toBe('New bio');
  });
});
