/**
 * src/hooks/useGeolocation.js
 *
 * Browser Geolocation API hook with Nominatim reverse geocoding.
 *
 * Detects the user's current position via the browser's Geolocation
 * API, then reverse-geocodes the coordinates to obtain city, country,
 * and display name via the free Nominatim service (OpenStreetMap).
 * The reverse-geocoding call itself lives in services/locationService.js
 * and is reused here (single source of truth).
 *
 * The hook returns three branches:
 *   — detectPosition()  — triggers geolocation + reverse geocode
 *   — detectState        — 'idle' | 'detecting' | 'geocoding' | 'success' | 'denied' | 'error'
 *   — location           — { city, country, displayName, lat, lon } | null
 *
 * No external API key required. Nominatim usage policy requires
 * a meaningful User-Agent and max 1 request/second.
 *
 * Usage:
 *   const { detectPosition, detectState, location, error } = useGeolocation({ lang: 'ht' });
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { reverseGeocode } from '../services/locationService';

/**
 * @typedef {'idle'|'detecting'|'geocoding'|'success'|'denied'|'error'} DetectState
 * @typedef {{ city: string, country: string, displayName: string, lat: number, lon: number } | null} GeoLocation
 */

const ERROR_MESSAGES = {
  unsupported: {
    ht: 'API geolocalizasyon pa disponib nan navigatè sa a.',
    en: 'Geolocation API is not available in this browser.',
    fr: "L'API de géolocalisation n'est pas disponible dans ce navigateur.",
    es: 'La API de geolocalización no está disponible en este navegador.',
  },
  denied: {
    ht: 'Pèmisyon pozisyon refize. Ou ka tape vil ou a manyèlman.',
    en: 'Location permission denied. You can type your city manually.',
    fr: 'Autorisation de localisation refusée. Vous pouvez saisir votre ville manuellement.',
    es: 'Permiso de ubicación denegado. Puede escribir su ciudad manualmente.',
  },
  unavailable: {
    ht: 'Pozisyon pa disponib. Tcheke si GPS ou Wi-Fi aktive.',
    en: 'Position unavailable. Check if GPS or Wi-Fi is enabled.',
    fr: 'Position indisponible. Vérifiez que le GPS ou le Wi-Fi est activé.',
    es: 'Posición no disponible. Compruebe si el GPS o el Wi-Fi está activado.',
  },
  timeout: {
    ht: 'Deteksyon an pran twòp tan. Tape vil ou a manyèlman.',
    en: 'Detection took too long. Type your city manually.',
    fr: 'La détection a pris trop de temps. Saisissez votre ville manuellement.',
    es: 'La detección tardó demasiado. Escriba su ciudad manualmente.',
  },
  generic: {
    ht: 'Erè nan deteksyon pozisyon.',
    en: 'Error detecting position.',
    fr: 'Erreur lors de la détection de position.',
    es: 'Error al detectar la posición.',
  },
};

/**
 * @param {object} [options]
 * @param {number}  [options.timeout=10000]  Geolocation timeout in ms
 * @param {string}  [options.lang='ht']        Language for error messages
 * @returns {{ detectPosition: () => Promise<void>, detectState: DetectState, location: GeoLocation, error: string | null }}
 */
export default function useGeolocation(options = {}) {
  const { timeout = 10000, lang = 'ht' } = options;
  const msg = ERROR_MESSAGES[lang] || ERROR_MESSAGES.ht;

  const [detectState, setDetectState] = useState(/** @type {DetectState} */('idle'));
  const [location, setLocation] = useState(/** @type {GeoLocation} */ (null));
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const abortRef = useRef(false);

  // Abort in-flight detection when the component unmounts so the
  // callbacks never fire setState on an unmounted component.
  useEffect(() => {
    return () => { abortRef.current = true; };
  }, []);

  /** Trigger geolocation + reverse geocode */
  const detectPosition = useCallback(async () => {
    // Reset
    abortRef.current = false;
    setError(null);
    setLocation(null);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setDetectState('denied');
      setError(msg.unsupported);
      return;
    }

    setDetectState('detecting');

    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout,
          maximumAge: 300_000, // 5 minutes cache
        });
      });

      if (abortRef.current) return;

      const { latitude, longitude } = pos.coords;
      setDetectState('geocoding');

      const geo = await reverseGeocode(latitude, longitude);

      if (abortRef.current) return;

      setLocation({
        city: geo.city,
        country: geo.country,
        displayName: geo.displayName,
        lat: latitude,
        lon: longitude,
      });
      setDetectState('success');
      setError(null);
    } catch (err) {
      if (abortRef.current) return;

      if (err && err.code === 1) { // PERMISSION_DENIED
        setDetectState('denied');
        setError(msg.denied);
      } else if (err && err.code === 2) { // POSITION_UNAVAILABLE
        setDetectState('error');
        setError(msg.unavailable);
      } else if (err && err.code === 3) { // TIMEOUT
        setDetectState('error');
        setError(msg.timeout);
      } else {
        setDetectState('error');
        setError(msg.generic);
      }
    }
  }, [timeout, msg]);

  return { detectPosition, detectState, location, error };
}
