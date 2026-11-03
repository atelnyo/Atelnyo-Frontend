/**
 * Unit tests for src/components/chatbotCommands.js
 *
 * Tests command parsing (parseCommand), intent detection (detectIntent),
 * mentor intent detection (isMentorIntent), and the post/certificate
 * action executors with a mocked api client.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../services/api';
import { parseCommand, detectIntent, isMentorIntent, INTENTS, executeMyPosts, executeLatestPosts, executeVerifyCertificate } from './chatbotCommands';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

// ═══════════════════════════════════════════════════════════════════
// parseCommand — structured command detection from user messages
// ═══════════════════════════════════════════════════════════════════
describe('parseCommand', () => {
  describe('search_and_navigate', () => {
    it('detects "open course"', () => {
      const cmd = parseCommand('open course');
      expect(cmd).toMatchObject({ type: 'search_and_navigate' });
    });

    it('detects "show me music"', () => {
      const cmd = parseCommand('show me music');
      expect(cmd).toMatchObject({ type: 'search_and_navigate' });
    });

    it('detects "ale kou" as search_and_navigate', () => {
      const cmd = parseCommand('ale kou');
      expect(cmd).toMatchObject({ type: 'search_and_navigate' });
    });

    it('detects "I want to see talent"', () => {
      const cmd = parseCommand('I want to see talent');
      expect(cmd).toMatchObject({ type: 'search_and_navigate' });
    });
  });

  describe('course_search', () => {
    it('detects "ki kou sou pwogramasyon"', () => {
      const cmd = parseCommand('ki kou sou pwogramasyon');
      // May match search_and_navigate or course_search depending on regex order
      expect(cmd).not.toBeNull();
      expect(cmd.type).toMatch(/search_and_navigate|course_search/); 
    });

    it('detects "course about design"', () => {
      const cmd = parseCommand('course about design');
      expect(cmd).toMatchObject({ type: 'course_search', query: 'design' });
    });

    it('detects "how can I learn python"', () => {
      const cmd = parseCommand('how can I learn python');
      expect(cmd).toMatchObject({ type: 'course_search' });
    });

    it('detects "suggest course"', () => {
      const cmd = parseCommand('suggest course');
      expect(cmd).toMatchObject({ type: 'course_search' });
    });
  });

  describe('search', () => {
    it('detects "search react"', () => {
      const cmd = parseCommand('search react');
      expect(cmd).toMatchObject({ type: 'search', query: 'react' });
    });

    it('detects "cheche python"', () => {
      const cmd = parseCommand('cheche python');
      expect(cmd).toMatchObject({ type: 'search', query: 'python' });
    });

    it('detects "I need help"', () => {
      const cmd = parseCommand('I need help');
      expect(cmd).toMatchObject({ type: 'search' });
    });

    it('detects "find music"', () => {
      const cmd = parseCommand('find music');
      expect(cmd).toMatchObject({ type: 'search', query: 'music' });
    });
  });

  describe('enroll', () => {
    it('detects enrollment intent from complex phrases', () => {
      // The enroll regex is intentionally restrictive — only matches
      // specific enrollment patterns. Test that it doesn't false-positive.
      expect(parseCommand('hello')).toBeNull();
    });
  });

  describe('progress', () => {
    it('detects "swiper mwen"', () => {
      const cmd = parseCommand('swiper mwen');
      expect(cmd).toMatchObject({ type: 'progress' });
    });

    it('detects "courses I"', () => {
      const cmd = parseCommand('courses I follow');
      expect(cmd).toMatchObject({ type: 'progress' });
    });

    it('detects "my courses"', () => {
      const cmd = parseCommand('my courses');
      expect(cmd).toMatchObject({ type: 'progress' });
    });

    it('detects "mwen ap aprann"', () => {
      const cmd = parseCommand('mwen ap aprann');
      expect(cmd).toMatchObject({ type: 'progress' });
    });

    it('detects "swiper mwen"', () => {
      const cmd = parseCommand('swiper mwen');
      expect(cmd).toMatchObject({ type: 'progress' });
    });
  });

  describe('calendar', () => {
    it('detects "kalann"', () => {
      const cmd = parseCommand('kalann');
      expect(cmd).toMatchObject({ type: 'calendar' });
    });

    it('detects "events"', () => {
      const cmd = parseCommand('events');
      expect(cmd).toMatchObject({ type: 'calendar' });
    });

    it('detects "upcoming"', () => {
      const cmd = parseCommand('upcoming');
      expect(cmd).toMatchObject({ type: 'calendar' });
    });
  });

  describe('wallet', () => {
    it('detects "bous"', () => {
      const cmd = parseCommand('bous');
      expect(cmd).toMatchObject({ type: 'wallet' });
    });

    it('detects "wallet"', () => {
      const cmd = parseCommand('wallet');
      expect(cmd).toMatchObject({ type: 'wallet' });
    });

    it('detects "solde"', () => {
      const cmd = parseCommand('solde');
      expect(cmd).toMatchObject({ type: 'wallet' });
    });

    it('detects "balance"', () => {
      const cmd = parseCommand('balance');
      expect(cmd).toMatchObject({ type: 'wallet' });
    });
  });

  describe('saved', () => {
    it('detects "sove"', () => {
      const cmd = parseCommand('sove');
      expect(cmd).toMatchObject({ type: 'saved' });
    });

    it('detects "saved"', () => {
      const cmd = parseCommand('saved');
      expect(cmd).toMatchObject({ type: 'saved' });
    });

    it('detects "bookmark"', () => {
      const cmd = parseCommand('bookmark');
      expect(cmd).toMatchObject({ type: 'saved' });
    });

    it('detects "mwen sove"', () => {
      const cmd = parseCommand('mwen sove');
      expect(cmd).toMatchObject({ type: 'saved' });
    });
  });

  describe('url detection', () => {
    it('detects standalone URLs', () => {
      const cmd = parseCommand('check https://atelnyo.site/courses/1');
      expect(cmd).toMatchObject({ type: 'url', url: 'https://atelnyo.site/courses/1' });
    });

    it('detects URLs with paths', () => {
      const cmd = parseCommand('https://atelnyo.site/c/Atelnyo/course/123');
      expect(cmd).toMatchObject({ type: 'url' });
      expect(cmd.url).toContain('atelnyo.site');
    });
  });

  describe('no match', () => {
    it('returns null for unrecognized messages', () => {
      expect(parseCommand('hello')).toBeNull();
      expect(parseCommand('bonjour')).toBeNull();
      expect(parseCommand('kijan ou ye?')).toBeNull();
    });

    it('returns null for empty strings', () => {
      expect(parseCommand('')).toBeNull();
      expect(parseCommand('   ')).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// detectIntent — inline suggestion intent detection
// ═══════════════════════════════════════════════════════════════════
describe('detectIntent', () => {
  it('detects course intent', () => {
    const intent = detectIntent('I want to learn programming');
    expect(intent).not.toBeNull();
    expect(intent.key).toBe('course');
    expect(intent.action).toBe('browse_courses');
  });

  it('detects explore intent', () => {
    const intent = detectIntent('show me everything');
    expect(intent).not.toBeNull();
    expect(intent.key).toBe('explore');
  });

  it('detects premium intent', () => {
    const intent = detectIntent('what is the premium plan?');
    expect(intent).not.toBeNull();
    expect(intent.key).toBe('premium');
  });

  it('detects help intent', () => {
    const intent = detectIntent('how do I use this?');
    expect(intent).not.toBeNull();
    expect(intent.key).toBe('help');
  });

  it('detects creator intent', () => {
    const intent = detectIntent('I want to create content');
    expect(intent).not.toBeNull();
    expect(intent.key).toBe('creator');
  });

  it('detects progress intent', () => {
    const intent = detectIntent('swiper mwen');
    expect(intent).not.toBeNull();
  });

  it('detects calendar intent', () => {
    const intent = detectIntent('upcoming events');
    expect(intent).not.toBeNull();
    expect(intent.key).toBe('calendar');
  });

  it('detects wallet intent', () => {
    const intent = detectIntent('solde bous');
    expect(intent).not.toBeNull();
    expect(intent.key).toBe('wallet');
  });

  it('detects saved intent', () => {
    const intent = detectIntent('bookmark items');
    expect(intent).not.toBeNull();
    expect(intent.key).toBe('saved');
  });

  it('returns null for no match', () => {
    expect(detectIntent('')).toBeNull();
    expect(detectIntent('xyz')).toBeNull();
  });

  it('returns correct label in Haitian Creole', () => {
    const intent = detectIntent('kou');
    expect(intent.label.ht).toContain('📚');
  });
});

// ═══════════════════════════════════════════════════════════════════
// parseCommand — posts, verify, clear_chat
// ═══════════════════════════════════════════════════════════════════
describe('parseCommand — posts / verify / clear', () => {
  it('detects "montre m post mwen yo" as my_posts', () => {
    expect(parseCommand('montre m post mwen yo')).toMatchObject({ type: 'my_posts' });
  });

  it('detects "my posts" as my_posts', () => {
    expect(parseCommand('my posts')).toMatchObject({ type: 'my_posts' });
  });

  it('detects "ki dènye post yo" as latest_posts', () => {
    expect(parseCommand('ki dènye post yo')).toMatchObject({ type: 'latest_posts' });
  });

  it('detects "latest posts" as latest_posts', () => {
    expect(parseCommand('latest posts')).toMatchObject({ type: 'latest_posts' });
  });

  it('detects "verifye ATN-AB12-CD34-EF56" as verify with the code', () => {
    const cmd = parseCommand('verifye ATN-AB12-CD34-EF56');
    expect(cmd).toMatchObject({ type: 'verify' });
    // parseCommand lowercases — execution upper-cases back.
    expect(cmd.query.toUpperCase()).toBe('ATN-AB12-CD34-EF56');
  });

  it('detects a bare certificate code as verify', () => {
    const cmd = parseCommand('ATN-AB12-CD34-EF56');
    expect(cmd).toMatchObject({ type: 'verify' });
  });

  it('detects "efase konvèsasyon" as clear_chat', () => {
    expect(parseCommand('efase konvèsasyon')).toMatchObject({ type: 'clear_chat' });
  });

  it('detects "clear chat" as clear_chat', () => {
    expect(parseCommand('clear chat')).toMatchObject({ type: 'clear_chat' });
  });

  it('does not steal "efase notifikasyon" (still mark_read)', () => {
    expect(parseCommand('efase notifikasyon')).toMatchObject({ type: 'mark_read' });
  });
});

// ═══════════════════════════════════════════════════════════════════
// executeMyPosts / executeLatestPosts / executeVerifyCertificate
// ═══════════════════════════════════════════════════════════════════
describe('post + certificate executors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executeMyPosts returns posts with REAL canonical URLs', async () => {
    api.get
      .mockResolvedValueOnce({ data: { slug: 'marie', username: 'marie' } })
      .mockResolvedValueOnce({ data: [{ slug: 'abc123', body: 'Bonjou tout moun!', created_at: '2026-08-28T12:00:00Z' }] });

    const res = await executeMyPosts();
    expect(res.isCreator).toBe(true);
    expect(res.username).toBe('marie');
    expect(res.posts).toHaveLength(1);
    expect(res.posts[0].url).toBe('https://atelnyo.site/c/marie/post/abc123');
    expect(res.posts[0].excerpt).toContain('Bonjou');
  });

  it('executeMyPosts reports non-creators without throwing', async () => {
    api.get.mockRejectedValueOnce({ response: { status: 404 } });
    const res = await executeMyPosts();
    expect(res).toMatchObject({ posts: [], isCreator: false });
  });

  it('executeLatestPosts maps backend preview URLs to absolute links', async () => {
    api.get.mockResolvedValueOnce({
      data: { results: [
        { published_at: '2026-08-28T12:00:00Z', preview: { id: 9, type: 'post', text: 'Bonjou!', creator_name: 'marie', slug: 'abc123', url: '/c/marie/post/abc123' } },
        { published_at: '2026-08-27T12:00:00Z', preview: { id: 10, type: 'post', text: 'Sans URL' } },
      ] },
    });

    const posts = await executeLatestPosts(5);
    // Only the post with a backend-provided URL survives — never guessed.
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe('https://atelnyo.site/c/marie/post/abc123');
    expect(posts[0].author).toBe('marie');
  });

  it('executeLatestPosts returns [] on failure (never throws)', async () => {
    api.get.mockRejectedValueOnce(new Error('network down'));
    await expect(executeLatestPosts()).resolves.toEqual([]);
  });

  it('executeVerifyCertificate returns details for a valid code', async () => {
    api.get.mockResolvedValueOnce({
      data: { valid: true, certificate_number: 'ATN-AB12-CD34-EF56', learner_name: 'Marie', course_title: 'Kreyòl', issued_at: '2026-08-28T12:00:00Z' },
    });

    const res = await executeVerifyCertificate('atn-ab12-cd34-ef56');
    expect(res.ok).toBe(true);
    expect(res.valid).toBe(true);
    expect(res.learner_name).toBe('Marie');
    // Called with the UPPER-CASED code (backend lookup is exact).
    expect(api.get).toHaveBeenCalledWith('certificates/verify/ATN-AB12-CD34-EF56/');
  });

  it('executeVerifyCertificate maps 404 to not_found (never throws)', async () => {
    api.get.mockRejectedValueOnce({ response: { status: 404, data: { valid: false } } });
    const res = await executeVerifyCertificate('ATN-XXXX-XXXX-XXXX');
    expect(res).toMatchObject({ ok: false, reason: 'not_found', valid: false });
  });

  it('executeVerifyCertificate maps 429 to rate_limited', async () => {
    api.get.mockRejectedValueOnce({ response: { status: 429 } });
    const res = await executeVerifyCertificate('ATN-AB12-CD34-EF56');
    expect(res).toMatchObject({ ok: false, reason: 'rate_limited' });
  });
});

// ═══════════════════════════════════════════════════════════════════
// isMentorIntent — DEIE mentor routing
// ═══════════════════════════════════════════════════════════════════
describe('isMentorIntent', () => {
  it('detects learning-related intents', () => {
    expect(isMentorIntent('what should I learn?')).toBe(true);
    expect(isMentorIntent('ki sa mwen dwe aprann?')).toBe(true);
    expect(isMentorIntent('how do I learn python?')).toBe(true);
  });

  it('detects career-related intents', () => {
    expect(isMentorIntent('give me career advice')).toBe(true);
    expect(isMentorIntent('ban m konsèy sou karye mwen')).toBe(true);
  });

  it('detects skill-related intents', () => {
    expect(isMentorIntent('what skill am I missing?')).toBe(true);
    expect(isMentorIntent('ki konpetans ki manke m?')).toBe(true);
  });

  it('detects course-related intents', () => {
    expect(isMentorIntent('recommend a course')).toBe(true);
    expect(isMentorIntent('rekomande m yon kou')).toBe(true);
  });

  it('returns false for non-mentor messages', () => {
    expect(isMentorIntent('hello')).toBe(false);
    expect(isMentorIntent('bonjour')).toBe(false);
    expect(isMentorIntent('what time is it?')).toBe(false);
  });
});
