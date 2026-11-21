/**
 * src/components/profile/profileTemplates.js
 *
 * Profile layout templates — curated presets for the public profile's
 * section order + visibility. Applying a template never touches content
 * (courses, products, links…); it only changes how the profile is
 * organized, so creators can switch the whole page layout in one click.
 *
 * The helpers here are shared by:
 *   • PublicProfileSection (Layout tab + live preview)
 *   • ProfileSettingsSection (template picker)
 *   • ProfileTemplateModal (preview + apply)
 *
 * Kept in sync with `RAIL_ITEMS` in profileConstants.js and the backend
 * `_validate_section_config` shape (order: string[], visibility: bool map).
 */

// Every section the public profile can render, in the canonical default order.
export const PROFILE_SECTION_IDS = [
  'dashboard', 'picks', 'courses', 'products',
  'portfolio', 'reviews', 'about',
];

const DEFAULTS = {
  section_order: [...PROFILE_SECTION_IDS],
  section_visibility: Object.fromEntries(PROFILE_SECTION_IDS.map((id) => [id, true])),
};

/**
 * Curated templates. `section_order` lists EVERY known section (hidden ones
 * remain in the order so toggling them back on returns them to their slot),
 * while `section_visibility` hides the sections that don't fit the story.
 */
export const PROFILE_TEMPLATES = [
  {
    id: 'showcase',
    icon: 'fa-star',
    name: { ht: 'Vitrin', en: 'Showcase', fr: 'Vitrine' },
    description: {
      ht: 'Tout seksyon yo vizib — pi bon pou kreyatè ki gen kontni nan chak domèn.',
      en: 'Every section visible — best for creators with content across the board.',
      fr: 'Toutes les sections visibles — idéal pour les créateurs multi-contenus.',
    },
    section_order: ['dashboard', 'picks', 'courses', 'products', 'portfolio', 'reviews', 'about'],
    section_visibility: {
      dashboard: true, picks: true, courses: true, products: true,
      portfolio: true, reviews: true, about: true,
    },
  },
  {
    id: 'academy',
    icon: 'fa-graduation-cap',
    name: { ht: 'Akademi', en: 'Academy', fr: 'Académie' },
    description: {
      ht: 'Kou yo an premye, ak portfolio ak revi — pou moun k ap anseye.',
      en: 'Courses first, followed by portfolio and reviews — for teachers.',
      fr: 'Les cours en premier, puis portfolio et avis — pour les formateurs.',
    },
    section_order: ['courses', 'dashboard', 'portfolio', 'reviews', 'picks', 'products', 'about'],
    section_visibility: {
      dashboard: true, picks: false, courses: true, products: false,
      portfolio: true, reviews: true, about: true,
    },
  },
  {
    id: 'store',
    icon: 'fa-store',
    name: { ht: 'Boutik', en: 'Store', fr: 'Boutique' },
    description: {
      ht: 'Pwodwi ak kou an premye, ak revi pou bati konfyans — pou vann.',
      en: 'Products and courses up front, with reviews for trust — for selling.',
      fr: 'Produits et cours en avant, avec avis pour rassurer — pour vendre.',
    },
    section_order: ['products', 'courses', 'reviews', 'portfolio', 'dashboard', 'picks', 'about'],
    section_visibility: {
      dashboard: true, picks: false, courses: true, products: true,
      portfolio: true, reviews: true, about: true,
    },
  },
  {
    id: 'minimal',
    icon: 'fa-feather',
    name: { ht: 'Minimal', en: 'Minimal', fr: 'Minimal' },
    description: {
      ht: 'Sèlman Apèsi ak Sou nou — yon paj senp ak konsantre sou istwa ou.',
      en: 'Only Overview and About — a clean page focused on your story.',
      fr: 'Uniquement Vue d’ensemble et À propos — une page épurée.',
    },
    section_order: ['dashboard', 'about', 'picks', 'courses', 'products', 'portfolio', 'reviews'],
    section_visibility: {
      dashboard: true, picks: false, courses: false, products: false,
      portfolio: false, reviews: false, about: true,
    },
  },
];

/** Resolve a template's localized name (fallback: English, then id). */
export function templateName(template, lang = 'en') {
  return template?.name?.[lang] || template?.name?.en || template?.id || '';
}

/** Resolve a template's localized description. */
export function templateDescription(template, lang = 'en') {
  return template?.description?.[lang] || template?.description?.en || '';
}

/** Return a template row by id (or null). */
export function getProfileTemplate(templateId) {
  return PROFILE_TEMPLATES.find((template) => template.id === templateId) || null;
}

/**
 * Normalize any saved config into a complete, safe shape:
 *   • dedupe + drop empty/non-string order entries
 *   • unknown ids pass through (forward-compatible with new sections)
 *   • append known sections that are missing from the saved order
 *   • visibility defaults to true for every known section
 */
export function mergeSectionConfig(saved) {
  const source = saved && typeof saved === 'object' ? saved : {};
  const rawOrder = Array.isArray(source.section_order) ? source.section_order : [];
  const seen = new Set();
  const order = [];
  for (const id of rawOrder) {
    if (typeof id !== 'string') { continue; }
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) { continue; }
    seen.add(trimmed);
    order.push(trimmed);
  }
  for (const id of PROFILE_SECTION_IDS) {
    if (!seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }
  const rawVisibility = source.section_visibility && typeof source.section_visibility === 'object'
    ? source.section_visibility
    : {};
  const visibility = { ...DEFAULTS.section_visibility };
  for (const id of order) {
    if (typeof rawVisibility[id] === 'boolean') { visibility[id] = rawVisibility[id]; }
  }
  return { section_order: order, section_visibility: visibility };
}

/**
 * Build a fresh, detached section config from a template.
 *
 * When ``current`` is passed, section ids this build doesn't know about
 * (e.g. a future "tiktok" section stored by a newer release) are preserved
 * at the end of the order instead of being silently dropped. A template
 * must never delete configuration it does not understand.
 */
export function applyProfileTemplate(template, current = null) {
  const preset = mergeSectionConfig(template);
  if (!current) {
    return {
      section_order: [...preset.section_order],
      section_visibility: { ...preset.section_visibility },
    };
  }
  const base = mergeSectionConfig(current);
  const known = new Set(PROFILE_SECTION_IDS);
  const unknown = base.section_order.filter((id) => !known.has(id));
  const visibility = { ...preset.section_visibility };
  for (const id of unknown) {
    visibility[id] = base.section_visibility[id] !== false;
  }
  return {
    section_order: [...preset.section_order, ...unknown],
    section_visibility: visibility,
  };
}

/**
 * Detect which template a saved/current config matches. Returns the
 * template id, or null when the config is customized ("Custom").
 */
export function detectProfileTemplate(config) {
  const normalized = mergeSectionConfig(config);
  // Compare only KNOWN sections: an unknown/forward-compatible section must
  // not turn a valid preset into "Custom".
  const knownOrder = normalized.section_order.filter((id) => PROFILE_SECTION_IDS.includes(id));
  const found = PROFILE_TEMPLATES.find((template) => {
    const preset = applyProfileTemplate(template);
    if (preset.section_order.join('|') !== knownOrder.join('|')) { return false; }
    return PROFILE_SECTION_IDS.every(
      (id) => preset.section_visibility[id] === normalized.section_visibility[id],
    );
  });
  return found?.id || null;
}
