/**
 * src/pwa/storage/rootFolderManager.js
 *
 * ROOT FOLDER MANAGER — owns the USER-SELECTED ROOT FOLDER of the PWA
 * Storage subsystem (user storage side — principle B):
 *
 *   User Storage (folder the user CHOSE explicitly — consent required)
 *   └── [root handle]  ← showDirectoryPicker({ mode: 'readwrite' })
 *       ├── Media/        ← user media (Atelier, gallery)
 *       ├── Documents/    ← project documents
 *       ├── Downloads/    ← downloads
 *       ├── Backups/      ← local backups
 *       └── Exports/      ← exports (CSV, ZIP, PDF)
 *
 *   • chooseRoot()    → showDirectoryPicker — THE PICKER GESTURE IS
 *                       THE CONSENT. Persists the handle + resolves
 *                       the fixed subfolder layout.
 *   • getCurrentRoot()/hasRoot() → the restored root + state
 *   • changeRoot()    → a NEW picker; replaces the stored handle.
 *   • disconnect()    → drop the handle (the app can no longer open
 *                       the folder). Honest: the browser-side grant
 *                       persists until the user clears site data.
 *   • revokeAccess()  → disconnect + a note explaining what was and
 *                       was not revoked (no scriptable revokePermission).
 *   • getSubfolder()  → resolve (create if missing) one of the fixed
 *                       USER_FOLDERS subfolders.
 *
 * THE HANDLE IS A KEY: persisted via handleManager in the
 * devrose-handles DB (private side) — the app never stores user files
 * in private storage, only the key that unlocks the user's folder.
 *
 * Reactivity: same subscribe(cb) / getState() contract as the other
 * managers — the Storage Manager composes these facts into its
 * snapshot and re-emits on changes.
 */
import {
  USER_FOLDERS,
  USER_ROOT_HANDLE_KEY,
  USER_ANCHOR_FOLDER,
  STORAGE_PERMISSIONS,
  ACCESS_MODES,
  ROOT_STATUSES,
  categoriesFor,
} from './storageTypes.js';
import {
  saveHandle,
  restoreHandle,
  removeHandle,
  revalidateHandle,
  requestHandlePermission,
  HANDLE_MODES,
} from './handleManager.js';
import { handlesStore } from './storageBackends.js';
// ONE detection source of truth — the capability map. This manager
// never re-sniffs ``showDirectoryPicker`` itself.
import { detectCapabilities } from './storageDetector.js';

/**
 * Companion metadata key (devrose-handles DB) for the granted access
 * mode — persisted NEXT TO the root handle so a boot restore can
 * revalidate at the SAME mode that was granted (a readwrite root must
 * not silently downgrade to read because the mode was in-memory only).
 */
const USER_ROOT_MODE_KEY = 'user-root-mode';

/**
 * Derive the UI-facing ROOT STATUS from the permission state ×
 * accessibility probe. The UI shows "Connected ✓" ONLY when this is
 * 'healthy' — a 'granted' permission with a GONE folder must never
 * render as connected.
 */
function _deriveStatus(permission, accessible) {
  switch (permission) {
    case STORAGE_PERMISSIONS.UNSUPPORTED:
      return ROOT_STATUSES.UNSUPPORTED;
    case STORAGE_PERMISSIONS.NONE:
      return ROOT_STATUSES.NONE;
    case STORAGE_PERMISSIONS.DISCONNECTED:
      return ROOT_STATUSES.DISCONNECTED;
    case STORAGE_PERMISSIONS.DENIED:
    case STORAGE_PERMISSIONS.REVOKED:
      return ROOT_STATUSES.REVOKED;
    case STORAGE_PERMISSIONS.PROMPT:
      return ROOT_STATUSES.NEEDS_APPROVAL;
    case STORAGE_PERMISSIONS.GRANTED:
      return accessible === false
        ? ROOT_STATUSES.INACCESSIBLE
        : ROOT_STATUSES.HEALTHY;
    default:
      return ROOT_STATUSES.NONE;
  }
}

