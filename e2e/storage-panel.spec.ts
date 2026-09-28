/**
 * e2e/storage-panel.spec.ts
 *
 * PWA roadmap item #7 — End-to-end contract for the Settings Storage
 * panel (src/components/settings/StoragePanel.jsx ←
 * src/pwa/storage/StorageManager.js).
 *
 * The native directory picker cannot be driven in headless Chromium,
 * so the suite stubs `window.showDirectoryPicker` with a REAL OPFS
 * handle (navigator.storage.getDirectory() → a fresh subfolder):
 *   • structured-cloneable → saveHandle persists it to IndexedDB
 *     (devrose-handles) exactly like a real user-chosen folder;
 *   • queryPermission/requestPermission report 'granted' → the whole
 *     permission pipeline (in-gesture validation, restart
 *     revalidation, accessibility probe) runs against the real code;
 *   • entries() works → the root accessibility probe succeeds.
 * Everything else — connect, persistence, restart revalidation, the
 * 9-state machine, the quota gate, disconnect semantics, the drafts
 * primitive — runs through the REAL storage subsystem.
 *
 * Locked-in guarantees:
 *   1. Connect: picker → granted → 'connected' status (the access
 *      level is UNCONFIRMED until the first probe — the honest
 *      9-state answer) + persisted root.
 *   2. Restart revalidation: a reload restores the handle from
 *      IndexedDB and RE-QUERIES the grant (never assumed).
 *   3. Low space: the manager's LOW health surfaces the critical
 *      banner AND blocks the write test via the quota gate.
 *   4. Disconnect two-tap: the confirm explains DISCONNECT ≠ DELETE
 *      and drops the connection (the folder is never touched).
 *   5. Drafts: save → list → get → survives a reload → remove
 *      (the private-storage drafts primitive).
 *   6. Write test: the full chain UI → fs.write → adapter writes a
 *      real file into Atelnyo/Exports and the refreshed tree shows it.
 *
 * Language-stable selectors: CSS classes, not translated strings
 * (devrose_lang=en is seeded for the few text filters).
 * Requires only Vite on :3000 — no backend call is load-bearing.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:3000';
const SETTINGS_URL = `${BASE}/sheet/settings`;
const ARTIFACTS_DIR = 'test-results/storage-panel';

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
});

/**
 * Stub the directory picker with a REAL OPFS subfolder (fresh name per
 * test so restored handles never collide across runs) and pin English
 * copy. addInitScript re-runs on every navigation, so the stub — and
 * the lang pin — survive the restart-revalidation reload.
 */
async function stubPicker(page, folderName) {
  await page.addInitScript((name) => {
    window.showDirectoryPicker = async () => {
      const opfs = await navigator.storage.getDirectory();
      return opfs.getDirectoryHandle(name, { create: true });
    };
  }, folderName);
  await page.addInitScript(() => {
    try { localStorage.setItem('atelnyo_lang', 'en'); } catch (_) {}
  });
}

async function openSettings(page) {
  await page.goto(SETTINGS_URL);
  await expect(page.locator('.stg-panel')).toBeVisible({ timeout: 20_000 });
}

async function connectRoot(page) {
  // While not-connected the connect button is the ONLY primary action.
  await page.locator('.stg-btn--primary').first().click();
  // A FRESH connect is granted + readwrite, but the ACCESS LEVEL is
  // UNCONFIRMED until the first accessibility probe (restart restore /
  // revalidate) — the honest 9-state status right after the picker is
  // 'connected' (never over-claims 'read-write', see
  // userStorageStatusFor). Poll the manager instead of UI copy.
  await expect
    .poll(
      () => page.evaluate(() => window.__storageManager.getState().userStorage.status),
      { timeout: 15_000 },
    )
    .toBe('connected');
}

