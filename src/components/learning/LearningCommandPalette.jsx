/**
 * LearningCommandPalette — ⌘K / Ctrl+K quick jump for the Learning Space.
 *
 * Why: a long course is 8-12 modules and dozens of activities. Scrolling
 * the sidebar to find "that typography exercise again" is slow, and on
 * mobile the curriculum lives in a drawer. Typing three letters is faster
 * than any amount of scrolling, so this is the "intelligent" shortcut
 * layer on top of the same honest data the sidebar uses.
 *
 * Design rules:
 *   • Renders NOTHING while closed — zero cost for learners who never
 *     open it, no extra listeners, no tree walked.
 *   • Search is local and synchronous (module titles + activity titles),
 *     accent-insensitive, so it answers in the same frame as the keypress.
 *   • Results are capped, so a 300-activity course still opens instantly.
 *   • Keyboard first: ↑ ↓ to move, ↵ to open, Esc to close; the input
 *     keeps focus and the active row is announced via aria-activedescendant.
 *   • Respects prefers-reduced-motion (see CSS).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './LearningCommandPalette.css';

// Caps keep the closed → open transition cheap on long courses while
// still showing a full curriculum (12 modules covers every course we
// ship today), and only the first handful of activities per keystroke.
const MAX_MODULES = 12;
const MAX_BLOCKS = 8;

const TYPE_LABEL = {
  text: { en: 'Reading', ht: 'Lekti' },
  image: { en: 'Image', ht: 'Imaj' },
  video: { en: 'Video', ht: 'Videyo' },
  callout: { en: 'Note', ht: 'Nòt' },
  embed: { en: 'Embed', ht: 'Entegre' },
  vocabulary: { en: 'Vocabulary', ht: 'Vokabilè' },
  fill_blank: { en: 'Fill the blank', ht: 'Ranpli espas' },
  matching: { en: 'Match', ht: 'Asosye' },
  assignment: { en: 'Assignment', ht: 'Devwa' },
  project: { en: 'Project', ht: 'Pwojè' },
  code: { en: 'Code', ht: 'Kòd' },
  quiz: { en: 'Quiz', ht: 'Egzamen' },
  checklist: { en: 'Checklist', ht: 'Lis tcheke' },
};

/** Accent- and case-insensitive text used for matching and ranking. */
export function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Flat, ordered list of everything the palette can open.
 * Pure function — no React, so it is cheap to test and memoize.
 */
export function buildPaletteItems({
  syllabus = [],
  completedBlocksMap = {},
  completedModules = [],
  moduleState,
  isHt = false,
} = {}) {
  const doneModules = new Set(completedModules.map(Number));
  const items = [];

  syllabus.forEach((item, mi) => {
    if (typeof item !== 'object' || item == null) return;
    const blocks = Array.isArray(item.blocks) ? item.blocks : [];
    const state = typeof moduleState === 'function' ? moduleState(mi) : null;
    const completed = doneModules.has(mi) || state?.status === 'completed';
    const moduleTitle = item.title || (isHt ? `Modil ${mi + 1}` : `Module ${mi + 1}`);
    const doneCount = (completedBlocksMap[String(mi)] || new Set()).size;

    items.push({
      id: `module-${mi}`,
      kind: 'module',
      moduleIndex: mi,
      blockId: null,
      label: moduleTitle,
      meta: isHt
        ? `Modil ${mi + 1} · ${doneCount}/${blocks.length} aktivite`
        : `Module ${mi + 1} · ${doneCount}/${blocks.length} activities`,
      icon: completed ? 'fa-circle-check' : 'fa-book-open',
      locked: Boolean(state?.locked),
      done: completed,
      haystack: normalize(`${moduleTitle} modil module ${mi + 1}`),
    });

    blocks.forEach((block, bi) => {
      if (!block || !block.id) return;
      const typeLabel = (TYPE_LABEL[block.type] || { en: 'Activity', ht: 'Aktivite' })[isHt ? 'ht' : 'en'];
      const label = block.title || typeLabel;
      const done = Boolean((completedBlocksMap[String(mi)] || new Set()).has(block.id));
      items.push({
        id: `block-${block.id}`,
        kind: 'block',
        moduleIndex: mi,
        blockId: block.id,
        blockType: block.type,
        label,
        meta: isHt
          ? `Modil ${mi + 1} · ${typeLabel}`
          : `Module ${mi + 1} · ${typeLabel}`,
        icon: done ? 'fa-circle-check' : 'fa-circle-play',
        locked: Boolean(state?.locked),
        done,
        subtitle: block.title ? typeLabel : '',
        haystack: normalize(`${label} ${typeLabel} ${moduleTitle} modil module ${mi + 1}`),
      });
    });
  });

  return items;
}

/**
 * Rank items against a query. Every whitespace-separated token must
 * appear; earlier/stronger matches rank first. Empty query returns the
 * list untouched (the caller groups and caps it).
 */
export function filterPaletteItems(items, query) {
  const q = normalize(query);
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);

  const scored = [];
  for (const item of items) {
    let score = 0;
    let ok = true;
    for (const token of tokens) {
      const at = item.haystack.indexOf(token);
      if (at === -1) { ok = false; break; }
      // Prefix and word starts beat mid-word matches; shorter matches win.
      if (at === 0) score -= 100;
      else if (item.haystack[at - 1] === ' ') score -= 40;
      score += at;
    }
    if (ok) scored.push({ item, score });
  }

  scored.sort((a, b) => a.score - b.score);
  return scored.map((s) => s.item);
}