class RootFolderManager {
  constructor() {
    this._inited = false;
    // Is File System Access available in THIS browser?
    this.available = false;
    // The current root directory handle (null when disconnected).
    this.root = null;
    // 'granted' | 'prompt' | 'denied' | 'revoked' | 'disconnected' |
    // 'unsupported' | 'none'.
    this.permission = STORAGE_PERMISSIONS.NONE;
    // Is the connected root ACTUALLY accessible right now (true) or
    // GONE — deleted/moved on disk (false)? The permission grant can
    // survive while the folder disappears; this probe tells the truth.
    // null = not connected (or never probed).
    this.accessible = null;
    // The access mode granted for this root ('read' | 'readwrite').
    // MINIMUM-ACCESS principle: browse features connect read-only;
    // write (readwrite) is requested only when an action needs it
    // (Export project → requestWriteAccess).
    this.mode = ACCESS_MODES.READ;
    // Epoch ms of the LAST time the root's permission was validated
    // (queryPermission/requestPermission completed). Null = never
    // validated (not connected yet). Consumers use this to decide how
    // stale the permission state is (e.g. re-validate after a while).
    this.lastValidated = null;
    // Last error message (null when clean). 'permission-revoked' is
    // the honest state when a boot revalidation found the access dead.
    this.error = null;
    // True once the STARTUP RESTORE completed — whether it found a
    // handle (restored + revalidated + probed) or nothing to restore
    // (never connected). 'ready' = "the startup sequence ran to
    // completion", NOT "a root is connected" (see rootFolderConnected).
    this.ready = false;
    this._listeners = new Set();
  }

  /** Bind once. Idempotent. Returns `this`. */
  init() {
    if (this._inited || typeof window === 'undefined') return this;
    this._inited = true;
    // Pipeline: detect FSA support → restore persisted root (async).
    this.initialize();
    // FOREGROUND REVALIDATION — when the app returns to the
    // foreground, re-check the connection: the folder may have been
    // DELETED/MOVED or the permission revoked WHILE the app was away.
    // Query-only (never a prompt — a re-approval needs a gesture). The
    // state then stops showing "Connected ✓" for a connection that is
    // no longer verified. The probe is cheap (one directory read), so
    // every visible return is safe. Skips when NO root is connected
    // (nothing to re-validate — no notify storm on tab switches).
    this._onVisibility = () => {
      if (document.visibilityState === 'visible' && this.root) {
        this.revalidate().catch(() => { /* never reject the listener */ });
      }
    };
    document.addEventListener('visibilitychange', this._onVisibility);
    return this;
  }

  /**
   * PUBLIC — re-evaluate: FSA availability + restore the persisted
   * root (if any) and revalidate its permission. Idempotent.
   */
  initialize() {
    if (typeof window === 'undefined') return this;
    // From the storage capability map (single detection source — see
    // storageDetector.detectCapabilities). The directory picker is
    // the FSA capability the ROOT folder needs (open/save pickers are
    // separate capabilities for single-file workflows).
    this.available = detectCapabilities().fileSystemAccess.directoryPicker;
    if (!this.available) {
      this.root = null;
      this.permission = STORAGE_PERMISSIONS.UNSUPPORTED;
      // No validation happened — keep the clock honest. Reset the
      // mode too: a stale 'readwrite' must not survive FSA loss.
      this.mode = ACCESS_MODES.READ;
      this.lastValidated = null;
      // The startup decision IS the completion: FSA is unsupported,
      // there is nothing to restore — the state is final.
      this.ready = true;
      this._notify();
      return this;
    }
    this._restore().catch(() => { /* failure handled in _restore */ });
    return this;
  }

