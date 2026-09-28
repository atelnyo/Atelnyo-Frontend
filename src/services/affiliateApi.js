/**
 * src/services/affiliateApi.js
 *
 * Atelnyo Creator Affiliate Network (DCAN) — REST API Client.
 *
 * Endpoint map (all paths are under /api/affiliate/):
 *
 * Creator (AffiliateProgram):
 *   GET    /api/affiliate/program/                → program settings
 *   PUT    /api/affiliate/program/                → update settings
 *   POST   /api/affiliate/program/toggle/         → enable/disable
 *   GET    /api/affiliate/applications/           → pending applications
 *   GET    /api/affiliate/applications/<id>/review/  → application detail
 *   POST   /api/affiliate/applications/<id>/review/  → approve/reject
 *   GET    /api/affiliate/members/                → active affiliates
 *   GET    /api/affiliate/groups/                 → list groups
 *   POST   /api/affiliate/groups/                 → create group
 *   GET    /api/affiliate/commission-rules/       → list rules
 *   POST   /api/affiliate/commission-rules/       → create rule
 *   GET    /api/affiliate/stats/                  → creator stats
 *   POST   /api/affiliate/conversions/<id>/approve/  → approve conversion
 *   POST   /api/affiliate/conversions/<id>/reverse/  → reverse conversion
 *
 * Affiliate (self-service):
 *   POST   /api/affiliate/apply/                  → apply to program
 *   GET    /api/affiliate/dashboard/              → dashboard stats
 *   GET    /api/affiliate/links/                  → my links
 *   POST   /api/affiliate/links/                  → create link
 *   GET    /api/affiliate/earnings/               → earnings history
 *   GET    /api/affiliate/profile/                → my profile
 *
 * Public:
 *   GET    /api/affiliate/program/<creator_id>/    → public program info
 *   GET    /api/go/<code>/                        → click redirect
 */
import api from './api';

