/**
 * authUtils.test.js — unit tests for the auth validation helpers.
 *
 * Covers:
 *   isValidEmail         — pragmatic email format gate
 *   scorePassword        — 0-4 strength + Django-aligned `met` flag
 *   validateSignupFields — pre-submit signup validation (ht/en)
 *   validateLoginFields  — pre-submit login validation (ht/en)
 */
import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  scorePassword,
  validateSignupFields,
  validateLoginFields,
  MIN_PASSWORD_LENGTH,
  extractOtpCode,
} from './authUtils';

describe('isValidEmail', () => {
  it('accepts normal addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('first.last+tag@sub.domain.io')).toBe(true);
  });

  it('rejects malformed addresses', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('nope')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);      // no TLD
    expect(isValidEmail('a b@c.com')).toBe(false); // space
    expect(isValidEmail('@c.com')).toBe(false);    // empty local
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(42)).toBe(false);
  });
});

describe('scorePassword', () => {
  it('scores an empty password at 0 with nothing met', () => {
    const r = scorePassword('');
    expect(r.score).toBe(0);
    expect(r.met).toBe(false);
  });

  it('caps short passwords at 1 even with variety', () => {
    const r = scorePassword('Ab1!');
    expect(r.score).toBeLessThanOrEqual(1);
    expect(r.met).toBe(false);
    expect(r.checks.length).toBe(false);
  });

  it('flags common passwords', () => {
    const r = scorePassword('password1');
    expect(r.isCommon).toBe(true);
    expect(r.score).toBeLessThanOrEqual(1);
  });

  it('gives a medium score to length+letter+number', () => {
    const r = scorePassword('bonjou1234');
    expect(r.checks.length).toBe(true);
    expect(r.checks.letter).toBe(true);
    expect(r.checks.number).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(2);
    expect(r.met).toBe(true);
  });

  it('reaches the max with length, case mix, number and symbol', () => {
    const r = scorePassword('Kreyol-Atelye42!');
    expect(r.score).toBe(4);
    expect(r.met).toBe(true);
  });

  it('aligns MIN_PASSWORD_LENGTH with the Django validator (8)', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });
});

describe('validateSignupFields', () => {
  const valid = { email: 'a@b.co', password: 'longenough1', confirmPassword: 'longenough1' };

  it('returns no errors for a valid signup', () => {
    expect(validateSignupFields(valid, 'ht')).toEqual({});
    expect(validateSignupFields(valid, 'en')).toEqual({});
  });

  it('flags a bad email in both languages', () => {
    const errs = validateSignupFields({ ...valid, email: 'bad' }, 'en');
    expect(errs.email).toMatch(/valid email/i);
    const errsHt = validateSignupFields({ ...valid, email: 'bad' }, 'ht');
    expect(errsHt.email).toMatch(/imèl/i);
  });

  it('flags a short password', () => {
    const errs = validateSignupFields({ ...valid, password: 'ab1', confirmPassword: 'ab1' }, 'en');
    expect(errs.password).toMatch(/8 characters/);
  });

  it('flags a password without a number (Django alignment)', () => {
    const errs = validateSignupFields({ ...valid, password: 'longenough', confirmPassword: 'longenough' }, 'en');
    expect(errs.password).toMatch(/letter and one number/i);
  });

  it('flags mismatched confirmation', () => {
    const errs = validateSignupFields({ ...valid, confirmPassword: 'different1' }, 'ht');
    expect(errs.confirmPassword).toMatch(/menm/);
  });
});

describe('validateLoginFields', () => {
  it('returns no errors for a filled login', () => {
    expect(validateLoginFields({ email: 'user@example.com', password: 'x' }, 'en')).toEqual({});
  });

  it('requires the identifier and the password', () => {
    const errs = validateLoginFields({ email: '  ', password: '' }, 'en');
    expect(errs.email).toBeTruthy();
    expect(errs.password).toBeTruthy();
  });
});

describe('extractOtpCode', () => {
  it('pulls a bare 6-digit code', () => {
    expect(extractOtpCode('482913')).toBe('482913');
  });

  it('pulls the code from a pasted email body', () => {
    const email = 'Salut! Kòd Reset Password Ou\n\n  482 913\n\nTape kòd sa a nan fòm reset password la';
    expect(extractOtpCode(email)).toBe('482913');
  });

  it('handles the nbsp/thin-space variants email clients produce', () => {
    expect(extractOtpCode('Kòd ou: 482\u00a0913. Ekspire nan 24 èdtan.')).toBe('482913');
    expect(extractOtpCode('482\u202f913')).toBe('482913');
    expect(extractOtpCode('482-913')).toBe('482913');
  });

  it('takes the first code when several appear', () => {
    expect(extractOtpCode('Chanjman 111222 fin fèt, kòd nouvo: 654321')).toBe('111222');
  });

  it('rejects dates, long ids, and non-codes', () => {
    expect(extractOtpCode('Voye 2026-09-26, ekspire 2026-10-26')).toBe('');
    expect(extractOtpCode('Referans: 20260926')).toBe('');
    expect(extractOtpCode('1234567')).toBe('');
    expect(extractOtpCode('abc 48a913')).toBe('');
    expect(extractOtpCode('')).toBe('');
    expect(extractOtpCode(null)).toBe('');
    expect(extractOtpCode(42)).toBe('');
  });
});
