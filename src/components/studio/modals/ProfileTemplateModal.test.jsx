/**
 * src/components/studio/modals/ProfileTemplateModal.test.jsx
 *
 * The template picker is a draft-only preview: selecting a card and
 * applying must hand the caller the exact section order/visibility preset
 * (and close), without touching any content.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfileTemplateModal from './ProfileTemplateModal';

describe('ProfileTemplateModal', () => {
  it('applies the selected template config and closes', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <ProfileTemplateModal lang="ht" onApply={onApply} onClose={onClose} />,
    );

    // Defaults to the first preset (Showcase).
    expect(screen.getByRole('radio', { name: /Vitrin/ })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('radio', { name: /Akademi/ }));
    fireEvent.click(screen.getByRole('button', { name: /Aplike Modèl/ }));

    expect(onApply).toHaveBeenCalledTimes(1);
    const [config, template] = onApply.mock.calls[0];
    expect(template.id).toBe('academy');
    expect(config.section_order[0]).toBe('courses');
    expect(config.section_visibility.products).toBe(false);
    // No content fields ever travel with the layout preset.
    expect(config).not.toHaveProperty('courses');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('moves selection and focus with the arrow keys', async () => {
    render(
      <ProfileTemplateModal lang="ht" onApply={vi.fn()} onClose={vi.fn()} />,
    );

    const showcase = screen.getByRole('radio', { name: /Vitrin/ });
    showcase.focus();
    fireEvent.keyDown(showcase, { key: 'ArrowRight' });

    const academy = screen.getByRole('radio', { name: /Akademi/ });
    expect(academy).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(academy).toHaveFocus());

    fireEvent.keyDown(academy, { key: 'Home' });
    expect(showcase).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(showcase).toHaveFocus());
  });
});
