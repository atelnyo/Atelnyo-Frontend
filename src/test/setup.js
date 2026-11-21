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

// localStorage — Node 22+ exposes a global localStorage that is
// unavailable without --localstorage-file, and jsdom v26 fails to
// install its own on top of it. Store tests (cart, favorites, auth)
// need a real in-memory implementation under BOTH window and global.
if (typeof window !== 'undefined' && !window.localStorage) {
  class MemoryStorage {
    constructor() { this._values = new Map(); }
    get length() { return this._values.size; }
    key(index) { return Array.from(this._values.keys())[index] ?? null; }
    getItem(key) {
      const k = String(key);
      return this._values.has(k) ? this._values.get(k) : null;
    }
    setItem(key, value) { this._values.set(String(key), String(value)); }
    removeItem(key) { this._values.delete(String(key)); }
    clear() { this._values.clear(); }
  }
  const storage = new MemoryStorage();
  try {
    Object.defineProperty(window, 'localStorage', {
      value: storage, configurable: true,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage, configurable: true,
    });
  } catch {
    // A read-only global in a future runtime: the affected test can
    // still opt into its own storage.
  }
}
