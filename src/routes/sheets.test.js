/**
 * src/routes/sheets.test.js
 *
 * Legacy creator-profile URLs must reach the canonical /c/<username>
 * route. React Router v6 cannot match "@" in a path pattern, so the
 * redirect is derived from the raw pathname — this pins that mapping.
 */
import { describe, it, expect } from 'vitest';
import { legacyProfileTarget } from './sheets';

describe('legacyProfileTarget', () => {
  it('maps /@username to /c/username', () => {
    expect(legacyProfileTarget('/@Atelnyo')).toBe('/c/Atelnyo');
  });

  it('maps the percent-encoded /%40username CDN variant', () => {
    expect(legacyProfileTarget('/%40Atelnyo')).toBe('/c/Atelnyo');
  });

  it('tolerates a trailing slash and re-encodes accents', () => {
    expect(legacyProfileTarget('/@josé/')).toBe('/c/jos%C3%A9');
  });

  it('ignores non-legacy paths (canonical /c/, locale prefixes, deep links)', () => {
    expect(legacyProfileTarget('/c/Atelnyo')).toBeNull();
    expect(legacyProfileTarget('/ht-HT/@Atelnyo')).toBeNull();
    expect(legacyProfileTarget('/@Atelnyo/courses')).toBeNull();
    expect(legacyProfileTarget('/explore')).toBeNull();
  });

  it('returns null for missing / malformed input', () => {
    expect(legacyProfileTarget('')).toBeNull();
    expect(legacyProfileTarget('/@')).toBeNull();
    expect(legacyProfileTarget(undefined)).toBeNull();
    // A malformed escape must not throw.
    expect(legacyProfileTarget('/@%E0%A4%A')).toBe('/c/%25E0%25A4%25A');
  });
});
