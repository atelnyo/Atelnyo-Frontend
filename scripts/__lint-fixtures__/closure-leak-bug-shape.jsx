/**
 * scripts/__lint-fixtures__/closure-leak-bug-shape.jsx
 *
 * Self-contained fixture that recreates the EXACT shape of the
 * MusicCard bug:
 *   * Module-level `MusicCard` component renders JSX that calls a
 *     nested helper `renderSpotlightSection()` from inside the JSX
 *     expression container.
 *   * `renderSpotlightSection` is declared as a NESTED function
 *     inside the module-level `Explore` component's body.
 *
 * Expected lint outcome
 * ---------------------
 * scripts/lint-closure-leak.cjs should report exactly ONE finding
 * at the JSX container that invokes `renderSpotlightSection()` —
 * not at the definition site, not at sibling calls, and NOT at any
 * of the false-positive guards (React hooks, console.*, JSX
 * intrinsic <div /> etc.).
 *
 * What's intentionally NOT a leak
 * -------------------------------
 *   * `<MusicCard />` — JSX tag, resolves via the same module-level
 *     function declaration (sibling reference, naturally OK).
 *   * `MusicCard(...)` — direct call to the module-level sibling.
 *   * `useState(0)` — React hook global (whitelist).
 *   * `console.log('x')` — built-in global (whitelist).
 *   * `<div>...</div>` — lowercase JSX intrinsic (whitelist).
 *   * `localFn()` inside `<MusicCard/>`'s body — MF's own nested
 *     helper, in-scope.
 *   * `this.scoped` — implicit JSX scope via the closure.
 */
import React, { useState } from 'react';

function MusicCard({ track, onOpen }) {
  // Local nested helper — IN-SCOPE inside MusicCard, must NOT be
  // flagged. If we flagged this, the false-positive rate would be
  // 100% on every reusable component.
  function localFn() {
    return <span>{track.title}</span>;
  }
  return (
    <div className="explore-card explore-card-music" onClick={() => onOpen?.(track)}>
      {localFn()}
      <p>{track.artist}</p>
      {/* LEAK: renderSpotlightSection is defined inside Explore()'s
          closure body; from MusicCard (module-level) this resolves
          to undefined at runtime — ReferenceError. */}
      {renderSpotlightSection()}
      <button onClick={() => console.log('noop')}>noop</button>
    </div>
  );
}

export function Explore({ user }) {
  const [count, setCount] = useState(0);
  // Nested helper inside Explore's closure. From Explore itself
  // it's reachable via the closure; from MusicCard (sibling at
  // module level) it's NOT.
  function renderSpotlightSection() {
    return <div>spotlight rail for {user?.username || 'anon'}</div>;
  }
  return (
    <>
      <p>Featured ({count})</p>
      <button onClick={() => setCount((n) => n + 1)}>+</button>
      {/* OK: MusicCard is a module-level sibling — direct JSX
          component reference is the supported idiom. */}
      <MusicCard track={{ id: 1, title: 't', artist: 'a' }} onOpen={() => {}} />
      {/* OK: renderSpotlightSection IS in Explore's closure. */}
      {renderSpotlightSection()}
    </>
  );
}
