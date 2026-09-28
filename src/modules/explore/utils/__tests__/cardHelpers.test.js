/**
 * src/modules/explore/utils/__tests__/cardHelpers.test.js (T031)
 *
 * Unit tests for the shared card helpers — classNames, number/date
 * formatting, track/talent normalization and the portfolio video
 * resolver (the guard that stops GitHub/live-site links from mounting
 * a broken hover player).
 */
import { describe, it, expect } from 'vitest';
import {
  classNames,
  normalizeTrack,
  normalizeTalent,
  formatPlays,
  formatEventDate,
  getChipLabel,
  resolvePortfolioVideo,
} from '../cardHelpers';

describe('classNames', () => {
  it('joins truthy parts and skips falsy ones', () => {
    expect(classNames('a', 'b', null, undefined, '', 'c')).toBe('a b c');
    expect(classNames()).toBe('');
  });
});

describe('formatPlays', () => {
  it('formats thousands and millions', () => {
    expect(formatPlays(1200)).toBe('1.2K');
    expect(formatPlays(3500000)).toBe('3.5M');
    expect(formatPlays(42)).toBe('42');
  });
  it('handles non-numbers', () => {
    expect(formatPlays(null)).toBe('0');
    expect(formatPlays('x')).toBe('0');
  });
});

describe('normalizeTrack / normalizeTalent', () => {
  it('prefers canonical fields over URL variants', () => {
    const t = normalizeTrack({ cover_url: 'a.jpg', cover: 'b.jpg' });
    expect(t.cover).toBe('b.jpg');
    const t2 = normalizeTrack({ cover_url: 'a.jpg' });
    expect(t2.cover).toBe('a.jpg');
  });
  it('normalizes talent avatar', () => {
    expect(normalizeTalent({ avatar_url: 'x.png' }).avatar).toBe('x.png');
    expect(normalizeTalent(null)).toBeNull();
  });
});

describe('formatEventDate', () => {
  it('formats an ISO date and returns empty for none', () => {
    expect(formatEventDate('')).toBe('');
    expect(formatEventDate('not-a-date')).toBe('not-a-date');
    expect(formatEventDate('2026-08-12T10:00:00Z')).toMatch(/Aug|2026/);
  });
});

describe('getChipLabel', () => {
  const chip = { ht: 'Kreyòl', en: 'English', fr: 'Français' };
  it('picks the requested language with ht fallback', () => {
    expect(getChipLabel(chip, 'en')).toBe('English');
    expect(getChipLabel(chip, 'ht')).toBe('Kreyòl');
    expect(getChipLabel(chip, 'unknown')).toBe('Kreyòl');
  });
});

describe('resolvePortfolioVideo', () => {
  it('picks an explicit video entry from media_gallery', () => {
    const p = { media_gallery: [{ url: 'https://youtube.com/watch?v=1', type: 'video' }] };
    expect(resolvePortfolioVideo(p)).toBe('https://youtube.com/watch?v=1');
  });

  it('picks a gallery entry whose url ends in .mp4 even without type', () => {
    const p = { media_gallery: [{ url: 'https://cdn.com/demo.mp4' }] };
    expect(resolvePortfolioVideo(p)).toBe('https://cdn.com/demo.mp4');
  });

  it('accepts a project_url that is clearly a video', () => {
    expect(resolvePortfolioVideo({ project_url: 'https://vimeo.com/123' })).toBe('https://vimeo.com/123');
    expect(resolvePortfolioVideo({ project_url: 'https://youtu.be/abc' })).toBe('https://youtu.be/abc');
  });

  it('rejects GitHub / live-site project_url (not a video)', () => {
    expect(resolvePortfolioVideo({ project_url: 'https://github.com/user/repo' })).toBe('');
    expect(resolvePortfolioVideo({ project_url: 'https://mysite.com' })).toBe('');
  });

  it('returns empty for missing project', () => {
    expect(resolvePortfolioVideo(null)).toBe('');
    expect(resolvePortfolioVideo({})).toBe('');
  });
});
