/**
 * feedScroll.test.js — Phase 5 guard: prepends must not move the row the
 * user is reading. Fake containers stand in for the DOM (no layout in
 * jsdom); the helpers only rely on the documented row/container shape.
 */
import { describe, expect, it } from 'vitest';
import {
  AT_TOP_THRESHOLD_PX,
  captureAnchor,
  isAtTop,
  restoreAnchor,
} from './feedScroll';

const row = (key, offsetTop) => ({ key, offsetTop });
const container = (scrollTop, rows) => ({
  scrollTop,
  querySelectorAll: () => rows,
});

describe('isAtTop', () => {
  it('treats a missing container as top (direct apply is safe)', () => {
    expect(isAtTop(null)).toBe(true);
  });

  it('is true within the threshold, false below it', () => {
    expect(isAtTop(container(0, []))).toBe(true);
    expect(isAtTop(container(AT_TOP_THRESHOLD_PX, []))).toBe(true);
    expect(isAtTop(container(AT_TOP_THRESHOLD_PX + 1, []))).toBe(false);
  });

  it('honours a custom threshold', () => {
    expect(isAtTop(container(100, []), 200)).toBe(true);
    expect(isAtTop(container(100, []), 50)).toBe(false);
  });
});

describe('captureAnchor / restoreAnchor', () => {
  it('returns null when there are no keyed rows', () => {
    expect(captureAnchor(container(0, []))).toBeNull();
    expect(captureAnchor(null)).toBeNull();
    expect(captureAnchor(container(0, [row(null, 0)]))).toBeNull();
  });

  it('anchors the first row at or below the viewport top', () => {
    const anchor = captureAnchor(
      container(120, [row('a', 100), row('b', 220), row('c', 340)]),
    );
    expect(anchor).toEqual({ key: 'b', delta: 100 });
  });

  it('keeps the anchored row pixel-stable across a prepend', () => {
    const before = container(120, [row('a', 100), row('b', 220)]);
    const anchor = captureAnchor(before);
    // Two new rows (200px) inserted above shift every old row down.
    const after = container(120, [row('x', 0), row('y', 100), row('a', 300), row('b', 420)]);
    expect(restoreAnchor(after, anchor)).toBe(true);
    // 'b' was 100px below the viewport top; it still is (420 - 320).
    expect(after.scrollTop).toBe(320);
  });

  it('restore is a safe no-op when the anchor or row is gone', () => {
    const c = container(120, [row('a', 100)]);
    expect(restoreAnchor(c, null)).toBe(false);
    expect(restoreAnchor(c, { key: 'gone', delta: 0 })).toBe(false);
    expect(c.scrollTop).toBe(120);
  });

  it('falls back to the first keyed row when all rows are above the top', () => {
    const anchor = captureAnchor(container(500, [row('a', 100), row('b', 200)]));
    expect(anchor.key).toBe('a');
  });
});
