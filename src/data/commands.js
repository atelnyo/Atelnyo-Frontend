// ─── src/data/commands.js ────────────────────────────────────────────
//
// Action registry for the Phase 49 §11.8 Cmd-K Studio Palette.
//
// Each command is a small descriptor:
//
//   id         — unique string key (also the localStorage-key under
//                ``atelnyo_cmd_recent`` for the recent-commands list).
//   label      — function (t) → string. Receives the active language
//                dictionary so the visible label is localized. Falls
//                back to the literal key if the dictionary is missing
//                the entry.
//   hint       — function (t) → string. Short affordance label that
//                surfaces on the right edge of each row. Tells the
//                user what KIND of action it is (`Switch to tab` /
//                `Open sheet` / `Action`) in any locale.
//   icon       — FontAwesome 5 class suffix (``fas <icon>``).
//   category   — bucket the palette uses to group results:
//                  • 'navigation'  — root tab switches (Explore, Mwen…).
//                  • 'sheet'       — URL-driven sheet opens via
//                                     ``navigateRR('/sheet/<path>')``.
//                  • 'action'      — discrete mutations (theme flip,
//                                     language swap, search summon).
//   action     — closure executed on Enter / click. Receives no
//                arguments because the registry is built fresh on each
//                render so the closures always capture the latest
//                React state setters.
//   keywords   — string[] of cross-language search aliases. The fuzzy
//                matcher appends these to the label-derived candidates
//                so a user searching in any of the 4 locales can find
//                the command they want. Adding more is cheap (~10
//                bytes per command) and dramatically improves
//                multilingual UX.
//
// WHY build this as a factory (``buildCommands({...bindings})``)
// instead of a static constant:
//   • The closures need the latest ``setActiveTab``, ``navigateRR``,
//     ``toggleTheme``, etc. — those are React state setters /
//     hooks values that change on every render. A static array would
//     close over the FIRST-render setters and break the moment the
//     user clicks the back button.
//   • The factory is called by CommandPalette.jsx inside ``useMemo``
//     keyed on the binding set so a binding change rebuilds the
//     registry without re-running on every render.
//
// WHY include cross-language keywords vs. relying on the translated
// label alone:
//   • A French-speaking user typing ``préférences`` would NOT find a
//     command whose label is ``Paramètres`` if the matcher only saw
//     the label (typing in French is normal for this userbase — the
//     project is HT/FR primary). Manually listing the non-English
//     alias in ``keywords`` makes the search continue to work
//     across language switches.
//   • Trade-off: the keyword list is hand-maintained. The drawback
//     is a translation drift risk (someone deletes a translation key
//     but forgets to remove the keyword). The cost is bounded — the
//     worst case is a "no match" instead of a crash — and the keyword
//     list lives in exactly one place this file.
// ─────────────────────────────────────────────────────────────────────

/**
 * Build the full command registry. Called by CommandPalette on every
 * palette-open tick; ``useMemo`` keeps the build cost at zero if no
 * binding changed.
 *
 * @param {Object} bindings  Hand-passed-in setters from App.jsx so
 *   closure-tied bindings are always the current React refs.
 * @returns {Array<{id, label, hint, icon, category, action, keywords}>}
 */
