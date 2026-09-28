// ─── src/components/CommandPalette.jsx ───────────────────────────────
//
// Phase 49 §11.8 — Cmd-K Studio Palette overlay.
//
// Glassmorphic Spotlight-style modal accessible via Cmd-Shift-K OR `/`
// (slash; GitHub-style). Hosts an action registry filter, a recents
// rail, and full keyboard navigation. Theme-aware via the existing
// ``--card-bg`` / ``--pink-primary`` / ``--text-main`` CSS variables so
// the 8-app-themes each carry the palette in their own accent.
//
// Why a SECOND Cmd-K overlay (different from the existing Global
// Search overlay which already uses Cmd-K):
//   • The project already binds ``Cmd-K`` to a content-search modal
//     (see ``.global-search-overlay`` in ``src/styles/index.css``).
//     We **DO NOT** want to fight that keybinding — coexistence is
//     cheaper than rebuild. So:
//
//       Cmd-K        →  existing Global Search overlay (behaviourally
//                       unchanged).
//       Cmd-Shift-K  →  this Command Palette.
//       /            →  this Command Palette (when no input focused,
//                       like GitHub's slash search).
//
//   The two surfaces look similar on purpose: a single visual
//   language for "every keystroke-driven overlay in Atelnyo lives in
//   this family." Future surfaces (e.g. an Activity timeline palette
//   or a Community picker) can ship with the same shell.
//
// Why inline <style> instead of :root classes in ``index.css``:
//   • The styling is deeply tied to a single component's lifecycle.
//     Spreading ~180 lines of cmd-palette- selectors into
//     ``index.css`` (which is already 127KB+) duplicates surface
//     ownership boundary: if you delete this file, the orphan CSS
//     stays forever. The inline <style> walks away with the JSX.
//   • React 18 efficiently diffs a constant string <style> — no
//     double-injection risk, no HMR-ish re-evaluation cost.
//
// i18n: pulls every visible string from the language dict via the
// ``t.palette_*`` keys added in ``src/data/translations.js``. Falls
// back to inline English literals if a key is missing so a partial
// rollout never blanks out the palette.
//
// Keyboard:
//   • ↓ / ↑    move selection (clamps to bounds).
//   • Enter    execute the highlighted command, persist it to recent.
//   • Esc      close the palette (palette does NOT auto-reopen; the
//               user invoked it intentionally and the dismiss is a
//               confirmed intent).
//   • typing into input filters live (no debounce — the dataset is
//     <20 commands so the matcher is sub-millisecond).
//
// Recent commands (last 5, MRU order): the registry's ``id`` is what
// the localStorage key references; the user's top-5 most-recent
// commands surface at the top of the empty-query list so the
// 80%-of-the-time user (navigating to the same 2-3 sheets over and
// over) gets to them in 1 keystroke.
// ─────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { buildCommands } from '../data/commands';

const RECENT_KEY = 'atelnyo_cmd_recent';
const RECENT_MAX = 5;

/**
 * Fuzzy-match ``query`` against a single candidate string. The score
 * is intentionally coarse — this is a 15-entry dataset, not a 5k
 * GitHub-scale fuzzy engine, so a 4-tier ladder is plenty.
 *
 *   1000  exact match
 *    500  prefix match
 *    250  substring match
 *    100-  consecutive-char match (penalty = distance between
 *           first-of-each / candidate-length-gaps)
 *     -1  no overlap
 *
 * @param {string} query      The user's live input (lower-cased).
 * @param {string} candidate  A label-or-keyword string to test.
 * @returns {number}         Non-negative score; -1 if no match.
 */
function fuzzyScore(query, candidate) {
  const q = (query || '').toLowerCase().trim();
  const c = String(candidate || '').toLowerCase().trim();
  if (!q) return 50; /* empty query → neutral baseline (visible but not blazing). */
  if (c === q) return 1000;
  if (c.startsWith(q)) return 500;
  if (c.includes(q)) return 250;
  /* Consecutive-char walk. Best-case: matches every char in q. */
  let qi = 0;
  for (let i = 0; i < c.length && qi < q.length; i++) {
    if (c[i] === q[qi]) qi++;
  }
  if (qi !== q.length) return -1;
  /* Penalty rises with gaps in the candidate so a match at index 0
     scores better than a match scattered across the string. */
  return Math.max(1, 100 - Math.floor((c.length - q.length) / 2));
}

