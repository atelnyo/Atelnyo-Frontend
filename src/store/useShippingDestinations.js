import { useEffect, useState } from 'react';
import { storeService } from './storeService';
import { REGIONS_BY_COUNTRY } from './regions';

/**
 * Enabled Store destinations, read from the backend policy.
 *
 * The admin panel owns ``printify_shipping_policy``; this hook pulls the
 * resulting country + state/province catalog so the address forms never
 * drift from what the backend will actually quote. If the request fails the
 * local US/CA/AU catalog keeps checkout usable offline.
 */
const COUNTRY_NAMES = {
  US: 'United States',
  CA: 'Canada',
  AU: 'Australia',
};

const FALLBACK = Object.entries(REGIONS_BY_COUNTRY).map(([code, regions]) => ({
  code,
  name: COUNTRY_NAMES[code] || code,
  regions: regions.map(([regionCode, name]) => ({ code: regionCode, name })),
}));

export function useShippingDestinations() {
  const [destinations, setDestinations] = useState(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => storeService.shippingDestinations())
      .then(({ data }) => {
        const countries = Array.isArray(data?.countries) ? data.countries : [];
        if (!cancelled && countries.length) {
          setDestinations(countries);
        }
      })
      .catch(() => {
        // Keep the local catalog; the live quote is still the final check.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return destinations;
}

export default useShippingDestinations;
