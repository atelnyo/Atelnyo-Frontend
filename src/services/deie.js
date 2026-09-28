/**
 * DEIE — Atelnyo Evolution Intelligence Engine API Service.
 *
 * Connects the frontend to all DEIE backend endpoints.
 *
 * Endpoints:
 *   Profile:  /api/deie/profile/{me,user/{id},refresh,skills,interests,dna}
 *   Events:   /api/deie/interaction/record, /api/deie/interactions/{me,summary,affinity,hot,engagement}
 *   Ranking:  /api/deie/rank/{weights,update-weights,score,score-batch}
 *   Evolution: /api/deie/evolution/{me,user/{id},history,leaderboard,recalculate}
 *   Feed:     /api/deie/feed/{home,config}
 *   Discover: /api/deie/discover/{connected/{type}/{id},similar/{type}/{id},collaborators,rebuild}
 *   Mentor:   /api/deie/mentor/{ask,learning-path,career-advice,creator-tips,skill-gaps,learning-plan,explain}
 *   Creator:  /api/deie/creator/{me,score/{id},leaderboard}
 *   Trust:    /api/deie/trust/{assess,score/{type}/{id}}
 */
import api from './api';

// ═══════════════════════════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════════════════════════

export function getMyDEIEProfile() {
  return api.get('/deie/profile/me/');
}

export function getUserDEIEProfile(userId) {
  return api.get(`/deie/profile/user/${userId}/`);
}

export function refreshDEIEProfile() {
  return api.post('/deie/profile/refresh/');
}

export function getDEIESkills() {
  return api.get('/deie/profile/skills/');
}

export function getDEIEInterests() {
  return api.get('/deie/profile/interests/');
}

export function getDEIEDNA() {
  return api.get('/deie/profile/dna/');
}

// ═══════════════════════════════════════════════════════════════
// INTERACTIONS / EVENTS
// ═══════════════════════════════════════════════════════════════

export function recordInteraction(eventData) {
  return api.post('/deie/interaction/record/', eventData);
}

export function recordBatchInteractions(events) {
  return api.post('/deie/interactions/batch/', events);
}

export function getMyInteractions(params = {}) {
  return api.get('/deie/interactions/me/', { params });
}

export function getInteractionSummary(params = {}) {
  return api.get('/deie/interactions/summary/', { params });
}

export function getContentAffinity(contentType, contentId) {
  return api.get('/deie/interactions/affinity/', {
    params: { content_type: contentType, content_id: contentId },
  });
}

export function getTrendingContent(params = {}) {
  return api.get('/deie/interactions/hot/', { params });
}

export function getEngagementScore(params = {}) {
  return api.get('/deie/interactions/engagement/', { params });
}

// ═══════════════════════════════════════════════════════════════
// RANKING
// ═══════════════════════════════════════════════════════════════

export function getRankingWeights() {
  return api.get('/deie/rank/weights/');
}

export function updateRankingWeights(weights) {
  return api.patch('/deie/rank/update-weights/', weights);
}

export function scoreContent(contentType, contentId) {
  return api.post('/deie/rank/score/', { content_type: contentType, content_id: contentId });
}

export function batchScoreContent(items) {
  return api.post('/deie/rank/score-batch/', items);
}

// ═══════════════════════════════════════════════════════════════
// EVOLUTION
// ═══════════════════════════════════════════════════════════════

export function getMyEvolutionScore() {
  return api.get('/deie/evolution/me/');
}

export function getUserEvolutionScore(userId) {
  return api.get(`/deie/evolution/user/${userId}/`);
}

export function getEvolutionHistory() {
  return api.get('/deie/evolution/history/');
}

export function getEvolutionLeaderboard(params = {}) {
  return api.get('/deie/evolution/leaderboard/', { params });
}

export function recalculateEvolution() {
  return api.post('/deie/evolution/recalculate/');
}

// ═══════════════════════════════════════════════════════════════
// FEED
// ═══════════════════════════════════════════════════════════════

export function getHomeFeed(params = {}) {
  return api.get('/deie/feed/home/', { params });
}

export function getFeedConfig() {
  return api.get('/deie/feed/config/');
}

export function updateFeedConfig(config) {
  return api.patch('/deie/feed/update-config/', config);
}

