/**
 * scripts/__lint-fixtures__/closure-leak-bug-shape-hoc.jsx
 *
 * Positive fixture for the HOC unwrap branches in
 * scripts/lint-closure-leak.cjs. Locks the analyzer's
 * React.memo + forwardRef handling so a future @babel scope-rule
 * change that breaks the unwrap branch fails the regression
 * test loudly instead of silently allowing the regression.
 *
 * Scenario
 * --------
 *  * `Wrap1` is wrapped in `React.memo(function MemoCard(...) {})`.
 *    Inside the inner FunctionExpression, MemoCard renders
 *    `{renderSpotlightSection()}`. `renderSpotlightSection` is
 *    declared as a NESTED helper inside `Explore()`'s body —
 *    same bug shape as closure-leak-bug-shape.jsx, but the
 *    consuming component is one React.memo layer deep.
 *  * `Wrap2` is wrapped in `forwardRef(function FwdCard(...) {})`
 *    with the same leak.
 *  * `Anon` is `React.memo(function (props) { ... })` — ANONYMOUS
 *    inner function. The analyzer SKIPS this at registration time
 *    (`p.node.id.name` is empty), so even if the body has the
 *    leak call, it's invisible to the analyzer — a known
 *    limitation.  We assert NO finding on Anon so a future
 *    scope-refactor that accidentally starts attributing findings
 *    to anonymous HOCs becomes a test failure (forced-attribution
 *    would mean attributing to the OUTER const X, and the call
 *    site wouldn't even be in X's body — would produce confusing
 *    pointer line numbers).
 *
 * Expected finding count: EXACTLY 2  (Wrap1 + Wrap2 leak call
 * sites, one each).  Anon's leak is a known false-negative — see
 * the analyzer docstring.
 */
import React, { forwardRef } from 'react';

const Wrap1 = React.memo(function MemoCard({ track }) {
  // Local nested helper — in-scope inside the HOC inner fn, must
  // NOT be flagged. If a future scope refactor starts flagging
  // nested helpers inside HOC-wrapped components, this guards
  // against the false-positive rate jumping to 100% on legitimate
  // reusable components.
  function localFn() {
    return <span>{track.title}</span>;
  }
  return (
    <div
      className="explore-card explore-card-music"
      onClick={() => console.log('noop')}
    >
      {localFn()}
      {/*
        LEAK: `renderSpotlightSection` is declared as a nested
        fn inside `Explore()`'s body. From inside the inner
        MemoCard FunctionExpression wrapped by React.memo, this
        resolves to undefined at runtime — ReferenceError.
      */}
      {renderSpotlightSection()}
    </div>
  );
});

const Wrap2 = forwardRef(function FwdCard({ label }, ref) {
  return (
    <div className="explore-card explore-card-fwd">
      <span>{label}</span>
      {/* LEAK: same shape as Wrap1, but via `forwardRef` instead of `React.memo`. */}
      {renderSpotlightSection()}
    </div>
  );
});

// Anonymous HOC wrapper. The inner FunctionExpression has no `.id`
// (it's not a named function expression), so the analyzer's HOC
// unwrap branch returns early — `Anon` is NOT registered as a
// module-level component. Any leak inside its body is invisible
// to the analyzer. We rely on the analyzer's `if (isHoc) return;`
// to skip; this guard asserts the analyzer does NOT start
// attributing findings to anonymous HOCs in a future refactor.
const Anon = React.memo(function (props) {
  return (
    <div className="anon-leak-attempt">
      <p>{props.label}</p>
      {/* KNOWN LIMITATION: even though this is the same bug
          shape, the analyzer cannot connect the call site to a
          module-level identifier. Not flagged. */}
      {renderSpotlightSection()}
    </div>
  );
});

export function Explore({ user }) {
  // Same nested helper as the non-HOC fixture.
  function renderSpotlightSection() {
    return <div>spotlight rail for {user?.username || 'anon'}</div>;
  }
  return (
    <>
      {/* OK: Wrap1, Wrap2, Anon are all module-level siblings
          (well — Anon skipped at registration, but the const
          symbol IS bound at Program scope so it's reachable). */}
      <Wrap1 track={{ id: 1, title: 't' }} />
      <Wrap2 label="hello" />
      <Anon label="anon" />
      {/* OK: renderSpotlightSection IS in Explore's closure. */}
      {renderSpotlightSection()}
    </>
  );
}