export const buildCommands = ({
  setActiveTab,
  navigateRR,
  toggleTheme,
  handleLangChange,
  showToast,
}) => ([
  // ─── Navigation (root tabs) ───────────────────────────────────────
  {
    id: 'nav-explore',
    label: t => t.tab_explore || 'Explore',
    hint: t => t.palette_hint_tab || 'Switch to tab',
    icon: 'fa-compass',
    category: 'navigation',
    action: () => setActiveTab('explore'),
    keywords: ['discover', 'home', 'tab', 'dekkouvri', 'explorer', 'explorar'],
  },
  {
    id: 'nav-mwen',
    label: t => t.tab_mwen || 'Mine',
    hint: t => t.palette_hint_tab || 'Switch to tab',
    icon: 'fa-bookmark',
    category: 'navigation',
    action: () => setActiveTab('mwen'),
    keywords: ['mine', 'saved', 'recent', 'mon', 'mío', 'favoris'],
  },
  {
    id: 'nav-commerce',
    label: t => t.tab_registration || 'Registration',
    hint: t => t.palette_hint_tab || 'Switch to tab',
    icon: 'fa-shopping-cart',
    category: 'navigation',
    action: () => setActiveTab('commerce'),
    keywords: ['shop', 'courses', 'inscription', 'boutique', 'tienda', 'kurs'],
  },
  {
    id: 'nav-favori',
    label: t => t.mwen_course_label ? 'Favori' : 'Favori',
    hint: t => t.palette_hint_tab || 'Switch to tab',
    icon: 'fa-heart',
    category: 'navigation',
    action: () => setActiveTab('favori'),
    keywords: ['favorites', 'loved', 'favoris', 'guardados', 'kore'],
  },
  {
    id: 'nav-rules',
    label: t => t.rules_title || 'Rules',
    hint: t => t.palette_hint_tab || 'Switch to tab',
    icon: 'fa-book',
    category: 'navigation',
    action: () => setActiveTab('rules'),
    keywords: ['protocol', 'guidelines', 'règles', 'reglas', 'règleman'],
  },

  // ─── Sheets (URL-driven over /sheet/*) ───────────────────────────
  {
    id: 'sheet-settings',
    label: t => t.settings || 'Settings',
    hint: t => t.palette_hint_sheet || 'Open sheet',
    icon: 'fa-cog',
    category: 'sheet',
    action: () => navigateRR('/sheet/settings'),
    keywords: ['preferences', 'config', 'paramètres', 'ajustes', 'preferans', 'pawòl'],
  },
  {
    id: 'sheet-calendar',
    label: t => 'Calendar',
    hint: t => t.palette_hint_sheet || 'Open sheet',
    icon: 'fa-calendar-alt',
    category: 'sheet',
    action: () => navigateRR('/sheet/calendar'),
    keywords: ['kalendriye', 'agenda', 'events', 'calendrier', 'calendario'],
  },
  {
    id: 'sheet-analytics',
    label: t => 'Analytics',
    hint: t => t.palette_hint_sheet || 'Open sheet',
    icon: 'fa-chart-line',
    category: 'sheet',
    action: () => navigateRR('/sheet/analytics'),
    keywords: ['creator', 'stats', 'metrics', 'stadistik', 'métrique'],
  },
  {
    id: 'sheet-referral',
    label: t => 'Referral',
    hint: t => t.palette_hint_sheet || 'Open sheet',
    icon: 'fa-gift',
    category: 'sheet',
    action: () => navigateRR('/sheet/referral'),
    keywords: ['invite', 'affiliate', 'parrainage', 'référence'],
  },

  // ─── Actions (discrete mutations) ────────────────────────────────
  {
    id: 'act-theme',
    label: t => t.toggle_theme || 'Toggle Theme',
    hint: t => t.palette_hint_action || 'Action',
    icon: 'fa-adjust',
    category: 'action',
    action: () => toggleTheme(),
    keywords: ['dark', 'light', 'mode', 'sombre', 'oscuro', 'sombre', 'tèm'],
  },
  {
    id: 'act-lang-ht',
    label: t => t.palette_lang_ht || 'Kreyòl · HT',
    hint: t => t.palette_hint_action || 'Action',
    icon: 'fa-globe',
    category: 'action',
    action: () => handleLangChange('ht'),
    keywords: ['language', 'creole', 'kreyol', 'langue', 'idioma', 'lang'],
  },
  {
    id: 'act-lang-en',
    label: t => t.palette_lang_en || 'English · EN',
    hint: t => t.palette_hint_action || 'Action',
    icon: 'fa-globe',
    category: 'action',
    action: () => handleLangChange('en'),
    keywords: ['language', 'english', 'anglais', 'inglés', 'lang'],
  },
  {
    id: 'act-lang-fr',
    label: t => t.palette_lang_fr || 'Français · FR',
    hint: t => t.palette_hint_action || 'Action',
    icon: 'fa-globe',
    category: 'action',
    action: () => handleLangChange('fr'),
    keywords: ['language', 'french', 'francais', 'français', 'lang'],
  },
  {
    id: 'act-lang-es',
    label: t => t.palette_lang_es || 'Español · ES',
    hint: t => t.palette_hint_action || 'Action',
    icon: 'fa-globe',
    category: 'action',
    action: () => handleLangChange('es'),
    keywords: ['language', 'spanish', 'espanol', 'español', 'lang'],
  },
  {
    id: 'act-search',
    label: t => t.palette_open_search || 'Open Global Search',
    hint: t => t.palette_hint_action || 'Action',
    icon: 'fa-search',
    category: 'action',
    action: () => {
      // Synthesize the user's ``Cmd-K`` keystroke so the existing global
      // search overlay (already wired in App.jsx) receives it and pops
      // up. We dispatch on document so the existing listener picks it
      // up; the radio `key:'k', modifiers: ctrl/meta + no shift` is the
      // exact contract App.jsx's global-search handler expects.
      const ev = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(ev);
    },
    keywords: ['global', 'find', 'cherche', 'recherche', 'buscar', 'chèche'],
  },
  {
    id: 'act-toast-demo',
    label: t => t.palette_demo_toast || 'Show demo toast',
    hint: t => t.palette_hint_action || 'Action',
    icon: 'fa-bell',
    category: 'action',
    action: () => showToast(
      '🎉 ' + (typeof window !== 'undefined' ? 'Palette demo toast — ' : '') +
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      'check-circle',
    ),
    keywords: ['demo', 'test', 'notification', 'démo'],
  },
]);
