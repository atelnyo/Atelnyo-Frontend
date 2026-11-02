/**
 * src/pwa/cspConnectSrc.test.js
 *
 * The SPA ships TWO Content-Security-Policies and the browser enforces the
 * INTERSECTION of them:
 *   1. the <meta> tag in index.html (baked into the bundle), and
 *   2. the response header the Cloudflare Worker attaches.
 *
 * Only the header listed ``https://atelnyo.atelnyo.workers.dev`` in
 * ``connect-src``. The meta tag did not, so every chatbot request
 * (``aiWorkerService.chat`` → POST /api/ai/chat on the AI Worker) was
 * blocked by the browser before it left the page and the UI showed
 * "Erè nan konekte ak AI a." The community chat socket
 * (``chatService.connect`` → wss://api.atelnyo.site) was blocked the same way.
 *
 * This test pins the invariant: every origin the worker allows must also be
 * allowed by the meta policy. Both files are read with Vite's ``?raw`` suffix
 * so we assert on exactly what ships.
 */
import indexHtml from '../../index.html?raw';
import workerSource from '../../worker/worker.js?raw';
import publicWorkerSource from '../../public/_worker.js?raw';
import { describe, it, expect } from 'vitest';

function splitSources(directive) {
  return directive.trim().split(/\s+/).filter(Boolean);
}

const META_CONNECT_SRC = (() => {
  const match = indexHtml.match(/connect-src ([^;"]+);/);
  return match ? splitSources(match[1]) : null;
})();

function workerConnectSrc(src) {
  const match = src.match(/connect-src ([^"]+)"/);
  return match ? splitSources(match[1]) : null;
}

const WORKER_SOURCES = {
  'worker/worker.js': workerSource,
  'public/_worker.js': publicWorkerSource,
};

describe('CSP connect-src parity (meta vs worker header)', () => {
  it('declares a connect-src in the index.html meta policy', () => {
    expect(META_CONNECT_SRC).not.toBeNull();
    expect(META_CONNECT_SRC.length).toBeGreaterThan(0);
  });

  it('allows the AI Worker origin the chatbot posts to', () => {
    // aiWorkerService.chat() targets `${AI_WORKER_URL}/api/ai/chat`.
    expect(META_CONNECT_SRC).toContain('https://atelnyo.atelnyo.workers.dev');
  });

  it('allows the community chat websocket', () => {
    expect(META_CONNECT_SRC).toContain('wss://api.atelnyo.site');
  });

  it.each(Object.entries(WORKER_SOURCES))(
    '%s does not allow any origin the meta policy blocks',
    (_file, src) => {
      const workerSources = workerConnectSrc(src);
      expect(workerSources).not.toBeNull();
      const missing = workerSources.filter((origin) => !META_CONNECT_SRC.includes(origin));
      expect(missing).toEqual([]);
    },
  );
});
