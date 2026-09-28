/**
 * src/pwa/storage/storageTypes.js
 *
 * PURE TYPES & CONSTANTS of the PWA Storage subsystem — the backend
 * buckets, health levels, and policy knobs. No logic lives here; the
 * Storage Manager (StorageManager.js), the detector, and the health
 * module all import from this module so the whole subsystem speaks ONE
 * vocabulary.
 *
 * Storage answers “Ki kote Atelnyo ka mete fichye li yo?” (where can
 * Atelnyo put its files?) across every backend the platform offers:
 *   • FALLBACK CHAIN — File System Access (user-chosen folders, Phase
 *     B) → OPFS → IndexedDB → localStorage (preferences only). Each
 *     rung is more universal than the last; the manager picks the best
 *     one that is actually available at runtime.
 *   • HEALTH — availability, quota pressure, and low-space state drive
 *     the UI (banners, Settings, Diagnostics) so the app never fails
 *     silently when storage is gone or nearly full.
 *   • PERSISTENCE — the persistent-storage permission protects the
 *     app's origin data from eviction under storage pressure.
 */
export const STORAGE_BACKENDS = {
  /** File System Access — user-chosen folders/files (Phase B wiring). */
  FSA: 'file-system-access',
  /** OPFS — Origin Private File System (blob/file storage). */
  OPFS: 'opfs',
  /** IndexedDB — unlimited structured KV storage (primary today). */
  INDEXED_DB: 'indexeddb',
  /** CacheStorage — HTTP cache for network resources (not a KV store). */
  CACHE: 'cache',
  /** localStorage — tiny synchronous fallback (preferences only). */
  LOCAL_STORAGE: 'localstorage',
  /** No usable backend at all. */
  NONE: 'none',
};

/**
 * Priority order of KV backends (first AVAILABLE wins). Matches the
 * ACTUAL write chain of store.* (IndexedDB → localStorage fallback):
 * OPFS is deliberately NOT here — the KV store never writes to it.
 */
export const BACKEND_PRIORITY = [
  STORAGE_BACKENDS.INDEXED_DB,
  STORAGE_BACKENDS.LOCAL_STORAGE,
];

/**
 * Priority order of FILE backends (first AVAILABLE wins). Matches the
 * ACTUAL write chain of files.* (OPFS → IndexedDB blob fallback).
 * Reported separately from the KV backend — never conflated.
 */
export const FILE_BACKEND_PRIORITY = [
  STORAGE_BACKENDS.OPFS,
  STORAGE_BACKENDS.INDEXED_DB,
];

/**
 * Health levels of the storage subsystem:
 *   • ok       — a backend is available and quota pressure is low.
 *   • warning  — usage crossed WARN_SPACE_RATIO (or quota unknown).
 *   • low      — usage crossed LOW_SPACE_RATIO — the app should stop
 *                writing large files and tell the user to free space.
 *   • blocked  — NO backend is usable — persistence is unavailable.
 *   • unknown  — not enough information yet (pre-init / no estimate).
 *   • degraded — ONLY emitted by the AGGREGATE snapshot
 *                (computeHealthSnapshot): the private core is fine BUT
 *                the user folder is connected-and-broken (granted but
 *                gone — 'inaccessible' — or stale — 'needs-approval').
 *                Never emitted by computeHealth (the private core).
 */
export const HEALTH_LEVELS = {
  OK: 'ok',
  WARNING: 'warning',
  LOW: 'low',
  BLOCKED: 'blocked',
  UNKNOWN: 'unknown',
  DEGRADED: 'degraded',
};

/**
 * Storage policy knobs:
 *   • warnSpaceRatio — usage/quota above this ⇒ WARNING (default 75%).
 *   • lowSpaceRatio  — usage/quota above this ⇒ CRITICAL/LOW (default
 *                      90%) — large writes are discouraged past this.
 *
 * ⚠️ NO UNIVERSAL GB NUMBER — these thresholds are RATIOS of the
 * BROWSER-REPORTED quota (navigator.storage.estimate()). Each browser
 * / device reports its OWN quota; a ratio adapts automatically.
 * Inventing an absolute byte count ("warn under 500 MB") would be
 * wrong on a small quota and useless on a huge one. Atelnyo never
 * hardcodes a byte threshold for the low-space state.
 */
