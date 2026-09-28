/**
 * src/components/shared/LocationPicker.jsx
 *
 * Smart location picker — reutilizable nan tout fòm (pwofil, KYC, elatriye).
 *
 * Karakteristik:
 *   • Btn "📍 Detekte" ki itilize Geolocation API + Nominatim
 *   • Country dropdown (lis peyi pre-chaje)
 *   • City autocomplete (Nominatim search lè tape)
 *   • Postal code field
 *   • Detay adrès (address_line1, address_line2) pou modèd editè
 *
 * Props:
 *   value         — { country, city, postcode, address_line1, address_line2 }
 *   onChange      — (updatedValue) => void
 *   lang          — 'ht' | 'en' | 'fr' | 'es'
 *   showAddress   — boolean (si vle montre adrès detaye, default false)
 *   showPostcode  — boolean (si vle montre postal code, default true)
 *   required      — boolean (fòse country + city obligatwa)
 *   disabled      — boolean
 *   errors        — { country?: string, city?: string, postcode?: string, address_line1?: string }
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import useGeolocation from '../../hooks/useGeolocation';
import { searchCities, COMMON_COUNTRIES } from '../../services/locationService';

// ─── Debounce helper ───────────────────────────────────────────────
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ─── Constants ─────────────────────────────────────────────────────
const DETECT_LABELS = {
  ht: { detecting: 'Ap detekte...', geocoding: 'Ap chèche vil la...', button: '📍 Detekte pozisyon mwen', denied: 'Pèmisyon refize — tape non vil la', retry: '🔄 Re-eseye' },
  en: { detecting: 'Detecting...', geocoding: 'Looking up city...', button: '📍 Detect my location', denied: 'Permission denied — type city name', retry: '🔄 Retry' },
  fr: { detecting: 'Détection...', geocoding: 'Recherche de la ville...', button: '📍 Détecter ma position', denied: 'Permission refusée — saisissez la ville', retry: '🔄 Réessayer' },
  es: { detecting: 'Detectando...', geocoding: 'Buscando ciudad...', button: '📍 Detectar mi ubicación', denied: 'Permiso denegado — escriba la ciudad', retry: '🔄 Reintentar' },
};

const SEARCH_PLACEHOLDER = {
  ht: 'Chèche yon vil...',
  en: 'Search for a city...',
  fr: 'Rechercher une ville...',
  es: 'Buscar una ciudad...',
};

const CITY_LABEL = {
  ht: 'Vil / Ville',
  en: 'City / Town',
  fr: 'Ville',
  es: 'Ciudad / Pueblo',
};

const COUNTRY_LABEL = {
  ht: 'Peyi',
  en: 'Country',
  fr: 'Pays',
  es: 'País',
};

const POSTCODE_LABEL = {
  ht: 'Kòd Postal',
  en: 'Postal Code',
  fr: 'Code Postal',
  es: 'Código Postal',
};

const ADDRESS_LINE1_LABEL = {
  ht: 'Adrès (lari, nimewo)',
  en: 'Address (street, number)',
  fr: 'Adresse (rue, numéro)',
  es: 'Dirección (calle, número)',
};

const ADDRESS_LINE2_LABEL = {
  ht: 'Adrès liy 2 (apartman, katye)',
  en: 'Address line 2 (apt, neighborhood)',
  fr: "Adresse ligne 2 (appartement, quartier)",
  es: 'Dirección línea 2 (apto, barrio)',
};

/**
 * @param {object} props
 * @param {{ country: string, city: string, postcode: string, address_line1: string, address_line2: string }} props.value
 * @param {(v: typeof props.value) => void} props.onChange
 * @param {string} [props.lang='en']
 * @param {boolean} [props.showAddress=false]
 * @param {boolean} [props.showPostcode=true]
 * @param {boolean} [props.disabled=false]
 * @param {{ country?: string, city?: string, postcode?: string, address_line1?: string }} [props.errors={}]
 */
