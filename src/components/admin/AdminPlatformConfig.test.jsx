// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';

const list = vi.fn();
const update = vi.fn();
const test = vi.fn();
const paypalHealth = vi.fn();

vi.mock('../../services/api', () => ({
  adminPlatformConfigService: {
    list: (...args) => list(...args),
    update: (...args) => update(...args),
    create: vi.fn(),
    remove: vi.fn(),
    test: (...args) => test(...args),
    paypalHealth: (...args) => paypalHealth(...args),
  },
}));

import AdminPlatformConfig from './AdminPlatformConfig';

const row = (id, key, extra = {}) => ({
  id,
  key,
  value: '',
  value_type: 'str',
  description: '',
  is_public: false,
  is_secret: false,
  is_masked: false,
  source: 'empty',
  source_env_var: '',
  ...extra,
});

// The real list is paginated 20/page and ordered by key, so these 20 rows fill
// page 1 and push ``paypal_mode`` onto page 2 — the exact shape that hid the
// live/sandbox switch from the panel.
const PAGE_ONE = [
  'custom_head_html', 'default_from_email', 'facebook_domain_verification',
  'facebook_pixel_id', 'firebase_api_key', 'firebase_app_id',
  'firebase_auth_domain', 'firebase_credentials_json', 'firebase_database_url',
  'firebase_measurement_id', 'firebase_messaging_sender_id',
  'firebase_project_id', 'firebase_server_key', 'firebase_storage_bucket',
  'firebase_vapid_key', 'google_analytics_id', 'google_client_id',
  'google_site_verification', 'paypal_client_id', 'paypal_client_secret',
].map((key, index) => row(index + 1, key));

const PAGE_TWO = [
  row(21, 'paypal_mode', {
    value: 'live', source: 'database', description: 'PayPal environment.',
  }),
  row(22, 'paypal_webhook_id', { is_secret: true, is_masked: true, value: '••••••••1234' }),
];

describe('AdminPlatformConfig', () => {
  beforeEach(() => {
    list.mockReset();
    update.mockReset();
    test.mockReset();
    paypalHealth.mockReset().mockResolvedValue({
      data: { mode: 'live', last_failure: null, last_success: null },
    });
  });

  it('loads every page so the PayPal environment switch is reachable', async () => {
    list.mockImplementation(({ page }) => Promise.resolve({
      data: page === 1
        ? { results: PAGE_ONE, count: 22, next: 'https://api.test/api/admin/platform-config/?page=2' }
        : { results: PAGE_TWO, count: 22, next: null },
    }));
    update.mockResolvedValue({ data: {} });

    const { container } = render(<AdminPlatformConfig lang="en" showToast={vi.fn()} />);

    // The switch is pinned in the Payments header AND on the row itself.
    await waitFor(() => {
      expect(container.querySelector('.ad-cfg-group-head .ad-cfg-mode-switch')).toBeTruthy();
    });
    expect(list).toHaveBeenCalledWith({ page: 1 });
    expect(list).toHaveBeenCalledWith({ page: 2 });

    // A single click saves the exact token the gateway understands.
    fireEvent.click(container.querySelector('.ad-cfg-group-head .ad-cfg-mode-sandbox'));
    await waitFor(() => expect(update).toHaveBeenCalledWith(21, { value: 'sandbox' }));
  });

  it('shows the PayPal Return URL in Payments and tests it in live mode', async () => {
    const callback = 'https://api.atelnyo.site/api/wallet/payout-accounts/paypal/callback/';
    const message = 'Return URL kòrèk — anrejiste l egzakteman nan app PayPal live la.';
    list.mockResolvedValue({
      data: {
        results: [
          row(1, 'paypal_mode', { value: 'live', source: 'database' }),
          row(2, 'paypal_return_url', { value: callback, source: 'database' }),
        ],
        count: 2,
        next: null,
      },
    });
    test.mockResolvedValue({ data: { ok: true, message } });
    const showToast = vi.fn();

    render(<AdminPlatformConfig lang="en" showToast={showToast} />);

    // The row lives in the Payments group, not in "other keys".
    const label = await screen.findByText('PayPal Return URL');
    const group = label.closest('.ad-cfg-group');
    expect(group).toBeTruthy();
    expect(group).toHaveTextContent('Payments');

    // Its Test button probes the callback on screen and reports the live result.
    const rowEl = label.closest('.ad-cfg-row');
    fireEvent.click(rowEl.querySelector('.ad-cfg-btn-test'));

    await waitFor(() => expect(test).toHaveBeenCalledWith(2, undefined, {}));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith(message, 'check-circle'));
  });
});
