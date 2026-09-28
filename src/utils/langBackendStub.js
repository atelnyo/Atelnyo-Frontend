/**
 * langBackendStub.js — Tiny i18n helper for Creator Experience surfaces.
 *
 * Used by:
 *   - BackendPendingChip
 *   - MyMediaDashboard
 *   - MediaRecentActivityPanel
 *   - MediaContinueEditingPanel
 *   - MediaProjectsPanel
 *   - MediaDependencyList
 *   - MediaDeleteConfirmModal
 *
 * Mirrors the langFallback.js style (small standalone copy, doesn't
 * pull the global translations tree so the bundle stays lean).
 */
const STRINGS = {
  backendPending:      { en: 'Backend pending',       ht: 'Ap tann backend' },
  pendingHint:         { en: 'Coming once /api/{ep} ships. Placeholder shown for now.',
                         ht: 'Ap vini lè /api/{ep} lan livrezon. Jiskaprezan yon plas-holder.' },
  welcomeCreator:      { en: 'Welcome back',          ht: 'Byenveni ankò' },
  mediaOverview:       { en: 'Media Overview',        ht: 'Apèsi sou medya' },
  totalMedia:          { en: 'Total media',           ht: 'Tout medya' },
  images:              { en: 'Images',                ht: 'Imaj' },
  videos:              { en: 'Videos',                ht: 'Videyo' },
  audio:               { en: 'Audio',                 ht: 'Odyo' },
  documents:           { en: 'Documents',             ht: 'Dokiman' },
  broken:              { en: 'Broken',                ht: 'Kase' },
  drafts:              { en: 'Drafts',                ht: 'Bwouyon' },
  recentlyPublished:   { en: 'Recently published',    ht: 'Pibliye resamman' },
  recentlyEdited:      { en: 'Recently edited',       ht: 'Modifye resamman' },
  recentActivity:      { en: 'Recent activity',       ht: 'Aktivite resan' },
  continueWorking:     { en: 'Continue working',      ht: 'Kontinye travay' },
  continueEditing:     { en: 'Continue editing',      ht: 'Kontinye modifye' },
  pinnedMedia:         { en: 'Pinned media',          ht: 'Medya ki make' },
  pinMedia:            { en: 'Pin',                   ht: 'Make' },
  unpinMedia:          { en: 'Unpin',                 ht: 'Retire mak' },
  favoriteCollections: { en: 'Favorite collections',  ht: 'Koleksyon ou renmen' },
  workflowProgress:    { en: 'Workflow progress',     ht: 'Pwogrè travay' },
  quickUpload:         { en: 'Quick upload',          ht: 'Telechaje vit' },
  quickUploadHint:     { en: 'Paste a media URL and add it to your library.',
                         ht: 'Kole yon URL medya epi ajoute l nan bibliyotèk ou.' },
  quickSearch:         { en: 'Quick search',          ht: 'Rechèch vit' },
  quickSearchHint:     { en: 'Search by title, type, or provider.', ht: 'Chèche pa tit, tip, oswa founisè.' },
  learningCenter:      { en: 'Learning Center',       ht: 'Sant Aprantisaj' },
  providerStatus:      { en: 'Provider status',       ht: 'Estati founisè' },
  storageTips:         { en: 'Storage tips',          ht: 'Konsèy depo' },
  projects:            { en: 'Projects',              ht: 'Pwojè' },
  addProject:          { en: 'Add Project',           ht: 'Ajoute Pwojè' },
  projectMode:         { en: 'Project Mode',          ht: 'Mode Pwojè' },
  deleteConfirmTitle:  { en: 'Delete this media?',
                         ht: 'Efase medya sa a?' },
  deleteConfirmWarn:   { en: 'This will affect:',
                         ht: 'Sa ap afekte:' },
  deleteConfirmImpacted:{en: 'Used in:',
                         ht: 'Itilize nan:' },
  confirmYes:          { en: 'Yes, delete',           ht: 'Wi, efase' },
  confirmNo:           { en: 'Cancel',                ht: 'Anile' },
  eventCreated:        { en: 'Created',               ht: 'Kreye' },
  eventUpdated:        { en: 'Updated',               ht: 'Modifye' },
  eventValidated:      { en: 'Validated',             ht: 'Valide' },
  eventPublished:      { en: 'Published',             ht: 'Pibliye' },
  eventArchived:       { en: 'Archived',              ht: 'Achiv' },
  eventReplaced:       { en: 'Replaced',              ht: 'Ranplase' },
  eventDeleted:        { en: 'Deleted',               ht: 'Efase' },
  eventBroken:         { en: 'Broken link',           ht: 'Lyennen kase' },
  eventRecovered:      { en: 'Link recovered',        ht: 'Lyennen geri' },
  noActivity:          { en: 'No activity yet',       ht: 'Pa gen aktivite' },
  noDrafts:            { en: 'No drafts',             ht: 'Pa gen bwouyon' },
  noBroken:            { en: 'No broken media',       ht: 'Pa gen medya kase' },
  noPinned:            { en: 'Pin items from the grid to surface them here.',
                         ht: 'Mete yon mak nan kad la pou parèt la a.' },
  noProjects:          { en: 'No projects yet',       ht: 'Pa gen pwojè' },
  pinnedOf:            { en: 'Pinned {n} items',      ht: '{n} medya make' },
  ofTotal:             { en: 'of {n} total',          ht: 'nan {n} total' },
};

export function t(lang = 'ht', key, vars = {}) {
  const entry = STRINGS[key];
  if (!entry) return key;
  const raw = entry[lang === 'en' ? 'en' : 'ht'] || entry.en || key;
  return raw.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

export function makeT(lang = 'ht') {
  return (key, vars) => t(lang, key, vars);
}
