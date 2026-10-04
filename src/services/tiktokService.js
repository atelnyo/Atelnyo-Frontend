/**
 * src/services/tiktokService.js
 *
 * TikTok integration client — Faz A endpoints (plan A.6).
 * Token-free by design (decision #1): this surface only ever exchanges
 * connection status metadata with the backend. The OAuth popup flow is
 * browser-side: /auth/start/ returns an authorize URL, TikTok redirects
 * to /auth/callback/ which closes itself via postMessage.
 *
 * Plan: docs/features/TIKTOK_INTEGRATION_PLAN.md
 */
import api from './api';

export const tiktokService = {
  /** GET /api/tiktok/status/ → { connected, configured, display_name, … } */
  status: () => api.get('tiktok/status/'),

  /** POST /api/tiktok/auth/start/ → { auth_url } (opens TikTok consent) */
  startAuth: () => api.post('tiktok/auth/start/'),

  /** POST /api/tiktok/disconnect/ → revoke + deactivate + profile unlink */
  disconnect: () => api.post('tiktok/disconnect/'),

  /** POST /api/tiktok/posts/ → { post } (Faz B Direct Post — 201/200 dup) */
  createPost: (payload) => api.post('tiktok/posts/', payload),

  /** GET /api/tiktok/posts/ → { posts: [...] } — own history (latest 50) */
  listPosts: () => api.get('tiktok/posts/'),

  /** GET /api/tiktok/posts/{id}/status/ → { post } — poll async state */
  postStatus: (id) => api.get(`tiktok/posts/${id}/status/`),

  /** GET /api/tiktok/posts/creator-info/ → constraints for the modal (C.2/C.3) */
  creatorInfo: () => api.get('tiktok/posts/creator-info/'),

  /** POST /api/tiktok/posts/generate-caption/ → { caption, hashtags } | { error } (C.7) */
  generateCaption: (payload) => api.post('tiktok/posts/generate-caption/', payload),
};

export default tiktokService;
