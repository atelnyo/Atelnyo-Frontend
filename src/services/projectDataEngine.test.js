/**
 * Unit tests for src/services/projectDataEngine.js
 *
 * Tests data fetching (fetchProjectData, fetchUserData) and
 * context building (buildProjectContext, buildUserContext).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the api module
vi.mock('./api', () => {
  const mockGet = vi.fn();
  return {
    default: { get: mockGet },
    __mockGet: mockGet,
  };
});

describe('buildProjectContext', () => {
  let buildProjectContext;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('./projectDataEngine');
    buildProjectContext = mod.buildProjectContext;
  });

  it('returns empty string for null/undefined data', () => {
    expect(buildProjectContext(null)).toBe('');
    expect(buildProjectContext(undefined)).toBe('');
  });

  it('returns empty string for error data', () => {
    expect(buildProjectContext({ error: 'Failed' })).toBe('');
  });

  it('builds context with course catalog', () => {
    const data = {
      courses: {
        total: 9,
        top: [
          { id: 1, title: 'Python 101', creator: 'atelnyo', price: 0 },
          { id: 2, title: 'React Mastery', creator: 'atelnyo', price: 9.99 },
        ],
      },
      fetched_at: '2026-08-28T12:00:00Z',
    };

    const ctx = buildProjectContext(data);
    expect(ctx).toContain('COURSE CATALOG (9 total)');
    expect(ctx).toContain('Python 101');
    expect(ctx).toContain('Free');
    expect(ctx).toContain('$9.99');
    expect(ctx).toContain('@atelnyo');
  });

  it('builds context with creator profiles', () => {
    const data = {
      creators: {
        total: 1,
        top: [
          { id: 1, slug: 'atelnyo', display_name: 'Atelnyo Academy', is_verified: true, is_featured: true, followers: 48, courses: 9 },
        ],
      },
      fetched_at: '2026-08-28T12:00:00Z',
    };

    const ctx = buildProjectContext(data);
    expect(ctx).toContain('CREATOR PROFILES (1 total)');
    expect(ctx).toContain('@atelnyo');
    expect(ctx).toContain('✓★');
    expect(ctx).toContain('48 followers');
    expect(ctx).toContain('9 courses');
  });

  it('builds context with music tracks', () => {
    const data = {
      music: {
        total: 3,
        top: [
          { id: 1, title: 'Rap Kreyòl', creator: 'dj_kreyol' },
          { id: 2, title: 'Kompa Vibes', creator: 'band_kreyol' },
        ],
      },
      fetched_at: '2026-08-28T12:00:00Z',
    };

    const ctx = buildProjectContext(data);
    expect(ctx).toContain('MUSIC TRACKS (3 total)');
    expect(ctx).toContain('Rap Kreyòl');
    expect(ctx).toContain('@dj_kreyol');
  });

  it('builds context with all sections', () => {
    const data = {
      courses: { total: 5, top: [{ id: 1, title: 'Course', creator: 'u', price: 0 }] },
      creators: { total: 2, top: [{ id: 1, slug: 'u', display_name: 'U', is_verified: false, is_featured: false, followers: 0, courses: 0 }] },
      music: { total: 1, top: [{ id: 1, title: 'M', creator: 'u' }] },
      talents: { total: 1, top: [{ id: 1, name: 'T', category: 'art' }] },
      jobs: { total: 1, top: [{ id: 1, title: 'J', company: 'C' }] },
      products: { total: 1, top: [{ id: 1, title: 'P', price: 5 }] },
      communities: { total: 1, top: [{ id: 1, name: 'Comm', members: 10 }] },
      fetched_at: '2026-08-28T12:00:00Z',
    };

    const ctx = buildProjectContext(data);
    expect(ctx).toContain('COURSE CATALOG');
    expect(ctx).toContain('CREATOR PROFILES');
    expect(ctx).toContain('MUSIC TRACKS');
    expect(ctx).toContain('TALENT SHOWCASES');
    expect(ctx).toContain('JOB LISTINGS');
    expect(ctx).toContain('MARKETPLACE PRODUCTS');
    expect(ctx).toContain('COMMUNITIES');
  });

  it('skips empty sections', () => {
    const data = {
      courses: { total: 0, top: [] },
      music: { total: 0, top: [] },
      fetched_at: '2026-08-28T12:00:00Z',
    };

    const ctx = buildProjectContext(data);
    expect(ctx).not.toContain('COURSE CATALOG');
    expect(ctx).not.toContain('MUSIC TRACKS');
  });
});

describe('buildUserContext', () => {
  let buildUserContext;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('./projectDataEngine');
    buildUserContext = mod.buildUserContext;
  });

  it('returns empty string for null data', () => {
    expect(buildUserContext(null)).toBe('');
    expect(buildUserContext(undefined)).toBe('');
  });

  it('builds context with learning progress', () => {
    const data = {
      progress: {
        total: 2,
        courses: [
          { course_title: 'Python 101', progress_pct: 75, completed: false },
          { course_title: 'React', progress_pct: 100, completed: true },
        ],
      },
      fetched_at: '2026-08-28T12:00:00Z',
    };

    const ctx = buildUserContext(data);
    expect(ctx).toContain("USER'S LEARNING PROGRESS");
    expect(ctx).toContain('Python 101');
    expect(ctx).toContain('75%');
    expect(ctx).toContain('React');
    expect(ctx).toContain('✅ COMPLETED');
  });

  it('builds context with wallet balance', () => {
    const data = {
      wallet: { balance: 12.5, lifetime_earned: 45.0, currency: 'USD' },
      fetched_at: '2026-08-28T12:00:00Z',
    };

    const ctx = buildUserContext(data);
    expect(ctx).toContain('USER\'S WALLET');
    expect(ctx).toContain('$12.5');
    expect(ctx).toContain('$45');
  });

  it('builds context with saved items', () => {
    const data = {
      saved: { courses: 3, music: 2, talents: 1 },
      fetched_at: '2026-08-28T12:00:00Z',
    };

    const ctx = buildUserContext(data);
    expect(ctx).toContain('USER\'S SAVED ITEMS');
    expect(ctx).toContain('3 courses');
    expect(ctx).toContain('2 music tracks');
    expect(ctx).toContain('1 talent');
  });

  it('builds context with upcoming events', () => {
    const data = {
      events: {
        total: 2,
        upcoming: [
          { id: 1, title: 'Web Dev Workshop', date: '2026-09-01', location: 'Online' },
          { id: 2, title: 'Music Night', date: '2026-09-15' },
        ],
      },
      fetched_at: '2026-08-28T12:00:00Z',
    };

    const ctx = buildUserContext(data);
    expect(ctx).toContain('UPCOMING EVENTS');
    expect(ctx).toContain('Web Dev Workshop');
    expect(ctx).toContain('Online');
  });

  it('builds context with unread notifications', () => {
    const data = {
      activity: { unread: 5, total: 12 },
      fetched_at: '2026-08-28T12:00:00Z',
    };

    const ctx = buildUserContext(data);
    expect(ctx).toContain('UNREAD ACTIVITY');
    expect(ctx).toContain('5 unread');
  });

  it('skips empty sections', () => {
    const data = {
      progress: { total: 0, courses: [] },
      wallet: { balance: 0, lifetime_earned: 0 },
      saved: { courses: 0, music: 0, talents: 0 },
      events: { total: 0, upcoming: [] },
      activity: { unread: 0, total: 0 },
      fetched_at: '2026-08-28T12:00:00Z',
    };

    const ctx = buildUserContext(data);
    expect(ctx).toBe('');
  });

  it('builds context with multiple sections combined', () => {
    const data = {
      progress: { total: 1, courses: [{ course_title: 'Python', progress_pct: 50, completed: false }] },
      wallet: { balance: 10, lifetime_earned: 25, currency: 'USD' },
      saved: { courses: 2, music: 1, talents: 0 },
      activity: { unread: 3, total: 8 },
      fetched_at: '2026-08-28T12:00:00Z',
    };

    const ctx = buildUserContext(data);
    expect(ctx).toContain("USER'S LEARNING PROGRESS");
    expect(ctx).toContain("USER'S WALLET");
    expect(ctx).toContain('USER\'S SAVED ITEMS');
    expect(ctx).toContain('UNREAD ACTIVITY');
  });
});