export const STORAGE_POLICY = {
  warnSpaceRatio: 0.75,
  lowSpaceRatio: 0.9,
};

/**
 * SPACE LEVELS — the SPACE-PRESSURE vocabulary of the low-space state
 * (the UI-facing terms for the QUOTA dimension ONLY):
 *
 *   HEALTHY   — plenty of space (usage below the warn ratio).
 *   WARNING   — space is running low (past the warn ratio) — warn the
 *               user; writes may continue.
 *   CRITICAL  — space is almost full (past the low ratio) — stop
 *               large writes, surface a low-space warning, ask the
 *               user to free space.
 *   UNKNOWN   — the browser did not report a quota (no estimate).
 *
 * Deliberately does NOT include 'blocked' (that is an AVAILABILITY
 * fact — no usable backend — not a space fact; it maps to null).
 *
 * ⚠️ NO UNIVERSAL GB NUMBER — levels derive from RATIOS of the
 * browser-reported quota (see STORAGE_POLICY). Each browser/device
 * has its own quota; never invent an absolute byte threshold.
 */
export const SPACE_LEVELS = {
  HEALTHY: 'healthy',
  WARNING: 'warning',
  CRITICAL: 'critical',
  UNKNOWN: 'unknown',
};

/**
 * Map the private storage health to the SPACE vocabulary. 'blocked'
 * (and 'degraded') are NOT space facts — they map to null and the
 * caller surfaces them through the availability/aggregate channels.
 */
export function spaceLevelFor(health) {
  switch (health) {
    case HEALTH_LEVELS.OK:
      return SPACE_LEVELS.HEALTHY;
    case HEALTH_LEVELS.WARNING:
      return SPACE_LEVELS.WARNING;
    case HEALTH_LEVELS.LOW:
      return SPACE_LEVELS.CRITICAL;
    case HEALTH_LEVELS.UNKNOWN:
      return SPACE_LEVELS.UNKNOWN;
    default:
      return null; // blocked / degraded — availability, not space
  }
}

/**
 * ── FIRST PRINCIPLE: two storages, never mixed ─────────────────────
 *
 * A. PRIVATE APP STORAGE — storage Atelnyo CONTROLS for internal app
 *    functions. NEVER requires the user to choose a folder. Lives in
 *    the origin's own space (IndexedDB / OPFS / localStorage) under a
 *    namespaced key convention.
 *
 * B. USER STORAGE — storage the user CHOOSES (File System Access
 *    folder handles, Phase B/C). Lives OUTSIDE the private namespace
 *    entirely — different handles, different permissions, different
 *    lifecycle. It is NEVER interleaved with private keys.
 *
 * This module owns the PRIVATE side. Each domain below maps to one
 * category of internal data (session, drafts, offline state, pending
 * operations, app metadata, cached structured data, preferences,
 * internal files).
 */
export const PRIVATE_NAMESPACE = 'private';

export const PRIVATE_DOMAINS = {
  /** User session data (tokens, user cache) — auth-layer managed. */
  SESSION: 'session',
  /** Unsaved form drafts (appStateStore.saveFormDraft). */
  DRAFTS: 'drafts',
  /** Offline request queue + background-sync state (offlineQueue). */
  OFFLINE: 'offline',
  /** Pending operations (the offline queue's retry ledger). */
  PENDING: 'pending',
  /** App metadata (active tab, scroll, continuity, SW version). */
  METADATA: 'metadata',
  /** Cached structured data (consent, offline settings). */
  CACHE: 'cache',
  /** User preferences (localStorage atelnyo_* keys). */
  PREFS: 'prefs',
  /** Internal files (OPFS / IndexedDB blob fallback). */
  FILES: 'files',
};

/**
 * Build the namespaced key for a private-app-storage entry:
 *   privateKey('offline', 'queue') → 'private:offline:queue'
 * The namespace is the ONLY thing that distinguishes private app
 * storage from anything else — user storage never lives under this
 * prefix.
 */
export function privateKey(domain, key) {
  return `${PRIVATE_NAMESPACE}:${domain}:${key}`;
}