  /**
   * RESTART REVALIDATION — the biggest Storage Manager goal. After a
   * browser restart the persisted handle is restored (IndexedDB,
   * devrose-handles) and the grant is RE-QUERIED — never assumed, a
   * restart can silently revoke access:
   *
   *   Browser restarted → IndexedDB → restoreHandle → queryPermission
   *     ├── GRANTED → probe accessibility → connected (healthy:
   *     │             'read-only' | 'read-write' by the restored mode;
   *     │             a DELETED/MOVED folder reads 'inaccessible' —
   *     │             the probe is the truth, the grant is not)
   *     ├── PROMPT  → mark permission-required ('needs-approval' — a
   *     │             user gesture re-confirms; NEVER auto-requested)
   *     ├── DENIED  → _handleDenied: READ downgrade if the read grant
   *     │             survives ('restricted' — read-only root, mode
   *     │             persisted as read) ELSE full disconnect
   *     │             ('revoked' — handle dropped, error recorded)
   *     └── no FSA  → 'unsupported' (fallback: single-file workflows
   *                    via browserFileAdapter — the core never depends
   *                    on FSA)
   */
  async _restore() {
    try {
      const handle = await restoreHandle(USER_ROOT_HANDLE_KEY);
      if (!handle) {
        // Never connected — stay in the NONE state, but the startup
        // restore is DONE (there was nothing to restore). NOTIFY: the
        // ready flip must be OBSERVABLE — init() runs this restore in
        // parallel with the private-core refresh; if the estimate
        // settles FIRST, only this notify re-emits the composed
        // snapshot with userStorage.ready = true (a silent return
        // would leave it stuck false until an unrelated event).
        this.ready = true;
        this._notify();
        return;
      }
      this.root = handle;
      // Restore the granted access mode too (persisted next to the
      // handle) — a readwrite root MUST revalidate at readwrite, never
      // silently downgrade to read because the mode was in-memory only.
      const savedMode = await handlesStore.get(USER_ROOT_MODE_KEY);
      this.mode = savedMode === ACCESS_MODES.READWRITE
        ? ACCESS_MODES.READWRITE
        : ACCESS_MODES.READ;
      // Revalidate at the SAME mode that was granted — queryPermission
      // never asks for more than the session already holds.
      this.permission = await revalidateHandle(handle, this.mode);
      this.lastValidated = Date.now();
      if (this.permission === STORAGE_PERMISSIONS.DENIED) {
        if (await this._handleDenied(handle)) {
          // Downgraded to READ — the root is still alive; notify once.
          this.ready = true;
          this._notify();
          return;
        }
      }
      if (this.permission === STORAGE_PERMISSIONS.PROMPT) {
        // 'prompt' — the grant needs a user gesture to re-confirm;
        // it is NOT "folder gone". accessible stays null (unknown —
        // the honest tri-state), ALIGNED with revalidate()'s prompt
        // branch (the boot restore and the on-demand revalidation
        // must never disagree on what 'prompt' means).
        this.accessible = null;
      } else {
        // Granted (or downgraded): probe whether the folder is
        // ACTUALLY there — the permission grant can survive a
        // deleted/moved folder (the folder-disappears edge case).
        this.accessible = (await this._probeAccessibility()).accessible;
      }
      this.ready = true;
      this._notify();
    } catch (err) {
      this.error = err?.message || 'restore failed';
      // The restore FAILED but the sequence completed — the state is
      // honest (error set); a retry happens on a user action, never
      // automatically.
      this.ready = true;
      this._notify();
    }
  }

