import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reverseGeocode, searchCities } from './locationService';

describe('location service language', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ address: {} }) }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the selected supported language before English', async () => {
    await searchCities('Paris', undefined, 'fr');
    await reverseGeocode(48.86, 2.35, 'ht');

    const [searchUrl] = vi.mocked(fetch).mock.calls[0];
    const [reverseUrl] = vi.mocked(fetch).mock.calls[1];
    expect(new URL(searchUrl).searchParams.get('accept-language')).toBe('fr,en');
    expect(new URL(reverseUrl).searchParams.get('accept-language')).toBe('ht,en');
  });

  it('uses English when the requested language is unsupported', async () => {
    await searchCities('Paris', undefined, 'de');

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(new URL(url).searchParams.get('accept-language')).toBe('en');
  });
});
