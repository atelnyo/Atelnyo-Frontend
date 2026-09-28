/**
 * hooks/useAuth.js — Auth Hook
 *
 * Convenience hook wrapping useAuthStore with common auth utilities.
 */
import { useCallback } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import api from '../services/api';

export function useAuth() {
  const store = useAuthStore();

  const login = useCallback(async (email, password) => {
    useAuthStore.getState().setLoading(true);
    try {
      const { data: raw } = await api.post('/login/', { email, password });
      // Unwrap ApiResponseRenderer envelope ({success, data: {access, refresh, user}})
      const payload = raw?.data ?? raw;
      const user = payload.user ?? payload;
      useAuthStore.getState().setTokens(payload.access, payload.refresh);
      useAuthStore.getState().setUser(user);
      return user;
    } catch (err) {
      const msg = err?.response?.data?.detail
        || err?.response?.data?.message
        || 'Login failed. Please try again.';
      useAuthStore.getState().setError(msg);
      throw err;
    }
  }, []);

  const signup = useCallback(async (username, email, password) => {
    useAuthStore.getState().setLoading(true);
    try {
      const { data: raw } = await api.post('/signup/', { username, email, password });
      // Unwrap ApiResponseRenderer envelope ({success, data: {access, refresh, user}})
      const payload = raw?.data ?? raw;
      const user = payload.user ?? payload;
      useAuthStore.getState().setTokens(payload.access, payload.refresh);
      useAuthStore.getState().setUser(user);
      return user;
    } catch (err) {
      const msg = err?.response?.data?.detail
        || err?.response?.data?.message
        || 'Signup failed. Please try again.';
      useAuthStore.getState().setError(msg);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    const refresh = useAuthStore.getState()._refreshToken;
    if (refresh) {
      api.post('/logout/', { refresh }).catch(() => {});
    }
    useAuthStore.getState().logout();
    window.location.hash = '';
  }, []);

  return {
    ...store,
    login,
    signup,
    logout,
  };
}

export default useAuth;
