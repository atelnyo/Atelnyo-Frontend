/**
 * e2e/session-flow.spec.ts
 *
 * The FULL learner module journey in a real browser, exercising the
 * real ModuleSession + LanguagePracticeBlock dispatcher + per-type
 * blocks end to end:
 *
 *   1. vocabulary — type the word → Kòrèk!
 *   2. listening  — type what you heard → Kòrèk!
 *   3. reading    — "M fin li"
 *   4. repeat     — record (faked speech) → word-level analysis → Byen pale!
 *   5. speaking   — open response → transcript + confidence
 *
 * Plus the NEW learner UX:
 *   • keyboard navigation — Enter / → continue, ← back, Space continue
 *     (only when the step is really done)
 *   • the module-complete celebration screen
 *
 * Progress is REAL component logic; only the browser speech plumbing
 * and the quiz-list endpoint are stubbed (no backend needed).
 *
 * Prerequisite: Vite dev server on :3000. Harness:
 * http://127.0.0.1:3000/e2e/session-harness.html
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS_DIR = 'test-results/session-flow';

// Deterministic browser speech fakes (mirrors speech-flow.spec.ts).
const FAKE_SPEECH = `
  window.__speechTranscript = 'bonjou kouman ou mache';
  class FakeSpeechRecognition {
    constructor() {
      this.lang = '';
      this.continuous = false;
      this.interimResults = true;
      this.maxAlternatives = 1;
    }
    start() {
      const t = window.__speechTranscript || '';
      if (this.onresult) {
        this.onresult({
          resultIndex: 0,
          results: [{ isFinal: true, 0: { transcript: t, confidence: 0.92 } }],
        });
      }
      if (this.onend) this.onend();
    }
    stop() {}
    abort() {}
  }
  window.SpeechRecognition = FakeSpeechRecognition;
  window.webkitSpeechRecognition = FakeSpeechRecognition;
  window.MediaRecorder = class {
    static isTypeSupported() { return true; }
    constructor() { this.state = 'inactive'; this.mimeType = 'audio/webm'; }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; if (this.onstop) this.onstop(); }
  };
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => ({
    getTracks: () => [{ stop() {} }],
  });
`;

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
});

test('full module journey — every block type, keyboard nav, celebration', async ({ page }) => {
  await page.addInitScript(FAKE_SPEECH);
  // No quizzes on this module → exactly 5 steps (no assessment step).
  await page.route('**/api/quizzes/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) }),
  );
  await page.route('**/api/speech-submissions/**', (route) =>
    route.fulfill({ status: 201, contentType: 'application/json', body: '{}' }),
  );

  await page.goto('http://127.0.0.1:3000/e2e/session-harness.html');
  const session = page.locator('.ls-session');
  await expect(session).toBeVisible({ timeout: 15_000 });
  await expect(session.getByText('Etap 1 sou 5')).toBeVisible();
  await session.screenshot({ path: path.join(ARTIFACTS_DIR, '00-step1-vocabulary.png') });

  // ─── Step 1 — vocabulary ───────────────────────────────────────────
  await session.getByPlaceholder('Tape mo a…').fill('mèsi');
  await session.getByRole('button', { name: 'Tcheke' }).click();
  await expect(session.getByText('Kòrèk!')).toBeVisible();

  // Keyboard: Enter continues (focus blurred so the key hits the page).
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('Enter');
  await expect(session.getByText('Etap 2 sou 5')).toBeVisible();

  // VISIBLE back button: click "Retounen" → step 1, "Kontinye" → step 2.
  await session.getByRole('button', { name: 'Retounen' }).click();
  await expect(session.getByText('Etap 1 sou 5')).toBeVisible();
  await session.getByRole('button', { name: 'Kontinye' }).click();
  await expect(session.getByText('Etap 2 sou 5')).toBeVisible();

  // ← still goes BACK via keyboard; Enter re-advances. (Done steps stay
  // done, so both navigations are legal.)
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('ArrowLeft');
  await expect(session.getByText('Etap 1 sou 5')).toBeVisible();
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('Enter');
  await expect(session.getByText('Etap 2 sou 5')).toBeVisible();

  // ─── Step 2 — listening ────────────────────────────────────────────
  await session.getByPlaceholder('Tape sa ou tande…').fill('estasyon');
  await session.getByRole('button', { name: 'Tcheke' }).click();
  await expect(session.getByText('Kòrèk!')).toBeVisible();
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('ArrowRight');
  await expect(session.getByText('Etap 3 sou 5')).toBeVisible();

  // ─── Step 3 — reading ──────────────────────────────────────────────
  await expect(session.getByText('Yon paragraf lekti pou elèv la.')).toBeVisible();
  await session.getByRole('button', { name: 'M fin li' }).click();
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press(' '); // Space also continues
  await expect(session.getByText('Etap 4 sou 5')).toBeVisible();

  // ─── Step 4 — repeat (speech, word-level analysis) ─────────────────
  await page.evaluate(() => { window.__speechTranscript = 'bonjou kouman ou ye'; });
  await session.getByRole('button', { name: 'Tape pou pale' }).click();
  await expect(session.getByText('Koute:')).toBeVisible();
  await session.getByRole('button', { name: 'Kanpe' }).click();
  await expect(session.getByText('Byen pale!', { exact: true })).toBeVisible();
  await expect(session.getByText('4/4', { exact: true })).toBeVisible();
  await session.screenshot({ path: path.join(ARTIFACTS_DIR, '01-step4-repeat-pass.png') });
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('Enter');
  await expect(session.getByText('Etap 5 sou 5')).toBeVisible();

  // ─── Step 5 — speaking (open response) ─────────────────────────────
  await session.getByRole('button', { name: 'Tape pou reponn' }).click();
  await expect(session.getByText('Koute:')).toBeVisible();
  await session.getByRole('button', { name: 'Kanpe' }).click();
  await expect(session.getByText('Rekonèt:', { exact: true })).toBeVisible();
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('Enter');

  // ─── Module complete + celebration ─────────────────────────────────
  await expect(session.getByText('Modil fini!')).toBeVisible();
  await expect(session.getByText('Ou fini 5 sou 5 etap. Pwogrè ou anrejistre.')).toBeVisible();
  await session.screenshot({
    path: path.join(ARTIFACTS_DIR, '02-module-complete.png'),
    fullPage: true,
  });
});
