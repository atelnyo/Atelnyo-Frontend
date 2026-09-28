/**
 * src/pwa/storage/fileCatalog.js
 *
 * FILE CATALOG — the persistent index that keeps the file manager
 * "alive" between the app and the Atelnyo filesystem. It lives AS A
 * FILE inside the user's folder — `Exports/atelnyo-catalog.json` —
 * NOT in the browser sandbox, so it:
 *
 *   • travels with the folder — move/copy/backup the folder and the
 *     index goes with it;
 *   • survives browser site-data clearing — the sandbox handle dies,
 *     the file stays; a reconnect re-reads it;
 *   • carries USER metadata (stars/favorites) — the one thing that
 *     cannot live in the filesystem itself (FSA has no xattr).
 *
 * TRUTH RULES (the subsystem's contract — never break them):
 *   • The FOLDER is the source of truth for file existence. sync()
 *     re-walks the fixed layout and PRUNES entries that disappeared;
 *     the catalog never invents a file.
 *   • The catalog is a CACHE + USER-METADATA store — never an
 *     authority for operations. fs.read/remove/rename always hit the
 *     real filesystem; the catalog only powers display/search/stars.
 *   • Self-healing: a missing or corrupt catalog file → full resync →
 *     recreated. A read-only root → `persisted: false` (in-memory
 *     index only, honest). A write failure degrades to a fact
 *     (`lastError`), never a throw.
 *
 * Contract: `subscribe(cb)` / `getState()` — same as the other
 * managers. File writes are debounced (metadata churn) and gated on
 * the current write grant.
 */
import fileOperations from './fileOperations.js'
import rootFolderManager from './rootFolderManager.js'

const FILE_NAME = 'atelnyo-catalog.json'
const FORMAT_VERSION = 1
const WRITE_DEBOUNCE_MS = 500

function keyOf(folder, category, name) {
  return `${folder}/${category || ''}/${name}`
}

class FileCatalog {
  constructor() {
    this.ready = false
    this.persisted = false
    this.lastSynced = null
    this.lastError = null
    this._entries = new Map() // key -> { folder, category, name, kind }
    this._stars = {} // key -> true (user metadata — the file's raison d'être)
    this._listeners = new Set()
    this._dirty = false
    this._flushTimer = null
  }

  /**
   * PUBLIC — re-sync the catalog: recover user metadata (load), walk
   * the layout (the TRUTH), merge (keep only surviving stars), then
   * persist the index file. Idempotent; call it after connect, on
   * foreground return, or from the UI "Re-sync" button.
   *
   * OPTIMIZATION — ``existingWalk``: pass the browse() result a UI
   * already holds (loadTree) so this never re-walks the layout twice
   * in a row. When omitted, sync() walks itself (manager hook /
   * explicit re-sync).
   */
  async sync(existingWalk) {
    await this.load()
    try {
      const walk = existingWalk && existingWalk.ok === true
        ? existingWalk
        : await fileOperations.browse()
      if (!walk || walk.ok !== true) {
        // No root / FSA unsupported — the whole surface is unavailable.
        this.ready = true
        this.persisted = false
        this._notify()
        return
      }
      const fresh = new Map()
      for (const node of walk.folders) {
        for (const e of node.entries) {
          fresh.set(keyOf(node.folder, null, e.name), {
            folder: node.folder,
            category: null,
            name: e.name,
            kind: e.isDirectory ? 'directory' : 'file',
          })
        }
        for (const [cat, list] of Object.entries(node.categoryEntries || {})) {
          for (const e of list) {
            fresh.set(keyOf(node.folder, cat, e.name), {
              folder: node.folder,
              category: cat,
              name: e.name,
              kind: e.isDirectory ? 'directory' : 'file',
            })
          }
        }
      }
      // Keep stars only for entries that still exist (no phantom stars).
      const surviving = {}
      for (const [k, v] of Object.entries(this._stars)) {
        if (fresh.has(k)) {surviving[k] = v}
      }
      // Only persist when the index ACTUALLY changed (new/vanished
      // entries or a changed star set) or the file was never written
      // yet — a read-only browse must not rewrite the catalog file.
      const changed = this._indexChanged(fresh, surviving)
      this._entries = fresh
      this._stars = surviving
      this.lastSynced = Date.now()
      this.ready = true
      this._notify()
      if (changed) {
        this._dirty = true
        await this._persist({ force: true })
      }
    } catch (err) {
      this.lastError = err?.message || 'catalog sync failed'
      this._notify()
    }
  }

  /**
   * PUBLIC — read the catalog file back (user metadata recovery +
   * offline-before-walk entries). A missing file is a normal first
   * run; a corrupt file is treated as empty and recreated by the next
   * sync. The WALK always re-validates existence afterwards.
   */
  async load() {
    try {
      const res = await fileOperations.read({
        folder: fileOperations.FOLDERS.EXPORTS,
        name: FILE_NAME,
      })
      if (!res || res.ok !== true) {
        this.ready = true
        this._notify()
        return
      }
      let parsed = null
      try {
        parsed = JSON.parse(res.text)
      } catch {
        parsed = null // corrupt — resync recreates it
      }
      if (parsed && parsed.version === FORMAT_VERSION && Array.isArray(parsed.entries)) {
        const entries = new Map()
        for (const en of parsed.entries) {
          if (en && typeof en.name === 'string') {
            const cat = en.category || null
            entries.set(keyOf(en.folder, cat, en.name), {
              folder: en.folder,
              category: cat,
              name: en.name,
              kind: en.kind === 'directory' ? 'directory' : 'file',
            })
          }
        }
        this._entries = entries
        this._stars = parsed.stars && typeof parsed.stars === 'object' ? parsed.stars : {}
      }
      if (parsed && parsed.updatedAt) {this.lastSynced = parsed.updatedAt}
      this.ready = true
      this._notify()
    } catch (err) {
      this.ready = true
      this.lastError = err?.message || 'catalog load failed'
      this._notify()
    }
  }

