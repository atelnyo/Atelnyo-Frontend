/**
 * Unit tests for the Atelyona Location Intelligence core.
 *
 * Covers:
 *   * TimezoneService — detection, unknown tz, unavailable Intl
 *   * LocaleService — locales list, language/region parsing, SSR-safe
 *   * NetworkSignalService — graceful when API missing
 *   * ConfidenceEngine — weights, VPN penalties, accuracy scaling,
 *     conflict detection, combination
 *   * SignalFusionEngine — the full spec test matrix (cases A–E) plus
 *     the "browser language is NOT country evidence" invariant.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

import { getBrowserTimezone, detectCountryFromTimezone, getTimezoneSignal } from './timezoneService';
import { getBrowserLocales, getPrimaryLocale, getLocaleLanguage, getLocaleRegion, getLocaleSignal, getSupportedBrowserLanguage } from './localeService';
import { getNetworkInfo, getNetworkSignal } from './networkSignalService';
import {
  SIGNAL_WEIGHTS, adjustGeoIpConfidence, scaleGeolocationConfidence,
  detectCountryConflict, combineAgreeingConfidence,
} from './confidenceEngine';
import { fuseCountrySignals } from './signalFusionEngine';

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════
// TimezoneService
// ═══════════════════════════════════════════════════════════════════

describe('TimezoneService', () => {
  it('detects the browser timezone from Intl', () => {
    expect(getBrowserTimezone()).toBeTypeOf('string');
  });

  it('returns null when Intl is unavailable (graceful)', () => {
    const orig = globalThis.Intl;
    globalThis.Intl = undefined;
    expect(getBrowserTimezone()).toBeNull();
    globalThis.Intl = orig;
  });

  it('maps America/Port-au-Prince to HT with strong confidence', () => {
    const sig = getTimezoneSignal('America/Port-au-Prince');
    expect(sig.value).toBe('HT');
    expect(sig.confidence).toBe(0.7);
    expect(sig.availability).toBe('available');
  });

  it('maps a shared timezone to its country with LOWER confidence', () => {
    const sig = getTimezoneSignal('America/New_York');
    expect(sig.value).toBe('US');
    expect(sig.confidence).toBe(0.4);
  });

  it('is not evidence when the timezone is unknown (matched=false)', () => {
    const sig = getTimezoneSignal('Asia/Seoul'); // not in our map
    expect(sig.matched).toBe(false);
    expect(sig.value).toBeNull();
    expect(sig.confidence).toBe(0);
  });

  it('handles a null/empty timezone as unavailable', () => {
    const sig = getTimezoneSignal(null);
    expect(sig.availability).toBe('unavailable');
    expect(sig.value).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// LocaleService
// ═══════════════════════════════════════════════════════════════════

describe('LocaleService', () => {
  it('returns the navigator.languages list', () => {
    const locales = getBrowserLocales();
    expect(Array.isArray(locales)).toBe(true);
  });

  it('parses language + region subtags', () => {
    expect(getLocaleLanguage('fr-FR')).toBe('fr');
    expect(getLocaleLanguage('ht')).toBe('ht');
    expect(getLocaleRegion('fr-FR')).toBe('FR');
    expect(getLocaleRegion('ht')).toBeNull();
  });

  it('is SSR-safe (no navigator → empty)', () => {
    const orig = globalThis.navigator;
    globalThis.navigator = undefined;
    expect(getBrowserLocales()).toEqual([]);
    expect(getPrimaryLocale()).toBeNull();
    expect(getLocaleSignal().availability).toBe('unavailable');
    globalThis.navigator = orig;
  });

  it('locale signal NEVER carries a country value', () => {
    const sig = getLocaleSignal();
    // The signal has language/region info but no country vote.
    expect(sig.source).toBe('locale');
    expect(sig.language).toBeTypeOf('string');
    // fusion must ignore it — covered in the fusion tests below.
  });

  describe('getSupportedBrowserLanguage', () => {
    // jsdom exposes navigator.languages — pin it per test.
    const setLocales = (locales) => {
      Object.defineProperty(globalThis.navigator, 'languages', {
        value: locales,
        configurable: true,
      });
    };

    afterEach(() => {
      Object.defineProperty(globalThis.navigator, 'languages', {
        value: ['en-US'],
        configurable: true,
      });
    });

    it('returns null when no browser language is supported', () => {
      setLocales(['de-DE', 'ja-JP']);
      expect(getSupportedBrowserLanguage(['ht', 'en', 'fr', 'es'])).toBeNull();
    });

    it('walks the FULL list — first supported preference wins', () => {
      // OS in an unsupported language, user added a supported one.
      setLocales(['de-DE', 'fr-FR', 'en-US']);
      expect(getSupportedBrowserLanguage(['ht', 'en', 'fr', 'es'])).toBe('fr');
    });

    it('respects the ordering of navigator.languages (ht first)', () => {
      setLocales(['ht', 'fr-FR']);
      expect(getSupportedBrowserLanguage(['ht', 'en', 'fr', 'es'])).toBe('ht');
    });

    it('matches bare language tags', () => {
      setLocales(['ht']);
      expect(getSupportedBrowserLanguage(['ht', 'en', 'fr', 'es'])).toBe('ht');
    });

    it('returns the primary language when no allowlist is given', () => {
      setLocales(['de-DE', 'fr-FR']);
      expect(getSupportedBrowserLanguage()).toBe('de');
    });

    it('falls back to navigator.language when languages is empty', () => {
      setLocales([]);
      // jsdom's navigator.language ('en-US') is the documented fallback.
      expect(getSupportedBrowserLanguage(['ht', 'en', 'fr', 'es'])).toBe('en');
    });

    it('returns null when the browser exposes no locales at all', () => {
      setLocales([]);
      const origLang = globalThis.navigator.language;
      Object.defineProperty(globalThis.navigator, 'language', {
        value: '',
        configurable: true,
      });
      try {
        expect(getSupportedBrowserLanguage(['ht', 'en'])).toBeNull();
      } finally {
        Object.defineProperty(globalThis.navigator, 'language', {
          value: origLang,
          configurable: true,
        });
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// NetworkSignalService
// ═══════════════════════════════════════════════════════════════════

describe('NetworkSignalService', () => {
  it('never fails when the API is missing', () => {
    const orig = globalThis.navigator;
    globalThis.navigator = undefined;
    const info = getNetworkInfo();
    expect(info.availability).toBe('unavailable');
    expect(info.isMobileConnection).toBe(false);
    expect(info.downlink).toBeNull();
    const sig = getNetworkSignal();
    expect(sig.value).toBeNull(); // never a country value
    globalThis.navigator = orig;
  });

  it('reports a mobile connection when effectiveType is cellular', () => {
    Object.defineProperty(globalThis.navigator, 'connection', {
      value: { effectiveType: '4g', downlink: 8.0, rtt: 50, saveData: false },
      configurable: true,
    });
    const info = getNetworkInfo();
    expect(info.availability).toBe('available');
    expect(info.isMobileConnection).toBe(true);
    expect(info.effectiveType).toBe('4g');
  });
});

// ═══════════════════════════════════════════════════════════════════
// ConfidenceEngine
// ═══════════════════════════════════════════════════════════════════

describe('ConfidenceEngine', () => {
  it('user_profile is the strongest signal', () => {
    expect(SIGNAL_WEIGHTS.user_profile).toBeGreaterThan(SIGNAL_WEIGHTS.geoip);
    expect(SIGNAL_WEIGHTS.geoip).toBeGreaterThan(SIGNAL_WEIGHTS.timezone);
    // locale + network are NOT country evidence.
    expect(SIGNAL_WEIGHTS.locale).toBe(0);
    expect(SIGNAL_WEIGHTS.network).toBe(0);
  });

  it('penalizes GeoIP confidence for VPN / proxy / hosting', () => {
    const clean = adjustGeoIpConfidence(0.8, {});
    expect(clean.adjusted).toBe(false);
    expect(clean.confidence).toBe(0.8);

    const vpn = adjustGeoIpConfidence(0.8, { vpn_detected: true });
    expect(vpn.adjusted).toBe(true);
    expect(vpn.confidence).toBeLessThan(0.8);
    expect(vpn.reasons).toContain('vpn');

    const tor = adjustGeoIpConfidence(0.8, { tor_detected: true });
    expect(tor.confidence).toBeLessThan(vpn.confidence);
  });

  it('scales geolocation confidence by accuracy', () => {
    expect(scaleGeolocationConfidence(50)).toBe(0.95);
    expect(scaleGeolocationConfidence(500)).toBe(0.8);
    expect(scaleGeolocationConfidence(20000)).toBe(0.35);
    expect(scaleGeolocationConfidence(null)).toBe(0.5);
  });

  it('detects agreement and conflict between signals', () => {
    const res = detectCountryConflict([
      { source: 'geoip', value: 'HT', confidence: 0.8 },
      { source: 'timezone', value: 'HT', confidence: 0.7 },
      { source: 'geolocation', value: 'DO', confidence: 0.95 },
    ]);
    expect(res.hasConflict).toBe(true);
    expect(res.majorityCountry).toBe('HT');
    expect(res.conflicting).toContain('geolocation');
    expect(res.description).toContain('conflict');
  });

  it('combines agreeing signals with diminishing returns', () => {
    const single = combineAgreeingConfidence([{ source: 'geoip', value: 'HT', confidence: 0.8 }]);
    const double = combineAgreeingConfidence([
      { source: 'geoip', value: 'HT', confidence: 0.8 },
      { source: 'timezone', value: 'HT', confidence: 0.7 },
    ]);
    expect(single).toBe(0.8);
    expect(double).toBeGreaterThan(single);
    expect(double).toBeLessThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SignalFusionEngine — the spec test matrix
// ═══════════════════════════════════════════════════════════════════

describe('SignalFusionEngine', () => {
  it('returns a default (null) estimate with no signals', () => {
    const res = fuseCountrySignals([]);
    expect(res.country).toBeNull();
    expect(res.isDefault).toBe(true);
    expect(res.confidence).toBe(0);
  });

  // ── Case A: GPS: Haiti, IP: Haiti, browser: fr-FR, TZ: Haiti ─────
  it('CASE A: all agree on HT → high confidence, language stays French', () => {
    const res = fuseCountrySignals([
      { source: 'geolocation', value: 'HT', confidence: 0.95, accuracy: 50 },
      { source: 'geoip', value: 'HT', confidence: 0.8 },
      { source: 'timezone', value: 'HT', confidence: 0.7 },
      // locale fr-FR must NOT vote — the engine ignores it for country.
      { source: 'locale', value: null },
    ]);
    expect(res.country).toBe('HT');
    expect(res.confidence).toBeGreaterThan(0.9);
    expect(res.conflict.detected).toBe(false);
  });

  // ── Case B: GPS denied, IP: Haiti, browser: fr-FR, TZ: Haiti ─────
  it('CASE B: GPS denied → IP + timezone still give good confidence', () => {
    const res = fuseCountrySignals([
      { source: 'geoip', value: 'HT', confidence: 0.8 },
      { source: 'timezone', value: 'HT', confidence: 0.7 },
    ]);
    expect(res.country).toBe('HT');
    expect(res.confidence).toBeGreaterThan(0.8);
    expect(res.confidence).toBeLessThan(0.95); // not as strong as GPS
  });

  // ── Case C: GPS unavailable, IP: DO, browser: fr-FR, TZ: Haiti ───
  it('CASE C: IP disagrees with timezone → conflict recorded, majority wins', () => {
    const res = fuseCountrySignals([
      { source: 'geoip', value: 'DO', confidence: 0.8 },
      { source: 'timezone', value: 'HT', confidence: 0.7 },
    ]);
    expect(res.conflict.detected).toBe(true);
    // GeoIP is stronger than timezone → DO wins (weak can't override strong).
    expect(res.country).toBe('DO');
    expect(res.confidence).toBeLessThan(0.8); // conflict penalty
  });

  // ── Case D: GPS unavailable, IP: VPN, browser: fr-FR, TZ: Haiti,
  //    user country: Haiti ───────────────────────────────────────────
  it('CASE D: VPN IP penalized + user_profile → HT with adjusted confidence', () => {
    const res = fuseCountrySignals([
      { source: 'geoip', value: 'DO', confidence: 0.8, flags: { vpn_detected: true } },
      { source: 'timezone', value: 'HT', confidence: 0.7 },
      { source: 'user_profile', value: 'HT', confidence: 0.98 },
    ]);
    // user_profile (0.98) > penalized geoip (0.4) → HT wins.
    expect(res.country).toBe('HT');
    expect(res.confidence).toBeGreaterThan(0.9);
  });

  // ── Case E: browser fr-FR, user writes Haitian Creole, location HT ─
  it('CASE E: country=HT from signals; language handled separately', () => {
    const res = fuseCountrySignals([
      { source: 'geoip', value: 'HT', confidence: 0.8 },
      { source: 'timezone', value: 'HT', confidence: 0.7 },
      { source: 'locale', value: null }, // fr-FR ignored for country
    ]);
    expect(res.country).toBe('HT');
    // The fr-FR locale never influenced the country vote.
    expect(res.sources.every((s) => s.source !== 'locale')).toBe(true);
  });

  // ── Browser-language invariant ────────────────────────────────────
  it('browser language (fr-FR) alone NEVER produces a country', () => {
    const res = fuseCountrySignals([
      { source: 'locale', value: null, confidence: 0 },
    ]);
    expect(res.isDefault).toBe(true);
    expect(res.country).toBeNull();
  });

  // ── Weak signals cannot override strong ones ──────────────────────
  it('one strong signal beats many weak ones', () => {
    const res = fuseCountrySignals([
      { source: 'geoip', value: 'DO', confidence: 0.8 },
      { source: 'timezone', value: 'HT', confidence: 0.4 },
      { source: 'timezone', value: 'HT', confidence: 0.4 }, // two votes
    ]);
    expect(res.country).toBe('DO');
  });

  // ── GPS accuracy degrades confidence ──────────────────────────────
  it('GPS with poor accuracy is down-weighted', () => {
    const good = fuseCountrySignals([
      { source: 'geolocation', value: 'HT', confidence: 0.95, accuracy: 50 },
    ]);
    const poor = fuseCountrySignals([
      { source: 'geolocation', value: 'HT', confidence: 0.95, accuracy: 20000 },
    ]);
    expect(good.confidence).toBeGreaterThan(poor.confidence);
    expect(poor.country).toBe('HT');
  });
});
