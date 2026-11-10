import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSupportedBrowserLanguage } from './localeService';

describe('getSupportedBrowserLanguage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('walks ordered browser locales until it finds a supported language', () => {
    vi.stubGlobal('navigator', {
      languages: ['de-DE', 'es-ES', 'fr-CA', 'en-US'],
      language: 'de-DE',
    });

    expect(getSupportedBrowserLanguage()).toBe('fr');
  });

  it('maps a legacy Spanish browser locale to English, never to an unsupported UI language', () => {
    vi.stubGlobal('navigator', {
      languages: ['es-ES'],
      language: 'es-ES',
    });

    expect(getSupportedBrowserLanguage()).toBe('en');
    expect(getSupportedBrowserLanguage(['es'])).toBeNull();
  });

  it('returns null when no browser locale is supported', () => {
    vi.stubGlobal('navigator', {
      languages: ['de-DE', 'ja-JP'],
      language: 'de-DE',
    });

    expect(getSupportedBrowserLanguage()).toBeNull();
  });
});