/**
 * ── USER STORAGE (principle B) — the user's own root folder ────────
 *
 * The user explicitly chooses a root folder (File System Access).
 * User files live THERE — on the user's device, in their folder —
 * NEVER inside the private namespace. The app only stores the HANDLE
 * (a key) in private storage (the dedicated devrose-handles DB) so it
 * can re-open the folder on the next session.
 *
 * This section owns the USER side: the subfolder layout Atelnyo
 * maintains under the chosen root, the handle storage key, and the
 * permission vocabulary.
 */

/** The fixed subfolder layout Atelnyo keeps under the user root. */
export const USER_FOLDERS = {
  MEDIA: 'Media',
  DOCUMENTS: 'Documents',
  DOWNLOADS: 'Downloads',
  BACKUPS: 'Backups',
  EXPORTS: 'Exports',
};

/**
 * THE ANCHOR — the root folder the user chooses is an ANCHOR storage
 * location; Atelnyo keeps its whole layout under ONE namespace folder
 * so it never scatters files across the user's chosen location:
 *
 *   Root (user-chosen anchor)
 *   └── Atelnyo/
 *       ├── Media/  Documents/  Downloads/  Backups/  Exports/
 *
 * The anchor is created/ensured when a WRITE connection is used; a
 * READ-only connection resolves the EXISTING structure without ever
 * attempting to create (the browser permission is the source of truth
 * — Atelnyo never assumes it may create or modify anything).
 */
export const USER_ANCHOR_FOLDER = 'Atelnyo';

/** Storage key for the persisted root handle (devrose-handles DB). */
export const USER_ROOT_HANDLE_KEY = 'user-root';

/**
 * Access modes of the user-selected root folder (the mode passed to
 * queryPermission / requestPermission / getFileHandle):
 *   • read      — read-only access to the folder.
 *   • write     — CONCEPTUAL alias: the browser File System Access API
 *                 has NO write-only mode — every write capability is
 *                 expressed as 'readwrite' (write implies read). This
 *                 constant exists so app code can say what it MEANS
 *                 (write intent) while the adapter always resolves it
 *                 to READWRITE at the browser boundary.
 *   • readwrite — full access (read + write) — what Atelnyo requests
 *                 when the user chooses the root folder.
 */
export const ACCESS_MODES = {
  READ: 'read',
  WRITE: 'write',
  READWRITE: 'readwrite',
};

/**
 * WORKFLOW-DRIVEN ACCESS — the access mode follows the WORKFLOW, not
 * a fixed default. Each Atelnyo feature declares what it genuinely
 * needs; the Storage Manager requests the MINIMUM mode that satisfies
 * it (never more):
 *
 *   • BROWSE  → READ        — browse documents / read existing files.
 *   • PROJECT → READWRITE   — Atelnyo project folder: read existing
 *                             files + modify files + save new files.
 *   • EXPORT  → READWRITE   — write exports (CSV/ZIP/PDF) to the
 *                             user's folder (granted lazily in-gesture
 *                             via requestWriteAccess() when the action
 *                             runs, or up-front when the connect flow
 *                             IS the export flow).
 *   • BACKUP  → READWRITE   — write local backups.
 *
 * Rule: ReadWrite is legitimate ONLY when the feature needs it — it
 * is never requested for browse-only workflows.
 */
export const WORKFLOW_MODES = {
  BROWSE: 'browse',
  PROJECT: 'project',
  EXPORT: 'export',
  BACKUP: 'backup',
  /** Upload preparation — media staged before being sent to the server. */
  UPLOAD_PREP: 'upload-prep',
  /** Local project files — media that belongs to a local Atelnyo project. */
  LOCAL_PROJECT: 'local-project',
  /** Offline workflows — media needed while disconnected. */
  OFFLINE: 'offline',
};

/**
 * Map a workflow to its REQUIRED access mode:
 *   modeForWorkflow(WORKFLOW_MODES.BROWSE)  → ACCESS_MODES.READ
 *   modeForWorkflow(WORKFLOW_MODES.PROJECT) → ACCESS_MODES.READWRITE
 * The mode a workflow needs is the mode the Storage Manager requests
 * — features declare intent, never hardcode a mode string.
 */
