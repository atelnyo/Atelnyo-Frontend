/**
 * src/services/creatorService.js
 *
 * Creator Studio API service.
 *
 * Provides all API calls for the Creator Studio system:
 *   - Creator levels
 *   - Creator badges
 *   - User badges
 *   - Creator identity center (KYC, tax, banking, payment providers)
 */
import api from './api';

const BASE = '';

export const creatorLevelsApi = {
  list: () => api.get(`${BASE}creator-levels/`),
  retrieve: (id) => api.get(`${BASE}creator-levels/${id}/`),
};

export const creatorBadgesApi = {
  list: (params = {}) => api.get(`${BASE}creator-badges/`, { params }),
  retrieve: (id) => api.get(`${BASE}creator-badges/${id}/`),
};

export const creatorUserBadgesApi = {
  list: () => api.get(`${BASE}creator-user-badges/`),
  retrieve: (id) => api.get(`${BASE}creator-user-badges/${id}/`),
  grant: (data) => api.post(`${BASE}creator-user-badges/`, data),
  revoke: (id) => api.post(`${BASE}creator-user-badges/${id}/revoke/`),
};

export const creatorIdentityApi = {
  me: () => api.get(`${BASE}creator-identity/me/`),
  retrieve: (id) => api.get(`${BASE}creator-identity/${id}/`),
  update: (id, data) => api.patch(`${BASE}creator-identity/${id}/`, data),
  create: (data) => api.post(`${BASE}creator-identity/`, data),
};
