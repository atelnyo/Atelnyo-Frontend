/**
 * Internal-only lang fallback for MediaCommandBar / MediaContextMenuBuilder.
 * Both modules need a small `t(en, ht)` switcher. The global
 * `src/data/translations.js` is the canonical source of truth, but the
 * CommandBar + Builder are small standalone components — pulling the
 * whole `translations` tree into them would balloon the bundle.
 *
 * NOTE: this is intentionally NOT a 1:1 mirror of the global
 * translations. It only contains the strings the command bar + context
 * menus need (action labels, group labels). Other copy lives in the
 * canonical tree.
 */
const STRINGS = {
  open:           { en: 'Open',              ht: 'Louvri' },
  preview:        { en: 'Preview',           ht: 'Aperçu' },
  copyLink:       { en: 'Copy Link',         ht: 'Kopye lyen' },
  inspect:        { en: 'Inspect',           ht: 'Enspekte' },
  replace:        { en: 'Replace',           ht: 'Ranplase' },
  favorite:       { en: 'Favorite',          ht: 'Favori' },
  history:        { en: 'History',           ht: 'Istwa' },
  archive:        { en: 'Archive',           ht: 'Achiv' },
  deleteRef:      { en: 'Delete Reference',  ht: 'Efase referans' },
  addFavorite:    { en: 'Add to Favorites',  ht: 'Mete nan favori' },
  removeFavorite: { en: 'Remove from Favorites', ht: 'Retire nan favori' },
  moveCollection: { en: 'Move to Collection', ht: 'Deplase nan koleksyon' },
  visibility:     { en: 'Visibility',        ht: 'Vizibilite' },
  noCollections:  { en: 'No collections yet', ht: 'Pa gen koleksyon' },
  untitled:       { en: 'Untitled',          ht: 'San tit' },
  public:         { en: 'Public',            ht: 'Piblik' },
  unlisted:       { en: 'Unlisted',          ht: 'San lis' },
  private:        { en: 'Private',           ht: 'Prive' },
};

export function t(lang = 'ht', key) {
  if (!STRINGS[key]) return key;
  return STRINGS[key][lang === 'en' ? 'en' : 'ht'] || STRINGS[key].en;
}

export function makeT(lang = 'ht') {
  return (key) => t(lang, key);
}