export function modeForWorkflow(workflow) {
  switch (workflow) {
    case WORKFLOW_MODES.PROJECT:
    case WORKFLOW_MODES.LOCAL_PROJECT:
    case WORKFLOW_MODES.EXPORT:
    case WORKFLOW_MODES.BACKUP:
      return ACCESS_MODES.READWRITE;
    case WORKFLOW_MODES.BROWSE:
    default:
      return ACCESS_MODES.READ;
  }
}

/**
 * MEDIA model — the Storage Manager is prepared for media workflows.
 * The ``Media/`` user-folder is organized by category:
 *
 *   Atelnyo/Media/
 *   ├── Images/  Videos/  Audio/  Other/
 *
 * MEDIA PLACEMENT is workflow-driven — Atelnyo NEVER puts media in
 * the user folder automatically:
 *   • EXPORT        → USER (writes exports into Atelnyo/Media/<Cat>/).
 *   • LOCAL_PROJECT → USER (media belongs to the user's project folder).
 *   • UPLOAD_PREP   → PRIVATE (staged in private app storage before
 *                     upload — never the user folder).
 *   • OFFLINE       → PRIVATE (offline media lives in origin-scoped
 *                     private storage).
 *   • anything else → PRIVATE (the SAFE default — never user).
 * Server storage is a placement the SERVER owns (after upload).
 */
export const MEDIA_CATEGORIES = {
  IMAGES: 'Images',
  VIDEOS: 'Videos',
  AUDIO: 'Audio',
  OTHER: 'Other',
};

/**
 * DOCUMENTS model — the SAME category mechanism as Media, for the
 * ``Documents/`` user folder:
 *
 *   Atelnyo/Documents/
 *   ├── PDFs/  Text/  Projects/  Other/
 *
 * The Storage Manager handles destination, permission, and write
 * operations for document categories exactly like media categories —
 * one mechanism, many category sets.
 */
export const DOCUMENT_CATEGORIES = {
  PDFS: 'PDFs',
  TEXT: 'Text',
  PROJECTS: 'Projects',
  OTHER: 'Other',
};

/**
 * The category set a user folder carries (or null when the folder has
 * no categories — e.g. Downloads/ Backups/ Exports/):
 *   categoriesFor(USER_FOLDERS.MEDIA)     → MEDIA_CATEGORIES
 *   categoriesFor(USER_FOLDERS.DOCUMENTS) → DOCUMENT_CATEGORIES
 *   categoriesFor(USER_FOLDERS.DOWNLOADS) → null
 */
export function categoriesFor(folder) {
  if (folder === USER_FOLDERS.MEDIA) return MEDIA_CATEGORIES;
  if (folder === USER_FOLDERS.DOCUMENTS) return DOCUMENT_CATEGORIES;
  return null;
}

/** Where media lives — decided PER WORKFLOW, never auto-user. */
export const MEDIA_PLACEMENTS = {
  /** User-selected folder (FSA): Atelnyo/Media/<Category>/. */
  USER: 'user',
  /** Private app storage (OPFS / IndexedDB private:files domain). */
  PRIVATE: 'private',
  /** Server / backend storage (owned by the server after upload). */
  SERVER: 'server',
};

/**
 * Route a media workflow to its storage placement. The DEFAULT is
 * PRIVATE — putting media in the user folder is an EXPLICIT choice
 * (export / local-project), never an automatic one.
 */
export function mediaPlacementFor(workflow) {
  switch (workflow) {
    case WORKFLOW_MODES.EXPORT:
    case WORKFLOW_MODES.LOCAL_PROJECT:
      return MEDIA_PLACEMENTS.USER;
    case WORKFLOW_MODES.UPLOAD_PREP:
    case WORKFLOW_MODES.OFFLINE:
      return MEDIA_PLACEMENTS.PRIVATE;
    default:
      return MEDIA_PLACEMENTS.PRIVATE;
  }
}

/**
 * BACKUP model. A backup is NOT "copy the whole browser database into
 * the folder" — it is a MANIFEST-DRIVEN envelope built from an
 * EXPLICIT set of data the product decides is exportable/backupable
 * (the ``collect`` callback — WHICH data is DEFINED LATER). The
 * manager owns the pipeline, format, destination, and verification.
 */
