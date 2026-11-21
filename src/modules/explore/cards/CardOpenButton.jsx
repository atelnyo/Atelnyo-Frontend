/**
 * CardOpenButton — the single, real open control that covers an
 * Explore card.
 *
 * Cards used to be ``div role="button"`` wrappers with their own save /
 * play / buy / menu buttons nested inside, which is invalid ARIA and
 * gives keyboard users a focus stop that contains other focus stops.
 * Each card now renders one transparent button over the whole card
 * (``.explore-card--overlay`` keeps clicks on the nested controls above
 * it) and drops its own ``role``/``tabIndex``/``onKeyDown``.
 */
import React from 'react';

export default function CardOpenButton({ label, onClick, testId }) {
  return (
    <button
      type="button"
      className="explore-card-open"
      aria-label={label}
      onClick={onClick}
      data-testid={testId}
    />
  );
}
