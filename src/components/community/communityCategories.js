/**
 * src/components/community/communityCategories.js
 *
 * The API serializes ``Community.category`` as the stored display name
 * (for example "Other"), while the creation form works with slugs
 * ("other"). Neither is a translation, so displaying the raw value in a
 * French or Creole interface leaked English. This helper maps every
 * seeded community category — by slug or by any known label — to the
 * current interface language.
 *
 * Unknown categories are returned unchanged: the backend allows
 * auto-created categories, and silently labelling them "Other" would be
 * worse than showing the creator's own wording.
 */
import { t } from '../../utils/i18n';

export const COMMUNITY_CATEGORY_LABELS = {
  tech: { en: 'Technology', ht: 'Teknoloji', fr: 'Technologie' },
  art: { en: 'Art & Design', ht: 'A & Design', fr: 'Art et design' },
  music: { en: 'Music', ht: 'Mizik', fr: 'Musique' },
  education: { en: 'Education', ht: 'Edikasyon', fr: 'Éducation' },
  business: { en: 'Business', ht: 'Biznis', fr: 'Affaires' },
  health: { en: 'Health & Wellness', ht: 'Sante', fr: 'Santé et bien-être' },
  gaming: { en: 'Gaming', ht: 'Jwèt', fr: 'Jeux' },
  sports: { en: 'Sports', ht: 'Espò', fr: 'Sports' },
  food: { en: 'Food & Cooking', ht: 'Manje & Kwi', fr: 'Cuisine' },
  travel: { en: 'Travel', ht: 'Vwayaj', fr: 'Voyage' },
  charity: { en: 'Charity & Causes', ht: 'Charite', fr: 'Charité et causes' },
  other: { en: 'Other', ht: 'Lòt', fr: 'Autre' },
};

export function localizedCategoryLabel(raw, lang = 'en') {
  const value = String(raw || '').trim();
  if (!value) {
    return t(lang, COMMUNITY_CATEGORY_LABELS.other.ht, COMMUNITY_CATEGORY_LABELS.other.en, COMMUNITY_CATEGORY_LABELS.other.fr);
  }
  const needle = value.toLowerCase();
  const entry = Object.entries(COMMUNITY_CATEGORY_LABELS).find(([slug, labels]) => (
    slug === needle
    || Object.values(labels).some((label) => String(label).toLowerCase() === needle)
  ));
  if (!entry) return value;
  const labels = entry[1];
  return t(lang, labels.ht, labels.en, labels.fr);
}
