/**
 * src/accessibility/components/SkipNavigation.jsx
 *
 * Skip navigation link — the first focusable element on the page.
 * Hidden by default, becomes visible when focused via Tab.
 * Jumps to the main content area.
 *
 * The main content area should have id="a11y-main-content" (or
 * the FOCUS_MAIN_ID constant).
 */
import React from 'react';
import { FOCUS_SKIP_ID, FOCUS_MAIN_ID } from '../utils/constants';
import { getA11yString } from '../utils/constants';

export default function SkipNavigation({ lang = 'en' }) {
  const handleClick = (e) => {
    e.preventDefault();
    const main = document.getElementById(FOCUS_MAIN_ID);
    if (main) {
      // Ensure the main element can receive focus
      if (main.tabIndex < 0) {
        main.setAttribute('tabindex', '-1');
      }
      main.focus();
    }
  };

  return (
    <a
      href={`#${FOCUS_MAIN_ID}`}
      id={FOCUS_SKIP_ID}
      onClick={handleClick}
      style={{
        position: 'absolute',
        top: '-100%',
        left: '16px',
        zIndex: 11000,
        padding: '12px 24px',
        background: 'var(--color-primary, #d81b60)',
        color: 'var(--text-on-primary, #fff)',
        borderRadius: '0 0 8px 8px',
        fontWeight: 700,
        fontSize: '0.9rem',
        textDecoration: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        transition: 'top 0.15s ease',
      }}
      onFocus={(e) => { e.target.style.top = '0'; }}
      onBlur={(e) => { e.target.style.top = '-100%'; }}
    >
      {getA11yString(lang, 'skipToMainContent')}
    </a>
  );
}