export const BACKUP_FORMAT = {
  /** Bump when the backup envelope schema changes. */
  VERSION: 1,
  MIME: 'application/json',
  /** Envelope marker — the payload is never a raw DB export. */
  FORMAT_MARKER: 'atelnyo-backup',
};

/**
 * FILE OPERATIONS — the vocabulary of the file-operations abstraction.
 * The Storage Manager exposes ALL of them as one API surface, but NOT
 * every operation is available in every browser: the adapter/fallback
 * architecture decides (capabilities()). A browser without File System
 * Access (or without handle.move) reports those ops honestly as
 * 'unavailable' instead of pretending they work.
 */
export const FILE_OPS = {
  CREATE: 'create',
  READ: 'read',
  WRITE: 'write',
  RENAME: 'rename',
  MOVE: 'move',
  DELETE: 'delete',
  LIST: 'list',
  SEARCH: 'search',
};

/**
 * EXPORT types — the vocabulary of the export workflow. The Storage
 * Manager provides the STORAGE CAPABILITY (destination + permission +
 * write, via saveDownload pointed at Exports/); the FEATURE-SPECIFIC
 * module decides WHAT to export (the actual file content) and passes
 * the matching type. The manager never decides export content.
 */
export const EXPORT_TYPES = {
  PROJECT: 'project',
  DOCUMENT: 'document',
  MEDIA: 'media',
  DATA: 'data',
  REPORT: 'report',
};

/** Where a backup is written — chosen by the flow, not the UI. */
export const BACKUP_DESTINATIONS = {
  /** Auto-chain: user folder (Atelnyo/Backups/) → picker → download. */
  AUTO: 'auto',
  /** User folder only (falls back honestly when unavailable). */
  USER_FOLDER: 'user-folder',
  /** Always the save-file picker (explicit user choice of location). */
  PICKER: 'picker',
};

/**
 * THE PERMISSION MODEL — richer than true/false. The Storage Manager
 * NEVER assumes "handle exists ⇒ permission granted": on every boot it
 * restores the handle, then RE-QUERIES permission (queryPermission),
 * and only then updates the storage state.
 *
 * States (connection × grant):
 *   • none        — NOT CONNECTED: no root handle at all (never chosen).
 *   • granted     — handle present + browser grant is ACTIVE.
 *   • prompt      — handle present but the grant needs a user gesture
 *                   to be (re-)confirmed (browser restart / settings).
 *   • denied      — the user revoked access via BROWSER settings; the
 *                   handle is dead — dropped on boot revalidation.
 *   • revoked     — access is no longer TRUSTED: the user revoked it
 *                   (app-initiated revokeAccess()) OR the app learned
 *                   the grant was taken away mid-session (browser
 *                   settings); equivalent browser state to denied,
 *                   kept as a distinct semantic for the UI ("you
 *                   revoked, then...").
 *   • disconnected— the user DISCONNECTED via the app (disconnect()/...
 *                   revokeAccess()); the handle was dropped by the app
 *                   itself — distinct from 'none' (was connected once)
 *                   and from 'denied' (not a browser permission state).
 *   • unsupported — File System Access unavailable on this browser
 *                   (fallback mode; the core app never depends on it).
 */
export const STORAGE_PERMISSIONS = {
  GRANTED: 'granted',
  PROMPT: 'prompt',
  DENIED: 'denied',
  REVOKED: 'revoked',
  DISCONNECTED: 'disconnected',
  UNSUPPORTED: 'unsupported',
  NONE: 'none',
};

/**
 * ROOT STATUS — the UI-facing COMBINED fact of the user-selected root
 * (permission × accessibility). The permission grant can read
 * 'granted' while the folder was DELETED/MOVED on disk (device or
 * browser state changed) — the status says the truth the UI must
 * show: **"Connected ✓" is displayed ONLY when the status is
 * 'healthy'** (granted AND accessible AND freshly validated).
 *   • healthy        — granted AND actually accessible.
 *   • inaccessible   — granted but the folder is GONE (deleted/moved)
 *                      — permission ≠ accessibility.
 *   • needs-approval — 'prompt' — a user gesture re-approves.
 *   • revoked        — denied / revoked — reconnect required.
 *   • disconnected   — app-initiated disconnect.
 *   • none           — never connected.
 *   • unsupported    — FSA unavailable on this browser.
 */
