/**
 * e2e/analytics-speech.spec.ts
 *
 * Browser-level verification of the CREATOR side: CourseAnalyticsModal
 * (src/components/studio/sections/CourseAnalyticsModal.jsx) shows a
 * "Speaking practice" section where each learner voice submission
 * displays its word-level analysis — ✓ well-said words, ◐ near misses
 * (with the "said" hint), ✗ missing words, + extra words — plus the
 * recognition confidence.
 *
 * The three backend endpoints are stubbed via page.route with realistic
 * payloads (same JSON shape the Django serializers return), so no
 * backend is needed. Only the browser plumbing is stubbed — the modal
 * component, its analysis rendering and its CSS are the real ones.
 *
 * Prerequisite: Vite dev server on :3000 (npm run dev). Harness page:
 * http://127.0.0.1:3000/e2e/analytics-harness.html
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS_DIR = 'test-results/analytics-speech';

// Realistic SpeechSubmission rows — identical JSON shape to the
// SpeechSubmissionSerializer output (analysis is the learner-side
// word-level comparator result, stored as a JSONField).
const SPEECH_PAYLOAD = [
  {
    id: 1, course: 7, username: 'elèv1', module_index: 0, block_id: 'r1',
    block_type: 'repeat', transcript: 'bonjou kouman ou mache',
    confidence: 0.92, audio_url: null, created_at: '2026-08-18T10:00:00Z',
    analysis: {
      score: 0.75, totalWords: 4, passed: true,
      matchedWords: ['bonjou', 'kouman', 'ou'],
      nearMisses: [],
      missingWords: ['ye'],
      extraWords: [],
    },
  },
  {
    id: 2, course: 7, username: 'elèv2', module_index: 1, block_id: 'p3',
    block_type: 'pronunciation', transcript: 'bonzou mwen rele Jean',
    confidence: 0.61, audio_url: null, created_at: '2026-08-17T15:30:00Z',
    analysis: {
      score: 0.875, totalWords: 4, passed: true,
      matchedWords: ['mwen', 'rele', 'jean'],
      nearMisses: [{ target: 'bonjou', said: 'bonzou' }],
      missingWords: [],
      extraWords: ['wi'],
    },
  },
  {
    id: 3, course: 7, username: 'elèv3', module_index: 0, block_id: 's2',
    block_type: 'speaking', transcript: 'mwen se yon elèv',
    confidence: 0.7, audio_url: null, created_at: '2026-08-16T09:00:00Z',
    analysis: {}, // open speaking carries no word-level analysis
  },
];

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
});

test('creator sees word-level analysis chips for every learner submission', async ({ page }) => {
  await page.route('**/api/courses/7/analytics/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        enrollment_count: 12, avg_progress: 58, completions: 3,
        active_learners: 8, quiz_attempts: 41,
      }),
    }),
  );
  await page.route('**/api/courses/students/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  // Aggregate report — register BEFORE the catch-all submissions route
  // so /report/ is not swallowed by it (first matching route wins).
  await page.route('**/api/speech-submissions/report/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total_submissions: 3,
        with_analysis: 2,
        passed: 2,
        pass_rate: 1.0,
        by_block: [
          { block_id: 'r1', block_type: 'repeat', attempts: 1, passed: 1, pass_rate: 1.0 },
          { block_id: 'p3', block_type: 'pronunciation', attempts: 1, passed: 1, pass_rate: 1.0 },
        ],
        top_difficult_words: [
          { word: 'bonjou', count: 2, said: ['bonzou', 'bonjouw'] },
        ],
        top_missing_words: [{ word: 'ye', count: 1 }],
      }),
    }),
  );
  await page.route('**/api/speech-submissions/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SPEECH_PAYLOAD),
    }),
  );

  await page.goto('http://127.0.0.1:3000/e2e/analytics-harness.html');
  const modal = page.locator('[role="dialog"]');
  await expect(modal).toBeVisible({ timeout: 15_000 });

  // The Speaking practice section with its count (3 submissions).
  const speakSection = modal.locator('section').filter({ hasText: 'Pratik pale' });
  await expect(speakSection.getByText('Pratik pale')).toBeVisible();
  await expect(speakSection.getByText('3', { exact: true })).toBeVisible();

  // Row 1 — exact exercise with analysis: transcript + ok/miss chips + confidence.
  await expect(modal.getByText('“bonjou kouman ou mache”')).toBeVisible();
  await expect(modal.getByText('bonjou', { exact: true }).first()).toBeVisible(); // ok chip
  await expect(modal.getByText('kouman', { exact: true })).toBeVisible();
  await expect(modal.getByText('ye', { exact: true })).toBeVisible(); // missing word
  await expect(modal.getByText('92%', { exact: true })).toBeVisible();

  // Row 2 — near miss: the target word with the "said" hint in its tooltip.
  const nearChip = modal.getByTitle('bonjou → “bonzou”');
  await expect(nearChip).toBeVisible();
  await expect(nearChip).toContainText('bonjou');
  await expect(modal.getByText('61%', { exact: true })).toBeVisible();

  // Row 3 — open speaking: transcript + confidence, NO word chips.
  await expect(modal.getByText('“mwen se yon elèv”')).toBeVisible();
  await expect(modal.getByText('70%', { exact: true })).toBeVisible();

  // ─── Speech analysis report (aggregate) ────────────────────────────
  const report = modal.locator('section').filter({ hasText: 'Rapò analiz pale' });
  await expect(report.getByText('Rapò analiz pale')).toBeVisible();
  await expect(report.getByText('100%', { exact: true }).first()).toBeVisible(); // pass rate
  await expect(report.getByText('bonjou ×2')).toBeVisible(); // hardest word
  await expect(report.getByText('said: bonzou, bonjouw')).toBeVisible();
  await expect(report.getByText('ye ×1')).toBeVisible(); // missing word

  await modal.screenshot({
    path: path.join(ARTIFACTS_DIR, '01-creator-word-level-analysis.png'),
    fullPage: true,
  });
});