// ═══════════════════════════════════════════════════════════════
// DISCOVERY GRAPH
// ═══════════════════════════════════════════════════════════════

export function getConnectedEntities(entityType, entityId) {
  return api.get(`/deie/discover/connected/${entityType}/${entityId}/`);
}

export function getSimilarContent(contentType, contentId) {
  return api.get(`/deie/discover/similar/${contentType}/${contentId}/`);
}

export function findCollaborators(params = {}) {
  return api.get('/deie/discover/collaborators/', { params });
}

export function rebuildDiscoveryGraph() {
  return api.post('/deie/discover/rebuild/');
}

// ═══════════════════════════════════════════════════════════════
// AI MENTOR
// ═══════════════════════════════════════════════════════════════

export function askMentor(question) {
  return api.post('/deie/mentor/ask/', { question });
}

export function getMentorLearningPath() {
  return api.get('/deie/mentor/learning-path/');
}

export function getMentorCareerAdvice() {
  return api.get('/deie/mentor/career-advice/');
}

export function getMentorCreatorTips() {
  return api.get('/deie/mentor/creator-tips/');
}

export function getMentorSkillGaps() {
  return api.get('/deie/mentor/skill-gaps/');
}

export function generateLearningPlan(goal, timeframeWeeks = 12) {
  return api.post('/deie/mentor/learning-plan/', {
    goal, timeframe_weeks: timeframeWeeks,
  });
}

export function explainRecommendation(contentType, contentId) {
  return api.post('/deie/mentor/explain/', {
    content_type: contentType, content_id: contentId,
  });
}

// ═══════════════════════════════════════════════════════════════
// CREATOR INTELLIGENCE
// ═══════════════════════════════════════════════════════════════

export function getMyCreatorScore() {
  return api.get('/deie/creator/me/');
}

export function getCreatorScore(userId) {
  return api.get(`/deie/creator/score/${userId}/`);
}

export function getCreatorLeaderboard(params = {}) {
  return api.get('/deie/creator/leaderboard/', { params });
}

// ═══════════════════════════════════════════════════════════════
// TRUST & SAFETY
// ═══════════════════════════════════════════════════════════════

export function assessContentTrust(contentType, contentId) {
  return api.post('/deie/trust/assess/', {
    content_type: contentType, content_id: contentId,
  });
}

export function getContentTrustScore(contentType, contentId) {
  return api.get(`/deie/trust/score/${contentType}/${contentId}/`);
}

// ═══════════════════════════════════════════════════════════════
// CONVENIENCE — record common interactions automatically
// ═══════════════════════════════════════════════════════════════

export function recordContentView(contentType, contentId, source = 'explore') {
  return recordInteraction({
    event_type: 'CONTENT_VIEWED',
    content_type: contentType,
    content_id: contentId,
    source: source,
    context: { source },
  });
}

export function recordContentLike(contentType, contentId, source = 'explore') {
  return recordInteraction({
    event_type: 'CONTENT_LIKED',
    content_type: contentType,
    content_id: contentId,
    source: source,
  });
}

export function recordContentSave(contentType, contentId, source = 'explore') {
  return recordInteraction({
    event_type: 'CONTENT_SAVED',
    content_type: contentType,
    content_id: contentId,
    source: source,
  });
}

export function recordCourseEnroll(courseId, source = 'explore') {
  return recordInteraction({
    event_type: 'COURSE_ENROLLED',
    content_type: 'course',
    content_id: courseId,
    source: source,
  });
}

export function recordSearchQuery(query) {
  return recordInteraction({
    event_type: 'SEARCH_QUERIED',
    content_type: 'search',
    source: 'search',
    context: { query },
  });
}

export function recordNotInterested(contentType, contentId, source = 'explore') {
  return recordInteraction({
    event_type: 'NOT_INTERESTED',
    content_type: contentType,
    content_id: contentId,
    source: source,
  });
}

export function recordContentSkipped(contentType, contentId, source = 'explore') {
  return recordInteraction({
    event_type: 'CONTENT_SKIPPED',
    content_type: contentType,
    content_id: contentId,
    source: source,
  });
}

export function recordUserMuted(userId, source = 'profile') {
  return recordInteraction({
    event_type: 'USER_MUTED',
    content_type: 'user',
    content_id: userId,
    source: source,
  });
}