  /**
   * INTERNAL — probe whether the connected root is ACTUALLY accessible
   * right now. The permission grant can read 'granted' while the
   * folder was DELETED or MOVED on disk (device/browser state
   * changed): enumerating the root's OWN entries is the honest probe
   * — a gone folder throws NotFoundError even with a live grant.
   * Non-destructive (read-only, one step). Returns
   * { accessible, reason } — reason: null | 'no-root' | 'missing'
   * (deleted/moved) | 'permission' (grant unusable right now).
   */
  async _probeAccessibility() {
    if (!this.root) return { accessible: false, reason: 'no-root' };
    try {
      // Step the iterator once — if the folder no longer exists this
      // rejects (NotFoundError for deleted/moved; NotAllowedError /
      // SecurityError for an unusable grant).
      const iterator = this.root.entries();
      await iterator.next();
      return { accessible: true, reason: null };
    } catch (err) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
      return { accessible: false, reason: denied ? 'permission' : 'missing' };
    }
  }

  /**
   * INTERNAL — handle a DENIED permission honestly (shared by
   * _restore() and revalidate()). MINIMUM-ACCESS precision first: a
   * readwrite root denied at the WRITE grant may still hold READ
   * access (the user revoked only the write prompt) — retry at READ;
   * the root degrades to read-only instead of being dropped.
   * Otherwise FULLY disconnect: drop the dead handle AND null the
   * live root so hasRoot() never lies; the DENIED state + error stay
   * visible so the UI can explain why.
   *
   * Returns true when the root was downgraded to READ (still alive),
   * false when it was fully disconnected.
   */
  async _handleDenied(handle) {
    const readStatus = await revalidateHandle(handle, HANDLE_MODES.READ);
    if (readStatus === STORAGE_PERMISSIONS.GRANTED) {
      this.mode = ACCESS_MODES.READ;
      this.permission = STORAGE_PERMISSIONS.GRANTED;
      this.error = null;
      this.accessible = (await this._probeAccessibility()).accessible;
      try { await handlesStore.set(USER_ROOT_MODE_KEY, ACCESS_MODES.READ); } catch (_) {}
      return true;
    }
    this.error = 'permission-revoked';
    this.root = null;
    this.mode = ACCESS_MODES.READ;
    this.lastValidated = null;
    this.accessible = false;
    await removeHandle(USER_ROOT_HANDLE_KEY);
    try { await handlesStore.delete(USER_ROOT_MODE_KEY); } catch (_) {}
    return false;
  }

  /**
   * PUBLIC — RE-VALIDATE the connection ON DEMAND (foreground return,
   * storage panel open, explicit refresh). QUERY-ONLY — never a
   * prompt (permission-aware UX: boot/foreground = query; only a user
   * gesture re-requests). Detects the "connected handle but
   * inaccessible" edge case: the grant may read 'granted' while the
   * folder was DELETED/MOVED on disk — the accessibility probe
   * catches it and the state STOPS showing "Connected ✓".
   *
   * Returns { permissionState, accessible, rootStatus, lastValidated }.
   */
  async revalidate() {
    if (!this.root) {
      // Nothing connected — the status reflects the session state
      // (none / disconnected / revoked / unsupported). No probe, and
      // NO notify: the snapshot is unchanged (a full disconnect/revoke
      // already notified), so subscribers must not re-render on every
      // revalidate() call.
      return {
        permissionState: this.permission,
        accessible: null,
        rootStatus: _deriveStatus(this.permission, null),
        lastValidated: this.lastValidated,
      };
    }
    const handle = this.root;
    const permission = await revalidateHandle(handle, this.mode);
    this.permission = permission;
    this.lastValidated = Date.now();
    if (permission === STORAGE_PERMISSIONS.GRANTED) {
      this.error = null;
      // Granted — but is the folder actually there? Probe it.
      this.accessible = (await this._probeAccessibility()).accessible;
    } else if (permission === STORAGE_PERMISSIONS.DENIED) {
      await this._handleDenied(handle);
    } else {
      // 'prompt' — the grant needs a user gesture to re-confirm. The
      // folder may be perfectly accessible; 'prompt' is NOT "folder
      // gone". accessible stays null (unknown) — honest tri-state:
      // true (accessible) · false (gone) · null (unknown/not connected).
      // rootStatus derives 'needs-approval' from the permission alone.
      this.accessible = null;
    }
    this._notify();
    return {
      permissionState: this.permission,
      accessible: this.accessible,
      rootStatus: _deriveStatus(this.permission, this.accessible),
      lastValidated: this.lastValidated,
    };
  }

  /**
   * INTERNAL — the shared picker flow behind chooseRoot() and
   * changeRoot(): picker (the consent gesture) → validate permission
   * → set new root → persist the handle + mode. Returns a TAGGED
   * result so callers can distinguish CANCELLED from FAILED:
   *   { ok: true,  handle }                   — new root set + persisted.
   *   { ok: false, cancelled: true }          — user closed the picker
   *                                             (state untouched).
   *   { ok: false, cancelled: false, error }  — unsupported / I/O.
   *
   * ⚠️ When the root is REPLACED (changeRoot), the OLD physical folder
   * is NEVER deleted — the app only swaps the handle (the key). The
   * old browser-side grant may persist until the user clears site
   * data (honest note, no scriptable revoke).
   */
  async _choose(mode = ACCESS_MODES.READ) {
    const accessMode = mode === ACCESS_MODES.READWRITE
      ? ACCESS_MODES.READWRITE
      : ACCESS_MODES.READ;
    if (typeof window === 'undefined' || !this.available) {
      this.permission = STORAGE_PERMISSIONS.UNSUPPORTED;
      this._notify();
      return { ok: false, cancelled: false, error: 'unsupported' };
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: accessMode });
      this.root = handle;
      this.mode = accessMode;
      // The picker gesture just granted consent — resolve the TRUE
      // permission state WITHIN the gesture (queryPermission alone can
      // still read 'prompt' in some Chromium builds until request is
      // invoked), then persist the key.
      this.permission = await requestHandlePermission(handle, accessMode);
      this.lastValidated = Date.now();
      await saveHandle(handle, USER_ROOT_HANDLE_KEY);
      // Persist the granted mode next to the handle — the next boot
      // must restore the SAME mode (readwrite stays readwrite).
      try { await handlesStore.set(USER_ROOT_MODE_KEY, accessMode); } catch (_) {}
      this.error = null;
      this._notify();
      return { ok: true, handle };
    } catch (err) {
      // AbortError = the user closed the picker — not an error; also
      // clear any stale error from a previous failed attempt.
      if (err?.name === 'AbortError') {
        this.error = null;
        return { ok: false, cancelled: true, error: null };
      }
      this.error = err?.message || 'choose folder failed';
      this._notify();
      return { ok: false, cancelled: false, error: this.error };
    }
  }

  /**
   * PUBLIC — CONNECT the root folder (the final "Connect Storage"
   * flow): feature → picker (the consent gesture) → store handle →
   * validate permission (INSIDE the gesture) → register root →
   * persist handle + mode (DB devrose-handles) → "Storage connected"
   * (state updated + notified).
   *
   * MINIMUM-ACCESS: ``mode`` defaults to READ. Call with
   * ACCESS_MODES.READWRITE only when the connecting feature genuinely
   * needs to write (e.g. "Connect storage" from the Export flow).
   * Browse-only features connect read-only — the user can always
   * upgrade later via requestWriteAccess() on an explicit action.
   *
   * Returns an HONEST result (permission/mode in BOTH branches — the
   * UI can render the connect state straight from it, and can tell
   * CONNECTED from CANCELLED from FAILED; a bare null could not):
   *   { ok: true,  action: 'connected', cancelled: false, error: null,
   *     rootName, permission, mode }
   *   { ok: false, action: 'connected', cancelled, error,
   *     rootName: <current or null>, permission, mode }
   * `action: 'connected'` lets the UI explain the outcome (the same
   * pattern as changeRoot → action: 'changed').
   */
  async chooseRoot(mode = ACCESS_MODES.READ) {
    const res = await this._choose(mode);
    if (!res.ok) {
      return {
        ok: false,
        action: 'connected',
        cancelled: res.cancelled === true,
        error: res.error || null,
        rootName: this.root?.name || null,
        permission: this.permission,
        mode: this.mode,
      };
    }
    return {
      ok: true,
      action: 'connected',
      cancelled: false,
      error: null,
      rootName: res.handle.name,
      permission: this.permission,
      mode: this.mode,
    };
  }

  /**
   * PUBLIC — CHANGE ROOT FOLDER: replace the current root with a NEW
   * one the user picks. Flow: current folder → change → choose new
   * folder → validate permission → set new root → persist new handle.
   *
   * ⚠️ CHANGE ≠ DELETE — the OLD physical folder is NEVER touched: the
   * app only replaces the HANDLE (the key that opened it); the old
   * folder and its files stay exactly where they are. If the user
   * CANCELS the picker, the CURRENT root stays untouched — the change
   * is a no-op (the old handle is never dropped before the new one is
   * chosen).
   *
   * Keeps the CURRENT access mode by default (a readwrite root
   * switched via changeRoot stays readwrite — it never silently
   * downgrades to read).
   *
   * Returns an honest result (permission/mode in BOTH branches — the
   * UI can render the current state straight from the result):
   *   { ok: true,  action: 'changed', previousRootName, rootName,
   *     permission, mode, oldFolderKept: true }
   *   { ok: false, action: 'changed', cancelled, error,
   *     previousRootName, rootName: <unchanged>, permission, mode,
   *     oldFolderKept: true }
   *
   * NOTE: when NO root is currently connected (previousRootName is
   * null), changeRoot behaves like a FIRST connect (choose) — it
   * still opens the picker and reports the new root honestly.
   */
  async changeRoot(mode = this.mode) {
    const previousRootName = this.root?.name || null;
    const res = await this._choose(mode);
    if (!res.ok) {
      return {
        ok: false,
        action: 'changed',
        cancelled: res.cancelled === true,
        error: res.error || null,
        previousRootName,
        rootName: previousRootName,
        permission: this.permission,
        mode: this.mode,
        oldFolderKept: true,
      };
    }
    return {
      ok: true,
      action: 'changed',
      cancelled: false,
      error: null,
      previousRootName,
      rootName: res.handle.name,
      permission: this.permission,
      mode: this.mode,
      // The old physical folder was never deleted — only the handle
      // (the key) was replaced by the new one.
      oldFolderKept: true,
    };
  }

  /**
   * PUBLIC — resolve one of the fixed USER_FOLDERS subfolders under
   * the user's anchor (Root → Atelnyo/ → name), creating it when
   * missing. Returns the directory handle or null (no root / unknown
   * folder name / the browser denied creation).
   */
  async getSubfolder(name) {
    const result = await resolveUserSubfolder(name);
    return result?.ok ? result.dir : null;
  }

  /**
   * PUBLIC — ask the browser to RE-APPROVE access (must be called
   * from a user gesture, e.g. a "Re-apwouve" button — never at boot).
   * Re-approves at the CURRENT mode (stays minimal — a read-only root
   * re-approves read, never silently escalates). Returns the new
   * permission state.
   */
  async reapproveAccess() {
    if (!this.root) return STORAGE_PERMISSIONS.NONE;
    this.permission = await requestHandlePermission(this.root, this.mode);
    this.lastValidated = Date.now();
    if (this.permission === STORAGE_PERMISSIONS.GRANTED) {
      this.error = null;
      // A grant must be durable — re-persist the handle so the next
      // boot restores the folder (a prompt→granted re-approval would
      // otherwise be lost on reload).
      await saveHandle(this.root, USER_ROOT_HANDLE_KEY);
    }
    this._notify();
    return this.permission;
  }

  /**
   * INTERNAL — shared teardown for disconnect() and revokeAccess():
   * forget the active connection (drop the live handle + the
   * persisted key + mode) and reset the session state. Does NOT
   * notify — each public method sets its OWN final permission state
   * (DISCONNECTED / REVOKED) and notifies ONCE, so subscribers never
   * observe an intermediate state flash.
   */
  async _dropConnection() {
    this.root = null;
    this.mode = ACCESS_MODES.READ;
    this.lastValidated = null;
    this.error = null;
    await removeHandle(USER_ROOT_HANDLE_KEY);
    // Drop the persisted mode alongside the dropped handle.
    try { await handlesStore.delete(USER_ROOT_MODE_KEY); } catch (_) {}
  }

  /**
   * PUBLIC — disconnect the root: drop the persisted handle and clear
   * the live state. The app can no longer open the folder.
   *
   * ⚠️ DISCONNECT ≠ DELETE — this NEVER touches the user's physical
   * folder or its files. It only FORGETS THE ACTIVE CONNECTION: the
   * app drops the handle (the KEY that opened the folder); the folder
   * physically stays exactly where it is. Honest note: the
   * browser-side permission grant survives until the user clears the
   * site's storage permissions in browser settings.
   *
   * State: DISCONNECTED (app-initiated disconnect — distinct from
   * 'none' = never connected, and from 'denied' = browser revocation).
   *
   * SEMANTICS (vs revoke): DISCONNECT = Atelnyo STOPS USING the
   * connection — reversible, reconnect anytime. REVOKE = access is no
   * longer TRUSTED/available (stronger). The UI MUST explain this
   * difference to the user.
   *
   * Returns an honest result: { action, handleDropped, folderKept,
   * note } — the caller can confirm the folder was NOT deleted.
   */
  async disconnect() {
    await this._dropConnection();
    this.permission = STORAGE_PERMISSIONS.DISCONNECTED;
    this._notify();
    return {
      // Semantics: DISCONNECT = Atelnyo STOPS USING the connection.
      // Reversible — the user can reconnect (choose the folder again)
      // anytime. The physical folder is never touched. `action` lets
      // the UI explain the DIFFERENCE from revoke access.
      action: 'disconnect',
      handleDropped: true,
      folderKept: true,
      note: 'The app stopped using this connection. The folder was NOT touched — it stays exactly where it is, and you can reconnect anytime.',
    };
  }

  /**
   * PUBLIC — revoke access. STRONGER than disconnect: access is no
   * longer TRUSTED/available, not merely unused. Same as disconnect
   * (drop the handle) + an honest summary of what was and was not
   * revoked (the File System Access API has no scriptable
   * revokePermission — the browser grant persists until the user
   * clears site data).
   *
   * State: REVOKED — the user revoked access AFTER it was granted
   * (the app dropped the handle itself; the browser-side grant may
   * still exist until the user clears site data — surfaced honestly).
   *
   * SEMANTICS (vs disconnect): DISCONNECT = Atelnyo STOPS USING the
   * connection (reversible). REVOKE = permission/access is no longer
   * TRUSTED. The UI MUST explain this difference to the user.
   *
   * Returns: { action: 'revoke', handleDropped, folderKept, note } —
   * same physical guarantee as disconnect (folder NEVER touched).
   */
  async revokeAccess() {
    await this._dropConnection();
    this.permission = STORAGE_PERMISSIONS.REVOKED;
    this._notify();
    return {
      // Semantics: REVOKE is STRONGER than disconnect — access is no
      // longer TRUSTED/available, not merely unused. The app drops the
      // handle (the browser grant itself cannot be scripted away) and
      // marks the state REVOKED. `action` lets the UI explain the
      // DIFFERENCE from disconnect. Same physical guarantee: the
      // folder is NEVER touched. (Honest: neither path PREVENTS the
      // user from reconnecting via chooseRoot() — revoke is a trust
      // semantic the UI honors, not a technical lock.)
      action: 'revoke',
      handleDropped: true,
      folderKept: true,
      note: 'Access is no longer trusted: the app dropped this connection. To FULLY revoke the browser-side grant, clear this site\u2019s storage permissions in your browser settings.',
    };
  }

  /** PUBLIC — is a root folder currently connected? */
  hasRoot() {
    return this.root !== null;
  }

  /**
   * PUBLIC — UPGRADE the root to write access (read → readwrite).
   * MUST be called from a user gesture (e.g. the "Export project"
   * click — never at boot). This is the ONLY way write access is
   * obtained: browse connects read-only, write is granted lazily when
   * an action actually needs it (minimize access). Returns the new
   * permission state ('granted' on success).
   */
  async requestWriteAccess() {
    if (!this.root) return STORAGE_PERMISSIONS.NONE;
    this.permission = await requestHandlePermission(
      this.root,
      HANDLE_MODES.READWRITE,
    );
    this.lastValidated = Date.now();
    if (this.permission === STORAGE_PERMISSIONS.GRANTED) {
      this.mode = ACCESS_MODES.READWRITE;
      this.error = null;
      // A grant must be durable — re-persist the handle AND the mode
      // so the next boot restores the folder with the upgraded grant.
      await saveHandle(this.root, USER_ROOT_HANDLE_KEY);
      try { await handlesStore.set(USER_ROOT_MODE_KEY, ACCESS_MODES.READWRITE); } catch (_) {}
    }
    this._notify();
    return this.permission;
  }

  /** PUBLIC — does THIS browser support the user-selected root? */
  isAvailable() {
    return this.available === true;
  }

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /** Current immutable-ish snapshot for consumers. */
  getState() {
    return {
      // True once the STARTUP RESTORE completed (handle found /
      // nothing to restore / restore failed) — "the sequence ran",
      // NOT "a root is connected". See rootFolderConnected.
      ready: this.ready === true,
      // Does this browser support File System Access directory pickers?
      available: this.available === true,
      // Is a root folder connected right now? (canonical name —
      // ``connected`` kept below as a legacy alias).
      rootFolderConnected: this.root !== null,
      // The root folder's display name (null when disconnected).
      rootName: this.root?.name || null,
      // 'granted' | 'prompt' | 'denied' | 'revoked' | 'disconnected' |
      // 'unsupported' | 'none' (canonical name — ``permission`` kept
      // below as a legacy alias).
      permissionState: this.permission,
      // Is the connected root ACTUALLY accessible right now? The
      // permission grant can read 'granted' while the folder was
      // deleted/moved on disk — this probe tells the truth.
      // true | false | null (not connected / never probed).
      accessible: this.accessible,
      // The UI-facing COMBINED fact (permission × accessibility):
      // 'healthy' | 'inaccessible' | 'needs-approval' | 'revoked' |
      // 'disconnected' | 'none' | 'unsupported'. The UI shows
      // "Connected ✓" ONLY when this is 'healthy' — a granted
      // permission with a GONE folder never renders as connected.
      rootStatus: _deriveStatus(this.permission, this.accessible),
      // The access mode granted for this root: 'read' | 'readwrite'
      // (MINIMUM-ACCESS — browse connects read-only; write is granted
      // lazily via requestWriteAccess()).
      accessMode: this.mode,
      // Epoch ms of the last permission validation (null = never).
      lastValidated: this.lastValidated,
      // Last error message (null when clean).
      error: this.error || null,
      // The fixed subfolder layout maintained under the root.
      subfolders: Object.values(USER_FOLDERS),
      // ── Legacy aliases (byte-compat for existing consumers) ──────
      connected: this.root !== null,
      permission: this.permission,
    };
  }

  /**
   * PUBLIC — FULL TEARDOWN (tests / HMR): release all subscribers and
   * reset to the honest pre-init state. After destroy(), ``init()``
   * re-wires everything. Idempotent. Does NOT drop the persisted
   * handle — teardown is not the same as disconnect().
   */
  destroy() {
    if (this._onVisibility) {
      document.removeEventListener('visibilitychange', this._onVisibility);
      this._onVisibility = null;
    }
    this.available = false;
    this.root = null;
    this.permission = STORAGE_PERMISSIONS.NONE;
    this.accessible = null;
    this.mode = ACCESS_MODES.READ;
    this.lastValidated = null;
    this.error = null;
    this.ready = false;
    this._inited = false;
    this._listeners.clear();
    return this;
  }

  _notify() {
    this._listeners.forEach((fn) => {
      try {
        fn(this.getState());
      } catch (_) { /* a bad listener must not break the machine */ }
    });
  }
}

