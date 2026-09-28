/**
 * src/services/location/signalFusionEngine.js
 *
 * SignalFusionEngine — the heart of Atelyona Location Intelligence.
 *
 * Signal 11 + 13 of the spec. Instead of "if GPS → Haiti else IP",
 * every available country signal is fused:
 *
 *   1. evaluate reliability (ConfidenceEngine weights),
 *   2. compare signals (agreeing group vs dissenting group),
 *   3. calculate confidence (combineAgreeingConfidence),
 *   4. detect conflict (recorded, exposed for debugging only),
 *   5. return the best estimate: the majority / strongest country.
 *
 * RULES enforced here:
 *   * locale (browser language) NEVER contributes a country value —
 *     "fr-FR" must not vote for France.
 *   * network NEVER contributes a country value.
 *   * user_profile is the strongest signal and wins ties.
 *   * A single strong signal (e.g. geoip) beats many weak ones
 *     (timezone + locale) — weak signals can't override strong ones.
 *   * GeoIP confidence is penalized when VPN/proxy/hosting flags exist.
 *
 * Pure module — all signal objects are passed in, nothing is fetched.
 */

import {
  SIGNAL_WEIGHTS,
  adjustGeoIpConfidence,
  detectCountryConflict,
  combineAgreeingConfidence,
} from './confidenceEngine';

/**
 * Normalize an external signal into a country vote.
 *
 * @param {{ source: string, value: string|null, confidence?: number,
 *           accuracy?: number|null, flags?: object }} signal
 * @returns {{ source: string, value: string|null, confidence: number }|null}
 *   null when the signal has no country value (locale, network) or is
 *   unavailable.
 */
export function normalizeCountrySignal(signal) {
  if (!signal || !signal.source) return null;
  const value = signal.value ? String(signal.value).toUpperCase() : null;
  if (!value) return null; // locale/network carry no country value

  let confidence = signal.confidence;
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) {
    confidence = SIGNAL_WEIGHTS[signal.source] ?? 0.1;
  }

  // GPS accuracy scales the base geolocation confidence.
  if (signal.source === 'geolocation' && signal.accuracy != null) {
    confidence = Math.min(confidence, 0.95);
    if (signal.accuracy > 100) confidence *= 0.85;
    if (signal.accuracy > 5000) confidence = 0.35;
  }

  // GeoIP: VPN/proxy/hosting flags penalize confidence.
  if (signal.source === 'geoip' && signal.flags) {
    const adjusted = adjustGeoIpConfidence(confidence, signal.flags);
    confidence = adjusted.confidence;
  }

  return { source: signal.source, value, confidence };
}

/**
 * Fuse all available country signals into one estimate.
 *
 * @param {Array<{ source: string, value: string|null, confidence?: number,
 *                 accuracy?: number|null, flags?: object }>} signals
 *   All available signals (empty array is fine — returns null estimate).
 * @returns {{
 *   country: string|null,
 *   confidence: number,
 *   sources: Array<{ source: string, value: string, confidence: number }>,
 *   conflict: { detected: boolean, description: string|null },
 *   isDefault: boolean
 * }}
 */
export function fuseCountrySignals(signals = []) {
  // 1. Collect country votes.
  const votes = signals
    .map(normalizeCountrySignal)
    .filter(Boolean);

  if (votes.length === 0) {
    return {
      country: null,
      confidence: 0,
      sources: [],
      conflict: { detected: false, description: null },
      isDefault: true,
    };
  }

  // 2. Conflict detection: which country do most/strongest signals agree on?
  const conflict = detectCountryConflict(votes);
  if (!conflict.majorityCountry) {
    return {
      country: null,
      confidence: 0,
      sources: votes,
      conflict: { detected: false, description: null },
      isDefault: true,
    };
  }

  // 3. The agreeing group = signals that vote for the majority country.
  const agreeing = votes.filter(
    (v) => String(v.value).toUpperCase() === conflict.majorityCountry,
  );

  // 4. Confidence: combine the agreeing group. If the strongest single
  //    signal is in the dissenting group (e.g. user_profile says DO but
  //    geoip+timezone say HT), the strongest signal WINS (weak signals
  //    cannot override strong ones).
  const strongest = [...votes].sort((a, b) => b.confidence - a.confidence)[0];
  const strongestInMajority = agreeing.some((v) => v.source === strongest.source);

  let finalCountry = conflict.majorityCountry;
  let confidence;
  let winnerSources;

  if (strongestInMajority) {
    confidence = combineAgreeingConfidence(agreeing);
    winnerSources = agreeing;
  } else {
    // Strongest signal dissents → it wins, but with a conflict penalty.
    finalCountry = strongest.value;
    confidence = Math.round(strongest.confidence * 0.85 * 100) / 100;
    winnerSources = [strongest];
  }

  // Conflict penalty (Signal 13): when the agreeing signals disagree
  // with other available signals, the estimate carries uncertainty.
  // The penalty scales with how strong the strongest DISSENTING signal
  // is — a strong dissent (e.g. GPS says DO while IP says HT) dents
  // confidence more than a weak one (e.g. timezone-only dissent).
  if (conflict.hasConflict) {
    const dissenters = votes.filter(
      (v) => String(v.value).toUpperCase() !== finalCountry,
    );
    const strongestDissenter = dissenters.length
      ? [...dissenters].sort((a, b) => b.confidence - a.confidence)[0]
      : null;
    if (strongestDissenter) {
      // 1 − (dissenter_strength × 0.15): a 0.95 dissent → ×0.86;
      // a 0.55 dissent → ×0.92. Weak dissents barely move the needle.
      const penalty = 1 - (strongestDissenter.confidence * 0.15);
      confidence = Math.round(confidence * penalty * 100) / 100;
    }
  }

  return {
    country: finalCountry,
    confidence: Math.round(confidence * 100) / 100,
    sources: votes,
    conflict: {
      detected: conflict.hasConflict,
      description: conflict.description,
    },
    isDefault: false,
  };
}

export default fuseCountrySignals;