  /**
   * PUBLIC — search the index by name (folder/category/name, case-
   * insensitive). The catalog file itself is never a result. Returns
   * plain entries with the star flag.
   */
  search(query) {
    const q = String(query || '').trim().toLowerCase()
    const out = []
    for (const en of this._entries.values()) {
      if (en.name === FILE_NAME) {continue}
      if (!q || `${en.folder}/${en.category || ''}/${en.name}`.toLowerCase().includes(q)) {
        out.push({ ...en, starred: !!this._stars[keyOf(en.folder, en.category, en.name)] })
      }
    }
    return out
  }

  /**
   * PRIVATE — did the freshly walked index differ from the current
   * one (by key set, or by star state)? Drives the "persist only on
   * real change" rule in sync().
   */
  _indexChanged(fresh, surviving) {
    if (fresh.size !== this._entries.size) return true
    for (const k of fresh.keys()) {
      if (!this._entries.has(k)) return true
    }
    const prevStars = Object.keys(this._stars)
    const nextStars = Object.keys(surviving)
    if (prevStars.length !== nextStars.length) return true
    for (const k of nextStars) {
      if (!this._stars[k]) return true
    }
    return false
  }

  /** PUBLIC — entry counts (the catalog file excluded). */
  stats() {
    let files = 0
    let dirs = 0
    for (const en of this._entries.values()) {
      if (en.name === FILE_NAME) {continue}
      if (en.kind === 'directory') {dirs += 1}
      else {files += 1}
    }
    return { files, dirs, entries: files + dirs }
  }

  /** PUBLIC — is a file (FileRef) starred? */
  isStarred(ref) {
    return !!this._stars[keyOf(ref.folder, ref.category || null, ref.name)]
  }

  /**
   * PUBLIC — star/unstar a file. USER METADATA — the one thing the
   * filesystem cannot store, and the reason the catalog file must
   * exist in the folder. Debounced persist.
   */
  setStar(ref, starred) {
    const k = keyOf(ref.folder, ref.category || null, ref.name)
    if (starred) {this._stars[k] = true}
    else {delete this._stars[k]}
    this._dirty = true
    this._notify()
    this._schedulePersist()
  }

  /* ── Persistence (debounced; gated on the current write grant) ── */
  _canWrite() {
    const uf = rootFolderManager.getState()
    return uf.permissionState === 'granted' && uf.accessMode === 'readwrite'
  }

  _schedulePersist() {
    if (this._flushTimer) {clearTimeout(this._flushTimer)}
    this._flushTimer = setTimeout(() => {
      this._flushTimer = null
      this._persist().catch(() => { /* handled inside */ })
    }, WRITE_DEBOUNCE_MS)
  }

  async _persist(opts = {}) {
    const force = opts && opts.force === true
    if (this._flushTimer) {
      clearTimeout(this._flushTimer)
      this._flushTimer = null
    }
    if (!force && !this._dirty) {return}
    this._dirty = false
    if (!this._canWrite()) {
      // Read-only / unconfirmed root — honest in-memory index only.
      this.persisted = false
      this._notify()
      return
    }
    const payload = JSON.stringify({
      version: FORMAT_VERSION,
      updatedAt: Date.now(),
      entries: [...this._entries.values()],
      stars: this._stars,
    }, null, 2)
    try {
      const res = await fileOperations.write({
        folder: fileOperations.FOLDERS.EXPORTS,
        name: FILE_NAME,
      }, payload)
      if (res && res.ok) {
        this.persisted = true
        this.lastError = null
      } else {
        this.persisted = false
        this.lastError = res?.error || 'catalog write failed'
      }
    } catch (err) {
      this.persisted = false
      this.lastError = err?.message || 'catalog write failed'
    }
    this._notify()
  }

  /* ── Reactive contract ────────────────────────────────────────── */
  subscribe(cb) {
    this._listeners.add(cb)
    return () => this._listeners.delete(cb)
  }

  getState() {
    const st = this.stats()
    return {
      ready: this.ready === true,
      persisted: this.persisted === true,
      files: st.files,
      dirs: st.dirs,
      entries: st.entries,
      lastSynced: this.lastSynced,
      lastError: this.lastError,
      starsCount: Object.keys(this._stars).length,
    }
  }

  /**
   * PUBLIC — the root was DISCONNECTED (or revoked): clear the index.
   * Honest — the entries belonged to that folder; the catalog file
   * stays in the folder (user keeps it), but this session must not
   * show stale files or phantom stars.
   */
  resetForDisconnect() {
    this._entries = new Map()
    this._stars = {}
    this._dirty = false
    if (this._flushTimer) {
      clearTimeout(this._flushTimer)
      this._flushTimer = null
    }
    this.persisted = false
    this.lastSynced = null
    this.lastError = null
    this.ready = false
    this._notify()
  }

  /** PUBLIC — full teardown (tests / HMR). */
  destroy() {
    if (this._flushTimer) {
      clearTimeout(this._flushTimer)
      this._flushTimer = null
    }
    this._listeners.clear()
    return this
  }

  _notify() {
    this._listeners.forEach((fn) => {
      try {
        fn(this.getState())
      } catch { /* a bad listener must not break the catalog */ }
    })
  }
}

/** Singleton — StorageManager exposes it as `storageManager.catalog`. */
export const fileCatalog = new FileCatalog()

export default fileCatalog
