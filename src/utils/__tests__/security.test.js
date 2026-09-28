import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateInputLength,
  validateUploadFile,
  validateVideoUrl,
  validateImageUrl,
  detectPotentialXss,
  checkCacheIsolation,
  mightContainSensitiveData,
  trackRequest,
} from '../security';

describe('validateInputLength', () => {
  it('accepts valid length', () => {
    expect(validateInputLength('courseTitle', 'My Course').valid).toBe(true);
  });

  it('rejects over-length input', () => {
    const result = validateInputLength('courseTitle', 'a'.repeat(201));
    expect(result.valid).toBe(false);
    expect(result.max).toBe(200);
  });

  it('handles unknown fields', () => {
    expect(validateInputLength('unknown', 'anything').valid).toBe(true);
  });
});

describe('validateUploadFile', () => {
  it('rejects no file', () => {
    const result = validateUploadFile(null);
    expect(result.valid).toBe(false);
  });

  it('rejects oversized file', () => {
    const file = { name: 'large.jpg', type: 'image/jpeg', size: 20 * 1024 * 1024 };
    const result = validateUploadFile(file, 'image');
    expect(result.valid).toBe(false);
  });

  it('rejects wrong type', () => {
    const file = { name: 'script.exe', type: 'application/x-msdownload', size: 1024 };
    const result = validateUploadFile(file, 'image');
    expect(result.valid).toBe(false);
  });

  it('rejects dangerous filename', () => {
    const file = { name: '../../../etc/passwd', type: 'image/jpeg', size: 1024 };
    const result = validateUploadFile(file, 'image');
    expect(result.valid).toBe(false);
  });

  it('accepts valid image', () => {
    const file = { name: 'photo.jpg', type: 'image/jpeg', size: 1024 * 100 };
    const result = validateUploadFile(file, 'image');
    expect(result.valid).toBe(true);
    expect(result.fileType).toBe('image');
  });
});

describe('validateVideoUrl', () => {
  it('validates YouTube URL', () => {
    const result = validateVideoUrl('https://www.youtube.com/watch?v=abc123');
    expect(result.valid).toBe(true);
    expect(result.isTrustedVideo).toBe(true);
  });

  it('blocks javascript: URL', () => {
    const result = validateVideoUrl('javascript:alert(1)');
    expect(result.valid).toBe(false);
  });

  it('warns about unknown providers', () => {
    const result = validateVideoUrl('https://random-site.com/video');
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('validateImageUrl', () => {
  it('validates HTTPS image URL', () => {
    const result = validateImageUrl('https://images.unsplash.com/photo.jpg');
    expect(result.valid).toBe(true);
  });

  it('blocks javascript: URL', () => {
    const result = validateImageUrl('javascript:alert(1)');
    expect(result.valid).toBe(false);
  });
});

describe('detectPotentialXss', () => {
  it('detects script tags', () => {
    expect(detectPotentialXss('<script>alert(1)</script>')).toBe(true);
  });

  it('detects javascript: URLs', () => {
    expect(detectPotentialXss('javascript:alert(1)')).toBe(true);
  });

  it('detects event handlers', () => {
    expect(detectPotentialXss('onclick="alert(1)"')).toBe(true);
  });

  it('allows normal text', () => {
    expect(detectPotentialXss('Hello world')).toBe(false);
    expect(detectPotentialXss('Course description')).toBe(false);
  });

  it('handles falsy input', () => {
    expect(detectPotentialXss(null)).toBe(false);
    expect(detectPotentialXss('')).toBe(false);
  });
});

describe('checkCacheIsolation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns isolated for no stored user', () => {
    expect(checkCacheIsolation({ id: 1 }).isolated).toBe(true);
  });

  it('detects stale user data', () => {
    localStorage.setItem('user', JSON.stringify({ id: 2 }));
    const result = checkCacheIsolation({ id: 1 });
    expect(result.isolated).toBe(false);
  });

  it('confirms matching user', () => {
    localStorage.setItem('user', JSON.stringify({ id: 1 }));
    const result = checkCacheIsolation({ id: 1 });
    expect(result.isolated).toBe(true);
  });
});

describe('mightContainSensitiveData', () => {
  it('detects password references', () => {
    expect(mightContainSensitiveData('my_password_value')).toBe(true);
  });

  it('detects token references', () => {
    expect(mightContainSensitiveData('auth_token_abc')).toBe(true);
  });

  it('allows normal strings', () => {
    expect(mightContainSensitiveData('Hello world')).toBe(false);
  });
});

describe('trackRequest', () => {
  it('tracks requests per endpoint', () => {
    const result1 = trackRequest('/api/courses/');
    expect(result1.requestsInLastMinute).toBe(1);

    const result2 = trackRequest('/api/courses/');
    expect(result2.requestsInLastMinute).toBe(2);
  });
});
