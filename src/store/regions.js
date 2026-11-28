/**
 * Store destinations are US, CA and AU only (see the backend
 * ``printify_shipping_policy`` for why EU/UK/NO stay disabled). Printify
 * expects ``address_to.region`` as the state/province CODE ("CA", "QC",
 * "NSW"), not the full name, so both address forms offer these lists
 * instead of free text.
 */
export const REGIONS_BY_COUNTRY = {
  US: [
    ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
    ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
    ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'],
    ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'],
    ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'],
    ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
    ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'],
    ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'],
    ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'],
    ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'],
    ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'],
    ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'],
    ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
  ],
  CA: [
    ['AB', 'Alberta'], ['BC', 'British Columbia'], ['MB', 'Manitoba'],
    ['NB', 'New Brunswick'], ['NL', 'Newfoundland and Labrador'],
    ['NS', 'Nova Scotia'], ['NT', 'Northwest Territories'], ['NU', 'Nunavut'],
    ['ON', 'Ontario'], ['PE', 'Prince Edward Island'], ['QC', 'Quebec'],
    ['SK', 'Saskatchewan'], ['YT', 'Yukon'],
  ],
  AU: [
    ['ACT', 'Australian Capital Territory'], ['NSW', 'New South Wales'],
    ['NT', 'Northern Territory'], ['QLD', 'Queensland'],
    ['SA', 'South Australia'], ['TAS', 'Tasmania'],
    ['VIC', 'Victoria'], ['WA', 'Western Australia'],
  ],
};

/** Code list for a country, or null when the country uses free text. */
export function regionsFor(country) {
  return REGIONS_BY_COUNTRY[String(country || '').trim().toUpperCase()] || null;
}

/**
 * Map a stored full name ("California") back to its code ("CA") so an old
 * address still selects the matching option when the buyer edits it.
 */
export function regionCodeFor(country, region) {
  const options = regionsFor(country);
  const value = String(region || '').trim();
  if (!options || !value) {
    return value;
  }
  const wanted = value.toLowerCase();
  const match = options.find(([code, name]) => (
    code.toLowerCase() === wanted || name.toLowerCase() === wanted
  ));
  return match ? match[0] : value;
}
