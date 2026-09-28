/**
 * src/services/legalService.js
 *
 * Legal & Fact Policies API service.
 *
 * Provides all API calls for the Legal system:
 *   - Policy listing and detail
 *   - Consent management
 *   - Violation viewing and reporting
 *   - Appeal filing
 *   - Policy type listing
 *
 * Connected Systems:
 *   - Dynamic CMS — policy pages use legalService for content
 *   - Header/Banner — checks for pending consents
 *   - Creator Studio — records Creator Agreement consent
 *   - Settings — shows consent status
 *   - Admin Dashboard — violation and appeal management
 */

import api from './api';

const BASE = 'legal/';

export const legalService = {
  // ─── Policies ───────────────────────────────────────────────
  /**
   * List published policies (public).
   * @param {Object} params - Query params (type, lang)
   * @returns {Promise<Array>}
   */
  listPolicies: (params = {}) => api.get(`${BASE}policies/`, { params: { ...params, lang: params.lang || 'en' } }),

  /**
   * Get policy detail by slug (public).
   * @param {string} slug - Policy slug (e.g. 'terms-of-service')
   * @param {string} lang - Preferred language code (ht, en, fr, es)
   * @returns {Promise<Object>}
   */
  getPolicy: (slug, lang = 'en') => api.get(`${BASE}policies/${slug}/`, { params: { lang } }),

  /**
   * List all policies including drafts (admin only).
   * @returns {Promise<Array>}
   */
  listAllPolicies: () => api.get(`${BASE}policies/all/`),

  /**
   * List available policy types.
   * @returns {Promise<Array>}
   */
  listPolicyTypes: () => api.get(`${BASE}policies/types/`),

  /**
   * Create a new policy (admin).
   * @param {Object} data - Policy data
   * @returns {Promise<Object>}
   */
  createPolicy: (data) => api.post(`${BASE}policies/`, data),

  /**
   * Update an existing policy (admin).
   * @param {string} slug - Policy slug
   * @param {Object} data - Updated policy data
   * @returns {Promise<Object>}
   */
  updatePolicy: (slug, data) => api.put(`${BASE}policies/${slug}/`, data),

  // ─── Versions ───────────────────────────────────────────────
  /**
   * List policy versions (admin).
   * @param {Object} params - Filter params (policy, language, is_current)
   * @returns {Promise<Array>}
   */
  listVersions: (params = {}) => api.get(`${BASE}versions/`, { params }),

  /**
   * Create a new policy version (admin).
   * @param {Object} data - Version data
   * @returns {Promise<Object>}
   */
  createVersion: (data) => api.post(`${BASE}versions/`, data),

  // ─── Consent ────────────────────────────────────────────────
  /**
   * Record consent to a policy.
   * @param {number} policyId - Policy ID
   * @param {boolean} consented - Whether user consented
   * @param {string} method - Consent method (api, signup, creator_approval)
   * @returns {Promise<Object>}
   */
  recordConsent: (policyId, consented = true, method = 'api', metadata = {}) =>
    api.post(`${BASE}consent/`, {
      policy_id: policyId,
      consented,
      consent_method: method,
      metadata: { ...metadata, consent_time: new Date().toISOString() },
    }),

  /**
   * Get current user's consents.
   * @returns {Promise<Array>}
   */
  myConsents: () => api.get(`${BASE}consent/mine/`),

  /**
   * Check which policies need consent acceptance.
   * @param {string} lang - Preferred language code
   * @returns {Promise<Object>} { pending_count, pending_policies }
   */
  checkPendingConsents: (lang = 'en') =>
    api.get(`${BASE}consent/check/`, { params: { lang } }),

  /**
   * Accept ALL pending mandatory policies in one request.
   * @param {string} lang - Preferred language code
   * @returns {Promise<Object>} { accepted_count, accepted, errors }
   */
  acceptAllConsents: (lang = 'en') =>
    api.post(`${BASE}consent/accept_all/`, { language: lang }),

  // ─── Violations ─────────────────────────────────────────────
  /**
   * Get current user's violations.
   * @returns {Promise<Array>}
   */
  myViolations: () => api.get(`${BASE}violations/mine/`),

  /**
   * List all violations (admin).
   * @param {Object} params - Filter params (status, violation_type, user)
   * @returns {Promise<Array>}
   */
  listViolations: (params = {}) => api.get(`${BASE}violations/`, { params }),

  /**
   * Get violation detail (admin).
   * @param {number} id - Violation ID
   * @returns {Promise<Object>}
   */
  getViolation: (id) => api.get(`${BASE}violations/${id}/`),

  // ─── Appeals ────────────────────────────────────────────────
  /**
   * File an appeal against a violation.
   * @param {Object} data - { violation_id, enforcement_action_id, reason, evidence_data }
   * @returns {Promise<Object>}
   */
  fileAppeal: (data) => api.post(`${BASE}appeals/`, data),

  /**
   * Get current user's appeals.
   * @returns {Promise<Array>}
   */
  myAppeals: () => api.get(`${BASE}appeals/mine/`),

  // ─── Violation Types ────────────────────────────────────────
  /**
   * List active violation types (public).
   * @returns {Promise<Array>}
   */
  listViolationTypes: () => api.get(`${BASE}violation-types/`),

  /**
   * Admin: list all violation types.
   * @returns {Promise<Array>}
   */
  listAllViolationTypes: () => api.get(`${BASE}violation-types/manage/`),
};

export default legalService;
