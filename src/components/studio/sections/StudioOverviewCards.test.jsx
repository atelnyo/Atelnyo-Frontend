import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../services/api', () => ({
  studioService: { overview: vi.fn() },
}));

import { studioService } from '../../../services/api';
import { resetOverviewCache } from '../studioOverview';
import StudioOverviewCards, { draftTotal, publishedTotal } from './StudioOverviewCards';

const DATA = {
  content: {
    courses: { total: 3, published: 2, draft: 1 },
    products: { total: 2, published: 1, draft: 1 },
    music: { total: 0, published: 0, draft: 0 },
    talents: { total: 0, published: 0, draft: 0 },
    portfolio: { total: 2, published: 1, draft: 1 },
    jobs: { total: 0, published: 0 },
    events: { total: 0, published: 0 },
  },
  commerce: { orders: { total: 5, pending: 2 }, revenue: { gross: '125.50' } },
  wallet: { balance: '40.00', is_frozen: false },
};

describe('StudioOverviewCards helpers', () => {
  it('sums published and draft content across every type', () => {
    expect(publishedTotal(DATA.content)).toBe(4);
    expect(draftTotal(DATA.content)).toBe(3);
  });

  it('is safe on a missing payload', () => {
    expect(publishedTotal(null)).toBe(0);
    expect(draftTotal(undefined)).toBe(0);
  });
});

describe('StudioOverviewCards', () => {
  beforeEach(() => {
    resetOverviewCache();
    vi.clearAllMocks();
  });

  it('renders the four workspace KPIs from a single request', async () => {
    studioService.overview.mockResolvedValue({ data: DATA });

    render(<StudioOverviewCards lang="en" />);

    expect(await screen.findByText('Published content')).toBeTruthy();
    expect(studioService.overview).toHaveBeenCalledTimes(1);
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('3 drafts')).toBeTruthy();
    expect(screen.getByText('Pending orders')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('$125.50')).toBeTruthy();
    expect(screen.getByText('$40.00')).toBeTruthy();
  });

  it('shows a KPI-shaped busy state while the overview loads', () => {
    studioService.overview.mockReturnValue(new Promise(() => {}));

    render(<StudioOverviewCards lang="en" />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Loading the workspace overview');
  });

  it('never fakes zeros: a failure shows the error card and retries', async () => {
    studioService.overview.mockRejectedValueOnce(
      new Error('overview down'),
    );

    render(<StudioOverviewCards lang="en" />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load the workspace overview');
    expect(alert).toHaveTextContent('overview down');
    expect(screen.queryByText('Published content')).toBeNull();

    studioService.overview.mockResolvedValueOnce({ data: DATA });
    await userEvent.click(screen.getByRole('button', { name: /Try again/ }));

    await waitFor(() => expect(screen.getByText('Published content')).toBeTruthy());
    expect(studioService.overview).toHaveBeenCalledTimes(2);
  });
});
