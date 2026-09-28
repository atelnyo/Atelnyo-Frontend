/**
 * src/hooks/useSavedItem.js
 *
 * Shared heart/save toggle for every detail page that has NO
 * dedicated per-type save table — product, job, spotlight, event,
 * portfolio, course all bookmark through the ONE generic
 * ``/api/explore/saved/items/`` endpoint (the backend's SavedItem
 * model). Mirrors the MusicSheet / TalentSheet save logic (which
 * use the dedicated SavedMusic / SavedTalent endpoints) so the six
 * pages share a single implementation instead of six copies.
 *
 * Returns ``{ isSaved, saveCount, saveBusy, handleToggleSave }`` —
 * ``saveCount`` is the item's TOTAL saves across all users (the
 * badge on the heart button), null until loaded.
 *
 *
 * @param {string} type  one of SavedItem.ITEM_TYPE_* (product, job,
 *   spotlight, event, portfolio, course)
 * @param {number|string|undefined} id  the catalog row's id
 * @param {{ user?: object|null, showToast?: function, t?: object }} opts
 */
import { useCallback, useEffect, useState } from 'react';
import { savedItemService } from '../services/api';

export default function useSavedItem(type, id, { user, showToast, t } = {}) {
  const [isSaved, setIsSaved] = useState(false);
  const [saveCount, setSaveCount] = useState(null);
  const [saveBusy, setSaveBusy] = useState(false);

  // Initial state — the count badge is PUBLIC (anonymous visitors
  // see it too); the heart fill only for a signed-in visitor.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    savedItemService.count(type, id)
      .then((c) => { if (!cancelled) setSaveCount(c); })
      .catch(() => {});
    if (user) {
      savedItemService.isSaved(type, id)
        .then((saved) => { if (!cancelled) setIsSaved(saved); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [user, type, id]);

  const handleToggleSave = useCallback(async () => {
    if (!user) {
      showToast?.(t?.mwen_signin_required || 'Sign in to save', 'user-lock');
      return;
    }
    if (saveBusy || !id) return;
    setSaveBusy(true);
    const wasSaved = isSaved;
    setIsSaved(!wasSaved);
    // Optimistic badge update (+1 saving / -1 unsaving).
    setSaveCount((c) => (c == null ? c : Math.max(0, c + (wasSaved ? -1 : 1))));
    try {
      if (wasSaved) await savedItemService.remove(type, id);
      else await savedItemService.create(type, id);
      // Re-sync the badge with the authoritative count — closes the
      // race where the initial count fetch resolves AFTER a fast
      // toggle with a stale (pre-toggle) value.
      savedItemService.count(type, id)
        .then((c) => setSaveCount(c))
        .catch(() => {});
    } catch (e) {
      setIsSaved(wasSaved);
      setSaveCount((c) => (c == null ? c : Math.max(0, c + (wasSaved ? 1 : -1))));
      showToast?.(t?.mwen_unsave_error || 'Could not save. Try again.', 'circle-exclamation');
    } finally {
      setSaveBusy(false);
    }
  }, [isSaved, saveBusy, type, id, user, showToast, t]);

  return { isSaved, saveCount, saveBusy, handleToggleSave };
}
