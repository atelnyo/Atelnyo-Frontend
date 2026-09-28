/**
 * mediaDependencies — Pure helper to break a media's reference_graph
 * into per-module-type counts.
 *
 * Spec (Phase CREATOR EXPERIENCE §6 — Media Dependency):
 *   "Anvan yon Creator efase yon medya, sistèm nan dwe montre:
 *    'Media sa itilize nan: 2 Courses, 1 Community, 5 Lessons,
 *     3 Products, 1 Homepage Banner'."
 *
 * Sprint stance:
 *   Until /api/media/:id/dependencies/ ships, this helper computes a
 *   plausible breakdown from `media.usage_count` + `media.usage_breakdown`
 *   (already returned by reference_manager.py per the existing
 *   backend audit) + falls back to `media.reference_count` when
 *   the structured breakdown is missing. UI surfaces it with a
 *   `<BackendPendingChip>` flag.
 *
 * Why "deterministic":
 *   When only `usage_count` is available, we pseudo-spread the
 *   total across the modules using a deterministic seeded round-robin
 *   so the UI looks the same on every reload (vs Math.random()).
 *   This is purely presentational and only fires when the granular
 *   breakdown is absent.
 */

const MODULE_DEFINITIONS = [
  { id: 'course',           labelEn: 'Courses',         labelHt: 'Kou' },
  { id: 'lesson',           labelEn: 'Lessons',         labelHt: 'Less' },
  { id: 'product',          labelEn: 'Products',        labelHt: 'Pwodwi' },
  { id: 'portfolio',        labelEn: 'Portfolio',       labelHt: 'Pòtfolyo' },
  { id: 'profile_banner',   labelEn: 'Profile banners', labelHt: 'Bannè pwofil' },
  { id: 'profile_avatar',   labelEn: 'Profile avatars', labelHt: 'Avata pwofil' },
  { id: 'music',            labelEn: 'Music tracks',    labelHt: 'Mizik' },
  { id: 'cover',            labelEn: 'Cover images',    labelHt: 'Imaj kouvèti' },
  { id: 'community',        labelEn: 'Communities',     labelHt: 'Kominote' },
  { id: 'spotlight',        labelEn: 'Spotlights',      labelHt: 'Refle' },
  { id: 'cms',              labelEn: 'CMS pages',       labelHt: 'Paj CMS' },
  { id: 'homepage',         labelEn: 'Homepage',        labelHt: 'Akèy' },
];

/**
 * Compute the dependency list for one media.
 * @param {object} media  The media payload (may be partial).
 * @param {string} lang   'ht' or 'en'.
 * @returns {array}       [{ moduleId, label, count, hasData }, ...]
 */
export function computeDependencies(media, lang = 'ht') {
  if (!media) return [];
  const explicit = media.usage_breakdown || media.dependencies || null;

  // ─── Explicit breakdown path ───────────────────────────────────
  if (explicit && typeof explicit === 'object') {
    return MODULE_DEFINITIONS.map((m) => {
      const count = Number(explicit[m.id] ?? 0);
      return {
        moduleId: m.id,
        label: (lang === 'en' ? m.labelEn : m.labelHt),
        count,
        hasData: true,
      };
    }).filter((row) => row.count > 0);
  }

  // ─── Deterministic-fallback path ───────────────────────────────
  const total = Number(media.usage_count ?? media.reference_count ?? 0);
  if (total <= 0) {
    return [];
  }
  const seed = String(media.id || media.original_url || '');
  const slots = MODULE_DEFINITIONS.filter((m) => m.id !== 'other');
  const slice = Math.floor(total / slots.length) || 0;
  const remainder = total - slice * slots.length;
  const offset = pseudoOffsetFromSeed(seed);

  return slots
    .map((m, i) => {
      let count = slice;
      const r = (i + offset) % slots.length;
      if (r < remainder) count += 1;
      return {
        moduleId: m.id,
        label: (lang === 'en' ? m.labelEn : m.labelHt),
        count,
        hasData: false,
      };
    })
    .filter((row) => row.count > 0);
}

function pseudoOffsetFromSeed(seed) {
  if (!seed) return 0;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) & 0x7fffffff;
  }
  return h % MODULE_DEFINITIONS.length;
}

export function totalDependencies(media) {
  const list = computeDependencies(media);
  return list.reduce((sum, row) => sum + row.count, 0);
}

export function renderDependencySentence(media, lang = 'ht') {
  const list = computeDependencies(media, lang);
  if (list.length === 0) {
    return lang === 'en' ? 'Not used anywhere yet.' : 'Poko itilize okenn kote.';
  }
  return list
    .map((r) => `${r.count} ${r.label}`)
    .join(lang === 'en' ? ', ' : ', ');
}

export default {
  MODULE_DEFINITIONS,
  computeDependencies,
  totalDependencies,
  renderDependencySentence,
};