export const ROOT_STATUSES = {
  HEALTHY: 'healthy',
  INACCESSIBLE: 'inaccessible',
  NEEDS_APPROVAL: 'needs-approval',
  REVOKED: 'revoked',
  DISCONNECTED: 'disconnected',
  NONE: 'none',
  UNSUPPORTED: 'unsupported',
};

/**
 * The startup revalidation pipeline (never skipped, never assumed):
 *
 *   App startup → restore saved handle → queryPermission({mode}) →
 *   check read/write mode → PROBE ACCESSIBILITY (enumerate the root —
 *   the folder may be deleted/moved while the grant survives) →
 *   update storage state
 *
 * ``handle exists`` alone is NEVER treated as ``permission granted``,
 * and ``permission granted`` alone is NEVER treated as ``folder
 * accessible``. See rootFolderManager._restore() + revalidate() — the
 * implementations of this flow.
 */
export const PERMISSION_REVALIDATION = {
  /** On-boot revalidation: queryPermission ONLY (never request). */
  boot: 'query',
  /** Re-approval on a user gesture: requestPermission. */
  reapprove: 'request',
};

/**
 * USER STORAGE STATUSES — the UI STATE MACHINE of the user-selected
 * root folder: "what should the UI SHOW / OFFER right now?". Derived
 * by userStorageStatusFor() from the raw facts (permission × access
 * mode × accessibility × error). Complementary to ROOT_STATUSES:
 *   • ROOT_STATUSES (rootStatus) = permission × accessibility — "is
 *     the connection healthy?" (the "Connected ✓" rule: ONLY healthy).
 *   • USER_STORAGE_STATUSES (status) = what the UI should RENDER —
 *     the ACCESS LEVEL (read-only / read-write), the ACTION needed
 *     (permission-required), or the BROKEN state (error).
 *
 * The 9 states:
 *   • not-connected      — never connected (no handle).
 *   • connected          — granted + accessible but the ACCESS LEVEL
 *                          is unconfirmed (accessible unknown).
 *   • permission-required— 'prompt' — a user gesture re-approves.
 *   • read-only          — granted + accessible + READ grant — the
 *                          user can read, not write.
 *   • read-write         — granted + accessible + READWRITE grant —
 *                          the user can read AND write.
 *   • revoked            — denied / revoked — reconnect required.
 *   • disconnected       — the user disconnected via the app.
 *   • unavailable        — FSA unsupported on this browser.
 *   • error              — a broken/inconsistent state: granted but
 *                          the folder is GONE (deleted/moved), a
 *                          restore/picker attempt failed, or an
 *                          unknown permission value.
 */
export const USER_STORAGE_STATUSES = {
  NOT_CONNECTED: 'not-connected',
  CONNECTED: 'connected',
  PERMISSION_REQUIRED: 'permission-required',
  READ_ONLY: 'read-only',
  READ_WRITE: 'read-write',
  REVOKED: 'revoked',
  DISCONNECTED: 'disconnected',
  UNAVAILABLE: 'unavailable',
  ERROR: 'error',
};

/**
 * Derive the USER STORAGE STATUS (the 9-state UI machine) from the
 * raw root-folder facts — PURE, the single derivation:
 *
 *   userStorageStatusFor({ permission, mode, accessible, error })
 *
 * Derivation (honest — never over-claims):
 *   • granted + folder GONE (accessible: false)  → 'error' — a grant
 *     cannot resurrect a deleted/moved folder; "connected" would lie.
 *   • granted + accessible (confirmed)           → 'read-only' or
 *     'read-write' (the ACCESS LEVEL is the status).
 *   • granted + accessible UNKNOWN               → 'connected' — never
 *     over-claim the level when it wasn't confirmed.
 *   • prompt                                     → 'permission-required'.
 *   • denied / revoked                           → 'revoked'.
 *   • disconnected                               → 'disconnected'.
 *   • unsupported                                → 'unavailable'.
 *   • none + a real error (restore/picker failed)→ 'error' — a failed
 *     attempt is NOT the same as "never connected".
 *   • none (clean)                               → 'not-connected'.
 *   • anything else (unknown permission)         → 'error' (the
 *     machine is inconsistent — surface it, don't guess).
 */
