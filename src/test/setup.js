/**
 * src/test/setup.js — Vitest environment setup (T031).
 *
 * Loads jest-dom matchers (toBeInTheDocument, etc.) so component
 * assertions read naturally, and adds minimal jsdom polyfills that
 * browser APIs (matchMedia, ResizeObserver) need to exist under
 * Node's jsdom environment.
 */
import '@testing-library/jest-dom/vitest';

// matchMedia — used by canHoverPlay() (hover previews), useDisplayMode
// and theme detection. jsdom doesn't implement it.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// ResizeObserver — used by a few layout-aware components.
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// scrollTo is not implemented in jsdom.
if (typeof window !== 'undefined' && !window.scrollTo) {
  window.scrollTo = () => {};
}
