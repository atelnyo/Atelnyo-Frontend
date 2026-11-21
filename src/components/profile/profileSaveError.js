/**
 * src/components/profile/profileSaveError.js
 *
 * Turn a backend save failure into something the creator can act on.
 *
 * DRF can return field errors directly ({bio: ["..."]}) or under an
 * `errors` object (the publish gate uses that shape). We surface the
 * server's own messages and attach the editor tab that owns each field —
 * no generic "something failed" dead end.
 */
import { parseApiError } from '../../utils/errors';

const FIELD_META = {
  artist_name: { en: 'Artist name', ht: 'Non atis', tab: 'appearance' },
  avatar_url: { en: 'Profile photo', ht: 'Foto pwofil', tab: 'appearance' },
  cover_url: { en: 'Cover image', ht: 'Imaj kouvèti', tab: 'appearance' },
  bio: { en: 'Biography', ht: 'Biyografi', tab: 'profile' },
  country: { en: 'Country', ht: 'Peyi', tab: 'profile' },
  city: { en: 'City', ht: 'Vil', tab: 'profile' },
  postal_code: { en: 'Postal code', ht: 'Kòd postal', tab: 'profile' },
  languages: { en: 'Languages', ht: 'Lang', tab: 'profile' },
  skills: { en: 'Skills', ht: 'Konpetans', tab: 'profile' },
  availability: { en: 'Availability', ht: 'Disponibilite', tab: 'profile' },
  experience: { en: 'Experience', ht: 'Eksperyans', tab: 'story' },
  education: { en: 'Education', ht: 'Edikasyon', tab: 'story' },
  website_url: { en: 'Website', ht: 'Sit wèb', tab: 'contact' },
  contact_email: { en: 'Contact email', ht: 'Imèl kontak', tab: 'contact' },
  contact_phone: { en: 'Contact phone', ht: 'Telefòn', tab: 'contact' },
  social_links: { en: 'Social links', ht: 'Lyen sosyal', tab: 'contact' },
  seo_title: { en: 'SEO title', ht: 'Tit SEO', tab: 'seo' },
  seo_description: { en: 'SEO description', ht: 'Deskripsyon SEO', tab: 'seo' },
  seo_keywords: { en: 'SEO keywords', ht: 'Mo kle SEO', tab: 'seo' },
  section_config: { en: 'Layout', ht: 'Layout', tab: 'layout' },
  section_order: { en: 'Layout', ht: 'Layout', tab: 'layout' },
  section_visibility: { en: 'Layout', ht: 'Layout', tab: 'layout' },
};

const GENERAL_KEYS = new Set([
  'detail',
  'error',
  'message',
  'errors',
  'non_field_errors',
  '__all__',
]);

function humanize(key) {
  return String(key).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function stringifyError(value) {
  if (value === null || value === undefined) { return ''; }
  if (Array.isArray(value)) {
    return value.map(stringifyError).filter(Boolean).join(' ');
  }
  if (typeof value === 'object') {
    return Object.values(value).map(stringifyError).filter(Boolean).join(' ');
  }
  return String(value).trim();
}

/**
 * @param {object} error — rejected axios error
 * @param {'ht'|'en'} lang
 * @returns {{message: string, fields: Array<{field,label,message,tab}>}}
 */
export function parseProfileSaveError(error, lang = 'en') {
  const isHt = lang === 'ht';
  const data = error?.response?.data;
  const fallback = error?.userMessage
    || parseApiError(error || {}, lang).message
    || (isHt
      ? 'Nou pa t kapab sove pwofil la. Eseye ankò.'
      : 'We could not save your profile. Please try again.');

  if (!data) {
    return { message: fallback, fields: [] };
  }
  if (typeof data === 'string') {
    return { message: data.trim() || fallback, fields: [] };
  }

  const container = data.errors && typeof data.errors === 'object' && !Array.isArray(data.errors)
    ? data.errors
    : data;
  const general = [];
  const fields = [];
  const seen = new Set();

  for (const [key, raw] of Object.entries(container || {})) {
    const message = stringifyError(raw);
    if (!message) { continue; }
    if (GENERAL_KEYS.has(key)) {
      general.push(message);
      continue;
    }
    if (seen.has(key)) { continue; }
    seen.add(key);
    const meta = FIELD_META[key];
    fields.push({
      field: key,
      label: meta ? (isHt ? meta.ht : meta.en) : humanize(key),
      message,
      tab: meta?.tab || null,
    });
  }

  return {
    message: general[0] || fallback,
    fields,
  };
}
