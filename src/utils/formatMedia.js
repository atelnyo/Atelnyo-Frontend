/**
 * src/utils/formatMedia.js — Shared formatters for media display.
 *
 * Several panels (MediaGeneralPanel, MediaValidationPanel) used to
 * inline their own fmtFileSize/fmtDuration helpers. Centralising here
 * keeps the formatting consistent and lets new panels pick up new
 * formats (KB/MB/GB vs IEC, etc) in one place.
 */

/** Format a byte count as B / KB / MB / GB with 1-2 decimals. */
export function fmtFileSize(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return '—';
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

/** Format a duration in seconds as MM:SS or H:MM:SS for > 1 hour. */
export function fmtDuration(seconds) {
  if (seconds == null || seconds <= 0) return '—';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Format a numeric count with thousands separators; fallback to "—". */
export function fmtCount(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString();
}

/** Format ISO 8601 timestamp; "—" if missing/invalid. */
export function fmtDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/**
 * Human label for a premium plan key, localized (ht vs other).
 * Returns the raw key when unknown so callers never crash.
 */
export function premiumPlanLabel(plan, lang) {
  if (plan === 'lifetime') return lang === 'ht' ? 'Pou tout vi' : 'Lifetime';
  if (plan === 'monthly') return lang === 'ht' ? 'Mensyèl' : 'Monthly';
  if (plan === 'quarterly') return lang === 'ht' ? 'Trimès' : 'Quarterly';
  if (plan === 'yearly') return lang === 'ht' ? 'Anyèl' : 'Yearly';
  return plan;
}
