/**
 * src/components/profile/profileCompleteness.js
 *
 * Adapter for the backend's REAL profile completeness result.
 *
 * The backend (creator.services.profile_health) stores
 * `profile_completeness` (0-100) and `completeness_missing` (field keys)
 * on CreatorPublicProfile. This module only translates those keys into
 * labels + the editor tab that can improve them. It never invents a score.
 */

export const PROFILE_COMPLETENESS_META = {
  avatar: { en: 'Profile Photo', ht: 'Foto Pwofil', tab: 'appearance' },
  cover: { en: 'Cover Image', ht: 'Imaj Kouvèti', tab: 'appearance' },
  artist_name: { en: 'Professional Name', ht: 'Non Pwofesyonèl', tab: 'appearance' },
  bio: { en: 'Biography', ht: 'Biyografi', tab: 'profile' },
  country: { en: 'Country', ht: 'Peyi', tab: 'profile' },
  city: { en: 'City', ht: 'Vil', tab: 'profile' },
  languages: { en: 'Languages', ht: 'Lang', tab: 'profile' },
  skills: { en: 'Skills', ht: 'Konpetans', tab: 'profile' },
  availability: { en: 'Availability', ht: 'Disponibilite', tab: 'profile' },
  education: { en: 'Education', ht: 'Edikasyon', tab: 'story' },
  experience: { en: 'Experience', ht: 'Eksperyans', tab: 'story' },
  website: { en: 'Website', ht: 'Sit Wèb', tab: 'contact' },
  social_links: { en: 'Social Links', ht: 'Lyen Sosyal', tab: 'contact' },
  contact_email: { en: 'Contact Email', ht: 'Imèl Kontak', tab: 'contact' },
  seo_title: { en: 'SEO Title', ht: 'Tit SEO', tab: 'seo' },
  seo_description: { en: 'SEO Description', ht: 'Deskripsyon SEO', tab: 'seo' },
  // These are completed outside the profile form (content / verification).
  has_courses: { en: 'Published Course', ht: 'Kou Pibliye', tab: null },
  has_products: { en: 'Published Product', ht: 'Pwodwi Pibliye', tab: null },
  has_portfolio: { en: 'Portfolio Project', ht: 'Pwojè Pòtfolyo', tab: null },
  is_verified: { en: 'Verification', ht: 'Verifikasyon', tab: null },
};

function humanizeKey(key) {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * @param {object|null} profile — CreatorPublicProfile payload
 * @returns {{score: number, missing: Array<{key, label, label_ht, tab}>}|null}
 *   null when the backend did not provide a numeric score, so the UI never
 *   displays a fabricated 0%.
 */
export function getProfileCompleteness(profile) {
  const rawScore = profile?.profile_completeness;
  if (rawScore === null || rawScore === undefined || rawScore === '') {
    return null;
  }
  const numericScore = Number(rawScore);
  if (!Number.isFinite(numericScore)) {
    return null;
  }

  const rawMissing = Array.isArray(profile?.completeness_missing)
    ? profile.completeness_missing
    : [];
  const seen = new Set();
  const missing = [];

  for (const entry of rawMissing) {
    const key = typeof entry === 'string' ? entry : entry?.key;
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    const meta = PROFILE_COMPLETENESS_META[key] || {};
    const fallback = humanizeKey(key);
    missing.push({
      key,
      label: (typeof entry === 'object' && entry?.label) || meta.en || fallback,
      label_ht: (typeof entry === 'object' && entry?.label_ht) || meta.ht || meta.en || fallback,
      tab: meta.tab || null,
    });
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(numericScore))),
    missing,
  };
}