/** Process-wide singleton. init() runs at import on the client. */
export const rootFolderManager = new RootFolderManager();
if (typeof window !== 'undefined') {
  rootFolderManager.init();
}

/**
 * INTERNAL (storage subsystem only) — the live FileSystemDirectoryHandle.
 * ⚠️ There is NO getRootHandle on the RootFolderManager class itself:
 * the raw handle is deliberately NOT a public method of the singleton
 * (a component importing rootFolderManager can never reach it). Only
 * this module-level export (imported by StorageManager.js — the
 * boundary owner) can obtain the key. Faz B.2 fileOperations will
 * receive handles through Storage Manager methods only.
 */
export function getRootHandle() {
  return rootFolderManager.hasRoot() ? rootFolderManager.root : null;
}

/**
 * INTERNAL (storage subsystem only) — resolve a fixed subfolder under
 * the user's ANCHOR (Root → Atelnyo/ → name). Read-first, then
 * create:
 *   1. Resolve WITHOUT create — works with READ permission when the
 *      structure already exists (browse workflows on a read-only
 *      root).
 *   2. If missing (NotFoundError) — resolve WITH create — requires
 *      WRITE permission; if the browser denies it, return an honest
 *      tagged error. Atelnyo NEVER assumes it may create or modify
 *      anything — the browser permission is the source of truth.
 *
 * Returns a TAGGED result so callers can tell the difference between
 * "folder doesn't exist" and "the browser denied creation":
 *   { ok: true, dir }                 — subfolder ready.
 *   { ok: false, error: 'no-root' }   — no root connected.
 *   { ok: false, error: 'unknown-folder' } — name outside USER_FOLDERS.
 *   { ok: false, error: 'permission-denied' } — browser refused access
 *                                                during resolution.
 *   { ok: false, error: 'missing-folder' } — structure absent AND the
 *                                             browser denied creating it
 *                                             (read-only root; the UI
 *                                             should offer write access).
 */
