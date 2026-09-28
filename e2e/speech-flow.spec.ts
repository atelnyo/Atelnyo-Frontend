/**
 * e2e/speech-flow.spec.ts
 *
 * Browser-level verification of the repeat-exercise speech flow:
 * recognition starts WHILE the learner records and the transcript
 * captured during the take is what gets analyzed when the recording
 * stops (see src/components/learning/LanguagePracticeBlock.jsx).
 *
 * No microphone on CI/dev boxes, so the spec injects deterministic
 * fakes for window.SpeechRecognition, MediaRecorder and getUserMedia
 * via page.addInitScript (BEFORE any page script, so the module-level
 * SPEECH_CAPS feature detection sees them). The fake recognizer reads
 * window.__speechTranscript and reports it synchronously, so each take
 * is fully deterministic.
 *
 * Prerequisite: the Vite dev server must be running on :3000
 * (npm run dev) — the harness page is served at
 * http://127.0.0.1:3000/e2e/speech-harness.html.
 *
 * The real analysis (analyzeSpeech) is exercised end to end — only the
 * browser speech plumbing is faked. Selectors use accessible names and
 * data-type attributes (NOT CSS-module classes, which are hashed in dev).
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS_DIR = 'test-results/speech-flow';

// Deterministic browser speech fakes. The recognizer reports
// window.__speechTranscript synchronously on start() so the transcript
// is always captured by the time the take stops.
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

test.describe('repeat speech flow (recognition during the take)', () => {
  test('pass take shows word-level feedback + "Byen pale!"', async ({ page }) => {
    await page.addInitScript(FAKE_SPEECH);
    await page.goto('http://127.0.0.1:3000/e2e/speech-harness.html');

    const passBlock = page.locator('[data-type="repeat"]').first();
    await passBlock.getByRole('button', { name: 'Tape pou pale' }).click();
    await expect(passBlock.getByRole('button', { name: 'Kanpe' })).toBeVisible();
    // The transcript streams in LIVE while the learner is still speaking.
    await expect(passBlock.getByText('Koute:')).toBeVisible();
    await expect(passBlock.getByText('“bonjou kouman ou mache”')).toBeVisible();
    await passBlock.getByRole('button', { name: 'Kanpe' }).click();

    // 3 of 4 words said well → pass with word chips + completion, and
    // the live box is replaced by the analyzed feedback.
    await expect(passBlock.getByText('Byen pale!', { exact: true })).toBeVisible();
    await expect(passBlock.getByText('3/4', { exact: true })).toBeVisible();
    await expect(passBlock.getByText('Koute:')).toHaveCount(0);
    await passBlock.screenshot({ path: path.join(ARTIFACTS_DIR, '01-pass-take.png') });
  });

  test('weak take shows retry hint — a fresh take then passes', async ({ page }) => {
    await page.addInitScript(FAKE_SPEECH);
    await page.goto('http://127.0.0.1:3000/e2e/speech-harness.html');

    const failBlock = page.locator('[data-type="repeat"]').nth(1);

    // First take: only "mwen" recognized → 1/4 → fail.
    await page.evaluate(() => { window.__speechTranscript = 'mwen vle dlo'; });
    await failBlock.getByRole('button', { name: 'Tape pou pale' }).click();
    await expect(failBlock.getByRole('button', { name: 'Kanpe' })).toBeVisible();
    // Live transcript reflects the weak take while still speaking.
    await expect(failBlock.getByText('“mwen vle dlo”')).toBeVisible();
    await failBlock.getByRole('button', { name: 'Kanpe' }).click();
    await expect(failBlock.getByText('Preske — repete mo ki make yo ankò.', { exact: true })).toBeVisible();
    await failBlock.screenshot({ path: path.join(ARTIFACTS_DIR, '02-fail-take.png') });

    // Retry: "Eseye ankò" resets the recorder, then a perfect take passes.
    await failBlock.getByRole('button', { name: 'Eseye ankò' }).click();
    await page.evaluate(() => { window.__speechTranscript = 'mwen renmen kafe frèt'; });
    await failBlock.getByRole('button', { name: 'Tape pou pale' }).click();
    await expect(failBlock.getByRole('button', { name: 'Kanpe' })).toBeVisible();
    await failBlock.getByRole('button', { name: 'Kanpe' }).click();
    await expect(failBlock.getByText('Byen pale!', { exact: true })).toBeVisible();
    await expect(failBlock.getByText('4/4', { exact: true })).toBeVisible();
    await failBlock.screenshot({ path: path.join(ARTIFACTS_DIR, '03-retry-pass.png') });
  });

  test('empty take reports "Nou pa tande w" instead of silently passing', async ({ page }) => {
    await page.addInitScript(FAKE_SPEECH);
    await page.goto('http://127.0.0.1:3000/e2e/speech-harness.html');

    const passBlock = page.locator('[data-type="repeat"]').first();
    await page.evaluate(() => { window.__speechTranscript = ''; });
    await passBlock.getByRole('button', { name: 'Tape pou pale' }).click();
    await expect(passBlock.getByRole('button', { name: 'Kanpe' })).toBeVisible();
    await passBlock.getByRole('button', { name: 'Kanpe' }).click();

    await expect(passBlock.getByText('Nou pa tande w — eseye ankò.', { exact: true })).toBeVisible();
    await passBlock.screenshot({ path: path.join(ARTIFACTS_DIR, '04-empty-take.png') });
  });
});