export default function LocationPicker({
  value = {},
  onChange,
  lang = 'en',
  showAddress = false,
  showPostcode = true,
  required = false,
  disabled = false,
  errors = {},
}) {
  const labels = DETECT_LABELS[lang] || DETECT_LABELS.en;

  const { detectPosition, detectState, location, error: geoError } = useGeolocation({ lang });
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [searchingCity, setSearchingCity] = useState(false);
  const searchRef = useRef(null);
  const suggestRef = useRef(null);

  // ─── Debounced city search ───────────────────────────────────────
  // Nominatim's ``countrycodes`` param expects ISO 3166-1 alpha-2 codes
  // (e.g. ``HT``), not display names — so we map the selected country's
  // display name back to its ISO code before filtering the search.
  const selectedCountryCode = useMemo(() => {
    const name = String(value.country || '').trim().toLowerCase();
    if (!name) return undefined;
    const found = COMMON_COUNTRIES.find((c) => c.name.toLowerCase() === name);
    return found ? found.code : undefined;
  }, [value.country]);

  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (!query || query.trim().length < 2) {
        setSuggestions([]);
        setSuggestionsOpen(false);
        return;
      }
      setSearchingCity(true);
      try {
        const results = await searchCities(query, selectedCountryCode);
        setSuggestions(results);
        setSuggestionsOpen(results.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setSearchingCity(false);
      }
    }, 350),
    [selectedCountryCode],
  );

  // ─── Geolocation result handler ────────────────────────────────
  // Read value/onChange from refs so the effect never applies a stale
  // closure (e.g. a city the user typed while detection was running).
  const latestValueRef = useRef(value);
  const latestOnChangeRef = useRef(onChange);
  useEffect(() => { latestValueRef.current = value; });
  useEffect(() => { latestOnChangeRef.current = onChange; });

  useEffect(() => {
    if (detectState === 'success' && location) {
      latestOnChangeRef.current({
        ...latestValueRef.current,
        city: location.city,
        country: location.country,
        // postcode not set from reverse geocode (keep existing)
      });
    }
  }, [detectState, location]);

  // ─── Close suggestions on outside click ──────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target) &&
          searchRef.current && !searchRef.current.contains(e.target)) {
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ─── Update field ────────────────────────────────────────────────
  const update = (field, val) => {
    onChange({ ...value, [field]: val });
  };

  // ─── Handle city input change ────────────────────────────────────
  const handleCityInput = (e) => {
    const val = e.target.value;
    update('city', val);

    if (val.trim().length >= 2) {
      debouncedSearch(val);
    } else {
      setSuggestions([]);
      setSuggestionsOpen(false);
    }
  };

  // ─── Select suggestion ───────────────────────────────────────────
  // Single onChange call: two sequential ``update()`` calls would each
  // spread the stale ``value`` closure and wipe the previously-set
  // field (e.g. city gets erased when country is applied second).
  const handleSelectSuggestion = (suggestion) => {
    onChange({
      ...value,
      city: suggestion.city,
      country: suggestion.country || value.country || '',
    });
    setSuggestionsOpen(false);
    setSuggestions([]);
  };

  // ─── Handle detect click ─────────────────────────────────────────
  const handleDetect = () => {
    detectPosition();
  };

  // ─── Countries list (sorted) ─────────────────────────────────────
  const countriesList = useMemo(
    () => [...COMMON_COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  return (
    <div className="location-picker">
      {/* ─── Geolocation detect button ─────────────────────────── */}
      <button
        type="button"
        className={`location-detect-btn ${detectState === 'detecting' || detectState === 'geocoding' ? 'is-detecting' : ''}`}
        onClick={handleDetect}
        disabled={disabled || detectState === 'detecting' || detectState === 'geocoding'}
        aria-label={labels.button}
      >
        {detectState === 'detecting' ? (
          <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {labels.detecting}</>
        ) : detectState === 'geocoding' ? (
          <><i className="fas fa-map-pin fa-spin" aria-hidden="true" /> {labels.geocoding}</>
        ) : detectState === 'denied' ? (
          <><i className="fas fa-ban" aria-hidden="true" /> {labels.retry}</>
        ) : (
          <><i className="fas fa-location-dot" aria-hidden="true" /> {labels.button}</>
        )}
      </button>

      {/* ─── Geolocation error message ─────────────────────────── */}
      {(detectState === 'denied' || detectState === 'error') && geoError && (
        <p className="location-detect-error">
          <i className="fas fa-info-circle" aria-hidden="true" /> {geoError}
        </p>
      )}

      {/* ─── Form fields row ───────────────────────────────────── */}
      <div className="location-fields-row">
        {/* Country */}
        <div className="location-field-group">
          <label className="location-field-label">
            {COUNTRY_LABEL[lang] || COUNTRY_LABEL.en}
          </label>
          <div className="location-country-select-wrap">
            <select
              className={`location-select ${errors.country ? 'has-error' : ''}`}
              value={value.country || ''}
              onChange={(e) => update('country', e.target.value)}
              disabled={disabled}
              required={required && !value.country}
            >
              <option value="">— {lang === 'ht' ? 'Chwazi yon peyi' : lang === 'fr' ? 'Sélectionner un pays' : lang === 'es' ? 'Seleccionar un país' : 'Select a country'} —</option>
              {countriesList.map((c) => (
                <option key={c.code} value={c.name}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
          </div>
          {errors.country && <p className="location-field-error">{errors.country}</p>}
        </div>

        {/* City with autocomplete */}
        <div className="location-field-group">
          <label className="location-field-label">
            {CITY_LABEL[lang] || CITY_LABEL.en}
          </label>
          <div className="location-autocomplete-wrap" ref={suggestRef}>
            <div className="location-input-wrap">
              <input
                ref={searchRef}
                type="text"
                className={`location-input ${errors.city ? 'has-error' : ''}`}
                value={value.city || ''}
                onChange={handleCityInput}
                onFocus={() => {
                  if (suggestions.length > 0) setSuggestionsOpen(true);
                }}
                placeholder={SEARCH_PLACEHOLDER[lang] || SEARCH_PLACEHOLDER.en}
                disabled={disabled}
                required={required && !value.city}
                autoComplete="off"
              />
              {searchingCity && (
                <i className="fas fa-spinner fa-spin location-input-spinner" aria-hidden="true" />
              )}
            </div>

            {/* Suggestions dropdown */}
            {suggestionsOpen && suggestions.length > 0 && (
              <ul className="location-suggestions" role="listbox">
                {suggestions.map((s, i) => (
                  <li
                    key={`${s.city}-${s.country}-${i}`}
                    role="option"
                    aria-selected={false}
                    className="location-suggestion-item"
                    onClick={() => handleSelectSuggestion(s)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectSuggestion(s);
                      }
                    }}
                    tabIndex={0}
                  >
                    <i className="fas fa-map-pin" aria-hidden="true" />
                    <div className="location-suggestion-text">
                      <span className="location-suggestion-city">{s.city}</span>
                      {s.state && <span className="location-suggestion-state">{s.state}</span>}
                      <span className="location-suggestion-country">
                        {s.country}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {errors.city && <p className="location-field-error">{errors.city}</p>}
        </div>
      </div>

      {/* ─── Postal code + Address row ─────────────────────────── */}
      <div className="location-fields-row location-fields-row--bottom">
        {showPostcode && (
          <div className="location-field-group location-field-group--sm">
            <label className="location-field-label">
              {POSTCODE_LABEL[lang] || POSTCODE_LABEL.en}
            </label>
            <input
              type="text"
              className={`location-input ${errors.postcode ? 'has-error' : ''}`}
              value={value.postcode || ''}
              onChange={(e) => update('postcode', e.target.value)}
              placeholder="HT6110"
              disabled={disabled}
              autoComplete="postal-code"
            />
            {errors.postcode && <p className="location-field-error">{errors.postcode}</p>}
          </div>
        )}

        {showAddress && (
          <>
            <div className="location-field-group location-field-group--wide">
              <label className="location-field-label">
                {ADDRESS_LINE1_LABEL[lang] || ADDRESS_LINE1_LABEL.en}
              </label>
              <input
                type="text"
                className={`location-input ${errors.address_line1 ? 'has-error' : ''}`}
                value={value.address_line1 || ''}
                onChange={(e) => update('address_line1', e.target.value)}
                placeholder="123, Ruelle Atelnyo"
                disabled={disabled}
                required={required && !value.address_line1}
                autoComplete="street-address"
              />
              {errors.address_line1 && <p className="location-field-error">{errors.address_line1}</p>}
            </div>
            <div className="location-field-group location-field-group--wide">
              <label className="location-field-label">
                {ADDRESS_LINE2_LABEL[lang] || ADDRESS_LINE2_LABEL.en}
              </label>
              <input
                type="text"
                className="location-input"
                value={value.address_line2 || ''}
                onChange={(e) => update('address_line2', e.target.value)}
                placeholder={lang === 'ht' ? 'Biylding, kay nimewo' : 'Building, apt number'}
                disabled={disabled}
                autoComplete="address-line2"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
