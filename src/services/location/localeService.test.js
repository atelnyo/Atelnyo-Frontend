import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSupportedBrowserLanguage } from './localeService';

describe('getSupportedBrowserLanguage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('walks ordered browser locales until it finds a supported language', () => {
    vi.stubGlobal('navigator', {
      languages: ['de-DE', 'pt-BR', 'fr-CA', 'en-US'],
      language: 'de-DE',
    });

    expect(getSupportedBrowserLanguage()).toBe('fr');
  });

  it('maps a Spanish browser locale to the supported Spanish UI language', () => {
    vi.stubGlobal('navigator', {
      languages: ['es-ES'],
      language: 'es-ES',
    });

    expect(getSupportedBrowserLanguage()).toBe('es');
    expect(getSupportedBrowserLanguage(['ht', 'en', 'fr'])).toBeNull();
  });

  it('returns null when no browser locale is supported', () => {
    vi.stubGlobal('navigator', {
      languages: ['de-DE', 'ja-JP'],
      language: 'de-DE',
    });

    expect(getSupportedBrowserLanguage()).toBeNull();
  });
});
