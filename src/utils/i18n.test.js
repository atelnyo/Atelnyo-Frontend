import { describe, it, expect } from 'vitest';
import { translateKey, t2, t2Resolved, DEFAULT_LANGUAGE, normalizeSupportedLanguage, t } from './i18n';
import { DEFAULT_LANGUAGE as DEFAULT_LANG, SUPPORTED_LANGUAGES } from '../config/markets';
import { translations } from '../data/translations';

describe('translateKey — never returns undefined', () => {
  const dict = {
    ht: { 'common.save': 'Sove', 'course.start': 'Kòmanse' },
    en: { 'common.save': 'Save' },
    fr: {},
  };

  it('returns the requested language value when present', () => {
    expect(translateKey('ht', 'common.save', dict)).toBe('Sove');
    expect(translateKey('es', 'common.save', dict)).toBe('Save');
  });

  it('falls back to DEFAULT_LANGUAGE when the requested lang is missing', () => {
    // DEFAULT_LANGUAGE is 'ht' and ht has 'common.save'
    expect(translateKey('fr', 'common.save', dict)).toBe('Sove');
  });

  it('falls back to explicit fallback when no dict value exists', () => {
    expect(
      translateKey('fr', 'settings.language', dict, 'Language'),
    ).toBe('Language');
  });

  it('returns the key itself when nothing else is available (never undefined)', () => {
    expect(translateKey('fr', 'settings.language', dict)).toBe('settings.language');
    expect(translateKey('fr', 'common.save', {})).toBe('common.save');
  });

  it('returns the explicit fallback as a string even when it is not a string', () => {
    expect(translateKey('fr', 'x', dict, 123)).toBe('123');
  });

  it('returns fallback / key when translations dict is missing or null', () => {
    expect(translateKey('ht', 'common.save', null, 'Save')).toBe('Save');
    expect(translateKey('ht', 'common.save', undefined, 'Save')).toBe('Save');
    expect(translateKey('ht', 'common.save', null)).toBe('common.save');
  });

  it('returns fallback / key when key is empty', () => {
    expect(translateKey('ht', '', dict, 'fallback')).toBe('fallback');
    expect(translateKey('ht', '', dict)).toBe('');
  });

  it('does not treat the default language as a fallback when it is the requested lang', () => {
    // When DEFAULT_LANGUAGE === requested lang, do not double-resolve.
    expect(translateKey(DEFAULT_LANG, 'common.save', dict)).toBe('Sove');
  });
});

describe('t2 — existing contract unchanged', () => {
  it('returns the requested language when present', () => {
    expect(t2('ht', { ht: 'Kreyòl', en: 'English', fr: 'Français' })).toBe('Kreyòl');
  });

  it('falls back to en then first available', () => {
    expect(t2('es', { en: 'English', fr: 'Français' })).toBe('English');
    expect(t2('es', { fr: 'Français' })).toBe('Français');
  });

  it('returns empty string for a completely empty map', () => {
    expect(t2('ht', {})).toBe('');
    expect(t2('ht', null)).toBe('');
  });
});

describe('t2Resolved — wraps t2 and may log missing keys in dev', () => {
  it('returns the same value as t2', () => {
    expect(t2Resolved('ht', { ht: 'Kreyòl', en: 'English' })).toBe('Kreyòl');
    expect(t2Resolved('es', { en: 'English' })).toBe('English');
  });

  it('returns the t2 fallback when the requested lang is missing', () => {
    expect(t2Resolved('fr', { en: 'English' })).toBe('English');
  });
});

describe('DEFAULT_LANGUAGE export agrees with markets config', () => {
  it('matches src/config/markets.js DEFAULT_LANGUAGE', () => {
    expect(DEFAULT_LANGUAGE).toBe(DEFAULT_LANG);
  });
});

describe('supported interface languages', () => {
  it('exposes only Haitian Creole, English, and French', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['ht', 'en', 'fr']);
    expect(Object.keys(translations).sort()).toEqual(['en', 'fr', 'ht']);
  });

  it('normalizes legacy Spanish UI preferences to English', () => {
    expect(normalizeSupportedLanguage('es')).toBe('en');
    expect(normalizeSupportedLanguage('ES-es')).toBe('en');
    expect(t2('es', { ht: 'Kreyòl', en: 'English', fr: 'Français', es: 'Español' })).toBe('English');
    expect(t('es', 'Kreyòl', 'English', 'Français', 'Español')).toBe('English');
  });

  it('requires each supported dictionary to provide the same non-empty keys', () => {
    const [reference, ...others] = Object.values(translations).map((dict) => Object.keys(dict).sort());
    for (const keys of others) {
      expect(keys).toEqual(reference);
    }
    for (const dict of Object.values(translations)) {
      expect(Object.values(dict).every((value) => typeof value === 'string' && value.trim())).toBe(true);
    }
  });
});
