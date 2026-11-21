import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TabsBar from './ProfileTabsBar';

const TABS = [
  { id: 'dashboard', icon: 'fa-th-large', label: 'Overview', labelHt: 'Apèsi' },
  { id: 'picks', icon: 'fa-bookmark', label: 'Picks', labelHt: 'Seleksyon' },
  { id: 'courses', icon: 'fa-graduation-cap', label: 'Courses', labelHt: 'Kou' },
];

const renderBar = (overrides = {}) => {
  const onChange = overrides.onChange || vi.fn();
  render(
    <TabsBar
      activeTab="dashboard"
      onChange={onChange}
      lang="ht"
      items={TABS}
      {...overrides}
    />,
  );
  return { onChange };
};

describe('ProfileTabsBar', () => {
  it('uses a localized tablist label and one tab stop', () => {
    renderBar();

    expect(screen.getByRole('tablist', { name: 'Onglet pwofil' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Apèsi' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Seleksyon' })).toHaveAttribute('tabindex', '-1');
  });

  it('moves selection and focus with arrows, Home and End', async () => {
    const { onChange } = renderBar();
    const first = screen.getByRole('tab', { name: 'Apèsi' });
    first.focus();

    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('picks');
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Seleksyon' })).toHaveFocus());

    const second = screen.getByRole('tab', { name: 'Seleksyon' });
    fireEvent.keyDown(second, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('courses');
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Kou' })).toHaveFocus());

    const third = screen.getByRole('tab', { name: 'Kou' });
    fireEvent.keyDown(third, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('dashboard');
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Apèsi' })).toHaveFocus());
  });

  it('swipes horizontally but ignores a mostly vertical gesture', () => {
    const { onChange } = renderBar();
    const tablist = screen.getByRole('tablist');

    fireEvent.touchStart(tablist, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(tablist, { changedTouches: [{ clientX: 110, clientY: 105 }] });
    expect(onChange).toHaveBeenCalledWith('picks');

    onChange.mockClear();
    fireEvent.touchStart(tablist, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(tablist, { changedTouches: [{ clientX: 120, clientY: 220 }] });
    expect(onChange).not.toHaveBeenCalled();
  });
});
