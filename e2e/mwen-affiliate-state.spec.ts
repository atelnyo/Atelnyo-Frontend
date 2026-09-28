/**
 * e2e/mwen-affiliate-state.spec.ts
 *
 * Temporary browser probe — verifies that Paj Mwen quick-nav cards are
 * driven by the user's REAL affiliate state (never presented as active
 * affiliates to normal users). The app hydrates `user` from the
 * localStorage cache on boot (queueMicrotask setUser), so each scenario
 * injects a fake /api/me/ blob and checks the rendered card set.
 *
 * Backend-independent: it only needs the Vite dev server (no Daphne) —
 * the user blob is injected via localStorage cache, which App.jsx
 * hydrates on boot.
 *
 * Scenario matrix (task CASE 1-8):
 *   normal (none)      → no referral/affiliate card, discover (invitation) shows
 *   pending            → status card pending, no discover/referral/affiliate
 *   rejected           → status card rejected + discover (re-apply)
 *   active             → referral + affiliate dashboard, no discover/status
 *   creator not affil  → studio + analytics, no affiliate cards at all
 *   admin              → admin cards remain, permission-protected
 *   suspended          → status card suspended, no discover/referral/affiliate
 *   analytics fix      → non-creator must NOT see Creator Analytics
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000/';

function makeUser(overrides) {
  return {
    id: 1,
    username: 'tester',
    email: 'tester@atelnyo.local',
    is_staff: false,
    is_superuser: false,
    is_creator: false,
    is_affiliate: false,
    affiliate_application_status: null,
    notification_prefs: {},
    ...overrides,
  };
}

async function loadMwen(page, user) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate((u) => {
    localStorage.setItem('user', JSON.stringify(u));
  }, user);
  await page.reload({ waitUntil: 'domcontentloaded' });
  // Wait for the cached user to hydrate (queueMicrotask) + Mwen mount.
  await page.waitForTimeout(1200);
  await page.click('[data-testid="mwen-nav-item"]');
  await page.waitForTimeout(1200);
}

async function cardIds(page) {
  return page.evaluate(() => {
    const ids = [];
    document.querySelectorAll('.mwen-analytics-card').forEach((c) => {
      const tid = c.getAttribute('data-testid');
      if (tid) { ids.push(tid); }
    });
    return ids;
  });
}

async function badges(page) {
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.mwen-status-badge').forEach((b) => {
      out.push(b.textContent.trim());
    });
    return out;
  });
}

test.describe('Paj Mwen affiliate-state cards', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('CASE 1+2 normal user (none): no affiliate section, discover invitation only', async ({ page }) => {
    await loadMwen(page, makeUser({}));
    const ids = await cardIds(page);
    expect(ids).not.toContain('mwen-referral-card');
    expect(ids).not.toContain('mwen-affiliate-card');
    expect(ids).toContain('mwen-discover-card');
    expect(await badges(page)).toEqual([]);
  });

  test('analytics fix: non-creator never sees Creator Analytics', async ({ page }) => {
    await loadMwen(page, makeUser({}));
    const ids = await cardIds(page);
    expect(ids).not.toContain('mwen-creator-analytics-card');
  });

  test('CASE 3 pending: pending status card, no discover/referral/affiliate', async ({ page }) => {
    await loadMwen(page, makeUser({ affiliate_application_status: 'pending' }));
    const ids = await cardIds(page);
    expect(ids).toContain('mwen-affiliate-status-card');
    expect(ids).not.toContain('mwen-discover-card');
    expect(ids).not.toContain('mwen-referral-card');
    expect(ids).not.toContain('mwen-affiliate-card');
    expect(await badges(page)).toEqual(['pending']);
  });

  test('CASE rejected: rejected status card + discover (re-apply)', async ({ page }) => {
    await loadMwen(page, makeUser({ affiliate_application_status: 'rejected' }));
    const ids = await cardIds(page);
    expect(ids).toContain('mwen-affiliate-status-card');
    expect(ids).toContain('mwen-discover-card');
    expect(ids).not.toContain('mwen-referral-card');
    expect(ids).not.toContain('mwen-affiliate-card');
    expect(await badges(page)).toEqual(['rejected']);
  });

  test('CASE 4 active affiliate: referral + affiliate dashboard, no status', async ({ page }) => {
    await loadMwen(page, makeUser({ is_affiliate: true, affiliate_application_status: 'active' }));
    const ids = await cardIds(page);
    expect(ids).toContain('mwen-referral-card');
    expect(ids).toContain('mwen-affiliate-card');
    expect(ids).not.toContain('mwen-affiliate-status-card');
    expect(ids).not.toContain('mwen-discover-card');
    expect(await badges(page)).toEqual([]);
  });

  test('CASE 5 creator not affiliate: studio + analytics, zero affiliate cards', async ({ page }) => {
    await loadMwen(page, makeUser({ is_creator: true }));
    const ids = await cardIds(page);
    expect(ids).toContain('mwen-studio-card');
    expect(ids).toContain('mwen-creator-analytics-card');
    expect(ids).not.toContain('mwen-discover-card');
    expect(ids).not.toContain('mwen-referral-card');
    expect(ids).not.toContain('mwen-affiliate-card');
    expect(ids).not.toContain('mwen-affiliate-status-card');
  });

  test('CASE 6 admin: admin cards remain permission-protected', async ({ page }) => {
    await loadMwen(page, makeUser({ is_staff: true }));
    const ids = await cardIds(page);
    expect(ids).toContain('mwen-admin-dashboard-card');
    expect(ids).toContain('mwen-creator-review-card');
  });

  test('CASE 8 suspended: suspended status card, no discover/referral/affiliate', async ({ page }) => {
    await loadMwen(page, makeUser({ affiliate_application_status: 'suspended' }));
    const ids = await cardIds(page);
    expect(ids).toContain('mwen-affiliate-status-card');
    expect(ids).not.toContain('mwen-discover-card');
    expect(ids).not.toContain('mwen-referral-card');
    expect(ids).not.toContain('mwen-affiliate-card');
    expect(await badges(page)).toEqual(['suspended']);
  });

  test('no horizontal overflow at 320px for all states', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await loadMwen(page, makeUser({ is_affiliate: true, affiliate_application_status: 'active' }));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  });
});
