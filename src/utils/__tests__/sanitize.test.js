import { describe, it, expect } from 'vitest';
import {
  sanitizePlainText,
  sanitizeAltText,
  sanitizeUrl,
  sanitizeRichText,
  sanitizeFilename,
  escapeHtml,
  stripTags,
  isExternalUrl,
} from '../sanitize';

describe('sanitizePlainText', () => {
  it('strips HTML tags', () => {
    expect(sanitizePlainText('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('escapes HTML entities', () => {
    const result = sanitizePlainText('Hello <script>alert(1)</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('alert(1)');
  });

  it('removes null bytes', () => {
    expect(sanitizePlainText('Hello\x00World')).toBe('HelloWorld');
  });

  it('returns empty string for falsy input', () => {
    expect(sanitizePlainText('')).toBe('');
    expect(sanitizePlainText(null)).toBe('');
    expect(sanitizePlainText(undefined)).toBe('');
  });

  it('truncates to max length', () => {
    const long = 'a'.repeat(20000);
    expect(sanitizePlainText(long, 100).length).toBe(100);
  });
});

describe('sanitizeAltText', () => {
  it('removes quotes', () => {
    expect(sanitizeAltText('Image with "quotes"')).not.toContain('"');
  });

  it('strips HTML', () => {
    expect(sanitizeAltText('<b>Bold alt</b>')).toBe('Bold alt');
  });

  it('truncates to 300 chars', () => {
    const long = 'a'.repeat(500);
    expect(sanitizeAltText(long).length).toBe(300);
  });
});

describe('sanitizeUrl', () => {
  it('allows valid HTTPS URLs', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
  });

  it('blocks javascript: URLs', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
  });

  it('blocks data: text/html URLs', () => {
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
  });

  it('blocks localhost', () => {
    expect(sanitizeUrl('http://localhost:8080')).toBe('');
  });

  it('blocks private IPs', () => {
    expect(sanitizeUrl('http://192.168.1.1')).toBe('');
    expect(sanitizeUrl('http://10.0.0.1')).toBe('');
    expect(sanitizeUrl('http://127.0.0.1')).toBe('');
  });

  it('allows relative paths', () => {
    expect(sanitizeUrl('/courses/123')).toBe('/courses/123');
    expect(sanitizeUrl('#section')).toBe('#section');
  });

  it('returns empty for empty input', () => {
    expect(sanitizeUrl('')).toBe('');
    expect(sanitizeUrl(null)).toBe('');
  });
});

describe('sanitizeRichText', () => {
  it('strips script tags', () => {
    const result = sanitizeRichText('<p>Hello</p><script>alert(1)</script>');
    expect(result).not.toContain('script');
    expect(result).toContain('Hello');
  });

  it('strips event handlers', () => {
    const result = sanitizeRichText('<p onclick="alert(1)">Hello</p>');
    expect(result).not.toContain('onclick');
  });

  it('preserves allowed tags', () => {
    const result = sanitizeRichText('<p><strong><em><a href="https://example.com">link</a></em></strong></p>');
    expect(result).toContain('<p>');
    expect(result).toContain('<strong>');
  });

  it('neutralizes javascript: URLs', () => {
    const result = sanitizeRichText('<a href="javascript:alert(1)">link</a>');
    expect(result).not.toContain('javascript:');
  });
});

describe('sanitizeFilename', () => {
  it('blocks path traversal', () => {
    expect(sanitizeFilename('../../../etc/passwd')).not.toContain('..');
    expect(sanitizeFilename('../../../etc/passwd')).not.toContain('/');
  });

  it('replaces special characters', () => {
    expect(sanitizeFilename('file<>:"|?*.txt')).not.toContain('<');
  });

  it('removes leading dots', () => {
    expect(sanitizeFilename('.hidden')).not.toMatch(/^\./);
  });

  it('returns "unnamed" for empty', () => {
    expect(sanitizeFilename('')).toBe('unnamed');
    expect(sanitizeFilename(null)).toBe('unnamed');
  });
});

describe('escapeHtml', () => {
  it('escapes all HTML entities', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('handles ampersands', () => {
    expect(escapeHtml('A & B')).toBe('A &amp; B');
  });
});

describe('stripTags', () => {
  it('removes all HTML tags', () => {
    expect(stripTags('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('handles nested tags', () => {
    expect(stripTags('<div><span><a href="#">link</a></span></div>')).toBe('link');
  });
});

describe('isExternalUrl', () => {
  it('identifies external URLs', () => {
    expect(isExternalUrl('https://example.com')).toBe(true);
    expect(isExternalUrl('https://atelnyo.site/courses')).toBe(false);
    expect(isExternalUrl('/courses/123')).toBe(false);
  });
});
