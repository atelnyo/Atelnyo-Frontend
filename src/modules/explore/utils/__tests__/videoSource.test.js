/**
 * src/modules/explore/utils/__tests__/videoSource.test.js (T031)
 *
 * Unit tests for the shared video-source resolver — the single source
 * of truth for card hover previews AND detail-sheet embeds. Covers the
 * platform matrix (YouTube/Vimeo/Facebook/TikTok/file) plus the edge
 * cases the production code guards against (short links, non-video
 * pages, malformed URLs).
 */
import { describe, it, expect } from 'vitest';
import { resolveVideoSource, hoverEmbedSrc } from '../videoSource';

describe('resolveVideoSource', () => {
  it('returns null for empty / non-string input', () => {
    expect(resolveVideoSource(null)).toBeNull();
    expect(resolveVideoSource(undefined)).toBeNull();
    expect(resolveVideoSource('')).toBeNull();
    expect(resolveVideoSource('   ')).toBeNull();
  });

  it('resolves YouTube watch URLs', () => {
    const r = resolveVideoSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(r).toEqual({
      kind: 'embed',
      provider: 'youtube',
      src: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    });
  });

  it('resolves youtu.be short links', () => {
    const r = resolveVideoSource('https://youtu.be/dQw4w9WgXcQ');
    expect(r?.provider).toBe('youtube');
    expect(r?.src).toContain('dQw4w9WgXcQ');
  });

  it('resolves YouTube Shorts', () => {
    const r = resolveVideoSource('https://www.youtube.com/shorts/dQw4w9WgXcQ');
    expect(r?.provider).toBe('youtube');
    expect(r?.src).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });

  it('rejects a YouTube page with no video id', () => {
    expect(resolveVideoSource('https://www.youtube.com/')).toBeNull();
  });

  it('resolves Vimeo numeric ids (last numeric segment)', () => {
    const r = resolveVideoSource('https://vimeo.com/123456789');
    expect(r?.provider).toBe('vimeo');
    expect(r?.src).toBe('https://player.vimeo.com/video/123456789');
  });

  it('resolves Facebook watch URLs via the plugin', () => {
    const r = resolveVideoSource('https://www.facebook.com/watch/?v=123456789');
    expect(r?.provider).toBe('facebook');
    expect(r?.kind).toBe('embed');
    expect(r?.src).toContain('plugins/video.php?href=');
  });

  it('resolves fb.watch short links', () => {
    const r = resolveVideoSource('https://fb.watch/abc123/');
    expect(r?.provider).toBe('facebook');
  });

  it('resolves canonical TikTok video URLs', () => {
    const r = resolveVideoSource('https://www.tiktok.com/@user/video/7123456789012345678');
    expect(r?.provider).toBe('tiktok');
    expect(r?.src).toBe('https://www.tiktok.com/embed/v2/7123456789012345678');
  });

  it('returns null for TikTok shorteners (vm./vt.)', () => {
    expect(resolveVideoSource('https://vm.tiktok.com/ZZZabcXYZ/')).toBeNull();
    expect(resolveVideoSource('https://vt.tiktok.com/ZSXdRcxyz/')).toBeNull();
  });

  it('treats direct media files as file kind', () => {
    const r = resolveVideoSource('https://cdn.example.com/video.mp4');
    expect(r?.kind).toBe('file');
    expect(r?.src).toBe('https://cdn.example.com/video.mp4');
  });

  it('falls back to file kind for unknown hosts', () => {
    const r = resolveVideoSource('https://example.com/whatever');
    expect(r?.kind).toBe('file');
  });
});

describe('hoverEmbedSrc', () => {
  it('appends muted-autoplay params for YouTube', () => {
    const src = resolveVideoSource('https://www.youtube.com/watch?v=abc123');
    const hover = hoverEmbedSrc(src);
    expect(hover).toContain('autoplay=1');
    expect(hover).toContain('mute=1');
    expect(hover).toContain('playsinline=1');
  });

  it('appends muted-autoplay params for Vimeo', () => {
    const src = resolveVideoSource('https://vimeo.com/987654');
    const hover = hoverEmbedSrc(src);
    expect(hover).toContain('autoplay=1');
    expect(hover).toContain('muted=1');
  });

  it('returns null for Facebook/TikTok (no muted autoplay support)', () => {
    expect(hoverEmbedSrc(resolveVideoSource('https://www.facebook.com/watch/?v=1'))).toBeNull();
    expect(hoverEmbedSrc(resolveVideoSource('https://www.tiktok.com/@u/video/123'))).toBeNull();
  });

  it('returns null for file kind', () => {
    expect(hoverEmbedSrc(resolveVideoSource('https://cdn.example.com/v.mp4'))).toBeNull();
    expect(hoverEmbedSrc(null)).toBeNull();
  });
});
