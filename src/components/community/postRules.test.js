import { describe, it, expect } from 'vitest';
import { POST_MAX_LENGTH, countPostChars, validatePostDraft } from './postRules';

describe('community post rules', () => {
  it('rejects whitespace-only posts', () => {
    expect(validatePostDraft('   \n  ')).toMatchObject({
      ok: false,
      reason: 'empty',
      text: '',
      length: 0,
    });
  });

  it('trims the body before publishing', () => {
    expect(validatePostDraft('  Bonjou kominote!  ')).toMatchObject({
      ok: true,
      text: 'Bonjou kominote!',
      length: 16,
    });
  });

  it('counts code points, not UTF-16 units', () => {
    expect(countPostChars('👍')).toBe(1);
    expect(validatePostDraft('👍')).toMatchObject({ ok: true, length: 1 });
  });

  it('rejects posts above the backend limit', () => {
    const result = validatePostDraft('a'.repeat(POST_MAX_LENGTH + 1));
    expect(result).toMatchObject({
      ok: false,
      reason: 'too_long',
      max: POST_MAX_LENGTH,
    });
  });
});
