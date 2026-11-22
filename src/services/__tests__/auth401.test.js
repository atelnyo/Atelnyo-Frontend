// @vitest-environment jsdom
/**
 * A 401 on a request that carried an access token means the session is dead.
 *
 * The interceptor already renewed tokens when a refresh token existed, and
 * cleared everything when that refresh failed. But with NO refresh token left
 * it simply passed the 401 through: the UI kept a signed-in user while the API
 * saw an anonymous request, which is how checkout ended up rejected with
 * "guest_email is required" instead of asking the shopper to sign in again.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));

let errorHandler;

vi.mock('axios', () => {
  const client = {
    get: vi.fn(),
    post: postMock,
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: {
        use: (_onFulfilled, onRejected) => { errorHandler = onRejected; },
      },
    },
  };
  return {
    default: {
      create: vi.fn(() => client),
      post: postMock,
    },
  };
});

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  postMock.mockReset();
  await import('../api'); // wires the interceptors
});

afterEach(() => {
  localStorage.clear();
});

const unauthorized = (headers = {}) => ({
  config: { url: 'session/me/', method: 'get', headers, metadata: {} },
  response: {
    status: 401,
    data: { detail: 'Authentication credentials were not provided.' },
  },
});

const collectLogouts = () => {
  const events = [];
  const listener = (event) => events.push(event.detail);
  window.addEventListener('atelnyo:auth:logout', listener);
  return {
    events,
    stop: () => window.removeEventListener('atelnyo:auth:logout', listener),
  };
};

describe('401 handling without a refresh token', () => {
  it('clears the dead session and broadcasts a logout when a token was sent', async () => {
    localStorage.setItem('access_token', 'dead-access');
    localStorage.setItem('user', '{"id":1}');
    const logouts = collectLogouts();

    await expect(
      errorHandler(unauthorized({ Authorization: 'Bearer dead-access' })),
    ).rejects.toBeTruthy();

    logouts.stop();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(logouts.events).toHaveLength(1);
    expect(logouts.events[0].reason).toBe('session_expired');
  });

  it('leaves guest 401s alone because no token was sent', async () => {
    const logouts = collectLogouts();

    await expect(errorHandler(unauthorized())).rejects.toBeTruthy();

    logouts.stop();
    expect(logouts.events).toHaveLength(0);
  });

  it('does not log the user out when the failing request is the login itself', async () => {
    localStorage.setItem('access_token', 'dead-access');
    const logouts = collectLogouts();

    const err = unauthorized({ Authorization: 'Bearer dead-access' });
    err.config.url = 'login/';
    await expect(errorHandler(err)).rejects.toBeTruthy();

    logouts.stop();
    expect(logouts.events).toHaveLength(0);
    expect(localStorage.getItem('access_token')).toBe('dead-access');
  });
});