export async function resolveUserSubfolder(name) {
  const root = rootFolderManager.hasRoot() ? rootFolderManager.root : null;
  if (!root) return { ok: false, error: 'no-root' };
  if (!Object.values(USER_FOLDERS).includes(name)) {
    return { ok: false, error: 'unknown-folder' };
  }
  try {
    // 1. Read-only resolve of the anchor + subfolder (no create).
    const anchor = await root.getDirectoryHandle(USER_ANCHOR_FOLDER);
    const dir = await anchor.getDirectoryHandle(name);
    return { ok: true, dir };
  } catch (err) {
    if (err?.name !== 'NotFoundError') {
      // Refused at READ on an existing structure (edge — the gate
      // already passed) or an I/O failure — map permission honestly.
      const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
      return { ok: false, error: denied ? 'permission-denied' : 'resolve-failed' };
    }
    // 2. Structure missing → create the anchor + subfolder (WRITE).
    try {
      const anchor = await root.getDirectoryHandle(USER_ANCHOR_FOLDER, { create: true });
      const dir = await anchor.getDirectoryHandle(name, { create: true });
      return { ok: true, dir };
    } catch (_) {
      // The browser denied creation under the current grant — the
      // structure does not exist and the app may not create it.
      return { ok: false, error: 'missing-folder' };
    }
  }
}

