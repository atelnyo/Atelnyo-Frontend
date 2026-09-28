/**
 * src/services/location/networkSignalService.js
 *
 * NetworkSignalService — Network Information API as a supporting signal.
 *
 * Signal 5 of the Atelyona Location Intelligence spec. The Network
 * Information API (navigator.connection) is:
 *   * NOT a country detector on its own — it reports link quality
 *     (effectiveType / downlink / rtt / saveData), not geography,
 *   * inconsistently supported (Chrome/Edge yes, Firefox/Safari no),
 *   * therefore strictly a supporting signal for the fusion engine:
 *     when present it can slightly adjust confidence (e.g. a mobile
 *     connection is more likely to reflect the user's real country
 *     than a datacenter IP), never decide the country.
 *
 * Contract: NEVER fail when the API is missing. Every getter returns a
 * safe "unavailable" shape.
 */

/**
 * Snapshot of the Network Information API.
 *
 * @returns {{ effectiveType: string|null, downlink: number|null,
 *             rtt: number|null, saveData: boolean, availability: string,
 *             isMobileConnection: boolean }}
 */
export function getNetworkInfo() {
  try {
    if (typeof navigator === 'undefined' || !navigator.connection) {
      return {
        effectiveType: null,
        downlink: null,
        rtt: null,
        saveData: false,
        availability: 'unavailable',
        isMobileConnection: false,
      };
    }
    const conn = navigator.connection;
    return {
      effectiveType: conn.effectiveType || null,
      downlink: conn.downlink ?? null,
      rtt: conn.rtt ?? null,
      saveData: conn.saveData === true,
      availability: 'available',
      // 4g/3g effective types are typical of cellular connections —
      // used only as a weak "this is probably a real mobile user, not
      // a datacenter" hint, never as country evidence.
      isMobileConnection: ['4g', '3g', '2g'].includes(conn.effectiveType),
    };
  } catch (_) {
    return {
      effectiveType: null,
      downlink: null,
      rtt: null,
      saveData: false,
      availability: 'unavailable',
      isMobileConnection: false,
    };
  }
}

/**
 * Build the signal object consumed by the fusion engine.
 *
 * The network signal carries NO country value — it only contributes a
 * confidence ADJUSTMENT (does the connection look mobile/user-real vs
 * datacenter?). The engine reads `isMobileConnection` to nudge the
 * GeoIP confidence, and `saveData` to avoid heavy background work.
 *
 * @returns {{ source: string, value: null, availability: string,
 *             effectiveType: string|null, isMobileConnection: boolean,
 *             saveData: boolean, timestamp: number }}
 */
export function getNetworkSignal() {
  const info = getNetworkInfo();
  return {
    source: 'network',
    value: null, // never a country value — supporting only
    availability: info.availability,
    effectiveType: info.effectiveType,
    isMobileConnection: info.isMobileConnection,
    saveData: info.saveData,
    timestamp: Date.now(),
  };
}