export const affiliateApi = {
  // ─── Creator Program ────────────────────────────────────────────
  getProgram: () => api.get('affiliate/program/'),
  updateProgram: (data) => api.put('affiliate/program/', data),
  toggleProgram: () => api.post('affiliate/program/toggle/'),

  // ─── Applications ───────────────────────────────────────────────
  getApplications: (status = '') =>
    api.get('affiliate/applications/', { params: status ? { status } : {} }),
  getApplicationDetail: (id) => api.get(`affiliate/applications/${id}/review/`),
  reviewApplication: (id, status, reviewNotes = '') =>
    api.post(`affiliate/applications/${id}/review/`, { status, review_notes: reviewNotes }),

  // ─── Members ────────────────────────────────────────────────────
  getMembers: () => api.get('affiliate/members/'),

  // ─── Groups ─────────────────────────────────────────────────────
  getGroups: () => api.get('affiliate/groups/'),
  createGroup: (data) => api.post('affiliate/groups/', data),

  // ─── Commission Rules ──────────────────────────────────────────
  getCommissionRules: () => api.get('affiliate/commission-rules/'),
  createCommissionRule: (data) => api.post('affiliate/commission-rules/', data),

  // ─── Stats ──────────────────────────────────────────────────────
  getStats: () => api.get('affiliate/stats/'),

  // ─── Conversion Management ─────────────────────────────────────
  getConversations: () => api.get('affiliate/conversions/'),
  approveConversion: (id) => api.post(`affiliate/conversions/${id}/approve/`),
  reverseConversion: (id) => api.post(`affiliate/conversions/${id}/reverse/`),

  // ─── Apply (affiliate self-service) ────────────────────────────
  apply: (creatorId, { motivation, promotionPlatforms, estimatedReach } = {}) =>
    api.post('affiliate/apply/', {
      creator_id: creatorId,
      motivation,
      promotion_platforms: promotionPlatforms,
      estimated_reach: estimatedReach,
    }),

  // ─── Affiliate Dashboard ──────────────────────────────────────
  getDashboard: () => api.get('affiliate/dashboard/'),
  getLinks: () => api.get('affiliate/links/'),
  createLink: (data) => api.post('affiliate/links/', data),
  getEarnings: () => api.get('affiliate/earnings/'),
  getAffiliateProfile: () => api.get('affiliate/profile/'),
  getMyApplications: () => api.get('affiliate/my-applications/'),

  // ─── CCE Campaigns ────────────────────────────────────────────
  getCampaigns: (status = '') =>
    api.get('affiliate/campaigns/', { params: status ? { status } : {} }),
  getCampaign: (id) => api.get(`affiliate/campaigns/${id}/`),
  createCampaign: (data) => api.post('affiliate/campaigns/', data),
  updateCampaign: (id, data) => api.put(`affiliate/campaigns/${id}/`, data),
  deleteCampaign: (id) => api.delete(`affiliate/campaigns/${id}/`),
  activateCampaign: (id) => api.post(`affiliate/campaigns/${id}/activate/`),
  pauseCampaign: (id) => api.post(`affiliate/campaigns/${id}/pause/`),
  endCampaign: (id) => api.post(`affiliate/campaigns/${id}/end/`),
  campaignPerformance: (id) => api.get(`affiliate/campaigns/${id}/performance/`),
  campaignEvents: (id) => api.get(`affiliate/campaigns/${id}/events/`),
  campaignGoal: (id) => api.get(`affiliate/campaigns/${id}/goal/`),
  updateCampaignGoal: (id, data) => api.put(`affiliate/campaigns/${id}/goal/`, data),
  campaignBudget: (id) => api.get(`affiliate/campaigns/${id}/budget/`),
  updateCampaignBudget: (id, data) => api.put(`affiliate/campaigns/${id}/budget/`, data),
  campaignAudience: (id) => api.get(`affiliate/campaigns/${id}/audience/`),
  updateCampaignAudience: (id, data) => api.put(`affiliate/campaigns/${id}/audience/`, data),
  campaignOptimizations: (id) => api.get(`affiliate/campaigns/${id}/optimizations/`),
  createOptimization: (id, data) => api.post(`affiliate/campaigns/${id}/optimizations/`, data),

  // ─── CCE Commerce Intelligence ─────────────────────────────────
  intelligenceProducts: (limit = 5) =>
    api.get('affiliate/intelligence/products/', { params: { limit } }),
  intelligenceCampaigns: (limit = 5) =>
    api.get('affiliate/intelligence/campaigns/', { params: { limit } }),
  intelligencePartners: (limit = 5) =>
    api.get('affiliate/intelligence/partners/', { params: { limit } }),
  intelligenceTrends: (days = 30) =>
    api.get('affiliate/intelligence/trends/', { params: { days } }),

  // ─── DCIE Campaign Intelligence Engine ───────────────────────
  dcieCalculateBudget: (data) => api.post('affiliate/dcie/budget-calculate/', data),
  dcieCalculateScore: (campaignId) =>
    api.post('affiliate/dcie/calculate-score/', { campaign_id: campaignId }),
  dcieAnalyze: (campaignId) =>
    api.post('affiliate/dcie/analyze/', { campaign_id: campaignId }),
  dcieAnalyzeAudience: (campaignId) =>
    api.post('affiliate/dcie/analyze-audience/', { campaign_id: campaignId }),
  dcieGetAdvice: () => api.get('affiliate/dcie/advice/'),

  // ─── Public ────────────────────────────────────────────────────
  getPublicProgram: (creatorId) => api.get(`affiliate/program/${creatorId}/`),
  getPublicPrograms: () => api.get('affiliate/programs/'),

  // ─── DIP Intelligence Platform ─────────────────────────────────
  getIntelligenceMetrics: () => api.get('deie/intelligence/metrics/'),
  getIntelligenceBestTimes: () => api.get('deie/intelligence/best-times/'),
  getAudienceSegments: () => api.get('deie/audience/'),
  recalculateAudienceSegment: (id) => api.post(`deie/audience/${id}/recalculate/`),
  recalculateAllSegments: () => api.post('deie/audience/recalculate-all/'),
  createAudienceSegment: (data) => api.post('deie/audience/create-custom/', data),
  deleteAudienceSegment: (id) => api.delete(`deie/audience/${id}/`),
  getPrivacySettings: () => api.get('deie/privacy/'),
  updatePrivacy: (data) => api.post('deie/privacy/update/', data),
  resetPrivacy: () => api.post('deie/privacy/reset/'),
  detectLocation: (params) => api.get('deie/geo/detect/', { params }),
  getGeoSegments: () => api.get('deie/geo/segments/'),
};
