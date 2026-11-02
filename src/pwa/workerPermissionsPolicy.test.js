/**
 * src/pwa/workerPermissionsPolicy.test.js
 *
 * The Cloudflare Worker serves the HTML document, so ITS Permissions-Policy
 * is the one the browser applies to the whole SPA. It shipped
 * ``microphone=()``, which disables getUserMedia for the document: every
 * language-practice block in a course failed with NotAllowedError before
 * the learner could even answer the permission prompt, while the recorder
 * told them they had denied it.
 *
 * The two worker sources are imported with Vite's ``?raw`` suffix so the
 * test reads exactly what ships (no fs/process needed under jsdom).
 */
import workerSource from '../../worker/worker.js?raw';
import publicWorkerSource from '../../public/_worker.js?raw';
import { describe, it, expect } from 'vitest';

const WORKER_SOURCES = {
  'worker/worker.js': workerSource,
  'public/_worker.js': publicWorkerSource,
};

describe('Cloudflare worker Permissions-Policy', () => {
  it.each(Object.entries(WORKER_SOURCES))('%s allows the microphone for same-origin', (_file, src) => {
    expect(src).toContain('microphone=(self)');
    expect(src).not.toContain('microphone=()');
  });

  it.each(Object.entries(WORKER_SOURCES))('%s allows geolocation for same-origin', (_file, src) => {
    expect(src).toContain('geolocation=(self)');
    expect(src).not.toContain('geolocation=()');
  });

  it.each(Object.entries(WORKER_SOURCES))('%s keeps the camera locked', (_file, src) => {
    expect(src).toContain('camera=()');
  });
});