/** Split filtered items into the two visible groups, capped per group. */
export function groupPaletteItems(items) {
  const modules = [];
  const blocks = [];
  for (const item of items) {
    if (item.kind === 'module') {
      if (modules.length < MAX_MODULES) modules.push(item);
    } else if (blocks.length < MAX_BLOCKS) {
      blocks.push(item);
    }
    if (modules.length >= MAX_MODULES && blocks.length >= MAX_BLOCKS) break;
  }
  return { modules, blocks };
}

export default function LearningCommandPalette({
  open = false,
  onClose,
  isHt = false,
  syllabus = [],
  completedBlocksMap = {},
  completedModules = [],
  moduleState,
  actions = [],
  onSelectModule,
  onSelectBlock,
  onBlocked,
  resumeItem = null,
}) {
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const allItems = useMemo(
    () => buildPaletteItems({ syllabus, completedBlocksMap, completedModules, moduleState, isHt }),
    [syllabus, completedBlocksMap, completedModules, moduleState, isHt],
  );

  const results = useMemo(() => {
    const q = normalize(query);
    // Actions are a handful of fixed commands — plain substring match is
    // both enough and predictable.
    const matchedActions = actions.filter(
      (a) => !q || normalize(`${a.label} ${a.keywords || ''}`).includes(q),
    );
    const groups = groupPaletteItems(filterPaletteItems(allItems, query));
    return [
      ...matchedActions.map((a) => ({ ...a, kind: 'action' })),
      ...groups.modules,
      ...groups.blocks,
    ];
  }, [allItems, query, actions]);

  const flat = useMemo(() => {
    if (query || !resumeItem) return results;
    return [resumeItem, ...results];
  }, [results, query, resumeItem]);

  // Reset each time it opens — a palette that remembers a stale query is
  // confusing, and autofocus on the field is the whole point.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (active > flat.length - 1) setActive(flat.length ? 0 : -1);
  }, [flat.length, active]);

  // Keep the highlighted row in view while arrowing through long lists.
  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector('[data-active="true"]');
    node?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open]);

  const choose = useCallback((item) => {
    if (!item) return;
    // Locked rows never navigate — but they must SAY so instead of
    // swallowing the keystroke (the parent shows the "not unlocked yet"
    // message the sidebar shows too).
    if (item.locked) { onBlocked?.(item); return; }
    if (item.kind === 'action') item.run?.();
    else if (item.kind === 'module') onSelectModule?.(item.moduleIndex);
    else if (item.kind === 'block') onSelectBlock?.(item.moduleIndex, item.blockId);
    onClose?.();
  }, [onSelectBlock, onSelectModule, onClose, onBlocked]);

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose?.(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (flat.length ? (i + 1) % flat.length : -1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : -1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      choose(flat[active]);
    }
  }, [flat, active, choose, onClose]);

  if (!open) return null;

  const optionId = (item, i) => `ls-cmd-opt-${item?.id || i}-${i}`;

  return (
    <div className="ls-cmd-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div
        className="ls-cmd"
        role="dialog"
        aria-modal="true"
        aria-label={isHt ? 'Ale vit nan kou a' : 'Quick jump in the course'}
        onKeyDown={onKeyDown}
      >
        <div className="ls-cmd-input-row">
          <i className="fas fa-magnifying-glass ls-cmd-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            className="ls-cmd-input"
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            placeholder={isHt ? 'Chèche yon modil oswa yon aktivite…' : 'Search a module or an activity…'}
            aria-label={isHt ? 'Chèche' : 'Search'}
            aria-controls="ls-cmd-list"
            aria-activedescendant={flat[active] ? optionId(flat[active], active) : undefined}
            autoComplete="off"
            spellCheck="false"
          />
          <kbd className="ls-cmd-kbd">esc</kbd>
        </div>

        <div className="ls-cmd-list" id="ls-cmd-list" role="listbox" ref={listRef}>
          {flat.length === 0 && (
            <p className="ls-cmd-empty">
              {isHt ? 'Anyen pa matche. Eseye yon lòt mo.' : 'Nothing matches. Try another word.'}
            </p>
          )}
          {flat.map((item, i) => (
            <button
              key={item.id}
              type="button"
              id={optionId(item, i)}
              role="option"
              aria-selected={i === active}
              data-active={i === active ? 'true' : 'false'}
              className={`ls-cmd-item${i === active ? ' is-active' : ''}${item.locked ? ' is-locked' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(item)}
            >
              <i className={`fas ${item.icon || 'fa-arrow-right'} ls-cmd-item-icon`} aria-hidden="true" />
              <span className="ls-cmd-item-text">
                <span className="ls-cmd-item-label">{item.label}</span>
                {item.meta && <span className="ls-cmd-item-meta">{item.meta}</span>}
              </span>
              {item.locked && <i className="fas fa-lock ls-cmd-item-lock" aria-hidden="true" />}
              {item.done && !item.locked && <span className="ls-cmd-item-done">{isHt ? 'fè' : 'done'}</span>}
            </button>
          ))}
        </div>

        <div className="ls-cmd-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> {isHt ? 'navige' : 'navigate'}</span>
          <span><kbd>↵</kbd> {isHt ? 'ouvri' : 'open'}</span>
          <span><kbd>esc</kbd> {isHt ? 'fèmen' : 'close'}</span>
        </div>
      </div>
    </div>
  );
}
