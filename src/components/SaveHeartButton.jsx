/**
 * src/components/SaveHeartButton.jsx
 *
 * The heart (save) action shared by every detail-page header —
 * ProductDetail, SpotlightDetail, JobSheet, CourseDetail,
 * PortfolioDetail, the event page, MusicSheet and TalentSheet.
 *
 * Renders the toggle heart PLUS a small count badge (the item's
 * TOTAL saves across all users, from the public
 * ``/api/explore/saved/items/count/`` endpoint). The badge hides
 * until the count is loaded and stays hidden at 0.
 *
 * The button class + saved-color differ per page (cd/pd/sheet
 * design systems), so both are props.
 *
 * @param {string}  className  the page's header-action class
 *   (e.g. 'cd-header-action-btn', 'pd-header-action-btn', 'sheet-share-btn')
 * @param {string}  savedColor CSS color for the filled heart
 * @param {boolean} isSaved    current save state (from useSavedItem)
 * @param {boolean} saveBusy   disable while a toggle is in flight
 * @param {number|null} saveCount total saves; null = not loaded yet
 * @param {Function} onToggle  handleToggleSave from useSavedItem
 * @param {object}  t          translations dict (mwen_save / mwen_unsave)
 */
import React from 'react';

export default function SaveHeartButton({
  className = 'cd-header-action-btn',
  savedColor = 'var(--cd-primary, #2563eb)',
  isSaved = false,
  saveBusy = false,
  saveCount = null,
  onToggle,
  t = {},
  disabled = false,
}) {
  const label = isSaved ? (t.mwen_unsave || 'Remove') : (t.mwen_save || 'Save');
  return (
    <button
      type="button"
      className={`${className} save-btn-with-count`}
      onClick={onToggle}
      disabled={saveBusy || disabled}
      aria-pressed={isSaved}
      aria-label={label}
      title={label}
      style={{ color: isSaved ? savedColor : undefined }}
    >
      <i className={isSaved ? 'fas fa-heart' : 'far fa-heart'} aria-hidden="true" />
      {saveCount != null && saveCount > 0 && (
        <span className="save-count-badge" aria-hidden="true">
          {saveCount > 999 ? '999+' : saveCount}
        </span>
      )}
    </button>
  );
}
