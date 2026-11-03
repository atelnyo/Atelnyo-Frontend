/**
 * src/modules/explore/utils/feedScroll.js
 *
 * Phase 5 — position preservation for the Latest list.
 *
 * Contract: every rendered row carries `data-feed-key="<stable key>"`
 * where the key comes from `latestKey()` (never the array index).
 *
 * Pill-apply flow (new items prepended above the viewport):
 *   1. `isAtTop(container)` — user already at the top? Apply directly,
 *      no compensation needed.
 *   2. Otherwise `captureAnchor(container)` BEFORE applying: remembers the
 *      first visible row's key + its distance from the viewport top.
 *   3. `restoreAnchor(container, anchor)` AFTER the prepend renders:
 *      shifts `scrollTop` by the same delta the anchored row moved, so
 *      the row the user was reading stays exactly where it was.
 *
 * Manual refresh is user-initiated: the component scrolls to top on
 * success (via the promise `refresh()` returns) instead of anchoring.
 * Rows are never removed or reordered by the feed itself — only
 * prepended (explicit tap) or appended (scroll) — so a captured anchor
 * always still exists at restore time; a missing row is a safe no-op.
 */

export const FEED_KEY_ATTR = 'data-feed-key';
export const AT_TOP_THRESHOLD_PX = 48;

function rowKey(row) {
  if (!row) return null;
  if (typeof row.getAttribute === 'function') {
    const fromAttr = row.getAttribute(FEED_KEY_ATTR);
    if (fromAttr) return fromAttr;
  }
  if (row.dataset && row.dataset.feedKey) return row.dataset.feedKey;
  return row.key || null;
}

function rowTop(row) {
  if (!row) return 0;
  const top = typeof row.offsetTop === 'number' ? row.offsetTop : 0;
  return Number.isFinite(top) ? top : 0;
}

function scrollOf(container) {
  if (!container) return 0;
  const top = typeof container.scrollTop === 'number' ? container.scrollTop : 0;
  return Number.isFinite(top) ? top : 0;
}

function keyedRows(container) {
  if (!container || typeof container.querySelectorAll !== 'function') return [];
  let list;
  try {
    list = container.querySelectorAll(`[${FEED_KEY_ATTR}]`);
  } catch {
    return [];
  }
  return Array.isArray(list) ? list : Array.from(list || []);
}

/**
 * True when the list is scrolled to (or near) the top — or when there is
 * no measurable container (first paint, tests): direct apply is safe.
 */
export function isAtTop(container, thresholdPx = AT_TOP_THRESHOLD_PX) {
  if (!container) return true;
  return scrollOf(container) <= thresholdPx;
}

/**
 * Remember the first row at/below the viewport top. Falls back to the
 * first keyed row when none qualifies (short list). Null when the list
 * has no keyed rows — the caller then applies without compensation.
 */
export function captureAnchor(container) {
  const rows = keyedRows(container);
  if (!rows.length) return null;
  const top = scrollOf(container);
  let anchorRow = null;
  for (const row of rows) {
    const key = rowKey(row);
    if (!key) continue;
    if (!anchorRow) anchorRow = { row, key };
    if (rowTop(row) >= top) {
      anchorRow = { row, key };
      break;
    }
  }
  if (!anchorRow) return null;
  return { key: anchorRow.key, delta: rowTop(anchorRow.row) - top };
}

/**
 * Re-anchor after a prepend: move `scrollTop` by exactly the distance the
 * anchored row shifted down, so it stays pixel-stable. No-op when the
 * anchor (or its row) is gone — never throw out of scroll bookkeeping.
 */
export function restoreAnchor(container, anchor) {
  if (!container || !anchor || !anchor.key) return false;
  const rows = keyedRows(container);
  const row = rows.find((candidate) => rowKey(candidate) === anchor.key);
  if (!row) return false;
  try {
    container.scrollTop = rowTop(row) - (anchor.delta || 0);
  } catch {
    return false;
  }
  return true;
}