/**
 * INTERNAL (storage subsystem only) — resolve a CATEGORY folder under
 * the user's anchor: Atelnyo/<folder>/<Category>/, for any folder
 * that carries categories (Media/ Documents/ — see categoriesFor).
 * Same tagged read-first-then-create contract as resolveUserSubfolder.
 *
 * Returns:
 *   { ok: true, dir }                 — category folder ready.
 *   { ok: false, error: 'no-root' }   — no root connected.
 *   { ok: false, error: 'unknown-folder' } — folder carries no categories.
 *   { ok: false, error: 'unknown-category' } — name outside the folder's
 *                                               category set.
 *   { ok: false, error: 'permission-denied' } — browser refused access.
 *   { ok: false, error: 'missing-folder' } — <folder>/ absent AND denied
 *                                             creation (read-only root;
 *                                             the UI should offer write).
 */
export async function resolveCategoryFolder(folder, category) {
  const root = rootFolderManager.hasRoot() ? rootFolderManager.root : null;
  if (!root) return { ok: false, error: 'no-root' };
  const cats = categoriesFor(folder);
  if (!cats) return { ok: false, error: 'unknown-folder' };
  if (!Object.values(cats).includes(category)) {
    return { ok: false, error: 'unknown-category' };
  }
  // Resolve Atelnyo/<folder>/ first (reuses the fixed-layout resolution).
  const parent = await resolveUserSubfolder(folder);
  if (!parent.ok) return parent;
  try {
    // 1. Read-only resolve of the category folder (no create).
    const dir = await parent.dir.getDirectoryHandle(category);
    return { ok: true, dir };
  } catch (err) {
    if (err?.name !== 'NotFoundError') {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
      return { ok: false, error: denied ? 'permission-denied' : 'resolve-failed' };
    }
    // 2. Category missing → create it (WRITE).
    try {
      const dir = await parent.dir.getDirectoryHandle(category, { create: true });
      return { ok: true, dir };
    } catch (_) {
      return { ok: false, error: 'missing-folder' };
    }
  }
}

export default rootFolderManager;
