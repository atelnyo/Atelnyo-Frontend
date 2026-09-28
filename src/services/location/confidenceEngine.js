/**
 * src/services/location/confidenceEngine.js
 *
 * ConfidenceEngine — the reliability model behind SignalFusionEngine.
 *
 * Signal 12 of the Atelyona Location Intelligence spec. Every country
 * signal carries a BASE reliability weight reflecting how trustworthy
 * that source is in general:
 *
 *   VERY STRONG
 *     user_profile      — user explicitly selected their country (0.98)
 *     geolocation       — browser GPS with good accuracy (0.95, scaled
 *                          down as accuracy degrades)
 *   STRONG
 *     geoip             — server-side MaxMind lookup (0.80)
 *   SUPPORTING (never decide alone)
 *     timezone          — IANA tz → country (0.40–0.70)
 *     locale            — BROWSER LANGUAGE IS NOT COUNTRY EVIDENCE (0)
 *     network           — connection type, no country value (0)
 *
 * RULE: a weak signal must never override a strong one without a good
 * reason. When signals AGREE, confidence rises; when they CONFLICT, the
 * strongest signal wins and the conflict is recorded (exposed for
 * debugging, never for end users).
 *
 * All functions are pure (no I/O) so they are trivially unit-testable.
 */

/** Base reliability per signal source (0–1). */
export const SIGNAL_WEIGHTS = {
  user_profile: 0.98,   // explicit user choice — strongest
  geolocation: 0.95,    // valid GPS with good accuracy
  geoip: 0.80,          // server-side MaxMind
  timezone: 0.55,       // supporting — shared by many countries
  locale: 0.0,          // browser language is NOT country evidence
  network: 0.0,         // no country value at all
};

/**
 * GeoIP confidence after VPN/proxy/datacenter adjustment.
 *
 * Signal 14 of the spec: when the GeoIP provider flags the IP as
 * VPN / proxy / hosting / Tor, the confidence is PENALIZED (the IP may
 * not reflect the user's real country) but never zeroed — and we never
 * try to circumvent the VPN.
 *
 * @param {number} baseConfidence The raw lookup confidence (default 0.8).
 * @param {{ vpn_detected?: boolean, proxy_detected?: boolean,
 *           hosting_detected?: boolean, tor_detected?: boolean,
 *           network_type?: string }} flags Optional provider flags.
 * @returns {{ confidence: number, adjusted: boolean, reasons: string[] }}
 */
export function adjustGeoIpConfidence(baseConfidence = 0.8, flags = {}) {
  let confidence = baseConfidence;
  const reasons = [];

  const penalize = (factor, label) => {
    confidence *= factor;
    reasons.push(label);
  };

  if (flags.vpn_detected) penalize(0.5, 'vpn');
  if (flags.proxy_detected) penalize(0.55, 'proxy');
  if (flags.hosting_detected) penalize(0.6, 'hosting');
  if (flags.tor_detected) penalize(0.3, 'tor');
  if (flags.network_type === 'mobile') {
    // Mobile carrier IPs are usually more trustworthy than datacenter
    // IPs — the user is likely physically where the tower is.
    confidence = Math.min(1, confidence * 1.05);
    reasons.push('mobile');
  }

  return {
    confidence: Math.round(confidence * 100) / 100,
    adjusted: reasons.length > 0,
    reasons,
  };
}

/**
 * Geolocation confidence scaled by reported accuracy.
 *
 * Signal 2 of the spec: GPS with high accuracy is very strong evidence;
 * a 5km cell-tower fix is weaker. Accuracy is in meters.
 *
 * @param {number|null} accuracyMeters GPS accuracy in meters.
 * @param {number|null} [base=0.95] Base confidence for a good fix.
 * @returns {number} 0.30 (terrible fix) … 0.95 (sub-100m fix).
 */
export function scaleGeolocationConfidence(accuracyMeters, base = 0.95) {
  if (accuracyMeters == null) return 0.5; // no accuracy reported
  if (accuracyMeters <= 100) return base;
  if (accuracyMeters <= 1000) return 0.8;
  if (accuracyMeters <= 5000) return 0.6;
  return 0.35; // coarse (cell-tower / Wi-Fi) fix
}

/**
 * Detect agreement / conflict between country signals.
 *
 * @param {Array<{ source: string, value: string|null, confidence: number }>} countrySignals
 * @returns {{ agreeing: string[], conflicting: string[],
 *             majorityCountry: string|null, majorityCount: number,
 *             hasConflict: boolean, description: string|null }}
 */
export function detectCountryConflict(countrySignals) {
  const valid = countrySignals.filter((s) => s && s.value);
  if (valid.length === 0) {
    return {
      agreeing: [], conflicting: [],
      majorityCountry: null, majorityCount: 0,
      hasConflict: false, description: null,
    };
  }

  // Group by country value.
  const byCountry = {};
  for (const s of valid) {
    const key = String(s.value).toUpperCase();
    (byCountry[key] = byCountry[key] || []).push(s.source);
  }

  const sorted = Object.entries(byCountry).sort((a, b) => b[1].length - a[1].length);
  const majorityCountry = sorted[0][0];
  const majorityCount = sorted[0][1].length;
  const otherSources = valid
    .filter((s) => String(s.value).toUpperCase() !== majorityCountry)
    .map((s) => s.source);

  const hasConflict = sorted.length > 1;
  return {
    agreeing: sorted[0][1],
    conflicting: otherSources,
    majorityCountry,
    majorityCount,
    hasConflict,
    description: hasConflict
      ? `conflict: ${sorted[0][1].join('+')} say ${majorityCountry}, ` +
        `${otherSources.join(', ')} disagree`
      : null,
  };
}

/**
 * Combine the strongest agreeing signals into one confidence.
 *
 * Weighted combination where the TOP signal dominates and agreeing
 * signals push confidence up. Returns a value in (0, 1].
 *
 * @param {Array<{ source: string, value: string, confidence: number }>} agreeingSignals
 * @returns {number}
 */
export function combineAgreeingConfidence(agreeingSignals) {
  if (agreeingSignals.length === 0) return 0;
  const sorted = [...agreeingSignals].sort((a, b) => b.confidence - a.confidence);
  const top = sorted[0].confidence;
  // Each additional agreeing signal adds a fraction of the gap toward
  // 1 (diminishing returns). 2 agreeing strong signals ≈ 0.99.
  let combined = top;
  for (let i = 1; i < sorted.length; i += 1) {
    combined += (1 - combined) * 0.5 * sorted[i].confidence;
  }
  return Math.min(1, Math.round(combined * 100) / 100);
}