test.describe('[PWA] Storage panel — connect / revalidate / low-space / drafts', () => {
  test('connect flow: picker → granted → connected status + persisted root', async ({ page }) => {
    await stubPicker(page, `e2e-root-${Date.now()}`);
    await openSettings(page);
    await expect(
      page.locator('.stg-status').filter({ hasText: /Not connected/i }),
    ).toBeVisible({ timeout: 15_000 });

    await connectRoot(page);

    // The manager snapshot must agree with the UI. The status is the
    // honest 'connected' (granted + readwrite grant, level unconfirmed
    // until the first probe) — the UI pill reads "Connected".
    const st = await page.evaluate(() => window.__storageManager.getState());
    expect(st.userStorage.rootFolderConnected).toBe(true);
    expect(st.userStorage.status).toBe('connected');
    expect(st.userStorage.permissionState).toBe('granted');
    expect(st.userStorage.accessMode).toBe('readwrite');
    expect(st.userStorage.rootName).toMatch(/^e2e-root-/);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '01-connected.png'),
      fullPage: true,
    });
  });

  test('restart revalidation: a reload restores the handle and re-validates the grant', async ({ page }) => {
    await stubPicker(page, `e2e-root-${Date.now()}`);
    await openSettings(page);
    await connectRoot(page);

    // Simulate a browser restart: full reload on the same origin —
    // IndexedDB persists, so the handle is restored (not assumed) and
    // its permission RE-QUERIED.
    await page.reload();
    await expect(page.locator('.stg-panel')).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('.stg-status').filter({ hasText: /Read & write/i }),
    ).toBeVisible({ timeout: 15_000 });

    const st = await page.evaluate(() => window.__storageManager.getState());
    expect(st.userStorage.rootFolderConnected).toBe(true);
    expect(st.userStorage.permissionState).toBe('granted');
    expect(st.userStorage.accessible).toBe(true);
    expect(st.userStorage.status).toBe('read-write');
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '02-restart-revalidated.png'),
      fullPage: true,
    });
  });

  test('low space: the manager flags critical space → banner + the write-test quota gate blocks', async ({ page }) => {
    await stubPicker(page, `e2e-root-${Date.now()}`);
    await openSettings(page);
    await connectRoot(page);

    // Drive the REAL manager into the LOW health state via the debug
    // global — the panel must react to the state machine, not a prop.
    await page.evaluate(() => {
      const sm = window.__storageManager;
      sm.health = 'low'; // HEALTH_LEVELS.LOW
      sm._notify();
    });
    await expect(page.locator('.stg-banner--critical')).toBeVisible({ timeout: 10_000 });

    // The write TEST honors the quota gate (getWriteStatus): it must
    // NOT attempt the write — it surfaces the blocked warning instead.
    await page.getByRole('button', { name: /Test write/i }).click();
    await expect(page.locator('.stg-notice--warn')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.stg-notice--warn')).toContainText(/blocked|full/i);

    const gate = await page.evaluate(() => window.__storageManager.getWriteStatus());
    expect(gate.ok).toBe(false);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '03-low-space-gate.png'),
      fullPage: true,
    });
  });

  test('disconnect two-tap: the confirm explains and the connection drops (folder untouched)', async ({ page }) => {
    await stubPicker(page, `e2e-root-${Date.now()}`);
    await openSettings(page);
    await connectRoot(page);

    // First tap: the two-tap confirm explains DISCONNECT ≠ DELETE.
    await page.getByRole('button', { name: /^Disconnect$/i }).click();
    await expect(page.locator('.stg-confirm-text')).toBeVisible();
    await expect(page.locator('.stg-confirm-text')).toContainText(/not deleted/i);

    // Second tap: Confirm drops the connection.
    await page.getByRole('button', { name: /^Confirm$/i }).click();
    await expect(
      page.locator('.stg-status').filter({ hasText: /Disconnected/i }),
    ).toBeVisible({ timeout: 10_000 });

    const st = await page.evaluate(() => window.__storageManager.getState());
    expect(st.userStorage.rootFolderConnected).toBe(false);
    expect(st.userStorage.status).toBe('disconnected');
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '04-disconnected.png'),
      fullPage: true,
    });
  });

  test('drafts: save → list → get → survives a reload → remove (private storage)', async ({ page }) => {
    await openSettings(page); // booting the settings page also inits the storage subsystem
    const id = `e2e-draft-${Date.now()}`;

    const saved = await page.evaluate(async (draftId) => {
      const sm = window.__storageManager;
      const saveRes = await sm.drafts.save(draftId, { title: 'Atelnyo e2e draft', n: 42 });
      const listRes = await sm.drafts.list();
      const getRes = await sm.drafts.get(draftId);
      return { saveRes, listRes, getRes };
    }, id);
    expect(saved.saveRes.ok).toBe(true);
    expect(saved.listRes.ok).toBe(true);
    expect(saved.listRes.drafts.some((d) => d.formId === id)).toBe(true);
    expect(saved.getRes.ok).toBe(true);
    expect(saved.getRes.draft.data.title).toBe('Atelnyo e2e draft');

    // Reload → the draft persists (private IndexedDB).
    await page.reload();
    await expect(page.locator('.stg-panel')).toBeVisible({ timeout: 20_000 });
    const after = await page.evaluate(
      async (draftId) => window.__storageManager.drafts.get(draftId),
      id,
    );
    expect(after.ok).toBe(true);
    expect(after.draft.data.n).toBe(42);

    const removed = await page.evaluate(
      async (draftId) => window.__storageManager.drafts.remove(draftId),
      id,
    );
    expect(removed.ok).toBe(true);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '05-drafts.png'),
      fullPage: true,
    });
  });

  test('write test: the full chain UI → fs.write → adapter writes into Atelnyo/Exports', async ({ page }) => {
    await stubPicker(page, `e2e-root-${Date.now()}`);
    await openSettings(page);
    await connectRoot(page);

    // The Browse Atelnyo tree auto-loads once a root is connected.
    await expect(page.locator('.stg-tree')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /Test write/i }).click();
    await expect(page.locator('.stg-notice--ok')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.stg-notice--ok')).toContainText(/Write works/i);

    // The refreshed tree shows the freshly written file (Exports).
    await expect(
      page.locator('.stg-tree').getByText(/atelnyo-connect-test-/),
    ).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '06-write-chain.png'),
      fullPage: true,
    });
  });
});
