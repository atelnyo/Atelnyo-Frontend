/**
 * src/services/themeApi.js — Theme Engine API Service
 *
 * Phase 7: Frontend bridge to the backend Theme Engine REST API.
 * All calls hit /api/themes/ endpoints.
 *
 * USAGE:
 *   import { themeService } from '../services/themeApi';
 *   const active = await themeService.getActive();
 *   await themeService.applyTheme('my-dark-theme');
 */
import api from './api';

// NOTE: axios baseURL already includes the `/api/` prefix (see
// api.js — `API_URL = VITE_API_BASE_URL || '/api/'`), so this
// constant must be RELATIVE. Using `/api/themes` here produced
// `/api/api/themes/...` requests → 404 on every theme call.
const BASE = 'themes';

export const themeService = {
  /** GET /api/themes/active/ — fetch the current default theme. */
  getActive() {
    return api.get(`${BASE}/active/`);
  },

  /** GET /api/themes/ — list published themes. */
  list(params = {}) {
    return api.get(`${BASE}/`, { params });
  },

  /** GET /api/themes/<slug>/ — detail of a single theme. */
  getBySlug(slug) {
    return api.get(`${BASE}/${slug}/`);
  },

  /** POST /api/themes/ — create a new theme (admin). */
  create(data) {
    return api.post(`${BASE}/`, data);
  },

  /** PUT /api/themes/<slug>/ — full update (admin). */
  update(slug, data) {
    return api.put(`${BASE}/${slug}/`, data);
  },

  /** PATCH /api/themes/<slug>/ — partial update (admin). */
  partialUpdate(slug, data) {
    return api.patch(`${BASE}/${slug}/`, data);
  },

  /** DELETE /api/themes/<slug>/ — archive a theme (admin). */
  archive(slug) {
    return api.delete(`${BASE}/${slug}/`);
  },

  /** POST /api/themes/<slug>/publish/ — publish draft theme (admin). */
  publish(slug, note = '') {
    return api.post(`${BASE}/${slug}/publish/`, { note });
  },

  /** POST /api/themes/<slug>/rollback/ — rollback to version (admin). */
  rollback(slug, versionId, note = '') {
    return api.post(`${BASE}/${slug}/rollback/`, { version_id: versionId, note });
  },

  /** POST /api/themes/<slug>/clone/ — clone a theme (admin). */
  clone(slug, newName, newSlug) {
    return api.post(`${BASE}/${slug}/clone/`, { new_name: newName, new_slug: newSlug });
  },

  /** POST /api/themes/<slug>/export/ — export theme payload (admin). */
  exportTheme(slug) {
    return api.post(`${BASE}/${slug}/export/`);
  },

  /** POST /api/themes/import/ — import a theme (admin). */
  importTheme(exportData, newName, newSlug) {
    return api.post(`${BASE}/import/`, { export_data: exportData, new_name: newName, new_slug: newSlug });
  },

  /** POST /api/themes/<slug>/set-default/ — make this the default (admin). */
  setDefault(slug) {
    return api.post(`${BASE}/${slug}/set-default/`);
  },

  /** GET /api/themes/<slug>/versions/ — version history. */
  getVersions(slug) {
    return api.get(`${BASE}/${slug}/versions/`);
  },

  /** GET /api/themes/<slug>/permissions/ or POST. */
  getPermissions(slug) {
    return api.get(`${BASE}/${slug}/permissions/`);
  },
  grantPermission(slug, userId, role) {
    return api.post(`${BASE}/${slug}/permissions/`, { user_id: userId, role });
  },

  /** GET /api/themes/<slug>/analytics/ */
  getAnalytics(slug, days = 30) {
    return api.get(`${BASE}/${slug}/analytics/`, { params: { days } });
  },

  /** GET /api/themes/analytics/summary/ (admin). */
  getAnalyticsSummary() {
    return api.get(`${BASE}/analytics/summary/`);
  },

  /** GET /api/themes/<slug>/history/ — audit log. */
  getHistory(slug) {
    return api.get(`${BASE}/${slug}/history/`);
  },

  /** POST /api/themes/<slug>/preview/ — draft preview data. */
  preview(slug) {
    return api.post(`${BASE}/${slug}/preview/`);
  },

  // ─── Templates ────────────────────────────────────────────────────

  /** GET /api/themes/templates/ */
  listTemplates(params = {}) {
    return api.get(`${BASE}/templates/`, { params });
  },

  /** GET /api/themes/templates/<slug>/ */
  getTemplate(slug) {
    return api.get(`${BASE}/templates/${slug}/`);
  },

  /** POST /api/themes/templates/<slug>/clone/ */
  cloneTemplate(slug, newName, newSlug) {
    return api.post(`${BASE}/templates/${slug}/clone/`, { new_name: newName, new_slug: newSlug });
  },
};

export default themeService;
