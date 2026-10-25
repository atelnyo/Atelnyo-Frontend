// Server-only shims. Imported first by entry-server.jsx so that browser
// globals read during SSR render (state initializers, route helpers) return
// empty values instead of throwing ReferenceError in Node. Effects never run
// on the server, so these stubs are only read during render.
const storage = () => {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
    clear: () => { data.clear(); },
    key: (i) => Array.from(data.keys())[i] ?? null,
    get length() { return data.size; },
  };
};

const noop = () => {};
const fakeElement = () => ({
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  style: {},
  setAttribute: noop,
  removeAttribute: noop,
  getAttribute: () => null,
  appendChild: noop,
  removeChild: noop,
  addEventListener: noop,
  removeEventListener: noop,
});

if (typeof globalThis.navigator === 'undefined' || globalThis.navigator.onLine === undefined) {
  // Server renders assume a connected browser so no offline banner is baked into the HTML.
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true, userAgent: 'ssr', language: 'fr', languages: ['fr'], platform: 'server' }, configurable: true });
}

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = storage();
  globalThis.sessionStorage = storage();
}

if (typeof globalThis.window === 'undefined') {
  const url = new URL('https://atelnyo.site/');
  const location = {
    href: url.href,
    origin: url.origin,
    protocol: url.protocol,
    host: url.host,
    hostname: url.hostname,
    port: url.port,
    pathname: '/',
    search: '',
    hash: '',
    replace: noop,
    assign: noop,
    reload: noop,
  };
  globalThis.location = location;
  globalThis.window = {
    location,
    localStorage: globalThis.localStorage,
    sessionStorage: globalThis.sessionStorage,
    history: { back: noop, forward: noop, pushState: noop, replaceState: noop, state: null },
    navigator: globalThis.navigator,
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop }),
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: () => true,
    scrollTo: noop,
    scrollY: 0,
    innerWidth: 1280,
    innerHeight: 800,
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
    cancelAnimationFrame: (id) => clearTimeout(id),
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
    open: noop,
    fetch: globalThis.fetch,
    CustomEvent: globalThis.CustomEvent,
    Event: globalThis.Event,
    URL: globalThis.URL,
    URLSearchParams: globalThis.URLSearchParams,
  };
  globalThis.history = globalThis.window.history;
  globalThis.document = {
    body: fakeElement(),
    documentElement: fakeElement(),
    head: fakeElement(),
    title: '',
    cookie: '',
    visibilityState: 'visible',
    hidden: false,
    createElement: () => fakeElement(),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: noop,
    removeEventListener: noop,
  };
}
