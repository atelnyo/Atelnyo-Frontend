import { describe, expect, it } from 'vitest';
import { ogImageForLang, RAIL_ITEMS } from './profileConstants';

describe('profile locale metadata', () => {
  it('provides labels for all four supported languages across profile navigation', () => {
    for (const item of RAIL_ITEMS) {
      expect(item.label).toBeTruthy();
      expect(item.labelHt).toBeTruthy();
      expect(item.labelFr).toBeTruthy();
      expect(item.labelEs).toBeTruthy();
    }
  });

  it('uses the Spanish banner for Spanish and falls back to English otherwise', () => {
    expect(ogImageForLang('es')).toBe(`${window.location.origin}/og-banner-es.svg`);
    expect(ogImageForLang('de')).toBe(`${window.location.origin}/og-banner-en.svg`);
  });
});