export function userStorageStatusFor({ permission, mode, accessible, error }) {
  if (permission === STORAGE_PERMISSIONS.GRANTED) {
    if (accessible === false) return USER_STORAGE_STATUSES.ERROR;
    if (accessible === true) {
      return mode === ACCESS_MODES.READWRITE
        ? USER_STORAGE_STATUSES.READ_WRITE
        : USER_STORAGE_STATUSES.READ_ONLY;
    }
    return USER_STORAGE_STATUSES.CONNECTED;
  }
  if (permission === STORAGE_PERMISSIONS.PROMPT) {
    return USER_STORAGE_STATUSES.PERMISSION_REQUIRED;
  }
  if (permission === STORAGE_PERMISSIONS.DENIED
    || permission === STORAGE_PERMISSIONS.REVOKED) {
    return USER_STORAGE_STATUSES.REVOKED;
  }
  if (permission === STORAGE_PERMISSIONS.DISCONNECTED) {
    return USER_STORAGE_STATUSES.DISCONNECTED;
  }
  if (permission === STORAGE_PERMISSIONS.UNSUPPORTED) {
    return USER_STORAGE_STATUSES.UNAVAILABLE;
  }
  if (permission === STORAGE_PERMISSIONS.NONE) {
    return error ? USER_STORAGE_STATUSES.ERROR : USER_STORAGE_STATUSES.NOT_CONNECTED;
  }
  return USER_STORAGE_STATUSES.ERROR;
}

/**
 * STORAGE ERRORS — the CANONICAL error vocabulary of the Storage
 * subsystem. Every failure the UI can receive normalizes to ONE of
 * these categories (via normalizeStorageError) so the UX can give a
 * good message. The UI NEVER reads a raw DOMException name
 * ('NotAllowedError', 'NotFoundError', …) or a browser-specific
 * string — it switches on this vocabulary.
 *
 * Categories (the UX-facing vocabulary):
 *   • permission-denied  — the BROWSER refused access (NotAllowedError
 *                          / SecurityError) — grant revoked or never
 *                          given. UI: "aksè pa otorize — re-apwouve".
 *   • permission-revoked — access was REVOKED (the app learned the
 *                          grant died mid-session, or the user revoked
 *                          via revokeAccess). UI: reconnect required.
 *   • no-root            — NOT CONNECTED: the operation needs the
 *                          user-selected root folder and none is
 *                          connected. UI: "konekte yon folder".
 *   • file-not-found     — the file/folder does not exist
 *                          (NotFoundError) — deleted/moved, or never
 *                          created. UI: "fichye a pa la ankò".
 *   • quota-exceeded     — storage is full (QuotaExceededError /
 *                          NS_ERROR_DOM_QUOTA_REACHED / code 22).
 *                          UI: "libère espas" (see §4k QUOTA).
 *   • unsupported        — the API/capability is missing in this
 *                          browser (e.g. FSA, handle.move). UI: op pa
 *                          disponib isit la.
 *   • invalid-operation  — the caller passed something invalid
 *                          (unknown folder/category/export type, empty
 *                          backup). UI: yon erè nan demand la.
 *   • unknown            — a generic I/O or unexpected failure; the
 *                          result's `message` carries the detail.
 *
 * NOT errors — two OUTCOMES kept distinct so the UI never treats a
 * user decision as a failure:
 *   • cancelled          — the user CLOSED a picker. Outcome, not an
 *                          error: the UI just closes the dialog, no
 *                          error message.
 *   • permission-prompt  — the operation needs a user gesture to
 *                          re-approve (state, not a failure): the UI
 *                          offers a "Re-apwouve" action instead of an
 *                          error toast.
 */
export const STORAGE_ERRORS = {
  PERMISSION_DENIED: 'permission-denied',
  PERMISSION_REVOKED: 'permission-revoked',
  NOT_CONNECTED: 'no-root',
  FILE_NOT_FOUND: 'file-not-found',
  QUOTA_EXCEEDED: 'quota-exceeded',
  UNSUPPORTED: 'unsupported',
  INVALID_OPERATION: 'invalid-operation',
  UNKNOWN: 'unknown',
  // Outcomes — NOT errors (documented above).
  CANCELLED: 'cancelled',
  NEEDS_APPROVAL: 'permission-prompt',
};

