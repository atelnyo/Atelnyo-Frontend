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

  it('emits REAL canonical links for courses, creators, communities, posts', () => {
    const data = {
      courses: { total: 1, top: [{ id: 7, title: 'Kreyòl De Baz', creator: 'marie', price: 0, slug: 'kreyol-de-baz' }] },
      creators: { total: 1, top: [{ id: 2, slug: 'marie', username: 'marie', display_name: 'Marie', is_verified: true, is_featured: false, followers: 10, courses: 3 }] },
      communities: { total: 1, top: [{ id: 3, slug: 'kreyol-fans', name: 'Kreyòl Fans', members: 42 }] },
      posts: { total: 1, top: [{ id: 9, excerpt: 'Bonjou tout moun!', author_username: 'marie', slug: 'abc123', url: '/c/marie/post/abc123', published_at: '2026-08-28T12:00:00Z' }] },
      fetched_at: '2026-08-28T12:00:00Z',
    };

    const ctx = buildProjectContext(data);
    // Course canonical URL — slug + creator, never guessed.
    expect(ctx).toContain('https://atelnyo.site/kreyol-de-baz/by/marie/course');
    // Creator profile URL.
    expect(ctx).toContain('https://atelnyo.site/c/marie');
    // Community URL.
    expect(ctx).toContain('https://atelnyo.site/sheet/community/kreyol-fans');
    // Post section with the EXACT backend-provided link.
    expect(ctx).toContain('RECENT CREATOR POSTS');
    expect(ctx).toContain('https://atelnyo.site/c/marie/post/abc123');
    expect(ctx).toContain('@marie');
  });

  it('emits product price + stock + description + REAL link', () => {
    const data = {
      products: { total: 2, top: [
        { id: 11, slug: 'konpa-tshirt', title: 'Konpa T-Shirt', description: 'Bel mayo koton ak logo konpa.', price: 25, stock: 7, seller: 'marie' },
        { id: 12, slug: 'vye-bag', title: 'Vye Bag', description: '', price: 0, stock: 0, seller: 'marie' },
      ] },
      fetched_at: '2026-08-28T12:00:00Z',
    };

    const ctx = buildProjectContext(data);
    expect(ctx).toContain('MARKETPLACE PRODUCTS');
    // Price + stock + description from live data.
    expect(ctx).toContain('$25');
    expect(ctx).toContain('7 in stock');
    expect(ctx).toContain('Bel mayo koton');
    // Sold-out product is flagged, still with its real link.
    expect(ctx).toContain('OUT OF STOCK');
    expect(ctx).toContain('https://atelnyo.site/konpa-tshirt/by/marie/product');
    expect(ctx).toContain('https://atelnyo.site/vye-bag/by/marie/product');
  });

  it('omits community link when slug is missing (never invent URLs)', () => {
    const data = {
      communities: { total: 1, top: [{ id: 3, name: 'Sans Slug', members: 1 }] },
      fetched_at: '2026-08-28T12:00:00Z',
    };

    const ctx = buildProjectContext(data);
    expect(ctx).toContain('Sans Slug');
    expect(ctx).not.toContain('Link:');
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

  it("builds context with the user's own posts and REAL links", () => {
    const data = {
      username: 'marie',
      my_posts: [
        { slug: 'abc123', excerpt: 'Premye post mwen!', url: '/c/marie/post/abc123', created_at: '2026-08-28T12:00:00Z' },
      ],
      fetched_at: '2026-08-28T12:00:00Z',
    };

    const ctx = buildUserContext(data);
    expect(ctx).toContain("USER'S OWN POSTS");
    expect(ctx).toContain('@marie');
    expect(ctx).toContain('Premye post mwen!');
    expect(ctx).toContain('https://atelnyo.site/c/marie/post/abc123');
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