/**
 * Compute the highest fuzzy score across a command's label + its
 * cross-language keywords. Returns -1 if NO candidate matches.
 */
function scoreCommand(query, cmd, t) {
  const labelStr = cmd.label ? cmd.label(t) : cmd.id;
  const keywordList = Array.isArray(cmd.keywords) ? cmd.keywords : [];
  const candidates = [labelStr, ...keywordList].filter(Boolean);
  let best = -1;
  for (const c of candidates) {
    const s = fuzzyScore(query, c);
    if (s > best) best = s;
  }
  return best;
}

/**
 * Read and parse the ``recents`` array from localStorage. Defensive
 * on three fronts: storage disabled (private mode), corrupt JSON,
 * stale schema. Returns [] on any failure so the palette degrades
 * gracefully.
 */
function readRecents() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    /* Each entry must look like { id: string, ts: number } */
    return parsed
      .filter(e => e && typeof e.id === 'string')
      .slice(0, RECENT_MAX);
  } catch (_) {
    return [];
  }
}

/**
 * Cmd-K Studio Palette — the overlay component. Mounted once at App
 * root as a sibling of the toasts/chrome so it floats above every
 * other surface (z-5500).
 */
export default function CommandPalette({
  isOpen,
  onClose,
  lang,
  translations,
  setActiveTab,
  navigateRR,
  toggleTheme,
  handleLangChange,
  showToast,
}) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [recents, setRecents] = useState(() => readRecents());
  const inputRef = useRef(null);
  const listContainerRef = useRef(null);
  const t = translations[lang] || translations['ht'] || {};

  /* Build the registry on each render. useMemo keys on the *function*
     identities of the bindings so a binding change rebuilds once,
     not per-render. The factory itself is tiny (~20 commands). */
  const commands = useMemo(
    () => buildCommands({ setActiveTab, navigateRR, toggleTheme, handleLangChange, showToast }),
    [setActiveTab, navigateRR, toggleTheme, handleLangChange, showToast],
  );

  /* Reset transient state on every palette-open. The recents are
     re-read each time so a recents update from a previous session
     is reflected (rare but possible if the user opened the palette,
     closed it, ran a command via another binding, and re-opened). */
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setSelectedIdx(0);
    setRecents(readRecents());
    /* 50ms delay gives the dialog mount a frame so focus lands on the
       now-mounted input rather than racing the React commit. */
    const focusTimer = setTimeout(() => {
      try { inputRef.current && inputRef.current.focus(); } catch (_) {}
    }, 50);
    return () => clearTimeout(focusTimer);
  }, [isOpen]);

  /* Filter + sort the registry by query. When the input is empty we
     short-circuit to the natural registry order so the user sees
     every command in its author-intended section order. */
  const filtered = useMemo(() => {
    if (!query.trim()) {
      return commands.map(cmd => ({ cmd, score: -1, isRecentMatch: false }));
    }
    const ranked = commands
      .map(cmd => ({ cmd, score: scoreCommand(query, cmd, t) }))
      .filter(x => x.score > 0);
    ranked.sort((a, b) => b.score - a.score);
    return ranked;
  }, [query, commands, t]);

  /* Clamp selection when the filtered set shrinks. useEffect keeps
     this purely a side-effect so it doesn't trigger in render. */
  useEffect(() => {
    if (selectedIdx >= filtered.length) {
      setSelectedIdx(Math.max(0, filtered.length - 1));
    }
  }, [filtered, selectedIdx]);

  /* Persist + execute a command. Closes the palette in all cases (the
     user wrapped their task here; staying open would steal focus). */
  const executeCommand = useCallback((cmd) => {
    try { cmd.action && cmd.action(); } catch (e) { /* never let a buggy action crash the palette */ }
    const newRecent = [
      { id: cmd.id, ts: Date.now() },
      ...recents.filter(r => r.id !== cmd.id),
    ].slice(0, RECENT_MAX);
    setRecents(newRecent);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(newRecent));
      }
    } catch (_) { /* private-mode browsers may throw; non-fatal */ }
    onClose();
  }, [recents, onClose]);

  /* Global keyboard handler mounted only while the palette is open.
     The harness captures the event BEFORE any react-subtree listener
     so a fast typing user doesn't have a frame where their Enter
     triggers the parent route's <kbd> shortcut (e.g. Cmd-K → global
     search). */
  useEffect(() => {
    if (!isOpen) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx(i => Math.max(0, Math.min(filtered.length - 1, i + 1)));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx(i => Math.max(0, i - 1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const sel = filtered[selectedIdx];
        if (sel) executeCommand(sel.cmd);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isOpen, filtered, selectedIdx, executeCommand, onClose]);

  /* Auto-scroll the highlighted row into view as the user navigates
     with keys. The browser's scrollIntoView is enough — we don't
     need a custom scroll-calculation loop. */
  useEffect(() => {
    if (!isOpen || !listContainerRef.current) return;
    const el = listContainerRef.current.querySelector('.cmd-palette-item.is-active');
    if (el && typeof el.scrollIntoView === 'function') {
      try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) {}
    }
  }, [isOpen, selectedIdx]);

  /* Slice the filtered set into the 3 visible sections + an optional
     Recent rail (only when the query is empty AND the user has at
     least one recent). Recents that no longer exist in the registry
     (e.g. an old id) are dropped at read-time so the rail never
     shows a stale entry. */
  const recentsToShow = useMemo(() => {
    if (query.trim()) return [];
    if (recents.length === 0) return [];
    return recents
      .map(r => commands.find(c => c.id === r.id))
      .filter(Boolean)
      .map(cmd => ({ cmd, score: -1 }));
  }, [recents, commands, query]);

  const renderSection = (title, items, startIdx) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="cmd-palette-section" key={title}>
        <div className="cmd-palette-section-title">{title}</div>
        {items.map((it, i) => {
          /* Compute the flat index the keyboard nav expects per row. */
          const absoluteIdx = startIdx + i;
          const isActive = absoluteIdx === selectedIdx;
          return (
            <div
              key={it.cmd.id}
              className={`cmd-palette-item${isActive ? ' is-active' : ''}`}
              role="option"
              aria-selected={isActive}
              onMouseEnter={() => setSelectedIdx(absoluteIdx)}
              onClick={() => executeCommand(it.cmd)}
            >
              <i className={`fas ${it.cmd.icon}`} aria-hidden="true" />
              <div className="cmd-palette-item-label">{it.cmd.label(t)}</div>
              <div className="cmd-palette-item-hint">{it.cmd.hint(t)}</div>
            </div>
          );
        })}
      </div>
    );
  };

  /* Pre-compute the flat start-index per section so the keyboard
     mapper's absoluteIdx math stays correct across section boundaries. */
  let runningIdx = 0;
  const buildOffset = (items) => {
    const start = runningIdx;
    runningIdx += (items?.length || 0);
    return start;
  };
  const navStart = buildOffset(filtered.filter(x => x.cmd.category === 'navigation'));
  const sheetStart = buildOffset(filtered.filter(x => x.cmd.category === 'sheet'));
  const actionStart = buildOffset(filtered.filter(x => x.cmd.category === 'action'));
  const recentStart = buildOffset(recentsToShow);

  if (!isOpen) return null;

  /* Translate the no-results placeholder. We do the {query} swap
     inline because the dict can't supply per-query strings without
     breaking the cache shape. Wrapping quotes preserves multi-word
     queries. */
  const noResultsMsg = (t.palette_no_results || 'No commands match "{query}"')
    .replace('{query}', query);

  /* Footer hint strings (small so we keep them inline). The escape
     hatches keep the footer responsive even if a later rollout omits
     the dict entries. */
  const hintNavigate = t.explore_search_nav || 'navigate';
  const hintSelect = t.common_send || 'select';

  return (
    <>
      <style>{CMD_PALETTE_STYLES}</style>
      <div
        className="cmd-palette-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={t.palette_placeholder || 'Command palette'}
        onClick={(e) => {
          /* Click-outside (on the overlay itself, not on the modal) closes. */
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="cmd-palette-modal" role="presentation">
          <div className="cmd-palette-input-wrap">
            <i className="fas fa-bolt cmd-palette-input-icon" aria-hidden="true" />
            <input
              ref={inputRef}
              className="cmd-palette-input"
              type="text"
              placeholder={t.palette_placeholder || 'Type a command…'}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck="false"
              aria-label={t.palette_placeholder || 'Command'}
            />
            {query && (
              <button
                type="button"
                className="cmd-palette-clear"
                aria-label={t.common_close || 'Clear'}
                onClick={() => { setQuery(''); setSelectedIdx(0); try { inputRef.current && inputRef.current.focus(); } catch (_) {} }}
              >
                <i className="fas fa-times" aria-hidden="true" />
              </button>
            )}
            {!query && (
              <span className="cmd-palette-kbd" aria-hidden="true">Esc</span>
            )}
          </div>

          <div className="cmd-palette-results" ref={listContainerRef} role="listbox">
            {(!query && recentsToShow.length > 0) && renderSection(
              t.palette_section_recent || 'Recent',
              recentsToShow,
              recentStart,
            )}
            {renderSection(
              t.palette_section_navigation || 'Navigation',
              filtered.filter(x => x.cmd.category === 'navigation'),
              navStart,
            )}
            {renderSection(
              t.palette_section_sheets || 'Sheets',
              filtered.filter(x => x.cmd.category === 'sheet'),
              sheetStart,
            )}
            {renderSection(
              t.palette_section_actions || 'Actions',
              filtered.filter(x => x.cmd.category === 'action'),
              actionStart,
            )}
            {filtered.length === 0 && query && (
              <div className="cmd-palette-empty">
                <i className="fas fa-search" aria-hidden="true" />
                <p>{noResultsMsg}</p>
              </div>
            )}
          </div>

          <div className="cmd-palette-footer" aria-hidden="true">
            <span className="cmd-palette-footer-pair">
              <span className="cmd-palette-kbd">↑</span>
              <span className="cmd-palette-kbd">↓</span>
              <span className="cmd-palette-footer-text">{hintNavigate}</span>
            </span>
            <span className="cmd-palette-footer-pair">
              <span className="cmd-palette-kbd">↵</span>
              <span className="cmd-palette-footer-text">{hintSelect}</span>
            </span>
            <span className="cmd-palette-footer-pair">
              <span className="cmd-palette-kbd">/</span>
              <span className="cmd-palette-footer-text">palette</span>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

// Inline stylesheet. Module-scoped via the ``cmd-palette-*`` class
// prefix so the namespace cannot collide with any neighbour surface
// (the global-search overlay uses ``global-search-`` so the two
// coexist without the chance of cross-contamination).
//
// z-index 5500 sits between:
//   • the global-search overlay (z-6000, mounts on Cmd-K — no
//     conflict because this palette mounts on Cmd-Shift-K + /).
//   • the BottomNavBar (z-2500) — palette floats above the bar when
//     open so the bar doesn't poke through the overlay's backdrop.
//   • the Wizard (z-3000) — palette above the wizard's backdrop so a
//     user mid-enrollment can still poke through to the palette
//     (rare, intentional).
const CMD_PALETTE_STYLES = `
.cmd-palette-overlay {
  position: fixed;
  inset: 0;
  z-index: 5500;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
  animation: cmd-palette-overlay-in 0.18s ease-out;
}
@keyframes cmd-palette-overlay-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.cmd-palette-modal {
  width: 100%;
  max-width: 640px;
  max-height: 75vh;
  background: var(--card-bg, #fff);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: cmd-palette-modal-rise 0.22s cubic-bezier(0.22, 1, 0.36, 1);
  border: 1px solid rgba(216, 27, 96, 0.18);
}
@keyframes cmd-palette-modal-rise {
  from { opacity: 0; transform: translateY(14px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.cmd-palette-input-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color, rgba(216, 27, 96, 0.1));
}
.cmd-palette-input-icon {
  color: var(--pink-primary, #d81b60);
  font-size: 1rem;
  flex-shrink: 0;
}
.cmd-palette-input {
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 1.05rem;
  color: var(--text-main, #222);
  min-width: 0;
  font-family: inherit;
}
.cmd-palette-input::placeholder {
  color: var(--text-secondary, #888);
}
.cmd-palette-clear {
  background: transparent;
  border: 0;
  cursor: pointer;
  color: var(--text-secondary, #888);
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: color 0.15s ease, background 0.15s ease;
}
.cmd-palette-clear:hover {
  color: var(--pink-primary, #d81b60);
  background: rgba(216, 27, 96, 0.08);
}
.cmd-palette-clear:focus-visible {
  outline: 2px solid var(--pink-primary, #d81b60);
  outline-offset: 2px;
}
.cmd-palette-kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  background: rgba(0, 0, 0, 0.07);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-secondary, #888);
  font-family: inherit;
}
.cmd-palette-results {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  scrollbar-width: thin;
}
.cmd-palette-results::-webkit-scrollbar { width: 6px; }
.cmd-palette-results::-webkit-scrollbar-thumb {
  background: rgba(216, 27, 96, 0.25);
  border-radius: 3px;
}
.cmd-palette-section { padding: 4px 0; }
.cmd-palette-section-title {
  padding: 8px 18px 4px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--pink-primary, #d81b60);
  opacity: 0.85;
}
.cmd-palette-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 18px;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background 0.10s ease, border-color 0.10s ease;
}
.cmd-palette-item:hover {
  background: rgba(216, 27, 96, 0.05);
}
.cmd-palette-item.is-active {
  background: rgba(216, 27, 96, 0.10);
  border-left-color: var(--pink-primary, #d81b60);
}
.cmd-palette-item:focus-visible {
  outline: 2px solid var(--pink-primary, #d81b60);
  outline-offset: -3px;
}
.cmd-palette-item > i {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--pink-light, #fde7f1);
  color: var(--pink-primary, #d81b60);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
}
.cmd-palette-item-label {
  flex: 1;
  min-width: 0;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text-main, #222);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cmd-palette-item-hint {
  font-size: 0.72rem;
  color: var(--text-secondary, #888);
  background: rgba(0, 0, 0, 0.04);
  padding: 2px 10px;
  border-radius: 999px;
  flex-shrink: 0;
  font-weight: 600;
}
body.dark-mode .cmd-palette-item-hint {
  background: rgba(255, 255, 255, 0.07);
  color: #c0c4cc;
}
.cmd-palette-empty {
  padding: 50px 20px 30px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: var(--text-secondary, #666);
}
.cmd-palette-empty i {
  font-size: 2.2rem;
  opacity: 0.4;
  color: var(--pink-primary, #d81b60);
}
.cmd-palette-empty p {
  margin: 0;
  font-size: 0.92rem;
}
.cmd-palette-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 8px 18px;
  border-top: 1px solid var(--border-color, rgba(216, 27, 96, 0.1));
  font-size: 0.72rem;
  color: var(--text-secondary, #888);
}
.cmd-palette-footer-pair {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.cmd-palette-footer-text {
  text-transform: lowercase;
  letter-spacing: 0.02em;
}
@media (max-width: 600px) {
  .cmd-palette-overlay {
    padding-top: 4vh;
    align-items: flex-start;
  }
  .cmd-palette-modal {
    max-width: 100%;
    max-height: 88vh;
    border-radius: 14px 14px 0 0;
    margin: 0 8px;
  }
  .cmd-palette-item {
    padding: 10px 14px;
    gap: 10px;
  }
  .cmd-palette-footer {
    gap: 10px;
    padding: 8px 12px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .cmd-palette-overlay,
  .cmd-palette-modal,
  .cmd-palette-item,
  .cmd-palette-clear {
    animation: none !important;
    transition: none !important;
  }
}
`;