/**
 * Map LEGACY / op-specific codes to their canonical category. These
 * strings predate the vocabulary (or are deliberate op DETAIL codes
 * like 'read-failed') — normalization keeps every code the subsystem
 * has ever emitted addressable by ONE vocabulary.
 */
const LEGACY_ERROR_MAP = {
  // (Canonical codes are NOT listed here — normalizeStorageError
  // short-circuits them via the STORAGE_ERRORS values-check first;
  // this map only ever receives NON-canonical strings.)
  // Structure absent (+ creation denied) — the folder is not there.
  'missing-folder': STORAGE_ERRORS.FILE_NOT_FOUND,
  // Caller-side validation failures.
  'unknown-folder': STORAGE_ERRORS.INVALID_OPERATION,
  'unknown-category': STORAGE_ERRORS.INVALID_OPERATION,
  'unknown-export-type': STORAGE_ERRORS.INVALID_OPERATION,
  'empty-backup': STORAGE_ERRORS.INVALID_OPERATION,
  // Generic I/O failures — the op name is detail; the message carries
  // the browser's text. They normalize to UNKNOWN (not a category).
  'resolve-failed': STORAGE_ERRORS.UNKNOWN,
  'read-failed': STORAGE_ERRORS.UNKNOWN,
  'write-failed': STORAGE_ERRORS.UNKNOWN,
  'list-failed': STORAGE_ERRORS.UNKNOWN,
  'delete-failed': STORAGE_ERRORS.UNKNOWN,
  'create-failed': STORAGE_ERRORS.UNKNOWN,
  'rename-failed': STORAGE_ERRORS.UNKNOWN,
  'move-failed': STORAGE_ERRORS.UNKNOWN,
  'open-failed': STORAGE_ERRORS.UNKNOWN,
  'save-failed': STORAGE_ERRORS.UNKNOWN,
};

/**
 * Normalize ANY storage failure into its canonical category
 * (STORAGE_ERRORS value) — the single mapper for the subsystem:
 *
 *   normalizeStorageError(errOrCode, fallback = 'unknown')
 *
 * Accepts:
 *   • a raw Error / DOMException — mapped by `name`/`code` so the UI
 *     NEVER reads 'NotAllowedError', 'NotFoundError', … directly.
 *   • a legacy op code ('read-failed', 'missing-folder', …) — mapped
 *     through LEGACY_ERROR_MAP (backward compatible).
 *   • an already-canonical code — returned as-is (idempotent).
 *
 * DOMException mapping (the classes the browser can throw):
 *   NotAllowedError / SecurityError → permission-denied
 *   NotFoundError                   → file-not-found
 *   QuotaExceededError / NS_ERROR_DOM_QUOTA_REACHED / code 22
 *                                   → quota-exceeded
 *   AbortError                      → cancelled (user closed a picker)
 *   NotSupportedError               → unsupported
 *   InvalidStateError / TypeMismatchError → invalid-operation
 *   anything else                   → fallback (default 'unknown')
 */
export function normalizeStorageError(errOrCode, fallback = STORAGE_ERRORS.UNKNOWN) {
  if (errOrCode === null || errOrCode === undefined) return fallback;
  if (typeof errOrCode === 'string') {
    // Already canonical (category OR outcome) — idempotent.
    if (Object.values(STORAGE_ERRORS).includes(errOrCode)) return errOrCode;
    return LEGACY_ERROR_MAP[errOrCode] || fallback;
  }
  // Raw Error / DOMException — the class the UI must never read raw.
  const name = errOrCode?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return STORAGE_ERRORS.PERMISSION_DENIED;
  }
  if (name === 'NotFoundError') return STORAGE_ERRORS.FILE_NOT_FOUND;
  if (name === 'QuotaExceededError'
    || name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || errOrCode?.code === 22) {
    return STORAGE_ERRORS.QUOTA_EXCEEDED;
  }
  if (name === 'AbortError') return STORAGE_ERRORS.CANCELLED;
  if (name === 'NotSupportedError') return STORAGE_ERRORS.UNSUPPORTED;
  if (name === 'InvalidStateError' || name === 'TypeMismatchError') {
    return STORAGE_ERRORS.INVALID_OPERATION;
  }
  return fallback;
}
