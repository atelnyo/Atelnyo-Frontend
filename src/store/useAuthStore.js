/**
 * useAuthStore — Authentication State (Zustand)
 *
 * Central store for user session, tokens, and auth status.
 * Backend is the single source of truth — this store mirrors
 * what the API returns, nothing more.
 *
 * API Actions:
 *   login(credentials)      → POST /login/  → {access, refresh, user}
 *   signup(userData)        → POST /signup/ → {access, refresh, user}
 *   logout()                → POST /logout/ → blacklists refresh
 *   fetchMe()               → GET  /me/     → current user
 *   refreshToken()          → POST /refresh/ → {access, refresh}
 */
import { create } from 'zustand';
import { authService } from '../services/api';

const initialState = {
  /** Current user object (null = anonymous) */
  user: null,
  /** Loading state for initial session check */
  loading: true,
  /** Error message from last auth attempt */
  error: null,
  /** JWT access token */
  accessToken: null,
  /** JWT refresh token (state value — kept separate from the action) */
  _refreshToken: null,
};

export const useAuthStore = create((set, get) => ({
  ...initialState,

  /* ══════════════════════════════════════════════════════════════
     State Setters
     ══════════════════════════════════════════════════════════════ */

  /** Set the authenticated user (called after login / token refresh) */
  setUser: (user) => set({
    user,
    loading: false,
    error: null,
  }),

  /** Set tokens from login/refresh response */
  setTokens: (access, refresh) => {
    if (access) localStorage.setItem('access_token', access);
    if (refresh) localStorage.setItem('refresh_token', refresh);
    set({ accessToken: access, _refreshToken: refresh });
  },

  /** Clear all auth state (internal — called by async logout action) */
  clearAuth: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({ ...initialState, loading: false, _refreshToken: null });
  },

  /** Set loading state */
  setLoading: (loading) => set({ loading }),

  /** Set error message */
  setError: (error) => set({ error, loading: false }),

  /** Restore session from localStorage (called on app init) */
  restoreSession: () => {
    const access = localStorage.getItem('access_token');
    const refresh = localStorage.getItem('refresh_token');
    if (access || refresh) {
      set({ accessToken: access, _refreshToken: refresh, loading: true });
      return true;
    }
    set({ loading: false });
    return false;
  },

  /* ══════════════════════════════════════════════════════════════
     API Actions
     ══════════════════════════════════════════════════════════════ */

  /**
   * Login with username/email + password.
   * On success, stores tokens + user in the store and localStorage.
   *
   * @param {{ username?: string, email?: string, password: string }} credentials
   * @returns {Promise<object|null>} user object or null on failure
   */
  login: async (credentials) => {
    set({ loading: true, error: null });
    try {
      const { data: raw } = await authService.login(credentials);
      // Unwrap standardized API envelope ({success, data, ...})
      const payload = raw?.data ?? raw;
      if (payload?.access) {
        get().setTokens(payload.access, payload.refresh);
      }
      if (payload?.user) {
        try { localStorage.setItem('user', JSON.stringify(payload.user)); } catch (_) {}
      }
      set({
        user: payload?.user || null,
        loading: false,
        error: null,
      });
      return payload?.user || null;
    } catch (err) {
      const message =
        err?.response?.data?.detail
        || err?.response?.data?.message
        || err?.response?.data?.non_field_errors?.[0]
        || err?.message
        || 'Login failed. Please try again.';
      set({ loading: false, error: message });
      return null;
    }
  },

  /**
   * Create a new account.
   * On success, stores tokens + user in the store and localStorage.
   *
   * @param {{ username: string, email: string, password: string }} userData
   * @returns {Promise<object|null>} user object or null on failure
   */
  signup: async (userData) => {
    set({ loading: true, error: null });
    try {
      const { data: raw } = await authService.signup(userData);
      // Unwrap standardized API envelope ({success, data, ...})
      const payload = raw?.data ?? raw;
      if (payload?.access) {
        get().setTokens(payload.access, payload.refresh);
      }
      if (payload?.user) {
        try { localStorage.setItem('user', JSON.stringify(payload.user)); } catch (_) {}
      }
      set({
        user: payload?.user || null,
        loading: false,
        error: null,
      });
      return payload?.user || null;
    } catch (err) {
      // DRF validation errors come as field-keyed objects
      const respData = err?.response?.data;
      let message = 'Signup failed. Please try again.';
      if (typeof respData === 'object' && respData !== null) {
        const firstKey = Object.keys(respData)[0];
        const firstVal = respData[firstKey];
        if (Array.isArray(firstVal)) {
          message = firstVal[0];
        } else if (typeof firstVal === 'string') {
          message = firstVal;
        }
      } else if (typeof respData === 'string') {
        message = respData;
      }
      set({ loading: false, error: message });
      return null;
    }
  },

  /**
   * Logout: blacklists the refresh token server-side, then clears
   * local auth state.
   *
   * @returns {Promise<boolean>} true on success
   */
  logout: async () => {
    const refresh = get()._refreshToken || localStorage.getItem('refresh_token');
    try {
      if (refresh) {
        await authService.logout(refresh);
      }
    } catch { /* silent — tokens may already be invalid */ }
    get().clearAuth();
    return true;
  },

  /**
   * Fetch the current user profile from /api/me/.
   * Called on app init after restoreSession() finds a token.
   *
   * @returns {Promise<object|null>} user object or null on failure
   */
  fetchMe: async () => {
    const token = get().accessToken || localStorage.getItem('access_token');
    if (!token) {
      set({ loading: false });
      return null;
    }
    set({ loading: true });
    try {
      const { data: raw } = await authService.getMe();
      // Unwrap standardized API envelope ({success, data, ...})
      const data = raw?.data ?? raw;
      if (data && data.id) {
        try { localStorage.setItem('user', JSON.stringify(data)); } catch (_) {}
        set({ user: data, loading: false, error: null });
      } else {
        // Response was wrapped but contained no real user
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ ...initialState, loading: false });
      }
      return data || null;
    } catch (err) {
      if (err?.response?.status === 401) {
        // Token invalid — clear everything
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ ...initialState, loading: false });
      } else {
        set({ loading: false, error: err?.message || 'Failed to fetch profile' });
      }
      return null;
    }
  },

  /**
   * Refresh the JWT tokens by calling /api/refresh/.
   *
   * @returns {Promise<boolean>} true if refresh succeeded
   */
  refreshToken: async () => {
    const refresh = get()._refreshToken || localStorage.getItem('refresh_token');
    if (!refresh) return false;
    try {
      const { data: raw } = await authService.refresh(refresh);
      // Unwrap standardized API envelope ({success, data, ...})
      const payload = raw?.data ?? raw;
      if (payload?.access) {
        get().setTokens(payload.access, payload.refresh || refresh);
      }
      return true;
    } catch {
      // Refresh failed — session is dead
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      set({ ...initialState, loading: false });
      return false;
    }
  },

  /** Convenience getters */
  isAuthenticated: () => !!get().user,
  isStaff: () => get().user?.is_staff ?? false,
  isCreator: () => get().user?.is_creator ?? false,
  role: () => {
    const u = get().user;
    if (!u) return 'guest';
    if (u.is_superuser) return 'admin';
    if (u.is_staff) return 'staff';
    if (u.is_creator) return 'creator';
    return 'student';
  },  }));

export default useAuthStore;
