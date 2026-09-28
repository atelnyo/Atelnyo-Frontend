/**
 * src/services/locationService.js
 *
 * Location service — city search + reverse geocoding via Nominatim (OpenStreetMap).
 *
 * All endpoints are FREE and require NO API key.
 *
 * Exports
 * -------
 *   searchCities(query)     — Search cities/towns by name (autocomplete)
 *   reverseGeocode(lat,lon) — Get address details from coordinates
 *   COMMON_COUNTRIES        — Pre-loaded country list for dropdowns
 *
 * Nominatim usage policy:
 *   - Max 1 request/second (we do NOT throttle — consumer must debounce)
 *   - Meaningful User-Agent header required
 *   - For heavy usage, run your own Nominatim instance
 */

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'atelnyoApp/1.0 (location-service)';

/**
 * Search cities/towns by query string.
 * Returns up to 8 matching locations with city, country, and display_name.
 *
 * @param {string}  query  Partial city name (min 2 chars recommended)
 * @param {string}  [countryCodes]  Optional ISO 3166-1 alpha-2 filter, e.g. 'HT,US'
 * @returns {Promise<Array<{ city: string, country: string, displayName: string, lat: number, lon: number }>>}
 */
export async function searchCities(query, countryCodes) {
  if (!query || query.trim().length < 2) return [];

  const url = new URL(NOMINATIM_SEARCH_URL);
  url.searchParams.set('q', query.trim());
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '8');
  url.searchParams.set('featuretype', 'city|town|village|municipality');
  url.searchParams.set('accept-language', 'ht,fr,en');

  if (countryCodes) {
    url.searchParams.set('countrycodes', countryCodes);
  }

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Nominatim search returned ${res.status}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) return [];

  return data.slice(0, 8).map((item) => {
    const addr = item.address || {};
    return {
      city: addr.city || addr.town || addr.village || addr.municipality || addr.county || item.name || '',
      country: addr.country || '',
      state: addr.state || '',
      displayName: item.display_name || '',
      lat: parseFloat(item.lat || 0),
      lon: parseFloat(item.lon || 0),
    };
  });
}

/**
 * Reverse-geocode coordinates to get address details.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{ city: string, country: string, countryCode: string, state: string, displayName: string, postcode: string }>}
 */
export async function reverseGeocode(lat, lon) {
  const url = new URL(NOMINATIM_REVERSE_URL);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'ht,fr,en');

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Nominatim reverse returned ${res.status}`);
  }

  const data = await res.json();
  const addr = data?.address || {};

  return {
    city: addr.city || addr.town || addr.village || addr.municipality || addr.county || '',
    country: addr.country || '',
    countryCode: (addr.country_code || '').toUpperCase(),
    state: addr.state || '',
    displayName: data?.display_name || '',
    postcode: addr.postcode || '',
  };
}

/**
 * Common countries list sorted by name, with ISO code + flag.
 * Pre-loaded so the user doesn't wait for an API call just to
 * select their country.
 *
 * @type {Array<{ code: string, name: string, flag: string }>}
 */
export const COMMON_COUNTRIES = [
  { code: 'HT', name: 'Haiti', flag: '🇭🇹' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'DO', name: 'Dominican Republic', flag: '🇩🇴' },
  { code: 'CU', name: 'Cuba', flag: '🇨🇺' },
  { code: 'BS', name: 'Bahamas', flag: '🇧🇸' },
  { code: 'JM', name: 'Jamaica', flag: '🇯🇲' },
  { code: 'PR', name: 'Puerto Rico', flag: '🇵🇷' },
  { code: 'TT', name: 'Trinidad and Tobago', flag: '🇹🇹' },
  { code: 'GP', name: 'Guadeloupe', flag: '🇬🇵' },
  { code: 'MQ', name: 'Martinique', flag: '🇲🇶' },
  { code: 'GF', name: 'French Guiana', flag: '🇬🇫' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'SN', name: 'Senegal', flag: '🇸🇳' },
  { code: 'CI', name: "Côte d'Ivoire", flag: '🇨🇮' },
  { code: 'CM', name: 'Cameroon', flag: '🇨🇲' },
  { code: 'CD', name: 'DR Congo', flag: '🇨🇩' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦' },
  { code: 'DZ', name: 'Algeria', flag: '🇩🇿' },
  { code: 'TN', name: 'Tunisia', flag: '🇹🇳' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪' },
];
