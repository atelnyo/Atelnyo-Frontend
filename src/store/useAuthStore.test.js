// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAuthStore } from './useAuthStore';

const EVENT = 'atelnyo:auth:user-updated';

describe('useAuthStore session broadcast', () => {
  let handler;

  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: null, loading: false, accessToken: null, _refreshToken: null });
    handler = vi.fn();
    window.addEventListener(EVENT, handler);
  });

  afterEach(() => {
    window.removeEventListener(EVENT, handler);
  });

  it('announces a signed-in user so the app updates without a reload', () => {
    const user = { id: 1, username: 'amy', email: 'amy@example.com' };

    useAuthStore.getState().setUser(user);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.user).toEqual(user);
    expect(useAuthStore.getState().user).toEqual(user);
  });

  it('announces a sign-out when the session is cleared', () => {
    useAuthStore.getState().setUser({ id: 1, username: 'amy' });
    handler.mockClear();

    useAuthStore.getState().clearAuth();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.user).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
