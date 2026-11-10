import { describe, it, expect, vi } from 'vitest';

vi.mock('../services/api', () => ({
  activityFeedService: {
    list: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

import { getEventRoute, getEventNotice, NOTIFICATION_ROUTES } from './ActivityTimeline';

// Every backend-emitted feed type inventoried in Nov 2026 must be either
// clickable (a route) or self-explanatory (a dedicated notice) — never a
// bare "Aktivite" row with a dead click.
const ROUTABLE = [
  // [event_type, data, expectedRoute]
  ['event_published', { event_id: 7, event_title: 'Sware Mizik' }, '/sheet/event/7'],
  ['continue_learning', { course_id: 3, course_title: 'Kreyòl' }, '/sheet/course/3'],
  ['lesson_unlocked', { course_id: 3, course_title: 'Kreyòl', lesson_title: 'L1' }, '/sheet/course/3'],
  ['project_reminder', { course_id: 5 }, '/sheet/course/5'],
  ['project_completed', { course_id: 5 }, '/sheet/course/5'],
  ['achievement_earned', { achievement_name: 'Premye pa' }, '/sheet/studio?section=public_profile'],
  ['course_message', { course_id: 2, body_preview: 'Bonjou…' }, '/sheet/messages'],
  ['profile_tip', { from_user: 'jan', amount: '50' }, '/sheet/wallet'],
  ['referral_commission', { referred_username: 'jan', amount: 10 }, '/sheet/referral'],
  ['creator_approved', { summary: 'OK' }, '/sheet/studio?section=public_profile'],
  ['creator_application_rejected', { summary: 'Non' }, '/sheet/creator-apply'],
  ['creator_application_need_info', { summary: 'ID' }, '/sheet/creator-apply'],
  ['creator_application_suspended', { summary: 'Sispann' }, '/sheet/creator-apply'],
  ['creator_application_restored', { summary: 'Retabli' }, '/sheet/creator-apply'],
  ['policy_updated', { slug: 'privacy', policy_title: 'Privacy' }, '/legal/privacy'],
  ['policy_updated', { policy_title: 'Privacy' }, '/legal'],
  ['policy_consented', {}, '/legal'],
  ['policy_violation', { violation_name: 'Spam' }, '/trust'],
  ['appeal_reviewed', {}, '/trust'],
  ['credential_verified', {}, '/sheet/studio?section=public_profile'],
  // Pre-existing coverage must not regress.
  ['job_posted', { job_id: 11 }, '/sheet/explore/job?id=11'],
  ['community_post_comment', { community_slug: 'mizik' }, '/community/mizik/posts'],
  ['ticket_purchased', { community_slug: 'mizik' }, '/community/mizik'],
  ['order_paid', { business_slug: 'boutik' }, '/business/boutik/workspace'],
  ['new_follower', { follower_username: 'jan' }, '/c/jan'],
];

const NOTICE_ONLY = [
  // [event_type, ht snippet that must appear in the notice]
  ['community_member_banned', 'ban'],
  ['post_removed_by_admin', 'retire'],
  ['profile_request_rejected', 'rejte'],
  ['company_profile_approved', 'apwouve'],
  ['company_profile_rejected', 'rejte'],
  ['spotlight_approved', 'apwouve'],
  ['spotlight_rejected', 'rejte'],
  ['spotlight_admin_message', 'admin'],
  ['spotlight_info_requested', 'enfòmasyon'],
  ['course_temporarily_unavailable', 'Pwogrè ou sove'],
];

describe('notification click coverage', () => {
  it.each(ROUTABLE)('%s navigates somewhere useful', (type, data, expected) => {
    expect(getEventRoute({ event_type: type, data })).toBe(expected);
  });

  it.each(NOTICE_ONLY)('%s explains itself instead of dying silently', (type, snippet) => {
    expect(getEventRoute({ event_type: type, data: {} })).toBeNull();
    const notice = getEventNotice(type, 'ht');
    expect(notice).toContain(snippet);
  });

  it('pending hire/collab/booking rows stay in place (action buttons own the row)', () => {
    for (const type of ['profile_hire_request', 'profile_collab_request', 'profile_service_booking']) {
      expect(getEventRoute({ event_type: type, status: '', data: {} })).toBeNull();
      expect(getEventRoute({ event_type: type, status: 'accepted', data: {} })).toBe('/sheet/messages');
    }
  });

  it('honors backend-provided data.route for future notification types', () => {
    expect(getEventRoute({ event_type: 'some_future_type', data: { route: '/sheet/wallet' } })).toBe('/sheet/wallet');
  });

  it('never navigates to external or protocol-relative URLs from data.route', () => {
    expect(getEventRoute({ event_type: 'some_future_type', data: { route: 'https://evil.example' } })).toBeNull();
    expect(getEventRoute({ event_type: 'some_future_type', data: { route: '//evil.example/x' } })).toBeNull();
    expect(getEventNotice('some_future_type', 'ht')).toBe('Pa gen paj ki lyen ak notifikasyon sa a.');
  });

  it('every mapped route builder is a function (registry hygiene)', () => {
    for (const [type, builder] of Object.entries(NOTIFICATION_ROUTES)) {
      expect(typeof builder, `${type} must map to a function`).toBe('function');
    }
  });
});
