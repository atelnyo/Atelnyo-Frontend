import { describe, expect, it } from 'vitest';
import { ogImageForLang, RAIL_ITEMS } from './profileConstants';

describe('profile locale metadata', () => {
  it('provides labels for all three supported languages across profile navigation', () => {
    for (const item of RAIL_ITEMS) {
      expect(item.label).toBeTruthy();
      expect(item.labelHt).toBeTruthy();
      expect(item.labelFr).toBeTruthy();
    }
  });

  it('maps legacy Spanish banner requests to the English banner', () => {
    expect(ogImageForLang('es')).toBe(`${window.location.origin}/og-banner-en.svg`);
  });
});
